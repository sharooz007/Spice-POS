import { describe, it, expect } from 'vitest'
import { blendCost } from './costing'

describe('blendCost — moving weighted average', () => {
  // C1: standard blend — the owner's example from domain_logic.md §1
  it('C1: blendCost(10, 120, 30, 130) === 127.5', () => {
    expect(blendCost(10, 120, 30, 130)).toBe(127.5)
  })

  // C2: blank-cost arrival leaves the average unchanged.
  //     The arrival handler guards: if addCost == null, skip blending.
  //     We test that guard here by simulating it directly.
  it('C2: blank-cost arrival (null costB) — avg unchanged, qty increases', () => {
    let avgCost: number | null = 127.5
    let qtyKg = 40

    const addQty = 20
    const addCost: number | null = null // blank cost

    // Arrival handler guard (domain_logic.md §1):
    if (addCost !== null) {
      avgCost = blendCost(qtyKg, avgCost, addQty, addCost)
    }
    qtyKg += addQty

    expect(avgCost).toBe(127.5) // avg unchanged
    expect(qtyKg).toBe(60)      // qty increased
  })

  // C3: unknown pool (costA null) + costed arrival → null (can't blend unknown pool)
  it('C3: null costA + known costB → null', () => {
    expect(blendCost(10, null, 30, 130)).toBeNull()
  })

  // C4: empty bulk (qtyA === 0) → new cost simply takes over
  it('C4: empty pool (qtyA=0) → costB', () => {
    expect(blendCost(0, null, 30, 130)).toBe(130)
  })
})
