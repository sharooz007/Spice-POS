import { useState, useEffect, type ReactElement, type FormEvent } from 'react'
import { useAppStore } from '../../store/appStore'
import { paiseToCurrency } from '@shared/money'
import type { CustomerRow, PaymentRow, InvoiceRow } from '@shared/types'
import SettleDueModal from '../../components/SettleDueModal'

type Tab = 'retail' | 'wholesale'

// Shared inline style constants
const labelStyle: React.CSSProperties = { fontSize: '0.75rem', fontWeight: 500, color: 'var(--ink-3)', marginBottom: 2 }

export default function CustomersScreen(): ReactElement {
  const { user } = useAppStore()
  const [tab, setTab] = useState<Tab>('retail')
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [selected, setSelected] = useState<CustomerRow | null>(null)
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [showSettleModal, setShowSettleModal] = useState(false)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  void setError

  async function load(): Promise<void> {
    const res = await window.api.customers.list({ type: tab })
    if (res.ok) setCustomers(res.data)
  }

  async function selectCustomer(c: CustomerRow): Promise<void> {
    setSelected(c)
    setInvoices([]); setPayments([])
    const [invRes, payRes] = await Promise.all([
      window.api.invoiceHistory.search({ customerId: c.id }),
      window.api.customers.listPayments({ customerId: c.id })
    ])
    if (invRes.ok) setInvoices(invRes.data)
    if (payRes.ok) setPayments(payRes.data)
  }

  useEffect(() => { load(); setSelected(null); setInvoices([]); setPayments([]); setSearchQuery('') }, [tab])

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
      <div className="modal-overlay" onClick={() => setShowCreate(false)}>
        <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 650, color: 'var(--ink-1)', marginBottom: '1rem' }}>
            New {tab === 'retail' ? 'Customer' : 'Party'}
          </h3>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', gridColumn: tab === 'retail' ? 'span 2' : 'auto' }}>
                <label style={labelStyle}>Name *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', gridColumn: tab === 'retail' ? 'span 2' : 'auto' }}>
                <label style={labelStyle}>Phone</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              {tab === 'wholesale' && <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', gridColumn: 'span 2' }}>
                  <label style={labelStyle}>Business name</label>
                  <input value={business} onChange={(e) => setBusiness(e.target.value)} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', gridColumn: 'span 2' }}>
                  {/* GST number: stored/displayed as text only — no tax math (rules.md #10) */}
                  <label style={labelStyle}>GST No. (text only)</label>
                  <input value={gst} onChange={(e) => setGst(e.target.value)} style={{ fontFamily: 'var(--font-mono)' }} />
                </div>
              </>}
            </div>
            {err && <p style={{ fontSize: '0.75rem', color: 'var(--red)' }}>{err}</p>}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
              <button type="button" onClick={() => setShowCreate(false)} className="btn btn-secondary">Cancel</button>
              <button type="submit" className="btn btn-primary">Save</button>
            </div>
          </form>
        </div>
      </div>
    )
  }

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
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--ink-1)', letterSpacing: '-0.02em', margin: 0 }}>Customers & Parties</h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--ink-3)', marginTop: '0.125rem' }}>Manage your retail customers and wholesale accounts</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="tab-bar">
            {(['retail', 'wholesale'] as Tab[]).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`tab-item ${tab === t ? "active" : ""}`}>
                {t === 'retail' ? 'Retail Customers' : 'Wholesale Parties'}
              </button>
            ))}
          </div>
          <button onClick={() => setShowCreate(true)} className="btn btn-primary">+ Add</button>
        </div>
      </div>

      {error && <p style={{ fontSize: '0.8125rem', color: 'var(--red)', maxWidth: 1100, width: '100%', margin: '0 auto' }}>{error}</p>}
      {showCreate && <CreateForm />}
      {showSettleModal && selected && (
        <SettleDueModal
          customer={selected}
          onClose={() => setShowSettleModal(false)}
          onSuccess={() => {
            setShowSettleModal(false)
            load()
            // reload selected customer data to reflect new balance and payments
            const updated = customers.find(c => c.id === selected.id)
            if (updated) {
              // But 'customers' is stale right now.
              // Just call selectCustomer with selected, wait, we need fresh customer data.
              // So re-fetch customer or just reload list and re-select.
              window.api.customers.get({ id: selected.id }).then(res => {
                if (res.ok && res.data) selectCustomer(res.data)
              })
            }
          }}
        />
      )}

      {/* ── Main content: master-detail ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: selected ? 'clamp(260px, 22%, 320px) 1fr' : '1fr',
        gap: '0.75rem', flex: 1, minHeight: 0, overflow: 'hidden',
        maxWidth: 1100, width: '100%', margin: '0 auto',
      }}>
        {/* ── Left: Customer list ── */}
        <div className="card" style={{
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          borderRadius: 'var(--r-lg)', minHeight: 0,
          ...(selected ? {} : { maxWidth: 380, margin: '0 auto', width: '100%' }),
        }}>
          <div style={{
            padding: '0.75rem 0.875rem', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span className="section-label" style={{ margin: 0, padding: 0 }}>{tab === 'retail' ? 'Customers' : 'Parties'}</span>
          </div>
          <div style={{ padding: '0.5rem 0.875rem', borderBottom: '1px solid var(--border)' }}>
            <input 
              type="text" 
              placeholder={`Search ${tab === 'retail' ? 'customers' : 'parties'}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', fontSize: '0.8125rem' }}
            />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '0.25rem 0' }}>
            {customers.length === 0 && (
              <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink-2)' }}>No {tab === 'retail' ? 'customers' : 'parties'}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--ink-3)', marginTop: 2 }}>Click Add to create one</div>
              </div>
            )}
            {customers.filter(c => 
              c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
              (c.phone && c.phone.includes(searchQuery)) ||
              (c.businessName && c.businessName.toLowerCase().includes(searchQuery.toLowerCase()))
            ).sort((a, b) => a.name.localeCompare(b.name)).map((c) => {
              const isSelected = selected?.id === c.id
              return (
                <div key={c.id} onClick={() => selectCustomer(c)}
                  style={{
                    padding: '0.5rem 0.875rem', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', gap: '0.125rem',
                    background: isSelected ? 'var(--accent-soft)' : 'transparent',
                    borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
                    transition: 'background 80ms ease, border-color 80ms ease',
                  }}
                  onMouseEnter={(e) => { if (!isSelected) (e.currentTarget.style.background = 'var(--bg-fill)') }}
                  onMouseLeave={(e) => { if (!isSelected) (e.currentTarget.style.background = 'transparent') }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: isSelected ? 600 : 500, color: isSelected ? 'var(--accent)' : 'var(--ink-1)' }}>
                    {c.name}
                  </div>
                  {c.businessName && <div style={{ fontSize: '0.6875rem', color: isSelected ? 'oklch(0.65 0.12 260)' : 'var(--ink-4)' }}>{c.businessName}</div>}
                  {c.creditBalancePaise > 0 && (
                    <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: isSelected ? 'var(--red)' : 'var(--red)', marginTop: '0.125rem', fontFamily: 'var(--font-mono)' }}>
                      Due: {paiseToCurrency(c.creditBalancePaise)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Right: Detail panel ── */}
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', paddingRight: '0.25rem' }}>
            <div className="card" style={{ padding: '1.25rem', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--ink-1)', letterSpacing: '-0.01em', margin: 0 }}>{selected.name}</h2>
                  {selected.businessName && <p style={{ fontSize: '0.8125rem', color: 'var(--ink-3)', marginTop: '0.25rem' }}>{selected.businessName}</p>}
                  
                  <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem' }}>
                    {selected.phone && (
                      <div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--ink-3)' }}>Phone</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--ink-1)' }}>{selected.phone}</div>
                      </div>
                    )}
                    {selected.gstNo && (
                      <div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--ink-3)' }}>GST</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--ink-1)', fontFamily: 'var(--font-mono)' }}>{selected.gstNo}</div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <div style={{ textAlign: 'right', background: 'var(--bg-surface)', padding: '0.75rem 1rem', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 500, color: 'var(--ink-3)' }}>Total Purchases</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--ink-1)', marginTop: '0.125rem' }}>
                      {paiseToCurrency(invoices.reduce((sum, inv) => sum + (inv.status === 'active' ? inv.totalPaise : 0), 0))}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', background: 'var(--bg-surface)', padding: '0.75rem 1rem', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 500, color: 'var(--ink-3)' }}>Outstanding Balance</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: selected.creditBalancePaise > 0 ? 'var(--red)' : 'var(--green)', marginTop: '0.125rem' }}>
                      {paiseToCurrency(selected.creditBalancePaise)}
                    </div>
                    {selected.creditBalancePaise > 0 && (
                      <button 
                        onClick={() => setShowSettleModal(true)}
                        style={{ marginTop: '0.5rem', width: '100%', background: 'var(--ink-1)', color: 'var(--bg-base)', border: 'none', borderRadius: 'var(--r-sm)', padding: '0.375rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Settle Due
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Purchase and Payment History */}
            <div className="card" style={{ padding: '1.25rem', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 650, color: 'var(--ink-1)', marginBottom: '0.75rem' }}>Purchase History</h3>
                {invoices.length === 0 ? (
                  <p style={{ fontSize: '0.8125rem', color: 'var(--ink-4)' }}>No purchases recorded yet.</p>
                ) : (
                  <table style={{ width: '100%', fontSize: '0.8125rem', textAlign: 'left' }}>
                    <thead>
                      <tr>
                        <th style={{ paddingBottom: '0.5rem', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Invoice No.</th>
                        <th style={{ paddingBottom: '0.5rem', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Date</th>
                        <th style={{ paddingBottom: '0.5rem', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Total</th>
                        <th style={{ paddingBottom: '0.5rem', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Mode</th>
                        <th style={{ paddingBottom: '0.5rem', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv) => (
                        <tr key={inv.id}>
                          <td style={{ padding: '0.625rem 0', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)', color: 'var(--ink-2)' }}>{inv.invoiceNo}</td>
                          <td style={{ padding: '0.625rem 0', borderBottom: '1px solid var(--border)', color: 'var(--ink-2)' }}>{new Date(inv.invoiceDatetime).toLocaleDateString()}</td>
                          <td style={{ padding: '0.625rem 0', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ink-1)' }}>{paiseToCurrency(inv.totalPaise)}</td>
                          <td style={{ padding: '0.625rem 0', borderBottom: '1px solid var(--border)', color: 'var(--ink-3)' }}>{inv.paymentMode}</td>
                          <td style={{ padding: '0.625rem 0', borderBottom: '1px solid var(--border)' }}>
                            <span style={{
                              fontSize: '0.6875rem', fontWeight: 500, padding: '0.125rem 0.5rem', borderRadius: 'var(--r-full)',
                              background: inv.status === 'void' ? 'oklch(0.24 0.065 25)' : 'oklch(0.25 0.07 145)',
                              color: inv.status === 'void' ? 'var(--red)' : 'var(--green)'
                            }}>
                              {inv.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 650, color: 'var(--ink-1)', marginBottom: '0.75rem' }}>Payment History</h3>
                {payments.length === 0 ? (
                  <p style={{ fontSize: '0.8125rem', color: 'var(--ink-4)' }}>No payments recorded.</p>
                ) : (
                  <table style={{ width: '100%', fontSize: '0.8125rem', textAlign: 'left' }}>
                    <thead>
                      <tr>
                        <th style={{ paddingBottom: '0.5rem', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Date</th>
                        <th style={{ paddingBottom: '0.5rem', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Amount</th>
                        <th style={{ paddingBottom: '0.5rem', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Mode</th>
                        <th style={{ paddingBottom: '0.5rem', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p) => (
                        <tr key={p.id}>
                          <td style={{ padding: '0.625rem 0', borderBottom: '1px solid var(--border)', color: 'var(--ink-2)' }}>{p.date}</td>
                          <td style={{ padding: '0.625rem 0', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--green)' }}>{paiseToCurrency(p.amountPaise)}</td>
                          <td style={{ padding: '0.625rem 0', borderBottom: '1px solid var(--border)', color: 'var(--ink-3)' }}>{p.mode}</td>
                          <td style={{ padding: '0.625rem 0', borderBottom: '1px solid var(--border)', color: 'var(--ink-4)' }}>{p.notes ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
