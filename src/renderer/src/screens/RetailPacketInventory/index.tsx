import { useState, useEffect, type ReactElement, type FormEvent } from 'react'
import { useAppStore } from '../../store/appStore'
import { paiseToCurrency } from '@shared/money'
import type { Product, RetailStockRow, RetailMovementRow } from '@shared/types'

type Tab = 'stock' | 'movements'

// Shared inline style constants
const labelStyle: React.CSSProperties = { fontSize: '0.75rem', fontWeight: 500, color: 'var(--ink-3)', marginBottom: 2 }

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
      <form onSubmit={submit} style={{
        background: 'var(--bg-fill)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
        padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={labelStyle}>Change (pcs)</label>
            <input type="number" value={qty} onChange={(e) => setQty(e.target.value)}
              required autoFocus placeholder="e.g. -5 or 10" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={labelStyle}>Reason</label>
            <select value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}>
              <option value="manual">Manual correction</option>
              <option value="damage">Damage</option>
              <option value="wastage">Wastage</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={labelStyle}>Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        {err && <p style={{ fontSize: '0.75rem', color: 'var(--red)' }}>{err}</p>}
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => onDone()} className="btn btn-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}>Cancel</button>
          <button type="submit" className="btn btn-amber" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}>Save</button>
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
      <div className="modal-overlay" onClick={() => { setModalProductId(null); setAdjustVariantId(null) }}>
        <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--ink-1)' }}>{product.name} — Variants</h3>
            <button onClick={() => { setModalProductId(null); setAdjustVariantId(null) }}
              style={{ background: 'transparent', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', fontSize: '1.25rem' }}>✕</button>
          </div>
          <table style={{ width: '100%', fontSize: '0.8125rem', textAlign: 'left' }}>
            <thead>
              <tr>
                <th style={{ paddingBottom: '0.5rem', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Variant</th>
                <th style={{ paddingBottom: '0.5rem', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Stock (pcs)</th>
                {isAdmin && <th style={{ paddingBottom: '0.5rem', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Avg cost</th>}
                <th style={{ paddingBottom: '0.5rem', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Status</th>
                {isAdmin && <th style={{ paddingBottom: '0.5rem', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)', textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => {
                const stock = stockMap[v.id]
                const qty = stock?.qtyPcs ?? 0
                const isLow = qty < v.retailLowStockPcs
                return (
                  <tr key={v.id}>
                    <td style={{ padding: '0.625rem 0', borderBottom: '1px solid var(--border)', fontWeight: 500, color: 'var(--ink-1)' }}>{v.label}</td>
                    <td style={{ padding: '0.625rem 0', borderBottom: '1px solid var(--border)', fontWeight: 600, color: isLow ? 'var(--red)' : 'var(--ink-1)', fontFamily: 'var(--font-mono)' }}>{qty}</td>
                    {isAdmin && (
                      <td style={{ padding: '0.625rem 0', borderBottom: '1px solid var(--border)', color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>
                        {stock?.avgCostPerPc != null ? paiseToCurrency(Math.round(stock.avgCostPerPc * 100)) : '—'}
                      </td>
                    )}
                    <td style={{ padding: '0.625rem 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{
                        fontSize: '0.6875rem', fontWeight: 500, padding: '0.125rem 0.5rem',
                        borderRadius: 'var(--r-full)',
                        background: isLow ? 'oklch(0.24 0.065 25)' : 'oklch(0.25 0.07 145)',
                        color: isLow ? 'var(--red)' : 'var(--green)',
                      }}>
                        {isLow ? `Low (< ${v.retailLowStockPcs})` : 'OK'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td style={{ padding: '0.625rem 0', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>
                        <button
                          onClick={() => setAdjustVariantId(adjustVariantId === v.id ? null : v.id)}
                          className="btn btn-ghost" style={{ padding: '0.125rem 0.375rem', fontSize: '0.75rem', color: 'var(--amber)' }}>
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
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--ink-1)', letterSpacing: '-0.02em' }}>Retail Packets</h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--ink-3)', marginTop: '0.125rem' }}>Manage packet inventory and view movements</p>
        </div>
        <div className="tab-bar">
          {(['stock', 'movements'] as Tab[]).map((t) => (
            <button key={t} onClick={() => { setTab(t); if (t === 'movements' && selectedVariantId) loadMovements(selectedVariantId) }}
              className={`tab-item${tab === t ? ' active' : ''}`}>
              {t === 'stock' ? 'Stock' : 'Movements'}
            </button>
          ))}
        </div>
      </div>

      {error && <p style={{ fontSize: '0.8125rem', color: 'var(--red)', maxWidth: 1100, margin: '0 auto', width: '100%' }}>{error}</p>}

      {tab === 'stock' && (
        <div className="card" style={{ flex: 1, overflowY: 'auto', maxWidth: 1100, width: '100%', margin: '0 auto' }}>
          <table style={{ width: '100%', fontSize: '0.8125rem', textAlign: 'left' }}>
            <thead>
              <tr>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Product</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Total stock (pcs)</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Status</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)', textAlign: 'right' }}></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const enabled = p.variants.filter((v) => v.enabled)
                if (enabled.length === 0) return null
                const totalQty = enabled.reduce((sum, v) => sum + (stockMap[v.id]?.qtyPcs ?? 0), 0)
                const anyLow = enabled.some((v) => (stockMap[v.id]?.qtyPcs ?? 0) < v.retailLowStockPcs)
                return (
                  <tr key={p.id}>
                    <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', fontWeight: 600, color: 'var(--ink-1)' }}>{p.name}</td>
                    <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', fontWeight: 600, color: anyLow ? 'var(--red)' : 'var(--ink-1)', fontFamily: 'var(--font-mono)' }}>
                      {totalQty}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)' }}>
                      <span style={{
                        fontSize: '0.6875rem', fontWeight: 500, padding: '0.125rem 0.5rem',
                        borderRadius: 'var(--r-full)',
                        background: anyLow ? 'oklch(0.24 0.065 25)' : 'oklch(0.25 0.07 145)',
                        color: anyLow ? 'var(--red)' : 'var(--green)',
                      }}>
                        {anyLow ? 'Some low' : 'OK'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>
                      <button
                        onClick={() => { setModalProductId(p.id); setAdjustVariantId(null) }}
                        className="btn btn-ghost" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: 'var(--accent)' }}>
                        View Variants
                      </button>
                    </td>
                  </tr>
                )
              })}
              {products.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--ink-3)' }}>No retail products found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'movements' && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'clamp(260px, 22%, 320px) 1fr',
          gap: '0.75rem', flex: 1, minHeight: 0, overflow: 'hidden',
          maxWidth: 1100, width: '100%', margin: '0 auto',
        }}>
          {/* Left: Product sidebar */}
          <div className="card" style={{
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            borderRadius: 'var(--r-lg)', minHeight: 0,
          }}>
            <div style={{
              padding: '0.75rem 0.875rem', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span className="section-label" style={{ margin: 0, padding: 0 }}>Products</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '0.25rem 0' }}>
              {products.map((p) => {
                const enabled = p.variants.filter((v) => v.enabled)
                if (enabled.length === 0) return null
                const isSelected = enabled.some((v) => v.id === selectedVariantId)
                return (
                  <div key={p.id}
                    onClick={() => { const first = enabled[0]; if (first) selectVariant(first.id) }}
                    style={{
                      padding: '0.5rem 0.875rem', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', gap: '0.125rem',
                      background: isSelected ? 'var(--accent-soft)' : 'transparent',
                      borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
                      transition: 'background 80ms ease, border-color 80ms ease',
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

          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {!selectedVariant && (
              <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink-2)' }}>Select a product</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--ink-3)', marginTop: 2 }}>Choose a product to view movements</div>
              </div>
            )}
            {selectedVariant && (() => {
              const product = products.find((p) => p.variants.some((v) => v.id === selectedVariantId))
              const variants = product?.variants.filter((v) => v.enabled) ?? []
              return (
                <>
                  <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--ink-1)', margin: 0 }}>{selectedVariant.productName}</h2>
                    <select
                      value={selectedVariantId ?? ''}
                      onChange={(e) => selectVariant(Number(e.target.value))}
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem' }}>
                      {variants.map((v) => (
                        <option key={v.id} value={v.id}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    {movements.length === 0 ? (
                      <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink-2)' }}>No movements</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--ink-3)', marginTop: 2 }}>No activity recorded for this variant.</div>
                      </div>
                    ) : (
                      <table style={{ width: '100%', fontSize: '0.8125rem', textAlign: 'left' }}>
                        <thead>
                          <tr>
                            <th style={{ padding: '0.625rem 1rem', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Date</th>
                            <th style={{ padding: '0.625rem 1rem', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Type</th>
                            <th style={{ padding: '0.625rem 1rem', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Change (pcs)</th>
                            <th style={{ padding: '0.625rem 1rem', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Reference</th>
                          </tr>
                        </thead>
                        <tbody>
                          {movements.map((m, i) => (
                            <tr key={i}>
                              <td style={{ padding: '0.625rem 1rem', borderBottom: '1px solid var(--border)', color: 'var(--ink-2)' }}>{m.date}</td>
                              <td style={{ padding: '0.625rem 1rem', borderBottom: '1px solid var(--border)' }}>
                                <span style={{
                                  fontSize: '0.6875rem', fontWeight: 500, padding: '0.125rem 0.5rem',
                                  borderRadius: 'var(--r-full)',
                                  background: m.type === 'packing' ? 'oklch(0.25 0.07 145)' : m.type === 'sale' ? 'oklch(0.24 0.065 25)' : 'oklch(0.25 0.06 75)',
                                  color: m.type === 'packing' ? 'var(--green)' : m.type === 'sale' ? 'var(--red)' : 'var(--amber)',
                                }}>{m.type}</span>
                              </td>
                              <td style={{ padding: '0.625rem 1rem', borderBottom: '1px solid var(--border)', fontWeight: 600, fontFamily: 'var(--font-mono)', color: m.qtyChange >= 0 ? 'var(--green)' : 'var(--red)' }}>
                                {m.qtyChange >= 0 ? '+' : ''}{m.qtyChange}
                              </td>
                              <td style={{ padding: '0.625rem 1rem', borderBottom: '1px solid var(--border)', color: 'var(--ink-3)' }}>{m.reference}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
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
