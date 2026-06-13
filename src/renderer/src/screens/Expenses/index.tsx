import { useState, useEffect, type ReactElement, type FormEvent } from 'react'
import { useAppStore } from '../../store/appStore'
import { paiseToCurrency } from '@shared/money'
import ExpenseDetailModal from '../../components/ExpenseDetailModal'
import type { ExpenseRow } from '@shared/types'

const DEFAULT_CATEGORIES = ['Rent', 'Utilities', 'Salary', 'Packaging', 'Transport', 'Maintenance', 'Other']

export default function ExpensesScreen(): ReactElement {
  const { user } = useAppStore()
  const [expenses, setExpenses] = useState<ExpenseRow[]>([])
  const [modalExpense, setModalExpense] = useState<ExpenseRow | null>(null)

  // Custom categories from localStorage
  const [customCats, setCustomCats] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('spice_custom_expense_cats') || '[]') } catch { return [] }
  })

  // All unique categories
  const allCategories = Array.from(new Set([
    ...DEFAULT_CATEGORIES,
    ...customCats,
    ...expenses.map((e) => e.category)
  ])).sort()

  const [selectedCategory, setSelectedCategory] = useState(allCategories[0] || DEFAULT_CATEGORIES[0])

  // Form
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // New Category Modal
  const [showNewCat, setShowNewCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')

  async function load(): Promise<void> {
    const res = await window.api.expenses.list()
    if (res.ok) setExpenses(res.data)
  }

  useEffect(() => { load() }, [])

  // Make sure selectedCategory is valid
  useEffect(() => {
    if (!allCategories.includes(selectedCategory) && allCategories.length > 0) {
      setSelectedCategory(allCategories[0])
    }
  }, [allCategories, selectedCategory])

  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault()
    setError(''); setSuccess('')
    if (!selectedCategory) {
      setError('Please select a category')
      return
    }

    const res = await window.api.expenses.record({
      date, category: selectedCategory, amountPaise: Math.round(parseFloat(amount) * 100),
      notes: notes.trim() || undefined, userId: user!.id
    })
    if (!res.ok) { setError(res.error); return }
    setAmount(''); setNotes(''); setSuccess('Expense recorded successfully'); load()
    setTimeout(() => setSuccess(''), 3000)
  }

  function handleAddCategory(e: FormEvent): void {
    e.preventDefault()
    const name = newCatName.trim()
    if (!name) return
    const updated = [...customCats, name]
    setCustomCats(updated)
    localStorage.setItem('spice_custom_expense_cats', JSON.stringify(updated))
    setSelectedCategory(name)
    setShowNewCat(false)
    setNewCatName('')
  }

  const categoryExpenses = expenses.filter(e => e.category === selectedCategory)

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
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--ink-1)', letterSpacing: '-0.02em' }}>Expenses</h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--ink-3)', marginTop: '0.125rem' }}>Record and manage your expenses</p>
        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'clamp(260px, 22%, 320px) 1fr', gap: '1rem',
        flex: 1, minHeight: 0, maxWidth: 1100, width: '100%', margin: '0 auto'
      }}>
        {/* ── Left Sidebar: Categories ── */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Categories</h2>
            <button onClick={() => setShowNewCat(true)} className="btn btn-ghost" style={{ padding: '0.25rem', color: 'var(--accent)' }} title="New Category">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
            {allCategories.map((c) => {
              const active = selectedCategory === c
              return (
                <button
                  key={c}
                  onClick={() => { setSelectedCategory(c); setSuccess(''); setError('') }}
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
                  {c}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Right Detail ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', paddingRight: '0.25rem' }}>
          {/* Record Form */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--ink-1)', marginBottom: '1rem' }}>Record {selectedCategory} Expense</h2>
            <form onSubmit={submit}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--ink-2)' }}>Amount (₹) *</label>
                  <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required
                    style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--ink-1)', borderRadius: 'var(--r)', padding: '0.5rem 0.75rem', fontSize: '0.875rem' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--ink-2)' }}>Date</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required
                    style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--ink-1)', borderRadius: 'var(--r)', padding: '0.5rem 0.75rem', fontSize: '0.875rem' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--ink-2)' }}>Notes (optional)</label>
                  <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g., specific vendor or reason"
                    style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--ink-1)', borderRadius: 'var(--r)', padding: '0.5rem 0.75rem', fontSize: '0.875rem' }} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {error && <span style={{ color: 'var(--red)', fontSize: '0.8125rem' }}>{error}</span>}
                  {success && <span style={{ color: 'var(--green)', fontSize: '0.8125rem' }}>{success}</span>}
                </div>
                <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1.25rem' }}>Record Expense</button>
              </div>
            </form>
          </div>

          {/* Recent Expenses for this category */}
          <div className="card" style={{ flex: 1, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink-2)' }}>Recent {selectedCategory} Entries</h2>
            {categoryExpenses.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)', fontSize: '0.8125rem', background: 'var(--surface)', borderRadius: 'var(--r)' }}>
                No recent entries for this category.
              </div>
            ) : (
              <table style={{ width: '100%', fontSize: '0.8125rem', textAlign: 'left' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '0.5rem 0', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Date</th>
                    <th style={{ padding: '0.5rem 0', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Notes</th>
                    <th style={{ padding: '0.5rem 0', color: 'var(--ink-3)', fontWeight: 500, borderBottom: '1px solid var(--border)', textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryExpenses.slice(0, 50).map(e => (
                    <tr key={e.id} onClick={() => setModalExpense(e)} style={{ cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.625rem 0', color: 'var(--ink-2)', fontFamily: 'var(--font-mono)' }}>{e.date}</td>
                      <td style={{ padding: '0.625rem 0', color: 'var(--ink-1)' }}>{e.notes || '—'}</td>
                      <td style={{ padding: '0.625rem 0', color: 'var(--ink-1)', fontWeight: 600, fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{paiseToCurrency(e.amountPaise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ── New Category Modal ── */}
      {showNewCat && (
        <div className="modal-overlay" onClick={() => setShowNewCat(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--ink-1)', marginBottom: '1rem' }}>New Category</h3>
            <form onSubmit={handleAddCategory} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--ink-2)' }}>Category Name *</label>
                <input autoFocus value={newCatName} onChange={(e) => setNewCatName(e.target.value)} required
                  style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--ink-1)', borderRadius: 'var(--r)', padding: '0.5rem 0.75rem', fontSize: '0.875rem' }} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowNewCat(false)} className="btn btn-secondary" style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}>Create</button>
              </div>
            </form>
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
            load()
          }}
        />
      )}
    </div>
  )
}
