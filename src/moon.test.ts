import { describe, expect, it } from 'vitest'
import { moonAngle, moonDayAt, phaseLabel, positionAtMoonAngle, SYNODIC_DAYS } from './moon'

describe('Moon phases', () => {
  it('labels the main phases and the days between', () => {
    expect(phaseLabel(0)).toBe('Day 0 · new moon')
    expect(phaseLabel(3)).toBe('Day 7 · first quarter')
    expect(phaseLabel(6)).toBe('Day 15 · full moon')
    expect(phaseLabel(9)).toBe('Day 22 · last quarter')
    expect(phaseLabel(1.5)).toBe('Day 4 · waxing crescent')
    expect(phaseLabel(7.5)).toBe('Day 18 · waning gibbous')
    expect(phaseLabel(11.9)).toBe('Day 29 · new moon') // hours before the next new moon
  })
})

describe('Moon orbit', () => {
  it('is between Earth and the Sun at new moon and opposite at full moon', () => {
    expect(moonAngle(0)).toBeCloseTo(Math.PI)
    expect(Math.cos(moonAngle(SYNODIC_DAYS / 2))).toBeCloseTo(1) // full moon: away from the Sun
  })

  it('turns an angle back into the slider position', () => {
    for (const p of [0.4, 3, 6.7, 11.2]) {
      expect(positionAtMoonAngle(moonAngle(moonDayAt(p)))).toBeCloseTo(p, 6)
    }
  })
})
