import { useState, useEffect, useRef, type ReactElement } from 'react'
import { paiseToCurrency } from '@shared/money'
import type { CustomerRow } from '@shared/types'

interface Props {
  type: 'retail' | 'wholesale'
  name: string
  phone: string
  onNameChange: (name: string) => void
  onPhoneChange: (phone: string) => void
  onSelect: (customer: CustomerRow) => void
  onClearSelection: () => void
  nameLabel?: string
}

export default function CustomerAutocomplete({
  type, name, phone, onNameChange, onPhoneChange, onSelect, onClearSelection, nameLabel = 'Customer'
}: Props): ReactElement {
  const [allCustomers, setAllCustomers] = useState<CustomerRow[]>([])
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.api.customers.list({ type }).then((r) => { if (r.ok) setAllCustomers(r.data) })
  }, [type])

  useEffect(() => {
    function onDocClick(e: MouseEvent): void {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const query = name.trim().toLowerCase()
  const suggestions = query.length >= 2
    ? allCustomers.filter((c) => c.name.toLowerCase().startsWith(query)).slice(0, 8)
    : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ position: 'relative' }} ref={wrapRef}>
        <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--ink-3)', display: 'block', marginBottom: '0.25rem' }}>
          {nameLabel}
        </label>
        <input
          value={name}
          onChange={(e) => { onNameChange(e.target.value); onClearSelection(); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Type a name..."
          autoComplete="off"
        />
        {open && suggestions.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 50,
            background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
            boxShadow: 'var(--shadow-md)', maxHeight: 192, overflowY: 'auto',
          }}>
            {suggestions.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { onSelect(c); setOpen(false) }}
                style={{
                  width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem', background: 'none', border: 'none',
                  cursor: 'pointer', borderBottom: '1px solid var(--border)', display: 'block',
                  transition: 'background 80ms ease',
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-fill)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'none')}
              >
                <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--ink-1)' }}>{c.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--ink-3)', marginTop: 1 }}>
                  {c.phone || 'No phone'}
                  {type === 'wholesale' && c.creditBalancePaise > 0 && (
                    <span style={{ marginLeft: 8, color: 'var(--red)' }}>Due {paiseToCurrency(c.creditBalancePaise)}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--ink-3)', display: 'block', marginBottom: '0.25rem' }}>
          Phone
        </label>
        <input type="tel" value={phone} onChange={(e) => onPhoneChange(e.target.value)} placeholder="Optional" />
      </div>
    </div>
  )
}
