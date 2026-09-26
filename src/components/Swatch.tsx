/** A diagram's symbol, inline in its caption. */
export function Swatch({ className }: { className: string }) {
  return (
    <svg className="swatch" viewBox="-5 -5 10 10" aria-hidden="true">
      <circle r={3.5} className={className} />
    </svg>
  )
}
