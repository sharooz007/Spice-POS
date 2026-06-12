// src/renderer/screens/WholesaleBilling/index.tsx
import { useState, useEffect, type ReactElement } from 'react'
import { useAppStore } from '../../store/appStore'
import { paiseToCurrency, formatQuantity, bulkUnit } from '@shared/money'
import CustomerAutocomplete from '../../components/CustomerAutocomplete'
import SplitPaymentModal from '../../components/SplitPaymentModal'
import type { Product, BulkStockRow, RetailStockRow, SavedInvoice, CustomerRow } from '@shared/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PacketSel { variantId: number; pcs: number }

interface ProductOrder {
  productId: number
  totalKgStr: string        // user input
  bulkKgStr: string         // user input — portion from bulk
  packetSels: PacketSel[]   // variant picks
  ratePaise: number         // wholesaleRatePerKgPaise, editable
  rateStr: string
}

type PayMode = 'cash' | 'upi' | 'card' | 'split' | 'credit' | 'partial'

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseKg(s: string): number { return Math.round((parseFloat(s) || 0) * 1000) }

function orderLineTotal(o: ProductOrder, products: Product[]): number {
  const p = products.find((x) => x.id === o.productId)
  if (!p) return 0
  const bulkG = parseKg(o.bulkKgStr)
  const packetG = o.packetSels.reduce((s, sel) => {
    const v = p.variants.find((v) => v.id === sel.variantId)
    return s + (v ? v.weightGrams * sel.pcs : 0)
  }, 0)
  return Math.round(o.ratePaise * (bulkG + packetG) / 1000)
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function WholesaleBillingScreen(): ReactElement {
  const { user } = useAppStore()

  const [products, setProducts] = useState<Product[]>([])
  const [bulkMap, setBulkMap] = useState<Record<number, BulkStockRow>>({})
  const [retailMap, setRetailMap] = useState<Record<number, RetailStockRow>>({})

  const [orders, setOrders] = useState<ProductOrder[]>([])
  const [activeProductId, setActiveProductId] = useState<number | null>(null)
  const [draft, setDraft] = useState<ProductOrder | null>(null)

  const [discountStr, setDiscountStr] = useState('')
  const [discountPaise, setDiscountPaise] = useState(0)
  const [discountType, setDiscountType] = useState<'amount' | 'pct'>('amount')
  const [payMode, setPayMode] = useState<PayMode>('cash')
  const [amountPaidStr, setAmountPaidStr] = useState('')
  const [splitSummary, setSplitSummary] = useState('')
  const [showSplitModal, setShowSplitModal] = useState(false)
  const [splitRows, setSplitRows] = useState<Array<{ mode: string; amount: number }>>([])

  const [selectedPartyId, setSelectedPartyId] = useState<number | null>(null)
  const [partyName, setPartyName] = useState('')
  const [partyPhone, setPartyPhone] = useState('')
  const [partyHadBlankPhone, setPartyHadBlankPhone] = useState(false)

  const [lastInvoice, setLastInvoice] = useState<SavedInvoice | null>(null)
  const [saleError, setSaleError] = useState('')
  const [loading, setLoading] = useState(false)

  async function loadBase(): Promise<void> {
    const [pRes, bRes, rRes] = await Promise.all([
      window.api.products.listProducts(),
      window.api.bulkInventory.listAllBulkStock(),
      window.api.retailInventory.getStock()
    ])
    if (pRes.ok) setProducts(pRes.data)
    if (bRes.ok) {
      const m: Record<number, BulkStockRow> = {}
      for (const s of bRes.data) m[s.productId] = s
      setBulkMap(m)
    }
    if (rRes.ok) {
      const m: Record<number, RetailStockRow> = {}
      for (const s of rRes.data) m[s.variantId] = s
      setRetailMap(m)
    }
  }

  useEffect(() => { loadBase() }, [])

  const enabledProducts = products.filter((p) => p.enabled)

  // ── Start editing a product order ────────────────────────────────────────────

  function startOrder(productId: number): void {
    setActiveProductId(productId)
    const existing = orders.find((o) => o.productId === productId)
    if (existing) {
      setDraft({ ...existing })
    } else {
      const p = products.find((x) => x.id === productId)!
      const rateStr = (p.wholesaleRatePerKgPaise / 100).toFixed(2)
      setDraft({ productId, totalKgStr: '', bulkKgStr: '', packetSels: [], ratePaise: p.wholesaleRatePerKgPaise, rateStr })
    }
  }

  function updateDraftBulkKg(val: string): void {
    if (!draft) return
    setDraft({ ...draft, bulkKgStr: val })
  }

  function updateDraftTotalKg(val: string): void {
    if (!draft) return
    // Auto-fill bulk kg with min(totalKg, bulkAvailable)
    const totalG = parseKg(val)
    const bulkAvailG = bulkMap[draft.productId]?.qtyGrams ?? 0
    const autoBulkG = Math.min(totalG, bulkAvailG)
    const autoBulkKgStr = autoBulkG > 0 ? (autoBulkG / 1000).toFixed(3) : ''
    setDraft({ ...draft, totalKgStr: val, bulkKgStr: autoBulkKgStr })
  }

  function updateDraftRate(val: string): void {
    if (!draft) return
    setDraft({ ...draft, rateStr: val, ratePaise: Math.round((parseFloat(val) || 0) * 100) })
  }

  function updatePacketSel(variantId: number, pcs: number): void {
    if (!draft) return
    const next = draft.packetSels.filter((s) => s.variantId !== variantId)
    if (pcs > 0) next.push({ variantId, pcs })
    setDraft({ ...draft, packetSels: next })
  }

  function confirmDraft(): void {
    if (!draft) return
    setOrders((prev) => {
      const filtered = prev.filter((o) => o.productId !== draft.productId)
      const bulkG = parseKg(draft.bulkKgStr)
      const hasPackets = draft.packetSels.some((s) => s.pcs > 0)
      if (bulkG <= 0 && !hasPackets) return filtered // remove if empty
      return [...filtered, draft]
    })
    setDraft(null)
    setActiveProductId(null)
  }

  function removeOrder(productId: number): void {
    setOrders((prev) => prev.filter((o) => o.productId !== productId))
    if (activeProductId === productId) { setDraft(null); setActiveProductId(null) }
  }

  // ── Totals ───────────────────────────────────────────────────────────────────

  const subtotalPaise = orders.reduce((s, o) => s + orderLineTotal(o, products), 0)
  const totalPaise = subtotalPaise - discountPaise
  const amountPaid = payMode === 'split' ? totalPaise : Math.round(parseFloat(amountPaidStr || '0') * 100)

  // Recompute % discount when subtotal changes
  useEffect(() => {
    if (discountType === 'pct') {
      const n = parseFloat(discountStr) || 0
      setDiscountPaise(Math.round(subtotalPaise * Math.min(n, 100) / 100))
    }
  }, [subtotalPaise, discountType, discountStr])

  async function confirmSale(): Promise<void> {
    setLoading(true); setSaleError('')
    const lines: Parameters<typeof window.api.billing.createWholesaleSale>[0]['lines'] = []
    for (const o of orders) {
      const p = products.find((x) => x.id === o.productId)
      if (!p) continue
      const bulkG = parseKg(o.bulkKgStr)
      if (bulkG > 0) {
        lines.push({ itemType: 'loose_bulk', productId: o.productId, qty: bulkG, unit: 'grams', unitPricePaise: o.ratePaise })
      }
      for (const sel of o.packetSels) {
        if (sel.pcs <= 0) continue
        const v = p.variants.find((v) => v.id === sel.variantId)
        if (!v) continue
        const perPktPaise = Math.round(o.ratePaise * v.weightGrams / 1000)
        lines.push({ itemType: 'packet', variantId: sel.variantId, qty: sel.pcs, unit: 'pcs', unitPricePaise: perPktPaise })
      }
    }
    if (!lines.length) { setSaleError('No lines to submit'); setLoading(false); return }

    const res = await window.api.billing.createWholesaleSale({
      lines, discountPaise, paymentMode: payMode,
      amountPaidPaise: payMode === 'credit' ? 0 : amountPaid,
      partyId: selectedPartyId ?? undefined,
      partyName: !selectedPartyId && partyName.trim() ? partyName.trim() : undefined,
      partyPhone: !selectedPartyId && partyPhone.trim() ? partyPhone.trim() : undefined,
      userId: user!.id,
      paymentSplit: payMode === 'split' && splitRows.length ? splitRows : undefined
    })
    setLoading(false)
    if (!res.ok) { setSaleError(res.error); return }

    if (res.data.customerId && selectedPartyId && partyHadBlankPhone && partyPhone.trim()) {
      window.api.customers.updateCustomerPhone(res.data.customerId, partyPhone.trim())
    }

    setLastInvoice(res.data)
    setOrders([]); setDraft(null); setActiveProductId(null)
    setDiscountPaise(0); setDiscountStr('')
    setPartyName(''); setPartyPhone(''); setSelectedPartyId(null); setPartyHadBlankPhone(false)
    setSplitSummary(''); setPayMode('cash'); setSplitRows([])
    window.api.print.receipt({ invoiceId: res.data.id })
    loadBase()
  }

  function waLink(inv: SavedInvoice): string {
    const text = [`Invoice ${inv.invoiceNo}`, `Total: ${paiseToCurrency(inv.totalPaise)}`,
      `Paid: ${paiseToCurrency(inv.amountPaidPaise)}`,
      inv.balanceDuePaise > 0 ? `Due: ${paiseToCurrency(inv.balanceDuePaise)}` : ''
    ].filter(Boolean).join(' | ')
    return `https://wa.me/?text=${encodeURIComponent(text)}`
  }

  function onSelectParty(c: CustomerRow): void {
    setSelectedPartyId(c.id); setPartyName(c.name)
    setPartyPhone(c.phone ?? ''); setPartyHadBlankPhone(!c.phone)
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const activeProd = activeProductId ? products.find((p) => p.id === activeProductId) : null
  const bulkAvailG = activeProductId ? (bulkMap[activeProductId]?.qtyGrams ?? 0) : 0
  const bulkKgInDraft = draft ? parseKg(draft.bulkKgStr) : 0
  const totalKgInDraft = draft ? parseKg(draft.totalKgStr) : 0
  const remainingG = Math.max(0, totalKgInDraft - bulkKgInDraft)
  const selectedPacketG = draft && activeProd
    ? draft.packetSels.reduce((s, sel) => {
        const v = activeProd.variants.find((v) => v.id === sel.variantId)
        return s + (v ? v.weightGrams * sel.pcs : 0)
      }, 0)
    : 0

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="bg-amber-700 text-white px-4 py-2 flex items-center justify-between flex-shrink-0">
        <span className="font-bold text-lg">Wholesale Billing</span>
        <span className="text-amber-200 text-sm">Product-order flow · Bulk + Packets</span>
      </div>

      {lastInvoice && (
        <div className="bg-green-50 border-b border-green-200 px-4 py-2 flex items-center justify-between text-sm flex-shrink-0">
          <span className="text-green-800 font-medium">
            {lastInvoice.invoiceNo} · {paiseToCurrency(lastInvoice.totalPaise)}
            {lastInvoice.balanceDuePaise > 0 && ` · Due: ${paiseToCurrency(lastInvoice.balanceDuePaise)}`}
          </span>
          <div className="flex gap-3">
            <button onClick={() => window.open(waLink(lastInvoice), '_blank')}
              className="text-green-700 underline cursor-pointer text-xs">WhatsApp</button>
            <button onClick={() => setLastInvoice(null)} className="text-green-600 text-xs cursor-pointer">Dismiss</button>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: product list ── */}
        <div className="w-56 flex-shrink-0 border-r bg-white overflow-y-auto">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 pt-3 pb-1">Products</div>
          {enabledProducts.map((p) => {
            const inOrder = orders.some((o) => o.productId === p.id)
            const isActive = activeProductId === p.id
            const bulkG = bulkMap[p.id]?.qtyGrams ?? 0
            return (
              <div key={p.id}
                onClick={() => startOrder(p.id)}
                className={`px-3 py-2.5 cursor-pointer border-b transition-colors ${
                  isActive ? 'bg-amber-50 border-l-2 border-l-amber-600' :
                  'hover:bg-gray-50'
                }`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-800">{p.name}</span>
                  {inOrder && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">✓</span>}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Bulk: {formatQuantity(bulkG, p.unitType)}
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Center: order entry + confirmed orders ── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Order entry form */}
          {draft && activeProd && (
            <div className="border-b bg-white p-4 flex flex-col gap-3 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-gray-800">{activeProd.name}</h2>
                <span className="text-xs text-gray-500">
                  Bulk available: {formatQuantity(bulkAvailG, activeProd.unitType)} ·
                  Wholesale rate: {paiseToCurrency(activeProd.wholesaleRatePerKgPaise)}/{bulkUnit(activeProd.unitType)}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-600">Total ordered ({bulkUnit(activeProd.unitType)})</label>
                  <input type="number" step="0.001" min="0" value={draft.totalKgStr}
                    onChange={(e) => updateDraftTotalKg(e.target.value)}
                    autoFocus
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-600">
                    From bulk ({bulkUnit(activeProd.unitType)}) — max {formatQuantity(bulkAvailG, activeProd.unitType)}
                  </label>
                  <input type="number" step="0.001" min="0"
                    max={(bulkAvailG / 1000).toFixed(3)}
                    value={draft.bulkKgStr}
                    onChange={(e) => updateDraftBulkKg(e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-600">Rate (₹/{bulkUnit(activeProd.unitType)})</label>
                  <input type="number" step="0.01" min="0" value={draft.rateStr}
                    onChange={(e) => updateDraftRate(e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
                </div>
              </div>

              {/* Packet section — always visible */}
              {activeProd.variants.some((v) => v.enabled) && (
                <div className="bg-amber-50 border border-amber-200 rounded p-3">
                  {remainingG > 0 ? (
                    <div className="text-xs font-semibold text-amber-800 mb-2">
                      To fill from packets: {formatQuantity(remainingG, activeProd.unitType)}
                      {selectedPacketG > 0 && (
                        <span className={`ml-2 ${Math.abs(selectedPacketG - remainingG) <= 10 ? 'text-green-700' : 'text-amber-600'}`}>
                          · Selected: {formatQuantity(selectedPacketG, activeProd.unitType)}
                          {selectedPacketG !== remainingG && ` (${selectedPacketG > remainingG ? '+' : ''}${formatQuantity(selectedPacketG - remainingG, activeProd.unitType)})`}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs font-semibold text-amber-700 mb-2">
                      Also use from packets (optional)
                      {selectedPacketG > 0 && (
                        <span className="ml-2 text-gray-600">· {formatQuantity(selectedPacketG, activeProd.unitType)} selected</span>
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {activeProd.variants.filter((v) => v.enabled).map((v) => {
                      const stock = retailMap[v.id]?.qtyPcs ?? 0
                      const sel = draft.packetSels.find((s) => s.variantId === v.id)
                      const pcs = sel?.pcs ?? 0
                      return (
                        <div key={v.id} className="flex items-center gap-2">
                          <div className="flex-1 text-xs">
                            <div className="font-medium">{v.label}</div>
                            <div className="text-gray-500">{stock} pcs avail</div>
                          </div>
                          <input type="number" min="0" max={stock} value={pcs || ''}
                            onChange={(e) => updatePacketSel(v.id, parseInt(e.target.value) || 0)}
                            placeholder="0"
                            className="w-16 border border-gray-300 rounded px-2 py-1 text-sm text-center" />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={confirmDraft}
                  className="bg-amber-600 text-white px-4 py-1.5 rounded text-sm cursor-pointer hover:bg-amber-700 transition-colors">
                  {orders.some((o) => o.productId === draft.productId) ? 'Update Order' : 'Add to Order'}
                </button>
                <button onClick={() => { setDraft(null); setActiveProductId(null) }}
                  className="px-4 py-1.5 border rounded text-sm cursor-pointer">
                  Cancel
                </button>
                {orders.some((o) => o.productId === draft.productId) && (
                  <button onClick={() => removeOrder(draft.productId)}
                    className="px-4 py-1.5 border border-red-300 text-red-600 rounded text-sm cursor-pointer hover:bg-red-50 transition-colors">
                    Remove
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Confirmed orders table */}
          <div className="flex-1 overflow-y-auto p-4">
            {orders.length === 0 && !draft && (
              <p className="text-sm text-gray-400">Select a product from the left to start an order.</p>
            )}
            {orders.length > 0 && (
              <div className="border rounded-lg bg-white overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr className="text-left text-xs text-gray-500 uppercase tracking-wide">
                      <th className="px-3 py-2">Product</th>
                      <th className="px-3 py-2">Bulk</th>
                      <th className="px-3 py-2">Packets</th>
                      <th className="px-3 py-2 text-right">Rate</th>
                      <th className="px-3 py-2 text-right">Total</th>
                      <th className="px-3 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => {
                      const p = products.find((x) => x.id === o.productId)
                      if (!p) return null
                      const bulkG = parseKg(o.bulkKgStr)
                      const packetDesc = o.packetSels
                        .filter((s) => s.pcs > 0)
                        .map((s) => {
                          const v = p.variants.find((v) => v.id === s.variantId)
                          return v ? `${s.pcs}×${v.label}` : ''
                        }).join(', ')
                      return (
                        <tr key={o.productId} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium cursor-pointer" onClick={() => startOrder(o.productId)}>
                            {p.name}
                          </td>
                          <td className="px-3 py-2 text-gray-600">
                            {bulkG > 0 ? formatQuantity(bulkG, p.unitType) : '—'}
                          </td>
                          <td className="px-3 py-2 text-gray-600 text-xs">{packetDesc || '—'}</td>
                          <td className="px-3 py-2 text-right font-mono text-xs">
                            {paiseToCurrency(o.ratePaise)}/{bulkUnit(p.unitType)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-semibold">
                            {paiseToCurrency(orderLineTotal(o, products))}
                          </td>
                          <td className="px-3 py-2">
                            <button onClick={() => removeOrder(o.productId)}
                              className="text-red-400 hover:text-red-600 cursor-pointer text-lg leading-none">×</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: payment panel ── */}
        <div className="w-72 flex-shrink-0 border-l bg-white flex flex-col p-4 gap-4 overflow-y-auto">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-600">Discount</label>
              <div className="flex gap-1">
                {(['amount', 'pct'] as const).map((t) => (
                  <button key={t} type="button" onClick={() => { setDiscountType(t); setDiscountStr(''); setDiscountPaise(0) }}
                    className={`px-2 py-0.5 rounded text-xs font-medium border cursor-pointer transition-colors ${
                      discountType === t ? 'bg-amber-600 text-white border-amber-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
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

          <div className="border-t pt-3 flex flex-col gap-1 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span><span className="font-mono">{paiseToCurrency(subtotalPaise)}</span>
            </div>
            {discountPaise > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>Discount</span>
                <span className="font-mono text-red-500">
                  {discountType === 'pct'
                    ? `−${parseFloat(discountStr) || 0}% (−${paiseToCurrency(discountPaise)})`
                    : `− ${paiseToCurrency(discountPaise)}`}
                </span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base border-t mt-1 pt-1">
              <span>Total</span><span className="font-mono">{paiseToCurrency(totalPaise)}</span>
            </div>
          </div>

          <div className="border-t pt-3">
            <CustomerAutocomplete
              type="wholesale"
              name={partyName}
              phone={partyPhone}
              onNameChange={setPartyName}
              onPhoneChange={setPartyPhone}
              onSelect={onSelectParty}
              onClearSelection={() => { setSelectedPartyId(null); setPartyHadBlankPhone(false) }}
              nameLabel="Party (optional)"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Payment mode</label>
            <div className="grid grid-cols-3 gap-1">
              {(['cash', 'upi', 'card', 'split', 'credit', 'partial'] as PayMode[]).map((m) => (
                <button key={m} onClick={() => {
                  setPayMode(m)
                  setSplitSummary('')
                  if (m === 'split') setShowSplitModal(true)
                  else setAmountPaidStr(m === 'credit' ? '0.00' : (totalPaise / 100).toFixed(2))
                }}
                  className={`py-1.5 rounded text-xs font-medium cursor-pointer transition-colors border ${
                    payMode === m ? 'bg-amber-600 text-white border-amber-600' : 'border-gray-300 hover:bg-gray-50'
                  }`}>
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
            {payMode === 'split' && splitSummary && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 border border-amber-200">{splitSummary}</p>
            )}
          </div>

          {payMode === 'split' ? null : payMode !== 'credit' ? (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Amount Paid (₹)</label>
              <input type="number" step="0.01" value={amountPaidStr}
                onChange={(e) => setAmountPaidStr(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400" />
            </div>
          ) : (
            <p className="text-xs text-amber-700 bg-amber-50 rounded px-3 py-2 border border-amber-200">
              Full amount goes to party dues. No cash collected.
            </p>
          )}

          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Balance due</span>
            <span className={`font-mono font-semibold ${(totalPaise - (payMode === 'credit' ? 0 : amountPaid)) > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {paiseToCurrency(Math.max(0, totalPaise - (payMode === 'credit' ? 0 : amountPaid)))}
            </span>
          </div>

          {saleError && <p className="text-sm text-red-600">{saleError}</p>}

          <button onClick={confirmSale}
            disabled={orders.length === 0 || loading}
            className="bg-green-600 disabled:bg-green-300 text-white font-bold py-3 rounded-lg cursor-pointer hover:bg-green-700 disabled:cursor-not-allowed transition-colors">
            {loading ? 'Processing…' : 'Confirm Sale'}
          </button>
        </div>
      </div>

      {showSplitModal && (
        <SplitPaymentModal
          totalPaise={totalPaise}
          accentClass="amber"
          onConfirm={(rows, summary) => { setSplitRows(rows.map((r) => ({ mode: r.method, amount: r.amountPaise }))); setSplitSummary(summary); setShowSplitModal(false) }}
          onCancel={() => { setPayMode('cash'); setShowSplitModal(false) }}
        />
      )}
    </div>
  )
}
