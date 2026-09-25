import { interpolateLab } from 'd3-interpolate'
import { scaleLinear } from 'd3-scale'

/**
 * Diverging blue <-> red scale with a neutral gray at 0 °C (freezing).
 * The domain is fixed so a given temperature keeps its color across months.
 * Each arm darkens monotonically away from the midpoint.
 */
const STOPS: [number, string][] = [
  [-50, '#0d366b'],
  [-25, '#2a78d6'],
  [-8, '#9ec5f4'],
  [0, '#f0efec'],
  [8, '#f6c1b5'],
  [20, '#e34948'],
  [35, '#7a1616'],
]

const scale = scaleLinear<string>()
  .domain(STOPS.map(([t]) => t))
  .range(STOPS.map(([, c]) => c))
  .interpolate(interpolateLab)
  .clamp(true)

export function temperatureColor(celsius: number): string {
  return scale(celsius)
}

/** Color for the band [lower, lower + step): the color of its midpoint. */
export function bandColor(lower: number, step: number): string {
  return scale(lower + step / 2)
}
