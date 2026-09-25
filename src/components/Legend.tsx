import { bandColor } from '../map/colors'

interface Props {
  thresholds: number[]
  step: number
}

/** One swatch per band, labeled at every other isotherm. */
export function Legend({ thresholds, step }: Props) {
  if (thresholds.length === 0) return null
  const bands = [thresholds[0] - step, ...thresholds]
  const labelEvery = Math.max(1, Math.ceil(thresholds.length / 10))

  return (
    <figure className="legend" aria-label="Temperature color scale in degrees Celsius">
      <div className="legend-bar">
        {bands.map((lower) => (
          <span
            key={lower}
            className="legend-swatch"
            style={{ background: bandColor(lower, step) }}
            title={`${lower} to ${lower + step} °C`}
          />
        ))}
      </div>
      <div className="legend-ticks" style={{ gridTemplateColumns: `repeat(${bands.length}, 1fr)` }}>
        {bands.map((lower, i) => (
          <span key={lower}>{i > 0 && (i - 1) % labelEvery === 0 ? lower : ''}</span>
        ))}
      </div>
      <figcaption>°C</figcaption>
    </figure>
  )
}
