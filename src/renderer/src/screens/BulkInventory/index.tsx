import { useState, useEffect, type ReactElement, type FormEvent } from 'react'
import { useAppStore } from '../../store/appStore'
import { kgToGrams, paiseToCurrency, formatQuantity, bulkUnit } from '@shared/money'
import type { Product, BulkStockRow, BulkArrivalRow, BulkAdjustmentRow } from '@shared/types'

// Stock map keyed by productId
type StockMap = Record<number, BulkStockRow>

export default function BulkInventoryScreen(): ReactElement {
  const { user } = useAppStore()
  const isAdmin = user?.role === 'admin'

  const [products, setProducts] = useState<Product[]>([])
  const [stockMap, setStockMap] = useState<StockMap>({})
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [arrivals, setArrivals] = useState<BulkArrivalRow[]>([])
  const [adjustments, setAdjustments] = useState<BulkAdjustmentRow[]>([])
  const [showArrival, setShowArrival] = useState(false)
  const [showAdjust, setShowAdjust] = useState(false)
  const [pageError, setPageError] = useState('')

  async function loadStock(): Promise<void> {
    const [pRes, sRes] = await Promise.all([
      window.api.products.listProducts(),
      window.api.bulkInventory.listAllBulkStock()
    ])
    if (!pRes.ok) { setPageError(pRes.error); return }
    if (!sRes.ok) { setPageError(sRes.error); return }
    setProducts(pRes.data)
    const map: StockMap = {}
    for (const s of sRes.data) map[s.productId] = s
    setStockMap(map)
  }

  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null) // arrivalId pending delete
  const [deleteError, setDeleteError] = useState('')

  async function handleDeleteArrival(arrivalId: number): Promise<void> {
    const res = await window.api.bulkInventory.deleteArrival({ arrivalId, userId: user!.id })
    if (!res.ok) { setDeleteError(res.error); return }
    setDeleteConfirm(null)
    setDeleteError('')
    loadStock()
    loadDetail(selectedId!)
  }

  async function loadDetail(productId: number): Promise<void> {
    const [aRes, adjRes] = await Promise.all([
      window.api.bulkInventory.listArrivals({ productId }),
      window.api.bulkInventory.listAdjustments({ productId })
    ])
    if (aRes.ok) setArrivals(aRes.data)
    if (adjRes.ok) setAdjustments(adjRes.data)
  }

  useEffect(() => { loadStock() }, [])

  function selectProduct(id: number): void {
    setSelectedId(id)
    setShowArrival(false)
    setShowAdjust(false)
    loadDetail(id)
  }

  const selectedProduct = products.find((p) => p.id === selectedId)

  // ── Record Arrival form ─────────────────────────────────────────────────────

  function ArrivalForm(): ReactElement {
    const [kgStr, setKgStr] = useState('')
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
    const [costStr, setCostStr] = useState('')
    const [notes, setNotes] = useState('')
    const [err, setErr] = useState('')

    async function submit(e: FormEvent): Promise<void> {
      e.preventDefault()
      const qtyGrams = kgToGrams(parseFloat(kgStr))
      if (qtyGrams <= 0) { setErr('Quantity must be positive'); return }

      const costPerKgPaise =
        isAdmin && costStr.trim() !== ''
          ? Math.round(parseFloat(costStr) * 100)
          : null

      const res = await window.api.bulkInventory.recordArrival({
        productId: selectedId!,
        qtyGrams,
        date,
        costPerKgPaise,
        notes: notes.trim() || undefined,
        userId: user!.id
      })
      if (!res.ok) { setErr(res.error); return }
      setShowArrival(false)
      loadStock()
      loadDetail(selectedId!)
    }

    return (
      <form onSubmit={submit} className="bg-green-50 border border-green-200 rounded p-4 flex flex-col gap-3">
        <h3 className="font-semibold text-gray-800 text-sm">Record Bulk Arrival</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Quantity ({bulkUnit(selectedProduct?.unitType ?? 'weight')})</label>
            <input type="number" step="0.001" min="0.001" value={kgStr}
              onChange={(e) => setKgStr(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm" required autoFocus />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm" required />
          </div>
          {/* Cost field — Admin only (rules.md #14, never shown to staff) */}
          {isAdmin && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Cost per {bulkUnit(selectedProduct?.unitType ?? 'weight')} (₹) — optional</label>
              <input type="number" step="0.01" min="0" value={costStr}
                onChange={(e) => setCostStr(e.target.value)}
                placeholder="Leave blank = no cost"
                className="border border-gray-300 rounded px-2 py-1 text-sm" />
              {costStr.trim() === '' && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                  ⚠ No cost entered — profit for this stock will show as unknown.
                </p>
              )}
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm" />
          </div>
        </div>
        {err && <p className="text-xs text-red-600">{err}</p>}
        <div className="flex gap-2">
          <button type="submit"
            className="bg-green-700 text-white px-4 py-1.5 rounded text-sm cursor-pointer hover:bg-green-800 transition-colors">
            Save Arrival
          </button>
          <button type="button" onClick={() => setShowArrival(false)}
            className="px-4 py-1.5 border rounded text-sm cursor-pointer">Cancel</button>
        </div>
      </form>
    )
  }

  // ── Adjust Stock form (Admin only) ──────────────────────────────────────────

  function AdjustForm(): ReactElement {
    const [kgStr, setKgStr] = useState('')
    const [reason, setReason] = useState('manual')
    const [notes, setNotes] = useState('')
    const [err, setErr] = useState('')

    async function submit(e: FormEvent): Promise<void> {
      e.preventDefault()
      const qtyChangeGrams = kgToGrams(parseFloat(kgStr))
      const res = await window.api.bulkInventory.recordAdjustment({
        productId: selectedId!,
        qtyChangeGrams,
        reason,
        notes: notes.trim() || undefined,
        userId: user!.id
      })
      if (!res.ok) { setErr(res.error); return }
      setShowAdjust(false)
      loadStock()
      loadDetail(selectedId!)
    }

    return (
      <form onSubmit={submit} className="bg-orange-50 border border-orange-200 rounded p-4 flex flex-col gap-3">
        <h3 className="font-semibold text-gray-800 text-sm">Adjust Bulk Stock</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Change ({bulkUnit(selectedProduct?.unitType ?? 'weight')}, use − for removal)</label>
            <input type="number" step="0.001" value={kgStr}
              onChange={(e) => setKgStr(e.target.value)}
              placeholder="e.g. -2.5 or 5"
              className="border border-gray-300 rounded px-2 py-1 text-sm" required autoFocus />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Reason</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm">
              <option value="manual">Manual correction</option>
              <option value="damage">Damage</option>
              <option value="wastage">Wastage</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="col-span-2 flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm" />
          </div>
        </div>
        {err && <p className="text-xs text-red-600">{err}</p>}
        <div className="flex gap-2">
          <button type="submit"
            className="bg-orange-600 text-white px-4 py-1.5 rounded text-sm cursor-pointer hover:bg-orange-700 transition-colors">
            Save Adjustment
          </button>
          <button type="button" onClick={() => setShowAdjust(false)}
            className="px-4 py-1.5 border rounded text-sm cursor-pointer">Cancel</button>
        </div>
      </form>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-gray-800 mb-4">Bulk Inventory</h1>
      {pageError && <p className="text-red-600 text-sm mb-3">{pageError}</p>}

      <div className="flex gap-4">
        {/* Product list with stock + low-stock alert */}
        <div className="w-72 flex-shrink-0">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Products</div>
          {products.map((p) => {
            const stock = stockMap[p.id]
            const qty = stock?.qtyGrams ?? 0
            const isLow = qty < p.bulkLowStockGrams
            return (
              <div key={p.id}
                onClick={() => selectProduct(p.id)}
                className={`px-3 py-2.5 rounded mb-1 cursor-pointer transition-colors ${
                  selectedId === p.id ? 'bg-green-700 text-white' : 'hover:bg-gray-100 text-gray-800'
                }`}>
                <div className="flex justify-between items-center">
                  <span className="font-medium text-sm">{p.name}</span>
                  {isLow && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                      selectedId === p.id ? 'bg-red-500 text-white' : 'bg-red-100 text-red-700'
                    }`}>Low</span>
                  )}
                </div>
                <div className={`text-xs mt-0.5 ${selectedId === p.id ? 'text-green-200' : 'text-gray-500'}`}>
                  {formatQuantity(qty, p.unitType)}
                  {/* Avg cost only shown to admin */}
                  {isAdmin && stock?.avgCostPerKg != null && (
                    <span className="ml-2">@ {paiseToCurrency(Math.round(stock.avgCostPerKg * 100))}/{bulkUnit(p.unitType)}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Detail panel */}
        {selectedProduct && (
          <div className="flex-1 flex flex-col gap-4">
            {/* Stock summary */}
            <div className="border rounded-lg p-4 bg-white">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-bold text-gray-800">{selectedProduct.name}</h2>
                  {(() => {
                    const stock = stockMap[selectedProduct.id]
                    const qty = stock?.qtyGrams ?? 0
                    const isLow = qty < selectedProduct.bulkLowStockGrams
                    return (
                      <div className="mt-2 flex gap-6">
                        <div>
                          <div className="text-xs text-gray-500">Current stock</div>
                          <div className={`text-2xl font-bold ${isLow ? 'text-red-600' : 'text-gray-900'}`}>
                            {formatQuantity(qty, selectedProduct.unitType)}
                          </div>
                          {isLow && (
                            <div className="text-xs text-red-600">
                              Below threshold ({formatQuantity(selectedProduct.bulkLowStockGrams, selectedProduct.unitType)})
                            </div>
                          )}
                        </div>
                        {/* Avg cost — Admin only */}
                        {isAdmin && (
                          <div>
                            <div className="text-xs text-gray-500">Avg cost</div>
                            <div className="text-xl font-semibold text-gray-700">
                              {stock?.avgCostPerKg != null
                                ? `${paiseToCurrency(Math.round(stock.avgCostPerKg * 100))}/${bulkUnit(selectedProduct.unitType)}`
                                : '—'}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setShowAdjust(false); setShowArrival(true) }}
                    className="bg-green-700 text-white px-3 py-1.5 rounded text-sm cursor-pointer hover:bg-green-800 transition-colors">
                    Record Arrival
                  </button>
                  {isAdmin && (
                    <button onClick={() => { setShowArrival(false); setShowAdjust(true) }}
                      className="bg-orange-600 text-white px-3 py-1.5 rounded text-sm cursor-pointer hover:bg-orange-700 transition-colors">
                      Adjust Stock
                    </button>
                  )}
                </div>
              </div>
            </div>

            {showArrival && <ArrivalForm />}
            {showAdjust && isAdmin && <AdjustForm />}

            {/* Arrival history */}
            <div className="border rounded-lg p-4 bg-white">
              <h3 className="font-semibold text-gray-700 text-sm mb-3">Arrival History</h3>
              {arrivals.length === 0 ? (
                <p className="text-sm text-gray-400">No arrivals recorded yet.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="pb-2 pr-3">Date</th>
                      <th className="pb-2 pr-3">Qty</th>
                      {/* Cost column Admin only */}
                      {isAdmin && <th className="pb-2 pr-3">Cost/kg</th>}
                      <th className="pb-2">Notes</th>
                      {isAdmin && <th className="pb-2 w-8"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {arrivals.map((a) => (
                      <tr key={a.id} className="border-b last:border-0">
                        <td className="py-1.5 pr-3">{a.date}</td>
                        <td className="py-1.5 pr-3">{formatQuantity(a.qtyGrams, selectedProduct.unitType)}</td>
                        {isAdmin && (
                          <td className="py-1.5 pr-3 font-mono">
                            {a.costPerKgPaise != null ? paiseToCurrency(a.costPerKgPaise) : '—'}
                          </td>
                        )}
                        <td className="py-1.5 text-gray-500">{a.notes ?? '—'}</td>
                        {isAdmin && (
                          <td className="py-1.5">
                            <button
                              onClick={() => { setDeleteError(''); setDeleteConfirm(a.id) }}
                              className="text-red-400 hover:text-red-600 cursor-pointer transition-colors"
                              title="Delete arrival"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                <path d="M10 11v6M14 11v6" />
                                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                              </svg>
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Delete confirmation dialog */}
            {deleteConfirm !== null && (
              <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
                  <h3 className="font-semibold text-gray-800 mb-2">Delete this arrival?</h3>
                  <p className="text-sm text-gray-600 mb-4">This will reverse the stock. This cannot be undone.</p>
                  {deleteError && <p className="text-xs text-red-600 mb-3">{deleteError}</p>}
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => { setDeleteConfirm(null); setDeleteError('') }}
                      className="px-4 py-1.5 border rounded text-sm cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDeleteArrival(deleteConfirm)}
                      className="bg-red-600 text-white px-4 py-1.5 rounded text-sm cursor-pointer hover:bg-red-700 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Adjustment history — Admin only */}
            {isAdmin && (
              <div className="border rounded-lg p-4 bg-white">
                <h3 className="font-semibold text-gray-700 text-sm mb-3">Adjustment History</h3>
                {adjustments.length === 0 ? (
                  <p className="text-sm text-gray-400">No adjustments.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="pb-2 pr-3">Date</th>
                        <th className="pb-2 pr-3">Change</th>
                        <th className="pb-2 pr-3">Reason</th>
                        <th className="pb-2">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adjustments.map((a) => (
                        <tr key={a.id} className="border-b last:border-0">
                          <td className="py-1.5 pr-3">{a.date}</td>
                          <td className={`py-1.5 pr-3 font-mono font-semibold ${a.qtyChangeGrams >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                            {a.qtyChangeGrams >= 0 ? '+' : ''}{formatQuantity(Math.abs(a.qtyChangeGrams), selectedProduct.unitType)}
                          </td>
                          <td className="py-1.5 pr-3 text-gray-600">{a.reason}</td>
                          <td className="py-1.5 text-gray-500">{a.notes ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
