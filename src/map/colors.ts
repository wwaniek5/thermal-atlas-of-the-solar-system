import { lab } from 'd3-color'
import { interpolateLab } from 'd3-interpolate'
import { scaleLinear } from 'd3-scale'

/**
 * Diverging blue <-> red palette with a neutral gray in the middle, defined
 * on Earth's temperatures: gray at 0 °C (freezing). Each arm darkens
 * monotonically away from the midpoint.
 */
const EARTH_STOPS: [number, string][] = [
  [-50, '#0d366b'],
  [-25, '#2a78d6'],
  [-8, '#9ec5f4'],
  [0, '#f0efec'],
  [8, '#f6c1b5'],
  [20, '#e34948'],
  [35, '#7a1616'],
]

const earth = scaleLinear<string>()
  .domain(EARTH_STOPS.map(([t]) => t))
  .range(EARTH_STOPS.map(([, c]) => c))
  .interpolate(interpolateLab)
  .clamp(true)

/**
 * Where a body's palette sits, in °C: [darkest blue, neutral gray, darkest red].
 * The domain is fixed per body, so a temperature keeps its color across months.
 */
export type ColorRange = [cold: number, mid: number, hot: number]

export const EARTH_COLORS: ColorRange = [-50, 0, 35]

/**
 * The palette stretched onto a body's own range: each arm is rescaled
 * linearly, so Earth's color steps are kept and every body shows both blues
 * and reds.
 */
export function makeColorScale([cold, mid, hot]: ColorRange): (celsius: number) => string {
  const [earthCold, earthMid, earthHot] = EARTH_COLORS
  return (celsius) =>
    earth(
      celsius < mid
        ? earthMid + ((celsius - mid) / (mid - cold)) * (earthMid - earthCold)
        : earthMid + ((celsius - mid) / (hot - mid)) * (earthHot - earthMid),
    )
}

/** Whether dark ink would be hard to see on this color. */
export function isDarkColor(color: string): boolean {
  return lab(color).l < 35
}
