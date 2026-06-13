import { useState, type ReactElement, type FormEvent } from 'react'
import { useAppStore } from '../store/appStore'
import { paiseToCurrency } from '@shared/money'
import { businessDate } from '@shared/businessDate'
import type { CustomerRow } from '@shared/types'

interface Props {
  customer: CustomerRow
  onClose: () => void
  onSuccess: () => void
}

const labelStyle: React.CSSProperties = { fontSize: '0.75rem', fontWeight: 500, color: 'var(--ink-3)', marginBottom: 2 }

export default function SettleDueModal({ customer, onClose, onSuccess }: Props): ReactElement {
  const { user } = useAppStore()
  const [amountInput, setAmountInput] = useState('')
  const [mode, setMode] = useState('cash')
  const [date, setDate] = useState(businessDate(new Date()))
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault()
    setError('')
    
    const amountPaise = Math.round(parseFloat(amountInput) * 100)
    if (!amountPaise || amountPaise <= 0) {
      setError('Amount must be greater than zero')
      return
    }

    if (amountPaise > customer.creditBalancePaise) {
      setError(`Cannot repay more than the outstanding balance of ${paiseToCurrency(customer.creditBalancePaise)}`)
      return
    }

    setSubmitting(true)
    const res = await window.api.billing.recordPartyPayment({
      customerId: customer.id,
      amountPaise,
      mode,
      date,
      notes,
      userId: user!.id
    })

    setSubmitting(false)
    if (res.ok) {
      onSuccess()
    } else {
      setError(res.error)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <h3 style={{ fontSize: '0.9375rem', fontWeight: 650, color: 'var(--ink-1)', marginBottom: '1rem' }}>
          Settle Due - {customer.name}
        </h3>
        
        <div style={{ padding: '0.75rem', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.6875rem', color: 'var(--ink-3)' }}>Current Outstanding</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--red)', fontFamily: 'var(--font-mono)' }}>
            {paiseToCurrency(customer.creditBalancePaise)}
          </div>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={labelStyle}>Amount (₹) *</label>
              <input 
                type="number" 
                step="0.01" 
                min="0.01"
                max={customer.creditBalancePaise / 100}
                value={amountInput} 
                onChange={(e) => setAmountInput(e.target.value)} 
                required 
                autoFocus 
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={labelStyle}>Payment Mode *</label>
              <select value={mode} onChange={(e) => setMode(e.target.value)} required>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
              </select>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', gridColumn: 'span 2' }}>
              <label style={labelStyle}>Date (Business Date)</label>
              <input 
                type="date" 
                value={date} 
                onChange={(e) => setDate(e.target.value)} 
                required 
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', gridColumn: 'span 2' }}>
              <label style={labelStyle}>Notes (Optional)</label>
              <input 
                type="text" 
                placeholder="e.g. Bank transfer ref number..."
                value={notes} 
                onChange={(e) => setNotes(e.target.value)} 
              />
            </div>
          </div>

          {error && <p style={{ fontSize: '0.75rem', color: 'var(--red)' }}>{error}</p>}
          
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" disabled={submitting}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
