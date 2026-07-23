// src/main/services/retailInventory.ts — Retail Packet Inventory (main process only)
// rules.md #5 (retail stock, not bulk), #12 (transaction), #14 (admin-only adjustments)
// INVARIANT: avg_cost_per_pc is NEVER modified by adjustments — only qty_pcs changes.
import { eq } from 'drizzle-orm'
import { getDb } from '../db'
import {
  retailPacketStock,
  retailAdjustments,
  packingRunLines,
  packingRuns,
  invoiceLines
} from '../db/schema'
import type {
  RetailStockRow,
  RetailMovementRow,
  RecordRetailAdjustmentRequest
} from '../../shared/types'

const VALID_REASONS = ['manual', 'damage', 'wastage', 'outside_purchase'] as const

export function getRetailStock(variantId?: string): RetailStockRow[] {
  const db = getDb()
  const rows = variantId
    ? db.select().from(retailPacketStock).where(eq(retailPacketStock.variantId, variantId)).all()
    : db.select().from(retailPacketStock).all()
  return rows.map((r) => ({
    variantId: r.variantId,
    qtyPcs: r.qtyPcs,
    avgCostPerPc: r.avgCostPerPc ?? null
  }))
}

export function recordRetailAdjustment(req: RecordRetailAdjustmentRequest): void {
  if (!(VALID_REASONS as readonly string[]).includes(req.reason)) {
    throw new Error(`Invalid reason. Must be one of: ${VALID_REASONS.join(', ')}`)
  }

  const db = getDb()
  db.transaction((tx) => {
    const stock = tx
      .select({ qtyPcs: retailPacketStock.qtyPcs })
      .from(retailPacketStock)
      .where(eq(retailPacketStock.variantId, req.variantId))
      .get()

    const currentQty = stock?.qtyPcs ?? 0
    const newQty = currentQty + req.qtyChangePcs

    if (newQty < 0) {
      throw new Error(
        `Adjustment would bring stock below zero (current: ${currentQty} pcs, change: ${req.qtyChangePcs})`
      )
    }

    const today = new Date().toISOString().slice(0, 10)
    tx.insert(retailAdjustments)
      .values({
        variantId: req.variantId,
        date: today,
        qtyChangePcs: req.qtyChangePcs,
        reason: req.reason,
        notes: req.notes ?? null,
        userId: req.userId
      })
      .run()

    // ONLY qty_pcs changes — avg_cost_per_pc is untouched (rules.md #5 + invariant)
    if (stock) {
      tx.update(retailPacketStock)
        .set({ qtyPcs: newQty })
        .where(eq(retailPacketStock.variantId, req.variantId))
        .run()
    } else {
      tx.insert(retailPacketStock)
        .values({ variantId: req.variantId, qtyPcs: newQty })
        .run()
    }
  })
}

export function addOutsideRetailStock(req: { variantId: string, qtyPcs: number, costPerPcPaise: number, userId: string, notes?: string }): void {
  const db = getDb()
  db.transaction((tx) => {
    const stock = tx
      .select({ qtyPcs: retailPacketStock.qtyPcs, avgCostPerPc: retailPacketStock.avgCostPerPc })
      .from(retailPacketStock)
      .where(eq(retailPacketStock.variantId, req.variantId))
      .get()

    const currentQty = stock?.qtyPcs ?? 0
    const currentAvgCost = stock?.avgCostPerPc ?? 0
    const newQty = currentQty + req.qtyPcs

    if (req.qtyPcs <= 0) {
      throw new Error(`Quantity must be greater than zero (change: ${req.qtyPcs})`)
    }

    const costPerPc = req.costPerPcPaise / 100
    // moving average calculation
    const totalCurrentValue = currentQty * currentAvgCost
    const totalAddedValue = req.qtyPcs * costPerPc
    const newAvgCost = (totalCurrentValue + totalAddedValue) / newQty

    const today = new Date().toISOString().slice(0, 10)
    tx.insert(retailAdjustments)
      .values({
        variantId: req.variantId,
        date: today,
        qtyChangePcs: req.qtyPcs,
        reason: 'outside_purchase',
        notes: req.notes ?? null,
        userId: req.userId
      })
      .run()

    if (stock) {
      tx.update(retailPacketStock)
        .set({ qtyPcs: newQty, avgCostPerPc: newAvgCost })
        .where(eq(retailPacketStock.variantId, req.variantId))
        .run()
    } else {
      tx.insert(retailPacketStock)
        .values({ variantId: req.variantId, qtyPcs: newQty, avgCostPerPc: newAvgCost })
        .run()
    }
  })
}

export function listRetailMovements(variantId: string): RetailMovementRow[] {
  const db = getDb()
  const rows: RetailMovementRow[] = []

  // Packing run lines (positive — stock in)
  const packLines = db
    .select({
      date: packingRuns.date,
      packetsCount: packingRunLines.packetsCount,
      runId: packingRuns.id
    })
    .from(packingRunLines)
    .innerJoin(packingRuns, eq(packingRunLines.packingRunId, packingRuns.id))
    .where(eq(packingRunLines.variantId, variantId))
    .all()

  for (const l of packLines) {
    rows.push({
      date: l.date,
      type: 'packing',
      qtyChange: l.packetsCount,
      reference: `Run #${l.runId}`
    })
  }

  // Retail adjustments (signed)
  const adjs = db
    .select()
    .from(retailAdjustments)
    .where(eq(retailAdjustments.variantId, variantId))
    .all()

  for (const a of adjs) {
    rows.push({
      date: a.date,
      type: 'adjustment',
      qtyChange: a.qtyChangePcs,
      reference: `Adj #${a.id} (${a.reason})`
    })
  }

  // Invoice lines (packet sales — negative qty = stock out). Returns empty until Phase 7.
  const sales = db
    .select({
      invoiceId: invoiceLines.invoiceId,
      qty: invoiceLines.qty,
      date: invoiceLines.id // placeholder; invoices.business_date added in Phase 7 join
    })
    .from(invoiceLines)
    .where(eq(invoiceLines.variantId, variantId))
    .all()

  for (const s of sales) {
    rows.push({
      date: String(s.date), // Phase 7 will provide the real business_date
      type: 'sale',
      qtyChange: -s.qty,
      reference: `Invoice #${s.invoiceId}`
    })
  }

  // Sort newest-first by date string (YYYY-MM-DD sorts lexicographically)
  return rows.sort((a, b) => b.date.localeCompare(a.date))
}
