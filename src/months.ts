import { dayAt, formatLongitude, orbitLabel, SOLAR_DAY_DAYS, subsolarLongitude } from './mercury'

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

/** How a body's year is split into the slider's 12 steps. */
export interface Calendar {
  /** Name in the "Slider shows" switch, for bodies with more than one calendar. */
  label: string
  /** Heading for a slider position, e.g. "January". */
  title: (position: number) => string
  /** Tick labels under the slider: 12 steps plus the wrap-around back to the start. */
  ticks: string[]
  /** For screen readers, e.g. "Between January and February". */
  describe: (position: number) => string
}

const EARTH: Calendar = {
  label: 'Months',
  title: nearestMonthName,
  ticks: [...MONTH_NAMES, MONTH_NAMES[0]].map((name) => name.slice(0, 3)),
  describe: describePosition,
}

/** Northern-hemisphere season of a Mars month (0-based; 30° of Ls each). */
const MARS_SEASONS = ['Northern spring', 'Northern summer', 'Northern autumn', 'Northern winter']

function marsMonth(position: number): number {
  return Math.round(((position % 12) + 12) % 12) % 12
}

/** Mars months are 30° of solar longitude (Ls), Month 1 starting at the northern spring equinox. */
const MARS: Calendar = {
  label: 'Mars months',
  title: (position) => {
    const m = marsMonth(position)
    return `Month ${m + 1} · ${MARS_SEASONS[Math.floor(m / 3)]}`
  },
  ticks: [...Array.from({ length: 12 }, (_, i) => String(i + 1)), '1'],
  describe: (position) => {
    const p = ((position % 12) + 12) % 12
    if (Math.abs(p - Math.round(p)) < 0.01) return `Mars month ${marsMonth(p) + 1}`
    const i = Math.floor(p)
    return `Between Mars months ${i + 1} and ${((i + 1) % 12) + 1}`
  },
}

/** Mercury, one solar day (176 Earth days) in 12 steps, labelled by day and where it's noon. */
const MERCURY_DAY: Calendar = {
  label: 'Solar day',
  title: (position) => {
    const day = dayAt(Math.round(position))
    return `Day ${Math.round(day)} · noon at ${formatLongitude(subsolarLongitude(day))}`
  },
  ticks: Array.from({ length: 13 }, (_, i) => String(Math.round((i / 12) * SOLAR_DAY_DAYS))),
  describe: (position) => `Day ${Math.round(dayAt(position))} of ${Math.round(SOLAR_DAY_DAYS)}`,
}

/** The same solar day seen as Mercury's two orbits (3:2 spin–orbit resonance). */
const MERCURY_ORBIT: Calendar = {
  label: 'Orbit',
  title: orbitLabel,
  ticks: ['Perihelion', '', '', 'Aphelion', '', '', 'Perihelion', '', '', 'Aphelion', '', '', 'Perihelion'],
  describe: (position) => orbitLabel(position),
}

export const CALENDARS = {
  earth: EARTH,
  mars: MARS,
  'mercury-day': MERCURY_DAY,
  'mercury-orbit': MERCURY_ORBIT,
} satisfies Record<string, Calendar>
export type CalendarId = keyof typeof CALENDARS
