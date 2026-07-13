// @ts-nocheck
import { useState, useEffect, useRef, type ReactElement, type KeyboardEvent } from 'react'
import { useAppStore } from '../../store/appStore'
import type { Product, ProductVariant, PriceMenuEntry } from '@shared/types'

function fmt(paise: number): string {
  return '₹' + (paise / 100).toFixed(2)
}

// ── Inline editable price cell ───────────────────────────────────────────────

function PriceCell({
  paise,
  onSave,
  disabled
}: {
  paise: number | null
  onSave: (newPaise: number) => Promise<void>
  disabled: boolean
}): ReactElement {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function startEdit(): void {
    if (disabled) return
    setVal(paise != null ? (paise / 100).toFixed(2) : '')
    setEditing(true)
  }

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  async function commit(): Promise<void> {
    const parsedStr = val.trim()
    const parsed = parsedStr === '' ? 0 : Math.round(parseFloat(parsedStr) * 100)
    const effectivePaise = paise ?? 0
    if (!isNaN(parsed) && parsed >= 0 && parsed !== effectivePaise) {
      setSaving(true)
      await onSave(parsed)
      setSaving(false)
    }
    setEditing(false)
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') commit()
    if (e.key === 'Escape') setEditing(false)
  }

  if (!editing) {
    return (
      <span
        onClick={startEdit}
        title={disabled ? '' : 'Click to edit'}
        style={{
          fontFamily: 'var(--font-mono)', fontSize: '0.875rem',
          color: disabled ? 'var(--ink-3)' : 'var(--ink-1)',
          cursor: disabled ? 'default' : 'pointer',
          padding: '0.125rem 0.375rem', borderRadius: 'var(--r-sm)',
          transition: 'background 80ms ease',
        }}
        onMouseEnter={(e) => { if (!disabled) { e.currentTarget.style.background = 'var(--accent-soft)'; e.currentTarget.style.color = 'var(--accent)'; } }}
        onMouseLeave={(e) => { if (!disabled) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-1)'; } }}
      >
        {paise != null ? fmt(paise) : <span style={{ color: 'var(--ink-4)' }}>—</span>}
      </span>
    )
  }

  return (
    <input
      ref={inputRef}
      type="number"
      step="0.01"
      min="0"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={onKey}
      disabled={saving}
      style={{
        width: '80px', background: 'var(--bg-surface)', border: '1px solid var(--accent)',
        borderRadius: 'var(--r-sm)', padding: '0.125rem 0.375rem', fontSize: '0.875rem',
        fontFamily: 'var(--font-mono)', color: 'var(--ink-1)', outline: 'none',
        boxShadow: '0 0 0 3px oklch(0.58 0.2 260 / 0.1)',
      }}
    />
  )
}

// ── Variants modal ────────────────────────────────────────────────────────────

function VariantsModal({
  product,
  entries,
  today,
  isAdmin,
  userId,
  onClose,
  onUpdated
}: {
  product: Product
  entries: PriceMenuEntry[]
  today: string
  isAdmin: boolean
  userId: number
  onClose: () => void
  onUpdated: () => void
}): ReactElement {
  function currentEntry(variantId: string): PriceMenuEntry | undefined {
    return entries
      .filter((e) => e.variantId === variantId && e.effectiveDate <= today)
      .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate) || String(b.id).localeCompare(String(a.id)))[0]
  }

  async function saveVariantPrice(
    variantId: string,
    field: 'retail' | 'wholesale',
    newPaise: number
  ): Promise<void> {
    const cur = currentEntry(variantId)
    await window.api.pricing.setVariantPrice({
      variantId,
      retailPricePaise: field === 'retail' ? newPaise : (cur?.retailPricePaise ?? newPaise),
      wholesalePricePaise: field === 'wholesale' ? newPaise : (cur?.wholesalePricePaise ?? newPaise),
      effectiveDate: today,
      userId
    })
    onUpdated()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, padding: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--ink-1)', margin: 0 }}>{product.name} — All Variants</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', fontSize: '1.25rem' }}>✕</button>
        </div>
        <table style={{ width: '100%', fontSize: '0.8125rem', textAlign: 'left' }}>
          <thead>
            <tr>
              <th style={{ padding: '0.75rem 1.25rem', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Variant</th>
              <th style={{ padding: '0.75rem 1.25rem', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Weight</th>
              <th style={{ padding: '0.75rem 1.25rem', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Retail Price</th>
            </tr>
          </thead>
          <tbody>
            {product.variants.map((v) => {
              const cur = currentEntry(v.id)
              return (
                <tr key={v.id}>
                  <td style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)', fontWeight: 500, color: 'var(--ink-1)' }}>{v.label}</td>
                  <td style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)', color: 'var(--ink-3)' }}>{v.weightGrams}g</td>
                  <td style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
                    <PriceCell
                      paise={cur?.retailPricePaise ?? null}
                      onSave={(p) => saveVariantPrice(v.id, 'retail', p)}
                      disabled={!isAdmin}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function PriceMenuScreen(): ReactElement {
  const { user } = useAppStore()
  const isAdmin = user?.role === 'admin'
  const today = new Date().toISOString().slice(0, 10)

  const [products, setProducts] = useState<Product[]>([])
  const [entries, setEntries] = useState<PriceMenuEntry[]>([])
  const [modalProduct, setModalProduct] = useState<Product | null>(null)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  async function loadData(): Promise<void> {
    const [pRes, eRes] = await Promise.all([
      window.api.products.listProducts(),
      window.api.pricing.listAllEntries()
    ])
    if (!pRes.ok) { setError(pRes.error); return }
    if (!eRes.ok) { setError(eRes.error); return }
    setProducts(pRes.data)
    setEntries(eRes.data)
  }

  useEffect(() => { loadData() }, [])

  // Resolve the "representative" variant for the product row:
  // prefer 1 kg (1000g), else the largest available variant.
  function repVariant(product: Product): ProductVariant | null {
    if (!product.variants.length) return null
    return (
      product.variants.find((v) => v.weightGrams === 1000) ??
      [...product.variants].sort((a, b) => b.weightGrams - a.weightGrams)[0]
    )
  }

  function currentEntry(variantId: string): PriceMenuEntry | undefined {
    return entries
      .filter((e) => e.variantId === variantId && e.effectiveDate <= today)
      .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate) || String(b.id).localeCompare(String(a.id)))[0]
  }

  async function saveVariantPrice(
    variantId: string,
    field: 'retail' | 'wholesale',
    newPaise: number
  ): Promise<void> {
    const cur = currentEntry(variantId)
    await window.api.pricing.setVariantPrice({
      variantId,
      retailPricePaise: field === 'retail' ? newPaise : (cur?.retailPricePaise ?? newPaise),
      wholesalePricePaise: field === 'wholesale' ? newPaise : (cur?.wholesalePricePaise ?? newPaise),
      effectiveDate: today,
      userId: user!.id
    })
    loadData()
  }

  async function saveProductWholesaleRate(
    productId: string,
    newPaise: number
  ): Promise<void> {
    await window.api.products.updateProduct({
      id: productId,
      wholesaleRatePerKgPaise: newPaise,
      userId: user!.id
    })
    // Also reload the full state (products + entries) to reflect
    useAppStore.getState().refresh()
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 96px)',
      background: 'var(--bg-base)', padding: '1.25rem', gap: '1rem', overflow: 'hidden',
    }}>
      {/* ── Page header ── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        flexShrink: 0, maxWidth: 1100, width: '100%', margin: '0 auto',
      }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--ink-1)', letterSpacing: '-0.02em', margin: 0 }}>Price Menu</h1>
          {!isAdmin && <p style={{ fontSize: '0.75rem', color: 'var(--ink-3)', marginTop: '0.25rem' }}>View only — Admin can edit prices inline.</p>}
          {isAdmin && <p style={{ fontSize: '0.75rem', color: 'var(--ink-3)', marginTop: '0.25rem' }}>Click any price to edit inline. Press Enter or click away to save.</p>}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input 
            type="text" 
            placeholder="Search products..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
            style={{ width: '240px', padding: '0.375rem 0.5rem', fontSize: '0.8125rem', background: 'var(--bg-fill)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', color: 'var(--ink-1)' }}
          />
        </div>
      </div>

      {error && <p style={{ fontSize: '0.8125rem', color: 'var(--red)', maxWidth: 1100, margin: '0 auto', width: '100%' }}>{error}</p>}

      <div className="card" style={{ flex: 1, overflowY: 'auto', maxWidth: 1100, width: '100%', margin: '0 auto' }}>
        <table style={{ width: '100%', fontSize: '0.8125rem', textAlign: 'left' }}>
          <thead>
            <tr>
              <th style={{ padding: '0.75rem 1rem', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Product</th>
              <th style={{ padding: '0.75rem 1rem', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Retail Price</th>
              <th style={{ padding: '0.75rem 1rem', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Wholesale Rate (₹/kg)</th>
              <th style={{ padding: '0.75rem 1rem', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}></th>
            </tr>
          </thead>
          <tbody>
            {products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.categoryName?.toLowerCase().includes(searchQuery.toLowerCase())).map((p) => {
              const rv = repVariant(p)
              const cur = rv ? currentEntry(rv.id) : undefined
              const is1kg = rv?.weightGrams === 1000
              const label = rv ? (is1kg ? '' : ` (${rv.label})`) : ''

              return (
                <tr key={p.id} style={{ transition: 'background 80ms ease' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-fill)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 600, color: 'var(--ink-1)' }}>{p.name}</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--ink-4)', marginTop: '0.125rem' }}>{p.categoryName}</div>
                  </td>

                  {/* Retail — inline editable */}
                  <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)' }}>
                    {rv ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem', alignItems: 'flex-start' }}>
                        <PriceCell
                          paise={cur?.retailPricePaise ?? null}
                          onSave={(paise) => saveVariantPrice(rv.id, 'retail', paise)}
                          disabled={!isAdmin}
                        />
                        {label && <span style={{ fontSize: '0.6875rem', color: 'var(--ink-4)', paddingLeft: '0.375rem' }}>{label}</span>}
                      </div>
                    ) : <span style={{ color: 'var(--ink-4)' }}>—</span>}
                  </td>

                  {/* Wholesale — inline editable (Product bulk rate) */}
                  <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem', alignItems: 'flex-start' }}>
                      <PriceCell
                        paise={p.wholesaleRatePerKgPaise || null}
                        onSave={(paise) => saveProductWholesaleRate(p.id, paise)}
                        disabled={!isAdmin}
                      />
                    </div>
                  </td>

                  {/* All variants button */}
                  <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>
                    {p.variants.length > 0 && (
                      <button
                        onClick={() => setModalProduct(p)}
                        className="btn btn-ghost" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: 'var(--accent)' }}
                      >
                        All Variants →
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
            {products.length === 0 && (
              <tr><td colSpan={4} style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--ink-3)' }}>No products found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* All-variants modal */}
      {modalProduct && (
        <VariantsModal
          product={modalProduct}
          entries={entries}
          today={today}
          isAdmin={isAdmin}
          userId={user!.id}
          onClose={() => setModalProduct(null)}
          onUpdated={loadData}
        />
      )}
    </div>
  )
}
