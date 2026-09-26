import { DATA_SOURCE } from './config'
import type { CalendarId } from './months'
import type { ColorRange } from './map/colors'
import type { View } from './map/view'

/** A named place drawn on the globe: [longitude east, latitude], degrees. */
export interface Feature {
  name: string
  lonLat: [number, number]
}

export interface Body {
  id: string
  name: string
  /** Moons are listed under their planet. */
  parent?: string
  /** Folder under public/data/ with this body's temperatures; unset until added. */
  source?: string
  /** What the temperatures are, shown under the heading. */
  quantity?: string
  calendar?: CalendarId
  /** Where the globe starts. */
  view?: View
  /** Default isotherm spacing: index into STEP_OPTIONS (0 = finest). */
  stepIndex?: number
  /** °C for [darkest blue, neutral gray, darkest red]; Earth's range if unset. */
  colors?: ColorRange
  /**
   * What's drawn under the isotherms: Earth's coastlines and borders, or
   * contour lines of the source's terrain at these elevations (metres).
   */
  terrainLevels?: number[]
  features?: Feature[]
}

/** In order from the Sun. */
export const BODIES: Body[] = [
  { id: 'mercury', name: 'Mercury' },
  { id: 'venus', name: 'Venus' },
  {
    id: 'earth',
    name: 'Earth',
    source: DATA_SOURCE,
    quantity: 'Average surface air temperature',
    calendar: 'earth',
    view: { rotation: [-10, -25], zoom: 1 },
    stepIndex: 0,
  },
  { id: 'moon', name: 'Moon', parent: 'earth' },
  {
    id: 'mars',
    name: 'Mars',
    source: 'mars',
    quantity: 'Average surface temperature, day and night',
    calendar: 'mars',
    // Tharsis and Valles Marineris.
    view: { rotation: [90, -10], zoom: 1 },
    // Mars's months span about −131 to −14 °C, averaging about −65 °C.
    colors: [-130, -70, -15],
    terrainLevels: [-4000, 0, 4000, 10000],
    features: [
      { name: 'Olympus Mons', lonLat: [-133.8, 18.7] },
      { name: 'Tharsis Montes', lonLat: [-112, 1] },
      { name: 'Valles Marineris', lonLat: [-59.2, -13.9] },
      { name: 'Argyre Planitia', lonLat: [-43, -49.7] },
      { name: 'Acidalia Planitia', lonLat: [-22, 46.7] },
      { name: 'Arabia Terra', lonLat: [5.4, 21.3] },
      { name: 'Syrtis Major', lonLat: [69.5, 8.4] },
      { name: 'Hellas Planitia', lonLat: [70.5, -42.4] },
      { name: 'Utopia Planitia', lonLat: [117.5, 46.7] },
      { name: 'Elysium Mons', lonLat: [146.9, 25] },
      { name: 'Planum Boreum', lonLat: [0, 87] },
      { name: 'Planum Australe', lonLat: [160, -84] },
    ],
  },
  { id: 'jupiter', name: 'Jupiter' },
  { id: 'saturn', name: 'Saturn' },
  { id: 'uranus', name: 'Uranus' },
  { id: 'neptune', name: 'Neptune' },
]

export const DEFAULT_BODY = 'earth'
