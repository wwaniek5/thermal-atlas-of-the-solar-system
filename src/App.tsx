import { useEffect, useMemo, useState } from 'react'
import { Globe } from './components/Globe'
import { Legend } from './components/Legend'
import { MonthSlider } from './components/MonthSlider'
import { DATA_SOURCE, DEFAULT_MONTH, DEFAULT_STEP_C, PLAY_MONTHS_PER_SECOND } from './config'
import { gridAt, loadManifest, loadYear, type Grid } from './data/grid'
import { computeIsotherms, thresholdsFor } from './map/isotherms'
import { nearestMonthName } from './months'

export default function App() {
  const [year, setYear] = useState<Grid[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [position, setPosition] = useState(DEFAULT_MONTH - 1)
  const [playing, setPlaying] = useState(false)
  const step = DEFAULT_STEP_C

  useEffect(() => {
    let cancelled = false
    loadManifest(DATA_SOURCE)
      .then(loadYear)
      .then((y) => !cancelled && setYear(y))
      .catch((e: unknown) => !cancelled && setError(String(e)))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!playing) return
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const seconds = (now - last) / 1000
      last = now
      setPosition((p) => (p + seconds * PLAY_MONTHS_PER_SECOND) % 12)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing])

  // The same thresholds all year, so isotherms move rather than appear and vanish.
  const thresholds = useMemo(() => {
    if (!year) return []
    let min = Infinity
    let max = -Infinity
    for (const grid of year) {
      for (const v of grid.values) {
        if (v < min) min = v
        if (v > max) max = v
      }
    }
    return thresholdsFor(min, max, step)
  }, [year, step])

  const grid = useMemo(() => (year ? gridAt(year, position) : null), [year, position])
  const isotherms = useMemo(() => (grid ? computeIsotherms(grid, thresholds) : []), [grid, thresholds])

  return (
    <main>
      <header>
        <h1>{nearestMonthName(position)}</h1>
        <p className="subtitle">Average surface air temperature, isotherms every {step} °C</p>
      </header>
      {error && <p className="error">Could not load data: {error}</p>}
      {!grid && !error && <p className="loading">Loading…</p>}
      {grid && (
        <>
          <Globe grid={grid} isotherms={isotherms} step={step} />
          <MonthSlider
            position={position}
            playing={playing}
            onChange={(p) => {
              setPlaying(false)
              setPosition(p)
            }}
            onTogglePlay={() => setPlaying((p) => !p)}
          />
          <Legend thresholds={thresholds} step={step} />
          <p className="source">
            Data: {grid.manifest.title}, {grid.manifest.period} average (NOAA PSL). Drag the globe to rotate.
          </p>
        </>
      )}
    </main>
  )
}
