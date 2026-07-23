// @ts-nocheck
import { useState, useEffect, type ReactElement, type FormEvent } from 'react'
import { useAppStore } from '../../store/appStore'
import { paiseToCurrency } from '@shared/money'
import type { Product } from '@shared/types'

const labelStyle: React.CSSProperties = { fontSize: '0.75rem', fontWeight: 500, color: 'var(--ink-3)', marginBottom: 4, display: 'block' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '0.5rem', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink-1)', fontSize: '0.875rem' }

export default function OutsideProductsScreen(): ReactElement {
  const { user } = useAppStore()
  
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [selectedVariantId, setSelectedVariantId] = useState<string>('')
  
  const [qtyStr, setQtyStr] = useState('')
  const [costStr, setCostStr] = useState('')
  const [notes, setNotes] = useState('')
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function loadData() {
    const res = await window.api.products.listProducts()
    if (res.ok) setProducts(res.data)
  }

  useEffect(() => { loadData() }, [])

  const selectedProduct = products.find((p) => p.id === selectedProductId)
  const variants = selectedProduct ? selectedProduct.variants.filter((v) => v.enabled) : []

  // Reset variant selection if product changes
  useEffect(() => {
    if (variants.length > 0 && !variants.find(v => v.id === selectedVariantId)) {
      setSelectedVariantId(variants[0].id)
    } else if (variants.length === 0) {
      setSelectedVariantId('')
    }
  }, [selectedProductId, variants])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!selectedVariantId) {
      setError('Please select a variant')
      return
    }
    
    const qtyPcs = parseInt(qtyStr)
    const costPerPcPaise = Math.round(parseFloat(costStr) * 100)
    
    if (isNaN(qtyPcs) || qtyPcs <= 0) {
      setError('Quantity must be greater than zero')
      return
    }
    
    if (isNaN(costPerPcPaise) || costPerPcPaise < 0) {
      setError('Cost must be a valid number (>= 0)')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')
    
    const res = await window.api.retailInventory.addOutsideStock({
      variantId: selectedVariantId,
      qtyPcs,
      costPerPcPaise,
      userId: user!.id,
      notes: notes.trim() || undefined
    })
    
    setLoading(false)
    
    if (res.ok) {
      setSuccess(`Successfully added ${qtyPcs} pcs to retail inventory!`)
      setQtyStr('')
      setCostStr('')
      setNotes('')
    } else {
      setError(res.error)
    }
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--ink-1)', margin: 0 }}>Outside Products</h1>
      </div>
      
      <p style={{ color: 'var(--ink-2)', fontSize: '0.875rem' }}>
        Add pre-packaged or third-party items directly into retail inventory. This skips the bulk inventory and packing workflow.
      </p>

      {success && (
        <div style={{ padding: '0.75rem', borderRadius: 'var(--r-md)', background: 'oklch(0.95 0.1 145)', color: 'oklch(0.3 0.1 145)', fontSize: '0.875rem', fontWeight: 500 }}>
          {success}
        </div>
      )}
      
      {error && (
        <div style={{ padding: '0.75rem', borderRadius: 'var(--r-md)', background: 'var(--red-light)', color: 'var(--red)', fontSize: '0.875rem', fontWeight: 500 }}>
          {error}
        </div>
      )}

      <form onSubmit={submit} className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Product</label>
            <select style={inputStyle} value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)} required>
              <option value="" disabled>Select product...</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label style={labelStyle}>Variant</label>
            <select style={inputStyle} value={selectedVariantId} onChange={e => setSelectedVariantId(e.target.value)} required disabled={!selectedProductId}>
              <option value="" disabled>Select variant...</option>
              {variants.map(v => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Quantity (Pieces)</label>
            <input 
              style={inputStyle}
              type="number"
              min="1"
              step="1"
              value={qtyStr}
              onChange={e => setQtyStr(e.target.value)}
              placeholder="e.g. 10"
              required
            />
          </div>
          
          <div>
            <label style={labelStyle}>Purchase Cost Per Piece (₹)</label>
            <input 
              style={inputStyle}
              type="number"
              min="0"
              step="0.01"
              value={costStr}
              onChange={e => setCostStr(e.target.value)}
              placeholder="e.g. 15.50"
              required
            />
          </div>
        </div>
        
        <div>
          <label style={labelStyle}>Notes (Optional)</label>
          <input 
            style={inputStyle}
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Invoice # or Supplier info"
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Adding...' : 'Add to Retail Inventory'}
          </button>
        </div>
      </form>
      
    </div>
  )
}
