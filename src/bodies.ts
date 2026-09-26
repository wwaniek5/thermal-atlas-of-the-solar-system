import { DATA_SOURCE } from './config'

export interface Body {
  id: string
  name: string
  /** Moons are listed under their planet. */
  parent?: string
  /** Folder under public/data/ with this body's temperatures; unset until added. */
  source?: string
}

/** In order from the Sun. */
export const BODIES: Body[] = [
  { id: 'mercury', name: 'Mercury' },
  { id: 'venus', name: 'Venus' },
  { id: 'earth', name: 'Earth', source: DATA_SOURCE },
  { id: 'moon', name: 'Moon', parent: 'earth' },
  { id: 'mars', name: 'Mars' },
  { id: 'jupiter', name: 'Jupiter' },
  { id: 'saturn', name: 'Saturn' },
  { id: 'uranus', name: 'Uranus' },
  { id: 'neptune', name: 'Neptune' },
]

export const DEFAULT_BODY = 'earth'
