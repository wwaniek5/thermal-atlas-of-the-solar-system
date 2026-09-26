/**
 * Saturn's timeline, matching scripts/data/sources/saturn.py: the data's
 * steps run from 1 January 2007 to 1 January 2017, spread over the slider's
 * 0..12 without wrapping round.
 */
export const FIRST_YEAR = 2007
export const LAST_YEAR = 2017

/** Northern spring equinox, 11 August 2009, as a year with fraction. */
const EQUINOX = 2009 + (31 + 28 + 31 + 30 + 31 + 30 + 31 + 10) / 365

/** The date at a slider position 0..12, as a year with fraction. */
export function saturnYear(position: number): number {
  const p = Math.min(12, Math.max(0, position))
  return FIRST_YEAR + (p / 12) * (LAST_YEAR - FIRST_YEAR)
}

/** "March 2011 · Northern spring", to the nearest month. */
export function saturnLabel(position: number): string {
  const year = saturnYear(position)
  const months = Math.round((year - FIRST_YEAR) * 12)
  const month = new Date(Date.UTC(2000, months % 12)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })
  const date = `${month} ${FIRST_YEAR + Math.floor(months / 12)}`
  const season = Math.abs(year - EQUINOX) < 1 / 24 ? 'Equinox' : year < EQUINOX ? 'Northern winter' : 'Northern spring'
  return `${date} · ${season}`
}
