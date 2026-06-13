import { useState, useEffect, useRef, type ReactElement, type FormEvent } from 'react'
import JsBarcode from 'jsbarcode'
import { useAppStore } from '../../store/appStore'
import { paiseToCurrency } from '@shared/money'
import type { Product, PriceMenuEntry, LabelPrintLogRow } from '@shared/types'

type Tab = 'print' | 'log'

function BarcodePreview({ barcode }: { barcode: string }): ReactElement {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (ref.current && barcode) {
      try { JsBarcode(ref.current, barcode, { format: 'CODE128', height: 40, fontSize: 10, margin: 4 }) }
      catch { /* invalid barcode */ }
    }
  }, [barcode])
  return <svg ref={ref} />
}

export default function LabelPrintingScreen(): ReactElement {
  const { user } = useAppStore()

  const [products, setProducts] = useState<Product[]>([])
  const [allEntries, setAllEntries] = useState<PriceMenuEntry[]>([])
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null)
  const [qty, setQty] = useState('1')
  const [printType, setPrintType] = useState<'after_pack' | 'reprice' | 'reprint'>('reprint')
  const [tab, setTab] = useState<Tab>('print')
  const [log, setLog] = useState<LabelPrintLogRow[]>([])
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null)
  const [loading, setLoading] = useState(false)

  async function loadBase(): Promise<void> {
    const [pRes, eRes] = await Promise.all([
      window.api.products.listProducts(),
      window.api.pricing.listAllEntries()
    ])
    if (pRes.ok) setProducts(pRes.data)
    if (eRes.ok) setAllEntries(eRes.data)
  }

  async function loadLog(variantId?: number): Promise<void> {
    const res = await window.api.labels.listPrintLog(variantId ? { variantId } : undefined)
    if (res.ok) setLog(res.data)
  }

  useEffect(() => { loadBase() }, [])
  useEffect(() => { if (tab === 'log') loadLog(selectedVariantId ?? undefined) }, [tab, selectedVariantId])

  const today = new Date().toISOString().slice(0, 10)
  function currentPriceFor(variantId: number): PriceMenuEntry | undefined {
    return allEntries
      .filter((e) => e.variantId === variantId && e.effectiveDate <= today)
      .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate) || b.id - a.id)[0]
  }

  const allVariants = products.flatMap((p) =>
    p.variants.filter((v) => v.enabled).map((v) => ({ ...v, productName: p.name }))
  )
  const selectedVariant = allVariants.find((v) => v.id === selectedVariantId)
  const currentPrice = selectedVariantId ? currentPriceFor(selectedVariantId) : undefined

  async function handlePrint(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (!selectedVariantId) return
    const qtyNum = parseInt(qty)
    if (qtyNum <= 0 || isNaN(qtyNum)) { setStatus({ ok: false, msg: 'Quantity must be a positive integer' }); return }

    setLoading(true); setStatus(null)
    const res = await window.api.labels.printLabels({
      variantId: selectedVariantId,
      qty: qtyNum,
      type: printType,
      userId: user!.id
    })
    setLoading(false)
    if (res.ok) {
      setStatus({ ok: true, msg: `Printed ${qtyNum} label(s) successfully.` })
      if (tab === 'log') loadLog(selectedVariantId)
    } else {
      setStatus({ ok: false, msg: res.error })
    }
  }

  return (
    <div className="page">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">Label Printing</h1>
        <div className="tab-bar">
          {(['print', 'log'] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium cursor-pointer transition-colors ${
                tab === t ? 'active' : ''
              }`}>
              {t === 'print' ? 'Print Labels' : 'Print Log'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'print' && (
        <div className="flex gap-6">
          {/* Product sidebar */}
          <div className="w-56 flex-shrink-0">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Products</div>
            {products.map((p) => {
              const enabled = p.variants.filter((v) => v.enabled)
              if (enabled.length === 0) return null
              const isSelected = enabled.some((v) => v.id === selectedVariantId)
              return (
                <div key={p.id}
                  onClick={() => { const first = enabled[0]; if (first) { setSelectedVariantId(first.id); setStatus(null) } }}
                  className={`list-item${isSelected ? " active" : ""}`} style={{marginBottom:4}}>
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className={`text-xs ${isSelected ? 'text-purple-200' : 'text-gray-500'}`}>
                    {enabled.length} variant{enabled.length !== 1 ? 's' : ''}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Print form + preview */}
          <div className="flex-1 flex flex-col gap-4">
            {!selectedVariant && (
              <p className="text-sm text-gray-400">Select a product to print labels.</p>
            )}
            {selectedVariant && (() => {
              const product = products.find((p) => p.variants.some((v) => v.id === selectedVariantId))
              const variants = product?.variants.filter((v) => v.enabled) ?? []
              return (
                <>
                  {/* Variant selector */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-gray-600">Variant</label>
                    <select
                      value={selectedVariantId ?? ''}
                      onChange={(e) => { setSelectedVariantId(Number(e.target.value)); setStatus(null) }}
                      className="border border-gray-300 rounded px-2 py-1 text-sm">
                      {variants.map((v) => (
                        <option key={v.id} value={v.id}>{v.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Label preview */}
                  <div className="border rounded-lg p-4 bg-white flex items-center gap-6">
                    <div className="flex flex-col items-center gap-1">
                      <div className="text-xs font-bold text-gray-700">{selectedVariant.productName}</div>
                      <div className="text-xs text-gray-500">{selectedVariant.label}</div>
                      <BarcodePreview barcode={selectedVariant.barcode} />
                      <div className="text-sm font-bold text-gray-900">
                        {currentPrice ? paiseToCurrency(currentPrice.retailPricePaise) : '—'}
                      </div>
                    </div>
                    <div className="flex-1 text-sm text-gray-500">
                      <div><span className="font-medium">Barcode:</span> <span className="font-mono">{selectedVariant.barcode}</span></div>
                      <div><span className="font-medium">Current price:</span> {currentPrice ? paiseToCurrency(currentPrice.retailPricePaise) : 'Not set'}</div>
                      {!currentPrice && (
                        <p className="mt-2 text-xs text-red-600">No price set — set a Price Menu entry first.</p>
                      )}
                    </div>
                  </div>

                  {/* Print controls */}
                  <form onSubmit={handlePrint} className="border rounded-lg p-4 bg-white flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-600">Quantity</label>
                        <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1.5 text-sm" required />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-600">Print type</label>
                        <select value={printType} onChange={(e) => setPrintType(e.target.value as typeof printType)}
                          className="border border-gray-300 rounded px-2 py-1.5 text-sm">
                          <option value="after_pack">After Pack</option>
                          <option value="reprice">Reprice (no stock change)</option>
                          <option value="reprint">Reprint</option>
                        </select>
                      </div>
                    </div>

                    {printType === 'reprice' && (
                      <p className="text-xs text-amber-700 bg-amber-50 rounded px-3 py-2 border border-amber-200">
                        Reprice prints labels at the current price. No stock or cost changes.
                      </p>
                    )}

                    {status && (
                      <p className={`text-sm ${status.ok ? 'text-green-700' : 'text-red-600'}`}>{status.msg}</p>
                    )}

                    <button type="submit" disabled={loading || !currentPrice}
                      className="bg-purple-600 disabled:bg-purple-300 text-white px-6 py-2 rounded font-semibold text-sm cursor-pointer hover:bg-purple-700 disabled:cursor-not-allowed transition-colors">
                      {loading ? 'Printing…' : 'Print Labels'}
                    </button>
                  </form>
                </>
              )
            })()}
          </div>
        </div>
      )}

      {tab === 'log' && (
        <div className="card" style={{padding:"1.25rem"}}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800 text-sm">Recent Label Prints</h2>
            <select value={selectedVariantId ?? ''} onChange={(e) => {
              const id = e.target.value ? Number(e.target.value) : null
              setSelectedVariantId(id)
            }} className="border border-gray-300 rounded px-2 py-1 text-sm">
              <option value="">All variants</option>
              {allVariants.map((v) => (
                <option key={v.id} value={v.id}>{v.productName} — {v.label}</option>
              ))}
            </select>
          </div>
          {log.length === 0
            ? <p className="text-sm text-gray-400">No label prints yet.</p>
            : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-2 pr-3">Date</th>
                    <th className="pb-2 pr-3">Variant</th>
                    <th className="pb-2 pr-3">Qty</th>
                    <th className="pb-2 pr-3">Price printed</th>
                    <th className="pb-2">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {log.map((l) => {
                    const v = allVariants.find((v) => v.id === l.variantId)
                    return (
                      <tr key={l.id} className="border-b last:border-0">
                        <td className="py-1.5 pr-3">{l.date}</td>
                        <td className="py-1.5 pr-3">{v ? `${v.productName} — ${v.label}` : `v${l.variantId}`}</td>
                        <td className="py-1.5 pr-3">{l.qty}</td>
                        <td className="py-1.5 pr-3 font-mono">{paiseToCurrency(l.pricePrintedPaise)}</td>
                        <td className="py-1.5">
                          <span className={`px-1.5 py-0.5 rounded-full font-medium ${
                            l.type === 'reprice' ? 'bg-amber-100 text-amber-700' :
                            l.type === 'after_pack' ? 'bg-green-100 text-green-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>{l.type}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
        </div>
      )}
    </div>
  )
}
