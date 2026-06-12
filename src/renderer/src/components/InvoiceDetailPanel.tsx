import { useState, useEffect, type ReactElement, type FormEvent } from 'react'
import { useAppStore } from '../store/appStore'
import { paiseToCurrency } from '@shared/money'
import CustomerAutocomplete from './CustomerAutocomplete'
import type { InvoiceRow, EditLogRow, CustomerRow } from '@shared/types'

interface Props {
  invoiceId: number
  onUpdated?: () => void // called after void/edit so parent can refresh its list
}

export default function InvoiceDetailPanel({ invoiceId, onUpdated }: Props): ReactElement {
  const { user } = useAppStore()
  const isAdmin = user?.role === 'admin'

  const [inv, setInv] = useState<InvoiceRow | null>(null)
  const [editLog, setEditLog] = useState<EditLogRow[]>([])
  const [loading, setLoading] = useState(true)

  const [showVoidConfirm, setShowVoidConfirm] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [actionError, setActionError] = useState('')

  // Edit form state
  const [editDtStr, setEditDtStr] = useState('')
  const [editAmountStr, setEditAmountStr] = useState('')
  const [editCustomerName, setEditCustomerName] = useState('')
  const [editCustomerPhone, setEditCustomerPhone] = useState('')
  const [editCustomerId, setEditCustomerId] = useState<number | null>(null)
  const [editCustomerHadBlankPhone, setEditCustomerHadBlankPhone] = useState(false)

  async function load(id: number): Promise<void> {
    setLoading(true)
    const [invRes, logRes] = await Promise.all([
      window.api.invoiceHistory.getInvoice({ invoiceId: id }),
      window.api.invoiceHistory.getEditLog({ invoiceId: id })
    ])
    if (invRes.ok && invRes.data) {
      const i = invRes.data
      setInv(i)
      setEditDtStr(new Date(i.invoiceDatetime).toISOString().slice(0, 16))
      setEditAmountStr((i.amountPaidPaise / 100).toFixed(2))
      setEditCustomerName(i.customerName ?? '')
      setEditCustomerPhone('')
      setEditCustomerId(i.customerId)
      setEditCustomerHadBlankPhone(false)
    }
    if (logRes.ok) setEditLog(logRes.data)
    setLoading(false)
  }

  useEffect(() => { load(invoiceId) }, [invoiceId])

  async function handleVoid(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (!inv) return
    const res = await window.api.invoiceHistory.void({ invoiceId: inv.id, userId: user!.id })
    if (!res.ok) { setActionError(res.error); return }
    setShowVoidConfirm(false); setActionError('')
    await load(invoiceId)
    onUpdated?.()
  }

  async function handleEditInvoice(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (!inv) return
    const req: Parameters<typeof window.api.invoiceHistory.updateDetails>[0] = {
      invoiceId: inv.id, userId: user!.id
    }
    const newMs = new Date(editDtStr).getTime()
    if (!isNaN(newMs) && newMs !== inv.invoiceDatetime) req.newDatetime = newMs
    const newAmount = Math.round((parseFloat(editAmountStr) || 0) * 100)
    if (newAmount !== inv.amountPaidPaise) req.amountPaidPaise = newAmount
    if (editCustomerId !== null && editCustomerId !== inv.customerId) req.customerId = editCustomerId
    else if (editCustomerId === null && inv.customerId !== null) req.customerId = null
    else if (!editCustomerId && editCustomerName.trim()) {
      req.customerName = editCustomerName.trim()
      req.customerPhone = editCustomerPhone.trim() || undefined
    }
    if (editCustomerId && editCustomerHadBlankPhone && editCustomerPhone.trim()) {
      req.customerId = editCustomerId; req.customerPhone = editCustomerPhone.trim()
    }
    const res = await window.api.invoiceHistory.updateDetails(req)
    if (!res.ok) { setActionError(res.error); return }
    setShowEdit(false); setActionError('')
    await load(invoiceId)
    onUpdated?.()
  }

  function onSelectEditCustomer(c: CustomerRow): void {
    setEditCustomerId(c.id); setEditCustomerName(c.name)
    setEditCustomerPhone(c.phone ?? ''); setEditCustomerHadBlankPhone(!c.phone)
  }

  function waLink(i: InvoiceRow): string {
    return `https://wa.me/?text=${encodeURIComponent([`Invoice ${i.invoiceNo}`, `Total: ${paiseToCurrency(i.totalPaise)}`].join(' | '))}`
  }

  if (loading) return <div className="p-4 text-sm text-gray-400">Loading…</div>
  if (!inv) return <div className="p-4 text-sm text-red-500">Invoice not found.</div>

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div>
        <div className="font-bold text-gray-800 font-mono">{inv.invoiceNo}</div>
        <div className="text-xs text-gray-500 mt-0.5">Business date: {inv.businessDate}</div>
        <div className="text-xs text-gray-400">Invoice time: {new Date(inv.invoiceDatetime).toLocaleString()}</div>
        <div className="text-xs text-gray-600 mt-1 flex flex-col gap-0.5">
          <span>Customer: <span className="font-medium">{inv.customerName ?? 'Walk-in'}</span></span>
          <span>Payment: <span className="font-medium capitalize">{inv.paymentMode}</span></span>
          {inv.paymentSplit?.map((s, i) => (
            <span key={i} className="ml-3 text-gray-500">
              {s.mode.charAt(0).toUpperCase() + s.mode.slice(1)}: {paiseToCurrency(s.amount)}
            </span>
          ))}
          <span>Paid: <span className="font-medium">{paiseToCurrency(inv.amountPaidPaise)}</span>
            {inv.balanceDuePaise > 0 && <span className="text-red-600 ml-1">· Due: {paiseToCurrency(inv.balanceDuePaise)}</span>}
          </span>
        </div>
      </div>

      {/* Lines */}
      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Lines</div>
        {inv.lines.map((l, i) => {
          const label = l.itemType === 'packet'
            ? `${l.productName ?? ''} ${l.variantLabel ?? ''}`.trim()
            : `${l.productName ?? 'Product'} (Loose)`
          const qtyDisplay = l.unit === 'grams' ? `${(l.qty / 1000).toFixed(3)} kg` : `${l.qty} pcs`
          const rateDisplay = l.unit === 'grams' ? `${paiseToCurrency(l.unitPricePaise)}/kg` : paiseToCurrency(l.unitPricePaise)
          return (
            <div key={i} className="flex justify-between text-xs py-0.5 gap-2">
              <span className="text-gray-700 flex-1">
                {label || l.itemType}
                <span className="text-gray-400 ml-1">{qtyDisplay} × {rateDisplay}</span>
              </span>
              <span className="font-mono whitespace-nowrap">{paiseToCurrency(l.lineTotalPaise)}</span>
            </div>
          )
        })}
        <div className="border-t mt-1 pt-1 flex flex-col gap-0.5 text-xs">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span><span className="font-mono">{paiseToCurrency(inv.subtotalPaise)}</span>
          </div>
          {inv.discountPaise > 0 && (
            <div className="flex justify-between text-gray-500">
              <span>Discount</span><span className="font-mono text-red-500">−{paiseToCurrency(inv.discountPaise)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-sm border-t mt-0.5 pt-0.5">
            <span>Total</span><span className="font-mono">{paiseToCurrency(inv.totalPaise)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      {isAdmin && inv.status === 'active' && (
        <div className="flex flex-col gap-2">
          <button onClick={() => window.api.print.receipt({ invoiceId: inv.id })}
            className="px-3 py-1.5 border rounded text-sm cursor-pointer hover:bg-gray-50 transition-colors">
            Reprint Receipt
          </button>
          <button onClick={() => window.open(waLink(inv), '_blank')}
            className="px-3 py-1.5 border rounded text-sm cursor-pointer hover:bg-gray-50 text-center transition-colors">
            Share WhatsApp
          </button>
          <button onClick={() => { setShowEdit(true); setShowVoidConfirm(false); setActionError('') }}
            className="px-3 py-1.5 border border-amber-300 bg-amber-50 text-amber-800 rounded text-sm cursor-pointer hover:bg-amber-100 transition-colors">
            Edit Invoice
          </button>
          <button onClick={() => { setShowVoidConfirm(true); setShowEdit(false); setActionError('') }}
            className="px-3 py-1.5 border border-red-300 bg-red-50 text-red-700 rounded text-sm cursor-pointer hover:bg-red-100 transition-colors">
            Void Invoice
          </button>
        </div>
      )}

      {/* Edit Invoice form */}
      {showEdit && isAdmin && (
        <form onSubmit={handleEditInvoice} className="flex flex-col gap-2 border border-amber-200 bg-amber-50 rounded p-3">
          <p className="text-xs text-amber-800 font-medium">Edit Invoice — items and totals are unchanged.</p>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Date / Time</label>
            <input type="datetime-local" value={editDtStr} onChange={(e) => setEditDtStr(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Amount Paid (₹)</label>
            <input type="number" step="0.01" min="0" value={editAmountStr}
              onChange={(e) => setEditAmountStr(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm" />
          </div>
          <CustomerAutocomplete
            type={inv.type as 'retail' | 'wholesale'}
            name={editCustomerName} phone={editCustomerPhone}
            onNameChange={setEditCustomerName} onPhoneChange={setEditCustomerPhone}
            onSelect={onSelectEditCustomer}
            onClearSelection={() => { setEditCustomerId(null); setEditCustomerHadBlankPhone(false) }}
            nameLabel="Customer"
          />
          {actionError && <p className="text-xs text-red-600">{actionError}</p>}
          <div className="flex gap-2">
            <button type="submit" className="bg-amber-600 text-white px-3 py-1 rounded text-sm cursor-pointer">Save</button>
            <button type="button" onClick={() => { setShowEdit(false); setActionError('') }}
              className="px-3 py-1 border rounded text-sm cursor-pointer">Cancel</button>
          </div>
        </form>
      )}

      {/* Void confirm */}
      {showVoidConfirm && isAdmin && (
        <form onSubmit={handleVoid} className="flex flex-col gap-2 border border-red-200 bg-red-50 rounded p-3">
          <p className="text-xs text-red-800">Void this invoice? This is a status change only — stock is not reversed.</p>
          {actionError && <p className="text-xs text-red-600">{actionError}</p>}
          <div className="flex gap-2">
            <button type="submit" className="bg-red-600 text-white px-3 py-1 rounded text-sm cursor-pointer">Confirm Void</button>
            <button type="button" onClick={() => setShowVoidConfirm(false)} className="px-3 py-1 border rounded text-sm cursor-pointer">Cancel</button>
          </div>
        </form>
      )}

      {/* Date/Time edit log */}
      {editLog.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Date/Time Edit Log</div>
          {editLog.map((l) => (
            <div key={l.id} className="text-xs text-gray-500 py-0.5">
              {new Date(l.editedAt).toLocaleString()}: {new Date(l.oldDatetime).toLocaleString()} → {new Date(l.newDatetime).toLocaleString()}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
