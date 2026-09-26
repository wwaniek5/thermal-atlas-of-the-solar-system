import { geoCircle, geoDistance, geoGraticule10, geoPath } from 'd3-geo'
import type { FeatureCollection, MultiLineString, Polygon } from 'geojson'
import { useEffect, useMemo, useRef, useState, type Dispatch, type PointerEvent, type SetStateAction } from 'react'
import { feature, mesh } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import countries110m from 'world-atlas/countries-110m.json'
import { sampleAt, type Grid } from '../data/grid'
import { createLabelPlacer } from '../map/labels'
import { isDarkColor } from '../map/colors'
import { bandFill, FREEZING, formatTemperature, type TemperatureScale } from '../map/scale'
import type { Feature } from '../bodies'
import type { Layer } from '../map/useIsotherms'
import { clampZoom, makeProjection, MAX_ZOOM, MIN_ZOOM, SIZE, type View } from '../map/view'

type World = Topology<{ countries: GeometryCollection; land: GeometryCollection }>

interface Outlines {
  land: FeatureCollection
  borders: MultiLineString
}

function outlines(world: World): Outlines {
  return {
    land: feature(world, world.objects.land) as FeatureCollection,
    borders: mesh(world, world.objects.countries, (a, b) => a !== b) as MultiLineString,
  }
}

/** Coastlines and borders at 1:110m; 1:50m is loaded once the user zooms in. */
const coarseOutlines = outlines(countries110m as unknown as World)
const DETAILED_OUTLINES_ZOOM = 3
let detailedOutlines: Promise<Outlines> | null = null
function loadDetailedOutlines(): Promise<Outlines> {
  detailedOutlines ??= import('world-atlas/countries-50m.json').then((m) => outlines(m.default as unknown as World))
  return detailedOutlines
}

const graticule = geoGraticule10()
const sphere = { type: 'Sphere' } as const

/** Zoom factor per +/− button press. */
const ZOOM_STEP = 1.5

/** What's drawn under the isotherms. */
export type Basemap =
  | { kind: 'earth' }
  /** Bodies without coastlines: elevation contours and named features. */
  | { kind: 'terrain'; contours: MultiLineString; features: Feature[] }

/** Feature names are hidden this close to the rim, where they'd be squashed; symbols show up to the rim. */
const FEATURE_MAX_ANGLE = (75 * Math.PI) / 180
const SYMBOL_MAX_ANGLE = (90.5 * Math.PI) / 180

interface Props {
  /** Whole-globe layer. Its isotherms are hidden while the detail layer covers the screen. */
  globe: Layer
  /** Detailed layer for what's on screen when zoomed in, if loaded. */
  detail: Layer | null
  scale: TemperatureScale
  basemap: Basemap
  /** Line labels; hidden while the year plays. */
  showLabels: boolean
  view: View
  onViewChange: Dispatch<SetStateAction<View>>
  /** Latitudes north of this have no data: covered in gray, without labels or temperatures. */
  unmeasuredNorthOf?: number
}

interface Hover {
  x: number
  y: number
  lon: number
  lat: number
  /** Null where nothing was measured. */
  celsius: number | null
}

export function Globe({ globe, detail, scale, basemap, showLabels, view, onViewChange, unmeasuredNorthOf }: Props) {
  const [hover, setHover] = useState<Hover | null>(null)
  // While dragging or pinching, draw the light outlines to keep frames fast.
  const [interacting, setInteracting] = useState(false)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ view: View; x: number; y: number; distance: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const projection = useMemo(() => makeProjection(view), [view])
  const path = useMemo(() => geoPath(projection), [projection])
  // Isotherm vertices are at most one grid cell apart, so drawing straight
  // between them instead of resampling along the sphere differs by < 0.1 px
  // and saves ~25% of path time. Outlines keep resampling: their segments are long.
  const isothermPath = useMemo(() => geoPath(makeProjection(view).precision(0)), [view])
  const freezing = FREEZING[scale.units]
  const top = detail ?? globe
  const [labelPlacer] = useState(createLabelPlacer)
  const labels = useMemo(
    () =>
      !showLabels
        ? []
        : // Placing labels scans every isotherm point; while dragging, just move the last ones.
          interacting
          ? labelPlacer.move(projection)
          : labelPlacer.place(top.isotherms, scale.thresholds, freezing, projection),
    [labelPlacer, showLabels, interacting, top.isotherms, scale.thresholds, freezing, projection],
  )
  const measured = (lat: number) => unmeasuredNorthOf === undefined || lat <= unmeasuredNorthOf
  const visibleLabels = labels.filter((l) => measured(l.lonLat[1]))
  const detailBox = useMemo(() => (detail ? boxPolygon(detail.grid) : null), [detail])

  const [fineOutlines, setFineOutlines] = useState<Outlines | null>(null)
  const wantFine = basemap.kind === 'earth' && view.zoom >= DETAILED_OUTLINES_ZOOM
  useEffect(() => {
    if (wantFine) loadDetailedOutlines().then(setFineOutlines)
  }, [wantFine])
  const { land, borders } = wantFine && fineOutlines && !interacting ? fineOutlines : coarseOutlines
  // Outlines only change with the view, not the month; detailed ones take ~30 ms to project.
  const fixedPaths = useMemo(
    () => ({
      sphere: path(sphere) ?? '',
      graticule: path(graticule) ?? '',
      land: basemap.kind === 'earth' ? (path(land) ?? '') : '',
      borders: basemap.kind === 'earth' ? (path(borders) ?? '') : '',
      terrain: basemap.kind === 'terrain' ? (isothermPath(basemap.contours) ?? '') : '',
      unmeasured:
        unmeasuredNorthOf === undefined
          ? ''
          : (path(geoCircle().center([0, 90]).radius(90 - unmeasuredNorthOf)()) ?? ''),
    }),
    [path, isothermPath, basemap, land, borders, unmeasuredNorthOf],
  )
  const featureLabels = useMemo(() => {
    if (basemap.kind !== 'terrain') return []
    const center: [number, number] = [-view.rotation[0], -view.rotation[1]]
    return basemap.features.flatMap((f) => {
      if (geoDistance(f.lonLat, center) > (f.symbol ? SYMBOL_MAX_ANGLE : FEATURE_MAX_ANGLE)) return []
      const xy = projection(f.lonLat)
      return xy ? [{ name: f.name, x: xy[0], y: xy[1], symbol: f.symbol }] : []
    })
  }, [basemap, projection, view.rotation])

  // Wheel zoom. React's onWheel is passive and can't stop the page scrolling.
  useEffect(() => {
    const svg = svgRef.current!
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      onViewChange((v) => ({ ...v, zoom: clampZoom(v.zoom * Math.exp(-e.deltaY * 0.002)) }))
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [onViewChange])

  const toSvg = (clientX: number, clientY: number): [number, number] => {
    const box = svgRef.current!.getBoundingClientRect()
    return [((clientX - box.left) / box.width) * SIZE, ((clientY - box.top) / box.height) * SIZE]
  }

  // One pointer drags to rotate; two pointers pinch to zoom.
  const startGesture = () => {
    const [a, b] = [...pointers.current.values()]
    gesture.current = {
      view,
      x: a.x,
      y: a.y,
      distance: b ? Math.hypot(a.x - b.x, a.y - b.y) : 0,
    }
  }

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    startGesture()
    setInteracting(true)
    setHover(null)
  }

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (pointers.current.has(e.pointerId)) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      const g = gesture.current!
      const [a, b] = [...pointers.current.values()]
      if (b && g.distance > 0) {
        onViewChange({ ...g.view, zoom: clampZoom((g.view.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / g.distance) })
      } else if (!b) {
        // Degrees per pixel so the point under the cursor roughly follows it.
        const k = 90 / projection.scale()
        const [lambda, phi] = g.view.rotation
        onViewChange({
          ...g.view,
          zoom: view.zoom,
          rotation: [lambda + (a.x - g.x) * k, Math.max(-90, Math.min(90, phi - (a.y - g.y) * k))],
        })
      }
      return
    }

    const [x, y] = toSvg(e.clientX, e.clientY)
    const lonLat = projection.invert?.([x, y])
    const center: [number, number] = [-view.rotation[0], -view.rotation[1]]
    if (!lonLat || geoDistance(lonLat, center) > Math.PI / 2) {
      setHover(null)
      return
    }
    const grid = detail && inside(detail.grid, lonLat) ? detail.grid : globe.grid
    const celsius = measured(lonLat[1]) ? sampleAt(grid, lonLat[0], lonLat[1]) : null
    setHover({ x, y, lon: lonLat[0], lat: lonLat[1], celsius })
  }

  const onPointerUp = (e: PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId)
    // Continue with whatever pointers remain, from where the view is now.
    if (pointers.current.size > 0) startGesture()
    else setInteracting(false)
  }

  const zoomBy = (factor: number) => onViewChange({ ...view, zoom: clampZoom(view.zoom * factor) })

  const lines = (layer: Layer, prefix: string) =>
    layer.isotherms.map((iso, i) => (
      <path
        key={`${prefix}${i}`}
        d={isothermPath(iso.line) ?? ''}
        className={[
          'isotherm',
          scale.thresholds[i] === freezing && 'isotherm-freezing',
          isDarkColor(scale.color(scale.thresholdsC[i])) && 'isotherm-on-dark',
        ]
          .filter(Boolean)
          .join(' ')}
      />
    ))

  return (
    <div className="globe">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label="Globe with isotherms. Drag to rotate, scroll or pinch to zoom."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => setHover(null)}
      >
        {/* Whole globe. Everything colder than the lowest isotherm shows the sphere's own fill. */}
        <path d={fixedPaths.sphere} fill={bandFill(scale, scale.bands[0])} />
        {!detail && globe.isotherms.map((iso, i) => (
          <path key={`band${i}`} d={isothermPath(iso.area) ?? ''} fill={bandFill(scale, scale.bands[i + 1])} />
        ))}
        {detail && detailBox && (
          <g className="detail">
            <path d={isothermPath(detailBox) ?? ''} fill={bandFill(scale, scale.bands[0])} />
            {detail.isotherms.map((iso, i) => (
              <path key={`dband${i}`} d={isothermPath(iso.area) ?? ''} fill={bandFill(scale, scale.bands[i + 1])} />
            ))}
          </g>
        )}

        <path d={fixedPaths.graticule} className="graticule" />
        <path d={fixedPaths.land} className="coast" />
        <path d={fixedPaths.borders} className="border" />
        <path d={fixedPaths.terrain} className="terrain" />
        {lines(top, 'line')}
        <path d={fixedPaths.unmeasured} className="unmeasured" />
        <path d={fixedPaths.sphere} className="outline" />
        <g className="features" aria-hidden="true">
          {featureLabels.map((f) =>
            f.symbol ? (
              <g key={f.name}>
                <circle cx={f.x} cy={f.y} r={5} className={f.symbol} />
                <text x={f.x + 9} y={f.y} className={`feature ${f.symbol}-label`}>
                  {f.name}
                </text>
              </g>
            ) : (
              <text key={f.name} x={f.x} y={f.y} className="feature">
                {f.name}
              </text>
            ),
          )}
        </g>
        <g className="labels" aria-hidden="true">
          {visibleLabels.map((l, i) => (
            <text key={i} x={l.x} y={l.y} className={l.freezing ? 'label label-freezing' : 'label'}>
              {l.text}
            </text>
          ))}
        </g>
        {hover && <circle cx={hover.x} cy={hover.y} r={4} className="hover-dot" />}
      </svg>
      {hover && (
        <div
          className="tooltip"
          style={{ left: `${(hover.x / SIZE) * 100}%`, top: `${(hover.y / SIZE) * 100}%` }}
        >
          <strong>{hover.celsius === null ? 'Not measured' : formatTemperature(hover.celsius, scale.units)}</strong>
          <span>{formatLonLat(hover.lon, hover.lat)}</span>
        </div>
      )}
      <div className="zoom-buttons">
        <button type="button" onClick={() => zoomBy(ZOOM_STEP)} disabled={view.zoom >= MAX_ZOOM} aria-label="Zoom in">
          +
        </button>
        <button type="button" onClick={() => zoomBy(1 / ZOOM_STEP)} disabled={view.zoom <= MIN_ZOOM} aria-label="Zoom out">
          −
        </button>
      </div>
    </div>
  )
}

/**
 * The lon/lat box a regional grid covers, as a polygon with a vertex at every
 * grid point along its edges: d3-geo draws edges as great circles, and short
 * edges keep them on the parallels.
 */
function boxPolygon(grid: Grid): Polygon {
  const { lat0, dlat, lon0, dlon } = grid.info
  const east = lon0 + (grid.width - 1) * dlon
  const south = lat0 + (grid.height - 1) * dlat
  const ring: [number, number][] = []
  // Clockwise, as d3-geo expects for an area smaller than a hemisphere.
  for (let i = 0; i < grid.width; i++) ring.push([lon0 + i * dlon, lat0])
  for (let j = 1; j < grid.height; j++) ring.push([east, lat0 + j * dlat])
  for (let i = grid.width - 2; i >= 0; i--) ring.push([lon0 + i * dlon, south])
  for (let j = grid.height - 2; j >= 0; j--) ring.push([lon0, lat0 + j * dlat])
  return { type: 'Polygon', coordinates: [ring] }
}

function inside(grid: Grid, [lon, lat]: [number, number]): boolean {
  const { lat0, dlat, lon0, dlon } = grid.info
  const x = ((((lon - lon0) % 360) + 360) % 360) / dlon
  const y = (lat - lat0) / dlat
  return x >= 0 && x <= grid.width - 1 && y >= 0 && y <= grid.height - 1
}

function formatLonLat(lon: number, lat: number): string {
  const ns = `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}`
  const ew = `${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`
  return `${ns} ${ew}`
}
