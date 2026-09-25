export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** The month nearest to a slider position (0 = January, 12 wraps to January). */
export function nearestMonthName(position: number): string {
  return MONTH_NAMES[Math.round(((position % 12) + 12) % 12) % 12]
}

/** "January", or "Between January and February" when not on a month. */
export function describePosition(position: number): string {
  const p = ((position % 12) + 12) % 12
  if (Math.abs(p - Math.round(p)) < 0.01) return nearestMonthName(p)
  const i = Math.floor(p)
  return `Between ${MONTH_NAMES[i]} and ${MONTH_NAMES[(i + 1) % 12]}`
}
