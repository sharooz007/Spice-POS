import { useState, type ReactElement } from 'react'
import { paiseToCurrency } from '@shared/money'

type SplitMethod = 'cash' | 'upi' | 'card'
interface SplitRow { method: SplitMethod; amountStr: string }

interface Props {
  totalPaise: number
  accentClass?: string
  onConfirm: (rows: Array<{ method: SplitMethod; amountPaise: number }>, summary: string) => void
  onCancel: () => void
}

export default function SplitPaymentModal({ totalPaise, onConfirm, onCancel }: Props): ReactElement {
  const [rows, setRows] = useState<SplitRow[]>([
    { method: 'cash', amountStr: '' },
    { method: 'upi', amountStr: '' }
  ])

  const enteredPaise = rows.reduce((s, r) => s + Math.round((parseFloat(r.amountStr) || 0) * 100), 0)
  const remainingPaise = totalPaise - enteredPaise
  const canConfirm = remainingPaise === 0

  function setRow(i: number, patch: Partial<SplitRow>): void {
    setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  }

  function confirm(): void {
    const parsed = rows
      .map((r) => ({ method: r.method, amountPaise: Math.round((parseFloat(r.amountStr) || 0) * 100) }))
      .filter((r) => r.amountPaise > 0)
    const summary = 'Split: ' + parsed.map((r) => `${paiseToCurrency(r.amountPaise)} ${r.method.charAt(0).toUpperCase() + r.method.slice(1)}`).join(' + ')
    onConfirm(parsed, summary)
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 360 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--ink-1)' }}>Split Payment</span>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums' }}>
            Total: {paiseToCurrency(totalPaise)}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
          {rows.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <select value={r.method} onChange={(e) => setRow(i, { method: e.target.value as SplitMethod })}
                style={{ width: 88, flexShrink: 0 }}>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
              </select>
              <input type="number" step="0.01" min="0" value={r.amountStr}
                onChange={(e) => setRow(i, { amountStr: e.target.value })}
                placeholder="0.00" style={{ flex: 1 }} />
              {rows.length > 2 && (
                <button onClick={() => setRows((p) => p.filter((_, j) => j !== i))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', fontSize: '1.125rem', lineHeight: 1, padding: '0 4px', flexShrink: 0 }}
                  onMouseEnter={(e) => ((e.target as HTMLElement).style.color = 'var(--red)')}
                  onMouseLeave={(e) => ((e.target as HTMLElement).style.color = 'var(--ink-4)')}>
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        {rows.length < 3 && (
          <button onClick={() => setRows((p) => [...p, { method: 'cash', amountStr: '' }])}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--ink-3)', padding: 0, marginBottom: '1rem', display: 'block' }}
            onMouseEnter={(e) => ((e.target as HTMLElement).style.color = 'var(--ink-1)')}
            onMouseLeave={(e) => ((e.target as HTMLElement).style.color = 'var(--ink-3)')}>
            + Add another
          </button>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)', marginBottom: '1rem' }}>
          <span style={{ color: 'var(--ink-3)' }}>Entered: <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--ink-1)', fontWeight: 500 }}>{paiseToCurrency(enteredPaise)}</span></span>
          <span style={{ fontWeight: 600, color: remainingPaise !== 0 ? 'var(--red)' : 'var(--green)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
            {remainingPaise > 0 ? `Remaining: ${paiseToCurrency(remainingPaise)}` : remainingPaise < 0 ? `Over: ${paiseToCurrency(-remainingPaise)}` : 'Exact'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-primary" onClick={confirm} disabled={!canConfirm} style={{ flex: 1 }}>
            Confirm Split
          </button>
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
