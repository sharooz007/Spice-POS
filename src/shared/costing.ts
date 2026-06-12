// shared/costing.ts — moving weighted average cost (domain_logic.md §1)
// Single place the blend is computed; both bulk arrivals and packing call this.

/** Blend two weighted cost pools.
 *  Quantities in any consistent unit (kg for bulk, pcs for packets).
 *  Costs are REAL rupees or null (null = unknown).
 *  Returns null if either cost is unknown (can't average an unknown pool). */
export function blendCost(
  qtyA: number,
  costA: number | null,
  qtyB: number,
  costB: number | null
): number | null {
  if (qtyA === 0) return costB // empty pool: new cost simply takes over
  if (qtyB === 0) return costA
  if (costA == null || costB == null) return null // unknown + anything = unknown
  return (qtyA * costA + qtyB * costB) / (qtyA + qtyB)
}
