import { useState, useEffect, type ReactElement, type FormEvent } from 'react'
import { useAppStore } from '../../store/appStore'
import { paiseToCurrency } from '@shared/money'
import type { Product, RetailStockRow, RetailMovementRow } from '@shared/types'

type Tab = 'stock' | 'movements'

export default function RetailPacketInventoryScreen(): ReactElement {
  const { user } = useAppStore()
  const isAdmin = user?.role === 'admin'

  const [products, setProducts] = useState<Product[]>([])
  const [stockMap, setStockMap] = useState<Record<number, RetailStockRow>>({})
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null)
  const [movements, setMovements] = useState<RetailMovementRow[]>([])
  const [tab, setTab] = useState<Tab>('stock')
  const [error, setError] = useState('')

  // Modal state
  const [modalProductId, setModalProductId] = useState<number | null>(null)
  const [adjustVariantId, setAdjustVariantId] = useState<number | null>(null)

  async function loadData(): Promise<void> {
    const [pRes, sRes] = await Promise.all([
      window.api.products.listProducts(),
      window.api.retailInventory.getStock()
    ])
    if (!pRes.ok || !sRes.ok) { setError('Failed to load data'); return }
    setProducts(pRes.data)
    const map: Record<number, RetailStockRow> = {}
    for (const s of sRes.data) map[s.variantId] = s
    setStockMap(map)
  }

  async function loadMovements(variantId: number): Promise<void> {
    const res = await window.api.retailInventory.listMovements({ variantId })
    if (res.ok) setMovements(res.data)
  }

  useEffect(() => { loadData() }, [])

  function selectVariant(id: number): void {
    setSelectedVariantId(id)
    if (tab === 'movements') loadMovements(id)
  }

  const allVariants = products.flatMap((p) =>
    p.variants.filter((v) => v.enabled).map((v) => ({ ...v, productName: p.name }))
  )

  // ── Adjust form ─────────────────────────────────────────────────────────────

  function AdjustForm({ variantId, onDone }: { variantId: number; onDone: () => void }): ReactElement {
    const [qty, setQty] = useState('')
    const [reason, setReason] = useState<'manual' | 'damage' | 'wastage'>('manual')
    const [notes, setNotes] = useState('')
    const [err, setErr] = useState('')

    async function submit(e: FormEvent): Promise<void> {
      e.preventDefault()
      const qtyChangePcs = parseInt(qty)
      if (isNaN(qtyChangePcs) || qtyChangePcs === 0) { setErr('Enter a non-zero integer'); return }
      const res = await window.api.retailInventory.recordAdjustment({
        variantId, qtyChangePcs, reason, notes: notes.trim() || undefined, userId: user!.id
      })
      if (!res.ok) { setErr(res.error); return }
      onDone()
      loadData()
    }

    return (
      <form onSubmit={submit} className="bg-orange-50 border border-orange-200 rounded p-3 flex flex-col gap-2 mt-2">
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Change (pcs)</label>
            <input type="number" value={qty} onChange={(e) => setQty(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm" required autoFocus
              placeholder="e.g. -5 or 10" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Reason</label>
            <select value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}
              className="border border-gray-300 rounded px-2 py-1 text-sm">
              <option value="manual">Manual correction</option>
              <option value="damage">Damage</option>
              <option value="wastage">Wastage</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm" />
          </div>
        </div>
        {err && <p className="text-xs text-red-600">{err}</p>}
        <div className="flex gap-2">
          <button type="submit"
            className="bg-orange-600 text-white px-3 py-1.5 rounded text-sm cursor-pointer hover:bg-orange-700 transition-colors">
            Save
          </button>
          <button type="button" onClick={() => onDone()}
            className="px-3 py-1.5 border rounded text-sm cursor-pointer">Cancel</button>
        </div>
      </form>
    )
  }

  // ── Variant modal ────────────────────────────────────────────────────────────

  function VariantModal(): ReactElement | null {
    const product = products.find((p) => p.id === modalProductId)
    if (!product) return null
    const variants = product.variants.filter((v) => v.enabled)

    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
        onClick={() => { setModalProductId(null); setAdjustVariantId(null) }}>
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800">{product.name} — Variants</h3>
            <button onClick={() => { setModalProductId(null); setAdjustVariantId(null) }}
              className="text-gray-400 hover:text-gray-600 cursor-pointer text-xl leading-none">✕</button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b">
                <th className="pb-2 pr-4">Variant</th>
                <th className="pb-2 pr-4">Stock (pcs)</th>
                {isAdmin && <th className="pb-2 pr-4">Avg cost</th>}
                <th className="pb-2 pr-4">Status</th>
                {isAdmin && <th className="pb-2">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => {
                const stock = stockMap[v.id]
                const qty = stock?.qtyPcs ?? 0
                const isLow = qty < v.retailLowStockPcs
                return (
                  <tr key={v.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{v.label}</td>
                    <td className={`py-2 pr-4 font-semibold ${isLow ? 'text-red-600' : 'text-gray-900'}`}>{qty}</td>
                    {isAdmin && (
                      <td className="py-2 pr-4 text-gray-500 font-mono text-xs">
                        {stock?.avgCostPerPc != null ? paiseToCurrency(Math.round(stock.avgCostPerPc * 100)) : '—'}
                      </td>
                    )}
                    <td className="py-2 pr-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        isLow ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {isLow ? `Low (< ${v.retailLowStockPcs})` : 'OK'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="py-2">
                        <button
                          onClick={() => setAdjustVariantId(adjustVariantId === v.id ? null : v.id)}
                          className="text-orange-600 hover:underline text-xs cursor-pointer">
                          Adjust
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
          {isAdmin && adjustVariantId != null && variants.some((v) => v.id === adjustVariantId) && (
            <AdjustForm variantId={adjustVariantId} onDone={() => setAdjustVariantId(null)} />
          )}
        </div>
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const selectedVariant = allVariants.find((v) => v.id === selectedVariantId)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">Retail Packet Inventory</h1>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['stock', 'movements'] as Tab[]).map((t) => (
            <button key={t} onClick={() => { setTab(t); if (t === 'movements' && selectedVariantId) loadMovements(selectedVariantId) }}
              className={`px-4 py-1.5 rounded-md text-sm font-medium cursor-pointer transition-colors ${
                tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {t === 'stock' ? 'Stock' : 'Movements'}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      {tab === 'stock' && (
        <table className="w-full text-sm border rounded-lg overflow-hidden bg-white">
          <thead>
            <tr className="text-left text-xs text-gray-500 uppercase tracking-wide bg-gray-50 border-b">
              <th className="px-4 py-2">Product</th>
              <th className="px-4 py-2">Total stock (pcs)</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const enabled = p.variants.filter((v) => v.enabled)
              if (enabled.length === 0) return null
              const totalQty = enabled.reduce((sum, v) => sum + (stockMap[v.id]?.qtyPcs ?? 0), 0)
              const anyLow = enabled.some((v) => (stockMap[v.id]?.qtyPcs ?? 0) < v.retailLowStockPcs)
              return (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="px-4 py-2.5 font-medium text-gray-800">{p.name}</td>
                  <td className={`px-4 py-2.5 font-semibold ${anyLow ? 'text-red-600' : 'text-gray-900'}`}>
                    {totalQty}
                    {anyLow && <span className="ml-2 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">Low</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      anyLow ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {anyLow ? 'Some low' : 'OK'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => { setModalProductId(p.id); setAdjustVariantId(null) }}
                      className="text-sm text-indigo-600 hover:underline cursor-pointer">
                      View Variants
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {tab === 'movements' && (
        <div className="flex gap-4">
          {/* Product sidebar */}
          <div className="w-56 flex-shrink-0">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Products</div>
            {products.map((p) => {
              const enabled = p.variants.filter((v) => v.enabled)
              if (enabled.length === 0) return null
              const isSelected = enabled.some((v) => v.id === selectedVariantId)
              return (
                <div key={p.id}
                  onClick={() => { const first = enabled[0]; if (first) selectVariant(first.id) }}
                  className={`px-3 py-2 rounded mb-1 cursor-pointer text-sm transition-colors ${
                    isSelected ? 'bg-indigo-600 text-white' : 'hover:bg-gray-100 text-gray-800'
                  }`}>
                  <div className="font-medium">{p.name}</div>
                  <div className={`text-xs ${isSelected ? 'text-indigo-200' : 'text-gray-500'}`}>
                    {enabled.length} variant{enabled.length !== 1 ? 's' : ''}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex-1 border rounded-lg bg-white p-4">
            {!selectedVariant && <p className="text-sm text-gray-400">Select a product to see movements.</p>}
            {selectedVariant && (() => {
              const product = products.find((p) => p.variants.some((v) => v.id === selectedVariantId))
              const variants = product?.variants.filter((v) => v.enabled) ?? []
              return (
                <>
                  <div className="flex items-center gap-3 mb-3">
                    <h2 className="font-semibold text-gray-800">{selectedVariant.productName}</h2>
                    <select
                      value={selectedVariantId ?? ''}
                      onChange={(e) => selectVariant(Number(e.target.value))}
                      className="border border-gray-300 rounded px-2 py-1 text-sm">
                      {variants.map((v) => (
                        <option key={v.id} value={v.id}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                  {movements.length === 0
                    ? <p className="text-sm text-gray-400">No movements recorded yet.</p>
                    : (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-gray-500 border-b">
                            <th className="pb-2 pr-3">Date</th>
                            <th className="pb-2 pr-3">Type</th>
                            <th className="pb-2 pr-3">Change (pcs)</th>
                            <th className="pb-2">Reference</th>
                          </tr>
                        </thead>
                        <tbody>
                          {movements.map((m, i) => (
                            <tr key={i} className="border-b last:border-0">
                              <td className="py-1.5 pr-3">{m.date}</td>
                              <td className="py-1.5 pr-3">
                                <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${
                                  m.type === 'packing' ? 'bg-green-100 text-green-700' :
                                  m.type === 'sale' ? 'bg-red-100 text-red-700' :
                                  'bg-orange-100 text-orange-700'
                                }`}>{m.type}</span>
                              </td>
                              <td className={`py-1.5 pr-3 font-mono font-semibold ${
                                m.qtyChange >= 0 ? 'text-green-700' : 'text-red-600'
                              }`}>
                                {m.qtyChange >= 0 ? '+' : ''}{m.qtyChange}
                              </td>
                              <td className="py-1.5 text-gray-500">{m.reference}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                </>
              )
            })()}
          </div>
        </div>
      )}

      {modalProductId != null && <VariantModal />}
    </div>
  )
}
