import { describe, expect, it } from 'vitest'
import { describePosition, nearestMonthName } from '../months'
import { gridAt, pyramidYear, toGrid, type GridInfo, type PyramidManifest } from './grid'

const manifest: GridInfo = {
  source: 'test', title: '', period: '', credit: '', scale: 1,
  nlat: 1, nlon: 2, lat0: 90, dlat: -180, lon0: -180, dlon: 180,
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

describe('gridAt with more than 12 steps', () => {
  // 24 steps: step k is k degrees everywhere.
  const fine = Array.from({ length: 24 }, (_, k) => toGrid(manifest, [k, k]))

  it('spreads the steps over the same 0..12 positions', () => {
    expect(gridAt(fine, 0)).toBe(fine[0])
    expect(gridAt(fine, 6)).toBe(fine[12])
    expect(gridAt(fine, 0.25).values[0]).toBeCloseTo(0.5)
  })

  it('wraps from the last step to the first', () => {
    expect(gridAt(fine, 11.75).values[0]).toBeCloseTo(11.5) // halfway 23 -> 0
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

describe('pyramidYear', () => {
  const pyramid: PyramidManifest = {
    format: 2, dataDir: 'v1', source: 'era5', title: 'T', period: 'P', credit: 'C', units: 'degC', scale: 0.1,
    levels: [{ res: 90, lat0: 90, lon0: -180, nlat: 3, nlon: 4, file: 'L0.bin' }],
  }

  it('splits level 0 into 12 month grids with the right geometry', () => {
    // Month m holds m * 10 + index (in tenths of a degree).
    const ints = Int16Array.from({ length: 12 * 12 }, (_, i) => Math.floor(i / 12) * 10 + (i % 12))
    const year = pyramidYear(pyramid, 0, ints.buffer)
    expect(year).toHaveLength(12)
    expect(year[3].info).toMatchObject({ nlat: 3, nlon: 4, lat0: 90, dlat: -90, lon0: -180, dlon: 90, credit: 'C' })
    expect(year[3].width).toBe(5) // wrapped column added
    expect(year[3].values[0]).toBeCloseTo(3) // 30 tenths
    expect(year[3].values[4]).toBeCloseTo(3) // wrap repeats column 0
    expect(year[3].values[6]).toBeCloseTo(3.5) // row 1, col 1 -> index 5 in the file
  })

  it('rejects a file of the wrong size', () => {
    expect(() => pyramidYear(pyramid, 0, new Int16Array(10).buffer)).toThrow(/level 0: expected 144/)
  })
})
