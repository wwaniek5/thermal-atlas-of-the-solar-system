import { describe, expect, it } from 'vitest'
import { describePosition, nearestMonthName } from '../months'
import { gridAt, toGrid, type Manifest } from './grid'

const manifest: Manifest = {
  source: 'test', title: '', period: '', units: 'degC', scale: 1,
  nlat: 1, nlon: 2, lat0: 90, dlat: -180, lon0: -180, dlon: 180, months: [],
}
// Month m (0-based) is m degrees everywhere.
const year = Array.from({ length: 12 }, (_, m) => toGrid(manifest, [m, m]))

describe('gridAt', () => {
  it('returns the month itself on whole positions', () => {
    expect(gridAt(year, 3)).toBe(year[3])
  })

  it('blends linearly between neighbouring months', () => {
    expect(gridAt(year, 3.25).values[0]).toBeCloseTo(3.25)
  })

  it('wraps from December to January', () => {
    expect(gridAt(year, 11.5).values[0]).toBeCloseTo(5.5) // halfway 11 -> 0
    expect(gridAt(year, 12)).toBe(year[0])
  })
})

describe('month labels', () => {
  it('names the nearest month', () => {
    expect(nearestMonthName(0.4)).toBe('January')
    expect(nearestMonthName(0.6)).toBe('February')
    expect(nearestMonthName(11.7)).toBe('January')
  })

  it('describes in-between positions for screen readers', () => {
    expect(describePosition(2)).toBe('March')
    expect(describePosition(1.995)).toBe('March')
    expect(describePosition(2.5)).toBe('Between March and April')
    expect(describePosition(11.5)).toBe('Between December and January')
  })
})
