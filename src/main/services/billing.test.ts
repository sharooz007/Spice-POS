// src/main/services/billing.test.ts — C8, rollback guard, packed-only enforcement
import { describe, it, expect } from 'vitest'
import { computeLineProfit, computeSaleTotals, assertPackedOnly, computeLooseLineProfit, computeWholesaleTotals } from './billing'

describe('retail billing — pure computation', () => {
  // C8: avg_cost_per_pc is null → lineProfitPaise null, revenue still recorded
  it('C8: null cost → lineProfitPaise null, lineTotalPaise correct', () => {
    const result = computeLineProfit({
      unitPricePaise: 3500,
      qtyPcs: 2,
      avgCostPerPc: null
    })
    expect(result.lineTotalPaise).toBe(7000)       // 3500 × 2 = 7000 paise
    expect(result.unitCostSnapshot).toBeNull()
    expect(result.lineProfitPaise).toBeNull()        // rules.md #2 — profit unknown
  })

  // C8 with known cost: profit is correctly snapshotted
  it('C8 variant: known cost → lineProfitPaise snapshotted correctly', () => {
    const result = computeLineProfit({
      unitPricePaise: 3500,
      qtyPcs: 2,
      avgCostPerPc: 30.0 // ₹30/pc
    })
    expect(result.lineTotalPaise).toBe(7000)
    expect(result.lineProfitPaise).toBe(7000 - Math.round(30.0 * 100 * 2)) // 7000 - 6000 = 1000
  })

  // Sale totals
  it('computeSaleTotals: subtotal, total, balance correct', () => {
    const totals = computeSaleTotals([
      { unitPricePaise: 3500, qtyPcs: 2 },
      { unitPricePaise: 8000, qtyPcs: 1 }
    ], 500)
    expect(totals.subtotalPaise).toBe(15000) // 7000 + 8000
    expect(totals.totalPaise).toBe(14500)    // 15000 - 500
  })

  // Rollback enforcement: assertPackedOnly throws on any non-packet item
  it('assertPackedOnly: throws if a non-packet item type is passed', () => {
    expect(() =>
      assertPackedOnly([
        { variantId: "1", qtyPcs: 2, unitPricePaise: 3500 },
        { variantId: "0", qtyPcs: 1, unitPricePaise: 0 } // variantId 0 = invalid loose marker
      ])
    ).toThrow()
  })

  it('assertPackedOnly: passes for all valid packed lines', () => {
    expect(() =>
      assertPackedOnly([{ variantId: "1", qtyPcs: 2, unitPricePaise: 3500 }])
    ).not.toThrow()
  })
})

describe('wholesale billing — pure computation', () => {
  // C12: loose line deducts from bulk, NOT retail
  // The service enforces this at the transaction level.
  // Here we verify computeLooseLineProfit behaves correctly.
  it('C12: loose line profit snapshot uses bulk avg cost per kg', () => {
    // 15 kg @ wholesale price ₹200/kg, bulk avg ₹130/kg
    const result = computeLooseLineProfit({
      unitPricePerKgPaise: 20000, // ₹200/kg
      qtyGrams: 15_000,           // 15 kg
      bulkAvgCostPerKg: 130       // ₹130/kg REAL rupees
    })
    // sellPaise = round(20000 * 15000 / 1000) = 300000
    expect(result.lineTotalPaise).toBe(300_000)
    // costPaise = round(130 * 100 * 15000 / 1000) = round(195000) = 195000
    expect(result.lineProfitPaise).toBe(300_000 - 195_000) // 105000
    expect(result.unitCostSnapshot).toBe(130)
  })

  it('C12: loose line with null bulk avg → profit null, revenue recorded', () => {
    const result = computeLooseLineProfit({
      unitPricePerKgPaise: 20000,
      qtyGrams: 15_000,
      bulkAvgCostPerKg: null
    })
    expect(result.lineTotalPaise).toBe(300_000)
    expect(result.lineProfitPaise).toBeNull()
    expect(result.unitCostSnapshot).toBeNull()
  })

  // Packet wholesale: uses wholesale price, same profit logic as retail
  it('packet wholesale: profit computed correctly', () => {
    const result = computeLineProfit({ unitPricePaise: 7000, qtyPcs: 3, avgCostPerPc: 55 })
    expect(result.lineTotalPaise).toBe(21_000)
    // costPaise = round(55 * 100 * 3) = 16500
    expect(result.lineProfitPaise).toBe(21_000 - 16_500)
  })

  // Loose price override: computeWholesaleTotals uses whatever price is on the line
  it('loose price override stored as-is', () => {
    const totals = computeWholesaleTotals([
      { unitPricePaise: 18000, qty: 5000, unit: 'grams' as const },  // override price
      { unitPricePaise: 7000, qty: 2, unit: 'pcs' as const }
    ], 0)
    // loose: round(18000 * 5000 / 1000) = 90000
    // packet: 7000 * 2 = 14000
    expect(totals.subtotalPaise).toBe(90_000 + 14_000)
  })
})
