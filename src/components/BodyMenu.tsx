import type { Body } from '../bodies'
import { pathFor } from '../routing'

interface Props {
  bodies: Body[]
  selected: string
  onSelect: (id: string) => void
}

/**
 * Planets as links to their pages, each with its moons in a nested list
 * (indented on wide screens, joined into the planet's chip on narrow ones).
 * Bodies without data yet are shown but not linked.
 */
export function BodyMenu({ bodies, selected, onSelect }: Props) {
  const item = (body: Body) =>
    body.source ? (
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
    )

  return (
    <nav className="body-menu" aria-label="Planets and moons">
      <ul>
        {bodies
          .filter((body) => !body.parent)
          .map((planet) => {
            const moons = bodies.filter((body) => body.parent === planet.id)
            return (
              <li key={planet.id} className={moons.length > 0 ? 'has-moons' : undefined}>
                {item(planet)}
                {moons.length > 0 && (
                  <ul className="moons" aria-label={`Moons of ${planet.name}`}>
                    {moons.map((moon) => (
                      <li key={moon.id} className="moon">
                        {item(moon)}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
      </ul>
    </nav>
  )
}
