import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { moonAngle, moonDayAt, positionAtMoonAngle } from '../moon'
import { PlayButton } from './PlayButton'
import { Swatch } from './Swatch'

interface Props {
  /** 0..12 through one lunar day. */
  position: number
  /** Screen-reader text for a position, e.g. "Day 7 · first quarter". */
  describe: (position: number) => string
  onChange: (position: number) => void
  playing: boolean
  onTogglePlay: () => void
}

const WIDTH = 320
const HEIGHT = 190
const EARTH = { x: WIDTH / 2 + 20, y: HEIGHT / 2, r: 12 }
/** Not to scale: the real Moon is 30 Earth widths away. */
const ORBIT_R = 70
const MOON_R = 9
/** Arrow keys move the Moon by this much of the 12 steps. */
const KEY_STEP = 0.25

/**
 * The Moon going round Earth, seen from above the north, with sunlight
 * coming from the left. The Moon's 0° longitude always faces Earth, so the
 * purple marker points at Earth all the way round, while the Sun moves
 * across the Moon's sky once per orbit. Drag the Moon to move it.
 */
export function MoonOrbit({ position, describe, onChange, playing, onTogglePlay }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const dragging = useRef(false)

  const angle = moonAngle(moonDayAt(position))
  const x = EARTH.x + ORBIT_R * Math.cos(angle)
  const y = EARTH.y - ORBIT_R * Math.sin(angle)
  // The 0° marker on the rim, facing Earth.
  const toEarth = Math.atan2(EARTH.y - y, EARTH.x - x)
  const marker = { x: x + MOON_R * Math.cos(toEarth), y: y + MOON_R * Math.sin(toEarth) }

  const moveTo = (e: PointerEvent) => {
    const box = svgRef.current!.getBoundingClientRect()
    const px = ((e.clientX - box.left) / box.width) * WIDTH
    const py = ((e.clientY - box.top) / box.height) * HEIGHT
    onChange(positionAtMoonAngle(Math.atan2(EARTH.y - py, px - EARTH.x)))
  }
  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragging.current = true
    moveTo(e)
  }
  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (dragging.current) moveTo(e)
  }
  const onPointerUp = () => {
    dragging.current = false
  }
  const onKeyDown = (e: KeyboardEvent) => {
    const delta = { ArrowRight: KEY_STEP, ArrowUp: KEY_STEP, ArrowLeft: -KEY_STEP, ArrowDown: -KEY_STEP }[e.key]
    if (delta === undefined) return
    e.preventDefault()
    onChange((((position + delta) % 12) + 12) % 12)
  }

  const phaseMark = (a: number, text: string, dx: number, dy: number, anchor: 'start' | 'middle' | 'end') => {
    const px = EARTH.x + ORBIT_R * Math.cos(a)
    const py = EARTH.y - ORBIT_R * Math.sin(a)
    return (
      <g key={text}>
        <circle cx={px} cy={py} r={2} className="orbit-mark" />
        <text x={px + dx} y={py + dy} className="orbit-label" textAnchor={anchor}>
          {text}
        </text>
      </g>
    )
  }

  return (
    <div className="orbit-control">
      <figure className="orbit">
        <div className="orbit-stage">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            aria-label="The Moon's orbit around Earth, seen from above, with sunlight from the left. Drag the Moon to move it."
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {/* Sunlight from the left. */}
            {[-40, 0, 40].map((dy) => (
              <line key={dy} x1={8} y1={EARTH.y + dy} x2={34} y2={EARTH.y + dy} className="sunlight" markerEnd="url(#arrow)" />
            ))}
            <text x={8} y={EARTH.y - 52} className="orbit-label">
              Sunlight
            </text>
            <defs>
              <marker id="arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" className="sunlight-head" />
              </marker>
            </defs>

            <circle cx={EARTH.x} cy={EARTH.y} r={ORBIT_R} className="orbit-path" />
            <line x1={EARTH.x} y1={EARTH.y} x2={x} y2={y} className="orbit-ray" />
            <circle cx={EARTH.x} cy={EARTH.y} r={EARTH.r} className="orbit-earth" />
            <text x={EARTH.x} y={EARTH.y + EARTH.r + 12} className="orbit-label" textAnchor="middle">
              Earth
            </text>

            {phaseMark(Math.PI, 'New', -6, 14, 'end')}
            {phaseMark((3 * Math.PI) / 2, 'First quarter', 0, 16, 'middle')}
            {phaseMark(0, 'Full', 6, 14, 'start')}
            {phaseMark(Math.PI / 2, 'Last quarter', 0, -8, 'middle')}

            <g
              className="orbit-handle"
              tabIndex={0}
              role="slider"
              aria-label="The Moon's position around Earth"
              aria-valuemin={0}
              aria-valuemax={12}
              aria-valuenow={Math.round(position * 100) / 100}
              aria-valuetext={describe(position)}
              onKeyDown={onKeyDown}
            >
              <circle cx={x} cy={y} r={MOON_R} className="orbit-planet" />
              <circle cx={x} cy={y} r={3} className="pole" />
              <circle cx={marker.x} cy={marker.y} r={3} className="marker" />
            </g>
          </svg>
        </div>
        <div className="orbit-player">
          <PlayButton playing={playing} onToggle={onTogglePlay} />
          <span>{describe(position)}</span>
        </div>
        <figcaption>
          Seen from above, not to scale. <Swatch className="pole" /> North pole, facing you.{' '}
          <Swatch className="marker" /> The spot at 0° on the globe: it always faces Earth. Drag the Moon to move it.
        </figcaption>
      </figure>
    </div>
  )
}
