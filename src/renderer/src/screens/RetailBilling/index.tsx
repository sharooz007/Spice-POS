import {
  useState, useEffect, useRef, useCallback,
  type ReactElement, type KeyboardEvent, type ChangeEvent
} from 'react'
import { useAppStore } from '../../store/appStore'
import { paiseToCurrency } from '@shared/money'
import CustomerAutocomplete from '../../components/CustomerAutocomplete'
import SplitPaymentModal from '../../components/SplitPaymentModal'
import type { BarcodeResult, SavedInvoice, RetailItemRow, CustomerRow } from '@shared/types'

interface BillEntry extends BarcodeResult {
  qtyPcs: number
  lineTotal: number
}

type PayMode = 'cash' | 'upi' | 'card' | 'split'

export default function RetailBillingScreen(): ReactElement {
  const { user } = useAppStore()

  const [lines, setLines] = useState<BillEntry[]>([])
  const [barcodeInput, setBarcodeInput] = useState('')
  const [barcodeError, setBarcodeError] = useState('')
  const [discountPaise, setDiscountPaise] = useState(0)
  const [discountType, setDiscountType] = useState<'amount' | 'pct'>('amount')
  const [discountStr, setDiscountStr] = useState('')

  // Inline payment
  const [payMode, setPayMode] = useState<PayMode>('cash')
  const [amountPaidStr, setAmountPaidStr] = useState('')
  const [splitSummary, setSplitSummary] = useState('')
  const [showSplitModal, setShowSplitModal] = useState(false)
  const [splitRows, setSplitRows] = useState<Array<{ mode: string; amount: number }>>([])

  // Customer
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null)
  const [selectedHadBlankPhone, setSelectedHadBlankPhone] = useState(false)

  const [lastInvoice, setLastInvoice] = useState<SavedInvoice | null>(null)
  const [saleError, setSaleError] = useState('')
  const [loading, setLoading] = useState(false)

  // Tile grid
  const [tileItems, setTileItems] = useState<RetailItemRow[]>([])
  const [tileSearch, setTileSearch] = useState('')

  const barcodeRef = useRef<HTMLInputElement>(null)
  const focusBarcode = useCallback(() => { setTimeout(() => barcodeRef.current?.focus(), 50) }, [])
  useEffect(() => { focusBarcode() }, [focusBarcode])

  useEffect(() => {
    window.api.billing.listRetailItems?.().then((r) => { if (r?.ok) setTileItems(r.data) })
  }, [])

  function reloadTiles(): void {
    window.api.billing.listRetailItems?.().then((r) => { if (r?.ok) setTileItems(r.data) })
  }

  const filteredTiles = tileSearch.trim()
    ? tileItems.filter((t) => `${t.productName} ${t.label}`.toLowerCase().includes(tileSearch.toLowerCase()))
    : tileItems

  const grouped = filteredTiles.reduce<Record<string, RetailItemRow[]>>((acc, t) => {
    if (!acc[t.productName]) acc[t.productName] = []
    acc[t.productName].push(t)
    return acc
  }, {})

  // Stock cap state
  const [stockCapMsg, setStockCapMsg] = useState<Record<number, string>>({})
  const [flashRed, setFlashRed] = useState<Record<number, boolean>>({})

  // Map variantId → stock from tiles (source of truth before commit)
  const stockByVariant = Object.fromEntries(tileItems.map((t) => [t.variantId, t.qtyPcs]))

  function availableStock(variantId: number): number {
    const inCart = lines.find((l) => l.variantId === variantId)?.qtyPcs ?? 0
    return (stockByVariant[variantId] ?? 0) - inCart
  }

  function addLine(item: BarcodeResult): void {
    setLines((prev) => {
      const stock = stockByVariant[item.variantId] ?? 0
      const idx = prev.findIndex((l) => l.variantId === item.variantId)
      const currentQty = idx >= 0 ? prev[idx].qtyPcs : 0
      if (currentQty >= stock) {
        // Flash the tile red
        setFlashRed((f) => ({ ...f, [item.variantId]: true }))
        setTimeout(() => setFlashRed((f) => ({ ...f, [item.variantId]: false })), 500)
        return prev
      }
      if (idx >= 0) {
        return prev.map((l, i) =>
          i === idx ? { ...l, qtyPcs: l.qtyPcs + 1, lineTotal: (l.qtyPcs + 1) * l.currentRetailPricePaise } : l)
      }
      return [...prev, { ...item, qtyPcs: 1, lineTotal: item.currentRetailPricePaise }]
    })
  }

  function addFromTile(t: RetailItemRow): void {
    addLine({
      variantId: t.variantId, productId: 0, label: t.label, productName: t.productName,
      weightGrams: t.weightGrams, currentRetailPricePaise: t.retailPricePaise
    })
    focusBarcode()
  }

  async function handleBarcodeScan(e: KeyboardEvent<HTMLInputElement>): Promise<void> {
    if (e.key !== 'Enter') return
    const code = barcodeInput.trim()
    setBarcodeInput('')
    if (!code) return
    const res = await window.api.billing.lookupBarcode({ barcode: code })
    if (!res.ok) { setBarcodeError(res.error); focusBarcode(); return }
    if (!res.data) { setBarcodeError(`Barcode not found: ${code}`); focusBarcode(); return }
    setBarcodeError('')
    addLine(res.data)
    focusBarcode()
  }

  function updateQty(variantId: number, qty: number): void {
    const stock = stockByVariant[variantId] ?? 0
    const capped = Math.min(qty, stock)
    if (qty > stock) {
      setStockCapMsg((m) => ({ ...m, [variantId]: `Only ${stock} available` }))
      setTimeout(() => setStockCapMsg((m) => ({ ...m, [variantId]: '' })), 2500)
    }
    if (capped <= 0) setLines((p) => p.filter((l) => l.variantId !== variantId))
    else setLines((p) => p.map((l) =>
      l.variantId === variantId ? { ...l, qtyPcs: capped, lineTotal: capped * l.currentRetailPricePaise } : l))
  }

  const subtotalPaise = lines.reduce((s, l) => s + l.lineTotal, 0)
  const totalPaise = subtotalPaise - discountPaise
  const amountPaid = payMode === 'split' ? totalPaise : Math.round(parseFloat(amountPaidStr || '0') * 100)
  const balance = totalPaise - amountPaid

  // Keep amount-paid in sync with total unless the user has typed something
  useEffect(() => {
    setAmountPaidStr((totalPaise / 100).toFixed(2))
  }, [totalPaise])

  // Recompute % discount when subtotal changes
  useEffect(() => {
    if (discountType === 'pct') {
      const n = parseFloat(discountStr) || 0
      setDiscountPaise(Math.round(subtotalPaise * Math.min(n, 100) / 100))
    }
  }, [subtotalPaise, discountType, discountStr])

  function onSelectCustomer(c: CustomerRow): void {
    setSelectedCustomerId(c.id)
    setCustomerName(c.name)
    setCustomerPhone(c.phone ?? '')
    setSelectedHadBlankPhone(!c.phone)
  }

  function onClearSelection(): void {
    setSelectedCustomerId(null)
    setSelectedHadBlankPhone(false)
  }

  async function confirmSale(): Promise<void> {
    if (!lines.length) return
    setLoading(true); setSaleError('')

    const res = await window.api.billing.createRetailSale({
      lines: lines.map((l) => ({ variantId: l.variantId, qtyPcs: l.qtyPcs, unitPricePaise: l.currentRetailPricePaise })),
      discountPaise,
      paymentMode: payMode,
      amountPaidPaise: amountPaid,
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      customerId: selectedCustomerId ?? undefined,
      userId: user!.id,
      paymentSplit: payMode === 'split' && splitRows.length ? splitRows : undefined
    })
    setLoading(false)
    if (!res.ok) { setSaleError(res.error); return }

    // After commit: if a returning customer had a blank phone and a phone was entered, update it.
    if (res.data.customerId && selectedHadBlankPhone && customerPhone.trim()) {
      window.api.customers.updateCustomerPhone(res.data.customerId, customerPhone.trim())
    }

    setLastInvoice(res.data)
    setLines([]); setDiscountPaise(0); setDiscountStr('')
    setCustomerName(''); setCustomerPhone(''); setSelectedCustomerId(null); setSelectedHadBlankPhone(false)
    setSplitSummary(''); setPayMode('cash'); setSplitRows([])
    window.api.print.receipt({ invoiceId: res.data.id })
    reloadTiles()
    focusBarcode()
  }

  function waLink(inv: SavedInvoice): string {
    return `https://wa.me/?text=${encodeURIComponent(`Invoice ${inv.invoiceNo} | Total: ${paiseToCurrency(inv.totalPaise)}`)}`
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="bg-indigo-700 text-white px-4 py-2 flex items-center justify-between flex-shrink-0">
        <span className="font-bold text-lg">Retail Billing</span>
        <span className="text-indigo-200 text-sm">Packed items only</span>
      </div>

      {lastInvoice && (
        <div className="bg-green-50 border-b border-green-200 px-4 py-2 flex items-center justify-between text-sm flex-shrink-0">
          <span className="text-green-800 font-medium">{lastInvoice.invoiceNo} · {paiseToCurrency(lastInvoice.totalPaise)}</span>
          <div className="flex gap-3">
            <a href={waLink(lastInvoice)} target="_blank" rel="noopener noreferrer"
              onClick={() => window.open(waLink(lastInvoice), '_blank')}
              className="text-green-700 underline cursor-pointer text-xs">WhatsApp</a>
            <button onClick={() => setLastInvoice(null)} className="text-green-600 text-xs cursor-pointer">Dismiss</button>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Tile grid sidebar */}
        <div className="flex flex-col w-72 flex-shrink-0 border-r bg-white overflow-hidden">
          <div className="p-3 border-b flex-shrink-0">
            <div className="relative">
              <input ref={barcodeRef} value={barcodeInput}
                onChange={(e: ChangeEvent<HTMLInputElement>) => { setBarcodeInput(e.target.value); setBarcodeError('') }}
                onKeyDown={handleBarcodeScan}
                placeholder="Scan barcode + Enter"
                className="w-full border-2 border-indigo-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-600 font-mono" />
              {barcodeError && (
                <div className="absolute left-0 top-full mt-1 text-xs text-red-600 bg-white border border-red-200 rounded px-2 py-1 z-10 w-full">{barcodeError}</div>
              )}
            </div>
          </div>
          <div className="px-3 py-2 border-b flex-shrink-0">
            <input value={tileSearch} onChange={(e) => setTileSearch(e.target.value)} placeholder="Search items…"
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300" />
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {Object.entries(grouped).map(([productName, variants]) => (
              <div key={productName} className="mb-3">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1 mb-1">{productName}</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {variants.map((t) => {
                    const avail = availableStock(t.variantId)
                    const soldOut = avail <= 0
                    const isFlashing = flashRed[t.variantId]
                    return (
                      <button key={t.variantId}
                        onClick={() => !soldOut && addFromTile(t)}
                        disabled={soldOut}
                        className={`text-left border rounded-lg p-2 transition-colors ${
                          isFlashing ? 'bg-red-100 border-red-400' :
                          soldOut ? 'bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed' :
                          'border-gray-200 hover:bg-indigo-50 hover:border-indigo-300 cursor-pointer bg-white'
                        }`}>
                        <div className="text-xs font-medium text-gray-800 truncate">{t.label}</div>
                        <div className="text-xs font-bold text-indigo-700">{paiseToCurrency(t.retailPricePaise)}</div>
                        <div className={`text-xs ${soldOut ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                          {soldOut ? 'Out of stock' : `${avail} avail`}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
            {filteredTiles.length === 0 && (
              <p className="text-xs text-gray-400 p-2">{tileSearch ? 'No matches.' : 'No stock available.'}</p>
            )}
          </div>
        </div>

        {/* Centre: bill lines */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto">
            {lines.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">Scan a barcode or tap a tile to start billing</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 border-b">
                  <tr className="text-left text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2 w-24">Qty</th>
                    <th className="px-3 py-2 text-right">Price</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.variantId} className="border-b last:border-0">
                      <td className="px-3 py-2">
                        <div className="font-medium">{l.productName}</div>
                        <div className="text-xs text-gray-500">{l.label}</div>
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min="1" value={l.qtyPcs}
                          onChange={(e) => updateQty(l.variantId, parseInt(e.target.value) || 0)}
                          className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                        {stockCapMsg[l.variantId] && (
                          <div className="text-xs text-amber-700 mt-0.5">{stockCapMsg[l.variantId]}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{paiseToCurrency(l.currentRetailPricePaise)}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold">{paiseToCurrency(l.lineTotal)}</td>
                      <td className="px-3 py-2">
                        <button onClick={() => { setLines((p) => p.filter((x) => x.variantId !== l.variantId)); focusBarcode() }}
                          className="text-red-400 hover:text-red-600 cursor-pointer text-lg leading-none">×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right: inline payment panel */}
        <div className="w-72 flex-shrink-0 border-l bg-white flex flex-col p-4 gap-4 overflow-y-auto">
          {/* Discount */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-600">Discount</label>
              <div className="flex gap-1">
                {(['amount', 'pct'] as const).map((t) => (
                  <button key={t} type="button" onClick={() => { setDiscountType(t); setDiscountStr(''); setDiscountPaise(0) }}
                    className={`px-2 py-0.5 rounded text-xs font-medium border cursor-pointer transition-colors ${
                      discountType === t ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}>
                    {t === 'amount' ? '₹' : '%'}
                  </button>
                ))}
              </div>
            </div>
            <input type="number" step={discountType === 'pct' ? '0.1' : '0.01'} min="0" max={discountType === 'pct' ? '100' : undefined}
              value={discountStr}
              onChange={(e) => {
                const v = e.target.value
                setDiscountStr(v)
                const n = parseFloat(v) || 0
                setDiscountPaise(discountType === 'pct'
                  ? Math.round(subtotalPaise * Math.min(n, 100) / 100)
                  : Math.round(n * 100))
              }}
              placeholder={discountType === 'pct' ? '0 – 100' : '0.00'}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
          </div>

          {/* Totals */}
          <div className="border-t pt-3 flex flex-col gap-1 text-sm">
            <div className="flex justify-between text-gray-600"><span>Subtotal</span><span className="font-mono">{paiseToCurrency(subtotalPaise)}</span></div>
            {discountPaise > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>Discount</span>
                <span className="font-mono text-red-500">
                  {discountType === 'pct'
                    ? `−${parseFloat(discountStr) || 0}% (−${paiseToCurrency(discountPaise)})`
                    : `- ${paiseToCurrency(discountPaise)}`}
                </span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base border-t mt-1 pt-1"><span>Total</span><span className="font-mono">{paiseToCurrency(totalPaise)}</span></div>
          </div>

          {/* Customer autocomplete */}
          <div className="border-t pt-3">
            <CustomerAutocomplete
              type="retail"
              name={customerName}
              phone={customerPhone}
              onNameChange={setCustomerName}
              onPhoneChange={setCustomerPhone}
              onSelect={onSelectCustomer}
              onClearSelection={onClearSelection}
            />
          </div>

          {/* Payment mode */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Payment mode</label>
            <div className="flex gap-1">
              {(['cash', 'upi', 'card', 'split'] as PayMode[]).map((m) => (
                <button key={m} onClick={() => {
                  setPayMode(m)
                  setSplitSummary('')
                  if (m === 'split') setShowSplitModal(true)
                }}
                  className={`flex-1 py-1.5 rounded text-xs font-medium cursor-pointer transition-colors border ${payMode === m ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 hover:bg-gray-50'}`}>
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
            {payMode === 'split' && splitSummary && (
              <p className="text-xs text-indigo-700 bg-indigo-50 rounded px-2 py-1 border border-indigo-200">{splitSummary}</p>
            )}
          </div>

          {/* Amount paid — hidden for split (fully paid) */}
          {payMode !== 'split' && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Amount Paid (₹)</label>
              <input type="number" step="0.01" value={amountPaidStr}
                onChange={(e) => setAmountPaidStr(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400" />
            </div>
          )}

          {/* Balance due */}
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Balance due</span>
            <span className={`font-mono font-semibold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {paiseToCurrency(Math.max(0, balance))}
            </span>
          </div>

          {saleError && <p className="text-sm text-red-600">{saleError}</p>}

          <button onClick={confirmSale} disabled={!lines.length || loading}
            className="bg-green-600 disabled:bg-green-300 text-white font-bold py-3 rounded-lg cursor-pointer hover:bg-green-700 disabled:cursor-not-allowed transition-colors">
            {loading ? 'Processing…' : 'Confirm Sale'}
          </button>
        </div>
      </div>

      {showSplitModal && (
        <SplitPaymentModal
          totalPaise={totalPaise}
          accentClass="indigo"
          onConfirm={(rows, summary) => { setSplitRows(rows.map((r) => ({ mode: r.method, amount: r.amountPaise }))); setSplitSummary(summary); setShowSplitModal(false) }}
          onCancel={() => { setPayMode('cash'); setShowSplitModal(false) }}
        />
      )}
    </div>
  )
}
