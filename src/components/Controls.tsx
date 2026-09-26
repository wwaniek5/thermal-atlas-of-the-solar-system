import type { Units } from '../map/scale'

interface Props {
  units: Units
  step: number
  /** Spacing choices in the current units, fine to coarse. */
  stepOptions: number[]
  onUnitsChange: (units: Units) => void
  onStepChange: (step: number) => void
}

export function Controls({ units, step, stepOptions, onUnitsChange, onStepChange }: Props) {
  return (
    <div className="controls">
      <Segmented
        label="Units"
        options={(['C', 'F'] as const).map((u) => ({ value: u, text: `°${u}` }))}
        value={units}
        onChange={onUnitsChange}
      />
      <Segmented
        label="Line every"
        options={stepOptions.map((s) => ({ value: s, text: `${s}°` }))}
        value={step}
        onChange={onStepChange}
      />
    </div>
  )
}

interface SegmentedProps<T> {
  label: string
  options: { value: T; text: string }[]
  value: T
  onChange: (value: T) => void
}

function Segmented<T extends string | number>({ label, options, value, onChange }: SegmentedProps<T>) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      <span className="segmented-label">{label}</span>
      <div className="segmented-buttons">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
          >
            {o.text}
          </button>
        ))}
      </div>
    </div>
  )
}
