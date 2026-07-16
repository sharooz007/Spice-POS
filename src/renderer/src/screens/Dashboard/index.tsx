// @ts-nocheck
import { useState, useEffect, type ReactElement } from 'react'
import { useAppStore } from '../../store/appStore'
import { paiseToCurrency } from '@shared/money'
import { businessDate } from '@shared/businessDate'
import InvoiceDetailPanel from '../../components/InvoiceDetailPanel'
import ExpenseDetailModal from '../../components/ExpenseDetailModal'
import { PaymentMethodChart } from '../../components/Charts'
import type { DailySalesRow, ExpenseRow, InvoiceRow, PaymentBreakdownRow } from '@shared/types'

// ── Mini stat card ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }): ReactElement {
  return (
    <div style={{
      background: accent ? 'var(--accent)' : 'var(--bg-surface)',
      border: accent ? 'none' : '1px solid var(--border)',
      borderRadius: 'var(--r-lg)',
      padding: '1rem 1.25rem',
      boxShadow: accent ? '0 4px 16px oklch(0.58 0.2 260 / 0.22)' : 'var(--shadow-xs)',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.25rem',
    }}>
      <span style={{ fontSize: '0.75rem', fontWeight: 500, color: accent ? 'oklch(1 0 0 / 0.72)' : 'var(--ink-3)' }}>
        {label}
      </span>
      <span style={{ fontSize: '1.375rem', fontWeight: 700, color: accent ? '#fff' : 'var(--ink-1)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
      {sub && <span style={{ fontSize: '0.75rem', color: accent ? 'oklch(1 0 0 / 0.6)' : 'var(--ink-3)' }}>{sub}</span>}
    </div>
  )
}

// ── Section heading ───────────────────────────────────────────────────────────

function SectionHead({ title }: { title: string }): ReactElement {
  return (
    <h2 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-2)', marginBottom: '0.75rem', letterSpacing: '0.005em' }}>
      {title}
    </h2>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function DashboardScreen(): ReactElement {
  const { navigate } = useAppStore()
  const today = businessDate(new Date())

  const [sales, setSales] = useState<DailySalesRow | null>(null)
  const [todayExpenses, setTodayExpenses] = useState<ExpenseRow[]>([])
  const [recentInvoices, setRecentInvoices] = useState<InvoiceRow[]>([])
  const [recentExpenses, setRecentExpenses] = useState<ExpenseRow[]>([])
  const [paymentBreakdown, setPaymentBreakdown] = useState<PaymentBreakdownRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalInvoiceId, setModalInvoiceId] = useState<string | null>(null)
  const [modalExpense, setModalExpense] = useState<ExpenseRow | null>(null)

  // Sync state
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null)
  const [hasRemoteChanges, setHasRemoteChanges] = useState<boolean>(false)
  const [isSyncing, setIsSyncing] = useState<boolean>(false)

  async function fetchSyncState() {
    try {
      const [timeRes, remoteRes] = await Promise.all([
        window.api.sync.getLastSyncTime(),
        window.api.sync.checkRemoteState(),
      ])
      if (timeRes.ok) setLastSyncTime(timeRes.data)
      if (remoteRes.ok) setHasRemoteChanges(remoteRes.data.outOfSync)
    } catch (err) {
      console.error(err)
    }
  }

  async function loadData(): Promise<void> {
    const [sRes, eRes, invRes, expRes, paymentRes] = await Promise.all([
      window.api.reports.dailySales({ dateFrom: today, dateTo: today }),
      window.api.expenses.list({ dateFrom: today, dateTo: today }),
      window.api.invoiceHistory.search({}),
      window.api.expenses.list(),
      window.api.reports.paymentBreakdown({ dateFrom: today, dateTo: today }),
    ])
    if (sRes.ok) setSales(sRes.data[0] ?? null)
    if (eRes.ok) setTodayExpenses(eRes.data)
    if (invRes.ok) console.log("INVOICES FROM BACKEND:", invRes.data); setRecentInvoices(invRes.data.slice(0, 10))
    if (expRes.ok) setRecentExpenses(expRes.data.slice(0, 5))
    if (paymentRes.ok) setPaymentBreakdown(paymentRes.data)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    fetchSyncState()
    const interval = setInterval(fetchSyncState, 3 * 60 * 1000)
    return () => clearInterval(interval)
  }, [today])

  const expensesTotal = todayExpenses.reduce((s, e) => s + e.amountPaise, 0)
  const paymentMethods = paymentBreakdown ? [
    { label: 'Cash', value: paymentBreakdown.cash, count: paymentBreakdown.cashCount, color: 'var(--green)' },
    { label: 'UPI', value: paymentBreakdown.upi, count: paymentBreakdown.upiCount, color: 'var(--accent)' },
    { label: 'Card', value: paymentBreakdown.card, count: paymentBreakdown.cardCount, color: 'var(--purple)' },
    ...(paymentBreakdown.credit > 0 || paymentBreakdown.creditCount > 0
      ? [{ label: 'Credit', value: paymentBreakdown.credit, count: paymentBreakdown.creditCount, color: 'var(--red)' }]
      : []),
    ...(paymentBreakdown.creditRepaid !== ''
      ? [{ label: 'Repaid', value: paymentBreakdown.creditRepaid, count: 0, color: 'var(--amber)' }]
      : []),
  ] : []

  const page: React.CSSProperties = {
    maxWidth: 960,
    margin: '0 auto',
    padding: '1.75rem 1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '2rem',
  }

  return (
    <div style={page}>

      {/* Page header */}
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink-1)' }}>
          Dashboard
        </h1>
        <p style={{ fontSize: '0.8125rem', color: 'var(--ink-3)', marginTop: '0.125rem' }}>
          {today} · {new Date().toLocaleDateString('en-IN', { weekday: 'long' })}
        </p>
      </div>

      {/* Stat row */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{ height: 84, borderRadius: 'var(--r-lg)', background: 'var(--bg-fill)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' }}>
          <StatCard label="Retail" value={paiseToCurrency(sales?.retailTotalPaise ?? 0)} />
          <StatCard label="Wholesale" value={paiseToCurrency(sales?.wholesaleTotalPaise ?? 0)} />
          <StatCard label="Combined" value={paiseToCurrency(sales?.combinedTotalPaise ?? 0)} accent />
          <StatCard label="Invoices" value={String(sales?.invoiceCount ?? 0)} sub="today" />
          <StatCard label="Expenses" value={paiseToCurrency(expensesTotal)} />
        </div>
      )}

      {/* Payment breakdown */}
      {!loading && paymentBreakdown && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <SectionHead title="Payment Breakdown" />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.125rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>
                Collected: <strong style={{ color: 'var(--green)' }}>{paiseToCurrency(paymentBreakdown.total)}</strong>
              </span>
              {paymentBreakdown.creditRepaid !== '' && (
                <span style={{ fontSize: '0.6875rem', color: 'var(--ink-4)' }}>
                  (Includes {paiseToCurrency(paymentBreakdown.creditRepaid)} from past dues)
                </span>
              )}
            </div>
          </div>
          <div className="card" style={{ padding: '1rem 1.25rem' }}>
            <PaymentMethodChart data={paymentMethods} height={150} />
          </div>
        </div>
      )}

      {/* Quick actions */}
      {(() => {
        const actions: Array<{ label: string; action: () => void; icon: ReactElement; primary?: boolean; highlight?: boolean; subtext?: string }> = [
          {
            label: 'Retail',
            action: () => navigate('RetailBilling'),
            primary: true,
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
            )
          },
          {
            label: 'Wholesale',
            action: () => navigate('WholesaleBilling'),
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
              </svg>
            )
          },
          {
            label: 'Packing',
            action: () => navigate('Packing'),
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
                <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
              </svg>
            )
          },
          {
            label: 'Expenses',
            action: () => navigate('Expenses'),
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
                <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            )
          },
          {
            label: isSyncing ? 'Syncing...' : 'Sync Cloud',
            action: async () => {
              if (isSyncing) return
              if (window.confirm('Are you sure you want to run a Full Two-Way Sync with Supabase?')) {
                setIsSyncing(true)
                try {
                  const res = await window.api.sync.run()
                  alert(res.message)
                  await fetchSyncState()
                } catch (err: any) {
                  alert('Sync Error: ' + err.message)
                } finally {
                  setIsSyncing(false)
                }
              }
            },
            highlight: hasRemoteChanges,
            subtext: isSyncing ? 'Please wait' : (lastSyncTime ? `Last: ${new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not synced yet'),
            icon: (
              <>
                <style>{`
                  @keyframes spin { 100% { transform: rotate(360deg); } }
                  .spin-anim { animation: spin 1s linear infinite; }
                `}</style>
                <svg viewBox="0 0 24 24" className={isSyncing ? 'spin-anim' : ''} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22, transition: 'transform 0.2s' }}>
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
              </>
            )
          }
        ]
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' }}>
            {actions.map((a, i) => (
              <button
                key={i}
                onClick={a.action}
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.625rem',
                  padding: '1.25rem 0.5rem',
                  background: a.primary ? 'var(--accent)' : 'var(--bg-surface)',
                  border: a.primary ? 'none' : '1px solid var(--border)',
                  borderRadius: 'var(--r-lg)',
                  boxShadow: a.primary ? '0 4px 16px oklch(0.58 0.2 260 / 0.22)' : 'var(--shadow-xs)',
                  color: a.primary ? '#fff' : 'var(--ink-1)',
                  cursor: 'pointer',
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  transition: 'opacity 120ms ease, transform 120ms ease',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.88' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
                onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.98)' }}
                onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)' }}
              >
                {a.highlight && (
                  <div style={{ position: 'absolute', top: 8, right: 8, width: 10, height: 10, borderRadius: '50%', background: 'var(--red)', boxShadow: '0 0 8px var(--red)' }} title="New data available in cloud" />
                )}
                <div style={{ color: a.highlight ? 'var(--red)' : 'inherit' }}>
                  {a.icon}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                  <span>{a.label}</span>
                  {a.subtext && (
                    <span style={{ fontSize: '0.65rem', fontWeight: 400, color: a.primary ? 'rgba(255,255,255,0.8)' : 'var(--ink-3)' }}>
                      {a.subtext}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )
      })()}

      {/* Recent invoices */}
      <div>
        <SectionHead title="Recent Invoices" />
        <div className="card" style={{ overflow: 'hidden' }}>
          {recentInvoices.length === 0 ? (
            <p style={{ padding: '1.25rem', fontSize: '0.8125rem', color: 'var(--ink-3)' }}>No invoices yet.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ color: 'var(--ink-3)', fontWeight: 500 }}>
                  {['Invoice', 'Type', 'Time', 'Total'].map((h, i) => (
                    <th key={h} style={{ padding: '0.5rem 1rem', textAlign: i === 3 ? 'right' : 'left', fontWeight: 500, fontSize: '0.75rem', borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="trow-hover"
                    onClick={() => setModalInvoiceId(inv.id)}
                    style={{ cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                  >
                    <td style={{ padding: '0.625rem 1rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--ink-2)' }}>
                      {inv.invoiceNo}
                      {inv.status === 'void' && (
                        <span style={{
                          marginLeft: '0.5rem',
                          padding: '0.125rem 0.375rem',
                          borderRadius: 'var(--r-full)',
                          fontSize: '0.625rem',
                          fontWeight: 700,
                          background: 'var(--red-soft)',
                          color: 'var(--red)',
                          letterSpacing: '0.05em'
                        }}>VOID</span>
                      )}
                    </td>
                    <td style={{ padding: '0.625rem 1rem' }}>
                      <span style={{
                        display: 'inline-flex',
                        padding: '0.125rem 0.5rem',
                        borderRadius: 'var(--r-full)',
                        fontSize: '0.6875rem',
                        fontWeight: 500,
                        background: inv.type === 'retail' ? 'var(--accent-soft)' : 'oklch(0.96 0.025 75)',
                        color: inv.type === 'retail' ? 'var(--accent)' : 'oklch(0.48 0.15 75)',
                      }}>
                        {inv.type}
                      </span>
                    </td>
                    <td style={{ padding: '0.625rem 1rem', color: 'var(--ink-3)', fontSize: '0.75rem' }}>
                      {new Date(inv.invoiceDatetime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '0.625rem 1rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: inv.status === 'void' ? 'var(--red)' : 'var(--ink-1)', textDecoration: inv.status === 'void' ? 'line-through' : 'none' }}>
                      {paiseToCurrency(inv.totalPaise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Recent expenses */}
      {recentExpenses.length > 0 && (
        <div>
          <SectionHead title="Recent Expenses" />
          <div className="card" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <tbody>
                {recentExpenses.map((e) => (
                  <tr key={e.id} onClick={() => setModalExpense(e)} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }} className="trow-hover">
                    <td style={{ padding: '0.625rem 1rem', color: 'var(--ink-3)', fontSize: '0.75rem', width: 100 }}>{e.date}</td>
                    <td style={{ padding: '0.625rem 1rem', color: 'var(--ink-1)', fontWeight: 500 }}>{e.category}</td>
                    <td style={{ padding: '0.625rem 1rem', color: 'var(--ink-3)', fontSize: '0.8125rem' }}>{e.notes ?? ''}</td>
                    <td style={{ padding: '0.625rem 1rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--red)' }}>
                      {paiseToCurrency(e.amountPaise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invoice detail modal */}
      {modalInvoiceId && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'oklch(0 0 0 / 0.35)', zIndex: 'var(--z-backdrop)' as unknown as number, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}
          onClick={() => setModalInvoiceId(null)}
        >
          <div
            style={{ background: 'var(--bg-surface)', borderRadius: 'var(--r-xl)', boxShadow: 'var(--shadow-lg)', width: 400, maxHeight: '85vh', overflowY: 'auto', padding: '1.5rem', zIndex: 'var(--z-modal)' as unknown as number }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--ink-1)' }}>Invoice Detail</span>
              <button
                onClick={() => setModalInvoiceId(null)}
                style={{ width: 28, height: 28, borderRadius: 'var(--r-full)', background: 'var(--bg-fill)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--ink-2)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <InvoiceDetailPanel invoiceId={modalInvoiceId} onUpdated={(deleted) => {
              if (deleted) setModalInvoiceId(null)
              loadData()
            }} />
          </div>
        </div>
      )}

      {/* Expense Detail Modal */}
      {modalExpense && (
        <ExpenseDetailModal
          expense={modalExpense}
          onClose={() => setModalExpense(null)}
          onDeleted={() => {
            setModalExpense(null)
            loadData()
          }}
        />
      )}
    </div>
  )
}
