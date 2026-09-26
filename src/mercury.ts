/**
 * Mercury's orbit and spin, matching scripts/data/sources/mercury.py: the
 * data's 12 steps are equally spaced through one solar day, starting at
 * perihelion with the Sun overhead at 0° longitude.
 */
const ECCENTRICITY = 0.20563
const ORBIT_DAYS = 87.9691
const ROTATION_DAYS = 58.6462
export const SOLAR_DAY_DAYS = 1 / (1 / ROTATION_DAYS - 1 / ORBIT_DAYS) // 175.94, two orbits

/** Earth days since the start of the solar day, for a slider position 0..12. */
export function dayAt(position: number): number {
  return ((((position % 12) + 12) % 12) / 12) * SOLAR_DAY_DAYS
}

/** East longitude (-180..180) where the Sun is overhead, `days` after perihelion. */
export function subsolarLongitude(days: number): number {
  const mean = (2 * Math.PI * days) / ORBIT_DAYS
  const e = ECCENTRICITY
  let ecc = mean
  for (let i = 0; i < 30; i++) ecc -= (ecc - e * Math.sin(ecc) - mean) / (1 - e * Math.cos(ecc))
  const trueAnomaly = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(ecc / 2), Math.sqrt(1 - e) * Math.cos(ecc / 2))
  const deg = ((trueAnomaly - (2 * Math.PI * days) / ROTATION_DAYS) * 180) / Math.PI
  return ((((deg + 180) % 360) + 360) % 360) - 180
}

export function formatLongitude(lon: number): string {
  const r = Math.round(lon)
  if (r === 0 || Math.abs(r) === 180) return `${Math.abs(r)}°`
  return `${Math.abs(r)}°${r > 0 ? 'E' : 'W'}`
}

/** "Year 1 · aphelion", "Year 2 · 15 days after perihelion", ... */
export function orbitLabel(position: number): string {
  const day = dayAt(Math.round(position))
  const year = day < ORBIT_DAYS - 0.01 ? 1 : 2
  const since = day - (year - 1) * ORBIT_DAYS
  if (since < 0.5) return `Year ${year} · perihelion`
  if (Math.abs(since - ORBIT_DAYS / 2) < 0.5) return `Year ${year} · aphelion`
  return `Year ${year} · ${Math.round(since)} days after perihelion`
}
