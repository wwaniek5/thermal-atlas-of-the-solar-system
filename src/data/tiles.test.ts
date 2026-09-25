import { describe, expect, it } from 'vitest'
import type { PyramidManifest } from './grid'
import { regionFor, regionGrid, tilesFor, type TileId } from './tiles'

// A 1° level in 10° tiles (11 points per side, edges shared).
const manifest: PyramidManifest = {
  format: 2, dataDir: 'v1', source: 't', title: '', period: '', credit: '', units: 'degC', scale: 0.1,
  levels: [{ res: 1, lat0: 90, lon0: -180, nlat: 181, nlon: 360, tileSpan: 10, tilePoints: 11, tileRows: 18, tileCols: 36, tiles: 'L0/{row}_{col}.bin' }],
}

/** Value (tenths) stored at global row gy (from +90), column gx (from -180), month m. */
const f = (m: number, gy: number, gx: number) => ((gy * 7 + gx * 13) % 3000) + m * 100

function makeTile({ row, col }: TileId): Int16Array {
  const t = new Int16Array(12 * 11 * 11)
  for (let m = 0; m < 12; m++) {
    for (let y = 0; y < 11; y++) {
      for (let x = 0; x < 11; x++) t[m * 121 + y * 11 + x] = f(m, row * 10 + y, (col * 10 + x) % 360)
    }
  }
  return t
}
const store = { get: makeTile }

describe('tilesFor', () => {
  it('lists the tiles under a box, wrapping across ±180', () => {
    const ids = tilesFor(manifest, 0, { west: 165, east: 195, south: 5, north: 15 })
    expect(ids.map((i) => `${i.row}_${i.col}`).sort()).toEqual(['7_0', '7_1', '7_34', '7_35', '8_0', '8_1', '8_34', '8_35'].sort()) // 195° = -165°, in column 1
  })
})

describe('regionFor', () => {
  it('snaps outward to the grid and stays off the poles', () => {
    expect(regionFor(manifest.levels[0], { west: 10.2, east: 20.7, south: -89.9, north: 89.95 })).toEqual({
      west: 10, east: 21, south: -89, north: 89,
    })
  })
})

describe('regionGrid', () => {
  it('assembles values across tile borders and the ±180 seam', () => {
    const region = { west: 165, east: 195, south: 3, north: 17 }
    const grid = regionGrid(store, manifest, 0, region, 4)!
    expect(grid.wraps).toBe(false)
    expect([grid.width, grid.height]).toEqual([31, 15])
    expect(grid.info).toMatchObject({ lat0: 17, dlat: -1, lon0: 165, dlon: 1 })
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const gy = 90 - 17 + y
        const gx = (165 + 180 + x) % 360
        expect(grid.values[y * grid.width + x]).toBeCloseTo(f(4, gy, gx) * 0.1)
      }
    }
  })

  it('blends between months, wrapping December to January', () => {
    const region = { west: 0, east: 2, south: 0, north: 2 }
    const grid = regionGrid(store, manifest, 0, region, 11.5)!
    expect(grid.values[0]).toBeCloseTo(((f(11, 88, 180) + f(0, 88, 180)) / 2) * 0.1)
  })

  it('returns null while a tile is missing', () => {
    expect(regionGrid({ get: () => undefined }, manifest, 0, { west: 0, east: 2, south: 0, north: 2 }, 0)).toBeNull()
  })
})
