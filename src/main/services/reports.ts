// src/main/services/reports.ts — all reports group by business_date (rules.md #8)
// Profit totals EXCLUDE null-cost lines — never count as zero (rules.md #2)
import { eq, sql, and, gte, lte, gt } from 'drizzle-orm'
import { getDb } from '../db'
import {
  productVariants, products,
  bulkStock, retailPacketStock, packingRuns, packingRunLines,
  customers, expenses
} from '../db/schema'
import type {
  DateRange,
  DailySalesRow,
  SalesByProductRow,
  SalesByVariantRow,
  InventoryReportRow,
  LowStockRow,
  PackingReportRun,
  ProfitReportRow,
  DuesRow,
  ExpensesSummaryRow,
  PaymentBreakdownRow
} from '../../shared/types'

export function dailySalesReport(range: DateRange): DailySalesRow[] {
  const db = getDb()
  // Raw SQL for grouped aggregation — Drizzle doesn't expose groupBy aggregates cleanly here
  const rows = db.run(
    sql`SELECT business_date,
      SUM(CASE WHEN type='retail' THEN total_paise ELSE 0 END) as retail_total,
      SUM(CASE WHEN type='wholesale' THEN total_paise ELSE 0 END) as wholesale_total,
      SUM(total_paise) as combined_total,
      COUNT(*) as invoice_count
    FROM invoices
    WHERE status='active' AND business_date BETWEEN ${range.dateFrom} AND ${range.dateTo}
    GROUP BY business_date
    ORDER BY business_date ASC`
  )
  // db.run returns RunResult, need db.all for rows
  const result = db.all<{
    business_date: string
    retail_total: number
    wholesale_total: number
    combined_total: number
    invoice_count: number
  }>(sql`SELECT business_date,
      SUM(CASE WHEN type='retail' THEN total_paise ELSE 0 END) as retail_total,
      SUM(CASE WHEN type='wholesale' THEN total_paise ELSE 0 END) as wholesale_total,
      SUM(total_paise) as combined_total,
      COUNT(*) as invoice_count
    FROM invoices
    WHERE status='active' AND business_date BETWEEN ${range.dateFrom} AND ${range.dateTo}
    GROUP BY business_date
    ORDER BY business_date ASC`)
  void rows
  return result.map((r) => ({
    businessDate: r.business_date,
    retailTotalPaise: r.retail_total ?? 0,
    wholesaleTotalPaise: r.wholesale_total ?? 0,
    combinedTotalPaise: r.combined_total ?? 0,
    invoiceCount: r.invoice_count
  }))
}

export function salesByProduct(range: DateRange): SalesByProductRow[] {
  const db = getDb()
  const result = db.all<{
    product_id: number; product_name: string
    qty_grams: number; qty_pcs: number; revenue: number
  }>(sql`
    SELECT p.id as product_id, p.name as product_name,
      SUM(CASE WHEN il.unit='grams' THEN il.qty ELSE 0 END) as qty_grams,
      SUM(CASE WHEN il.unit='pcs' THEN il.qty ELSE 0 END) as qty_pcs,
      SUM(il.line_total_paise) as revenue
    FROM invoice_lines il
    JOIN invoices i ON il.invoice_id = i.id
    LEFT JOIN products p ON il.product_id = p.id
    LEFT JOIN product_variants pv ON il.variant_id = pv.id
    LEFT JOIN products p2 ON pv.product_id = p2.id
    WHERE i.status='active'
      AND i.business_date BETWEEN ${range.dateFrom} AND ${range.dateTo}
    GROUP BY COALESCE(il.product_id, pv.product_id)
    ORDER BY revenue DESC`)
  return result.map((r) => ({
    productId: r.product_id,
    productName: r.product_name,
    qtyGrams: r.qty_grams ?? 0,
    qtyPcs: r.qty_pcs ?? 0,
    revenuePaise: r.revenue ?? 0
  }))
}

export function salesByVariant(range: DateRange): SalesByVariantRow[] {
  const db = getDb()
  const result = db.all<{
    variant_id: number; label: string; product_name: string; qty_pcs: number; revenue: number
  }>(sql`
    SELECT il.variant_id, pv.label, p.name as product_name,
      SUM(il.qty) as qty_pcs,
      SUM(il.line_total_paise) as revenue
    FROM invoice_lines il
    JOIN invoices i ON il.invoice_id = i.id
    JOIN product_variants pv ON il.variant_id = pv.id
    JOIN products p ON pv.product_id = p.id
    WHERE il.item_type='packet' AND i.status='active'
      AND i.business_date BETWEEN ${range.dateFrom} AND ${range.dateTo}
    GROUP BY il.variant_id
    ORDER BY revenue DESC`)
  return result.map((r) => ({
    variantId: r.variant_id, label: r.label, productName: r.product_name,
    qtyPcs: r.qty_pcs ?? 0, revenuePaise: r.revenue ?? 0
  }))
}

export function inventoryReport(): InventoryReportRow[] {
  const db = getDb()
  const rows: InventoryReportRow[] = []

  const bulk = db.select({
    productId: bulkStock.productId, qtyGrams: bulkStock.qtyGrams,
    avgCostPerKg: bulkStock.avgCostPerKg, name: products.name, unitType: products.unitType
  }).from(bulkStock).innerJoin(products, eq(bulkStock.productId, products.id)).all()

  for (const r of bulk) {
    rows.push({ type: 'bulk', productId: r.productId, name: r.name, qty: r.qtyGrams, avgCost: r.avgCostPerKg ?? null, unitType: (r.unitType ?? 'weight') as 'weight' | 'volume' })
  }

  const retail = db.select({
    variantId: retailPacketStock.variantId, qtyPcs: retailPacketStock.qtyPcs,
    avgCostPerPc: retailPacketStock.avgCostPerPc,
    label: productVariants.label, productName: products.name, unitType: products.unitType
  }).from(retailPacketStock)
    .innerJoin(productVariants, eq(retailPacketStock.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id)).all()

  for (const r of retail) {
    rows.push({ type: 'packet', variantId: r.variantId, name: `${r.productName} ${r.label}`, qty: r.qtyPcs, avgCost: r.avgCostPerPc ?? null, unitType: (r.unitType ?? 'weight') as 'weight' | 'volume' })
  }

  return rows
}

export function lowStockReport(): LowStockRow[] {
  const db = getDb()
  const rows: LowStockRow[] = []

  const bulkLow = db.all<{ name: string; qty_grams: number; threshold: number; unit_type: string }>(sql`
    SELECT p.name, bs.qty_grams, p.bulk_low_stock_grams as threshold, p.unit_type
    FROM bulk_stock bs JOIN products p ON bs.product_id = p.id
    WHERE bs.qty_grams < p.bulk_low_stock_grams`)
  for (const r of bulkLow) {
    rows.push({ type: 'bulk', name: r.name, qtyAvailable: r.qty_grams, threshold: r.threshold, unitType: (r.unit_type ?? 'weight') as 'weight' | 'volume' })
  }

  const packetLow = db.all<{ name: string; label: string; qty_pcs: number; threshold: number; unit_type: string }>(sql`
    SELECT p.name, pv.label, rps.qty_pcs, pv.retail_low_stock_pcs as threshold, p.unit_type
    FROM retail_packet_stock rps
    JOIN product_variants pv ON rps.variant_id = pv.id
    JOIN products p ON pv.product_id = p.id
    WHERE rps.qty_pcs < pv.retail_low_stock_pcs`)
  for (const r of packetLow) {
    rows.push({ type: 'packet', name: `${r.name} ${r.label}`, qtyAvailable: r.qty_pcs, threshold: r.threshold, unitType: (r.unit_type ?? 'weight') as 'weight' | 'volume' })
  }

  return rows
}

export function packingReport(range: DateRange): PackingReportRun[] {
  const db = getDb()
  const runs = db.select({
    id: packingRuns.id, date: packingRuns.date,
    productName: products.name, bulkUsedGrams: packingRuns.bulkUsedGrams,
    unitType: products.unitType
  }).from(packingRuns)
    .innerJoin(products, eq(packingRuns.productId, products.id))
    .where(and(gte(packingRuns.date, range.dateFrom), lte(packingRuns.date, range.dateTo)))
    .orderBy(packingRuns.date)
    .all()

  const lines = db.select({
    packingRunId: packingRunLines.packingRunId,
    packetsCount: packingRunLines.packetsCount,
    label: productVariants.label
  }).from(packingRunLines)
    .innerJoin(productVariants, eq(packingRunLines.variantId, productVariants.id)).all()

  return runs.map((r) => ({
    id: r.id, date: r.date, productName: r.productName, bulkUsedGrams: r.bulkUsedGrams,
    unitType: (r.unitType ?? 'weight') as 'weight' | 'volume',
    lines: lines.filter((l) => l.packingRunId === r.id).map((l) => ({ label: l.label, packetsCount: l.packetsCount }))
  }))
}

export function profitReport(range: DateRange): ProfitReportRow[] {
  // rules.md #2: exclude null-cost lines — NEVER count as zero
  const db = getDb()
  const result = db.all<{ business_date: string; total_profit: number; null_count: number }>(sql`
    SELECT i.business_date,
      SUM(CASE WHEN il.line_profit_paise IS NOT NULL THEN il.line_profit_paise ELSE 0 END) as total_profit,
      SUM(CASE WHEN il.line_profit_paise IS NULL THEN 1 ELSE 0 END) as null_count
    FROM invoice_lines il
    JOIN invoices i ON il.invoice_id = i.id
    WHERE i.status='active'
      AND i.business_date BETWEEN ${range.dateFrom} AND ${range.dateTo}
    GROUP BY i.business_date
    ORDER BY i.business_date ASC`)
  return result.map((r) => ({
    businessDate: r.business_date,
    totalProfitPaise: r.total_profit ?? 0,
    nullCostLineCount: r.null_count ?? 0
  }))
}

export function duesReport(): DuesRow[] {
  return getDb()
    .select({
      customerId: customers.id, name: customers.name,
      businessName: customers.businessName, creditBalancePaise: customers.creditBalancePaise
    })
    .from(customers)
    .where(and(eq(customers.type, 'wholesale'), gt(customers.creditBalancePaise, 0)))
    .orderBy(sql`credit_balance_paise DESC`)
    .all()
    .map((r) => ({
      customerId: r.customerId, name: r.name,
      businessName: r.businessName ?? null, creditBalancePaise: r.creditBalancePaise
    }))
}

export function expensesReport(range: DateRange): ExpensesSummaryRow[] {
  return getDb()
    .select({ date: expenses.date, category: expenses.category, amountPaise: expenses.amountPaise })
    .from(expenses)
    .where(and(gte(expenses.date, range.dateFrom), lte(expenses.date, range.dateTo)))
    .orderBy(expenses.date)
    .all()
}

export function paymentBreakdown(range: DateRange): PaymentBreakdownRow {
  const db = getDb()
  const rows = db.all<{ payment_mode: string; amount_paid_paise: number; total_paise: number; payment_split: string | null }>(sql`
    SELECT payment_mode, amount_paid_paise, total_paise, payment_split
    FROM invoices
    WHERE business_date BETWEEN ${range.dateFrom} AND ${range.dateTo}
      AND status = 'active'
  `)
  
  // Also fetch explicit payments (credit repayments) for these business dates
  // where invoice_id is null (direct settlements) or just fetch all payments within the range
  // Actually, any payment in the `payments` table falling on this date should be counted
  const paymentRows = db.all<{ mode: string; amount_paise: number }>(sql`
    SELECT mode, amount_paise
    FROM payments
    WHERE date BETWEEN ${range.dateFrom} AND ${range.dateTo}
      AND invoice_id IS NULL
  `)

  const result: PaymentBreakdownRow = {
    cash: 0, upi: 0, card: 0, credit: 0, creditRepaid: 0,
    cashCount: 0, upiCount: 0, cardCount: 0, creditCount: 0,
    total: 0
  }
  const normalizeMode = (mode: unknown): 'cash' | 'upi' | 'card' | 'credit' | 'split' | null => {
    if (typeof mode !== 'string') return null
    const normalized = mode.trim().toLowerCase()
    if (normalized === 'cash' || normalized === 'upi' || normalized === 'card' || normalized === 'credit' || normalized === 'split') {
      return normalized
    }
    return null
  }
  const addPayment = (mode: unknown, amount: number, isRepayment = false): 'cash' | 'upi' | 'card' | null => {
    const normalized = normalizeMode(mode)
    if (!Number.isFinite(amount)) return null
    if (normalized === 'cash' || normalized === 'upi' || normalized === 'card') {
      result[normalized] += amount
      result.total += amount
      if (isRepayment) result.creditRepaid += amount
      return normalized
    }
    return null
  }
  const addCount = (mode: 'cash' | 'upi' | 'card' | 'credit'): void => {
    if (mode === 'cash') result.cashCount += 1
    else if (mode === 'upi') result.upiCount += 1
    else if (mode === 'card') result.cardCount += 1
    else result.creditCount += 1
  }
  
  // Process invoice payments (today's direct sales)
  for (const r of rows) {
    const mode = normalizeMode(r.payment_mode)
    if (mode === 'credit') {
      result.credit += r.total_paise
      addCount('credit')
    } else if (mode === 'split') {
      let splitRows: Array<{ mode?: unknown; method?: unknown; amount?: unknown; amountPaise?: unknown }> = []
      try {
        splitRows = r.payment_split ? JSON.parse(r.payment_split) : []
      } catch {
        splitRows = []
      }
      const countedModes = new Set<'cash' | 'upi' | 'card'>()
      for (const split of splitRows) {
        const amount = typeof split.amount === 'number'
          ? split.amount
          : typeof split.amountPaise === 'number'
            ? split.amountPaise
            : null
        const paidMode = amount !== null ? addPayment(split.mode ?? split.method, amount) : null
        if (paidMode) {
          countedModes.add(paidMode)
        }
      }
      for (const mode of countedModes) addCount(mode)
    } else {
      const paidMode = addPayment(mode, r.amount_paid_paise)
      if (paidMode) {
        addCount(paidMode)
      }
    }
  }

  // Process explicit credit repayments
  for (const p of paymentRows) {
    const mode = normalizeMode(p.mode)
    if (mode === 'cash' || mode === 'upi' || mode === 'card') {
      addPayment(mode, p.amount_paise, true)
      // we do not increment count here so invoice counts stay clean, 
      // but the cash is properly added to totals
    }
  }

  return result
}
