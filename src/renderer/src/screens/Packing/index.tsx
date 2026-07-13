// @ts-nocheck
import { useState, useEffect, type ReactElement, type ChangeEvent } from 'react'
import { useAppStore } from '../../store/appStore'
import { formatQuantity, bulkUnit } from '@shared/money'
import type { Product, BulkStockRow, PackingRunRow } from '@shared/types'

type Tab = 'pack' | 'history'

// Shared inline style constants
const labelStyle: React.CSSProperties = { fontSize: '0.75rem', fontWeight: 500, color: 'var(--ink-3)', marginBottom: 2 }

export default function PackingScreen(): ReactElement {
  const { user } = useAppStore()
  const [tab, setTab] = useState<Tab>('pack')
  const [products, setProducts] = useState<Product[]>([])
  const [stockMap, setStockMap] = useState<Record<number, BulkStockRow>>({})
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [counts, setCounts] = useState<Record<number, string>>({}) // variantId → input string
  const [notes, setNotes] = useState('')
  const [validation, setValidation] = useState<{ totalGrams: number; bulkAvailableGrams: number } | null>(null)
  const [validationError, setValidationError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
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
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--ink-1)', letterSpacing: '-0.02em' }}>Packing</h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--ink-3)', marginTop: '0.125rem' }}>Convert bulk stock into retail packets</p>
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
            {(['pack', 'history'] as Tab[]).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`tab-item${tab === t ? ' active' : ''}`}>
                {t === 'pack' ? 'Pack' : 'History'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {tab === 'pack' && (
        <div style={{
          display: 'grid', gridTemplateColumns: selectedProduct ? 'clamp(260px, 22%, 320px) 1fr' : '1fr',
          gap: '0.75rem', flex: 1, minHeight: 0, overflow: 'hidden',
          maxWidth: 1100, width: '100%', margin: '0 auto',
        }}>
          {/* Left: Product selector */}
          <div className="card" style={{
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            borderRadius: 'var(--r-lg)', minHeight: 0,
            ...(selectedProduct ? {} : { maxWidth: 380, margin: '0 auto', width: '100%' }),
          }}>
            <div style={{
              padding: '0.75rem 0.875rem', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span className="section-label" style={{ margin: 0, padding: 0 }}>Products with stock</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '0.25rem 0' }}>
              {products.length === 0 && (
                <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink-2)' }}>No bulk stock</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--ink-3)', marginTop: 2 }}>Record bulk arrival first</div>
                </div>
              )}
              {products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.categoryName?.toLowerCase().includes(searchQuery.toLowerCase())).map((p) => {
                const stock = stockMap[p.id]
                const isSelected = selectedProductId === p.id
                return (
                  <div key={p.id} onClick={() => selectProduct(p.id)}
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
                      {formatQuantity(stock?.qtyGrams ?? 0, p.unitType)} available
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right: Pack form */}
          {selectedProduct && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', paddingRight: '0.25rem' }}>
              
              {/* Live total tiles */}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <div style={{
                  flex: 1, background: 'var(--bg-surface)', border: validationError ? '1px solid var(--red)' : '1px solid var(--border)',
                  borderRadius: 'var(--r-lg)', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 500, color: 'var(--ink-3)' }}>Bulk to use</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: validationError ? 'var(--red)' : 'var(--ink-1)', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)' }}>
                        {validation ? formatQuantity(validation.totalGrams, selectedProduct.unitType) : `0 ${bulkUnit(selectedProduct.unitType)}`}
                      </div>
                      {validationError && <p style={{ fontSize: '0.75rem', color: 'var(--red)', marginTop: '0.25rem' }}>{validationError}</p>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 500, color: 'var(--ink-3)' }}>Available after</div>
                      {(() => {
                        const total = stockMap[selectedProduct.id]?.qtyGrams ?? 0
                        const used = validation?.totalGrams ?? 0
                        const remaining = total - used
                        const negative = remaining < 0
                        return (
                          <div style={{ fontSize: '1.25rem', fontWeight: 600, color: negative ? 'var(--red)' : 'var(--ink-2)', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)' }}>
                            {formatQuantity(remaining, selectedProduct.unitType)}
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Variant rows */}
              <div className="card" style={{ flexShrink: 0 }}>
                <table style={{ width: '100%', fontSize: '0.8125rem', textAlign: 'left' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '0.625rem 1rem', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Variant</th>
                      <th style={{ padding: '0.625rem 1rem', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Weight</th>
                      <th style={{ padding: '0.625rem 1rem', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)', width: 150 }}>Packets to pack</th>
                      <th style={{ padding: '0.625rem 1rem', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)', textAlign: 'right' }}>
                        {selectedProduct.unitType === 'volume' ? 'ml used' : 'Grams used'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {enabledVariants.map((v) => {
                      const count = parseInt(counts[v.id] ?? '0') || 0
                      return (
                        <tr key={v.id}>
                          <td style={{ padding: '0.625rem 1rem', borderBottom: '1px solid var(--border)', fontWeight: 500, color: 'var(--ink-1)' }}>{v.label}</td>
                          <td style={{ padding: '0.625rem 1rem', borderBottom: '1px solid var(--border)', color: 'var(--ink-3)' }}>{v.weightGrams}{selectedProduct.unitType === 'volume' ? 'ml' : 'g'}</td>
                          <td style={{ padding: '0.625rem 1rem', borderBottom: '1px solid var(--border)' }}>
                            <input
                              type="number" min="0" value={counts[v.id] ?? ''}
                              onChange={(e: ChangeEvent<HTMLInputElement>) => handleCountChange(v.id, e.target.value)}
                              style={{ width: '100px', background: 'var(--bg-fill)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '0.25rem 0.5rem', color: 'var(--ink-1)' }}
                            />
                          </td>
                          <td style={{ padding: '0.625rem 1rem', borderBottom: '1px solid var(--border)', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--ink-2)' }}>
                            {count > 0 ? formatQuantity(count * v.weightGrams, selectedProduct.unitType) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Notes + submit */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', marginTop: '0.25rem' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={labelStyle}>Notes (optional)</label>
                  <input value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
                <button
                  onClick={handleCommit}
                  disabled={!canCommit}
                  className="btn btn-primary">
                  Commit Packing Run
                </button>
              </div>

              {submitError && <p style={{ fontSize: '0.8125rem', color: 'var(--red)', marginTop: '0.25rem' }}>{submitError}</p>}
              
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div style={{ flex: 1, overflowY: 'auto', maxWidth: 1100, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingBottom: '1rem' }}>
          {runs.length === 0 && (
            <div style={{ padding: '4rem 1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink-2)' }}>No history</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--ink-3)', marginTop: 2 }}>No packing runs recorded yet.</div>
            </div>
          )}
          {runs.map((run) => {
            const prod = products.find((p) => p.id === run.productId)
            return (
              <div key={run.id} className="card" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontWeight: 600, color: 'var(--ink-1)', fontSize: '0.9375rem' }}>
                      Run #{run.id} — {prod?.name ?? `Product ${run.productId}`}
                    </span>
                    <span style={{ marginLeft: '0.75rem', fontSize: '0.75rem', color: 'var(--ink-3)' }}>{run.date}</span>
                  </div>
                  <span style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', color: 'var(--ink-2)', fontWeight: 500 }}>
                    {formatQuantity(run.bulkUsedGrams, prod?.unitType ?? 'weight')} packed
                  </span>
                </div>
                {run.notes && <p style={{ fontSize: '0.75rem', color: 'var(--ink-3)', marginTop: '0.25rem' }}>{run.notes}</p>}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
                  {run.lines.map((l) => {
                    const v = prod?.variants.find((vv) => vv.id === l.variantId)
                    return (
                      <span key={l.id} style={{
                        fontSize: '0.6875rem', fontWeight: 500, padding: '0.125rem 0.5rem',
                        borderRadius: 'var(--r-full)', background: 'var(--accent-soft)', color: 'var(--accent)',
                      }}>
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

      {/* Global Success Toast */}
      {successMsg && (
        <div style={{
          position: 'fixed', bottom: '2rem', right: '2rem',
          background: 'oklch(0.25 0.07 145)', color: 'var(--green)',
          border: '1px solid oklch(0.45 0.11 145)',
          padding: '0.75rem 1rem', borderRadius: 'var(--r-md)',
          fontSize: '0.8125rem', fontWeight: 500, boxShadow: 'var(--shadow-md)',
          zIndex: 'var(--z-toast)',
          display: 'flex', alignItems: 'center', gap: '0.5rem'
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          {successMsg}
        </div>
      )}
    </div>
  )
}
