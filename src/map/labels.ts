import { geoDistance, type GeoProjection } from 'd3-geo'
import type { Isotherm } from './isotherms'

export interface Label {
  x: number
  y: number
  text: string
  freezing: boolean
}

export interface LabelOptions {
  /** Minimum distance in pixels between any two labels. */
  minGap: number
  /** Minimum distance in pixels between labels on the same loop. */
  minGapSameLoop: number
  maxPerLoop: number
  /** Loops shorter than this on screen get no label. */
  minLoopLength: number
}

const DEFAULTS: LabelOptions = { minGap: 70, minGapSameLoop: 220, maxPerLoop: 3, minLoopLength: 80 }

/** Keep labels well inside the visible disk, where text isn't foreshortened. */
const MAX_ANGLE_FROM_CENTER = (65 * Math.PI) / 180

/**
 * Pick label positions along the visible isotherms, greedily: freezing line
 * first, then the rest, skipping spots too close to a placed label.
 */
export function placeLabels(
  isotherms: Isotherm[],
  values: number[],
  freezing: number,
  projection: GeoProjection,
  options: Partial<LabelOptions> = {},
): Label[] {
  const opts = { ...DEFAULTS, ...options }
  const [lambda, phi] = projection.rotate()
  const center: [number, number] = [-lambda, -phi]
  const placed: Label[] = []

  const order = isotherms.map((_, i) => i).sort((a, b) => Number(values[b] === freezing) - Number(values[a] === freezing))
  for (const i of order) {
    const text = formatValue(values[i])
    for (const loop of isotherms[i].line.coordinates) {
      // Visible stretch of the loop, in screen coordinates.
      const points: [number, number][] = []
      for (const p of loop) {
        if (geoDistance(p as [number, number], center) > MAX_ANGLE_FROM_CENTER) continue
        const xy = projection(p as [number, number])
        if (xy) points.push(xy)
      }
      if (screenLength(points) < opts.minLoopLength) continue

      const onLoop: Label[] = []
      for (const [x, y] of points) {
        if (onLoop.length >= opts.maxPerLoop) break
        if (placed.some((l) => dist(l, x, y) < opts.minGap)) continue
        if (onLoop.some((l) => dist(l, x, y) < opts.minGapSameLoop)) continue
        const label = { x, y, text, freezing: values[i] === freezing }
        onLoop.push(label)
        placed.push(label)
      }
    }
  }
  return placed
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
