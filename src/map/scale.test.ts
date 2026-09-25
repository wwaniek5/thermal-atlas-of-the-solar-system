import { describe, expect, it } from 'vitest'
import { buildScale, formatTemperature, fromCelsius, toCelsius } from './scale'

describe('unit conversion', () => {
  it('converts both ways', () => {
    expect(fromCelsius(0, 'F')).toBe(32)
    expect(fromCelsius(100, 'F')).toBe(212)
    expect(toCelsius(-40, 'F')).toBe(-40)
    expect(toCelsius(fromCelsius(21.3, 'F'), 'F')).toBeCloseTo(21.3)
    expect(formatTemperature(20, 'F')).toBe('68.0 °F')
  })
})

describe('buildScale', () => {
  it('puts °C isotherms on multiples of the step', () => {
    const s = buildScale(-12, 11, 'C', 5)
    expect(s.thresholds).toEqual([-10, -5, 0, 5, 10])
    expect(s.thresholdsC).toEqual(s.thresholds)
  })

  it('puts °F isotherms on round °F values and adds 32 °F', () => {
    const s = buildScale(-10, 10, 'F', 10) // 14 .. 50 °F
    expect(s.thresholds).toEqual([20, 30, 32, 40, 50])
    expect(s.thresholdsC[2]).toBeCloseTo(0)
  })

  it('has one band per isotherm plus one below', () => {
    const s = buildScale(-10, 10, 'F', 10)
    expect(s.bands).toEqual([
      { lower: 10, upper: 20 },
      { lower: 20, upper: 30 },
      { lower: 30, upper: 32 },
      { lower: 32, upper: 40 },
      { lower: 40, upper: 50 },
      { lower: 50, upper: 60 },
    ])
  })

  it('leaves out freezing when the range does not reach it', () => {
    expect(buildScale(5, 30, 'F', 20).thresholds).toEqual([60, 80])
  })
})
