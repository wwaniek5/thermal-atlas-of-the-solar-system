import { useEffect, useMemo, useState } from 'react'
import { Controls } from './components/Controls'
import { Globe, type Basemap } from './components/Globe'
import { Legend } from './components/Legend'
import { MercuryOrbit } from './components/MercuryOrbit'
import { MoonOrbit } from './components/MoonOrbit'
import { MonthSlider } from './components/MonthSlider'
import { BODIES, DEFAULT_BODY, type Body } from './bodies'
import { BodyMenu } from './components/BodyMenu'
import {
  DEFAULT_MONTH,
  DEFAULT_STEP_INDEX,
  DEFAULT_UNITS,
  DEFAULT_VIEW,
  DETAIL_POINTS_PLAYING,
  DETAIL_POINTS_STILL,
  PLAY_MONTHS_PER_SECOND,
  SITE_NAME,
} from './config'
import { gridAt, loadSource, type Grid, type LoadedSource } from './data/grid'
import { useRegion } from './data/useRegion'
import { computeIsotherms } from './map/isotherms'
import { useIsotherms } from './map/useIsotherms'
import { buildScale, STEP_OPTIONS, type Units } from './map/scale'
import { CALENDARS } from './months'
import { bodyFromPath, useBodyRoute } from './routing'

const bodyById = (id: string): Body => BODIES.find((b) => b.id === id)!

export default function App() {
  // The body in the URL decides the starting view and line spacing.
  const [initial] = useState(() => bodyById(bodyFromPath(location.pathname) ?? DEFAULT_BODY))
  const [source, setSource] = useState<LoadedSource | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [position, setPosition] = useState(initial.startPosition ?? DEFAULT_MONTH - 1)
  const [playing, setPlaying] = useState(false)
  const [units, setUnits] = useState<Units>(DEFAULT_UNITS)
  // Kept as fine/default/coarse, so switching units keeps the density.
  const [stepIndex, setStepIndex] = useState(initial.stepIndex ?? DEFAULT_STEP_INDEX)
  const [view, setView] = useState(initial.view ?? DEFAULT_VIEW)

  // Each body has its own page (/earth, /mars); switching starts it afresh
  // with that body's own view and line spacing.
  const [bodyId, navigate, home] = useBodyRoute((id) => {
    const next = bodyById(id)
    setSource(null)
    setError(null)
    setPlaying(false)
    setView(next.view ?? DEFAULT_VIEW)
    setPosition(next.startPosition ?? DEFAULT_MONTH - 1)
    setStepIndex(next.stepIndex ?? DEFAULT_STEP_INDEX)
  })
  const body = bodyById(bodyId)
  // Home keeps the site's name, so a shared link reads as the site; body pages name the body.
  useEffect(() => {
    document.title = home ? SITE_NAME : `${body.name} · Thermal Atlas`
  }, [home, body.name])
  const dataSource = body.source!
  const calendar = CALENDARS[body.calendar ?? 'earth']
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
  const budget = (playing ? DETAIL_POINTS_PLAYING : DETAIL_POINTS_STILL) * (body.detailScale ?? 1)
  const { grid: region, loading: regionLoading } = useRegion(dataSource, source?.pyramid ?? null, view, position, budget)

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

  const cyclic = calendar.cyclic ?? true
  const grid = useMemo(() => (year ? gridAt(year, position, cyclic) : null), [year, position, cyclic])
  // Isotherms are computed in background threads, one per layer. The globe
  // layer keeps being computed while zoomed in (off the main thread, so it's
  // cheap), so zooming out never shows an empty globe; Globe only draws it
  // while there is no detail.
  const globeLayer = useIsotherms(grid, scale.thresholdsC)
  const detail = useIsotherms(region, scale.thresholdsC)
  const globe = globeLayer ?? (grid ? { grid, isotherms: [], thresholds: scale.thresholdsC } : null)
  // Still drawing: the first isotherms, or zoom detail (tiles or isotherms) not in yet.
  const drawing = !globeLayer || regionLoading || (region !== null && !detail)

  const basemap = useMemo(() => makeBasemap(body, source?.terrain ?? null), [body, source])

  return (
    <div className="layout">
      <BodyMenu bodies={BODIES} selected={bodyId} onSelect={navigate} />
      <main>
        <header>
          <p className="eyebrow">{body.name}</p>
          <h1>{body.staticTitle ?? calendar.title(position)}</h1>
          <p className="subtitle">
            {body.quantity}, isotherms every {step}&nbsp;°{units}
          </p>
        </header>
        {error && <p className="error">Could not load data: {error}</p>}
        {!globe && !error && (
          // The globe's place, so the page doesn't jump when it arrives.
          <div className="content">
            <div className="globe globe-placeholder" role="status">
              <div className="placeholder-disc" />
              <p className="placeholder-text">
                <span className="spinner" aria-hidden="true" />
                Loading temperatures…
              </p>
            </div>
          </div>
        )}
        {globe && (
          // Wide screens: globe on the left, everything else in a column on the right.
          <div className="content">
            <Globe
              globe={globe}
              detail={detail}
              scale={scale}
              basemap={basemap}
              showLabels={!playing}
              view={view}
              onViewChange={setView}
              unmeasuredNorthOf={body.unmeasuredNorthOf}
              busy={drawing}
            />
            <div className="panel">
              {/* Bodies whose temperatures don't change get no time control. */}
              {body.staticTitle ? null : body.orbitDiagram === 'moon' ? (
                // The Moon: its orbit around Earth is the time control.
                <MoonOrbit
                  position={position}
                  describe={calendar.describe}
                  onChange={(p) => {
                    setPlaying(false)
                    setPosition(p)
                  }}
                  playing={playing}
                  onTogglePlay={() => setPlaying((p) => !p)}
                />
              ) : body.orbitDiagram === 'mercury' ? (
                // Mercury: the orbit diagram is the time control.
                <MercuryOrbit
                  position={position}
                  describe={calendar.describe}
                  onChange={(p) => {
                    setPlaying(false)
                    setPosition(p)
                  }}
                  playing={playing}
                  onTogglePlay={() => setPlaying((p) => !p)}
                />
              ) : (
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
              )}
              {body.about && (
                <section className="about" aria-labelledby="about-heading">
                  <h2 id="about-heading">About {body.name}</h2>
                  {body.about.map((text) => (
                    <p key={text}>{text}</p>
                  ))}
                </section>
              )}
              <Legend scale={scale} />
              <Controls
                units={units}
                step={step}
                onUnitsChange={setUnits}
                stepOptions={stepOptions[units]}
                onStepChange={(s) => setStepIndex(stepOptions[units].indexOf(s))}
              />
              <p className="source">
                Data: {globe.grid.info.title}, {globe.grid.info.period}. {globe.grid.info.credit}. Drag to rotate, scroll or pinch to zoom.
              </p>
            </div>
          </div>
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
