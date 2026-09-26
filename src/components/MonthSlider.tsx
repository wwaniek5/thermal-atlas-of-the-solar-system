import type { Calendar } from '../months'
import { PlayButton } from './PlayButton'

interface Props {
  /** 0 = first month ... 12 = first month again; fractions blend between months. */
  position: number
  calendar: Calendar
  playing: boolean
  onChange: (position: number) => void
  onTogglePlay: () => void
}

export function MonthSlider({ position, calendar, playing, onChange, onTogglePlay }: Props) {
  return (
    <div className="month-slider">
      <PlayButton playing={playing} onToggle={onTogglePlay} />
      <div className="track">
        <input
          type="range"
          min={0}
          max={12}
          step={0.01}
          value={position}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="Month"
          aria-valuetext={calendar.describe(position)}
        />
        <div
          className={calendar.ticks.filter(Boolean).length <= 7 ? 'ticks sparse' : 'ticks'}
          aria-hidden="true"
        >
          {calendar.ticks.map((tick, i) => (
            <span key={i} style={{ left: `${(i / 12) * 100}%` }}>
              {tick}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
