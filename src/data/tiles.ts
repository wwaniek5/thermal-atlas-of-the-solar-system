import type { Bounds } from '../map/view'
import { filesUrl, type Grid, type GridInfo, type PyramidLevel, type PyramidManifest } from './grid'

export interface TileId {
  level: number
  row: number
  col: number
}

/** Tiles kept in memory; at 0.25° each is ~350 KB. */
const MAX_TILES = 64

/**
 * Loads and caches zoom tiles. Missing tiles are fetched on request;
 * `onLoad` fires as each arrives so the view can redraw.
 */
export class TileStore {
  private tiles = new Map<string, Int16Array>()
  private pending = new Set<string>()
  private readonly source: string
  private readonly manifest: PyramidManifest
  private readonly onLoad: () => void

  constructor(source: string, manifest: PyramidManifest, onLoad: () => void) {
    this.source = source
    this.manifest = manifest
    this.onLoad = onLoad
  }

  get(id: TileId): Int16Array | undefined {
    const key = tileKey(id)
    const tile = this.tiles.get(key)
    if (tile) {
      // Refresh its place in the least-recently-used order.
      this.tiles.delete(key)
      this.tiles.set(key, tile)
    }
    return tile
  }

  request(ids: TileId[]): void {
    for (const id of ids) {
      const key = tileKey(id)
      if (this.tiles.has(key) || this.pending.has(key)) continue
      this.pending.add(key)
      const level = this.manifest.levels[id.level]
      const path = level.tiles!.replace('{row}', String(id.row)).replace('{col}', String(id.col))
      fetch(`${filesUrl(this.source, this.manifest)}/${path}`)
        .then((res) => {
          if (!res.ok) throw new Error(`${path}: ${res.status} ${res.statusText}`)
          return res.arrayBuffer()
        })
        .then((buffer) => {
          this.tiles.set(key, new Int16Array(buffer))
          while (this.tiles.size > MAX_TILES) this.tiles.delete(this.tiles.keys().next().value!)
          this.onLoad()
        })
        .catch((e: unknown) => console.warn(`tile ${key} failed:`, e))
        .finally(() => this.pending.delete(key))
    }
  }
}

function tileKey({ level, row, col }: TileId): string {
  return `${level}/${row}_${col}`
}

/**
 * The region actually built for `bounds` at a level: snapped outward to the
 * level's grid, and kept one row off the poles (a region reaching a pole
 * would have edges through the pole point, which d3-geo can't fill).
 */
export function regionFor(level: PyramidLevel, bounds: Bounds): Bounds {
  const r = level.res
  return {
    west: Math.floor(bounds.west / r) * r,
    east: Math.ceil(bounds.east / r) * r,
    south: Math.max(-90 + r, Math.floor(bounds.south / r) * r),
    north: Math.min(90 - r, Math.ceil(bounds.north / r) * r),
  }
}

/** Tiles of `levelIndex` covering `region`, wrapping in longitude. */
export function tilesFor(manifest: PyramidManifest, levelIndex: number, region: Bounds): TileId[] {
  const level = manifest.levels[levelIndex]
  const span = level.tileSpan!
  const rows = level.tileRows!
  const cols = level.tileCols!
  const rowOf = (lat: number) => Math.min(rows - 1, Math.max(0, Math.floor((90 - lat) / span)))
  const ids: TileId[] = []
  const seen = new Set<number>()
  for (let row = rowOf(region.north); row <= rowOf(region.south); row++) {
    for (let c = Math.floor((region.west + 180) / span); c <= Math.floor((region.east + 180) / span); c++) {
      const col = ((c % cols) + cols) % cols
      if (seen.has(row * cols + col)) continue
      seen.add(row * cols + col)
      ids.push({ level: levelIndex, row, col })
    }
  }
  return ids
}

/**
 * A regional grid over `region` at a point in the year (see gridAt), cut from
 * the level's tiles. Null while any needed tile is still loading.
 */
export function regionGrid(
  store: Pick<TileStore, 'get'>,
  manifest: PyramidManifest,
  levelIndex: number,
  region: Bounds,
  position: number,
): Grid | null {
  const level = manifest.levels[levelIndex]
  const res = level.res
  const n = level.tilePoints!
  const cols = level.tileCols!
  const rows = level.tileRows!

  const tiles = new Map<number, Int16Array>()
  for (const id of tilesFor(manifest, levelIndex, region)) {
    const tile = store.get(id)
    if (!tile) return null
    tiles.set(id.row * cols + id.col, tile)
  }

  const p = ((position % 12) + 12) % 12
  const m0 = Math.floor(p)
  const m1 = (m0 + 1) % 12
  const t = p - m0
  const perMonth = n * n

  const height = Math.round((region.north - region.south) / res) + 1
  const width = Math.round((region.east - region.west) / res) + 1
  const values = new Float32Array(width * height)
  const pointsPerTile = n - 1
  const lonPoints = Math.round(360 / res)
  const westIndex = Math.round((region.west + 180) / res)
  const northIndex = Math.round((90 - region.north) / res)

  for (let y = 0; y < height; y++) {
    const gy = northIndex + y // global row index from +90
    const tileRow = Math.min(rows - 1, Math.floor(gy / pointsPerTile))
    const ly = gy - tileRow * pointsPerTile
    for (let x = 0; x < width; x++) {
      const gx = (((westIndex + x) % lonPoints) + lonPoints) % lonPoints // global column from -180
      const tileCol = Math.min(cols - 1, Math.floor(gx / pointsPerTile))
      const lx = gx - tileCol * pointsPerTile
      const tile = tiles.get(tileRow * cols + tileCol)!
      const k = ly * n + lx
      const a = tile[m0 * perMonth + k]
      const b = tile[m1 * perMonth + k]
      values[y * width + x] = (a + (b - a) * t) * manifest.scale
    }
  }

  const info: GridInfo = {
    source: manifest.source,
    title: manifest.title,
    period: manifest.period,
    credit: manifest.credit,
    scale: manifest.scale,
    nlat: height,
    nlon: width,
    lat0: region.north,
    dlat: -res,
    lon0: region.west,
    dlon: res,
  }
  return { info, wraps: false, width, height, values }
}
