import { useState, useEffect, type ReactElement } from 'react'
import { useAppStore } from '../../store/appStore'
import { paiseToCurrency } from '@shared/money'
import { businessDate } from '@shared/businessDate'
import InvoiceDetailPanel from '../../components/InvoiceDetailPanel'
import type { DailySalesRow, ExpenseRow, InvoiceRow, PaymentBreakdownRow } from '@shared/types'

export default function DashboardScreen(): ReactElement {
  const { user, navigate } = useAppStore()
  const today = businessDate(new Date())

  const [sales, setSales] = useState<DailySalesRow | null>(null)
  const [todayExpenses, setTodayExpenses] = useState<ExpenseRow[]>([])
  const [recentInvoices, setRecentInvoices] = useState<InvoiceRow[]>([])
  const [recentExpenses, setRecentExpenses] = useState<ExpenseRow[]>([])
  const [collections, setCollections] = useState<PaymentBreakdownRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalInvoiceId, setModalInvoiceId] = useState<number | null>(null)

  useEffect(() => {
    async function load(): Promise<void> {
      const [sRes, eRes, invRes, expRes, colRes] = await Promise.all([
        window.api.reports.dailySales({ dateFrom: today, dateTo: today }),
        window.api.expenses.list({ dateFrom: today, dateTo: today }),
        window.api.invoiceHistory.search({}),
        window.api.expenses.list(),
        window.api.reports.paymentBreakdown({ date: today })
      ])
      if (sRes.ok) setSales(sRes.data[0] ?? null)
      if (eRes.ok) setTodayExpenses(eRes.data)
      if (invRes.ok) setRecentInvoices(invRes.data.slice(0, 10))
      if (expRes.ok) setRecentExpenses(expRes.data.slice(0, 5))
      if (colRes.ok) setCollections(colRes.data)
      setLoading(false)
    }
    load()
  }, [today])

  const expensesTotal = todayExpenses.reduce((s, e) => s + e.amountPaise, 0)

  return (
    <div className="p-6 max-w-5xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Business date: <span className="font-medium text-gray-700">{today}</span>
          {' · '}Welcome, {user?.name}
        </p>
      </div>

      {/* Today's Sales — 5 cards */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Today's Sales</h2>
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : (
          <div className="grid grid-cols-5 gap-4">
            {[
              { label: 'Retail',     value: paiseToCurrency(sales?.retailTotalPaise ?? 0) },
              { label: 'Wholesale',  value: paiseToCurrency(sales?.wholesaleTotalPaise ?? 0) },
              { label: 'Combined',   value: paiseToCurrency(sales?.combinedTotalPaise ?? 0), highlight: true },
              { label: 'Invoices',   value: String(sales?.invoiceCount ?? 0) },
              { label: 'Expenses',   value: paiseToCurrency(expensesTotal) }
            ].map((card) => (
              <div key={card.label} className={`border rounded-xl p-4 bg-white ${card.highlight ? 'border-indigo-200' : ''}`}>
                <div className="text-xs text-gray-500 mb-1">{card.label}</div>
                <div className={`text-2xl font-bold ${card.highlight ? 'text-indigo-700' : 'text-gray-900'}`}>
                  {card.value}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Today's Collections card */}
      {!loading && collections && (() => {
        const methods: Array<{ key: keyof PaymentBreakdownRow; label: string; color: string; isCredit?: boolean }> = [
          { key: 'cash',   label: 'Cash',   color: '#16a34a' },
          { key: 'upi',    label: 'UPI',    color: '#2563eb' },
          { key: 'card',   label: 'Card',   color: '#7c3aed' },
          { key: 'split',  label: 'Split',  color: '#d97706' },
          { key: 'credit', label: 'Credit', color: '#dc2626', isCredit: true }
        ]
        const active = methods.filter((m) => (collections[m.key] as number) > 0)
        const hasAnyCollected = collections.total > 0
        const hasCredit = collections.credit > 0
        const grandTotal = collections.total + collections.credit || 1
        const R = 44, cx = 54, cy = 54, stroke = 22
        const circumference = 2 * Math.PI * R
        const allSegments = methods
          .filter((m) => (collections[m.key] as number) > 0)
          .reduce<Array<{ label: string; color: string; val: number; dash: number; offset: number }>>(
            (acc, m) => {
              const val = collections[m.key] as number
              const frac = val / grandTotal
              const dash = frac * circumference
              const last = acc[acc.length - 1]
              const off = last ? last.offset + last.dash : 0
              acc.push({ label: m.label, color: m.color, val, dash, offset: off })
              return acc
            }, []
          )

        return (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Today's Collections</h2>
            <div className="border rounded-xl bg-white p-4">
              {!hasAnyCollected && !hasCredit ? (
                <p className="text-sm text-gray-400">No sales recorded today.</p>
              ) : (
                <div className="flex items-center gap-8">
                  {/* SVG donut */}
                  <svg width="108" height="108" viewBox="0 0 108 108" className="flex-shrink-0">
                    <circle cx={cx} cy={cy} r={R} fill="none" stroke="#f3f4f6" strokeWidth={stroke} />
                    {allSegments.map((s, i) => (
                      <circle key={i} cx={cx} cy={cy} r={R} fill="none"
                        stroke={s.color} strokeWidth={stroke}
                        strokeDasharray={`${s.dash} ${circumference - s.dash}`}
                        strokeDashoffset={circumference - s.offset}
                        style={{ transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cy}px` }}
                      />
                    ))}
                    <text x={cx} y={cy - 4} textAnchor="middle" fontSize="9" fill="#6b7280">Collected</text>
                    <text x={cx} y={cy + 9} textAnchor="middle" fontSize="10" fontWeight="600" fill="#111827">
                      {paiseToCurrency(collections.total)}
                    </text>
                  </svg>
                  {/* Legend */}
                  <div className="flex flex-col gap-1.5 flex-1">
                    {active.map((m) => {
                      const val = collections[m.key] as number
                      const pct = grandTotal > 0 ? Math.round(val / grandTotal * 100) : 0
                      return (
                        <div key={m.key} className="flex items-center gap-2 text-sm">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: m.color }} />
                          <span className="w-14 text-gray-700 font-medium">{m.label}</span>
                          <span className="font-mono text-gray-900">{paiseToCurrency(val)}</span>
                          <span className="text-gray-400 text-xs">{pct}%</span>
                          {m.isCredit && <span className="text-xs text-red-500">(outstanding)</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* Quick links */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Quick Links</h2>
        <div className="flex flex-wrap gap-3">
          {[
            { label: 'Retail Billing',     screen: 'RetailBilling',    color: 'bg-indigo-600 hover:bg-indigo-700' },
            { label: 'Wholesale Billing',  screen: 'WholesaleBilling', color: 'bg-amber-600 hover:bg-amber-700' },
            { label: 'Packing',            screen: 'Packing',          color: 'bg-green-700 hover:bg-green-800' },
            { label: 'Bulk Inventory',     screen: 'BulkInventory',    color: 'bg-gray-700 hover:bg-gray-800' }
          ].map((link) => (
            <button key={link.screen}
              onClick={() => navigate(link.screen as Parameters<typeof navigate>[0])}
              className={`${link.color} text-white px-5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition-colors`}>
              {link.label}
            </button>
          ))}
        </div>
      </div>

      {/* Recent Invoices */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Recent Invoices</h2>
        <div className="border rounded-xl bg-white overflow-hidden">
          {recentInvoices.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-400">No invoices yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wide bg-gray-50 border-b">
                  <th className="px-4 py-2">Invoice No.</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Date / Time</th>
                  <th className="px-4 py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {recentInvoices.map((inv) => (
                  <tr key={inv.id}
                    onClick={() => setModalInvoiceId(inv.id)}
                    className="border-b last:border-0 hover:bg-gray-50 cursor-pointer transition-colors">
                    <td className="px-4 py-2 font-mono text-xs">{inv.invoiceNo}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${inv.type === 'retail' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>
                        {inv.type}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">
                      {new Date(inv.invoiceDatetime).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 font-mono font-semibold">{paiseToCurrency(inv.totalPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Recent Expenses */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Recent Expenses</h2>
        <div className="border rounded-xl bg-white overflow-hidden">
          {recentExpenses.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-400">No expenses recorded.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wide bg-gray-50 border-b">
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Category</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {recentExpenses.map((e) => (
                  <tr key={e.id} className="border-b last:border-0">
                    <td className="px-4 py-2 text-xs text-gray-500">{e.date}</td>
                    <td className="px-4 py-2">{e.category}</td>
                    <td className="px-4 py-2 text-right font-mono">{paiseToCurrency(e.amountPaise)}</td>
                    <td className="px-4 py-2 text-gray-400 text-xs">{e.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modalInvoiceId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setModalInvoiceId(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-96 max-h-[85vh] overflow-y-auto p-5"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-800 text-sm">Invoice Detail</h3>
              <button onClick={() => setModalInvoiceId(null)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer text-xl leading-none">×</button>
            </div>
            <InvoiceDetailPanel invoiceId={modalInvoiceId} />
          </div>
        </div>
      )}
    </div>
  )
}
