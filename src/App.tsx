import { useEffect, useMemo, useState } from 'react'
import { Controls } from './components/Controls'
import { Globe, type Basemap } from './components/Globe'
import { Legend } from './components/Legend'
import { MonthSlider } from './components/MonthSlider'
import { BODIES, DEFAULT_BODY, type Body } from './bodies'
import { BodyMenu } from './components/BodyMenu'
import {
  DEFAULT_MONTH,
  DEFAULT_STEP_INDEX,
  DEFAULT_UNITS,
  DEFAULT_VIEW,
  PLAY_MONTHS_PER_SECOND,
} from './config'
import { gridAt, loadSource, type Grid, type LoadedSource } from './data/grid'
import { useRegion } from './data/useRegion'
import { computeIsotherms } from './map/isotherms'
import { useIsotherms } from './map/useIsotherms'
import { buildScale, STEP_OPTIONS, type Units } from './map/scale'
import { CALENDARS, type CalendarId } from './months'
import { bodyFromPath, useBodyRoute } from './routing'

const bodyById = (id: string): Body => BODIES.find((b) => b.id === id)!

export default function App() {
  // The body in the URL decides the starting view and line spacing.
  const [initial] = useState(() => bodyById(bodyFromPath(location.pathname) ?? DEFAULT_BODY))
  const [source, setSource] = useState<LoadedSource | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [position, setPosition] = useState(DEFAULT_MONTH - 1)
  const [playing, setPlaying] = useState(false)
  const [units, setUnits] = useState<Units>(DEFAULT_UNITS)
  // Kept as fine/default/coarse, so switching units keeps the density.
  const [stepIndex, setStepIndex] = useState(initial.stepIndex ?? DEFAULT_STEP_INDEX)
  const [calendarId, setCalendarId] = useState<CalendarId>(initial.calendars?.[0] ?? 'earth')
  const [view, setView] = useState(initial.view ?? DEFAULT_VIEW)

  // Each body has its own page (/earth, /mars); switching starts it afresh
  // with that body's own view and line spacing.
  const [bodyId, navigate] = useBodyRoute((id) => {
    const next = bodyById(id)
    setSource(null)
    setError(null)
    setPlaying(false)
    setView(next.view ?? DEFAULT_VIEW)
    setStepIndex(next.stepIndex ?? DEFAULT_STEP_INDEX)
    setCalendarId(next.calendars?.[0] ?? 'earth')
  })
  const body = bodyById(bodyId)
  const dataSource = body.source!
  const calendar = CALENDARS[calendarId]
  const stepOptions = body.stepOptions ?? STEP_OPTIONS
  const step = stepOptions[units][stepIndex]

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
  const scale = useMemo(
    () => buildScale(range?.min ?? 0, range?.max ?? 0, units, step, body.colors),
    [range, units, step, body.colors],
  )

  const grid = useMemo(() => (year ? gridAt(year, position) : null), [year, position])
  // Isotherms are computed in background threads, one per layer. The globe
  // layer keeps being computed while zoomed in (off the main thread, so it's
  // cheap), so zooming out never shows an empty globe; Globe only draws it
  // while there is no detail.
  const globeLayer = useIsotherms(grid, scale.thresholdsC)
  const detail = useIsotherms(region, scale.thresholdsC)
  const globe = globeLayer ?? (grid ? { grid, isotherms: [], thresholds: scale.thresholdsC } : null)

  const basemap = useMemo(() => makeBasemap(body, source?.terrain ?? null), [body, source])

  return (
    <div className="layout">
      <BodyMenu bodies={BODIES} selected={bodyId} onSelect={navigate} />
      <main>
        <header>
          <p className="eyebrow">{body.name}</p>
          <h1>{calendar.title(position)}</h1>
          <p className="subtitle">
            {body.quantity}, isotherms every {step}&nbsp;°{units}
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
              basemap={basemap}
              showLabels={!playing}
              view={view}
              onViewChange={setView}
            />
            <MonthSlider
              position={position}
              calendar={calendar}
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
              stepOptions={stepOptions[units]}
              onStepChange={(s) => setStepIndex(stepOptions[units].indexOf(s))}
              calendars={(body.calendars ?? []).map((id) => ({ id, label: CALENDARS[id].label }))}
              calendar={calendarId}
              onCalendarChange={setCalendarId}
            />
            <p className="source">
              Data: {globe.grid.info.title}, {globe.grid.info.period}. {globe.grid.info.credit}. Drag to rotate, scroll or pinch to zoom.
            </p>
          </>
        )}
      </main>
    </div>
  )
}

/** Coastlines for Earth; otherwise elevation contours (if the source has terrain) and feature names. */
function makeBasemap(body: Body, terrain: Grid | null): Basemap {
  if (body.coastlines) return { kind: 'earth' }
  const lines =
    terrain && body.terrainLevels
      ? computeIsotherms(terrain, body.terrainLevels).flatMap((c) => c.line.coordinates)
      : []
  return { kind: 'terrain', contours: { type: 'MultiLineString', coordinates: lines }, features: body.features ?? [] }
}
