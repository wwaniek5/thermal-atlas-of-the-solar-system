interface Props {
  playing: boolean
  onToggle: () => void
}

export function PlayButton({ playing, onToggle }: Props) {
  return (
    <button
      type="button"
      className="play"
      onClick={onToggle}
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
  )
}
