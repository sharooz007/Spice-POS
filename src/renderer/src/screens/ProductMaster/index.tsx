// @ts-nocheck
import { useState, useEffect, useRef, type ReactElement } from 'react'
import JsBarcode from 'jsbarcode'
import { useAppStore } from '../../store/appStore'
import type { Product, ProductVariant, Category } from '@shared/types'

// ── Barcode SVG component ─────────────────────────────────────────────────────

function BarcodeSvg({ value }: { value: string }): ReactElement {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (ref.current) {
      try {
        JsBarcode(ref.current, value, { format: 'CODE128', height: 40, fontSize: 10, margin: 4 })
      } catch {
        // invalid barcode value — leave empty
      }
    }
  }, [value])
  return <svg ref={ref} />
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function paiseToCurrency(p: number): string {
  return '₹' + (p / 100).toFixed(2)
}

// ── Shared inline-style constants ─────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: '0.75rem', fontWeight: 500, color: 'var(--ink-3)', marginBottom: 2,
}
const errorTextStyle: React.CSSProperties = { fontSize: '0.75rem', color: 'var(--red)' }

// ── Main component ────────────────────────────────────────────────────────────

export default function ProductMasterScreen(): ReactElement {
  const { user } = useAppStore()
  const isAdmin = user?.role === 'admin'

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState('')
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [showAddVariant, setShowAddVariant] = useState(false)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null)
  const [barcodeVariant, setBarcodeVariant] = useState<ProductVariant | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // ── Load data ───────────────────────────────────────────────────────────────

  async function loadData(): Promise<void> {
    const [pRes, cRes] = await Promise.all([
      window.api.products.listProducts(),
      window.api.products.listCategories()
    ])
    if (!pRes.ok) { setError(pRes.error); return }
    if (!cRes.ok) { setError(cRes.error); return }
    setProducts(pRes.data)
    setCategories(cRes.data)
  }

  useEffect(() => { loadData() }, [])

  const selectedProduct = products.find((p) => p.id === selectedProductId) ?? null

  // ── Add Category form ───────────────────────────────────────────────────────

  function AddCategoryForm(): ReactElement {
    const [name, setName] = useState('')
    const [err, setErr] = useState('')
    async function submit(e: React.FormEvent): Promise<void> {
      e.preventDefault()
      const res = await window.api.products.createCategory({ name, userId: user!.id })
      if (!res.ok) { setErr(res.error); return }
      setShowAddCategory(false)
      loadData()
    }
    return (
      <div className="modal-overlay" onClick={() => setShowAddCategory(false)}>
        <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 650, color: 'var(--ink-1)', marginBottom: '1rem' }}>
            New Category
          </h3>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={labelStyle}>Category name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required
                placeholder="e.g. Spices & Masalas" autoFocus />
            </div>
            {err && <span style={errorTextStyle}>{err}</span>}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
              <button type="button" onClick={() => setShowAddCategory(false)} className="btn btn-secondary">Cancel</button>
              <button type="submit" className="btn btn-primary">Create Category</button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // ── Add/Edit Product form ───────────────────────────────────────────────────

  function ProductForm({ initial }: { initial?: Product }): ReactElement {
    const [name, setName] = useState(initial?.name ?? '')
    const [catId, setCatId] = useState(initial?.categoryId ?? (categories[0]?.id ?? 0))
    const [bulkThresh, setBulkThresh] = useState(String(initial?.bulkLowStockGrams ?? 1000))
    const [unitType, setUnitType] = useState<'weight' | 'volume'>(initial?.unitType ?? 'weight')
    const [err, setErr] = useState('')

    async function submit(e: React.FormEvent): Promise<void> {
      e.preventDefault()
      if (initial) {
        const res = await window.api.products.updateProduct({
          id: initial.id, name, categoryId: catId,
          bulkLowStockGrams: Number(bulkThresh),
          unitType, userId: user!.id
        })
        if (!res.ok) { setErr(res.error); return }
      } else {
        const res = await window.api.products.createProduct({
          name, categoryId: catId,
          bulkLowStockGrams: Number(bulkThresh),
          wholesaleRatePerKgPaise: 0,
          unitType, enabled: true, userId: user!.id
        })
        if (!res.ok) { setErr(res.error); return }
      }
      setShowAddProduct(false); setEditingProduct(null); loadData()
    }

    return (
      <div className="modal-overlay" onClick={() => { setShowAddProduct(false); setEditingProduct(null) }}>
        <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 650, color: 'var(--ink-1)', marginBottom: '1rem' }}>
            {initial ? 'Edit Product' : 'New Product'}
          </h3>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={labelStyle}>Product Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required
                  placeholder="e.g. Chilli Powder" autoFocus />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={labelStyle}>Category</label>
                <select value={catId} onChange={(e) => setCatId(e.target.value)}>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={labelStyle}>Bulk low-stock threshold (g)</label>
                <input type="number" value={bulkThresh} onChange={(e) => setBulkThresh(e.target.value)}
                  min={0} required />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={labelStyle}>Unit type</label>
              <div style={{ display: 'flex', gap: '0.375rem' }}>
                {(['weight', 'volume'] as const).map((u) => (
                  <button key={u} type="button" onClick={() => setUnitType(u)}
                    style={{
                      padding: '0.3125rem 0.75rem', borderRadius: 'var(--r-sm)', fontSize: '0.8125rem',
                      fontWeight: 500, cursor: 'pointer', border: '1px solid',
                      background: unitType === u ? 'var(--accent)' : 'var(--bg-fill)',
                      color: unitType === u ? '#fff' : 'var(--ink-2)',
                      borderColor: unitType === u ? 'var(--accent)' : 'var(--border)',
                      transition: 'background 100ms ease',
                    }}>
                    {u === 'weight' ? 'Weight (g/kg)' : 'Volume (ml/L)'}
                  </button>
                ))}
              </div>
            </div>

            {err && <p style={errorTextStyle}>{err}</p>}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
              <button type="button" onClick={() => { setShowAddProduct(false); setEditingProduct(null) }}
                className="btn btn-secondary">Cancel</button>
              <button type="submit" className="btn btn-primary">
                {initial ? 'Save Changes' : 'Create Product'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // ── Add/Edit Variant form ───────────────────────────────────────────────────

  function VariantForm({ productId, productName, initial }: { productId: number; productName: string; initial?: ProductVariant }): ReactElement {
    const [label, setLabel] = useState(initial?.label ?? '')
    const [weight, setWeight] = useState(String(initial?.weightGrams ?? ''))
    const [barcode, setBarcode] = useState(initial?.barcode ?? '')
    const [thresh, setThresh] = useState(String(initial?.retailLowStockPcs ?? 5))
    const [err, setErr] = useState('')

    // Auto-generate barcode when creating a new variant (not editing)
    // Re-runs when weight changes so the suggestion stays current.
    useEffect(() => {
      if (initial) return // editing: keep existing barcode
      const w = parseInt(weight)
      if (!productId || !w || w <= 0) return
      window.api.products.generateBarcode({ productName, weightGrams: w }).then((r) => {
        if (r.ok) setBarcode(r.data)
      })
    }, [weight]) // productId is stable for the lifetime of this form instance

    async function submit(e: React.FormEvent): Promise<void> {
      e.preventDefault()
      if (initial) {
        const res = await window.api.products.updateVariant({
          id: initial.id, label, weightGrams: Number(weight),
          barcode, retailLowStockPcs: Number(thresh), userId: user!.id
        })
        if (!res.ok) { setErr(res.error); return }
      } else {
        const res = await window.api.products.createVariant({
          productId, label, weightGrams: Number(weight),
          barcode, retailLowStockPcs: Number(thresh),
          enabled: true, userId: user!.id
        })
        if (!res.ok) { setErr(res.error); return }
      }
      setShowAddVariant(false); setEditingVariant(null); loadData()
    }

    return (
      <div className="modal-overlay" onClick={() => { setShowAddVariant(false); setEditingVariant(null) }}>
        <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 650, color: 'var(--ink-1)', marginBottom: '0.25rem' }}>
            {initial ? 'Edit Variant' : 'New Variant'}
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--ink-3)', marginBottom: '1rem' }}>{productName}</p>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={labelStyle}>Label (e.g. 250g)</label>
                <input value={label} onChange={(e) => setLabel(e.target.value)} required
                  placeholder="250g" autoFocus />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={labelStyle}>Weight (grams)</label>
                <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)}
                  min={1} required placeholder="250" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={labelStyle}>Barcode (Code128)</label>
                <input value={barcode} onChange={(e) => setBarcode(e.target.value)}
                  style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.02em' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={labelStyle}>Low-stock threshold (pcs)</label>
                <input type="number" value={thresh} onChange={(e) => setThresh(e.target.value)}
                  min={0} required />
              </div>
            </div>
            {err && <p style={errorTextStyle}>{err}</p>}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
              <button type="button" onClick={() => { setShowAddVariant(false); setEditingVariant(null) }}
                className="btn btn-secondary">Cancel</button>
              <button type="submit" className="btn btn-primary">
                {initial ? 'Save Changes' : 'Add Variant'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // ── Barcode modal ───────────────────────────────────────────────────────────

  function BarcodeModal({ variant }: { variant: ProductVariant }): ReactElement {
    return (
      <div className="modal-overlay" onClick={() => setBarcodeVariant(null)}>
        <div className="modal-box" onClick={(e) => e.stopPropagation()}
          style={{ maxWidth: 360, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 650, color: 'var(--ink-1)', marginBottom: '0.125rem' }}>{variant.label}</h3>
            <span style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.03em' }}>{variant.barcode}</span>
          </div>
          <div style={{ background: '#fff', borderRadius: 'var(--r-md)', padding: '0.75rem 1rem' }}>
            <BarcodeSvg value={variant.barcode} />
          </div>
          <button onClick={() => setBarcodeVariant(null)} className="btn btn-secondary" style={{ width: '100%' }}>Close</button>
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
            Product Master
          </h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--ink-3)', marginTop: '0.125rem' }}>
            {products.length} product{products.length !== 1 ? 's' : ''} · {categories.length} categor{categories.length !== 1 ? 'ies' : 'y'}
          </p>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => setShowAddCategory(true)} className="btn btn-secondary">
              <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 14, height: 14 }}>
                <path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2Z"/>
              </svg>
              Category
            </button>
            <button onClick={() => { setEditingProduct(null); setShowAddProduct(true) }} className="btn btn-primary">
              <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 14, height: 14 }}>
                <path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2Z"/>
              </svg>
              Product
            </button>
          </div>
        )}
      </div>

      {error && <p style={{ ...errorTextStyle, maxWidth: 1100, width: '100%', margin: '0 auto' }}>{error}</p>}

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
            <span style={{ fontSize: '0.6875rem', color: 'var(--ink-4)', fontVariantNumeric: 'tabular-nums' }}>
              {products.length}
            </span>
          </div>
          <div style={{ padding: '0 0.875rem 0.5rem' }}>
            <input 
              type="text" 
              placeholder="Search products..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
              style={{ width: '100%', padding: '0.375rem 0.5rem', fontSize: '0.8125rem', background: 'var(--bg-fill)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', color: 'var(--ink-1)' }}
            />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '0.25rem 0' }}>
            {products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.categoryName?.toLowerCase().includes(searchQuery.toLowerCase())).map((p) => {
              const isSelected = selectedProductId === p.id
              return (
                <div key={p.id}
                  onClick={() => setSelectedProductId(p.id)}
                  style={{
                    padding: '0.5rem 0.875rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                    background: isSelected ? 'var(--accent-soft)' : 'transparent',
                    borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
                    transition: 'background 80ms ease, border-color 80ms ease',
                    opacity: p.enabled ? 1 : 0.45,
                  }}
                  onMouseEnter={(e) => { if (!isSelected) (e.currentTarget.style.background = 'var(--bg-fill)') }}
                  onMouseLeave={(e) => { if (!isSelected) (e.currentTarget.style.background = 'transparent') }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: '0.8125rem',
                      fontWeight: isSelected ? 600 : 500,
                      color: isSelected ? 'var(--accent)' : 'var(--ink-1)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>{p.name}</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--ink-4)', marginTop: 1 }}>
                      {p.categoryName}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0 }}>
                    <span style={{
                      fontSize: '0.625rem',
                      fontWeight: 500,
                      padding: '0.0625rem 0.375rem',
                      borderRadius: 'var(--r-full)',
                      background: p.variants.length ? 'var(--bg-fill)' : 'oklch(0.24 0.065 25)',
                      color: p.variants.length ? 'var(--ink-3)' : 'var(--red)',
                    }}>
                      {p.variants.length} var{p.variants.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              )
            })}
            {products.length === 0 && (
              <div style={{ padding: '2rem 1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.8125rem', color: 'var(--ink-3)' }}>No products yet</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--ink-4)', marginTop: 2 }}>Create your first product above.</div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: product detail ── */}
        {selectedProduct && (
          <div className="card" style={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRadius: 'var(--r-lg)',
            minHeight: 0,
          }}>
            {/* Product header */}
            <div style={{
              padding: '1rem 1.25rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '1rem',
              flexShrink: 0,
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                  <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--ink-1)', letterSpacing: '-0.01em' }}>
                    {selectedProduct.name}
                  </h2>
                  <span style={{
                    fontSize: '0.625rem', fontWeight: 500, padding: '0.125rem 0.5rem',
                    borderRadius: 'var(--r-full)',
                    background: selectedProduct.enabled ? 'oklch(0.25 0.07 145)' : 'oklch(0.24 0.065 25)',
                    color: selectedProduct.enabled ? 'var(--green)' : 'var(--red)',
                  }}>
                    {selectedProduct.enabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
                {/* Metadata chips */}
                <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                  {[
                    { label: selectedProduct.categoryName, icon: '📂' },
                    { label: `Threshold: ${selectedProduct.bulkLowStockGrams}g`, icon: '📦' },
                    { label: `Wholesale: ${paiseToCurrency(selectedProduct.wholesaleRatePerKgPaise)}/kg`, icon: '💰' },
                    { label: selectedProduct.unitType === 'weight' ? 'Weight (g/kg)' : 'Volume (ml/L)', icon: '⚖️' },
                  ].map((chip) => (
                    <span key={chip.label} style={{
                      fontSize: '0.6875rem',
                      color: 'var(--ink-3)',
                      background: 'var(--bg-fill)',
                      padding: '0.1875rem 0.5rem',
                      borderRadius: 'var(--r-full)',
                      border: '1px solid var(--border)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}>
                      <span style={{ fontSize: '0.625rem' }}>{chip.icon}</span> {chip.label}
                    </span>
                  ))}
                </div>
              </div>
              {isAdmin && (
                <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
                  <button
                    onClick={() => { setEditingProduct(selectedProduct); setShowAddProduct(false) }}
                    className="btn btn-secondary" style={{ fontSize: '0.8125rem', padding: '0.375rem 0.75rem' }}>
                    Edit
                  </button>
                  <button
                    onClick={async () => {
                      await window.api.products.toggleProductEnabled({ id: selectedProduct.id, userId: user!.id })
                      loadData()
                    }}
                    className="btn" style={{
                      fontSize: '0.8125rem', padding: '0.375rem 0.75rem',
                      background: selectedProduct.enabled ? 'oklch(0.24 0.065 25)' : 'oklch(0.25 0.07 145)',
                      color: selectedProduct.enabled ? 'var(--red)' : 'var(--green)',
                      borderColor: selectedProduct.enabled ? 'oklch(0.44 0.13 25)' : 'oklch(0.45 0.11 145)',
                    }}>
                    {selectedProduct.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => { setDeleteError(''); setDeleteConfirm(true) }}
                    className="btn btn-danger" style={{ fontSize: '0.8125rem', padding: '0.375rem 0.75rem' }}>
                    Delete
                  </button>
                  <button
                    onClick={() => { setEditingVariant(null); setShowAddVariant(true) }}
                    className="btn btn-primary" style={{ fontSize: '0.8125rem', padding: '0.375rem 0.75rem' }}>
                    <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 12, height: 12 }}>
                      <path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2Z"/>
                    </svg>
                    Variant
                  </button>
                </div>
              )}
            </div>

            {/* Variants section */}
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {selectedProduct.variants.length === 0 ? (
                <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 32, height: 32, color: 'var(--ink-4)', margin: '0 auto 0.75rem' }}>
                    <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                  </svg>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink-2)' }}>No variants</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--ink-3)', marginTop: 2 }}>
                    Add a variant to set up packet sizes and barcodes.
                  </div>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: '1.25rem' }}>Label</th>
                      <th>Weight</th>
                      <th>Barcode</th>
                      <th>Low Stock</th>
                      <th>Status</th>
                      {isAdmin && <th style={{ textAlign: 'right', paddingRight: '1.25rem' }}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedProduct.variants.map((v) => (
                      <tr key={v.id} style={{ opacity: v.enabled ? 1 : 0.45 }}>
                        <td style={{ paddingLeft: '1.25rem', fontWeight: 600 }}>{v.label}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums' }}>
                          {v.weightGrams}g
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--ink-2)', letterSpacing: '0.02em' }}>
                          {v.barcode}
                        </td>
                        <td>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums' }}>
                            {v.retailLowStockPcs}
                          </span>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--ink-4)', marginLeft: 3 }}>pcs</span>
                        </td>
                        <td>
                          <span style={{
                            fontSize: '0.6875rem', fontWeight: 500, padding: '0.125rem 0.5rem',
                            borderRadius: 'var(--r-full)',
                            background: v.enabled ? 'oklch(0.25 0.07 145)' : 'var(--bg-fill)',
                            color: v.enabled ? 'var(--green)' : 'var(--ink-4)',
                          }}>
                            {v.enabled ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        {isAdmin && (
                          <td style={{ textAlign: 'right', paddingRight: '1.25rem' }}>
                            <div style={{ display: 'flex', gap: '0.125rem', justifyContent: 'flex-end' }}>
                              <button onClick={() => setBarcodeVariant(v)}
                                className="btn btn-ghost" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', color: 'var(--accent)' }}>
                                Barcode
                              </button>
                              <button onClick={() => { setEditingVariant(v); setShowAddVariant(false) }}
                                className="btn btn-ghost" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>
                                Edit
                              </button>
                              <button
                                onClick={async () => {
                                  await window.api.products.toggleVariantEnabled({ id: v.id, userId: user!.id })
                                  loadData()
                                }}
                                className="btn btn-ghost"
                                style={{
                                  fontSize: '0.75rem', padding: '0.25rem 0.5rem',
                                  color: v.enabled ? 'var(--red)' : 'var(--green)',
                                }}>
                                {v.enabled ? 'Disable' : 'Enable'}
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {showAddCategory && isAdmin && <AddCategoryForm />}
      {(showAddProduct || editingProduct) && isAdmin && <ProductForm initial={editingProduct ?? undefined} />}
      {(showAddVariant || editingVariant) && isAdmin && selectedProduct && (
        <VariantForm productId={selectedProduct.id} productName={selectedProduct.name} initial={editingVariant ?? undefined} />
      )}
      {barcodeVariant && <BarcodeModal variant={barcodeVariant} />}

      {/* Delete confirmation */}
      {deleteConfirm && selectedProduct && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 400 }}>
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 650, color: 'var(--ink-1)', marginBottom: '0.375rem' }}>
              Delete {selectedProduct.name}?
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--ink-3)', marginBottom: '1rem' }}>
              This action cannot be undone. All variants will also be removed.
            </p>
            {deleteError && <p style={{ ...errorTextStyle, marginBottom: '0.75rem' }}>{deleteError}</p>}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
              <button
                onClick={() => { setDeleteConfirm(false); setDeleteError('') }}
                className="btn btn-secondary">Cancel</button>
              <button
                onClick={async () => {
                  const res = await window.api.products.deleteProduct({ productId: selectedProduct.id, userId: user!.id })
                  if (!res.ok) { setDeleteError(res.error); return }
                  setDeleteConfirm(false)
                  setDeleteError('')
                  setSelectedProductId(null)
                  setSuccessMsg(`${selectedProduct.name} deleted.`)
                  setTimeout(() => setSuccessMsg(''), 4000)
                  loadData()
                }}
                className="btn"
                style={{
                  background: 'var(--red)', color: '#fff',
                }}>
                Delete Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success toast */}
      {successMsg && (
        <div style={{
          position: 'fixed',
          bottom: '6.5rem',
          right: '1.5rem',
          background: 'oklch(0.25 0.07 145)',
          color: 'var(--green)',
          border: '1px solid oklch(0.45 0.11 145)',
          padding: '0.625rem 1rem',
          borderRadius: 'var(--r-md)',
          fontSize: '0.8125rem',
          fontWeight: 500,
          boxShadow: 'var(--shadow-md)',
          zIndex: 'var(--z-toast)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 14, height: 14, flexShrink: 0 }}>
            <path fillRule="evenodd" d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14Zm3.844-8.791a.75.75 0 0 0-1.188-.918l-3.7 4.79-1.649-1.833a.75.75 0 1 0-1.114 1.004l2.25 2.5a.75.75 0 0 0 1.15-.043l4.25-5.5Z" clipRule="evenodd"/>
          </svg>
          {successMsg}
        </div>
      )}
    </div>
  )
}
