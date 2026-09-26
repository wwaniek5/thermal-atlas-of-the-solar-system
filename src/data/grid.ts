/**
 * Readers for the data written by scripts/data/.
 *
 * Format 1 (grid.py): one JSON file per month. Format 2 (pyramid.py): a
 * resolution pyramid of int16 binary files, each holding every step (12 months unless `steps` says otherwise); the
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
  /** Folder (next to the manifest) holding the data files; see scripts/data/publish.py. */
  dataDir: string
  months: string[]
  /** Optional surface elevation in metres on the same grid. */
  terrain?: string
}

/** Format 2 manifest. */
export interface PyramidManifest {
  format: 2
  /** Steps through the cycle in every file; 12 (months) if absent. */
  steps?: number
  /** Folder (next to the manifest) holding the data files; see scripts/data/publish.py. */
  dataDir: string
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
  /** Surface elevation in metres (as `values`), if the source has it. */
  terrain: Grid | null
}

/** A source's whole-globe grids, plus what's needed to load its zoom tiles. */
export async function loadSource(source: string): Promise<LoadedSource> {
  // Always revalidate: the manifest names the current data folder, and a stale
  // copy in the browser's cache would point at data that no longer exists.
  const manifest = await fetchJson<Manifest | PyramidManifest>(`${dataUrl(source)}/manifest.json`, { cache: 'no-cache' })
  if ('format' in manifest && manifest.format === 2) {
    const untiled = manifest.levels.flatMap((level, index) => (level.file ? [{ level, index }] : []))
    const globe = await Promise.all(
      untiled.map(async ({ level, index }) => {
        const res = await fetch(`${filesUrl(source, manifest)}/${level.file}`)
        if (!res.ok) throw new Error(`${level.file}: ${res.status} ${res.statusText}`)
        return pyramidYear(manifest, index, await res.arrayBuffer())
      }),
    )
    return { globe, pyramid: manifest, terrain: null }
  }
  const v1 = manifest as Manifest
  const year = await Promise.all(
    v1.months.map(async (file) => {
      const { values } = await fetchJson<{ month: number; values: number[] }>(`${filesUrl(source, v1)}/${file}`)
      return toGrid(v1, values)
    }),
  )
  let terrain: Grid | null = null
  if (v1.terrain) {
    const { values } = await fetchJson<{ values: number[] }>(`${filesUrl(source, v1)}/${v1.terrain}`)
    terrain = toGrid({ ...v1, scale: 1 }, values)
  }
  return { globe: [year], pyramid: null, terrain }
}

/** Split an untiled format 2 level (int16, [step][row][col]) into one grid per step. */
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
  const steps = manifest.steps ?? 12
  if (ints.length !== steps * perMonth) {
    throw new Error(`${manifest.source} level ${levelIndex}: expected ${steps * perMonth} values, got ${ints.length}`)
  }
  return Array.from({ length: steps }, (_, m) => toGrid(info, ints.subarray(m * perMonth, (m + 1) * perMonth)))
}

/**
 * The grid at a point in the cycle. `position` runs from 0 up to 12,
 * wrapping (for Earth: 0 = January, 11.5 = halfway from December to
 * January), whatever the number of steps in `year`: 12 months, or more for
 * bodies that change fast (Mercury has 72). Temperatures are blended
 * linearly between the two neighbouring steps.
 */
export function gridAt(year: Grid[], position: number, cyclic = true): Grid {
  const n = year.length
  // Cyclic: 0..12 covers all n steps and 12 is the first again. Otherwise
  // 0 is the first step and 12 the last.
  const p = cyclic ? ((((position % 12) + 12) % 12) / 12) * n : (Math.min(12, Math.max(0, position)) / 12) * (n - 1)
  const i = Math.floor(p) % n
  const t = p - Math.floor(p)
  const a = year[i]
  if (t === 0) return a
  const b = year[(i + 1) % n]
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

/** Where a source's data files live: its current versioned folder. */
export function filesUrl(source: string, manifest: { dataDir: string }): string {
  return `${dataUrl(source)}/${manifest.dataDir}`
}

function dataUrl(source: string): string {
  return `${import.meta.env.BASE_URL}data/${source}`
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}
