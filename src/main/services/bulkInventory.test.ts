// src/main/services/bulkInventory.test.ts
// Integration-style tests for the bulk arrival algorithm (C2, C3, C4).
// Tests computeNewAvg — the pure computation extracted from recordBulkArrival.
// This mirrors exactly what recordBulkArrival does inside the transaction.
import { describe, it, expect } from 'vitest'
import { computeNewAvg } from './bulkInventory'

describe('bulk arrival algorithm — computeNewAvg', () => {
  // C2: blank-cost arrival — qty increases (tested elsewhere), avg stays unchanged
  it('C2: blank arrival (addCostRupees=null) → avg unchanged at 127.5', () => {
    // Existing: 40 kg @ ₹127.50, arrival: 20 kg, NO cost
    const newAvg = computeNewAvg(
      40_000, // existingQtyGrams
      127.5,  // existingAvgRupees
      20_000, // addQtyGrams
      null    // blank cost
    )
    expect(newAvg).toBe(127.5) // avg left exactly as-is (rules.md #3)
  })

  // C3: existing avg is null (unknown pool) + costed arrival → avg stays null
  it('C3: unknown pool (avgCostPerKg=null) + costed arrival → null', () => {
    const newAvg = computeNewAvg(
      10_000, // 10 kg existing, unknown avg
      null,   // unknown avg
      30_000, // 30 kg arrival
      130     // ₹130/kg cost provided
    )
    expect(newAvg).toBeNull() // can't blend unknown pool (rules.md #2)
  })

  // C4: empty bulk (0 kg) + costed arrival → avg takes the new cost
  it('C4: empty bulk + costed arrival → avg = new cost', () => {
    const newAvg = computeNewAvg(
      0,    // 0 kg existing (empty)
      null, // no prior avg
      30_000, // 30 kg arriving
      130     // ₹130/kg
    )
    expect(newAvg).toBe(130)
  })

  // Bonus: C1 scenario through computeNewAvg — verify it delegates to blendCost correctly
  it('C1 via computeNewAvg: 10 kg @120 + 30 kg @130 → 127.5', () => {
    const newAvg = computeNewAvg(10_000, 120, 30_000, 130)
    expect(newAvg).toBe(127.5)
  })
})
