import { geoDistance } from 'd3-geo'
import { describe, expect, it } from 'vitest'
import type { PyramidLevel } from '../data/grid'
import { makeProjection, pickLevel, SIZE, visibleBounds } from './view'

describe('visibleBounds', () => {
  it('is null at full-globe zoom, when a pole is in view', () => {
    expect(visibleBounds(makeProjection({ rotation: [-10, -25], zoom: 1 }))).toBeNull()
  })

  it('covers every point on screen when zoomed in', () => {
    const projection = makeProjection({ rotation: [-10, -45], zoom: 6 })
    const b = visibleBounds(projection)!
    expect(b).not.toBeNull()
    for (let x = 0; x <= SIZE; x += 16) {
      for (let y = 0; y <= SIZE; y += 16) {
        const [lon, lat] = projection.invert!([x, y])!
        expect(lon).toBeGreaterThanOrEqual(b.west)
        expect(lon).toBeLessThanOrEqual(b.east)
        expect(lat).toBeGreaterThanOrEqual(b.south)
        expect(lat).toBeLessThanOrEqual(b.north)
      }
    }
    // ~20° of latitude on screen; at 45°N that is ~28° of longitude, plus padding.
    expect(b.east - b.west).toBeLessThan(45)
  })

  it('keeps longitudes continuous across ±180', () => {
    const b = visibleBounds(makeProjection({ rotation: [-178, 10], zoom: 6 }))!
    expect(b.west).toBeLessThan(178)
    expect(b.east).toBeGreaterThan(180)
    expect(geoDistance([(b.west + b.east) / 2, 0], [178, 0])).toBeLessThan(0.05)
  })
})

describe('pickLevel', () => {
  const levels = [
    { res: 2, file: 'L0.bin' },
    { res: 1, file: 'L1.bin' },
    { res: 0.5, tiles: 'L2' },
    { res: 0.25, tiles: 'L3' },
  ] as PyramidLevel[]

  it('picks the finest tiled level within the point budget', () => {
    const box = (deg: number) => ({ west: 0, east: deg, south: 0, north: deg })
    expect(pickLevel(levels, box(10), 60_000)).toBe(3) // 43 x 43 points at 0.25°
    expect(pickLevel(levels, box(80), 60_000)).toBe(2) // 323² at 0.25° is too many; 163² at 0.5° fits
    expect(pickLevel(levels, box(150), 60_000)).toBeNull() // use the whole-globe grid
  })
})
