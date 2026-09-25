import { useEffect, useMemo, useState } from 'react'
import { Globe } from './components/Globe'
import { Legend } from './components/Legend'
import { DATA_SOURCE, DEFAULT_MONTH, DEFAULT_STEP_C } from './config'
import { loadManifest, loadMonth, type Grid } from './data/grid'
import { computeIsotherms, thresholdsFor } from './map/isotherms'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function App() {
  const [grid, setGrid] = useState<Grid | null>(null)
  const [error, setError] = useState<string | null>(null)
  const month = DEFAULT_MONTH
  const step = DEFAULT_STEP_C

  useEffect(() => {
    let cancelled = false
    loadManifest(DATA_SOURCE)
      .then((manifest) => loadMonth(manifest, month))
      .then((g) => !cancelled && setGrid(g))
      .catch((e: unknown) => !cancelled && setError(String(e)))
    return () => {
      cancelled = true
    }
  }, [month])

  const { thresholds, isotherms } = useMemo(() => {
    if (!grid) return { thresholds: [], isotherms: [] }
    let min = Infinity
    let max = -Infinity
    for (const v of grid.values) {
      if (v < min) min = v
      if (v > max) max = v
    }
    const thresholds = thresholdsFor(min, max, step)
    return { thresholds, isotherms: computeIsotherms(grid, thresholds) }
  }, [grid, step])

  return (
    <main>
      <header>
        <h1>{MONTH_NAMES[month - 1]}</h1>
        <p className="subtitle">
          Average surface air temperature, isotherms every {step} °C
        </p>
      </header>
      {error && <p className="error">Could not load data: {error}</p>}
      {!grid && !error && <p className="loading">Loading…</p>}
      {grid && (
        <>
          <Globe grid={grid} isotherms={isotherms} step={step} />
          <Legend thresholds={thresholds} step={step} />
          <p className="source">
            Data: {grid.manifest.title}, {grid.manifest.period} average (NOAA PSL). Drag the globe to rotate.
          </p>
        </>
      )}
    </main>
  )
}
