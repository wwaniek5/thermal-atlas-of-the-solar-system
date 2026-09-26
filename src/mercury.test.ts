import { describe, expect, it } from 'vitest'
import { dayAt, facingAngle, orbitLabel, orbitPosition, positionAtAnomaly, SOLAR_DAY_DAYS } from './mercury'
import { CALENDARS } from './months'

describe('Mercury orbit', () => {
  it('has a solar day of two orbits', () => {
    expect(SOLAR_DAY_DAYS).toBeCloseTo(175.94, 1)
  })

  // A spot faces the Sun (noon) when it points opposite to Mercury's position angle.
  const facesSun = (days: number, lon: number) => {
    const d = (facingAngle(days, lon) - orbitPosition(days).trueAnomaly - Math.PI) / (2 * Math.PI)
    return Math.abs(d - Math.round(d)) < 1e-3
  }

  it('has noon at 0° at the first perihelion and at 180° at the next, like the model', () => {
    expect(facesSun(0, 0)).toBe(true)
    expect(facesSun(dayAt(6), 180)).toBe(true)
    expect(facesSun(dayAt(6), 0)).toBe(false) // midnight at 0°: the 3:2 resonance
    expect(facesSun(dayAt(3), -90)).toBe(true) // aphelion noon at 90°W
  })

  it('is closest to the Sun at perihelion and farthest at aphelion', () => {
    expect(orbitPosition(0)).toMatchObject({ trueAnomaly: 0 })
    expect(orbitPosition(0).distance).toBeCloseTo(0.3075, 3)
    expect(orbitPosition(dayAt(3)).distance).toBeCloseTo(0.4667, 3)
    expect(orbitPosition(dayAt(3)).trueAnomaly).toBeCloseTo(Math.PI, 3)
  })
})

describe('positionAtAnomaly', () => {
  it('inverts orbitPosition', () => {
    for (const p of [0.3, 2.2, 4.9, 7.5, 10.1]) {
      const { trueAnomaly } = orbitPosition(dayAt(p))
      expect(positionAtAnomaly(trueAnomaly, p)).toBeCloseTo(p, 6)
    }
  })

  it('picks the pass of the orbit nearest the current position', () => {
    expect(positionAtAnomaly(Math.PI, 2.5)).toBeCloseTo(3, 3) // aphelion, year 1
    expect(positionAtAnomaly(Math.PI, 8.5)).toBeCloseTo(9, 3) // aphelion, year 2
  })

  it('carries on into the next year when dragged past perihelion', () => {
    // Just before the end of year 1, dragged a little past perihelion: year 2 starts (6), not back to 0.
    expect(positionAtAnomaly(0.05, 5.95)).toBeGreaterThan(6)
    expect(positionAtAnomaly(0.05, 5.95)).toBeLessThan(6.1)
  })
})

describe('Mercury slider labels', () => {
  it('names orbit positions', () => {
    expect(orbitLabel(0)).toBe('Year 1 · perihelion')
    expect(orbitLabel(3)).toBe('Year 1 · aphelion')
    expect(orbitLabel(6)).toBe('Year 2 · perihelion')
    expect(orbitLabel(1)).toBe('Year 1 · 15 days after perihelion')
    expect(orbitLabel(0.5)).toBe('Year 1 · 7 days after perihelion') // to the day, not the nearest step
    expect(orbitLabel(11.99)).toBe('Year 1 · perihelion') // about to wrap round
    expect(CALENDARS.mercury.ticks).toHaveLength(13)
  })
})
