// src/main/services/packing.test.ts — C5, C6, C7
import { describe, it, expect } from 'vitest'
import { computePacketCost, computePackingTotals, blendRetailStock } from './packing'

// Variant descriptors used across tests (weight in grams)
const variants = {
  v1kg:  { id: 1, weightGrams: 1000 },
  v500g: { id: 2, weightGrams: 500 },
  v100g: { id: 3, weightGrams: 100 }
}

describe('packing — pure computation', () => {
  // C5: pack 10×1kg + 20×500g + 50×100g from 40 kg @ ₹127.50
  it('C5: packet costs and bulk deduction are correct', () => {
    const bulkAvgRupees = 127.5

    // Packet costs (rules.md #6: avg × weight/1000, no overhead)
    expect(computePacketCost(bulkAvgRupees, 1000)).toBe(127.5)   // 127.5 × 1 kg
    expect(computePacketCost(bulkAvgRupees, 500)).toBe(63.75)    // 127.5 × 0.5 kg
    expect(computePacketCost(bulkAvgRupees, 100)).toBe(12.75)    // 127.5 × 0.1 kg

    const lines = [
      { variant: variants.v1kg,  packetsCount: 10 },
      { variant: variants.v500g, packetsCount: 20 },
      { variant: variants.v100g, packetsCount: 50 }
    ]
    const { totalGrams } = computePackingTotals(lines)
    // 10×1000 + 20×500 + 50×100 = 10000 + 10000 + 5000 = 25000 g
    expect(totalGrams).toBe(25_000)
    // Bulk remaining: 40000 - 25000 = 15000 g
    expect(40_000 - totalGrams).toBe(15_000)
  })

  // C6: over-pack rejected — pack 26 kg from 25 kg bulk
  it('C6: totalGrams > bulkAvailable triggers rejection', () => {
    const lines = [{ variant: variants.v1kg, packetsCount: 26 }]
    const { totalGrams } = computePackingTotals(lines)
    expect(totalGrams).toBe(26_000)
    // The check: totalGrams > available → reject
    const bulkAvailableGrams = 25_000
    expect(totalGrams > bulkAvailableGrams).toBe(true)
  })

  // C7: existing retail stock 5 pcs @ null cost + 10 new pcs @ ₹120 → blended avg = null
  it('C7: unknown existing stock + known new packets → blended avg is null', () => {
    // existing: 5 pcs, avg_cost_per_pc = null
    // packing: 10 pcs @ ₹120 packet cost
    const result = blendRetailStock(5, null, 10, 120)
    expect(result).toBeNull() // blendCost(5, null, 10, 120) = null (rules.md #2)
  })

  // computePacketCost with null bulk avg → null
  it('null bulk avg → null packet cost', () => {
    expect(computePacketCost(null, 500)).toBeNull()
  })
})
