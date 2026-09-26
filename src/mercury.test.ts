import { describe, expect, it } from 'vitest'
import { dayAt, formatLongitude, orbitLabel, SOLAR_DAY_DAYS, subsolarLongitude } from './mercury'
import { CALENDARS } from './months'

describe('Mercury orbit', () => {
  it('has a solar day of two orbits', () => {
    expect(SOLAR_DAY_DAYS).toBeCloseTo(175.94, 1)
  })

  it('puts the Sun over the hot poles at perihelion and the warm poles at aphelion', () => {
    expect(subsolarLongitude(0)).toBeCloseTo(0, 5)
    expect(subsolarLongitude(dayAt(3))).toBeCloseTo(-90, 0) // aphelion
    expect(Math.abs(subsolarLongitude(dayAt(6)))).toBeCloseTo(180, 0) // next perihelion
    expect(subsolarLongitude(dayAt(9))).toBeCloseTo(90, 0)
  })

  it('makes the Sun briefly move backwards around perihelion', () => {
    expect(subsolarLongitude(2)).toBeGreaterThan(subsolarLongitude(0))
  })
})

describe('Mercury slider labels', () => {
  it('names days and where it is noon', () => {
    expect(CALENDARS['mercury-day'].title(0)).toBe('Day 0 · noon at 0°')
    expect(CALENDARS['mercury-day'].title(3)).toBe('Day 44 · noon at 90°W')
    expect(CALENDARS['mercury-day'].ticks).toHaveLength(13)
  })

  it('names orbit positions', () => {
    expect(orbitLabel(0)).toBe('Year 1 · perihelion')
    expect(orbitLabel(3)).toBe('Year 1 · aphelion')
    expect(orbitLabel(6)).toBe('Year 2 · perihelion')
    expect(orbitLabel(1)).toBe('Year 1 · 15 days after perihelion')
  })

  it('formats longitudes', () => {
    expect(formatLongitude(-90)).toBe('90°W')
    expect(formatLongitude(180)).toBe('180°')
    expect(formatLongitude(45.4)).toBe('45°E')
  })
})
