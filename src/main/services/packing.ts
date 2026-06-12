// src/main/services/packing.ts — Packing run logic (main process only)
// rules.md #4 (no over-pack), #5 (bulk not retail), #6 (no overhead), #12 (transaction)
import { eq, desc } from 'drizzle-orm'
import { getDb } from '../db'
import { bulkStock, packingRuns, packingRunLines, retailPacketStock, productVariants } from '../db/schema'
import { blendCost } from '../../shared/costing'
import type {
  ValidatePackingRunRequest,
  ValidatePackingRunResult,
  CommitPackingRunRequest,
  PackingRunRow
} from '../../shared/types'

// ── Pure helpers (exported for unit tests) ────────────────────────────────────

/** packetCost = bulk avg (₹/kg) × weight_grams / 1000, or null if avg unknown.
 *  No overhead — ever. (rules.md #6) */
export function computePacketCost(
  bulkAvgRupees: number | null,
  weightGrams: number
): number | null {
  if (bulkAvgRupees === null) return null
  return bulkAvgRupees * (weightGrams / 1000)
}

/** Sum up total grams for a packing run from lines with variant weight info. */
export function computePackingTotals(
  lines: Array<{ variant: { weightGrams: number }; packetsCount: number }>
): { totalGrams: number } {
  const totalGrams = lines.reduce((s, l) => s + l.packetsCount * l.variant.weightGrams, 0)
  return { totalGrams }
}

/** Blend existing retail packet stock average with newly packed packets.
 *  Delegates to blendCost — never duplicated. */
export function blendRetailStock(
  existingPcs: number,
  existingAvg: number | null,
  newPcs: number,
  newCostRupees: number | null
): number | null {
  return blendCost(existingPcs, existingAvg, newPcs, newCostRupees)
}

// ── Service functions ─────────────────────────────────────────────────────────

export function validatePackingRun(req: ValidatePackingRunRequest): ValidatePackingRunResult {
  if (!req.lines.length) return { ok: false, error: 'No lines provided' }

  const db = getDb()

  // Fetch variant weights
  const variantIds = req.lines.map((l) => l.variantId)
  const vars = db.select({ id: productVariants.id, weightGrams: productVariants.weightGrams })
    .from(productVariants)
    .all()
    .filter((v) => variantIds.includes(v.id))

  const varMap = Object.fromEntries(vars.map((v) => [v.id, v.weightGrams]))
  for (const l of req.lines) {
    if (!varMap[l.variantId]) return { ok: false, error: `Variant ${l.variantId} not found` }
    if (l.packetsCount <= 0) return { ok: false, error: 'Packet count must be positive' }
  }

  const totalGrams = req.lines.reduce((s, l) => s + l.packetsCount * varMap[l.variantId], 0)

  const stock = db.select({ qtyGrams: bulkStock.qtyGrams })
    .from(bulkStock)
    .where(eq(bulkStock.productId, req.productId))
    .get()

  const bulkAvailableGrams = stock?.qtyGrams ?? 0

  if (totalGrams > bulkAvailableGrams) {
    return {
      ok: false,
      error: `Over-pack: need ${totalGrams}g but only ${bulkAvailableGrams}g available`
    }
  }

  return { ok: true, totalGrams, bulkAvailableGrams }
}

export function commitPackingRun(req: CommitPackingRunRequest): number {
  if (!req.lines.length) throw new Error('No lines provided')

  const db = getDb()

  return db.transaction((tx) => {
    // Fetch variant weights inside the transaction
    const variantIds = req.lines.map((l) => l.variantId)
    const vars = tx.select({ id: productVariants.id, weightGrams: productVariants.weightGrams })
      .from(productVariants)
      .all()
      .filter((v) => variantIds.includes(v.id))

    const varMap = Object.fromEntries(vars.map((v) => [v.id, v.weightGrams]))

    // Compute totalGrams inside the transaction (race-safe)
    const totalGrams = req.lines.reduce((s, l) => {
      if (!varMap[l.variantId]) throw new Error(`Variant ${l.variantId} not found`)
      if (l.packetsCount <= 0) throw new Error('Packet count must be positive')
      return s + l.packetsCount * varMap[l.variantId]
    }, 0)

    // Hard reject if over-pack — inside transaction, race-safe (rules.md #4)
    const bulk = tx.select().from(bulkStock).where(eq(bulkStock.productId, req.productId)).get()
    if (!bulk) throw new Error('Bulk stock record not found for this product')
    if (totalGrams > bulk.qtyGrams) {
      throw new Error(
        `Over-pack: need ${totalGrams}g but only ${bulk.qtyGrams}g available`
      )
    }

    const today = new Date().toISOString().slice(0, 10)

    // Insert PackingRun
    const [run] = tx.insert(packingRuns)
      .values({
        date: today,
        productId: req.productId,
        bulkUsedGrams: totalGrams,
        userId: req.userId,
        notes: req.notes ?? null
      })
      .returning({ id: packingRuns.id })
      .all()

    // Process each line
    for (const line of req.lines) {
      const weightGrams = varMap[line.variantId]
      // Packet cost: bulk avg × weight/1000, null if avg unknown (rules.md #6)
      const packetCost = computePacketCost(bulk.avgCostPerKg ?? null, weightGrams)

      // Insert PackingRunLine
      tx.insert(packingRunLines)
        .values({
          packingRunId: run.id,
          variantId: line.variantId,
          packetsCount: line.packetsCount,
          unitCostAtPack: packetCost
        })
        .run()

      // Fetch or init RetailPacketStock
      const rStock = tx.select()
        .from(retailPacketStock)
        .where(eq(retailPacketStock.variantId, line.variantId))
        .get()

      const existPcs = rStock?.qtyPcs ?? 0
      const existAvg = rStock?.avgCostPerPc ?? null
      const newAvg = blendRetailStock(existPcs, existAvg, line.packetsCount, packetCost)
      const newPcs = existPcs + line.packetsCount

      if (rStock) {
        tx.update(retailPacketStock)
          .set({ qtyPcs: newPcs, avgCostPerPc: newAvg })
          .where(eq(retailPacketStock.variantId, line.variantId))
          .run()
      } else {
        tx.insert(retailPacketStock)
          .values({ variantId: line.variantId, qtyPcs: newPcs, avgCostPerPc: newAvg })
          .run()
      }
    }

    // Deduct bulk qty — avg_cost_per_kg does NOT change (packing doesn't alter bulk cost)
    tx.update(bulkStock)
      .set({ qtyGrams: bulk.qtyGrams - totalGrams })
      .where(eq(bulkStock.productId, req.productId))
      .run()

    return run.id
  })
}

export function listPackingRuns(productId?: number): PackingRunRow[] {
  const db = getDb()
  const runs = db.select().from(packingRuns)
    .orderBy(desc(packingRuns.createdAt))
    .all()
    .filter((r) => productId == null || r.productId === productId)

  const lines = db.select().from(packingRunLines).all()

  return runs.map((r) => ({
    id: r.id,
    date: r.date,
    productId: r.productId,
    bulkUsedGrams: r.bulkUsedGrams,
    userId: r.userId,
    notes: r.notes ?? null,
    createdAt: r.createdAt instanceof Date ? r.createdAt.getTime() : Number(r.createdAt),
    lines: lines
      .filter((l) => l.packingRunId === r.id)
      .map((l) => ({
        id: l.id,
        variantId: l.variantId,
        packetsCount: l.packetsCount,
        unitCostAtPack: l.unitCostAtPack ?? null
      }))
  }))
}
