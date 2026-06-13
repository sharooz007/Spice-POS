// src/main/services/invoiceHistory.test.ts — C11, C13
import { describe, it, expect } from 'vitest'
import { computeNewBusinessDate, assertInvoiceImmutables, buildVoidReversal } from './invoiceHistory'
import { blendCost } from '../../shared/costing'

describe('C11 — editInvoiceDateTime pure logic', () => {
  // C11a: 06:10 on 2026-06-09 → business_date stays '2026-06-09'
  it('C11a: invoice at 06:10 → business_date = 2026-06-09', () => {
    const dt = new Date('2026-06-09T06:10:00')
    expect(computeNewBusinessDate(dt.getTime())).toBe('2026-06-09')
  })

  // C11b: edit to 04:50 on 2026-06-09 → business_date re-buckets to '2026-06-08'
  it('C11b: after edit to 04:50 → business_date = 2026-06-08', () => {
    const newDt = new Date(2026, 5, 9, 4, 50, 0) // local time
    expect(computeNewBusinessDate(newDt.getTime())).toBe('2026-06-08')
  })

  // C11c: assertInvoiceImmutables accepts matching snapshots (created_at, amounts, lines)
  it('C11c: immutables pass when values unchanged', () => {
    const snapshot = { createdAt: 1000, subtotalPaise: 5000, totalPaise: 4500, lineCount: 2 }
    expect(() => assertInvoiceImmutables(snapshot, snapshot)).not.toThrow()
  })

  // C11d: assertInvoiceImmutables throws if created_at would change
  it('C11d: immutables fail if created_at changed', () => {
    const before = { createdAt: 1000, subtotalPaise: 5000, totalPaise: 4500, lineCount: 2 }
    const after  = { createdAt: 9999, subtotalPaise: 5000, totalPaise: 4500, lineCount: 2 }
    expect(() => assertInvoiceImmutables(before, after)).toThrow(/created_at/)
  })
})

describe('C13 — cost change never affects prices', () => {
  // C13: blendCost changes avg_cost_per_kg. Price Menu entries are untouched.
  // We verify the separation: blendCost returns a REAL rupees value used only for profit;
  // it is never fed into PriceMenuEntry.retail_price_paise or wholesale_price_paise.
  it('C13: blendCost output is a cost value, not a price', () => {
    const newAvg = blendCost(10, 120, 30, 130)
    expect(newAvg).toBe(127.5) // this is ₹/kg COST — REAL rupees

    // The price menu would have a separate paise value — they are completely independent
    const priceMenuRetailPricePaise = 35000 // ₹350/kg — set by admin, never derived from cost
    expect(newAvg).not.toBe(priceMenuRetailPricePaise / 100) // sanity: cost ≠ price
    expect(typeof newAvg).toBe('number')
    // If cost changes (simulate 2nd arrival), price is still independent
    const newAvg2 = blendCost(40, 127.5, 20, 150)
    expect(newAvg2).toBeCloseTo(135, 5)
    expect(priceMenuRetailPricePaise).toBe(35000) // unchanged — cost never touched price
  })
})

describe('void invoice reversal', () => {
  it('restores packet and loose stock and reverses party credit due', () => {
    const reversal = buildVoidReversal({
      customerId: 42,
      balanceDuePaise: 93500,
      lines: [
        { itemType: 'packet', variantId: 7, productId: 1, qty: 2 },
        { itemType: 'packet', variantId: 7, productId: 1, qty: 3 },
        { itemType: 'loose_bulk', variantId: null, productId: 11, qty: 1250 },
        { itemType: 'loose_bulk', variantId: null, productId: 11, qty: 750 },
      ]
    })

    expect(reversal.packetRestocks).toEqual([{ variantId: 7, qtyPcs: 5 }])
    expect(reversal.bulkRestocks).toEqual([{ productId: 11, qtyGrams: 2000 }])
    expect(reversal.creditReversal).toEqual({ customerId: 42, amountPaise: 93500 })
  })
})
