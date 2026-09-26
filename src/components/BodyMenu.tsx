import type { Body } from '../bodies'
import { pathFor } from '../routing'

interface Props {
  bodies: Body[]
  selected: string
  onSelect: (id: string) => void
}

/** Planets and moons as links to their pages; ones without data yet are shown but not linked. */
export function BodyMenu({ bodies, selected, onSelect }: Props) {
  return (
    <nav className="body-menu" aria-label="Planets and moons">
      <ul>
        {bodies.map((body) => {
          const available = Boolean(body.source)
          return (
            <li key={body.id} className={body.parent ? 'moon' : undefined}>
              {available ? (
                <a
                  href={pathFor(body.id)}
                  aria-current={body.id === selected ? 'page' : undefined}
                  onClick={(e) => {
                    // Plain clicks switch in place; modified clicks (new tab, ...) follow the link.
                    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
                    e.preventDefault()
                    onSelect(body.id)
                  }}
                >
                  {body.name}
                </a>
              ) : (
                <span className="unavailable" title="Coming soon">
                  {body.name}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
