/**
 * The Moon's lunar day, matching scripts/data/sources/moon.py: the data's
 * steps are equally spaced through one lunar day (new moon to new moon),
 * starting at new moon, and the Moon keeps its 0° longitude facing Earth.
 */
export const SYNODIC_DAYS = 29.530589

/** Earth days since new moon, for a slider position 0..12. */
export function moonDayAt(position: number): number {
  return ((((position % 12) + 12) % 12) / 12) * SYNODIC_DAYS
}

const PHASES: [number, string][] = [
  [0, 'new moon'],
  [0.25, 'first quarter'],
  [0.5, 'full moon'],
  [0.75, 'last quarter'],
  [1, 'new moon'],
]

/** "Day 7 · first quarter", "Day 10 · waxing gibbous", ... to the nearest day. */
export function phaseLabel(position: number): string {
  const day = moonDayAt(position)
  const f = day / SYNODIC_DAYS
  const exact = PHASES.find(([at]) => Math.abs(f - at) * SYNODIC_DAYS < 0.5)
  const name = exact
    ? exact[1]
    : f < 0.25
      ? 'waxing crescent'
      : f < 0.5
        ? 'waxing gibbous'
        : f < 0.75
          ? 'waning gibbous'
          : 'waning crescent'
  return `Day ${Math.round(day) % Math.round(SYNODIC_DAYS)} · ${name}`
}

/**
 * The Moon's angle around Earth seen from the north (radians, counter-
 * clockwise, 0 = away from the Sun). At new moon it is between Earth and
 * the Sun (π); at full moon, opposite the Sun (0).
 */
export function moonAngle(days: number): number {
  return Math.PI + (2 * Math.PI * days) / SYNODIC_DAYS
}

/** The slider position (0..12) at which the Moon is at `angle` around Earth. */
export function positionAtMoonAngle(angle: number): number {
  const turns = (angle - Math.PI) / (2 * Math.PI)
  return (((turns % 1) + 1) % 1) * 12
}
