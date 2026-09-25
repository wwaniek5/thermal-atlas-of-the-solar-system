import { readFileSync } from 'node:fs'
import { geoArea, geoContains, geoOrthographic, geoPath } from 'd3-geo'
import { describe, expect, it } from 'vitest'
import { gridAt, sampleAt, toGrid, type Manifest, type PyramidManifest } from '../data/grid'
import { regionFor, regionGrid, type TileId } from '../data/tiles'
import { computeIsotherms, splitAtGridEdges } from './isotherms'
import { buildScale, STEP_OPTIONS } from './scale'

const EVERY_5C = buildScale(-75, 40, 'C', 5).thresholdsC

const dataDir = new URL('../../public/data/noaa/', import.meta.url)
const manifest: Manifest = JSON.parse(readFileSync(new URL('manifest.json', dataDir), 'utf8'))
const month = (m: number) =>
  toGrid(manifest, JSON.parse(readFileSync(new URL(manifest.months[m - 1], dataDir), 'utf8')).values)

const SPHERE = 4 * Math.PI

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
      for (const iso of computeIsotherms(grid, EVERY_5C)) {
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
      for (const iso of computeIsotherms(month(m), EVERY_5C)) {
        for (const loop of iso.line.coordinates) {
          expect(loop[0]).toEqual(loop.at(-1))
        }
      }
    }
  })
})

describe('every frame of the animation', () => {
  // Regression: when a grid value equalled an isotherm exactly (e.g. -24.0 °C
  // at a pole with 2° spacing), pieces could not be joined and the page crashed.
  it('joins all pieces for every spacing, on and between months', () => {
    const year = Array.from({ length: 12 }, (_, i) => month(i + 1))
    const broken: string[] = []
    for (const units of ['C', 'F'] as const) {
      for (const step of STEP_OPTIONS[units]) {
        const { thresholdsC } = buildScale(-75, 40, units, step)
        for (let p = 0; p < 12; p += 0.25) {
          computeIsotherms(gridAt(year, p), thresholdsC, (pt) => broken.push(`${units}/${step} at ${p}: ${pt}`))
        }
      }
    }
    expect(broken).toEqual([])
  })
})

describe('rendering on the globe', () => {
  it('projects every month and isotherm without errors', () => {
    const rotations: [number, number][] = [[0, 0], [180, 0], [-10, -25], [0, -90], [0, 90]]
    for (let m = 1; m <= 12; m++) {
      const grid = month(m)
      const isotherms = computeIsotherms(grid, EVERY_5C)
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

describe('regional grids (zoomed in)', () => {
  const eraDir = new URL('../../public/data/era5/', import.meta.url)
  const pyramid: PyramidManifest = JSON.parse(readFileSync(new URL('manifest.json', eraDir), 'utf8'))
  const finest = pyramid.levels.length - 1
  const store = {
    get: ({ level, row, col }: TileId) => {
      const path = pyramid.levels[level].tiles!.replace('{row}', String(row)).replace('{col}', String(col))
      const buf = readFileSync(new URL(path, eraDir))
      return new Int16Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
    },
  }
  // Around the Alps, crossing tile borders at 0° and 30°E and 30°N... and the seam in the Pacific.
  const boxes = {
    alps: { west: -5.3, east: 34.6, south: 38.2, north: 55.9 },
    pacific: { west: 165.1, east: 196.8, south: -25.4, north: 12.3 },
  }

  for (const [name, box] of Object.entries(boxes)) {
    it(`puts points on the correct side of every isotherm (${name})`, () => {
      const region = regionFor(pyramid.levels[finest], box)
      const grid = regionGrid(store, pyramid, finest, region, 0.5)!
      const { thresholdsC } = buildScale(-40, 40, 'C', 2)
      const isos = computeIsotherms(grid, thresholdsC)
      let seed = 3
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
      for (let i = 0; i < 300; i++) {
        const p: [number, number] = [
          region.west + 0.5 + rnd() * (region.east - region.west - 1),
          region.south + 0.5 + rnd() * (region.north - region.south - 1),
        ]
        const t = sampleAt(grid, p[0], p[1])
        for (const [k, iso] of isos.entries()) {
          if (Math.abs(t - thresholdsC[k]) < 0.3) continue // too close to call
          expect(geoContains(iso.area, p), `${thresholdsC[k]} °C at ${p}`).toBe(t >= thresholdsC[k])
        }
      }
    })

    it(`draws no isotherm along the region's edges (${name})`, () => {
      const region = regionFor(pyramid.levels[finest], box)
      const grid = regionGrid(store, pyramid, finest, region, 0.5)!
      for (const iso of computeIsotherms(grid, buildScale(-40, 40, 'C', 2).thresholdsC)) {
        for (const line of iso.line.coordinates) {
          for (let i = 1; i < line.length; i++) {
            const [a, b] = [line[i - 1], line[i]]
            const alongEdge =
              ((a[0] === region.west || a[0] === region.east) && a[0] === b[0]) ||
              ((a[1] === region.north || a[1] === region.south) && a[1] === b[1])
            expect(alongEdge).toBe(false)
          }
        }
      }
    })
  }
})
