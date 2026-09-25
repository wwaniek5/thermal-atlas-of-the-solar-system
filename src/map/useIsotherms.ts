import { useEffect, useRef, useState } from 'react'
import type { Grid } from '../data/grid'
import type { ContourRequest, ContourResponse } from './contour.worker'
import type { Isotherm } from './isotherms'

/** A grid with the isotherms computed from it. */
export interface Layer {
  grid: Grid
  /** isotherms[i] is the contour for thresholds[i]. */
  isotherms: Isotherm[]
  thresholds: number[]
}

/**
 * Isotherms for `grid`, computed in a background thread.
 *
 * Returns the latest finished result, which may be a frame behind `grid`;
 * grid and isotherms always come as a matching pair. While a computation
 * runs, newer requests replace each other, so during fast playback frames
 * are skipped rather than queued. Null for a null grid (which also discards
 * the last result, so it can't reappear later for a different area), or
 * until results for the current thresholds exist.
 */
export function useIsotherms(grid: Grid | null, thresholds: number[]): Layer | null {
  const [layer, setLayer] = useState<Layer | null>(null)
  const scheduler = useRef<Scheduler | null>(null)

  useEffect(() => {
    const s = new Scheduler(setLayer)
    scheduler.current = s
    return () => {
      s.terminate()
      scheduler.current = null
    }
  }, [])

  useEffect(() => {
    if (grid) scheduler.current?.request(grid, thresholds)
    else scheduler.current?.clear()
  }, [grid, thresholds])

  if (!grid || !layer || layer.thresholds !== thresholds) return null
  return layer
}

class Scheduler {
  private worker = new Worker(new URL('./contour.worker.ts', import.meta.url), { type: 'module' })
  private nextId = 0
  private running: { id: number; grid: Grid; thresholds: number[] } | null = null
  private waiting: { grid: Grid; thresholds: number[] } | null = null
  private readonly onResult: (layer: Layer | null) => void

  constructor(onResult: (layer: Layer | null) => void) {
    this.onResult = onResult
    this.worker.onmessage = (e: MessageEvent<ContourResponse>) => {
      const done = this.running
      this.running = null
      if (done && done.id === e.data.id) {
        this.onResult({ grid: done.grid, isotherms: e.data.isotherms, thresholds: done.thresholds })
      }
      if (this.waiting) {
        const next = this.waiting
        this.waiting = null
        this.request(next.grid, next.thresholds)
      }
    }
    this.worker.onerror = (e) => console.warn('contour worker failed:', e.message)
  }

  request(grid: Grid, thresholds: number[]): void {
    if (this.running) {
      this.waiting = { grid, thresholds }
      return
    }
    this.running = { id: this.nextId++, grid, thresholds }
    const message: ContourRequest = { id: this.running.id, grid, thresholds }
    this.worker.postMessage(message)
  }

  /** Drop pending work and the current result. */
  clear(): void {
    this.waiting = null
    if (this.running) this.running.id = -1 // ignore its result when it arrives
    this.onResult(null)
  }

  terminate(): void {
    this.worker.terminate()
  }
}
