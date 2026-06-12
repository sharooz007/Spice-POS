import { useState, useEffect, useRef, type ReactElement } from 'react'
import type { CustomerRow } from '@shared/types'

interface Props {
  type: 'retail' | 'wholesale'
  name: string
  phone: string
  onNameChange: (name: string) => void
  onPhoneChange: (phone: string) => void
  /** Called when an existing customer is picked. Parent should store id + whether phone was blank. */
  onSelect: (customer: CustomerRow) => void
  /** Called when the name is edited manually (clears any prior selection). */
  onClearSelection: () => void
  nameLabel?: string
}

export default function CustomerAutocomplete({
  type, name, phone, onNameChange, onPhoneChange, onSelect, onClearSelection,
  nameLabel = 'Customer Name'
}: Props): ReactElement {
  const [allCustomers, setAllCustomers] = useState<CustomerRow[]>([])
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Load customer list once (and on type change)
  useEffect(() => {
    window.api.customers.list({ type }).then((r) => { if (r.ok) setAllCustomers(r.data) })
  }, [type])

  // Close on outside click
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

  function pick(c: CustomerRow): void {
    onSelect(c)
    setOpen(false)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1 relative" ref={wrapRef}>
        <label className="text-xs font-medium text-gray-600">{nameLabel}</label>
        <input
          value={name}
          onChange={(e) => {
            onNameChange(e.target.value)
            onClearSelection()
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Type a name…"
          className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
          autoComplete="off"
        />
        {open && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
            {suggestions.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => pick(c)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 cursor-pointer border-b last:border-0"
              >
                <div className="font-medium text-gray-800">{c.name}</div>
                <div className="text-xs text-gray-400">
                  {c.phone || 'no phone'}
                  {type === 'wholesale' && c.creditBalancePaise > 0 && (
                    <span className="ml-2 text-red-500">due ₹{(c.creditBalancePaise / 100).toFixed(2)}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">Customer Phone</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          placeholder="Optional"
          className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
      </div>
    </div>
  )
}
