import { geoDistance, geoGraticule10, geoOrthographic, geoPath } from 'd3-geo'
import type { FeatureCollection, MultiLineString } from 'geojson'
import { useMemo, useRef, useState, type PointerEvent } from 'react'
import { feature, mesh } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import countries110m from 'world-atlas/countries-110m.json'
import { sampleAt, type Grid } from '../data/grid'
import type { Isotherm } from '../map/isotherms'
import { createLabelPlacer } from '../map/labels'
import { bandFill, FREEZING, formatTemperature, type TemperatureScale } from '../map/scale'

const SIZE = 640
const PADDING = 8

const world = countries110m as unknown as Topology<{ countries: GeometryCollection; land: GeometryCollection }>
const land = feature(world, world.objects.land) as FeatureCollection
const borders = mesh(world, world.objects.countries, (a, b) => a !== b) as MultiLineString
const graticule = geoGraticule10()
const sphere = { type: 'Sphere' } as const

interface Props {
  grid: Grid
  /** isotherms[i] is the contour for scale.thresholds[i]. */
  isotherms: Isotherm[]
  scale: TemperatureScale
  /** Line labels; hidden while the year plays. */
  showLabels: boolean
}

interface Hover {
  x: number
  y: number
  lon: number
  lat: number
  celsius: number
}

export function Globe({ grid, isotherms, scale, showLabels }: Props) {
  const [rotation, setRotation] = useState<[number, number]>([-10, -25])
  const [hover, setHover] = useState<Hover | null>(null)
  const drag = useRef<{ x: number; y: number; rotation: [number, number] } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const projection = useMemo(
    () =>
      geoOrthographic()
        .fitExtent([[PADDING, PADDING], [SIZE - PADDING, SIZE - PADDING]], sphere)
        .rotate(rotation),
    [rotation],
  )
  const path = useMemo(() => geoPath(projection), [projection])
  const freezing = FREEZING[scale.units]
  const [placeLabels] = useState(createLabelPlacer)
  const labels = useMemo(
    () => (showLabels ? placeLabels(isotherms, scale.thresholds, freezing, projection) : []),
    [placeLabels, showLabels, isotherms, scale.thresholds, freezing, projection],
  )

  const toSvg = (e: PointerEvent): [number, number] => {
    const box = svgRef.current!.getBoundingClientRect()
    return [((e.clientX - box.left) / box.width) * SIZE, ((e.clientY - box.top) / box.height) * SIZE]
  }

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, rotation }
    setHover(null)
  }

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (drag.current) {
      // Degrees per pixel so the point under the cursor roughly follows it.
      const k = 90 / projection.scale()
      const [lambda, phi] = drag.current.rotation
      setRotation([
        lambda + (e.clientX - drag.current.x) * k,
        Math.max(-90, Math.min(90, phi - (e.clientY - drag.current.y) * k)),
      ])
      return
    }
    const [x, y] = toSvg(e)
    const lonLat = projection.invert?.([x, y])
    const center: [number, number] = [-rotation[0], -rotation[1]]
    if (!lonLat || geoDistance(lonLat, center) > Math.PI / 2) {
      setHover(null)
      return
    }
    setHover({ x, y, lon: lonLat[0], lat: lonLat[1], celsius: sampleAt(grid, lonLat[0], lonLat[1]) })
  }

  const onPointerUp = () => {
    drag.current = null
  }

  return (
    <div className="globe">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label="Globe with isotherms. Drag to rotate."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => setHover(null)}
      >
        {/* Everything colder than the lowest isotherm shows the sphere's own fill. */}
        <path d={path(sphere) ?? ''} fill={bandFill(scale.bands[0], scale.units)} />
        {isotherms.map((iso, i) => (
          <path key={`band${i}`} d={path(iso.area) ?? ''} fill={bandFill(scale.bands[i + 1], scale.units)} />
        ))}
        <path d={path(graticule) ?? ''} className="graticule" />
        <path d={path(land) ?? ''} className="coast" />
        <path d={path(borders) ?? ''} className="border" />
        {isotherms.map((iso, i) => (
          <path
            key={`line${i}`}
            d={path(iso.line) ?? ''}
            className={scale.thresholds[i] === freezing ? 'isotherm isotherm-freezing' : 'isotherm'}
          />
        ))}
        <path d={path(sphere) ?? ''} className="outline" />
        <g className="labels" aria-hidden="true">
          {labels.map((l, i) => (
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
          <strong>{formatTemperature(hover.celsius, scale.units)}</strong>
          <span>{formatLonLat(hover.lon, hover.lat)}</span>
        </div>
      )}
    </div>
  )
}

function formatLonLat(lon: number, lat: number): string {
  const ns = `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}`
  const ew = `${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`
  return `${ns} ${ew}`
}
