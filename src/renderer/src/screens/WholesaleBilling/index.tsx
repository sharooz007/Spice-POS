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
    
    if (!partyName.trim() || !partyPhone.trim()) {
      setSaleError('Customer name and phone number are required')
      setLoading(false)
      return
    }

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
          <span style={{ fontWeight: 500 }}>
            {lastInvoice.invoiceNo} · {paiseToCurrency(lastInvoice.totalPaise)}
            {lastInvoice.balanceDuePaise > 0 && ` · Due: ${paiseToCurrency(lastInvoice.balanceDuePaise)}`}
          </span>
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
        gridTemplateColumns: 'clamp(220px, 15vw, 280px) minmax(420px, 1fr) clamp(300px, 17vw, 340px)',
        gap: '0.75rem',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
      }}>

        {/* ── Left: product list ── */}
        <div className="card" style={{
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: 'var(--r-lg)',
          minHeight: 0,
        }}>
          <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>
            <div className="section-label">Products</div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {enabledProducts.map((p) => {
              const inOrder = orders.some((o) => o.productId === p.id)
              const isActive = activeProductId === p.id
              const bulkG = bulkMap[p.id]?.qtyGrams ?? 0
              return (
                <div key={p.id}
                  onClick={() => startOrder(p.id)}
                  className={`list-item${isActive ? ' active' : ''}`}
                  style={{ borderBottom: '1px solid var(--border)', borderRadius: 0, padding: '0.625rem 0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--ink-1)' }}>{p.name}</span>
                    {inOrder && (
                      <span style={{
                        fontSize: '0.6875rem',
                        background: 'oklch(0.25 0.06 75)',
                        color: 'oklch(0.86 0.13 75)',
                        padding: '0.0625rem 0.375rem',
                        borderRadius: 'var(--r-full)',
                        fontWeight: 500,
                      }}>✓</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--ink-3)', marginTop: '0.125rem' }}>
                    Bulk: {formatQuantity(bulkG, p.unitType)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Centre: order entry + confirmed orders ── */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 'var(--r-lg)', minHeight: 0 }}>

          {/* Order entry form or header */}
          {draft && activeProd ? (
            <div style={{
              padding: '1rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 650, color: 'var(--ink-1)' }}>{activeProd.name}</h2>
                <span style={{ fontSize: '0.75rem', color: 'var(--ink-3)' }}>
                  Bulk available: {formatQuantity(bulkAvailG, activeProd.unitType)} · Wholesale rate: {paiseToCurrency(activeProd.wholesaleRatePerKgPaise)}/{bulkUnit(activeProd.unitType)}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--ink-3)' }}>Total ordered ({bulkUnit(activeProd.unitType)})</label>
                  <input type="number" step="0.001" min="0" value={draft.totalKgStr}
                    onChange={(e) => updateDraftTotalKg(e.target.value)}
                    autoFocus />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--ink-3)' }}>
                    From bulk ({bulkUnit(activeProd.unitType)}) — max {formatQuantity(bulkAvailG, activeProd.unitType)}
                  </label>
                  <input type="number" step="0.001" min="0"
                    max={(bulkAvailG / 1000).toFixed(3)}
                    value={draft.bulkKgStr}
                    onChange={(e) => updateDraftBulkKg(e.target.value)} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--ink-3)' }}>Rate (₹/{bulkUnit(activeProd.unitType)})</label>
                  <input type="number" step="0.01" min="0" value={draft.rateStr}
                    onChange={(e) => updateDraftRate(e.target.value)} />
                </div>
              </div>

              {/* Packet section — always visible when variants exist */}
              {activeProd.variants.some((v) => v.enabled) && (
                <div style={{
                  background: 'oklch(0.25 0.06 75)',
                  border: '1px solid oklch(0.48 0.11 75)',
                  borderRadius: 'var(--r-md)',
                  padding: '0.75rem',
                }}>
                  {remainingG > 0 ? (
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'oklch(0.86 0.13 75)', marginBottom: '0.5rem' }}>
                      To fill from packets: {formatQuantity(remainingG, activeProd.unitType)}
                      {selectedPacketG > 0 && (
                        <span style={{ marginLeft: '0.5rem', color: Math.abs(selectedPacketG - remainingG) <= 10 ? 'var(--green)' : 'oklch(0.86 0.13 75)' }}>
                          · Selected: {formatQuantity(selectedPacketG, activeProd.unitType)}
                          {selectedPacketG !== remainingG && ` (${selectedPacketG > remainingG ? '+' : ''}${formatQuantity(selectedPacketG - remainingG, activeProd.unitType)})`}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'oklch(0.86 0.13 75)', marginBottom: '0.5rem' }}>
                      Also use from packets (optional)
                      {selectedPacketG > 0 && (
                        <span style={{ marginLeft: '0.5rem', color: 'var(--ink-3)' }}>· {formatQuantity(selectedPacketG, activeProd.unitType)} selected</span>
                      )}
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    {activeProd.variants.filter((v) => v.enabled).map((v) => {
                      const stock = retailMap[v.id]?.qtyPcs ?? 0
                      const sel = draft.packetSels.find((s) => s.variantId === v.id)
                      const pcs = sel?.pcs ?? 0
                      return (
                        <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'oklch(0.86 0.13 75)' }}>{v.label}</div>
                            <div style={{ fontSize: '0.6875rem', color: 'var(--ink-3)' }}>{stock} pcs avail</div>
                          </div>
                          <input type="number" min="0" max={stock} value={pcs || ''}
                            onChange={(e) => updatePacketSel(v.id, parseInt(e.target.value) || 0)}
                            placeholder="0"
                            style={{ width: 56, textAlign: 'center' }} />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-amber" onClick={confirmDraft}>
                  {orders.some((o) => o.productId === draft.productId) ? 'Update Order' : 'Add to Order'}
                </button>
                <button className="btn btn-secondary" onClick={() => { setDraft(null); setActiveProductId(null) }}>
                  Cancel
                </button>
                {orders.some((o) => o.productId === draft.productId) && (
                  <button className="btn" onClick={() => removeOrder(draft.productId)}
                    style={{
                      background: 'oklch(0.24 0.065 25)',
                      color: 'var(--red)',
                      borderColor: 'oklch(0.44 0.13 25)',
                    }}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div style={{
              padding: '0.875rem 1rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 650, color: 'var(--ink-1)' }}>Wholesale Order</h2>
                <p style={{ margin: '0.125rem 0 0', fontSize: '0.75rem', color: 'var(--ink-3)' }}>
                  {orders.length ? `${orders.length} product${orders.length === 1 ? '' : 's'} in order` : 'Select a product to start an order'}
                </p>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 700, color: 'var(--ink-1)', fontVariantNumeric: 'tabular-nums' }}>
                {paiseToCurrency(totalPaise)}
              </span>
            </div>
          )}

          {/* Confirmed orders table or empty state */}
          {orders.length === 0 && !draft ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '0.625rem', minHeight: 0 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 32, height: 32, color: 'var(--ink-4)' }}>
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink-2)' }}>No items in order</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--ink-3)', marginTop: 2 }}>Select a product from the left to start an order.</div>
              </div>
            </div>
          ) : orders.length > 0 ? (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Bulk</th>
                    <th>Packets</th>
                    <th style={{ textAlign: 'right' }}>Rate</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th style={{ width: 32 }}></th>
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
                      <tr key={o.productId}>
                        <td>
                          <div style={{ fontWeight: 500, cursor: 'pointer' }} onClick={() => startOrder(o.productId)}>{p.name}</div>
                        </td>
                        <td style={{ color: 'var(--ink-2)' }}>
                          {bulkG > 0 ? formatQuantity(bulkG, p.unitType) : '—'}
                        </td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--ink-2)' }}>{packetDesc || '—'}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums' }}>
                          {paiseToCurrency(o.ratePaise)}/{bulkUnit(p.unitType)}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                          {paiseToCurrency(orderLineTotal(o, products))}
                        </td>
                        <td>
                          <button onClick={() => removeOrder(o.productId)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', fontSize: '1.125rem', lineHeight: 1, padding: '0 0.25rem' }}
                            onMouseEnter={(e) => ((e.target as HTMLButtonElement).style.color = 'var(--red)')}
                            onMouseLeave={(e) => ((e.target as HTMLButtonElement).style.color = 'var(--ink-4)')}
                          >×</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>

        {/* ── Right: payment panel ── */}
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
              <p style={{ margin: '0.125rem 0 0', fontSize: '0.75rem', color: 'var(--ink-3)' }}>Wholesale sale payment</p>
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

          {/* Party */}
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

          <hr className="divider" />

          {/* Payment mode */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--ink-3)' }}>Payment mode</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.25rem' }}>
              {(['cash', 'upi', 'card', 'split', 'credit', 'partial'] as PayMode[]).map((m) => (
                <button key={m}
                  onClick={() => {
                    setPayMode(m)
                    setSplitSummary('')
                    if (m === 'split') setShowSplitModal(true)
                    else setAmountPaidStr(m === 'credit' ? '0.00' : (totalPaise / 100).toFixed(2))
                  }}
                  style={{
                    padding: '0.375rem 0', borderRadius: 'var(--r-sm)', fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer',
                    border: '1px solid',
                    background: payMode === m ? 'var(--accent)' : 'var(--bg-fill)',
                    color: payMode === m ? '#fff' : 'var(--ink-2)',
                    borderColor: payMode === m ? 'var(--accent)' : 'var(--border)',
                    transition: 'background 100ms ease',
                  }}>
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
            {payMode === 'split' && splitSummary && (
              <div style={{ fontSize: '0.75rem', color: 'var(--accent)', background: 'var(--accent-soft)', borderRadius: 'var(--r-sm)', padding: '0.375rem 0.5rem', marginTop: 2 }}>
                {splitSummary}
              </div>
            )}
          </div>

          {/* Amount paid / credit message */}
          {payMode === 'split' ? null : payMode !== 'credit' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--ink-3)' }}>Amount Paid (₹)</label>
              <input type="number" step="0.01" value={amountPaidStr}
                onChange={(e) => setAmountPaidStr(e.target.value)} />
            </div>
          ) : (
            <div style={{
              fontSize: '0.75rem',
              color: 'oklch(0.86 0.13 75)',
              background: 'oklch(0.25 0.06 75)',
              borderRadius: 'var(--r-sm)',
              padding: '0.5rem 0.625rem',
              border: '1px solid oklch(0.48 0.11 75)',
            }}>
              Full amount goes to party dues. No cash collected.
            </div>
          )}

          {/* Balance */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
            <span style={{ color: 'var(--ink-3)' }}>Balance due</span>
            <span style={{
              fontFamily: 'var(--font-mono)', fontWeight: 700,
              color: (totalPaise - (payMode === 'credit' ? 0 : amountPaid)) > 0 ? 'var(--red)' : 'var(--green)',
            }}>
              {paiseToCurrency(Math.max(0, totalPaise - (payMode === 'credit' ? 0 : amountPaid)))}
            </span>
          </div>

          {saleError && <p style={{ fontSize: '0.8125rem', color: 'var(--red)' }}>{saleError}</p>}

          <button className="btn btn-success"
            onClick={confirmSale}
            disabled={orders.length === 0 || loading}
            style={{ width: '100%', height: 44, fontSize: '0.9375rem', fontWeight: 700, marginTop: 'auto' }}>
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
