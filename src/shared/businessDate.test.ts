import { describe, it, expect } from 'vitest'
import { businessDate } from './businessDate'

describe('businessDate — 05:00 local cutoff', () => {
  // C9: 01:30 → previous business day
  it('C9: 01:30 on 2026-06-09 → 2026-06-08', () => {
    // Construct date in local time using explicit components
    const dt = new Date(2026, 5, 9, 1, 30, 0) // month is 0-indexed: 5 = June
    expect(businessDate(dt)).toBe('2026-06-08')
  })

  // C10: 05:00 exactly → same business day
  it('C10: 05:00 on 2026-06-09 → 2026-06-09', () => {
    const dt = new Date(2026, 5, 9, 5, 0, 0)
    expect(businessDate(dt)).toBe('2026-06-09')
  })
})
