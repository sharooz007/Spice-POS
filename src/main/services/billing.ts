// src/main/services/billing.ts — Retail + Wholesale billing (main process only)
// rules.md #5, #7, #12, #13
import { eq, and, sql } from 'drizzle-orm'
import { getDb } from '../db'
import {
  invoices, invoiceLines, retailPacketStock, bulkStock,
  productVariants, products, customers, payments
} from '../db/schema'
import { getCurrentPrice } from './pricing'
import { businessDate } from '../../shared/businessDate'
import type {
  CreateRetailSaleRequest,
  CreateWholesaleSaleRequest,
  RecordPartyPaymentRequest,
  SavedInvoice,
  BarcodeResult,
  BillLine
} from '../../shared/types'

// ── Pure helpers (exported for unit tests) ────────────────────────────────────

export function computeLineProfit(input: {
  unitPricePaise: number
  qtyPcs: number
  avgCostPerPc: number | null
}): { lineTotalPaise: number; unitCostSnapshot: number | null; lineProfitPaise: number | null } {
  const lineTotalPaise = input.unitPricePaise * input.qtyPcs
  const unitCostSnapshot = input.avgCostPerPc ?? null
  const costPaise = unitCostSnapshot === null
    ? null
    : Math.round(unitCostSnapshot * 100 * input.qtyPcs) // rules.md #13
  return {
    lineTotalPaise,
    unitCostSnapshot,
    lineProfitPaise: costPaise === null ? null : lineTotalPaise - costPaise
  }
}

export function computeSaleTotals(
  lines: Array<{ unitPricePaise: number; qtyPcs: number }>,
  discountPaise: number
): { subtotalPaise: number; totalPaise: number } {
  const subtotalPaise = lines.reduce((s, l) => s + l.unitPricePaise * l.qtyPcs, 0)
  return { subtotalPaise, totalPaise: subtotalPaise - discountPaise }
}

/** Throws if any line is not a valid packed line (variantId must be > 0). rules.md #7 */
export function assertPackedOnly(lines: BillLine[]): void {
  if (lines.length === 0) throw new Error('At least one line required')
  for (const l of lines) {
    if (!l.variantId || l.variantId <= 0) throw new Error('Retail billing: packed variants only — no loose lines allowed')
    if (l.qtyPcs <= 0) throw new Error('Quantity must be positive')
    if (l.unitPricePaise <= 0) throw new Error('Unit price must be positive')
  }
}

// ── Invoice number generation ─────────────────────────────────────────────────

function nextInvoiceNo(tx: { select: ReturnType<typeof getDb>['select'] }, dateStr: string): string {
  const prefix = `RET-${dateStr.replace(/-/g, '')}-`
  const last = tx
    .select({ invoiceNo: invoices.invoiceNo })
    .from(invoices)
    .where(sql`invoice_no LIKE ${prefix + '%'}`)
    .orderBy(sql`invoice_no DESC`)
    .limit(1)
    .get()
  const seq = last ? parseInt(last.invoiceNo.split('-').pop() ?? '0') + 1 : 1
  return prefix + String(seq).padStart(4, '0')
}

// ── Service functions ─────────────────────────────────────────────────────────

export function createRetailSale(req: CreateRetailSaleRequest): SavedInvoice {
  assertPackedOnly(req.lines) // fast pre-check before opening tx

  const db = getDb()

  return db.transaction((tx) => {
    const now = new Date()
    const bd = businessDate(now)

    // Validate lines and verify prices inside the transaction
    for (const line of req.lines) {
      const variant = tx
        .select({ id: productVariants.id, enabled: productVariants.enabled })
        .from(productVariants)
        .where(eq(productVariants.id, line.variantId))
        .get()
      if (!variant?.enabled) throw new Error(`Variant ${line.variantId} not found or disabled`)

      // Re-verify price server-side (rules.md #1 — price from Price Menu, never from cost)
      const entry = getCurrentPrice({ variantId: line.variantId })
      if (!entry) throw new Error(`No price found for variant ${line.variantId}`)
      if (entry.retailPricePaise !== line.unitPricePaise) {
        throw new Error(
          `Price changed for variant ${line.variantId}: expected ${entry.retailPricePaise}p, got ${line.unitPricePaise}p. Refresh and retry.`
        )
      }

      // Stock check
      const stock = tx
        .select({ qtyPcs: retailPacketStock.qtyPcs })
        .from(retailPacketStock)
        .where(eq(retailPacketStock.variantId, line.variantId))
        .get()
      if ((stock?.qtyPcs ?? 0) < line.qtyPcs) {
        throw new Error(`Insufficient stock for variant ${line.variantId}: have ${stock?.qtyPcs ?? 0}, need ${line.qtyPcs}`)
      }
    }

    const { subtotalPaise, totalPaise } = computeSaleTotals(req.lines, req.discountPaise)
    const balanceDuePaise = totalPaise - req.amountPaidPaise

    // Resolve customer: explicit id wins; else create from name (+optional phone).
    // Atomic with the sale — if the transaction rolls back, no customer is created.
    let customerId: number | null = null
    if (req.customerId) {
      customerId = req.customerId
    } else if (req.customerName?.trim()) {
      const [c] = tx
        .insert(customers)
        .values({
          type: 'retail',
          name: req.customerName.trim(),
          phone: req.customerPhone?.trim() || null,
          creditBalancePaise: 0
        })
        .returning({ id: customers.id })
        .all()
      customerId = c.id
    } else if (req.customerPhone?.trim()) {
      // Phone only, no name: upsert by phone (legacy behaviour)
      const existing = tx
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.phone, req.customerPhone.trim()), eq(customers.type, 'retail')))
        .get()
      if (existing) {
        customerId = existing.id
      } else {
        const [c] = tx
          .insert(customers)
          .values({ type: 'retail', name: req.customerPhone.trim(), phone: req.customerPhone.trim(), creditBalancePaise: 0 })
          .returning({ id: customers.id })
          .all()
        customerId = c.id
      }
    }

    const invoiceNo = nextInvoiceNo(tx, bd)

    // Insert invoice — created_at is set by $defaultFn (immutable, rules.md #9)
    const [inv] = tx
      .insert(invoices)
      .values({
        invoiceNo,
        invoiceDatetime: now,
        businessDate: bd,
        type: 'retail',
        customerId,
        subtotalPaise,
        discountPaise: req.discountPaise,
        totalPaise,
        paymentMode: req.paymentMode,
        amountPaidPaise: req.amountPaidPaise,
        balanceDuePaise,
        status: 'active',
        userId: req.userId,
        paymentSplit: req.paymentSplit ? JSON.stringify(req.paymentSplit) : null
      })
      .returning({ id: invoices.id, createdAt: invoices.createdAt })
      .all()

    const savedLines: SavedInvoice['lines'] = []

    // Process each line: profit snapshot + stock decrement
    for (const line of req.lines) {
      const stock = tx
        .select({ avgCostPerPc: retailPacketStock.avgCostPerPc })
        .from(retailPacketStock)
        .where(eq(retailPacketStock.variantId, line.variantId))
        .get()

      const { lineTotalPaise, unitCostSnapshot, lineProfitPaise } = computeLineProfit({
        unitPricePaise: line.unitPricePaise,
        qtyPcs: line.qtyPcs,
        avgCostPerPc: stock?.avgCostPerPc ?? null
      })

      // Fetch variant + product names for response
      const varInfo = tx
        .select({ label: productVariants.label, productName: products.name, productId: products.id })
        .from(productVariants)
        .innerJoin(products, eq(productVariants.productId, products.id))
        .where(eq(productVariants.id, line.variantId))
        .get()!

      tx.insert(invoiceLines)
        .values({
          invoiceId: inv.id,
          itemType: 'packet',
          variantId: line.variantId,
          productId: varInfo.productId,
          qty: line.qtyPcs,
          unit: 'pcs',
          unitPricePaise: line.unitPricePaise,
          lineTotalPaise,
          unitCostSnapshot,
          lineProfitPaise
        })
        .run()

      // Decrement stock — only on bill completion (rules.md #12)
      tx.update(retailPacketStock)
        .set({ qtyPcs: sql`qty_pcs - ${line.qtyPcs}` })
        .where(eq(retailPacketStock.variantId, line.variantId))
        .run()

      savedLines.push({
        id: inv.id, // placeholder; real line id not critical for response
        variantId: line.variantId,
        label: varInfo.label,
        productName: varInfo.productName,
        qtyPcs: line.qtyPcs,
        unitPricePaise: line.unitPricePaise,
        lineTotalPaise,
        lineProfitPaise
      })
    }

    return {
      id: inv.id,
      invoiceNo,
      businessDate: bd,
      invoiceDatetime: now.getTime(),
      subtotalPaise,
      discountPaise: req.discountPaise,
      totalPaise,
      paymentMode: req.paymentMode,
      amountPaidPaise: req.amountPaidPaise,
      balanceDuePaise,
      customerId,
      lines: savedLines
    }
  })
}

// ── Wholesale pure helpers (exported for unit tests) ──────────────────────────

/** Loose-from-bulk profit snapshot (domain_logic.md §3 loose variant).
 *  unitPricePerKgPaise is whatever the user entered (may be overridden). */
export function computeLooseLineProfit(input: {
  unitPricePerKgPaise: number
  qtyGrams: number
  bulkAvgCostPerKg: number | null // REAL rupees
}): { lineTotalPaise: number; unitCostSnapshot: number | null; lineProfitPaise: number | null } {
  const lineTotalPaise = Math.round(input.unitPricePerKgPaise * input.qtyGrams / 1000)
  const unitCostSnapshot = input.bulkAvgCostPerKg ?? null
  const costPaise = unitCostSnapshot === null
    ? null
    : Math.round(unitCostSnapshot * 100 * input.qtyGrams / 1000)
  return {
    lineTotalPaise,
    unitCostSnapshot,
    lineProfitPaise: costPaise === null ? null : lineTotalPaise - costPaise
  }
}

/** Compute wholesale subtotal across mixed packet and loose lines. */
export function computeWholesaleTotals(
  lines: Array<{ unitPricePaise: number; qty: number; unit: 'pcs' | 'grams' }>,
  discountPaise: number
): { subtotalPaise: number; totalPaise: number } {
  const subtotalPaise = lines.reduce((s, l) => {
    if (l.unit === 'grams') return s + Math.round(l.unitPricePaise * l.qty / 1000)
    return s + l.unitPricePaise * l.qty
  }, 0)
  return { subtotalPaise, totalPaise: subtotalPaise - discountPaise }
}

// ── Wholesale service ─────────────────────────────────────────────────────────

export function createWholesaleSale(req: CreateWholesaleSaleRequest): SavedInvoice {
  if (!req.lines.length) throw new Error('At least one line required')

  const db = getDb()

  return db.transaction((tx) => {
    const now = new Date()
    const bd = businessDate(now)

    // Validate lines
    for (const line of req.lines) {
      if (line.itemType === 'packet') {
        if (!line.variantId) throw new Error('Packet line requires variantId')
        if (line.unit !== 'pcs') throw new Error('Packet line unit must be pcs')
        if (line.qty <= 0) throw new Error('Quantity must be positive')

        const variant = tx.select({ enabled: productVariants.enabled })
          .from(productVariants).where(eq(productVariants.id, line.variantId)).get()
        if (!variant?.enabled) throw new Error(`Variant ${line.variantId} not found or disabled`)

        // Re-verify wholesale price server-side
        const entry = getCurrentPrice({ variantId: line.variantId })
        if (!entry) throw new Error(`No price for variant ${line.variantId}`)
        if (entry.wholesalePricePaise !== line.unitPricePaise) {
          throw new Error(`Wholesale price changed for variant ${line.variantId}. Refresh and retry.`)
        }

        const stock = tx.select({ qtyPcs: retailPacketStock.qtyPcs })
          .from(retailPacketStock).where(eq(retailPacketStock.variantId, line.variantId)).get()
        if ((stock?.qtyPcs ?? 0) < line.qty) {
          throw new Error(`Insufficient packet stock for variant ${line.variantId}`)
        }
      } else {
        // loose_bulk
        if (!line.productId) throw new Error('Loose line requires productId')
        if (line.unit !== 'grams') throw new Error('Loose line unit must be grams')
        if (line.qty <= 0) throw new Error('Quantity must be positive')

        const bulk = tx.select({ qtyGrams: bulkStock.qtyGrams })
          .from(bulkStock).where(eq(bulkStock.productId, line.productId)).get()
        if ((bulk?.qtyGrams ?? 0) < line.qty) {
          throw new Error(`Insufficient bulk stock for product ${line.productId}: need ${line.qty}g, have ${bulk?.qtyGrams ?? 0}g`)
        }
      }
    }

    // Compute totals
    const subtotalPaise = req.lines.reduce((s, l) => {
      if (l.unit === 'grams') return s + Math.round(l.unitPricePaise * l.qty / 1000)
      return s + l.unitPricePaise * l.qty
    }, 0)
    const totalPaise = subtotalPaise - req.discountPaise
    const balanceDuePaise = Math.max(0, totalPaise - req.amountPaidPaise)

    // Resolve party: explicit id wins; else create a new wholesale party from name.
    let resolvedPartyId: number | null = null
    if (req.partyId) {
      resolvedPartyId = req.partyId
    } else if (req.partyName?.trim()) {
      const [c] = tx
        .insert(customers)
        .values({
          type: 'wholesale',
          name: req.partyName.trim(),
          phone: req.partyPhone?.trim() || null,
          creditBalancePaise: 0
        })
        .returning({ id: customers.id })
        .all()
      resolvedPartyId = c.id
    }

    const whlInvoiceNo = `WHL-${bd.replace(/-/g, '')}-` +
      (() => {
        const prefix = `WHL-${bd.replace(/-/g, '')}-`
        const last = tx.select({ invoiceNo: invoices.invoiceNo })
          .from(invoices).where(sql`invoice_no LIKE ${prefix + '%'}`)
          .orderBy(sql`invoice_no DESC`).limit(1).get()
        const seq = last ? parseInt(last.invoiceNo.split('-').pop() ?? '0') + 1 : 1
        return String(seq).padStart(4, '0')
      })()

    const [inv] = tx.insert(invoices).values({
      invoiceNo: whlInvoiceNo,
      invoiceDatetime: now,
      businessDate: bd,
      type: 'wholesale',
      customerId: resolvedPartyId,
      subtotalPaise,
      discountPaise: req.discountPaise,
      totalPaise,
      paymentMode: req.paymentMode,
      amountPaidPaise: req.amountPaidPaise,
      balanceDuePaise,
      status: 'active',
      userId: req.userId,
      paymentSplit: req.paymentSplit ? JSON.stringify(req.paymentSplit) : null
    }).returning({ id: invoices.id }).all()

    const savedLines: SavedInvoice['lines'] = []

    for (const line of req.lines) {
      if (line.itemType === 'packet') {
        // Packet: deduct RetailPacketStock — NEVER BulkStock (rules.md #5)
        const stock = tx.select({ avgCostPerPc: retailPacketStock.avgCostPerPc })
          .from(retailPacketStock).where(eq(retailPacketStock.variantId, line.variantId!)).get()
        const varInfo = tx.select({ label: productVariants.label, productName: products.name, productId: products.id })
          .from(productVariants).innerJoin(products, eq(productVariants.productId, products.id))
          .where(eq(productVariants.id, line.variantId!)).get()!

        const { lineTotalPaise, unitCostSnapshot, lineProfitPaise } = computeLineProfit({
          unitPricePaise: line.unitPricePaise, qtyPcs: line.qty,
          avgCostPerPc: stock?.avgCostPerPc ?? null
        })

        tx.insert(invoiceLines).values({
          invoiceId: inv.id, itemType: 'packet', variantId: line.variantId,
          productId: varInfo.productId, qty: line.qty, unit: 'pcs',
          unitPricePaise: line.unitPricePaise, lineTotalPaise, unitCostSnapshot, lineProfitPaise
        }).run()

        tx.update(retailPacketStock)
          .set({ qtyPcs: sql`qty_pcs - ${line.qty}` })
          .where(eq(retailPacketStock.variantId, line.variantId!)).run()

        savedLines.push({
          id: inv.id, variantId: line.variantId!, label: varInfo.label,
          productName: varInfo.productName, qtyPcs: line.qty,
          unitPricePaise: line.unitPricePaise, lineTotalPaise, lineProfitPaise
        })
      } else {
        // Loose: deduct BulkStock — NEVER RetailPacketStock (rules.md #5)
        const bulk = tx.select({ avgCostPerKg: bulkStock.avgCostPerKg, qtyGrams: bulkStock.qtyGrams })
          .from(bulkStock).where(eq(bulkStock.productId, line.productId!)).get()!
        const prod = tx.select({ name: products.name })
          .from(products).where(eq(products.id, line.productId!)).get()!

        const { lineTotalPaise, unitCostSnapshot, lineProfitPaise } = computeLooseLineProfit({
          unitPricePerKgPaise: line.unitPricePaise,
          qtyGrams: line.qty,
          bulkAvgCostPerKg: bulk.avgCostPerKg ?? null
        })

        // Store actual price used (may be overridden by user — domain_logic.md §5)
        tx.insert(invoiceLines).values({
          invoiceId: inv.id, itemType: 'loose_bulk', variantId: null,
          productId: line.productId, qty: line.qty, unit: 'grams',
          unitPricePaise: line.unitPricePaise, // stores the override price
          lineTotalPaise, unitCostSnapshot, lineProfitPaise
        }).run()

        tx.update(bulkStock)
          .set({ qtyGrams: sql`qty_grams - ${line.qty}` })
          .where(eq(bulkStock.productId, line.productId!)).run()

        savedLines.push({
          id: inv.id, variantId: 0, label: `Loose ${line.qty}g`,
          productName: prod.name, qtyPcs: line.qty,
          unitPricePaise: line.unitPricePaise, lineTotalPaise, lineProfitPaise
        })
      }
    }

    // Party credit: if party provided and balance due, update credit_balance
    if (resolvedPartyId && balanceDuePaise > 0) {
      tx.update(customers)
        .set({ creditBalancePaise: sql`credit_balance_paise + ${balanceDuePaise}` })
        .where(eq(customers.id, resolvedPartyId)).run()
    }

    // Record payment if any cash received
    if (req.amountPaidPaise > 0 && resolvedPartyId) {
      tx.insert(payments).values({
        customerId: resolvedPartyId, invoiceId: inv.id, date: bd,
        amountPaise: req.amountPaidPaise, mode: req.paymentMode, notes: null
      }).run()
    }

    return {
      id: inv.id,
      invoiceNo: whlInvoiceNo,
      businessDate: bd, invoiceDatetime: now.getTime(),
      subtotalPaise, discountPaise: req.discountPaise,
      totalPaise, paymentMode: req.paymentMode,
      amountPaidPaise: req.amountPaidPaise, balanceDuePaise,
      customerId: resolvedPartyId,
      lines: savedLines
    }
  })
}

export function recordPartyPayment(req: RecordPartyPaymentRequest): void {
  if (req.amountPaise <= 0) throw new Error('Payment amount must be positive')

  const db = getDb()
  db.transaction((tx) => {
    const party = tx.select({ creditBalancePaise: customers.creditBalancePaise })
      .from(customers).where(eq(customers.id, req.customerId)).get()
    if (!party) throw new Error('Party not found')

    const newBalance = party.creditBalancePaise - req.amountPaise
    if (newBalance < 0) {
      throw new Error(
        `Payment of ${req.amountPaise}p exceeds outstanding balance of ${party.creditBalancePaise}p`
      )
    }

    const bDate = req.date ?? businessDate(new Date())
    tx.insert(payments).values({
      customerId: req.customerId, invoiceId: null, date: bDate,
      amountPaise: req.amountPaise, mode: req.mode, notes: req.notes ?? null
    }).run()

    tx.update(customers)
      .set({ creditBalancePaise: newBalance })
      .where(eq(customers.id, req.customerId)).run()
  })
}

// ── Item list helpers for tile grid ──────────────────────────────────────────

export function listRetailItems(): import('../../shared/types').RetailItemRow[] {
  const db = getDb()
  const today = new Date().toISOString().slice(0, 10)
  const vars = db
    .select({
      variantId: productVariants.id,
      productName: products.name,
      label: productVariants.label,
      weightGrams: productVariants.weightGrams,
      barcode: productVariants.barcode,
      qtyPcs: retailPacketStock.qtyPcs
    })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .innerJoin(retailPacketStock, eq(retailPacketStock.variantId, productVariants.id))
    .where(and(eq(productVariants.enabled, true), sql`${retailPacketStock.qtyPcs} > 0`))
    .all()

  return vars.flatMap((v) => {
    const entry = getCurrentPrice({ variantId: v.variantId, date: today })
    if (!entry) return []
    return [{
      variantId: v.variantId, productName: v.productName, label: v.label,
      weightGrams: v.weightGrams, barcode: v.barcode,
      retailPricePaise: entry.retailPricePaise, qtyPcs: v.qtyPcs
    }]
  })
}

export function listWholesaleItems(): {
  packets: import('../../shared/types').WholesaleItemRow[]
  loose: import('../../shared/types').LooseItemRow[]
} {
  const db = getDb()
  const today = new Date().toISOString().slice(0, 10)

  const vars = db
    .select({
      variantId: productVariants.id,
      productName: products.name,
      label: productVariants.label,
      weightGrams: productVariants.weightGrams,
      barcode: productVariants.barcode,
      qtyPcs: retailPacketStock.qtyPcs
    })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .innerJoin(retailPacketStock, eq(retailPacketStock.variantId, productVariants.id))
    .where(and(eq(productVariants.enabled, true), sql`${retailPacketStock.qtyPcs} > 0`))
    .all()

  const packets = vars.flatMap((v) => {
    const entry = getCurrentPrice({ variantId: v.variantId, date: today })
    if (!entry) return []
    return [{
      variantId: v.variantId, productName: v.productName, label: v.label,
      weightGrams: v.weightGrams, barcode: v.barcode,
      wholesalePricePaise: entry.wholesalePricePaise, qtyPcs: v.qtyPcs
    }]
  })

  const loose = db
    .select({
      productId: products.id,
      productName: products.name,
      wholesaleRatePerKgPaise: products.wholesaleRatePerKgPaise,
      qtyGrams: bulkStock.qtyGrams
    })
    .from(products)
    .innerJoin(bulkStock, eq(bulkStock.productId, products.id))
    .where(and(eq(products.enabled, true), sql`${bulkStock.qtyGrams} > 0`))
    .all()
    .map((r) => ({
      productId: r.productId, productName: r.productName,
      wholesaleRatePerKgPaise: r.wholesaleRatePerKgPaise, qtyGrams: r.qtyGrams
    }))

  return { packets, loose }
}

export function lookupVariantByBarcode(barcode: string): BarcodeResult | null {
  const db = getDb()
  const row = db
    .select({
      variantId: productVariants.id,
      productId: products.id,
      label: productVariants.label,
      productName: products.name,
      weightGrams: productVariants.weightGrams
    })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(and(eq(productVariants.barcode, barcode), eq(productVariants.enabled, true)))
    .get()

  if (!row) return null

  const entry = getCurrentPrice({ variantId: row.variantId })
  if (!entry) return null

  return {
    variantId: row.variantId,
    productId: row.productId,
    label: row.label,
    productName: row.productName,
    weightGrams: row.weightGrams,
    currentRetailPricePaise: entry.retailPricePaise
  }
}
