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

// ── Main component ────────────────────────────────────────────────────────────

export default function ProductMasterScreen(): ReactElement {
  const { user } = useAppStore()
  const isAdmin = user?.role === 'admin'

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState('')
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null)
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [showAddVariant, setShowAddVariant] = useState(false)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null)
  const [barcodeVariant, setBarcodeVariant] = useState<ProductVariant | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

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
      <form onSubmit={submit} className="flex gap-2 items-end mt-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Category name</label>
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-sm" required />
        </div>
        {err && <span className="text-xs text-red-600">{err}</span>}
        <button type="submit" className="btn btn-primary">Save</button>
        <button type="button" onClick={() => setShowAddCategory(false)} className="px-3 py-1 rounded text-sm border cursor-pointer">Cancel</button>
      </form>
    )
  }

  // ── Add/Edit Product form ───────────────────────────────────────────────────

  function ProductForm({ initial }: { initial?: Product }): ReactElement {
    const [name, setName] = useState(initial?.name ?? '')
    const [catId, setCatId] = useState(initial?.categoryId ?? (categories[0]?.id ?? 0))
    const [bulkThresh, setBulkThresh] = useState(String(initial?.bulkLowStockGrams ?? 1000))
    const [wRate, setWRate] = useState(String((initial?.wholesaleRatePerKgPaise ?? 0) / 100))
    const [unitType, setUnitType] = useState<'weight' | 'volume'>(initial?.unitType ?? 'weight')
    const [err, setErr] = useState('')

    async function submit(e: React.FormEvent): Promise<void> {
      e.preventDefault()
      const wholesalePaise = Math.round(parseFloat(wRate) * 100)
      if (initial) {
        const res = await window.api.products.updateProduct({
          id: initial.id, name, categoryId: Number(catId),
          bulkLowStockGrams: Number(bulkThresh),
          wholesaleRatePerKgPaise: wholesalePaise, unitType, userId: user!.id
        })
        if (!res.ok) { setErr(res.error); return }
      } else {
        const res = await window.api.products.createProduct({
          name, categoryId: Number(catId),
          bulkLowStockGrams: Number(bulkThresh),
          wholesaleRatePerKgPaise: wholesalePaise,
          unitType, enabled: true, userId: user!.id
        })
        if (!res.ok) { setErr(res.error); return }
      }
      setShowAddProduct(false); setEditingProduct(null); loadData()
    }

    return (
      <form onSubmit={submit} className="form-panel" style={{marginTop:"0.75rem"}}>
        <h3 className="font-semibold text-gray-800">{initial ? 'Edit Product' : 'New Product'}</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm" required />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Category</label>
            <select value={catId} onChange={(e) => setCatId(Number(e.target.value))}
              className="border border-gray-300 rounded px-2 py-1 text-sm">
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Bulk low-stock threshold (g)</label>
            <input type="number" value={bulkThresh} onChange={(e) => setBulkThresh(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm" min={0} required />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Wholesale rate (₹/kg)</label>
            <input type="number" step="0.01" value={wRate} onChange={(e) => setWRate(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm" min={0} required />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Unit type</label>
            <div className="flex gap-1">
              {(['weight', 'volume'] as const).map((u) => (
                <button key={u} type="button" onClick={() => setUnitType(u)}
                  className={`px-3 py-1 rounded text-xs font-medium border cursor-pointer transition-colors ${
                    unitType === u ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}>
                  {u === 'weight' ? 'Weight (g/kg)' : 'Volume (ml/L)'}
                </button>
              ))}
            </div>
          </div>
        </div>
        {err && <p className="text-xs text-red-600">{err}</p>}
        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary">Save</button>
          <button type="button" onClick={() => { setShowAddProduct(false); setEditingProduct(null) }}
            className="px-4 py-1.5 rounded text-sm border cursor-pointer">Cancel</button>
        </div>
      </form>
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
      <form onSubmit={submit} className="bg-blue-50 border border-blue-200 rounded p-3 flex flex-col gap-3 mt-2">
        <h4 className="font-semibold text-gray-700 text-sm">{initial ? 'Edit Variant' : 'New Variant'}</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Label (e.g. 250g)</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm" required />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Weight (grams)</label>
            <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm" min={1} required />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Barcode (Code128)</label>
            <input value={barcode} onChange={(e) => setBarcode(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm font-mono" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Low-stock threshold (pcs)</label>
            <input type="number" value={thresh} onChange={(e) => setThresh(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm" min={0} required />
          </div>
        </div>
        {err && <p className="text-xs text-red-600">{err}</p>}
        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary">Save</button>
          <button type="button" onClick={() => { setShowAddVariant(false); setEditingVariant(null) }}
            className="px-4 py-1.5 rounded text-sm border cursor-pointer">Cancel</button>
        </div>
      </form>
    )
  }

  // ── Barcode modal ───────────────────────────────────────────────────────────

  function BarcodeModal({ variant }: { variant: ProductVariant }): ReactElement {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
        onClick={() => setBarcodeVariant(null)}>
        <div className="bg-white rounded-xl shadow-xl p-6 flex flex-col items-center gap-3"
          onClick={(e) => e.stopPropagation()}>
          <h3 className="font-semibold text-gray-800">{variant.label} — {variant.barcode}</h3>
          <BarcodeSvg value={variant.barcode} />
          <button onClick={() => setBarcodeVariant(null)}
            className="mt-2 px-4 py-1.5 border rounded text-sm cursor-pointer">Close</button>
        </div>
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="page">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">Product Master</h1>
        {isAdmin && (
          <div className="flex gap-2">
            <button onClick={() => setShowAddCategory(true)}
              className="px-3 py-1.5 border rounded text-sm cursor-pointer hover:bg-gray-50 transition-colors">
              + Category
            </button>
            <button onClick={() => { setEditingProduct(null); setShowAddProduct(true) }}
              className="btn btn-primary">
              + Product
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      {showAddCategory && isAdmin && <AddCategoryForm />}
      {showAddProduct && isAdmin && <ProductForm />}
      {editingProduct && isAdmin && <ProductForm initial={editingProduct} />}

      {/* Product list */}
      <div className="flex gap-4">
        {/* Left: product list */}
        <div className="w-64 flex-shrink-0">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Products</div>
          <div className="flex flex-col gap-1">
            {products.map((p) => (
              <div key={p.id}
                onClick={() => setSelectedProductId(p.id)}
                className={`px-3 py-2 rounded cursor-pointer text-sm flex justify-between items-center transition-colors ${
                  selectedProductId === p.id ? 'list-item active' : 'list-item'
                } ${!p.enabled ? 'opacity-50' : ''}`}>
                <span>{p.name}</span>
                <span className={`text-xs ${selectedProductId === p.id ? 'text-blue-200' : 'text-gray-400'}`}>
                  {p.categoryName}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: product detail */}
        {selectedProduct && (
          <div className="card" style={{flex:1,padding:"1.25rem"}}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="font-bold text-gray-800 text-lg">{selectedProduct.name}</h2>
                <p className="text-sm text-gray-500">
                  {selectedProduct.categoryName} · Bulk threshold: {selectedProduct.bulkLowStockGrams}g ·
                  Wholesale: {paiseToCurrency(selectedProduct.wholesaleRatePerKgPaise)}/kg
                </p>
              </div>
              {isAdmin && (
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditingProduct(selectedProduct); setShowAddProduct(false) }}
                    className="px-3 py-1 border rounded text-sm cursor-pointer hover:bg-gray-50 transition-colors">
                    Edit
                  </button>
                  <button
                    onClick={async () => {
                      await window.api.products.toggleProductEnabled({ id: selectedProduct.id, userId: user!.id })
                      loadData()
                    }}
                    className={`px-3 py-1 rounded text-sm cursor-pointer transition-colors ${
                      selectedProduct.enabled
                        ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                        : 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                    }`}>
                    {selectedProduct.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => { setDeleteError(''); setDeleteConfirm(true) }}
                    className="btn btn-danger">
                    Delete
                  </button>
                  <button
                    onClick={() => { setEditingVariant(null); setShowAddVariant(true) }}
                    className="btn btn-primary">
                    + Variant
                  </button>
                </div>
              )}
            </div>

            {showAddVariant && isAdmin && <VariantForm productId={selectedProduct.id} productName={selectedProduct.name} />}
            {editingVariant && isAdmin && <VariantForm productId={selectedProduct.id} productName={selectedProduct.name} initial={editingVariant} />}

            {/* Variants table */}
            <table className="w-full text-sm mt-3">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b">
                  <th className="pb-2 pr-4">Label</th>
                  <th className="pb-2 pr-4">Weight</th>
                  <th className="pb-2 pr-4">Barcode</th>
                  <th className="pb-2 pr-4">Threshold</th>
                  <th className="pb-2 pr-4">Status</th>
                  {isAdmin && <th className="pb-2">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {selectedProduct.variants.map((v) => (
                  <tr key={v.id} className={`border-b last:border-0 ${!v.enabled ? 'opacity-50' : ''}`}>
                    <td className="py-2 pr-4 font-medium">{v.label}</td>
                    <td className="py-2 pr-4 text-gray-600">{v.weightGrams}g</td>
                    <td className="py-2 pr-4 font-mono text-gray-600">{v.barcode}</td>
                    <td className="py-2 pr-4 text-gray-600">{v.retailLowStockPcs} pcs</td>
                    <td className="py-2 pr-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${v.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {v.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="py-2">
                        <div className="flex gap-2">
                          <button onClick={() => setBarcodeVariant(v)}
                            className="text-blue-600 hover:underline text-xs cursor-pointer">Barcode</button>
                          <button onClick={() => { setEditingVariant(v); setShowAddVariant(false) }}
                            className="text-gray-600 hover:underline text-xs cursor-pointer">Edit</button>
                          <button
                            onClick={async () => {
                              await window.api.products.toggleVariantEnabled({ id: v.id, userId: user!.id })
                              loadData()
                            }}
                            className="text-red-600 hover:underline text-xs cursor-pointer">
                            {v.enabled ? 'Disable' : 'Enable'}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {barcodeVariant && <BarcodeModal variant={barcodeVariant} />}

      {/* Delete confirmation dialog */}
      {deleteConfirm && selectedProduct && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="font-semibold text-gray-800 mb-2">Delete {selectedProduct.name}?</h3>
            <p className="text-sm text-gray-600 mb-4">This cannot be undone.</p>
            {deleteError && <p className="text-xs text-red-600 mb-3">{deleteError}</p>}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setDeleteConfirm(false); setDeleteError('') }}
                className="px-4 py-1.5 border rounded text-sm cursor-pointer hover:bg-gray-50 transition-colors">
                Cancel
              </button>
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
                className="btn btn-danger">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success toast */}
      {successMsg && (
        <div className="fixed bottom-6 right-6 bg-green-700 text-white px-4 py-2 rounded shadow-lg text-sm z-50">
          {successMsg}
        </div>
      )}
    </div>
  )
}
