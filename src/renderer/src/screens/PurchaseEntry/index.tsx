import { useState, useEffect, type ReactElement, type FormEvent } from 'react'
import { useAppStore } from '../../store/appStore'
import { paiseToCurrency } from '@shared/money'
import type { SupplierRow, PurchaseEntryRow } from '@shared/types'

export default function PurchaseEntryScreen(): ReactElement {
  const { user } = useAppStore()
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([])
  const [purchases, setPurchases] = useState<PurchaseEntryRow[]>([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Selected supplier (-1 means General/No Supplier)
  const [selectedSupplierId, setSelectedSupplierId] = useState<number>(-1)

  // Form state
  const [itemName, setItemName] = useState('')
  const [qty, setQty] = useState('1')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')

  // New Supplier Modal
  const [showNewSupplier, setShowNewSupplier] = useState(false)
  const [newSuppName, setNewSuppName] = useState('')
  const [newSuppPhone, setNewSuppPhone] = useState('')

  async function loadData(): Promise<void> {
    const [sRes, pRes] = await Promise.all([
      window.api.purchases.listSuppliers(),
      window.api.purchases.list()
    ])
    if (sRes.ok) setSuppliers(sRes.data)
    if (pRes.ok) setPurchases(pRes.data)
  }

  useEffect(() => { loadData() }, [])

  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault()
    setError(''); setSuccess('')

    const res = await window.api.purchases.record({
      supplierId: selectedSupplierId === -1 ? undefined : selectedSupplierId,
      itemName, qty: parseInt(qty) || 1,
      amountPaise: Math.round(parseFloat(amount) * 100),
      date, notes: notes.trim() || undefined,
      userId: user!.id
    })
    if (!res.ok) { setError(res.error); return }
    setError('')
    setItemName(''); setQty('1'); setAmount(''); setNotes('')
    setSuccess('Purchase recorded successfully')
    setTimeout(() => setSuccess(''), 3000)
    loadData()
  }

  async function handleAddSupplier(e: FormEvent): Promise<void> {
    e.preventDefault()
    const res = await window.api.purchases.createSupplier({ name: newSuppName, phone: newSuppPhone })
    if (!res.ok) {
      setError(res.error)
      return
    }
    const newId = res.data
    await loadData()
    setSelectedSupplierId(newId)
    setShowNewSupplier(false)
    setNewSuppName('')
    setNewSuppPhone('')
  }

  const selectedSupplierName = selectedSupplierId === -1 
    ? 'General' 
    : suppliers.find(s => s.id === selectedSupplierId)?.name || 'General'

  const filteredPurchases = purchases.filter(p => 
    selectedSupplierId === -1 ? p.supplierId === null : p.supplierId === selectedSupplierId
  )

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
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--ink-1)', letterSpacing: '-0.02em' }}>Purchase Entry</h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--ink-3)', marginTop: '0.125rem' }}>Record purchases (does not affect stock or cost)</p>
        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'clamp(260px, 22%, 320px) 1fr', gap: '1rem',
        flex: 1, minHeight: 0, maxWidth: 1100, width: '100%', margin: '0 auto'
      }}>
        {/* ── Left Sidebar: Suppliers ── */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Suppliers</h2>
            <button onClick={() => setShowNewSupplier(true)} className="btn btn-ghost" style={{ padding: '0.25rem', color: 'var(--accent)' }} title="New Supplier">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
            <button
              onClick={() => { setSelectedSupplierId(-1); setSuccess(''); setError('') }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '0.625rem 0.75rem',
                background: selectedSupplierId === -1 ? 'var(--surface)' : 'transparent',
                border: 'none', borderRadius: 'var(--r)',
                cursor: 'pointer', textAlign: 'left',
                color: selectedSupplierId === -1 ? 'var(--accent)' : 'var(--ink-2)',
                fontWeight: selectedSupplierId === -1 ? 600 : 500,
                fontSize: '0.8125rem', transition: 'all 150ms',
                borderLeft: selectedSupplierId === -1 ? '3px solid var(--accent)' : '3px solid transparent'
              }}
            >
              General (No Supplier)
            </button>
            {suppliers.map((s) => {
              const active = selectedSupplierId === s.id
              return (
                <button
                  key={s.id}
                  onClick={() => { setSelectedSupplierId(s.id); setSuccess(''); setError('') }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '0.625rem 0.75rem',
                    background: active ? 'var(--surface)' : 'transparent',
                    border: 'none', borderRadius: 'var(--r)',
                    cursor: 'pointer', textAlign: 'left',
                    color: active ? 'var(--accent)' : 'var(--ink-2)',
                    fontWeight: active ? 600 : 500,
                    fontSize: '0.8125rem', transition: 'all 150ms',
                    borderLeft: active ? '3px solid var(--accent)' : '3px solid transparent'
                  }}
                >
                  {s.name}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Right Detail ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', paddingRight: '0.25rem' }}>
          {/* Record Form */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--ink-1)', marginBottom: '1rem' }}>Record {selectedSupplierName} Purchase</h2>
            <form onSubmit={submit}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--ink-2)' }}>Item Name *</label>
                  <input value={itemName} onChange={(e) => setItemName(e.target.value)} required
                    style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--ink-1)', borderRadius: 'var(--r)', padding: '0.5rem 0.75rem', fontSize: '0.875rem' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--ink-2)' }}>Date</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required
                    style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--ink-1)', borderRadius: 'var(--r)', padding: '0.5rem 0.75rem', fontSize: '0.875rem' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--ink-2)' }}>Qty</label>
                  <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} required
                    style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--ink-1)', borderRadius: 'var(--r)', padding: '0.5rem 0.75rem', fontSize: '0.875rem' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--ink-2)' }}>Amount (₹) *</label>
                  <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required
                    style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--ink-1)', borderRadius: 'var(--r)', padding: '0.5rem 0.75rem', fontSize: '0.875rem' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--ink-2)' }}>Notes (optional)</label>
                  <input value={notes} onChange={(e) => setNotes(e.target.value)}
                    style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--ink-1)', borderRadius: 'var(--r)', padding: '0.5rem 0.75rem', fontSize: '0.875rem' }} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {error && <span style={{ color: 'var(--red)', fontSize: '0.8125rem' }}>{error}</span>}
                  {success && <span style={{ color: 'var(--green)', fontSize: '0.8125rem' }}>{success}</span>}
                </div>
                <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1.25rem' }}>Record Purchase</button>
              </div>
            </form>
          </div>

          {/* History */}
          <div className="card" style={{ flex: 1, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink-2)' }}>Recent {selectedSupplierName} Purchases</h2>
            {filteredPurchases.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)', fontSize: '0.8125rem', background: 'var(--surface)', borderRadius: 'var(--r)' }}>
                No recent purchases found.
              </div>
            ) : (
              <table style={{ width: '100%', fontSize: '0.8125rem', textAlign: 'left' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '0.5rem 0', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Date</th>
                    <th style={{ padding: '0.5rem 0', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Item</th>
                    <th style={{ padding: '0.5rem 0', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Qty</th>
                    <th style={{ padding: '0.5rem 0', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)', textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPurchases.slice(0, 50).map(p => (
                    <tr key={p.id}>
                      <td style={{ padding: '0.625rem 0', color: 'var(--ink-2)', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)' }}>{p.date}</td>
                      <td style={{ padding: '0.625rem 0', color: 'var(--ink-1)', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ fontWeight: 500 }}>{p.itemName}</div>
                        {p.notes && <div style={{ fontSize: '0.6875rem', color: 'var(--ink-3)', marginTop: '0.125rem' }}>{p.notes}</div>}
                      </td>
                      <td style={{ padding: '0.625rem 0', color: 'var(--ink-1)', borderBottom: '1px solid var(--border)' }}>{p.qty}</td>
                      <td style={{ padding: '0.625rem 0', color: 'var(--ink-1)', borderBottom: '1px solid var(--border)', fontWeight: 600, fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{paiseToCurrency(p.amountPaise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ── New Supplier Modal ── */}
      {showNewSupplier && (
        <div className="modal-overlay" onClick={() => setShowNewSupplier(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--ink-1)', marginBottom: '1rem' }}>New Supplier</h3>
            <form onSubmit={handleAddSupplier} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--ink-2)' }}>Supplier Name *</label>
                <input autoFocus value={newSuppName} onChange={(e) => setNewSuppName(e.target.value)} required
                  style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--ink-1)', borderRadius: 'var(--r)', padding: '0.5rem 0.75rem', fontSize: '0.875rem' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--ink-2)' }}>Phone (optional)</label>
                <input value={newSuppPhone} onChange={(e) => setNewSuppPhone(e.target.value)}
                  style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--ink-1)', borderRadius: 'var(--r)', padding: '0.5rem 0.75rem', fontSize: '0.875rem' }} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowNewSupplier(false)} className="btn btn-secondary" style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}>Save Supplier</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
