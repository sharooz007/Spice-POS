// src/main/services/invoiceHistory.ts — Invoice History & Date/Time Edit
// rules.md #9: created_at immutable; every edit writes InvoiceDateTimeEditLog
import { eq, and, gte, lte, like, sql } from 'drizzle-orm'
import { getDb } from '../db'
import {
  invoices, invoiceLines, invoiceDatetimeEditLog, users, customers,
  retailPacketStock, bulkStock
} from '../db/schema'
import { businessDate } from '../../shared/businessDate'
import type {
  InvoiceRow, InvoiceLineRow, SearchInvoicesRequest,
  EditInvoiceDateTimeRequest, EditLogRow, UpdateInvoiceDetailsRequest
} from '../../shared/types'

// ── Pure helpers (exported for unit tests) ────────────────────────────────────

/** Convert a unix-ms timestamp to 'YYYY-MM-DD' business date. */
export function computeNewBusinessDate(unixMs: number): string {
  return businessDate(new Date(unixMs))
}

interface InvoiceSnapshot {
  createdAt: number
  subtotalPaise: number
  totalPaise: number
  lineCount: number
}

interface VoidReversalLine {
  itemType: string
  variantId: number | null
  productId: number | null
  qty: number
}

export function buildVoidReversal(input: {
  customerId: number | null
  balanceDuePaise: number
  lines: VoidReversalLine[]
}): {
  packetRestocks: Array<{ variantId: number; qtyPcs: number }>
  bulkRestocks: Array<{ productId: number; qtyGrams: number }>
  creditReversal: { customerId: number; amountPaise: number } | null
} {
  const packetByVariant = new Map<number, number>()
  const bulkByProduct = new Map<number, number>()

  for (const line of input.lines) {
    if (line.itemType === 'packet' && line.variantId != null) {
      packetByVariant.set(line.variantId, (packetByVariant.get(line.variantId) ?? 0) + line.qty)
    } else if (line.itemType === 'loose_bulk' && line.productId != null) {
      bulkByProduct.set(line.productId, (bulkByProduct.get(line.productId) ?? 0) + line.qty)
    }
  }

  return {
    packetRestocks: [...packetByVariant].map(([variantId, qtyPcs]) => ({ variantId, qtyPcs })),
    bulkRestocks: [...bulkByProduct].map(([productId, qtyGrams]) => ({ productId, qtyGrams })),
    creditReversal: input.customerId != null && input.balanceDuePaise > 0
      ? { customerId: input.customerId, amountPaise: input.balanceDuePaise }
      : null
  }
}

/** Assert that immutable fields haven't changed. Throws if violated. (rules.md #9) */
export function assertInvoiceImmutables(before: InvoiceSnapshot, after: InvoiceSnapshot): void {
  if (before.createdAt !== after.createdAt) throw new Error('created_at must never change')
  if (before.subtotalPaise !== after.subtotalPaise) throw new Error('subtotal_paise must not change')
  if (before.totalPaise !== after.totalPaise) throw new Error('total_paise must not change')
  if (before.lineCount !== after.lineCount) throw new Error('line items must not change')
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toMs(v: Date | number | null): number {
  if (v === null) return 0
  if (v instanceof Date) return v.getTime()
  return Number(v)
}

type LineWithNames = {
  id: number
  invoiceId: number
  itemType: string
  variantId: number | null
  productId: number | null
  qty: number
  unit: string
  unitPricePaise: number
  lineTotalPaise: number
  unitCostSnapshot: number | null
  lineProfitPaise: number | null
  variantLabel: string | null
  productName: string | null
}

function mapLine(l: LineWithNames): InvoiceLineRow {
  return {
    id: l.id, itemType: l.itemType, variantId: l.variantId ?? null,
    productId: l.productId ?? null, qty: l.qty, unit: l.unit,
    unitPricePaise: l.unitPricePaise, lineTotalPaise: l.lineTotalPaise,
    lineProfitPaise: l.lineProfitPaise ?? null,
    variantLabel: l.variantLabel ?? null,
    productName: l.productName ?? null
  }
}

function mapInvoice(
  inv: typeof invoices.$inferSelect,
  lines: LineWithNames[],
  customerName: string | null
): InvoiceRow {
  let paymentSplit: InvoiceRow['paymentSplit'] = null
  if (inv.paymentSplit) {
    try { paymentSplit = JSON.parse(inv.paymentSplit) } catch { /* ignore */ }
  }
  return {
    id: inv.id, invoiceNo: inv.invoiceNo,
    createdAt: toMs(inv.createdAt),
    invoiceDatetime: toMs(inv.invoiceDatetime),
    businessDate: inv.businessDate,
    type: inv.type, customerId: inv.customerId ?? null,
    customerName,
    subtotalPaise: inv.subtotalPaise, discountPaise: inv.discountPaise,
    totalPaise: inv.totalPaise, paymentMode: inv.paymentMode,
    amountPaidPaise: inv.amountPaidPaise, balanceDuePaise: inv.balanceDuePaise,
    status: inv.status, paymentSplit,
    lines: lines.filter((l) => l.invoiceId === inv.id).map(mapLine)
  }
}

// ── Service functions ─────────────────────────────────────────────────────────

export function searchInvoices(req: SearchInvoicesRequest): InvoiceRow[] {
  const db = getDb()

  // Build WHERE clause dynamically — all date filters use business_date (rules.md #8)
  const conditions: ReturnType<typeof eq>[] = []
  if (req.type) conditions.push(eq(invoices.type, req.type))
  if (req.customerId) conditions.push(eq(invoices.customerId, req.customerId))
  if (req.invoiceNo) conditions.push(like(invoices.invoiceNo, `%${req.invoiceNo}%`))
  if (req.dateFrom && req.dateTo)
    conditions.push(and(gte(invoices.businessDate, req.dateFrom), lte(invoices.businessDate, req.dateTo)) as ReturnType<typeof eq>)
  else if (req.dateFrom) conditions.push(gte(invoices.businessDate, req.dateFrom) as ReturnType<typeof eq>)
  else if (req.dateTo) conditions.push(lte(invoices.businessDate, req.dateTo) as ReturnType<typeof eq>)

  const invRows = conditions.length
    ? db.select().from(invoices).where(and(...conditions)).orderBy(sql`invoice_datetime DESC`).limit(200).all()
    : db.select().from(invoices).orderBy(sql`invoice_datetime DESC`).limit(200).all()

  if (invRows.length === 0) return []

  const ids = invRows.map((i) => i.id)
  // Fetch lines with product/variant names via LEFT JOINs
  type RawLine = { id: number; invoice_id: number; item_type: string; variant_id: number | null; product_id: number | null; qty: number; unit: string; unit_price_paise: number; line_total_paise: number; unit_cost_snapshot: number | null; line_profit_paise: number | null; variant_label: string | null; product_name: string | null }
  const lineRows: LineWithNames[] = db.all<RawLine>(sql`
    SELECT il.*,
      pv.label as variant_label,
      COALESCE(p1.name, p2.name) as product_name
    FROM invoice_lines il
    LEFT JOIN product_variants pv ON il.variant_id = pv.id
    LEFT JOIN products p1 ON il.product_id = p1.id
    LEFT JOIN products p2 ON pv.product_id = p2.id
    WHERE il.invoice_id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})
  `).map((r) => ({
    id: r.id, invoiceId: r.invoice_id, itemType: r.item_type,
    variantId: r.variant_id, productId: r.product_id,
    qty: r.qty, unit: r.unit,
    unitPricePaise: r.unit_price_paise, lineTotalPaise: r.line_total_paise,
    unitCostSnapshot: r.unit_cost_snapshot, lineProfitPaise: r.line_profit_paise,
    variantLabel: r.variant_label, productName: r.product_name
  }))

  const customerIds = [...new Set(invRows.map((i) => i.customerId).filter((id): id is number => id != null))]
  const customerMap: Record<number, string> = {}
  if (customerIds.length > 0) {
    const custRows = db.all<{ id: number; name: string }>(sql`
      SELECT id, name FROM customers WHERE id IN (${sql.join(customerIds.map((id) => sql`${id}`), sql`, `)})
    `)
    for (const c of custRows) customerMap[c.id] = c.name
  }

  return invRows.map((inv) => mapInvoice(inv, lineRows, inv.customerId ? (customerMap[inv.customerId] ?? null) : null))
}

export function voidInvoice(invoiceId: number, userId: number): void {
  const db = getDb()
  db.transaction((tx) => {
    // Admin check — fetch from DB, never trust renderer (rules.md #14)
    const user = tx.select({ role: users.role }).from(users).where(eq(users.id, userId)).get()
    if (!user || user.role !== 'admin') throw new Error('Admin access required')

    const inv = tx
      .select({
        id: invoices.id,
        status: invoices.status,
        customerId: invoices.customerId,
        balanceDuePaise: invoices.balanceDuePaise
      })
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .get()
    if (!inv) throw new Error('Invoice not found')
    if (inv.status === 'void') throw new Error('Invoice is already void')

    const lines = tx
      .select({
        itemType: invoiceLines.itemType,
        variantId: invoiceLines.variantId,
        productId: invoiceLines.productId,
        qty: invoiceLines.qty
      })
      .from(invoiceLines)
      .where(eq(invoiceLines.invoiceId, invoiceId))
      .all()

    const reversal = buildVoidReversal({
      customerId: inv.customerId ?? null,
      balanceDuePaise: inv.balanceDuePaise,
      lines
    })

    for (const restock of reversal.packetRestocks) {
      tx.update(retailPacketStock)
        .set({ qtyPcs: sql`qty_pcs + ${restock.qtyPcs}` })
        .where(eq(retailPacketStock.variantId, restock.variantId))
        .run()
    }

    for (const restock of reversal.bulkRestocks) {
      tx.update(bulkStock)
        .set({ qtyGrams: sql`qty_grams + ${restock.qtyGrams}` })
        .where(eq(bulkStock.productId, restock.productId))
        .run()
    }

    if (reversal.creditReversal) {
      tx.update(customers)
        .set({ creditBalancePaise: sql`credit_balance_paise - ${reversal.creditReversal.amountPaise}` })
        .where(eq(customers.id, reversal.creditReversal.customerId))
        .run()
    }

    tx.update(invoices).set({ status: 'void' }).where(eq(invoices.id, invoiceId)).run()
  })
}

export function unvoidInvoice(invoiceId: number, userId: number): void {
  const db = getDb()
  db.transaction((tx) => {
    // Admin check — fetch from DB, never trust renderer (rules.md #14)
    const user = tx.select({ role: users.role }).from(users).where(eq(users.id, userId)).get()
    if (!user || user.role !== 'admin') throw new Error('Admin access required')

    const inv = tx
      .select({
        id: invoices.id,
        status: invoices.status,
        customerId: invoices.customerId,
        balanceDuePaise: invoices.balanceDuePaise
      })
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .get()
    if (!inv) throw new Error('Invoice not found')
    if (inv.status !== 'void') throw new Error('Invoice is not voided')

    const lines = tx
      .select({
        itemType: invoiceLines.itemType,
        variantId: invoiceLines.variantId,
        productId: invoiceLines.productId,
        qty: invoiceLines.qty
      })
      .from(invoiceLines)
      .where(eq(invoiceLines.invoiceId, invoiceId))
      .all()

    const reversal = buildVoidReversal({
      customerId: inv.customerId ?? null,
      balanceDuePaise: inv.balanceDuePaise,
      lines
    })

    for (const restock of reversal.packetRestocks) {
      tx.update(retailPacketStock)
        .set({ qtyPcs: sql`qty_pcs - ${restock.qtyPcs}` })
        .where(eq(retailPacketStock.variantId, restock.variantId))
        .run()
    }

    for (const restock of reversal.bulkRestocks) {
      tx.update(bulkStock)
        .set({ qtyGrams: sql`qty_grams - ${restock.qtyGrams}` })
        .where(eq(bulkStock.productId, restock.productId))
        .run()
    }

    if (reversal.creditReversal) {
      tx.update(customers)
        .set({ creditBalancePaise: sql`credit_balance_paise + ${reversal.creditReversal.amountPaise}` })
        .where(eq(customers.id, reversal.creditReversal.customerId))
        .run()
    }

    tx.update(invoices).set({ status: 'active' }).where(eq(invoices.id, invoiceId)).run()
  })
}

export function deleteInvoice(invoiceId: number, userId: number): void {
  const db = getDb()
  db.transaction((tx) => {
    const user = tx.select({ role: users.role }).from(users).where(eq(users.id, userId)).get()
    if (!user || user.role !== 'admin') throw new Error('Admin access required')

    const inv = tx.select({ id: invoices.id, status: invoices.status }).from(invoices).where(eq(invoices.id, invoiceId)).get()
    if (!inv) throw new Error('Invoice not found')
    if (inv.status !== 'void') throw new Error('Invoice must be voided before it can be deleted')

    tx.delete(invoiceLines).where(eq(invoiceLines.invoiceId, invoiceId)).run()
    tx.delete(invoiceDatetimeEditLog).where(eq(invoiceDatetimeEditLog.invoiceId, invoiceId)).run()
    tx.delete(invoices).where(eq(invoices.id, invoiceId)).run()
  })
}

export function editInvoiceDateTime(req: EditInvoiceDateTimeRequest): InvoiceRow {
  const db = getDb()

  return db.transaction((tx) => {
    // Admin check in main process — never trust renderer role (rules.md #14)
    const user = tx.select({ role: users.role }).from(users).where(eq(users.id, req.userId)).get()
    if (!user || user.role !== 'admin') throw new Error('Admin access required')

    const inv = tx.select().from(invoices).where(eq(invoices.id, req.invoiceId)).get()
    if (!inv) throw new Error('Invoice not found')

    const oldDatetime = toMs(inv.invoiceDatetime)
    const newDt = new Date(req.newDatetime)
    const newBusinessDate = businessDate(newDt)

    // UPDATE invoice_datetime and business_date ONLY.
    // created_at is NEVER in this UPDATE (rules.md #9).
    tx.update(invoices)
      .set({
        invoiceDatetime: newDt,
        businessDate: newBusinessDate
        // created_at intentionally absent
      })
      .where(eq(invoices.id, req.invoiceId))
      .run()

    // Edit log — mandatory for every edit (rules.md #9)
    tx.insert(invoiceDatetimeEditLog)
      .values({
        invoiceId: req.invoiceId,
        oldDatetime: new Date(oldDatetime),
        newDatetime: newDt,
        editedBy: req.userId
        // editedAt set by $defaultFn
      })
      .run()

    // Fetch updated invoice to return — verify created_at unchanged
    const updated = tx.select().from(invoices).where(eq(invoices.id, req.invoiceId)).get()!
    const rawLines = tx.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, req.invoiceId)).all()
    const lines: LineWithNames[] = rawLines.map((l) => ({ ...l, variantLabel: null, productName: null }))

    // Assert immutables in-process (belt-and-suspenders for rules.md #9)
    assertInvoiceImmutables(
      { createdAt: toMs(inv.createdAt), subtotalPaise: inv.subtotalPaise, totalPaise: inv.totalPaise, lineCount: lines.length },
      { createdAt: toMs(updated.createdAt), subtotalPaise: updated.subtotalPaise, totalPaise: updated.totalPaise, lineCount: lines.length }
    )

    const custName = updated.customerId
      ? (tx.select({ name: customers.name }).from(customers).where(eq(customers.id, updated.customerId)).get()?.name ?? null)
      : null

    return mapInvoice(updated, lines, custName)
  })
}

export function updateInvoiceDetails(req: UpdateInvoiceDetailsRequest): InvoiceRow {
  const db = getDb()
  return db.transaction((tx) => {
    const user = tx.select({ role: users.role }).from(users).where(eq(users.id, req.userId)).get()
    if (!user || user.role !== 'admin') throw new Error('Admin access required')

    const inv = tx.select().from(invoices).where(eq(invoices.id, req.invoiceId)).get()
    if (!inv) throw new Error('Invoice not found')

    // Handle datetime change (writes edit log, recomputes business_date)
    if (req.newDatetime !== undefined) {
      const newDt = new Date(req.newDatetime)
      tx.update(invoices).set({ invoiceDatetime: newDt, businessDate: businessDate(newDt) })
        .where(eq(invoices.id, req.invoiceId)).run()
      tx.insert(invoiceDatetimeEditLog).values({
        invoiceId: req.invoiceId, oldDatetime: inv.invoiceDatetime as Date,
        newDatetime: newDt, editedBy: req.userId
      }).run()
    }

    // Handle amountPaid change
    if (req.amountPaidPaise !== undefined) {
      const newBalance = Math.max(0, inv.totalPaise - req.amountPaidPaise)
      tx.update(invoices).set({ amountPaidPaise: req.amountPaidPaise, balanceDuePaise: newBalance })
        .where(eq(invoices.id, req.invoiceId)).run()
    }

    // Handle customer change
    let resolvedCustomerId = inv.customerId
    if (req.customerId === null) {
      resolvedCustomerId = null
      tx.update(invoices).set({ customerId: null }).where(eq(invoices.id, req.invoiceId)).run()
    } else if (req.customerId !== undefined) {
      resolvedCustomerId = req.customerId
      if (req.customerPhone?.trim()) {
        const existing = tx.select({ phone: customers.phone }).from(customers).where(eq(customers.id, req.customerId)).get()
        if (existing && !existing.phone) {
          tx.update(customers).set({ phone: req.customerPhone.trim() }).where(eq(customers.id, req.customerId)).run()
        }
      }
      tx.update(invoices).set({ customerId: req.customerId }).where(eq(invoices.id, req.invoiceId)).run()
    } else if (req.customerName?.trim()) {
      const invType = inv.type as 'retail' | 'wholesale'
      const [c] = tx.insert(customers).values({
        type: invType, name: req.customerName.trim(),
        phone: req.customerPhone?.trim() || null, creditBalancePaise: 0
      }).returning({ id: customers.id }).all()
      resolvedCustomerId = c.id
      tx.update(invoices).set({ customerId: c.id }).where(eq(invoices.id, req.invoiceId)).run()
    }

    const updated = tx.select().from(invoices).where(eq(invoices.id, req.invoiceId)).get()!
    const rawLines = tx.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, req.invoiceId)).all()
    const lines: LineWithNames[] = rawLines.map((l) => ({ ...l, variantLabel: null, productName: null }))
    const custName = resolvedCustomerId
      ? (tx.select({ name: customers.name }).from(customers).where(eq(customers.id, resolvedCustomerId)).get()?.name ?? null)
      : null
    return mapInvoice(updated, lines, custName)
  })
}

export function getInvoice(invoiceId: number): InvoiceRow | null {
  const db = getDb()
  const inv = db.select().from(invoices).where(eq(invoices.id, invoiceId)).get()
  if (!inv) return null
  type RawLine = { id: number; invoice_id: number; item_type: string; variant_id: number | null; product_id: number | null; qty: number; unit: string; unit_price_paise: number; line_total_paise: number; unit_cost_snapshot: number | null; line_profit_paise: number | null; variant_label: string | null; product_name: string | null }
  const lineRows: LineWithNames[] = db.all<RawLine>(sql`
    SELECT il.*, pv.label as variant_label, COALESCE(p1.name, p2.name) as product_name
    FROM invoice_lines il
    LEFT JOIN product_variants pv ON il.variant_id = pv.id
    LEFT JOIN products p1 ON il.product_id = p1.id
    LEFT JOIN products p2 ON pv.product_id = p2.id
    WHERE il.invoice_id = ${invoiceId}
  `).map((r) => ({
    id: r.id, invoiceId: r.invoice_id, itemType: r.item_type,
    variantId: r.variant_id, productId: r.product_id, qty: r.qty, unit: r.unit,
    unitPricePaise: r.unit_price_paise, lineTotalPaise: r.line_total_paise,
    unitCostSnapshot: r.unit_cost_snapshot, lineProfitPaise: r.line_profit_paise,
    variantLabel: r.variant_label, productName: r.product_name
  }))
  const custName = inv.customerId
    ? (db.select({ name: customers.name }).from(customers).where(eq(customers.id, inv.customerId)).get()?.name ?? null)
    : null
  return mapInvoice(inv, lineRows, custName)
}

export function getEditLog(invoiceId: number): EditLogRow[] {
  return getDb()
    .select()
    .from(invoiceDatetimeEditLog)
    .where(eq(invoiceDatetimeEditLog.invoiceId, invoiceId))
    .orderBy(sql`edited_at DESC`)
    .all()
    .map((r) => ({
      id: r.id, invoiceId: r.invoiceId,
      oldDatetime: toMs(r.oldDatetime),
      newDatetime: toMs(r.newDatetime),
      editedBy: r.editedBy,
      editedAt: toMs(r.editedAt)
    }))
}
