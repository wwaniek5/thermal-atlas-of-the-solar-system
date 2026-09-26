import type { Calendar } from '../months'

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
      <button
        type="button"
        className="play"
        onClick={onTogglePlay}
        aria-label={playing ? 'Pause' : 'Play through the year'}
        title={playing ? 'Pause' : 'Play'}
      >
        {playing ? (
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <rect x="3" y="2" width="3.5" height="12" rx="1" />
            <rect x="9.5" y="2" width="3.5" height="12" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 2.5v11a1 1 0 0 0 1.5.86l9-5.5a1 1 0 0 0 0-1.72l-9-5.5A1 1 0 0 0 4 2.5z" />
          </svg>
        )}
      </button>
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
        <div className="ticks" aria-hidden="true">
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
