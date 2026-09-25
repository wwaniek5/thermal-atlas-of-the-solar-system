/// Computes isotherms off the main thread, so contouring never blocks drawing
/// or input. See useIsotherms.
import type { Grid } from '../data/grid'
import { computeIsotherms, type Isotherm } from './isotherms'

export interface ContourRequest {
  id: number
  grid: Grid
  thresholds: number[]
}

export interface ContourResponse {
  id: number
  isotherms: Isotherm[]
}

self.onmessage = (e: MessageEvent<ContourRequest>) => {
  const { id, grid, thresholds } = e.data
  const response: ContourResponse = { id, isotherms: computeIsotherms(grid, thresholds) }
  ;(self as unknown as Worker).postMessage(response)
}
