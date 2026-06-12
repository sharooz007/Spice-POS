// shared/businessDate.ts — 05:00 local cutoff rule (domain_logic.md §4)

/** Returns 'YYYY-MM-DD' business date using local time with a fixed 05:00 cutoff.
 *  Dates before 05:00 local belong to the previous business day. */
export function businessDate(dt: Date): string {
  const d = new Date(dt)
  if (d.getHours() < 5) {
    d.setDate(d.getDate() - 1)
  }
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
