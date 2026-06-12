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
    const parsed = Math.round(parseFloat(val) * 100)
    if (!isNaN(parsed) && parsed >= 0 && parsed !== paise) {
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
        className={`font-mono text-sm ${disabled ? 'text-gray-500' : 'cursor-pointer hover:bg-indigo-50 hover:text-indigo-700 rounded px-1 transition-colors'}`}
      >
        {paise != null ? fmt(paise) : <span className="text-gray-400">—</span>}
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
      className="w-24 border border-indigo-400 rounded px-1.5 py-0.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
  function currentEntry(variantId: number): PriceMenuEntry | undefined {
    return entries
      .filter((e) => e.variantId === variantId && e.effectiveDate <= today)
      .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate) || b.id - a.id)[0]
  }

  async function saveVariantPrice(
    variantId: number,
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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-[560px] max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-bold text-gray-800">{product.name} — All Variants</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 cursor-pointer text-xl leading-none">×</button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 uppercase tracking-wide bg-gray-50 border-b">
              <th className="px-5 py-2">Variant</th>
              <th className="px-5 py-2">Weight</th>
              <th className="px-5 py-2">Retail</th>
              <th className="px-5 py-2">Wholesale</th>
            </tr>
          </thead>
          <tbody>
            {product.variants.map((v) => {
              const cur = currentEntry(v.id)
              return (
                <tr key={v.id} className="border-b last:border-0">
                  <td className="px-5 py-3 font-medium">{v.label}</td>
                  <td className="px-5 py-3 text-gray-500">{v.weightGrams}g</td>
                  <td className="px-5 py-3">
                    <PriceCell
                      paise={cur?.retailPricePaise ?? null}
                      onSave={(p) => saveVariantPrice(v.id, 'retail', p)}
                      disabled={!isAdmin}
                    />
                  </td>
                  <td className="px-5 py-3">
                    <PriceCell
                      paise={cur?.wholesalePricePaise ?? null}
                      onSave={(p) => saveVariantPrice(v.id, 'wholesale', p)}
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

  function currentEntry(variantId: number): PriceMenuEntry | undefined {
    return entries
      .filter((e) => e.variantId === variantId && e.effectiveDate <= today)
      .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate) || b.id - a.id)[0]
  }

  async function saveVariantPrice(
    variantId: number,
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

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-gray-800 mb-1">Price Menu</h1>
      {!isAdmin && <p className="text-xs text-gray-500 mb-3">View only — Admin can edit prices inline.</p>}
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      <div className="border rounded-xl bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 uppercase tracking-wide bg-gray-50 border-b">
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Retail</th>
              <th className="px-4 py-3">Wholesale</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const rv = repVariant(p)
              const cur = rv ? currentEntry(rv.id) : undefined
              const is1kg = rv?.weightGrams === 1000
              const label = rv ? (is1kg ? '' : ` (${rv.label})`) : ''

              return (
                <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-800">{p.name}</div>
                    <div className="text-xs text-gray-400">{p.categoryName}</div>
                  </td>

                  {/* Retail — inline editable */}
                  <td className="px-4 py-3">
                    {rv ? (
                      <div className="flex flex-col gap-0.5">
                        <PriceCell
                          paise={cur?.retailPricePaise ?? null}
                          onSave={(paise) => saveVariantPrice(rv.id, 'retail', paise)}
                          disabled={!isAdmin}
                        />
                        {label && <span className="text-xs text-gray-400">{label}</span>}
                      </div>
                    ) : <span className="text-gray-400 text-xs">—</span>}
                  </td>

                  {/* Wholesale — inline editable */}
                  <td className="px-4 py-3">
                    {rv ? (
                      <div className="flex flex-col gap-0.5">
                        <PriceCell
                          paise={cur?.wholesalePricePaise ?? null}
                          onSave={(paise) => saveVariantPrice(rv.id, 'wholesale', paise)}
                          disabled={!isAdmin}
                        />
                        {label && <span className="text-xs text-gray-400">{label}</span>}
                      </div>
                    ) : <span className="text-gray-400 text-xs">—</span>}
                  </td>

                  {/* All variants button */}
                  <td className="px-4 py-3">
                    {p.variants.length > 0 && (
                      <button
                        onClick={() => setModalProduct(p)}
                        className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer whitespace-nowrap"
                      >
                        All Variants →
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
            {products.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-gray-400 text-sm text-center">No products found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {isAdmin && (
        <p className="text-xs text-gray-400 mt-2">Click any price to edit inline. Press Enter or click away to save.</p>
      )}

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
