import { geoDistance, geoOrthographic, type GeoProjection } from 'd3-geo'
import type { PyramidLevel } from '../data/grid'

/** What part of the globe is on screen. */
export interface View {
  /** d3 rotation [lambda, phi]: the view is centered on [-lambda, -phi]. */
  rotation: [number, number]
  /** 1 = whole globe fits the frame. */
  zoom: number
}

export const MIN_ZOOM = 1
export const MAX_ZOOM = 16

/** Side of the square SVG viewBox, and the gap around the unzoomed globe. */
export const SIZE = 640
const PADDING = 8

export function clampZoom(zoom: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))
}

export function makeProjection({ rotation, zoom }: View): GeoProjection {
  const projection = geoOrthographic().fitExtent(
    [[PADDING, PADDING], [SIZE - PADDING, SIZE - PADDING]],
    { type: 'Sphere' },
  )
  return projection
    .scale(projection.scale() * zoom)
    .rotate(rotation)
    // Zoomed in, most of the sphere is off screen; don't build paths for it.
    .clipExtent([[0, 0], [SIZE, SIZE]])
}

/** A lon/lat box. `west` < `east`; they may pass ±180 when the box spans the seam. */
export interface Bounds {
  west: number
  east: number
  south: number
  north: number
}

/**
 * The lon/lat box covering what's on screen, or null when a pole is visible
 * (the box would then span every longitude; the whole-globe grid is used).
 */
export function visibleBounds(projection: GeoProjection): Bounds | null {
  const [lambda, phi] = projection.rotate()
  const center: [number, number] = [-lambda, -phi]
  const onScreen = (p: [number, number]) => {
    if (geoDistance(p, center) >= Math.PI / 2) return false
    const [x, y] = projection(p)!
    return x >= 0 && x <= SIZE && y >= 0 && y <= SIZE
  }
  if (onScreen([0, 90]) || onScreen([0, -90])) return null

  // Sample the screen plus the globe's rim, and keep what lands on the globe.
  const samples: [number, number][] = []
  const n = 24
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) samples.push([(i / n) * SIZE, (j / n) * SIZE])
  }
  const [tx, ty] = projection.translate()
  const r = projection.scale() * 0.999
  for (let k = 0; k < 90; k++) {
    const a = (k / 90) * 2 * Math.PI
    samples.push([tx + r * Math.cos(a), ty + r * Math.sin(a)])
  }

  let west = Infinity
  let east = -Infinity
  let south = Infinity
  let north = -Infinity
  for (const [x, y] of samples) {
    if (x < 0 || x > SIZE || y < 0 || y > SIZE) continue
    const p = projection.invert!([x, y])
    if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue
    // Measure longitudes from the center so a box across ±180 stays continuous.
    const lon = center[0] + ((((p[0] - center[0]) % 360) + 540) % 360) - 180
    west = Math.min(west, lon)
    east = Math.max(east, lon)
    south = Math.min(south, p[1])
    north = Math.max(north, p[1])
  }
  if (!Number.isFinite(west)) return null

  // Samples are a grid apart; pad so nothing on screen falls outside.
  const pad = (SIZE / n / projection.scale()) * (180 / Math.PI) * 2
  return {
    west: west - pad,
    east: east + pad,
    south: Math.max(-90, south - pad),
    north: Math.min(90, north + pad),
  }
}

/**
 * The finest tiled level whose grid over `bounds` stays within `budget`
 * points, so every frame costs about the same whatever the zoom. Null means
 * no tiled level fits and the whole-globe grid should be used.
 */
export function pickLevel(levels: PyramidLevel[], bounds: Bounds, budget: number): number | null {
  for (let i = levels.length - 1; i >= 0; i--) {
    const level = levels[i]
    if (!level.tiles) continue
    const points = ((bounds.north - bounds.south) / level.res + 3) * ((bounds.east - bounds.west) / level.res + 3)
    if (points <= budget) return i
  }
  return null
}
