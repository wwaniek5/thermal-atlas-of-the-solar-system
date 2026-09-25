import { contours } from 'd3-contour'
import type { GeoSphere } from 'd3-geo'
import type { MultiLineString, Polygon, Position } from 'geojson'
import type { Grid } from '../data/grid'

export interface Isotherm {
  /** Degrees Celsius. */
  threshold: number
  /**
   * Area at or above the threshold, in lon/lat. All boundary loops go into
   * one polygon: d3-geo decides inside/outside by winding, so loops need no
   * outer/hole nesting. The whole sphere when the threshold is below every
   * grid value, since such an area has no boundary.
   */
  area: Polygon | GeoSphere
  /** The isotherm itself: the same loops as the area's boundary. */
  line: MultiLineString
}

/**
 * Contours on the flat grid come out as shapes bounded partly by the grid's
 * edges: the antimeridian seam and the pole rows. Those edges aren't real
 * boundaries on a sphere, and shapes that run along them confuse d3-geo's
 * clipping whenever a pole is in view. So the edge stretches are dropped and
 * the remaining pieces are joined across the seam into loops that close on
 * the sphere.
 */
export function computeIsotherms(
  grid: Grid,
  thresholds: number[],
  onBroken: (point: Position) => void = warnBroken,
): Isotherm[] {
  const generator = contours().size([grid.width, grid.height])
  const toLonLat = gridToLonLat(grid)
  const min = grid.values.reduce((a, b) => Math.min(a, b), Infinity)
  return thresholds.map((threshold) => {
    const level = threshold + THRESHOLD_OFFSET
    const pieces = generator
      .contour(grid.values as unknown as number[], level)
      .coordinates.flat()
      .map((ring) => dedupe(ring.map(toLonLat)).reverse())
      .flatMap(splitAtGridEdges)
    const loops = joinAcrossSeam(pieces, onBroken).filter(isRealRing)
    return {
      threshold,
      area: loops.length === 0 && min >= level ? { type: 'Sphere' } : { type: 'Polygon', coordinates: loops },
      line: { type: 'MultiLineString', coordinates: loops },
    }
  })
}

/**
 * Contours are drawn this far above their nominal value. When a grid value
 * equals the threshold exactly (common: data comes in tenths of a degree,
 * isotherms are whole degrees), the contour passes exactly through that grid
 * point, which on the seam or a pole row leaves pieces that can't be joined.
 * The offset is far below what the data or the eye can resolve.
 */
const THRESHOLD_OFFSET = 1e-4

/**
 * d3-contour puts value (col, row) at (col + 0.5, row + 0.5) and closes
 * shapes along a border half a cell further out. Clamp that border onto
 * exactly -180/+180 and +90/-90 so the globe has no gaps.
 */
export function gridToLonLat(grid: Grid): (p: Position) => Position {
  const { lat0, dlat, lon0, dlon } = grid.info
  return ([x, y]) => {
    const cx = Math.max(0.5, Math.min(grid.width - 0.5, x))
    const cy = Math.max(0.5, Math.min(grid.height - 0.5, y))
    return [lon0 + (cx - 0.5) * dlon, lat0 + (cy - 0.5) * dlat]
  }
}

/**
 * Break a closed ring into lines, dropping stretches that run along the
 * antimeridian seam or a pole: those are artefacts of the flat grid, not
 * isotherms. A ring that never touches an edge comes back whole.
 */
export function splitAtGridEdges(ring: Position[]): Position[][] {
  const lines: Position[][] = []
  let current: Position[] = []
  for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1]
    const b = ring[i]
    if (onSameGridEdge(a, b)) {
      if (current.length > 1) lines.push(current)
      current = []
      continue
    }
    if (current.length === 0) current.push(a)
    current.push(b)
  }
  if (current.length > 1) lines.push(current)

  // The ring's arbitrary start point may have cut a line in two; rejoin it.
  if (lines.length > 1 && samePoint(lines[0][0], lines[lines.length - 1].at(-1)!)) {
    const last = lines.pop()!
    lines[0] = [...last, ...lines[0].slice(1)]
  }
  return lines
}

/**
 * Join pieces into closed loops. A piece that isn't already closed ends on
 * the seam, and continues with the piece starting at the same latitude on
 * the other side of it (lon +180 and -180 are the same meridian). The grid's
 * seam columns hold identical values, so those latitudes match exactly.
 *
 * Should a piece have nothing to join, its loop is closed where it stands
 * and reported through `onBroken`: one frame drawn slightly wrong beats a
 * crashed page.
 */
export function joinAcrossSeam(pieces: Position[][], onBroken: (point: Position) => void): Position[][] {
  const loops: Position[][] = []
  const byStart = new Map<string, Position[]>()
  for (const piece of pieces) {
    if (samePoint(piece[0], piece.at(-1)!)) loops.push(piece)
    else if (byStart.has(seamKey(piece[0]))) onBroken(piece[0])
    else byStart.set(seamKey(piece[0]), piece)
  }

  for (const [startKey, first] of byStart) {
    byStart.delete(startKey)
    const loop = [...first]
    for (;;) {
      const endKey = seamKey(loop.at(-1)!)
      if (endKey === startKey) break
      const next = byStart.get(endKey)
      if (!next) {
        onBroken(loop.at(-1)!)
        break
      }
      byStart.delete(endKey)
      loop.push(...next)
    }
    loop.push(loop[0])
    loops.push(loop)
  }
  return loops
}

/** Identifies a point on the seam regardless of which side it's on. */
function seamKey([lon, lat]: Position): string {
  return `${Math.abs(lon) === 180 ? 180 : lon},${lat}`
}

function warnBroken(point: Position): void {
  console.warn(`isotherm piece ends at ${point} with nothing to join`)
}

function onSameGridEdge([lonA, latA]: Position, [lonB, latB]: Position): boolean {
  return (Math.abs(lonA) === 180 && lonA === lonB) || (Math.abs(latA) === 90 && latA === latB)
}

function samePoint(a: Position, b: Position): boolean {
  return a[0] === b[0] && a[1] === b[1]
}

/** A closed ring needs at least three distinct points plus the closing one. */
function isRealRing(ring: Position[]): boolean {
  return ring.length >= 4
}

function dedupe(ring: Position[]): Position[] {
  return ring.filter((p, i) => i === 0 || !samePoint(p, ring[i - 1]))
}
