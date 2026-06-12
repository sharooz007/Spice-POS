import { useState, useEffect, type ReactElement, type FormEvent } from 'react'
import { useAppStore } from '../../store/appStore'
import { paiseToCurrency } from '@shared/money'
import type { ExpenseRow } from '@shared/types'

const CATEGORIES = ['Rent', 'Utilities', 'Salary', 'Packaging', 'Transport', 'Maintenance', 'Other']

export default function ExpensesScreen(): ReactElement {
  const { user } = useAppStore()
  const [expenses, setExpenses] = useState<ExpenseRow[]>([])
  const [view, setView] = useState<'daily' | 'monthly'>('daily')

  // Form
  const [category, setCategory] = useState(CATEGORIES[0])
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  async function load(): Promise<void> {
    const res = await window.api.expenses.list()
    if (res.ok) setExpenses(res.data)
  }

  useEffect(() => { load() }, [])

  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault()
    const res = await window.api.expenses.record({
      date, category, amountPaise: Math.round(parseFloat(amount) * 100),
      notes: notes.trim() || undefined, userId: user!.id
    })
    if (!res.ok) { setError(res.error); return }
    setAmount(''); setNotes(''); setError(''); load()
  }

  // Grouped totals
  const dailyTotals = expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.date] = (acc[e.date] ?? 0) + e.amountPaise
    return acc
  }, {})

  const monthlyTotals = expenses.reduce<Record<string, number>>((acc, e) => {
    const m = e.date.slice(0, 7)
    acc[m] = (acc[m] ?? 0) + e.amountPaise
    return acc
  }, {})

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-gray-800 mb-4">Expenses</h1>

      <form onSubmit={submit} className="border rounded-lg p-4 bg-white flex flex-col gap-3 mb-6">
        <div className="grid grid-cols-4 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm">
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Amount (₹) *</label>
            <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required
              className="border border-gray-300 rounded px-2 py-1 text-sm" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required
              className="border border-gray-300 rounded px-2 py-1 text-sm" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm" />
          </div>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button type="submit" className="bg-gray-700 text-white px-4 py-1.5 rounded text-sm cursor-pointer w-fit">Record Expense</button>
      </form>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit mb-4">
        {(['daily', 'monthly'] as const).map((v) => (
          <button key={v} onClick={() => setView(v)}
            className={`px-4 py-1.5 rounded-md text-sm cursor-pointer transition-colors ${view === v ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {v === 'daily' ? 'Daily' : 'Monthly'}
          </button>
        ))}
      </div>

      {view === 'daily' ? (
        <div className="flex flex-col gap-3">
          {Object.entries(dailyTotals).sort(([a], [b]) => b.localeCompare(a)).map(([d, total]) => (
            <div key={d} className="border rounded-lg bg-white p-3">
              <div className="flex justify-between font-semibold text-sm mb-2">
                <span>{d}</span><span className="font-mono">{paiseToCurrency(total)}</span>
              </div>
              {expenses.filter((e) => e.date === d).map((e) => (
                <div key={e.id} className="flex justify-between text-xs text-gray-600">
                  <span>{e.category}{e.notes ? ` — ${e.notes}` : ''}</span>
                  <span className="font-mono">{paiseToCurrency(e.amountPaise)}</span>
                </div>
              ))}
            </div>
          ))}
          {Object.keys(dailyTotals).length === 0 && <p className="text-sm text-gray-400">No expenses.</p>}
        </div>
      ) : (
        <div className="border rounded-lg bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-500 uppercase tracking-wide bg-gray-50 border-b">
              <th className="px-4 py-2">Month</th><th className="px-4 py-2 text-right">Total</th>
            </tr></thead>
            <tbody>
              {Object.entries(monthlyTotals).sort(([a], [b]) => b.localeCompare(a)).map(([m, total]) => (
                <tr key={m} className="border-b last:border-0">
                  <td className="px-4 py-2">{m}</td>
                  <td className="px-4 py-2 text-right font-mono font-semibold">{paiseToCurrency(total)}</td>
                </tr>
              ))}
              {Object.keys(monthlyTotals).length === 0 && (
                <tr><td colSpan={2} className="px-4 py-3 text-gray-400 text-sm">No expenses.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
