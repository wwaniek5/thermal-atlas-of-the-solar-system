/**
 * Reader for the grid format written by scripts/data/grid.py.
 *
 * Grid conventions: rows north -> south starting at lat0 (90), columns
 * west -> east starting at lon0 (-180) and NOT repeating +180, values in
 * tenths of a degree Celsius, row-major.
 */

export interface Manifest {
  source: string
  title: string
  period: string
  units: 'degC'
  scale: number
  nlat: number
  nlon: number
  lat0: number
  dlat: number
  lon0: number
  dlon: number
  months: string[]
}

export interface Grid {
  manifest: Manifest
  /** Width of `values`: nlon + 1, because column 0 is repeated at the end
   * (lon +180) so contours close across the antimeridian. */
  width: number
  height: number
  /** Degrees Celsius, row-major, `width` columns. */
  values: Float32Array
}

export async function loadManifest(source: string): Promise<Manifest> {
  return fetchJson<Manifest>(`${dataUrl(source)}/manifest.json`)
}

export async function loadMonth(manifest: Manifest, month: number): Promise<Grid> {
  const file = manifest.months[month - 1]
  const { values } = await fetchJson<{ month: number; values: number[] }>(`${dataUrl(manifest.source)}/${file}`)
  return toGrid(manifest, values)
}

export function toGrid(manifest: Manifest, raw: ArrayLike<number>): Grid {
  const { nlat, nlon, scale } = manifest
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
  return { manifest, width, height: nlat, values }
}

/** Bilinear temperature at a lon/lat, in degrees Celsius. */
export function sampleAt(grid: Grid, lon: number, lat: number): number {
  const { lat0, dlat, lon0, dlon } = grid.manifest
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

function dataUrl(source: string): string {
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
