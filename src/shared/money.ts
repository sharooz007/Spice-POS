// shared/money.ts — display-boundary helpers only.
// All arithmetic in the app uses integers (paise / grams). Convert ONLY at the display edge.

/** Format paise as a rupee string, e.g. 12750 → "₹127.50" */
export function paiseToCurrency(paise: number): string {
  return '₹' + (paise / 100).toFixed(2)
}

/** Parse a rupee float to paise integer, e.g. 127.5 → 12750 */
export function currencyToPaise(rupees: number): number {
  return Math.round(rupees * 100)
}

/** Convert grams to kg for display, e.g. 1500 → 1.5 */
export function gramsToKg(grams: number): number {
  return grams / 1000
}

/** Convert kg input to grams integer, e.g. 1.5 → 1500 */
export function kgToGrams(kg: number): number {
  return Math.round(kg * 1000)
}

/**
 * Format a gram/ml integer for display respecting unit type.
 * weight: <1000 → "Xg",  >=1000 → "X.XXX kg"
 * volume: <1000 → "Xml", >=1000 → "X.XXX L"
 */
export function formatQuantity(grams: number, unitType: 'weight' | 'volume'): string {
  if (grams < 1000) return unitType === 'volume' ? `${grams}ml` : `${grams}g`
  return unitType === 'volume'
    ? `${(grams / 1000).toFixed(3)} L`
    : `${(grams / 1000).toFixed(3)} kg`
}

/** Unit label for bulk quantities: "kg" or "L" */
export function bulkUnit(unitType: 'weight' | 'volume'): string {
  return unitType === 'volume' ? 'L' : 'kg'
}
