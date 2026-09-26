/**
 * Mercury's orbit and spin, matching scripts/data/sources/mercury.py: the
 * data's 12 steps are equally spaced through one solar day, starting at
 * perihelion with the Sun overhead at 0° longitude.
 */
export const ECCENTRICITY = 0.20563
const ORBIT_DAYS = 87.9691
const ROTATION_DAYS = 58.6462
export const SOLAR_DAY_DAYS = 1 / (1 / ROTATION_DAYS - 1 / ORBIT_DAYS) // 175.94, two orbits

/** Earth days since the start of the solar day, for a slider position 0..12. */
export function dayAt(position: number): number {
  return ((((position % 12) + 12) % 12) / 12) * SOLAR_DAY_DAYS
}

export const SEMI_MAJOR_AU = 0.387098

/** Where Mercury is `days` after perihelion: angle from perihelion (radians) and distance from the Sun (AU). */
export function orbitPosition(days: number): { trueAnomaly: number; distance: number } {
  const mean = (2 * Math.PI * days) / ORBIT_DAYS
  const e = ECCENTRICITY
  let ecc = mean
  for (let i = 0; i < 30; i++) ecc -= (ecc - e * Math.sin(ecc) - mean) / (1 - e * Math.cos(ecc))
  return {
    trueAnomaly: 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(ecc / 2), Math.sqrt(1 - e) * Math.cos(ecc / 2)),
    distance: SEMI_MAJOR_AU * (1 - e * Math.cos(ecc)),
  }
}

/**
 * The slider position (0..12) at which Mercury is at `trueAnomaly` on its
 * orbit. Each point of the orbit is passed twice per solar day (two orbits);
 * the pass nearest `current` is chosen, so dragging round the orbit carries
 * on into the next year instead of jumping back.
 */
export function positionAtAnomaly(trueAnomaly: number, current: number): number {
  const e = ECCENTRICITY
  const ecc = 2 * Math.atan(Math.sqrt((1 - e) / (1 + e)) * Math.tan(trueAnomaly / 2))
  const mean = ecc - e * Math.sin(ecc)
  const inOrbit = ((((mean / (2 * Math.PI)) % 1) + 1) % 1) * ORBIT_DAYS
  const now = dayAt(current)
  const circular = (d: number) => {
    const x = Math.abs(d - now) % SOLAR_DAY_DAYS
    return Math.min(x, SOLAR_DAY_DAYS - x)
  }
  const day = [inOrbit, inOrbit + ORBIT_DAYS].reduce((best, d) => (circular(d) < circular(best) ? d : best))
  return (day / SOLAR_DAY_DAYS) * 12
}

/**
 * Direction (radians, counter-clockwise seen from the north, 0 = towards
 * perihelion) that a point on the equator at `lonDeg` east faces, `days`
 * after perihelion. It faces the Sun when this is the true anomaly + π.
 */
export function facingAngle(days: number, lonDeg: number): number {
  return (2 * Math.PI * days) / ROTATION_DAYS + (lonDeg * Math.PI) / 180 + Math.PI
}

/** "Year 1 · aphelion", "Year 2 · 37 days after perihelion", ... to the nearest day. */
export function orbitLabel(position: number): string {
  const day = dayAt(position)
  let year = day < ORBIT_DAYS ? 1 : 2
  let since = day - (year - 1) * ORBIT_DAYS
  if (since > ORBIT_DAYS - 0.5) {
    // Rounds to the next perihelion, which starts the other year.
    year = year === 1 ? 2 : 1
    since = 0
  }
  if (since < 0.5) return `Year ${year} · perihelion`
  if (Math.abs(since - ORBIT_DAYS / 2) < 0.5) return `Year ${year} · aphelion`
  return `Year ${year} · ${Math.round(since)} days after perihelion`
}
