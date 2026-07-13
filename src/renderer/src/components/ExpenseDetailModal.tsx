// @ts-nocheck
import { useState, type ReactElement } from 'react'
import { useAppStore } from '../store/appStore'
import { paiseToCurrency } from '@shared/money'
import type { ExpenseRow } from '@shared/types'

interface Props {
  expense: ExpenseRow
  onClose: () => void
  onDeleted?: () => void
}

export default function ExpenseDetailModal({ expense, onClose, onDeleted }: Props): ReactElement {
  const { user } = useAppStore()
  const isAdmin = user?.role === 'admin'
  
  const [showConfirm, setShowConfirm] = useState(false)
  const [actionError, setActionError] = useState('')

  async function handleDelete(): Promise<void> {
    if (!user) return
    const res = await window.api.expenses.delete({ expenseId: expense.id, userId: user.id })
    if (!res.ok) {
      setActionError(res.error)
      return
    }
    onDeleted?.()
    onClose()
  }

  const T = {
    bg: '#0f1117',
    surface: 'rgba(255,255,255,0.04)',
    border: 'rgba(255,255,255,0.10)',
    ink1: '#f1f5f9',
    ink2: '#94a3b8',
    ink3: '#64748b',
    red: '#f87171',
    redSoft: 'rgba(248,113,113,0.12)',
    shadow: '0 4px 24px rgba(0,0,0,0.35)',
    r: '16px',
    rFull: '9999px',
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'oklch(0 0 0 / 0.35)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        style={{ background: T.bg, borderRadius: T.r, boxShadow: T.shadow, width: 360, padding: '1.5rem', border: `1px solid ${T.border}`, zIndex: 101, display: 'flex', flexDirection: 'column', gap: '1rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600, fontSize: '1rem', color: T.ink1 }}>Expense Details</span>
          <button
            onClick={onClose}
            style={{ width: 28, height: 28, borderRadius: T.rFull, background: T.surface, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: T.ink2 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: T.ink3 }}>Date</span>
            <span style={{ color: T.ink1, fontWeight: 500, fontFamily: 'monospace' }}>{expense.date}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: T.ink3 }}>Category</span>
            <span style={{ color: T.ink1, fontWeight: 500 }}>{expense.category}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: T.ink3 }}>Amount</span>
            <span style={{ color: T.red, fontWeight: 600, fontFamily: 'monospace' }}>{paiseToCurrency(expense.amountPaise)}</span>
          </div>
          {expense.notes && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem' }}>
              <span style={{ color: T.ink3 }}>Notes</span>
              <span style={{ color: T.ink2, background: T.surface, padding: '0.5rem', borderRadius: '8px' }}>{expense.notes}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        {isAdmin && (
          <div style={{ marginTop: '0.5rem', borderTop: `1px solid ${T.border}`, paddingTop: '1rem' }}>
            {!showConfirm ? (
              <button
                onClick={() => setShowConfirm(true)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: `1px solid ${T.red}44`, background: T.redSoft, color: T.red, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500, transition: 'background 150ms' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = `rgba(248,113,113,0.2)`)}
                onMouseLeave={(e) => (e.currentTarget.style.background = T.redSoft)}
              >
                Delete Expense
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <span style={{ color: T.red, fontSize: '0.75rem', fontWeight: 500 }}>Are you sure you want to delete this expense?</span>
                {actionError && <span style={{ color: T.red, fontSize: '0.75rem' }}>{actionError}</span>}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={handleDelete}
                    style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: 'none', background: T.red, color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}
                  >
                    Confirm Delete
                  </button>
                  <button
                    onClick={() => { setShowConfirm(false); setActionError('') }}
                    style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: `1px solid ${T.border}`, background: 'transparent', color: T.ink1, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
