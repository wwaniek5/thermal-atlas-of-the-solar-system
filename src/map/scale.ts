import { temperatureColor } from './colors'

export type Units = 'C' | 'F'

/** Line spacing choices, fine to coarse, in each unit. */
export const STEP_OPTIONS: Record<Units, number[]> = { C: [2, 5, 10], F: [5, 10, 20] }

/** Freezing point. Always drawn as an isotherm, even off the regular spacing. */
export const FREEZING: Record<Units, number> = { C: 0, F: 32 }

export function toCelsius(value: number, units: Units): number {
  return units === 'C' ? value : ((value - 32) * 5) / 9
}

export function fromCelsius(celsius: number, units: Units): number {
  return units === 'C' ? celsius : (celsius * 9) / 5 + 32
}

/** A band between two isotherms, in display units. */
export interface Band {
  lower: number
  upper: number
}

export interface TemperatureScale {
  units: Units
  step: number
  /** Isotherm values in display units, ascending. */
  thresholds: number[]
  /** The same isotherms in °C, for contouring. */
  thresholdsC: number[]
  /**
   * One more than thresholds: bands[0] lies below thresholds[0] (the globe's
   * base fill), and bands[i + 1] starts at thresholds[i].
   */
  bands: Band[]
}

/**
 * Isotherms every `step` display units covering [minC, maxC], plus the
 * freezing line when it falls inside the range.
 */
export function buildScale(minC: number, maxC: number, units: Units, step: number): TemperatureScale {
  const min = fromCelsius(minC, units)
  const max = fromCelsius(maxC, units)
  const set = new Set<number>()
  for (let t = Math.ceil(min / step) * step; t <= max; t += step) set.add(round(t))
  if (FREEZING[units] >= min && FREEZING[units] <= max) set.add(FREEZING[units])
  const thresholds = [...set].sort((a, b) => a - b)

  const bands: Band[] = []
  if (thresholds.length > 0) {
    bands.push({ lower: thresholds[0] - step, upper: thresholds[0] })
    thresholds.forEach((t, i) => bands.push({ lower: t, upper: thresholds[i + 1] ?? t + step }))
  }
  return { units, step, thresholds, thresholdsC: thresholds.map((t) => toCelsius(t, units)), bands }
}

/** Fill for a band: the color of its midpoint temperature. */
export function bandFill(band: Band, units: Units): string {
  return temperatureColor(toCelsius((band.lower + band.upper) / 2, units))
}

export function formatTemperature(celsius: number, units: Units, digits = 1): string {
  return `${fromCelsius(celsius, units).toFixed(digits)} °${units}`
}

function round(v: number): number {
  return Math.round(v * 1e6) / 1e6
}
