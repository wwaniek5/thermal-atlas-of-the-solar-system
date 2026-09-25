/**
 * Readers for the data written by scripts/data/.
 *
 * Format 1 (grid.py): one JSON file per month. Format 2 (pyramid.py): a
 * resolution pyramid of int16 binary files, each holding all 12 months; the
 * whole-globe view uses its untiled levels, the tiled ones are for zooming.
 *
 * Grid conventions: rows north -> south starting at lat0 (90), columns
 * west -> east starting at lon0 (-180) and NOT repeating +180, values in
 * tenths of a degree Celsius, row-major.
 */

/** What the app needs to know about a grid, whatever format it came from. */
export interface GridInfo {
  source: string
  title: string
  period: string
  credit: string
  scale: number
  nlat: number
  nlon: number
  lat0: number
  dlat: number
  lon0: number
  dlon: number
}

/** Format 1 manifest. */
export interface Manifest extends GridInfo {
  units: 'degC'
  months: string[]
}

/** Format 2 manifest. */
export interface PyramidManifest {
  format: 2
  source: string
  title: string
  period: string
  credit: string
  units: 'degC'
  scale: number
  levels: PyramidLevel[]
}

export interface PyramidLevel {
  res: number
  lat0: number
  lon0: number
  nlat: number
  nlon: number
  /** Untiled levels. */
  file?: string
  /** Tiled levels (used for zooming). */
  tileSpan?: number
  tilePoints?: number
  tileRows?: number
  tileCols?: number
  tiles?: string
}

export interface Grid {
  info: GridInfo
  /**
   * True for whole-globe grids: then `width` is nlon + 1, because column 0 is
   * repeated at the end (lon +180) so contours close across the antimeridian.
   * False for regional grids cut from tiles, which cover a lon/lat box.
   */
  wraps: boolean
  width: number
  height: number
  /** Degrees Celsius, row-major, `width` columns. */
  values: Float32Array
}

export interface LoadedSource {
  /** Whole-globe grids, coarsest first; each entry is the twelve months. */
  globe: Grid[][]
  /** Format 2 manifest, for loading zoom tiles; null for format 1. */
  pyramid: PyramidManifest | null
}

/** A source's whole-globe grids, plus what's needed to load its zoom tiles. */
export async function loadSource(source: string): Promise<LoadedSource> {
  const manifest = await fetchJson<Manifest | PyramidManifest>(`${dataUrl(source)}/manifest.json`)
  if ('format' in manifest && manifest.format === 2) {
    const untiled = manifest.levels.flatMap((level, index) => (level.file ? [{ level, index }] : []))
    const globe = await Promise.all(
      untiled.map(async ({ level, index }) => {
        const res = await fetch(`${dataUrl(source)}/${level.file}`)
        if (!res.ok) throw new Error(`${level.file}: ${res.status} ${res.statusText}`)
        return pyramidYear(manifest, index, await res.arrayBuffer())
      }),
    )
    return { globe, pyramid: manifest }
  }
  const v1 = manifest as Manifest
  const year = await Promise.all(
    v1.months.map(async (file) => {
      const { values } = await fetchJson<{ month: number; values: number[] }>(`${dataUrl(source)}/${file}`)
      return toGrid(v1, values)
    }),
  )
  return { globe: [year], pyramid: null }
}

/** Split an untiled format 2 level (int16, [month][row][col]) into 12 grids. */
export function pyramidYear(manifest: PyramidManifest, levelIndex: number, buffer: ArrayBuffer): Grid[] {
  const level = manifest.levels[levelIndex]
  const info: GridInfo = {
    source: manifest.source,
    title: manifest.title,
    period: manifest.period,
    credit: manifest.credit,
    scale: manifest.scale,
    nlat: level.nlat,
    nlon: level.nlon,
    lat0: level.lat0,
    dlat: -level.res,
    lon0: level.lon0,
    dlon: level.res,
  }
  const perMonth = level.nlat * level.nlon
  const ints = new Int16Array(buffer)
  if (ints.length !== 12 * perMonth) {
    throw new Error(`${manifest.source} level ${levelIndex}: expected ${12 * perMonth} values, got ${ints.length}`)
  }
  return Array.from({ length: 12 }, (_, m) => toGrid(info, ints.subarray(m * perMonth, (m + 1) * perMonth)))
}

/**
 * The grid at a point in the year. `position` runs from 0 (January) up to
 * 12, wrapping, so 11.5 is halfway from December to January. Temperatures
 * are blended linearly between the two neighbouring months.
 */
export function gridAt(year: Grid[], position: number): Grid {
  const p = ((position % 12) + 12) % 12
  const i = Math.floor(p)
  const t = p - i
  const a = year[i]
  if (t === 0) return a
  const b = year[(i + 1) % 12]
  const values = new Float32Array(a.values.length)
  for (let k = 0; k < values.length; k++) {
    values[k] = a.values[k] + (b.values[k] - a.values[k]) * t
  }
  return { ...a, values }
}

export function toGrid(info: GridInfo, raw: ArrayLike<number>): Grid {
  const { nlat, nlon, scale } = info
  if (raw.length !== nlat * nlon) {
    throw new Error(`expected ${nlat * nlon} values, got ${raw.length}`)
  }
  const width = nlon + 1
  const values = new Float32Array(width * nlat)
  for (let r = 0; r < nlat; r++) {
    for (let c = 0; c < width; c++) {
      values[r * width + c] = raw[r * nlon + (c % nlon)] * scale
    }
  }
  return { info, wraps: true, width, height: nlat, values }
}

/** Bilinear temperature at a lon/lat, in degrees Celsius. */
export function sampleAt(grid: Grid, lon: number, lat: number): number {
  const { lat0, dlat, lon0, dlon } = grid.info
  const x = clamp((((lon - lon0) % 360) + 360) % 360 / dlon, 0, grid.width - 1)
  const y = clamp((lat - lat0) / dlat, 0, grid.height - 1)
  const x0 = Math.min(Math.floor(x), grid.width - 2)
  const y0 = Math.min(Math.floor(y), grid.height - 2)
  const fx = x - x0
  const fy = y - y0
  const v = (r: number, c: number) => grid.values[r * grid.width + c]
  const top = v(y0, x0) * (1 - fx) + v(y0, x0 + 1) * fx
  const bottom = v(y0 + 1, x0) * (1 - fx) + v(y0 + 1, x0 + 1) * fx
  return top * (1 - fy) + bottom * fy
}

export function dataUrl(source: string): string {
  return `${import.meta.env.BASE_URL}data/${source}`
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}
