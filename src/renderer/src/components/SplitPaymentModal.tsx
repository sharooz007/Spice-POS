import { useState, type ReactElement } from 'react'
import { paiseToCurrency } from '@shared/money'

type SplitMethod = 'cash' | 'upi' | 'card'
interface SplitRow { method: SplitMethod; amountStr: string }

interface Props {
  totalPaise: number
  accentClass?: string // e.g. 'indigo' or 'amber' for button colour
  onConfirm: (rows: Array<{ method: SplitMethod; amountPaise: number }>, summary: string) => void
  onCancel: () => void
}

export default function SplitPaymentModal({ totalPaise, accentClass = 'indigo', onConfirm, onCancel }: Props): ReactElement {
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
    const summary = parsed.map((r) => `${paiseToCurrency(r.amountPaise)} ${r.method.charAt(0).toUpperCase() + r.method.slice(1)}`).join(' + ')
    onConfirm(parsed, `Split: ${summary}`)
  }

  const btn = `bg-${accentClass}-600 hover:bg-${accentClass}-700 disabled:bg-${accentClass}-300`

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-80 p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-800">Split Payment</h3>
          <span className="text-sm font-semibold text-gray-700">Total: {paiseToCurrency(totalPaise)}</span>
        </div>

        <div className="flex flex-col gap-2">
          {rows.map((r, i) => (
            <div key={i} className="flex gap-2 items-center">
              <select value={r.method} onChange={(e) => setRow(i, { method: e.target.value as SplitMethod })}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm w-24">
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
              </select>
              <input type="number" step="0.01" min="0" value={r.amountStr}
                onChange={(e) => setRow(i, { amountStr: e.target.value })}
                placeholder="0.00"
                className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm" />
              {rows.length > 2 && (
                <button onClick={() => setRows((p) => p.filter((_, j) => j !== i))}
                  className="text-red-400 hover:text-red-600 cursor-pointer text-lg leading-none">×</button>
              )}
            </div>
          ))}
        </div>

        {rows.length < 3 && (
          <button onClick={() => setRows((p) => [...p, { method: 'cash', amountStr: '' }])}
            className="text-sm text-gray-500 hover:text-gray-700 cursor-pointer text-left">+ Add another</button>
        )}

        <div className="text-sm flex justify-between border-t pt-2">
          <span className="text-gray-600">Entered: <span className="font-mono">{paiseToCurrency(enteredPaise)}</span></span>
          <span className={remainingPaise !== 0 ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>
            {remainingPaise > 0 ? `Remaining: ${paiseToCurrency(remainingPaise)}` : remainingPaise < 0 ? `Over by ${paiseToCurrency(-remainingPaise)}` : '✓ Exact'}
          </span>
        </div>

        <div className="flex gap-2">
          <button onClick={confirm} disabled={!canConfirm}
            className={`flex-1 ${btn} disabled:cursor-not-allowed text-white font-semibold py-2 rounded-lg cursor-pointer transition-colors text-sm`}>
            Confirm Split
          </button>
          <button onClick={onCancel}
            className="px-4 py-2 border rounded-lg text-sm cursor-pointer hover:bg-gray-50 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
