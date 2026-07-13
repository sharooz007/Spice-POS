// src/main/services/bulkInventory.ts — Bulk Inventory & Costing (main process only)
// rules.md #2, #3, #4, #11, #12, #14
import { eq, desc } from 'drizzle-orm'
import { getDb } from '../db'
import { bulkStock, bulkArrivals, bulkAdjustments } from '../db/schema'
import { blendCost } from '../../shared/costing'
import type {
  BulkStockRow,
  BulkArrivalRow,
  BulkAdjustmentRow,
  RecordBulkArrivalRequest,
  RecordBulkAdjustmentRequest
} from '../../shared/types'

// ── Pure computation helper (exported for unit tests) ─────────────────────────

/** Compute the new avg_cost_per_kg after a bulk arrival.
 *  Returns the new avg (REAL rupees, nullable) — does NOT mutate anything. */
export function computeNewAvg(
  existingQtyGrams: number,
  existingAvgRupees: number | null,
  addQtyGrams: number,
  addCostRupees: number | null // null = blank-cost arrival
): number | null {
  // rules.md #3: blank-cost arrival → avg unchanged
  if (addCostRupees === null) return existingAvgRupees
  return blendCost(existingQtyGrams / 1000, existingAvgRupees, addQtyGrams / 1000, addCostRupees)
}

// ── Service functions ─────────────────────────────────────────────────────────

export function recordBulkArrival(req: RecordBulkArrivalRequest): void {
  if (req.qtyGrams <= 0) throw new Error('Quantity must be positive')
  if (!req.date) throw new Error('Date is required')

  const db = getDb()
  db.transaction((tx) => {
    // Insert arrival row (costPerKgPaise nullable — blank cost is valid)
    tx.insert(bulkArrivals)
      .values({
        productId: req.productId,
        date: req.date,
        qtyGrams: req.qtyGrams,
        costPerKgPaise: req.costPerKgPaise ?? null,
        notes: req.notes ?? null
      })
      .run()

    // Fetch or init bulk stock
    const existing = tx
      .select()
      .from(bulkStock)
      .where(eq(bulkStock.productId, req.productId))
      .get()

    const existQtyGrams = existing?.qtyGrams ?? 0
    const existAvg = existing?.avgCostPerKg ?? null

    // Convert costPerKgPaise to REAL rupees for blendCost (the only float)
    const addCostRupees =
      req.costPerKgPaise != null ? req.costPerKgPaise / 100 : null

    const newAvg = computeNewAvg(existQtyGrams, existAvg, req.qtyGrams, addCostRupees)
    const newQty = existQtyGrams + req.qtyGrams

    if (existing) {
      tx.update(bulkStock)
        .set({ qtyGrams: newQty, avgCostPerKg: newAvg })
        .where(eq(bulkStock.productId, req.productId))
        .run()
    } else {
      tx.insert(bulkStock)
        .values({ productId: req.productId, qtyGrams: newQty, avgCostPerKg: newAvg })
        .run()
    }
  })
}

export function recordBulkAdjustment(req: RecordBulkAdjustmentRequest): void {
  if (!req.reason.trim()) throw new Error('Reason is required')

  const db = getDb()
  db.transaction((tx) => {
    const stock = tx
      .select({ qtyGrams: bulkStock.qtyGrams })
      .from(bulkStock)
      .where(eq(bulkStock.productId, req.productId))
      .get()

    const currentQty = stock?.qtyGrams ?? 0
    const newQty = currentQty + req.qtyChangeGrams

    if (newQty < 0) {
      throw new Error(
        `Adjustment would bring stock below zero (current: ${currentQty}g, change: ${req.qtyChangeGrams}g)`
      )
    }

    const today = new Date().toISOString().slice(0, 10)
    tx.insert(bulkAdjustments)
      .values({
        productId: req.productId,
        date: today,
        qtyChangeGrams: req.qtyChangeGrams,
        reason: req.reason,
        notes: req.notes ?? null,
        userId: req.userId
      })
      .run()

    if (stock) {
      tx.update(bulkStock)
        .set({ qtyGrams: newQty })
        .where(eq(bulkStock.productId, req.productId))
        .run()
    } else {
      tx.insert(bulkStock)
        .values({ productId: req.productId, qtyGrams: newQty })
        .run()
    }
  })
}

export function getBulkStock(productId: string): BulkStockRow | null {
  const row = getDb()
    .select()
    .from(bulkStock)
    .where(eq(bulkStock.productId, productId))
    .get()
  if (!row) return null
  return { productId: row.productId, qtyGrams: row.qtyGrams, avgCostPerKg: row.avgCostPerKg ?? null }
}

export function listBulkArrivals(productId: string): BulkArrivalRow[] {
  return getDb()
    .select()
    .from(bulkArrivals)
    .where(eq(bulkArrivals.productId, productId))
    .orderBy(desc(bulkArrivals.createdAt))
    .all()
    .map((r) => ({
      id: r.id,
      productId: r.productId,
      date: r.date,
      qtyGrams: r.qtyGrams,
      costPerKgPaise: r.costPerKgPaise ?? null,
      notes: r.notes ?? null,
      createdAt: r.createdAt instanceof Date ? r.createdAt.getTime() : Number(r.createdAt)
    }))
}

export function listBulkAdjustments(productId: string): BulkAdjustmentRow[] {
  return getDb()
    .select()
    .from(bulkAdjustments)
    .where(eq(bulkAdjustments.productId, productId))
    .orderBy(desc(bulkAdjustments.createdAt))
    .all()
    .map((r) => ({
      id: r.id,
      productId: r.productId,
      date: r.date,
      qtyChangeGrams: r.qtyChangeGrams,
      reason: r.reason,
      notes: r.notes ?? null,
      userId: r.userId,
      createdAt: r.createdAt instanceof Date ? r.createdAt.getTime() : Number(r.createdAt)
    }))
}

export function deleteArrival(arrivalId: string, _userId: string): void {
  const db = getDb()
  db.transaction((tx) => {
    // Fetch the arrival to delete
    const arrival = tx
      .select()
      .from(bulkArrivals)
      .where(eq(bulkArrivals.id, arrivalId))
      .get()
    if (!arrival) throw new Error('Arrival not found')

    const { productId, qtyGrams } = arrival

    // Check stock won't go negative
    const stock = tx
      .select()
      .from(bulkStock)
      .where(eq(bulkStock.productId, productId))
      .get()
    const currentQty = stock?.qtyGrams ?? 0
    if (currentQty - qtyGrams < 0) {
      throw new Error(
        `Cannot delete: stock would go negative (current: ${currentQty}g, arrival: ${qtyGrams}g)`
      )
    }

    // Delete the arrival row
    tx.delete(bulkArrivals).where(eq(bulkArrivals.id, arrivalId)).run()

    // Recompute avg from scratch using remaining costed arrivals
    const remaining = tx
      .select()
      .from(bulkArrivals)
      .where(eq(bulkArrivals.productId, productId))
      .all()

    const costed = remaining.filter((r) => r.costPerKgPaise != null)
    let newAvg: number | null = null
    if (costed.length > 0) {
      // Fold all costed arrivals into a running blend
      let runQty = 0
      let runAvg: number | null = null
      for (const r of costed) {
        const costRupees = r.costPerKgPaise! / 100
        runAvg = blendCost(runQty / 1000, runAvg, r.qtyGrams / 1000, costRupees)
        runQty += r.qtyGrams
      }
      newAvg = runAvg
    }

    // Update stock: subtract qty, set recomputed avg
    tx.update(bulkStock)
      .set({ qtyGrams: currentQty - qtyGrams, avgCostPerKg: newAvg })
      .where(eq(bulkStock.productId, productId))
      .run()
  })
}

/** All bulk stock with low-stock flag per product */
export function listAllBulkStock(): Array<BulkStockRow & { productId: string }> {
  return getDb()
    .select()
    .from(bulkStock)
    .all()
    .map((r) => ({
      productId: r.productId,
      qtyGrams: r.qtyGrams,
      avgCostPerKg: r.avgCostPerKg ?? null
    }))
}
