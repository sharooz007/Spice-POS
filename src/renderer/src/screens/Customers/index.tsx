import { useState, useEffect, type ReactElement, type FormEvent } from 'react'
import { useAppStore } from '../../store/appStore'
import { paiseToCurrency } from '@shared/money'
import type { CustomerRow, PaymentRow, InvoiceRow } from '@shared/types'

type Tab = 'retail' | 'wholesale'

export default function CustomersScreen(): ReactElement {
  const { user } = useAppStore()
  const [tab, setTab] = useState<Tab>('retail')
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [selected, setSelected] = useState<CustomerRow | null>(null)
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [error, setError] = useState('')
  void setError

  async function load(): Promise<void> {
    const res = await window.api.customers.list({ type: tab })
    if (res.ok) setCustomers(res.data)
  }

  async function selectCustomer(c: CustomerRow): Promise<void> {
    setSelected(c)
    setInvoices([]); setPayments([])
    if (tab === 'retail') {
      const res = await window.api.invoiceHistory.search({ customerId: c.id })
      if (res.ok) setInvoices(res.data)
    } else {
      const res = await window.api.customers.listPayments({ customerId: c.id })
      if (res.ok) setPayments(res.data)
    }
  }

  useEffect(() => { load(); setSelected(null); setInvoices([]); setPayments([]) }, [tab])

  function CreateForm(): ReactElement {
    const [name, setName] = useState('')
    const [phone, setPhone] = useState('')
    const [business, setBusiness] = useState('')
    const [gst, setGst] = useState('')
    const [err, setErr] = useState('')

    async function submit(e: FormEvent): Promise<void> {
      e.preventDefault()
      const res = await window.api.customers.create({ type: tab, name, phone, businessName: business, gstNo: gst, userId: user!.id })
      if (!res.ok) { setErr(res.error); return }
      setShowCreate(false); load()
    }

    return (
      <form onSubmit={submit} className="form-panel" style={{marginBottom:"1rem"}}>
        <h3 className="font-semibold text-sm text-gray-800">New {tab === 'retail' ? 'Customer' : 'Party'}</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required
              className="border border-gray-300 rounded px-2 py-1 text-sm" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm" />
          </div>
          {tab === 'wholesale' && <>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Business name</label>
              <input value={business} onChange={(e) => setBusiness(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-sm" />
            </div>
            <div className="flex flex-col gap-1">
              {/* GST number: stored/displayed as text only — no tax math (rules.md #10) */}
              <label className="text-xs font-medium text-gray-600">GST No. (text only)</label>
              <input value={gst} onChange={(e) => setGst(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-sm font-mono" />
            </div>
          </>}
        </div>
        {err && <p className="text-xs text-red-600">{err}</p>}
        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary">Save</button>
          <button type="button" onClick={() => setShowCreate(false)} className="btn btn-secondary">Cancel</button>
        </div>
      </form>
    )
  }

  return (
    <div className="page">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">Customers & Parties</h1>
        <button onClick={() => setShowCreate(true)} className="btn btn-primary">+ Add</button>
      </div>

      <div className="tab-bar" style={{marginBottom:"1rem"}}>
        {(['retail', 'wholesale'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`tab-item ${tab === t ? "active" : ""}`}>
            {t === 'retail' ? 'Retail Customers' : 'Wholesale Parties'}
          </button>
        ))}
      </div>

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      {showCreate && <CreateForm />}

      <div className="flex gap-4">
        {/* Customer list */}
        <div className="w-64 flex-shrink-0">
          {customers.length === 0 && <p className="text-sm text-gray-400">No {tab === 'retail' ? 'customers' : 'parties'} yet.</p>}
          {customers.map((c) => (
            <div key={c.id} onClick={() => selectCustomer(c)}
              className={`px-3 py-2.5 rounded mb-1 cursor-pointer transition-colors ${selected?.id === c.id ? 'list-item active' : 'list-item'}`}>
              <div className="font-medium text-sm">{c.name}</div>
              {c.businessName && <div className={`text-xs ${selected?.id === c.id ? 'text-blue-200' : 'text-gray-500'}`}>{c.businessName}</div>}
              {tab === 'wholesale' && c.creditBalancePaise > 0 && (
                <div className={`text-xs font-semibold ${selected?.id === c.id ? 'text-red-200' : 'text-red-600'}`}>
                  Due: {paiseToCurrency(c.creditBalancePaise)}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Detail */}
        {selected && (
          <div className="card" style={{flex:1,padding:"1.25rem",display:"flex",flexDirection:"column",gap:"1rem"}}>
            <div>
              <h2 className="font-bold text-gray-800">{selected.name}</h2>
              {selected.businessName && <p className="text-sm text-gray-500">{selected.businessName}</p>}
              {selected.phone && <p className="text-sm text-gray-500">{selected.phone}</p>}
              {/* GST shown as plain text — no tax calculation (rules.md #10) */}
              {selected.gstNo && <p className="text-sm text-gray-500">GST: {selected.gstNo}</p>}
              {tab === 'wholesale' && (
                <p className={`text-sm font-semibold mt-1 ${selected.creditBalancePaise > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  Outstanding: {paiseToCurrency(selected.creditBalancePaise)}
                </p>
              )}
            </div>

            {/* Purchase History (retail) or Payment History (wholesale) */}
            {tab === 'retail' ? (
              <div>
                <h3 className="font-semibold text-gray-700 text-sm mb-2">Purchase History</h3>
                {invoices.length === 0
                  ? <p className="text-sm text-gray-400">No purchases recorded yet.</p>
                  : (
                    <table className="w-full text-xs">
                      <thead><tr className="text-left text-gray-500 border-b">
                        <th className="pb-1 pr-3">Invoice No.</th>
                        <th className="pb-1 pr-3">Date</th>
                        <th className="pb-1 pr-3">Total</th>
                        <th className="pb-1 pr-3">Mode</th>
                        <th className="pb-1">Status</th>
                      </tr></thead>
                      <tbody>
                        {invoices.map((inv) => (
                          <tr key={inv.id} className="border-b last:border-0">
                            <td className="py-1.5 pr-3 font-mono">{inv.invoiceNo}</td>
                            <td className="py-1.5 pr-3">{new Date(inv.invoiceDatetime).toLocaleDateString()}</td>
                            <td className="py-1.5 pr-3 font-mono font-semibold">{paiseToCurrency(inv.totalPaise)}</td>
                            <td className="py-1.5 pr-3 text-gray-600">{inv.paymentMode}</td>
                            <td className="py-1.5">
                              <span className={`text-xs px-1.5 py-0.5 rounded-full ${inv.status === 'void' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                {inv.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
              </div>
            ) : (
              <div>
                <h3 className="font-semibold text-gray-700 text-sm mb-2">Payment History</h3>
                {payments.length === 0
                  ? <p className="text-sm text-gray-400">No payments recorded.</p>
                  : (
                    <table className="w-full text-xs">
                      <thead><tr className="text-left text-gray-500 border-b">
                        <th className="pb-1 pr-3">Date</th><th className="pb-1 pr-3">Amount</th>
                        <th className="pb-1 pr-3">Mode</th><th className="pb-1">Notes</th>
                      </tr></thead>
                      <tbody>
                        {payments.map((p) => (
                          <tr key={p.id} className="border-b last:border-0">
                            <td className="py-1.5 pr-3">{p.date}</td>
                            <td className="py-1.5 pr-3 font-mono font-semibold">{paiseToCurrency(p.amountPaise)}</td>
                            <td className="py-1.5 pr-3 text-gray-600">{p.mode}</td>
                            <td className="py-1.5 text-gray-500">{p.notes ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
