// @ts-nocheck
import { useState, useEffect, useRef, type ReactElement, type FormEvent } from 'react'
import JsBarcode from 'jsbarcode'
import { useAppStore } from '../../store/appStore'
import { paiseToCurrency } from '@shared/money'
import type { Product, PriceMenuEntry, LabelPrintLogRow } from '@shared/types'

type Tab = 'print' | 'log'

// Shared inline style constants
const labelStyle: React.CSSProperties = { fontSize: '0.75rem', fontWeight: 500, color: 'var(--ink-3)', marginBottom: 2 }

function BarcodePreview({ barcode }: { barcode: string }): ReactElement {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (ref.current && barcode) {
      try { JsBarcode(ref.current, barcode, { format: 'CODE128', height: 30, width: 1.2, fontSize: 9, margin: 0 }) }
      catch { /* invalid barcode */ }
    }
  }, [barcode])
  return <svg ref={ref} style={{ maxWidth: '100%', height: 'auto', display: 'block', margin: '0 auto' }} />
}

export default function LabelPrintingScreen(): ReactElement {
  const { user } = useAppStore()

  const [products, setProducts] = useState<Product[]>([])
  const [allEntries, setAllEntries] = useState<PriceMenuEntry[]>([])
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [qty, setQty] = useState('1')
  const [printType, setPrintType] = useState<'after_pack' | 'reprice' | 'reprint'>('reprint')
  const [printDate, setPrintDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [tab, setTab] = useState<Tab>('print')
  const [log, setLog] = useState<LabelPrintLogRow[]>([])
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  async function loadBase(): Promise<void> {
    const [pRes, eRes] = await Promise.all([
      window.api.products.listProducts(),
      window.api.pricing.listAllEntries()
    ])
    if (pRes.ok) setProducts(pRes.data)
    if (eRes.ok) setAllEntries(eRes.data)
  }

  async function loadLog(variantId?: string): Promise<void> {
    const res = await window.api.labels.listPrintLog(variantId ? { variantId } : undefined)
    if (res.ok) setLog(res.data)
  }

  useEffect(() => { loadBase() }, [])
  useEffect(() => { if (tab === 'log') loadLog(selectedVariantId ?? undefined) }, [tab, selectedVariantId])

  const today = new Date().toISOString().slice(0, 10)
  function currentPriceFor(variantId: string): PriceMenuEntry | undefined {
    return allEntries
      .filter((e) => e.variantId === variantId && e.effectiveDate <= today)
      .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate) || String(b.id).localeCompare(String(a.id)))[0]
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
      userId: user!.id,
      dateStr: printDate
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
    <div style={{
      display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 96px)',
      background: 'var(--bg-base)', padding: '1.25rem', gap: '1rem', overflow: 'hidden',
    }}>
      {/* ── Page header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0, maxWidth: 1100, width: '100%', margin: '0 auto',
      }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--ink-1)', letterSpacing: '-0.02em', margin: 0 }}>Label Printing</h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--ink-3)', marginTop: '0.125rem' }}>Print physical barcode labels</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <input 
            type="text" 
            placeholder="Search products..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
            style={{ width: '240px', padding: '0.375rem 0.5rem', fontSize: '0.8125rem', background: 'var(--bg-fill)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', color: 'var(--ink-1)' }}
          />
          <div className="tab-bar">
            {(['print', 'log'] as Tab[]).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`tab-item${tab === t ? ' active' : ''}`}>
                {t === 'print' ? 'Print Labels' : 'Print Log'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {tab === 'print' && (
        <div style={{
          display: 'grid', gridTemplateColumns: selectedVariant ? 'clamp(260px, 22%, 320px) 1fr' : '1fr',
          gap: '0.75rem', flex: 1, minHeight: 0, overflow: 'hidden',
          maxWidth: 1100, width: '100%', margin: '0 auto',
        }}>
          {/* Left: Product sidebar */}
          <div className="card" style={{
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            borderRadius: 'var(--r-lg)', minHeight: 0,
            ...(selectedVariant ? {} : { maxWidth: 380, margin: '0 auto', width: '100%' }),
          }}>
            <div style={{
              padding: '0.75rem 0.875rem', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span className="section-label" style={{ margin: 0, padding: 0 }}>Products</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '0.25rem 0' }}>
              {products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.categoryName?.toLowerCase().includes(searchQuery.toLowerCase())).map((p) => {
                const enabled = p.variants.filter((v) => v.enabled)
                if (enabled.length === 0) return null
                const isSelected = enabled.some((v) => v.id === selectedVariantId)
                return (
                  <div key={p.id}
                    onClick={() => { const first = enabled[0]; if (first) { setSelectedVariantId(first.id); setStatus(null) } }}
                    style={{
                      padding: '0.5rem 0.875rem', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', gap: '0.125rem',
                      background: isSelected ? 'var(--accent-soft)' : 'transparent',
                      borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
                      transition: 'background 80ms ease, border-color 80ms ease',
                      marginBottom: 4,
                    }}
                    onMouseEnter={(e) => { if (!isSelected) (e.currentTarget.style.background = 'var(--bg-fill)') }}
                    onMouseLeave={(e) => { if (!isSelected) (e.currentTarget.style.background = 'transparent') }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: isSelected ? 600 : 500, color: isSelected ? 'var(--accent)' : 'var(--ink-1)' }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: isSelected ? 'oklch(0.65 0.12 260)' : 'var(--ink-4)' }}>
                      {enabled.length} variant{enabled.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right: Print form + preview */}
          {selectedVariant && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', paddingRight: '0.25rem' }}>
              {(() => {
                const product = products.find((p) => p.variants.some((v) => v.id === selectedVariantId))
                const variants = product?.variants.filter((v) => v.enabled) ?? []
                return (
                  <>
                    {/* Variant selector */}
                    <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
                      <label style={{ ...labelStyle, marginBottom: 0, flexShrink: 0 }}>Select Variant</label>
                      <select
                        value={selectedVariantId ?? ''}
                        onChange={(e) => { setSelectedVariantId(e.target.value); setStatus(null) }}
                        style={{ flex: 1 }}>
                        {variants.map((v) => (
                          <option key={v.id} value={v.id}>{v.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Label preview */}
                    <div className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '2rem', flexShrink: 0 }}>
                      {/* Actual sticker format preview: 83x35mm dual column */}
                      <div style={{
                        background: '#e0e0e0', padding: '1rem', borderRadius: 'var(--r-md)', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
                      }}>
                        <div style={{
                          display: 'flex', flexDirection: 'row', width: '313px', height: '132px', background: 'transparent'
                        }}>
                          {/* Left Label (40x35mm approx 151x132px) */}
                          <div style={{
                            width: '151px', height: '132px', background: '#fff', borderRadius: '4px',
                            boxSizing: 'border-box', padding: '8px', display: 'flex', flexDirection: 'column',
                            justifyContent: 'center', alignItems: 'center', overflow: 'hidden', flexShrink: 0,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                          }}>
                            <div style={{ fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', textAlign: 'center', color: '#000' }}>
                              {selectedVariant.productName}
                            </div>
                            <div style={{ fontSize: '10px', color: '#000' }}>{selectedVariant.label}</div>
                            <div style={{ margin: '2px 0' }}><BarcodePreview barcode={selectedVariant.barcode} /></div>
                            <div style={{ fontSize: '11px', fontWeight: 'bold', marginTop: '2px', display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', color: '#000' }}>
                              <span>{currentPrice ? paiseToCurrency(currentPrice.retailPricePaise) : '—'}</span>
                              <span style={{ fontSize: '8px', fontWeight: 'normal' }}>{new Date(printDate).toLocaleDateString('en-GB')}</span>
                            </div>
                          </div>

                          {/* Gap (3mm approx 11px) */}
                          <div style={{ width: '11px', height: '132px', flexShrink: 0 }}></div>

                          {/* Right Label */}
                          <div style={{
                            width: '151px', height: '132px', background: '#fff', borderRadius: '4px',
                            boxSizing: 'border-box', padding: '8px', display: 'flex', flexDirection: 'column',
                            justifyContent: 'center', alignItems: 'center', overflow: 'hidden', flexShrink: 0,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                          }}>
                            <div style={{ fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', textAlign: 'center', color: '#000' }}>
                              {selectedVariant.productName}
                            </div>
                            <div style={{ fontSize: '10px', color: '#000' }}>{selectedVariant.label}</div>
                            <div style={{ margin: '2px 0' }}><BarcodePreview barcode={selectedVariant.barcode} /></div>
                            <div style={{ fontSize: '11px', fontWeight: 'bold', marginTop: '2px', display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', color: '#000' }}>
                              <span>{currentPrice ? paiseToCurrency(currentPrice.retailPricePaise) : '—'}</span>
                              <span style={{ fontSize: '8px', fontWeight: 'normal' }}>{new Date(printDate).toLocaleDateString('en-GB')}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div><span style={{ fontWeight: 600, color: 'var(--ink-2)' }}>Barcode:</span> <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-1)' }}>{selectedVariant.barcode}</span></div>
                        <div><span style={{ fontWeight: 600, color: 'var(--ink-2)' }}>Current price:</span> <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-1)' }}>{currentPrice ? paiseToCurrency(currentPrice.retailPricePaise) : 'Not set'}</span></div>
                        {!currentPrice && (
                          <p style={{ fontSize: '0.75rem', color: 'var(--red)', marginTop: '0.5rem', background: 'oklch(0.24 0.065 25)', padding: '0.5rem', borderRadius: 'var(--r-sm)', border: '1px solid oklch(0.44 0.13 25)' }}>No price set — set a Price Menu entry first.</p>
                        )}
                      </div>
                    </div>

                    {/* Print controls */}
                    <form onSubmit={handlePrint} className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', flexShrink: 0 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <label style={labelStyle}>Quantity</label>
                          <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} required />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <label style={labelStyle}>Print type</label>
                          <select value={printType} onChange={(e) => setPrintType(e.target.value as typeof printType)}>
                            <option value="after_pack">After Pack</option>
                            <option value="reprice">Reprice (no stock change)</option>
                            <option value="reprint">Reprint</option>
                          </select>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <label style={labelStyle}>Date on Label</label>
                          <input type="date" value={printDate} onChange={(e) => setPrintDate(e.target.value)} required />
                        </div>
                      </div>

                      {printType === 'reprice' && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--amber)', background: 'oklch(0.25 0.06 75)', border: '1px solid oklch(0.48 0.11 75)', padding: '0.5rem 0.75rem', borderRadius: 'var(--r-md)' }}>
                          Reprice prints labels at the current price. No stock or cost changes.
                        </p>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                        {status ? (
                          <p style={{ fontSize: '0.8125rem', fontWeight: 500, color: status.ok ? 'var(--green)' : 'var(--red)' }}>{status.msg}</p>
                        ) : <div></div>}

                        <button type="submit" disabled={loading || !currentPrice} className="btn btn-primary" style={{ padding: '0.5rem 1.5rem' }}>
                          {loading ? 'Printing…' : 'Print Labels'}
                        </button>
                      </div>
                    </form>
                  </>
                )
              })()}
            </div>
          )}
        </div>
      )}

      {tab === 'log' && (
        <div className="card" style={{ flex: 1, overflowY: 'auto', maxWidth: 1100, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '0.9375rem', fontWeight: 650, color: 'var(--ink-1)', margin: 0 }}>Recent Label Prints</h2>
            <select value={selectedVariantId ?? ''} onChange={(e) => {
              const id = e.target.value ? Number(e.target.value) : null
              setSelectedVariantId(id)
            }} style={{ width: '250px' }}>
              <option value="">All variants</option>
              {allVariants.map((v) => (
                <option key={v.id} value={v.id}>{v.productName} — {v.label}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {log.length === 0 ? (
              <div style={{ padding: '4rem 1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink-2)' }}>No print history</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--ink-3)', marginTop: 2 }}>No labels have been printed yet.</div>
              </div>
            ) : (
              <table style={{ width: '100%', fontSize: '0.8125rem', textAlign: 'left' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '0.75rem 1.25rem', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Date</th>
                    <th style={{ padding: '0.75rem 1.25rem', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Variant</th>
                    <th style={{ padding: '0.75rem 1.25rem', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Qty</th>
                    <th style={{ padding: '0.75rem 1.25rem', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Price printed</th>
                    <th style={{ padding: '0.75rem 1.25rem', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {log.map((l) => {
                    const v = allVariants.find((v) => v.id === l.variantId)
                    return (
                      <tr key={l.id}>
                        <td style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)', color: 'var(--ink-2)' }}>{l.date}</td>
                        <td style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)', fontWeight: 500, color: 'var(--ink-1)' }}>{v ? `${v.productName} — ${v.label}` : `v${l.variantId}`}</td>
                        <td style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ink-1)' }}>{l.qty}</td>
                        <td style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)', color: 'var(--ink-2)' }}>{paiseToCurrency(l.pricePrintedPaise)}</td>
                        <td style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
                          <span style={{
                            fontSize: '0.6875rem', fontWeight: 500, padding: '0.125rem 0.5rem', borderRadius: 'var(--r-full)',
                            background: l.type === 'reprice' ? 'oklch(0.25 0.06 75)' : l.type === 'after_pack' ? 'oklch(0.25 0.07 145)' : 'var(--bg-fill)',
                            color: l.type === 'reprice' ? 'var(--amber)' : l.type === 'after_pack' ? 'var(--green)' : 'var(--ink-3)'
                          }}>{l.type}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
