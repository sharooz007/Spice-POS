// src/main/services/pricing.ts — Price Menu logic (main process only)
// CRITICAL: this service NEVER touches any cost or stock table. (rules.md #1)
import { eq, desc } from 'drizzle-orm'
import { getDb } from '../db'
import { priceMenuEntries, priceHistory, products } from '../db/schema'
import type {
  PriceMenuEntry,
  PriceHistoryRow,
  SetVariantPriceRequest,
  SetProductLooseRateRequest,
  GetCurrentPriceRequest
} from '../../shared/types'

/** Returns the latest PriceMenuEntry with effective_date ≤ date (default today).
 *  Cost is NEVER consulted here. (rules.md #1, domain_logic.md §6) */
export function getCurrentPrice(req: GetCurrentPriceRequest): PriceMenuEntry | null {
  const date = req.date ?? new Date().toISOString().slice(0, 10)
  const row = getDb()
    .select()
    .from(priceMenuEntries)
    .where(eq(priceMenuEntries.variantId, req.variantId))
    .orderBy(desc(priceMenuEntries.effectiveDate), desc(priceMenuEntries.id))
    .all()
    .find((e) => e.effectiveDate <= date)
  if (!row) return null
  return {
    id: row.id,
    variantId: row.variantId,
    retailPricePaise: row.retailPricePaise,
    wholesalePricePaise: row.wholesalePricePaise,
    effectiveDate: row.effectiveDate
  }
}

/** Admin only. Inserts a new PriceMenuEntry and writes a PriceHistory row.
 *  Touches NO stock, NO cost, NO bulk or retail tables. */
export function setVariantPrice(req: SetVariantPriceRequest): void {
  if (req.retailPricePaise < 0 || req.wholesalePricePaise < 0)
    throw new Error('Prices cannot be negative')
  if (!req.effectiveDate) throw new Error('Effective date is required')

  const db = getDb()
  db.transaction((tx) => {
    // Read current price for history (may be null if first entry)
    const current = getCurrentPrice({ variantId: req.variantId, date: req.effectiveDate })

    // Insert new price entry
    tx.insert(priceMenuEntries)
      .values({
        variantId: req.variantId,
        retailPricePaise: req.retailPricePaise,
        wholesalePricePaise: req.wholesalePricePaise,
        effectiveDate: req.effectiveDate
      })
      .run()

    // Write retail price history row
    tx.insert(priceHistory)
      .values({
        targetType: 'variant_retail',
        targetId: req.variantId,
        oldPricePaise: current?.retailPricePaise ?? 0,
        newPricePaise: req.retailPricePaise,
        userId: req.userId
      })
      .run()

    // Write wholesale price history row
    tx.insert(priceHistory)
      .values({
        targetType: 'variant_wholesale',
        targetId: req.variantId,
        oldPricePaise: current?.wholesalePricePaise ?? 0,
        newPricePaise: req.wholesalePricePaise,
        userId: req.userId
      })
      .run()
    // ── NOTHING ELSE IS TOUCHED — no stock, no cost, no bulk, no retail ──────
  })
}

/** Admin only. Updates product wholesale ₹/kg rate and writes PriceHistory.
 *  Touches NO stock, NO cost tables. */
export function setProductLooseRate(req: SetProductLooseRateRequest): void {
  if (req.wholesaleRatePerKgPaise < 0) throw new Error('Rate cannot be negative')

  const db = getDb()
  db.transaction((tx) => {
    const p = tx
      .select({ wholesaleRatePerKgPaise: products.wholesaleRatePerKgPaise })
      .from(products)
      .where(eq(products.id, req.productId))
      .get()
    if (!p) throw new Error('Product not found')

    tx.update(products)
      .set({ wholesaleRatePerKgPaise: req.wholesaleRatePerKgPaise })
      .where(eq(products.id, req.productId))
      .run()

    tx.insert(priceHistory)
      .values({
        targetType: 'product_loose',
        targetId: req.productId,
        oldPricePaise: p.wholesaleRatePerKgPaise,
        newPricePaise: req.wholesaleRatePerKgPaise,
        userId: req.userId
      })
      .run()
    // ── NOTHING ELSE IS TOUCHED ───────────────────────────────────────────────
  })
}

export function listPriceHistory(variantId: string): PriceHistoryRow[] {
  return getDb()
    .select()
    .from(priceHistory)
    .where(eq(priceHistory.targetId, variantId))
    .orderBy(desc(priceHistory.changedAt))
    .all()
    .map((r) => ({
      id: r.id,
      targetType: r.targetType,
      targetId: r.targetId,
      oldPricePaise: r.oldPricePaise,
      newPricePaise: r.newPricePaise,
      changedAt: r.changedAt instanceof Date ? r.changedAt.getTime() : Number(r.changedAt),
      userId: r.userId
    }))
}

export function listAllPriceMenuEntries(): PriceMenuEntry[] {
  return getDb()
    .select()
    .from(priceMenuEntries)
    .orderBy(desc(priceMenuEntries.effectiveDate), desc(priceMenuEntries.id))
    .all()
    .map((r) => ({
      id: r.id,
      variantId: r.variantId,
      retailPricePaise: r.retailPricePaise,
      wholesalePricePaise: r.wholesalePricePaise,
      effectiveDate: r.effectiveDate
    }))
}
