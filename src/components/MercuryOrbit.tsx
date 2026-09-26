import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { dayAt, ECCENTRICITY, facingAngle, orbitPosition, positionAtAnomaly, SEMI_MAJOR_AU } from '../mercury'
import { PlayButton } from './PlayButton'
import { Swatch } from './Swatch'

interface Props {
  /** 0..12 through one solar day (two orbits). */
  position: number
  /** Screen-reader text for a position, e.g. "Year 1 · aphelion". */
  describe: (position: number) => string
  onChange: (position: number) => void
  playing: boolean
  onTogglePlay: () => void
}

/** Arrow keys move Mercury by this much of the 12 steps. */
const KEY_STEP = 0.25

const WIDTH = 320
/** Room above and below the orbit for the label when Mercury is at the top or bottom. */
const HEIGHT = 190
/** Pixels per AU: the orbit (0.31-0.47 AU) fills the height. */
const S = 190
/** At a focus, so the orbit is centred horizontally. */
const SUN = { x: WIDTH / 2 + ECCENTRICITY * SEMI_MAJOR_AU * S, y: HEIGHT / 2 }
const PLANET_R = 11

/**
 * Mercury's orbit seen from above (from the north), with the planet where it
 * is at this point of the solar day. Mercury's axis is almost perpendicular
 * to its orbit, so from here its north pole is the middle of the disc.
 *
 * It is also the control for Mercury's time: drag the planet (or click the
 * orbit) to move it, or use the arrow keys on the planet.
 */
export function MercuryOrbit({ position, describe, onChange, playing, onTogglePlay }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const dragging = useRef(false)
  const days = dayAt(position)
  const { trueAnomaly, distance } = orbitPosition(days)
  // Perihelion to the right of the Sun; counter-clockwise, as seen from the north.
  const x = SUN.x + distance * S * Math.cos(trueAnomaly)
  const y = SUN.y - distance * S * Math.sin(trueAnomaly)

  // The marker at 0° longitude on the equator, on the disc's rim.
  const facing = facingAngle(days, 0)
  const marker = { x: x + PLANET_R * Math.cos(facing), y: y - PLANET_R * Math.sin(facing) }

  const a = SEMI_MAJOR_AU * S
  const b = a * Math.sqrt(1 - ECCENTRICITY ** 2)
  const cx = SUN.x - ECCENTRICITY * a // the Sun is at a focus
  const perihelion = SUN.x + SEMI_MAJOR_AU * (1 - ECCENTRICITY) * S
  const aphelion = SUN.x - SEMI_MAJOR_AU * (1 + ECCENTRICITY) * S

  // Pointer -> angle around the Sun -> time.
  const moveTo = (e: PointerEvent) => {
    const box = svgRef.current!.getBoundingClientRect()
    const px = ((e.clientX - box.left) / box.width) * WIDTH
    const py = ((e.clientY - box.top) / box.height) * HEIGHT
    onChange(positionAtAnomaly(Math.atan2(SUN.y - py, px - SUN.x), position))
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

  return (
    <div className="orbit-control">
      <figure className="orbit">
        <div className="orbit-stage">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            aria-label={`Mercury's orbit seen from above its north pole: ${distance.toFixed(2)} AU from the Sun. Drag Mercury to move it.`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <ellipse cx={cx} cy={SUN.y} rx={a} ry={b} className="orbit-path" />
            <line x1={SUN.x} y1={SUN.y} x2={x} y2={y} className="orbit-ray" />

            <circle cx={SUN.x} cy={SUN.y} r={16} className="orbit-sun-glow" />
            <circle cx={SUN.x} cy={SUN.y} r={10} className="orbit-sun" />
            <text x={SUN.x} y={SUN.y + 26} className="orbit-label" textAnchor="middle">
              Sun
            </text>

            <circle cx={perihelion} cy={SUN.y} r={2} className="orbit-mark" />
            {/* Just below and outside the marks, clear of the planet and its label. */}
            <text x={perihelion + 3} y={SUN.y + PLANET_R + 11} className="orbit-label" textAnchor="start">
              Perihelion
            </text>
            <circle cx={aphelion} cy={SUN.y} r={2} className="orbit-mark" />
            <text x={aphelion - 3} y={SUN.y + PLANET_R + 11} className="orbit-label" textAnchor="end">
              Aphelion
            </text>

            <g
              className="orbit-handle"
              tabIndex={0}
              role="slider"
              aria-label="Mercury's position in its orbit"
              aria-valuemin={0}
              aria-valuemax={12}
              aria-valuenow={Math.round(position * 100) / 100}
              aria-valuetext={describe(position)}
              onKeyDown={onKeyDown}
            >
              <circle cx={x} cy={y} r={PLANET_R} className="orbit-planet" />
              <circle cx={x} cy={y} r={3.5} className="pole" />
              <circle cx={marker.x} cy={marker.y} r={3.5} className="marker" />
            </g>
          </svg>
        </div>
        {/* Player bar: play/pause and where Mercury is. */}
        <div className="orbit-player">
          <PlayButton playing={playing} onToggle={onTogglePlay} />
          <span>{describe(position)}</span>
        </div>
        <figcaption>
          Seen from above, {distance.toFixed(2)} AU from the Sun.{' '}
          <Swatch className="pole" /> North pole, facing you. <Swatch className="marker" /> The spot at 0° on
          the globe: it turns with Mercury, 3 turns for every 2 orbits. Drag Mercury to move it.
        </figcaption>
      </figure>
    </div>
  )
}
