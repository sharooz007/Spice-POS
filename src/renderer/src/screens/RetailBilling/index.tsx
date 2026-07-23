// @ts-nocheck
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

type PayMode = 'cash' | 'upi' | 'card' | 'credit' | 'split'

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
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
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
      variantId: t.variantId, productId: '', label: t.label, productName: t.productName,
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

    if ((payMode === 'credit' || amountPaid < totalPaise) && (!customerName.trim() || !customerPhone.trim())) {
      setSaleError('Customer name and phone number are required for credit or partial payments')
      setLoading(false)
      return
    }

    const res = await window.api.billing.createRetailSale({
      lines: lines.map((l) => ({ variantId: l.variantId, qtyPcs: l.qtyPcs, unitPricePaise: l.currentRetailPricePaise })),
      discountPaise,
      paymentMode: payMode,
      amountPaidPaise: payMode === 'credit' ? 0 : amountPaid,
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
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: 'calc(100dvh - 96px)',
      height: 'calc(100dvh - 96px)',
      background: 'var(--bg-base)',
      padding: '0.875rem',
      gap: '0.75rem',
      overflow: 'hidden',
    }}>

      {/* Success banner */}
      {lastInvoice && (
        <div className="success-banner" style={{ borderRadius: 'var(--r-md)', flexShrink: 0 }}>
          <span style={{ fontWeight: 500 }}>{lastInvoice.invoiceNo} - {paiseToCurrency(lastInvoice.totalPaise)} collected</span>
          <div style={{ display: 'flex', gap: '0.75rem', flexShrink: 0 }}>
            <button onClick={() => window.open(waLink(lastInvoice), '_blank')}
              style={{ fontSize: '0.75rem', color: 'oklch(0.42 0.18 145)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              WhatsApp
            </button>
            <button onClick={() => setLastInvoice(null)}
              style={{ fontSize: '0.75rem', color: 'oklch(0.5 0.1 145)', background: 'none', border: 'none', cursor: 'pointer' }}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'clamp(280px, 17vw, 340px) minmax(420px, 1fr) clamp(300px, 17vw, 340px)',
        gap: '0.75rem',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
      }}>

        {/* Left: product tiles */}
        <div className="card" style={{
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: 'var(--r-lg)',
          minHeight: 0,
        }}>
          {/* Barcode input */}
          <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            <div style={{ position: 'relative' }}>
              <input ref={barcodeRef} value={barcodeInput}
                onChange={(e: ChangeEvent<HTMLInputElement>) => { setBarcodeInput(e.target.value); setBarcodeError('') }}
                onKeyDown={handleBarcodeScan}
                placeholder="Scan barcode + Enter"
                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', letterSpacing: '0.02em' }}
              />
              {barcodeError && (
                <div style={{ position: 'absolute', left: 0, top: '100%', marginTop: 4, zIndex: 10, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '0.375rem 0.625rem', fontSize: '0.75rem', color: 'var(--red)', width: '100%', boxShadow: 'var(--shadow-sm)' }}>
                  {barcodeError}
                </div>
              )}
            </div>
            <input value={tileSearch} onChange={(e) => setTileSearch(e.target.value)} placeholder="Search items" />
          </div>
          {/* Tiles */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', minHeight: 0 }}>
            {Object.entries(grouped).map(([productName, variants]) => (
              <div key={productName} style={{ marginBottom: '1rem' }}>
                <div className="section-label">{productName}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))', gap: '0.5rem' }}>
                  {variants.map((t) => {
                    const avail = availableStock(t.variantId)
                    const soldOut = avail <= 0
                    const isFlashing = flashRed[t.variantId]
                    return (
                      <button
                        key={t.variantId}
                        className={`pos-tile${isFlashing ? ' flash-red' : ''}`}
                        onClick={() => !soldOut && addFromTile(t)}
                        disabled={soldOut}
                        style={{
                          minHeight: 72,
                          padding: '0.625rem',
                          ...(soldOut ? { opacity: 0.4, cursor: 'not-allowed' } : {})
                        }}
                      >
                        <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--ink-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.label}</div>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>{paiseToCurrency(t.retailPricePaise)}</div>
                        <div style={{ fontSize: '0.6875rem', color: soldOut ? 'var(--red)' : 'var(--ink-4)', marginTop: 1 }}>
                          {soldOut ? 'Out of stock' : `${avail} avail`}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
            {filteredTiles.length === 0 && (
              <p style={{ fontSize: '0.8125rem', color: 'var(--ink-4)', padding: '0.5rem 0.25rem' }}>
                {tileSearch ? 'No matches.' : 'No stock available.'}
              </p>
            )}
          </div>
        </div>

        {/* Centre: bill lines */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 'var(--r-lg)', minHeight: 0 }}>
          <div style={{
            padding: '0.875rem 1rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 650, color: 'var(--ink-1)' }}>Current Bill</h2>
              <p style={{ margin: '0.125rem 0 0', fontSize: '0.75rem', color: 'var(--ink-3)' }}>
                {lines.length ? `${lines.length} item${lines.length === 1 ? '' : 's'} in cart` : 'Ready for scan or tile selection'}
              </p>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 700, color: 'var(--ink-1)', fontVariantNumeric: 'tabular-nums' }}>
              {paiseToCurrency(totalPaise)}
            </span>
          </div>
          {lines.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '0.625rem', minHeight: 0 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 32, height: 32, color: 'var(--ink-4)' }}>
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink-2)' }}>No items added</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--ink-3)', marginTop: 2 }}>Scan a barcode or select a product tile.</div>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th style={{ width: 88 }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Price</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th style={{ width: 32 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.variantId}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{l.productName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--ink-3)' }}>{l.label}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <input type="number" min="1" value={l.qtyPcs}
                            onChange={(e) => updateQty(l.variantId, parseInt(e.target.value) || 0)}
                            style={{ width: 72, textAlign: 'center' }} />
                          {stockCapMsg[l.variantId] && (
                            <div style={{ fontSize: '0.6875rem', color: 'var(--amber)' }}>{stockCapMsg[l.variantId]}</div>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>{paiseToCurrency(l.currentRetailPricePaise)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{paiseToCurrency(l.lineTotal)}</td>
                      <td>
                        <button onClick={() => { setLines((p) => p.filter((x) => x.variantId !== l.variantId)); focusBarcode() }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', fontSize: '1.125rem', lineHeight: 1, padding: '0 0.25rem' }}
                          onMouseEnter={(e) => ((e.target as HTMLButtonElement).style.color = 'var(--red)')}
                          onMouseLeave={(e) => ((e.target as HTMLButtonElement).style.color = 'var(--ink-4)')}
                        >×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right: payment panel */}
        <div className="card" style={{
          display: 'flex',
          flexDirection: 'column',
          padding: '1rem',
          gap: '0.875rem',
          overflowY: 'auto',
          borderRadius: 'var(--r-lg)',
          minHeight: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 650, color: 'var(--ink-1)' }}>Checkout</h2>
              <p style={{ margin: '0.125rem 0 0', fontSize: '0.75rem', color: 'var(--ink-3)' }}>Retail sale payment</p>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--green)' }}>
              {paiseToCurrency(Math.max(0, totalPaise))}
            </span>
          </div>

          {/* Discount */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--ink-3)' }}>Discount</label>
              <div style={{ display: 'flex', gap: 3 }}>
                {(['amount', 'pct'] as const).map((t) => (
                  <button key={t} type="button"
                    onClick={() => { setDiscountType(t); setDiscountStr(''); setDiscountPaise(0) }}
                    style={{
                      padding: '0.125rem 0.5rem', borderRadius: 'var(--r-xs)', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer', border: '1px solid',
                      background: discountType === t ? 'var(--accent)' : 'transparent',
                      color: discountType === t ? '#fff' : 'var(--ink-3)',
                      borderColor: discountType === t ? 'var(--accent)' : 'var(--border)',
                    }}>
                    {t === 'amount' ? '₹' : '%'}
                  </button>
                ))}
              </div>
            </div>
            <input type="number" step={discountType === 'pct' ? '0.1' : '0.01'} min="0" max={discountType === 'pct' ? '100' : undefined}
              value={discountStr}
              onChange={(e) => {
                const v = e.target.value; setDiscountStr(v)
                const n = parseFloat(v) || 0
                setDiscountPaise(discountType === 'pct' ? Math.round(subtotalPaise * Math.min(n, 100) / 100) : Math.round(n * 100))
              }}
              placeholder={discountType === 'pct' ? '0-100' : '0.00'}
            />
          </div>

          <hr className="divider" />

          {/* Totals */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: 'var(--ink-3)' }}>
              <span>Subtotal</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>{paiseToCurrency(subtotalPaise)}</span>
            </div>
            {discountPaise > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: 'var(--red)' }}>
                <span>Discount</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>
                  {discountType === 'pct' ? `-${parseFloat(discountStr)||0}%` : `-${paiseToCurrency(discountPaise)}`}
                </span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1rem', marginTop: '0.25rem', paddingTop: '0.375rem', borderTop: '1px solid var(--border)' }}>
              <span>Total</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--ink-1)' }}>{paiseToCurrency(totalPaise)}</span>
            </div>
          </div>

          <hr className="divider" />

          {/* Customer */}
          <CustomerAutocomplete type="retail" name={customerName} phone={customerPhone}
            onNameChange={setCustomerName} onPhoneChange={setCustomerPhone}
            onSelect={onSelectCustomer} onClearSelection={onClearSelection} />

          <hr className="divider" />

          {/* Payment mode */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--ink-3)' }}>Payment</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.25rem' }}>
              {(['cash', 'upi', 'card', 'credit', 'split'] as PayMode[]).map((m) => (
                <button key={m} onClick={() => { setPayMode(m); setSplitSummary(''); if (m === 'split') setShowSplitModal(true) }}
                  style={{
                    padding: '0.625rem', borderRadius: 'var(--r-md)',
                    background: payMode === m ? 'var(--accent)' : 'var(--bg-fill)',
                    color: payMode === m ? '#fff' : 'var(--ink-2)',
                    borderColor: payMode === m ? 'var(--accent)' : 'var(--border)',
                    borderWidth: '1px', borderStyle: 'solid',
                    textTransform: 'uppercase', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer'
                  }}>
                  {m}
                </button>
              ))}
            </div>
            {payMode === 'split' && splitSummary && (
              <div style={{ fontSize: '0.75rem', color: 'var(--accent)', background: 'var(--accent-soft)', borderRadius: 'var(--r-sm)', padding: '0.375rem 0.5rem', marginTop: 2 }}>
                {splitSummary}
              </div>
            )}
          </div>

          {/* Amount paid */}
          {payMode !== 'split' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--ink-3)' }}>Amount Paid (₹)</label>
              <input type="number" step="0.01" value={amountPaidStr} onChange={(e) => setAmountPaidStr(e.target.value)} />
            </div>
          )}

          {/* Balance */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
            <span style={{ color: 'var(--ink-3)' }}>Balance</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: balance > 0 ? 'var(--red)' : 'var(--green)' }}>
              {paiseToCurrency(Math.max(0, balance))}
            </span>
          </div>

          {saleError && <p style={{ fontSize: '0.8125rem', color: 'var(--red)' }}>{saleError}</p>}

          <button className="btn btn-success"
            onClick={confirmSale}
            disabled={!lines.length || loading}
            style={{ width: '100%', height: 44, fontSize: '0.9375rem', fontWeight: 700, marginTop: 'auto' }}>
            {loading ? 'Processing…' : `Confirm Sale`}
          </button>
        </div>
      </div>

      {showSplitModal && (
        <SplitPaymentModal totalPaise={totalPaise} accentClass="indigo"
          onConfirm={(rows, summary) => { setSplitRows(rows.map((r) => ({ mode: r.method, amount: r.amountPaise }))); setSplitSummary(summary); setShowSplitModal(false) }}
          onCancel={() => { setPayMode('cash'); setShowSplitModal(false) }}
        />
      )}
    </div>
  )
}
