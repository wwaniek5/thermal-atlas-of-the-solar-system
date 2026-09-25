import { useEffect, useMemo, useState } from 'react'
import { Controls } from './components/Controls'
import { Globe } from './components/Globe'
import { Legend } from './components/Legend'
import { MonthSlider } from './components/MonthSlider'
import { DATA_SOURCE, DEFAULT_MONTH, DEFAULT_STEP_INDEX, DEFAULT_UNITS, PLAY_MONTHS_PER_SECOND } from './config'
import { gridAt, loadGlobeLevels, type Grid } from './data/grid'
import { computeIsotherms } from './map/isotherms'
import { buildScale, STEP_OPTIONS, type Units } from './map/scale'
import { nearestMonthName } from './months'

export default function App() {
  // Whole-globe grids, coarsest first, each holding the twelve months.
  const [levels, setLevels] = useState<Grid[][] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [position, setPosition] = useState(DEFAULT_MONTH - 1)
  const [playing, setPlaying] = useState(false)
  const [units, setUnits] = useState<Units>(DEFAULT_UNITS)
  // Kept as fine/default/coarse, so switching units keeps the density.
  const [stepIndex, setStepIndex] = useState(DEFAULT_STEP_INDEX)
  const step = STEP_OPTIONS[units][stepIndex]

  useEffect(() => {
    let cancelled = false
    loadGlobeLevels(DATA_SOURCE)
      .then((l) => !cancelled && setLevels(l))
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

  // Coarsest level while playing, to keep the animation smooth; finest when still.
  const year = levels ? (playing ? levels[0] : levels[levels.length - 1]) : null

  // Covers the whole year, so isotherms move rather than appear and vanish.
  const finest = levels?.[levels.length - 1]
  const range = useMemo(() => {
    if (!finest) return null
    let min = Infinity
    let max = -Infinity
    for (const grid of finest) {
      for (const v of grid.values) {
        if (v < min) min = v
        if (v > max) max = v
      }
    }
    return { min, max }
  }, [finest])
  const scale = useMemo(() => buildScale(range?.min ?? 0, range?.max ?? 0, units, step), [range, units, step])

  const grid = useMemo(() => (year ? gridAt(year, position) : null), [year, position])
  const isotherms = useMemo(() => (grid ? computeIsotherms(grid, scale.thresholdsC) : []), [grid, scale])

  return (
    <main>
      <header>
        <h1>{nearestMonthName(position)}</h1>
        <p className="subtitle">
          Average surface air temperature, isotherms every {step} °{units}
        </p>
      </header>
      {error && <p className="error">Could not load data: {error}</p>}
      {!grid && !error && <p className="loading">Loading…</p>}
      {grid && (
        <>
          <Globe grid={grid} isotherms={isotherms} scale={scale} showLabels={!playing} />
          <MonthSlider
            position={position}
            playing={playing}
            onChange={(p) => {
              setPlaying(false)
              setPosition(p)
            }}
            onTogglePlay={() => setPlaying((p) => !p)}
          />
          <Legend scale={scale} />
          <Controls
            units={units}
            step={step}
            onUnitsChange={setUnits}
            onStepChange={(s) => setStepIndex(STEP_OPTIONS[units].indexOf(s))}
          />
          <p className="source">
            Data: {grid.info.title}, {grid.info.period} average. {grid.info.credit}. Drag the globe to rotate.
          </p>
        </>
      )}
    </main>
  )
}
