import { useState, useEffect, type ReactElement, type ChangeEvent } from 'react'
import { useAppStore } from '../../store/appStore'
import { formatQuantity, bulkUnit } from '@shared/money'
import type { Product, BulkStockRow, PackingRunRow } from '@shared/types'

type Tab = 'pack' | 'history'

export default function PackingScreen(): ReactElement {
  const { user } = useAppStore()
  const [tab, setTab] = useState<Tab>('pack')
  const [products, setProducts] = useState<Product[]>([])
  const [stockMap, setStockMap] = useState<Record<number, BulkStockRow>>({})
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null)
  const [counts, setCounts] = useState<Record<number, string>>({}) // variantId → input string
  const [notes, setNotes] = useState('')
  const [validation, setValidation] = useState<{ totalGrams: number; bulkAvailableGrams: number } | null>(null)
  const [validationError, setValidationError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [runs, setRuns] = useState<PackingRunRow[]>([])

  async function loadBase(): Promise<void> {
    const [pRes, sRes] = await Promise.all([
      window.api.products.listProducts(),
      window.api.bulkInventory.listAllBulkStock()
    ])
    if (!pRes.ok || !sRes.ok) return
    // Only products with bulk stock > 0
    const map: Record<number, BulkStockRow> = {}
    for (const s of sRes.data) map[s.productId] = s
    setStockMap(map)
    setProducts(pRes.data.filter((p) => (map[p.id]?.qtyGrams ?? 0) > 0))
  }

  async function loadHistory(): Promise<void> {
    const res = await window.api.packing.listRuns(
      selectedProductId ? { productId: selectedProductId } : undefined
    )
    if (res.ok) setRuns(res.data)
  }

  useEffect(() => { loadBase() }, [])
  useEffect(() => {
    if (tab === 'history') loadHistory()
  }, [tab, selectedProductId])

  const selectedProduct = products.find((p) => p.id === selectedProductId)
  const enabledVariants = selectedProduct?.variants.filter((v) => v.enabled) ?? []

  // Re-validate whenever counts or product changes
  useEffect(() => {
    if (!selectedProductId || !enabledVariants.length) {
      setValidation(null); setValidationError(''); return
    }
    const lines = enabledVariants
      .map((v) => ({ variantId: v.id, packetsCount: parseInt(counts[v.id] ?? '0') || 0 }))
      .filter((l) => l.packetsCount > 0)
    if (!lines.length) { setValidation(null); setValidationError(''); return }

    window.api.packing.validate({ productId: selectedProductId, lines }).then((r) => {
      if (r.ok) { setValidation(r); setValidationError('') }
      else { setValidation(null); setValidationError(r.error) }
    })
  }, [counts, selectedProductId])

  function handleCountChange(variantId: number, val: string): void {
    setCounts((prev) => ({ ...prev, [variantId]: val }))
    setSuccessMsg(''); setSubmitError('')
  }

  function selectProduct(id: number): void {
    setSelectedProductId(id)
    setCounts({})
    setValidation(null); setValidationError(''); setSubmitError(''); setSuccessMsg('')
  }

  async function handleCommit(): Promise<void> {
    if (!selectedProductId) return
    const lines = enabledVariants
      .map((v) => ({ variantId: v.id, packetsCount: parseInt(counts[v.id] ?? '0') || 0 }))
      .filter((l) => l.packetsCount > 0)
    if (!lines.length) { setSubmitError('Enter at least one packet count'); return }

    const res = await window.api.packing.commit({
      productId: selectedProductId,
      lines,
      notes: notes.trim() || undefined,
      userId: user!.id
    })
    if (!res.ok) { setSubmitError(res.error); return }

    // Success: show summary and reset
    const summary = lines
      .map((l) => {
        const v = enabledVariants.find((v) => v.id === l.variantId)
        return `${l.packetsCount}×${v?.label ?? l.variantId}`
      })
      .join(', ')
    setSuccessMsg(`Packing run #${res.data} committed: ${summary}`)
    setCounts({}); setNotes(''); setValidation(null)
    loadBase()
    if (tab === 'history') loadHistory()
  }

  const canCommit = validation !== null && !validationError && !submitError

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">Packing</h1>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['pack', 'history'] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium cursor-pointer transition-colors ${
                tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {t === 'pack' ? 'Pack' : 'History'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'pack' && (
        <div className="flex gap-4">
          {/* Product selector */}
          <div className="w-56 flex-shrink-0">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Products with stock
            </div>
            {products.length === 0 && (
              <p className="text-sm text-gray-400">No bulk stock available.</p>
            )}
            {products.map((p) => {
              const stock = stockMap[p.id]
              return (
                <div key={p.id} onClick={() => selectProduct(p.id)}
                  className={`px-3 py-2.5 rounded mb-1 cursor-pointer transition-colors ${
                    selectedProductId === p.id ? 'bg-indigo-600 text-white' : 'hover:bg-gray-100 text-gray-800'
                  }`}>
                  <div className="font-medium text-sm">{p.name}</div>
                  <div className={`text-xs mt-0.5 ${selectedProductId === p.id ? 'text-indigo-200' : 'text-gray-500'}`}>
                    {formatQuantity(stock?.qtyGrams ?? 0, p.unitType)} available
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pack form */}
          {selectedProduct && (
            <div className="flex-1 flex flex-col gap-4">
              {/* Live total */}
              <div className={`border rounded-lg p-4 ${validationError ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-gray-500">Bulk to use</div>
                    <div className={`text-2xl font-bold ${validationError ? 'text-red-600' : 'text-gray-900'}`}>
                      {validation ? formatQuantity(validation.totalGrams, selectedProduct.unitType) : `0 ${bulkUnit(selectedProduct.unitType)}`}
                    </div>
                    {validationError && <p className="text-xs text-red-600 mt-1">{validationError}</p>}
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">Available after</div>
                    {(() => {
                      const total = stockMap[selectedProduct.id]?.qtyGrams ?? 0
                      const used = validation?.totalGrams ?? 0
                      const remaining = total - used
                      const negative = remaining < 0
                      return (
                        <div className={`text-xl font-semibold ${negative ? 'text-red-600' : 'text-gray-700'}`}>
                          {formatQuantity(remaining, selectedProduct.unitType)}
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </div>

              {/* Variant rows */}
              <div className="border rounded-lg bg-white overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b bg-gray-50">
                      <th className="px-4 py-2">Variant</th>
                      <th className="px-4 py-2">Weight</th>
                      <th className="px-4 py-2 w-36">Packets to pack</th>
                      <th className="px-4 py-2 text-right">{selectedProduct.unitType === 'volume' ? 'ml used' : 'Grams used'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enabledVariants.map((v) => {
                      const count = parseInt(counts[v.id] ?? '0') || 0
                      return (
                        <tr key={v.id} className="border-b last:border-0">
                          <td className="px-4 py-2 font-medium text-sm">{v.label}</td>
                          <td className="px-4 py-2 text-sm text-gray-500">{v.weightGrams}{selectedProduct.unitType === 'volume' ? 'ml' : 'g'}</td>
                          <td className="px-4 py-2">
                            <input
                              type="number" min="0" value={counts[v.id] ?? ''}
                              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                handleCountChange(v.id, e.target.value)}
                              className="w-28 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            />
                          </td>
                          <td className="px-4 py-2 text-right text-sm font-mono text-gray-600">
                            {count > 0 ? formatQuantity(count * v.weightGrams, selectedProduct.unitType) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Notes + submit */}
              <div className="flex gap-3 items-end">
                <div className="flex-1 flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-600">Notes (optional)</label>
                  <input value={notes} onChange={(e) => setNotes(e.target.value)}
                    className="border border-gray-300 rounded px-3 py-1.5 text-sm" />
                </div>
                <button
                  onClick={handleCommit}
                  disabled={!canCommit}
                  className="bg-indigo-600 disabled:bg-indigo-300 text-white px-6 py-1.5 rounded text-sm font-semibold cursor-pointer hover:bg-indigo-700 disabled:cursor-not-allowed transition-colors">
                  Commit Packing Run
                </button>
              </div>

              {submitError && <p className="text-sm text-red-600">{submitError}</p>}
              {successMsg && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                  {successMsg}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="flex flex-col gap-3">
          {runs.length === 0 && <p className="text-sm text-gray-400">No packing runs yet.</p>}
          {runs.map((run) => {
            const prod = products.find((p) => p.id === run.productId)
            return (
              <div key={run.id} className="border rounded-lg p-4 bg-white">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-semibold text-gray-800">
                      Run #{run.id} — {prod?.name ?? `Product ${run.productId}`}
                    </span>
                    <span className="ml-3 text-sm text-gray-500">{run.date}</span>
                  </div>
                  <span className="text-sm font-mono text-gray-700">
                    {formatQuantity(run.bulkUsedGrams, prod?.unitType ?? 'weight')} packed
                  </span>
                </div>
                {run.notes && <p className="text-xs text-gray-500 mt-1">{run.notes}</p>}
                <div className="flex flex-wrap gap-2 mt-2">
                  {run.lines.map((l) => {
                    const v = prod?.variants.find((vv) => vv.id === l.variantId)
                    return (
                      <span key={l.id}
                        className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                        {l.packetsCount}×{v?.label ?? `v${l.variantId}`}
                      </span>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
