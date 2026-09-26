import { geoDistance, type GeoProjection } from 'd3-geo'
import type { Isotherm } from './isotherms'

export interface Label {
  x: number
  y: number
  text: string
  freezing: boolean
  /** The isotherm's value, in display units. */
  value: number
  /** Where on the Earth the label sits, so it can stay there next time. */
  lonLat: [number, number]
}

export interface LabelOptions {
  /** Minimum distance in pixels between any two labels. */
  minGap: number
  /** Minimum distance in pixels between labels on the same loop. */
  minGapSameLoop: number
  maxPerLoop: number
  /** Loops shorter than this on screen get no new label. */
  minLoopLength: number
  /** How far (radians) a kept label may follow its isotherm as the month changes. */
  maxFollow: number
}

const DEFAULTS: LabelOptions = {
  minGap: 70,
  minGapSameLoop: 220,
  maxPerLoop: 3,
  minLoopLength: 80,
  maxFollow: (5 * Math.PI) / 180,
}

/** Keep labels well inside the visible disk, where text isn't foreshortened. */
const MAX_ANGLE_FROM_CENTER = (65 * Math.PI) / 180

/**
 * Pick label positions along the visible isotherms.
 *
 * Labels from the previous call stay where they were on the Earth, snapped
 * to the nearest point of their isotherm, as long as they are still visible
 * and don't collide. That way they ride along when the globe rotates and
 * follow their line when the month changes. Remaining room is then filled
 * greedily, freezing line first.
 */
export function placeLabels(
  isotherms: Isotherm[],
  values: number[],
  freezing: number,
  projection: GeoProjection,
  previous: Label[] = [],
  options: Partial<LabelOptions> = {},
): Label[] {
  const opts = { ...DEFAULTS, ...options }
  const [lambda, phi] = projection.rotate()
  const center: [number, number] = [-lambda, -phi]
  const visible = (p: [number, number]) => geoDistance(p, center) <= MAX_ANGLE_FROM_CENTER
  const placed: Label[] = []
  const byLoop = new Map<string, Label[]>()

  const tryPlace = (i: number, loopIndex: number, lonLat: [number, number]): boolean => {
    const xy = projection(lonLat)
    if (!xy) return false
    const [x, y] = xy
    const key = `${i}:${loopIndex}`
    const onLoop = byLoop.get(key) ?? []
    if (onLoop.length >= opts.maxPerLoop) return false
    if (placed.some((l) => dist(l, x, y) < opts.minGap)) return false
    if (onLoop.some((l) => dist(l, x, y) < opts.minGapSameLoop)) return false
    const label = { x, y, text: formatValue(values[i]), freezing: values[i] === freezing, value: values[i], lonLat }
    placed.push(label)
    byLoop.set(key, [...onLoop, label])
    return true
  }

  // 1. Keep previous labels, following their isotherm.
  for (const prev of previous) {
    const i = values.indexOf(prev.value)
    // Its isotherm may be gone, e.g. while new contours are still being computed.
    if (i < 0 || !isotherms[i]) continue
    const nearest = nearestPoint(isotherms[i], prev.lonLat)
    if (!nearest || nearest.distance > opts.maxFollow || !visible(nearest.lonLat)) continue
    tryPlace(i, nearest.loopIndex, nearest.lonLat)
  }

  // 2. Fill the remaining room.
  const order = isotherms.map((_, i) => i).sort((a, b) => Number(values[b] === freezing) - Number(values[a] === freezing))
  for (const i of order) {
    isotherms[i].line.coordinates.forEach((loop, loopIndex) => {
      const points = (loop as [number, number][]).filter(visible)
      if (screenLength(points.map((p) => projection(p)!)) < opts.minLoopLength) return
      for (const p of points) tryPlace(i, loopIndex, p)
    })
  }
  return placed
}

/**
 * A placer that remembers its last labels and passes them to the next call,
 * so labels stay put from frame to frame.
 */
export function createLabelPlacer() {
  let last: Label[] = []
  return {
    place: (isotherms: Isotherm[], values: number[], freezing: number, projection: GeoProjection): Label[] =>
      (last = placeLabels(isotherms, values, freezing, projection, last)),
    /**
     * The last labels moved to a new view without re-placing them: cheap
     * enough for every frame of a drag. Labels turning away are hidden.
     */
    move: (projection: GeoProjection): Label[] => {
      const [lambda, phi] = projection.rotate()
      const center: [number, number] = [-lambda, -phi]
      return last.flatMap((l) => {
        if (geoDistance(l.lonLat, center) > MAX_ANGLE_FROM_CENTER) return []
        const xy = projection(l.lonLat)
        return xy ? [{ ...l, x: xy[0], y: xy[1] }] : []
      })
    },
  }
}

function nearestPoint(iso: Isotherm, target: [number, number]) {
  // Search with a cheap flat distance (longitude scaled by latitude); only a
  // label that already sits on its line matters, so small errors far away don't.
  const cosLat = Math.cos((target[1] * Math.PI) / 180)
  let best: { lonLat: [number, number]; loopIndex: number } | null = null
  let bestScore = Infinity
  iso.line.coordinates.forEach((loop, loopIndex) => {
    for (const p of loop as [number, number][]) {
      let dLon = Math.abs(p[0] - target[0])
      if (dLon > 180) dLon = 360 - dLon
      const dLat = p[1] - target[1]
      const score = dLat * dLat + dLon * dLon * cosLat * cosLat
      if (score < bestScore) {
        bestScore = score
        best = { lonLat: p, loopIndex }
      }
    }
  })
  if (!best) return null
  const found = best as { lonLat: [number, number]; loopIndex: number }
  return { ...found, distance: geoDistance(found.lonLat, target) }
}

function formatValue(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

function screenLength(points: [number, number][]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1])
  }
  return total
}

function dist(l: Label, x: number, y: number): number {
  return Math.hypot(l.x - x, l.y - y)
}
