import { bandFill, FREEZING, type TemperatureScale } from '../map/scale'

interface Props {
  scale: TemperatureScale
}

/**
 * One swatch per band, as wide as its temperature range. Isotherms are
 * labeled at regular intervals, plus the freezing line.
 */
export function Legend({ scale }: Props) {
  const { bands, thresholds, units, step } = scale
  if (bands.length === 0) return null
  const lo = bands[0].lower
  const span = bands[bands.length - 1].upper - lo
  const at = (v: number) => `${((v - lo) / span) * 100}%`

  // Aim for about ten labels, on multiples of the step.
  const every = step * Math.max(1, Math.ceil(thresholds.length / 10))
  const freezing = FREEZING[units]
  const labeled = thresholds.filter((t) => t % every === 0 && Math.abs(t - freezing) > every / 2)
  labeled.push(freezing)

  return (
    <figure className="legend" aria-label={`Temperature color scale in degrees ${units === 'C' ? 'Celsius' : 'Fahrenheit'}`}>
      <div className="legend-bar">
        {bands.map((b) => (
          <span
            key={b.lower}
            className="legend-swatch"
            style={{ flexGrow: b.upper - b.lower, background: bandFill(b, units) }}
            title={`${b.lower} to ${b.upper} °${units}`}
          />
        ))}
      </div>
      <div className="legend-ticks">
        {thresholds
          .filter((t) => labeled.includes(t))
          .map((t) => (
            <span key={t} style={{ left: at(t) }} className={t === freezing ? 'legend-freezing' : undefined}>
              {t}
            </span>
          ))}
      </div>
      <figcaption>°{units}</figcaption>
    </figure>
  )
}
