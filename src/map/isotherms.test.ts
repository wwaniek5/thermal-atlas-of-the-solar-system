import { readFileSync } from 'node:fs'
import { geoArea, geoContains, geoOrthographic, geoPath } from 'd3-geo'
import { describe, expect, it } from 'vitest'
import { sampleAt, toGrid, type Manifest } from '../data/grid'
import { computeIsotherms, splitAtGridEdges, thresholdsFor } from './isotherms'

const dataDir = new URL('../../public/data/noaa/', import.meta.url)
const manifest: Manifest = JSON.parse(readFileSync(new URL('manifest.json', dataDir), 'utf8'))
const month = (m: number) =>
  toGrid(manifest, JSON.parse(readFileSync(new URL(manifest.months[m - 1], dataDir), 'utf8')).values)

const SPHERE = 4 * Math.PI

describe('thresholdsFor', () => {
  it('lists multiples of the step inside the range', () => {
    expect(thresholdsFor(-12, 11, 5)).toEqual([-10, -5, 0, 5, 10])
    expect(thresholdsFor(-12, 11, 2.5)).toEqual([-10, -7.5, -5, -2.5, 0, 2.5, 5, 7.5, 10])
  })
})

describe('computeIsotherms on NOAA data', () => {
  const july = month(7)
  const [freezing, hot] = computeIsotherms(july, [0, 30])

  it('winds areas so d3-geo sees the small side as inside', () => {
    // In July, >= 30 °C covers a small part of the Earth; >= 0 °C most of it.
    expect(geoArea(hot.area) / SPHERE).toBeLessThan(0.1)
    expect(geoArea(freezing.area) / SPHERE).toBeGreaterThan(0.7)
  })

  it('puts places on the correct side of an isotherm', () => {
    expect(geoContains(hot.area, [5.5, 22.8])).toBe(true) // Sahara
    expect(geoContains(hot.area, [37.6, 55.8])).toBe(false) // Moscow
    expect(geoContains(freezing.area, [0, -85])).toBe(false) // Antarctica
  })

  it('has no gap at the antimeridian', () => {
    // Fiji-ish latitude, both sides of the seam, warm in July.
    expect(geoContains(freezing.area, [179.9, -18])).toBe(true)
    expect(geoContains(freezing.area, [-179.9, -18])).toBe(true)
  })

  it('draws no isotherm along the seam or the poles', () => {
    for (const line of [freezing.line, hot.line]) {
      for (const coords of line.coordinates) {
        for (let i = 1; i < coords.length; i++) {
          const [a, b] = [coords[i - 1], coords[i]]
          expect(Math.abs(a[0]) === 180 && a[0] === b[0]).toBe(false)
          expect(Math.abs(a[1]) === 90 && a[1] === b[1]).toBe(false)
        }
      }
    }
  })
})

describe('poles and seam', () => {
  // Regression: shapes used to run along the grid's pole rows and seam, and
  // d3-geo filled the wrong side whenever a pole was in view.
  it('puts the poles and seam points on the correct side of every isotherm', () => {
    const points: [number, number][] = [[0, 90], [0, -90], [180, 0], [-180, 45], [180, -60]]
    for (const m of [1, 4, 7, 10]) {
      const grid = month(m)
      for (const iso of computeIsotherms(grid, thresholdsFor(-75, 40, 5))) {
        for (const p of points) {
          const t = sampleAt(grid, p[0], p[1])
          if (Math.abs(t - iso.threshold) < 0.5) continue // too close to call
          expect(geoContains(iso.area, p), `month ${m}, ${iso.threshold} °C at ${p}`).toBe(t >= iso.threshold)
        }
      }
    }
  })

  it('closes every isotherm into a loop', () => {
    for (let m = 1; m <= 12; m++) {
      for (const iso of computeIsotherms(month(m), thresholdsFor(-75, 40, 5))) {
        for (const loop of iso.line.coordinates) {
          expect(loop[0]).toEqual(loop.at(-1))
        }
      }
    }
  })
})

describe('rendering on the globe', () => {
  it('projects every month and isotherm without errors', () => {
    const rotations: [number, number][] = [[0, 0], [180, 0], [-10, -25], [0, -90], [0, 90]]
    for (let m = 1; m <= 12; m++) {
      const grid = month(m)
      const isotherms = computeIsotherms(grid, thresholdsFor(-75, 40, 5))
      for (const rotation of rotations) {
        const path = geoPath(geoOrthographic().rotate(rotation))
        for (const iso of isotherms) {
          expect(() => path(iso.area)).not.toThrow()
          expect(() => path(iso.line)).not.toThrow()
        }
      }
    }
  })
})

describe('splitAtGridEdges', () => {
  it('drops segments along the seam', () => {
    const ring = [[170, 0], [180, 0], [180, 10], [170, 10], [170, 0]]
    expect(splitAtGridEdges(ring)).toEqual([[[180, 10], [170, 10], [170, 0], [180, 0]]])
  })

  it('keeps a ring that never touches an edge whole', () => {
    const ring = [[0, 0], [10, 0], [10, 10], [0, 0]]
    expect(splitAtGridEdges(ring)).toEqual([ring])
  })
})

describe('sampleAt', () => {
  it('matches the known NOAA values', () => {
    const jan = month(1)
    expect(sampleAt(jan, 37.6, 55.8)).toBeCloseTo(-9.6, 0) // Moscow
    expect(sampleAt(jan, 179.99, 0)).toBeCloseTo(sampleAt(jan, -179.99, 0), 1) // seam is continuous
  })
})
