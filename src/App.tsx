import { useEffect, useMemo, useState } from 'react'
import { Controls } from './components/Controls'
import { Globe } from './components/Globe'
import { Legend } from './components/Legend'
import { MonthSlider } from './components/MonthSlider'
import { BODIES } from './bodies'
import { BodyMenu } from './components/BodyMenu'
import {
  DEFAULT_MONTH,
  DEFAULT_STEP_INDEX,
  DEFAULT_UNITS,
  DEFAULT_VIEW,
  PLAY_MONTHS_PER_SECOND,
} from './config'
import { gridAt, loadSource, type LoadedSource } from './data/grid'
import { useRegion } from './data/useRegion'
import { useIsotherms } from './map/useIsotherms'
import { buildScale, STEP_OPTIONS, type Units } from './map/scale'
import { nearestMonthName } from './months'
import { useBodyRoute } from './routing'

export default function App() {
  const [source, setSource] = useState<LoadedSource | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [position, setPosition] = useState(DEFAULT_MONTH - 1)
  const [playing, setPlaying] = useState(false)
  const [units, setUnits] = useState<Units>(DEFAULT_UNITS)
  // Kept as fine/default/coarse, so switching units keeps the density.
  const [stepIndex, setStepIndex] = useState(DEFAULT_STEP_INDEX)
  const step = STEP_OPTIONS[units][stepIndex]
  const [view, setView] = useState(DEFAULT_VIEW)
  // Each body has its own page (/earth, ...); switching starts it afresh.
  const [bodyId, navigate] = useBodyRoute(() => {
    setSource(null)
    setError(null)
    setPlaying(false)
    setView(DEFAULT_VIEW)
  })
  const body = BODIES.find((b) => b.id === bodyId)!
  const dataSource = body.source!

  useEffect(() => {
    let cancelled = false
    loadSource(dataSource)
      .then((s) => !cancelled && setSource(s))
      .catch((e: unknown) => !cancelled && setError(String(e)))
    return () => {
      cancelled = true
    }
  }, [dataSource])

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

  // Zoomed in: detail for what's on screen, from tiles.
  const region = useRegion(dataSource, source?.pyramid ?? null, view, position, playing)

  // Whole globe: the coarsest level while playing or as the background behind
  // the detail (to keep frames fast), the finest when still.
  const levels = source?.globe
  const year = levels ? (playing || region ? levels[0] : levels[levels.length - 1]) : null

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
  // Isotherms are computed in background threads, one per layer. The globe
  // layer keeps being computed while zoomed in (off the main thread, so it's
  // cheap), so zooming out never shows an empty globe; Globe only draws it
  // while there is no detail.
  const globeLayer = useIsotherms(grid, scale.thresholdsC)
  const detail = useIsotherms(region, scale.thresholdsC)
  const globe = globeLayer ?? (grid ? { grid, isotherms: [], thresholds: scale.thresholdsC } : null)

  return (
    <div className="layout">
      <BodyMenu bodies={BODIES} selected={bodyId} onSelect={navigate} />
      <main>
        <header>
          <p className="eyebrow">{body.name}</p>
          <h1>{nearestMonthName(position)}</h1>
          <p className="subtitle">
            Average surface air temperature, isotherms every {step}&nbsp;°{units}
          </p>
        </header>
        {error && <p className="error">Could not load data: {error}</p>}
        {!globe && !error && <p className="loading">Loading…</p>}
        {globe && (
          <>
            <Globe
              globe={globe}
              detail={detail}
              scale={scale}
              showLabels={!playing}
              view={view}
              onViewChange={setView}
            />
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
              Data: {globe.grid.info.title}, {globe.grid.info.period} average. {globe.grid.info.credit}. Drag to rotate, scroll or pinch to zoom.
            </p>
          </>
        )}
      </main>
    </div>
  )
}
