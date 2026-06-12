import { useState, useEffect, type ReactElement, type FormEvent } from 'react'
import { useAppStore } from '../../store/appStore'
import { paiseToCurrency } from '@shared/money'
import type { SupplierRow, PurchaseEntryRow } from '@shared/types'

export default function PurchaseEntryScreen(): ReactElement {
  const { user } = useAppStore()
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([])
  const [purchases, setPurchases] = useState<PurchaseEntryRow[]>([])
  const [showNewSupplier, setShowNewSupplier] = useState(false)
  const [error, setError] = useState('')

  // Form state
  const [supplierId, setSupplierId] = useState<number | ''>('')
  const [itemName, setItemName] = useState('')
  const [qty, setQty] = useState('1')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')

  async function loadData(): Promise<void> {
    const [sRes, pRes] = await Promise.all([
      window.api.purchases.listSuppliers(),
      window.api.purchases.list()
    ])
    if (sRes.ok) setSuppliers(sRes.data)
    if (pRes.ok) setPurchases(pRes.data)
  }

  useEffect(() => { loadData() }, [])

  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault()
    const res = await window.api.purchases.record({
      supplierId: supplierId ? Number(supplierId) : undefined,
      itemName, qty: parseInt(qty) || 1,
      amountPaise: Math.round(parseFloat(amount) * 100),
      date, notes: notes.trim() || undefined,
      userId: user!.id
    })
    if (!res.ok) { setError(res.error); return }
    setError('')
    setItemName(''); setQty('1'); setAmount(''); setNotes('')
    loadData()
  }

  function NewSupplierForm(): ReactElement {
    const [name, setName] = useState('')
    const [phone, setPhone] = useState('')
    async function submit2(e: FormEvent): Promise<void> {
      e.preventDefault()
      const res = await window.api.purchases.createSupplier({ name, phone })
      if (!res.ok) return
      setShowNewSupplier(false); loadData()
    }
    return (
      <form onSubmit={submit2} className="flex gap-2 items-end mt-1">
        <input placeholder="Supplier name" value={name} onChange={(e) => setName(e.target.value)} required
          className="border border-gray-300 rounded px-2 py-1 text-sm" />
        <input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1 text-sm w-28" />
        <button type="submit" className="bg-gray-700 text-white px-3 py-1 rounded text-sm cursor-pointer">Add</button>
        <button type="button" onClick={() => setShowNewSupplier(false)} className="px-3 py-1 border rounded text-sm cursor-pointer">Cancel</button>
      </form>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-gray-800 mb-1">Purchase Entry</h1>
      {/* Explicit note: record-keeping only */}
      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-1.5 mb-4">
        Record-keeping only — does not affect stock or cost.
      </p>

      <form onSubmit={submit} className="border rounded-lg p-4 bg-white flex flex-col gap-3 mb-6">
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-600">Supplier</label>
              <button type="button" onClick={() => setShowNewSupplier(true)}
                className="text-xs text-blue-600 hover:underline cursor-pointer">+ New</button>
            </div>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : '')}
              className="border border-gray-300 rounded px-2 py-1 text-sm">
              <option value="">No supplier</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {showNewSupplier && <NewSupplierForm />}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Item name *</label>
            <input value={itemName} onChange={(e) => setItemName(e.target.value)} required
              className="border border-gray-300 rounded px-2 py-1 text-sm" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm" required />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Qty</label>
            <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm" required />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Amount (₹) *</label>
            <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required
              className="border border-gray-300 rounded px-2 py-1 text-sm" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm" />
          </div>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button type="submit" className="bg-gray-700 text-white px-6 py-1.5 rounded text-sm cursor-pointer w-fit">Record Purchase</button>
      </form>

      <h2 className="font-semibold text-gray-700 mb-2 text-sm">History</h2>
      {purchases.length === 0
        ? <p className="text-sm text-gray-400">No purchases recorded.</p>
        : (
          <table className="w-full text-xs border rounded-lg overflow-hidden bg-white">
            <thead><tr className="text-left text-gray-500 border-b bg-gray-50">
              <th className="px-3 py-2">Date</th><th className="px-3 py-2">Item</th>
              <th className="px-3 py-2">Qty</th><th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2">Notes</th>
            </tr></thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="px-3 py-1.5">{p.date}</td>
                  <td className="px-3 py-1.5 font-medium">{p.itemName}</td>
                  <td className="px-3 py-1.5">{p.qty}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{paiseToCurrency(p.amountPaise)}</td>
                  <td className="px-3 py-1.5 text-gray-500">{p.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
    </div>
  )
}
