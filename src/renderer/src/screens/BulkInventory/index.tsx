import { useState, useEffect, type ReactElement, type FormEvent } from 'react'
import { useAppStore } from '../../store/appStore'
import { kgToGrams, paiseToCurrency, formatQuantity, bulkUnit } from '@shared/money'
import type { Product, BulkStockRow, BulkArrivalRow, BulkAdjustmentRow } from '@shared/types'

// Stock map keyed by productId
type StockMap = Record<number, BulkStockRow>

// ── Shared inline-style constants ─────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  fontSize: '0.75rem', fontWeight: 500, color: 'var(--ink-3)', marginBottom: 2,
}
const errorTextStyle: React.CSSProperties = { fontSize: '0.75rem', color: 'var(--red)' }

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
      <div className="modal-overlay" onClick={() => setShowArrival(false)}>
        <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 650, color: 'var(--ink-1)', marginBottom: '1rem' }}>
            Record Bulk Arrival
          </h3>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={labelStyle}>Quantity ({bulkUnit(selectedProduct?.unitType ?? 'weight')})</label>
                <input type="number" step="0.001" min="0.001" value={kgStr}
                  onChange={(e) => setKgStr(e.target.value)}
                  required autoFocus />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={labelStyle}>Date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
              {/* Cost field — Admin only (rules.md #14, never shown to staff) */}
              {isAdmin && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={labelStyle}>Cost per {bulkUnit(selectedProduct?.unitType ?? 'weight')} (₹) — optional</label>
                  <input type="number" step="0.01" min="0" value={costStr}
                    onChange={(e) => setCostStr(e.target.value)}
                    placeholder="Leave blank = no cost" />
                  {costStr.trim() === '' && (
                    <p style={{ fontSize: '0.6875rem', color: 'var(--amber)', background: 'oklch(0.25 0.06 75)', border: '1px solid oklch(0.48 0.11 75)', borderRadius: 'var(--r-xs)', padding: '0.25rem 0.5rem', marginTop: '0.25rem' }}>
                      ⚠ No cost entered — profit for this stock will show as unknown.
                    </p>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', gridColumn: isAdmin ? '1 / -1' : 'auto' }}>
                <label style={labelStyle}>Notes</label>
                <input value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
            {err && <p style={errorTextStyle}>{err}</p>}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
              <button type="button" onClick={() => setShowArrival(false)} className="btn btn-secondary">Cancel</button>
              <button type="submit" className="btn btn-success">Save Arrival</button>
            </div>
          </form>
        </div>
      </div>
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
      <div className="modal-overlay" onClick={() => setShowAdjust(false)}>
        <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 650, color: 'var(--ink-1)', marginBottom: '1rem' }}>
            Adjust Bulk Stock
          </h3>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={labelStyle}>Change ({bulkUnit(selectedProduct?.unitType ?? 'weight')}, use − for removal)</label>
                <input type="number" step="0.001" value={kgStr}
                  onChange={(e) => setKgStr(e.target.value)}
                  placeholder="e.g. -2.5 or 5" required autoFocus />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={labelStyle}>Reason</label>
                <select value={reason} onChange={(e) => setReason(e.target.value)}>
                  <option value="manual">Manual correction</option>
                  <option value="damage">Damage</option>
                  <option value="wastage">Wastage</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', gridColumn: 'span 2' }}>
                <label style={labelStyle}>Notes</label>
                <input value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
            {err && <p style={errorTextStyle}>{err}</p>}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
              <button type="button" onClick={() => setShowAdjust(false)} className="btn btn-secondary">Cancel</button>
              <button type="submit" className="btn btn-amber">Save Adjustment</button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100dvh - 96px)',
      background: 'var(--bg-base)',
      padding: '1.25rem',
      gap: '1rem',
      overflow: 'hidden',
    }}>
      {/* ── Page header ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        maxWidth: 1100,
        width: '100%',
        margin: '0 auto',
      }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--ink-1)', letterSpacing: '-0.02em' }}>
            Bulk Inventory
          </h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--ink-3)', marginTop: '0.125rem' }}>
            {products.length} product{products.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {pageError && <p style={{ ...errorTextStyle, maxWidth: 1100, width: '100%', margin: '0 auto' }}>{pageError}</p>}

      {/* ── Main content: master-detail ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: selectedProduct ? 'clamp(260px, 22%, 320px) 1fr' : '1fr',
        gap: '0.75rem',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
        maxWidth: 1100,
        width: '100%',
        margin: '0 auto',
      }}>
        {/* ── Left: product sidebar ── */}
        <div className="card" style={{
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: 'var(--r-lg)',
          minHeight: 0,
          ...(selectedProduct ? {} : { maxWidth: 380, margin: '0 auto', width: '100%' }),
        }}>
          <div style={{
            padding: '0.75rem 0.875rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span className="section-label" style={{ margin: 0, padding: 0 }}>Products</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '0.25rem 0' }}>
            {products.map((p) => {
              const isSelected = selectedId === p.id
              const stock = stockMap[p.id]
              const qty = stock?.qtyGrams ?? 0
              const isLow = qty < p.bulkLowStockGrams

              return (
                <div key={p.id}
                  onClick={() => selectProduct(p.id)}
                  style={{
                    padding: '0.5rem 0.875rem',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.125rem',
                    background: isSelected ? 'var(--accent-soft)' : 'transparent',
                    borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
                    transition: 'background 80ms ease, border-color 80ms ease',
                  }}
                  onMouseEnter={(e) => { if (!isSelected) (e.currentTarget.style.background = 'var(--bg-fill)') }}
                  onMouseLeave={(e) => { if (!isSelected) (e.currentTarget.style.background = 'transparent') }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      fontSize: '0.8125rem',
                      fontWeight: isSelected ? 600 : 500,
                      color: isSelected ? 'var(--accent)' : 'var(--ink-1)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>{p.name}</span>
                    {isLow && (
                      <span style={{
                        fontSize: '0.625rem', fontWeight: 500, padding: '0.0625rem 0.375rem',
                        borderRadius: 'var(--r-full)',
                        background: 'oklch(0.24 0.065 25)', color: 'var(--red)',
                      }}>Low</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: isSelected ? 'oklch(0.65 0.12 260)' : 'var(--ink-4)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>{formatQuantity(qty, p.unitType)}</span>
                    {isAdmin && stock?.avgCostPerKg != null && (
                      <span style={{ fontFamily: 'var(--font-mono)' }}>@ {paiseToCurrency(Math.round(stock.avgCostPerKg * 100))}/{bulkUnit(p.unitType)}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Right: detail panel ── */}
        {selectedProduct && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto' }}>
            {/* Stock summary card */}
            <div className="card" style={{ padding: '1.25rem', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--ink-1)', letterSpacing: '-0.01em' }}>
                    {selectedProduct.name}
                  </h2>
                  {(() => {
                    const stock = stockMap[selectedProduct.id]
                    const qty = stock?.qtyGrams ?? 0
                    const isLow = qty < selectedProduct.bulkLowStockGrams
                    return (
                      <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.75rem' }}>
                        <div>
                          <div style={{ fontSize: '0.6875rem', color: 'var(--ink-3)' }}>Current stock</div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: isLow ? 'var(--red)' : 'var(--ink-1)', fontFamily: 'var(--font-mono)' }}>
                            {formatQuantity(qty, selectedProduct.unitType)}
                          </div>
                          {isLow && (
                            <div style={{ fontSize: '0.6875rem', color: 'var(--red)', marginTop: '0.125rem' }}>
                              Below threshold ({formatQuantity(selectedProduct.bulkLowStockGrams, selectedProduct.unitType)})
                            </div>
                          )}
                        </div>
                        {isAdmin && (
                          <div>
                            <div style={{ fontSize: '0.6875rem', color: 'var(--ink-3)' }}>Avg cost</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--ink-2)', fontFamily: 'var(--font-mono)' }}>
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
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => { setShowAdjust(false); setShowArrival(true) }} className="btn btn-success" style={{ fontSize: '0.8125rem' }}>
                    Record Arrival
                  </button>
                  {isAdmin && (
                    <button onClick={() => { setShowArrival(false); setShowAdjust(true) }} className="btn btn-amber" style={{ fontSize: '0.8125rem' }}>
                      Adjust Stock
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Arrival history */}
            <div className="card" style={{ padding: '1.25rem', flexShrink: 0 }}>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 650, color: 'var(--ink-1)', marginBottom: '0.75rem' }}>Arrival History</h3>
              {arrivals.length === 0 ? (
                <p style={{ fontSize: '0.8125rem', color: 'var(--ink-4)' }}>No arrivals recorded yet.</p>
              ) : (
                <table style={{ width: '100%', fontSize: '0.8125rem', textAlign: 'left' }}>
                  <thead>
                    <tr>
                      <th style={{ paddingBottom: '0.5rem', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Date</th>
                      <th style={{ paddingBottom: '0.5rem', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Qty</th>
                      {isAdmin && <th style={{ paddingBottom: '0.5rem', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Cost/kg</th>}
                      <th style={{ paddingBottom: '0.5rem', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Notes</th>
                      {isAdmin && <th style={{ paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)', width: 32 }}></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {arrivals.map((a) => (
                      <tr key={a.id}>
                        <td style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)', color: 'var(--ink-2)' }}>{a.date}</td>
                        <td style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)' }}>{formatQuantity(a.qtyGrams, selectedProduct.unitType)}</td>
                        {isAdmin && (
                          <td style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)', color: 'var(--ink-2)' }}>
                            {a.costPerKgPaise != null ? paiseToCurrency(a.costPerKgPaise) : '—'}
                          </td>
                        )}
                        <td style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)', color: 'var(--ink-3)' }}>{a.notes ?? '—'}</td>
                        {isAdmin && (
                          <td style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>
                            <button
                              onClick={() => { setDeleteError(''); setDeleteConfirm(a.id) }}
                              className="btn btn-ghost" style={{ padding: '0.25rem 0.375rem', color: 'var(--red)' }}
                              title="Delete arrival"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
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

            {/* Adjustment history — Admin only */}
            {isAdmin && (
              <div className="card" style={{ padding: '1.25rem', flexShrink: 0 }}>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 650, color: 'var(--ink-1)', marginBottom: '0.75rem' }}>Adjustment History</h3>
                {adjustments.length === 0 ? (
                  <p style={{ fontSize: '0.8125rem', color: 'var(--ink-4)' }}>No adjustments.</p>
                ) : (
                  <table style={{ width: '100%', fontSize: '0.8125rem', textAlign: 'left' }}>
                    <thead>
                      <tr>
                        <th style={{ paddingBottom: '0.5rem', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Date</th>
                        <th style={{ paddingBottom: '0.5rem', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Change</th>
                        <th style={{ paddingBottom: '0.5rem', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Reason</th>
                        <th style={{ paddingBottom: '0.5rem', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adjustments.map((a) => (
                        <tr key={a.id}>
                          <td style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)', color: 'var(--ink-2)' }}>{a.date}</td>
                          <td style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontWeight: 600, color: a.qtyChangeGrams >= 0 ? 'var(--green)' : 'var(--red)' }}>
                            {a.qtyChangeGrams >= 0 ? '+' : ''}{formatQuantity(Math.abs(a.qtyChangeGrams), selectedProduct.unitType)}
                          </td>
                          <td style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)', color: 'var(--ink-2)' }}>{a.reason}</td>
                          <td style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)', color: 'var(--ink-3)' }}>{a.notes ?? '—'}</td>
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

      {/* Modals */}
      {showArrival && <ArrivalForm />}
      {showAdjust && isAdmin && <AdjustForm />}

      {/* Delete confirmation dialog */}
      {deleteConfirm !== null && (
        <div className="modal-overlay" onClick={() => { setDeleteConfirm(null); setDeleteError('') }}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 650, color: 'var(--ink-1)', marginBottom: '0.375rem' }}>Delete this arrival?</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--ink-3)', marginBottom: '1rem' }}>This will reverse the stock. This cannot be undone.</p>
            {deleteError && <p style={{ ...errorTextStyle, marginBottom: '0.75rem' }}>{deleteError}</p>}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
              <button onClick={() => { setDeleteConfirm(null); setDeleteError('') }} className="btn btn-secondary">Cancel</button>
              <button onClick={() => handleDeleteArrival(deleteConfirm)} className="btn btn-danger">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
