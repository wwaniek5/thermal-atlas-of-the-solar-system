import { DATA_SOURCE } from './config'
import type { CalendarId } from './months'
import type { ColorRange } from './map/colors'
import type { Units } from './map/scale'
import type { View } from './map/view'

/** A named place drawn on the globe: [longitude east, latitude], degrees. */
export interface Feature {
  name: string
  lonLat: [number, number]
  /** Drawn with a symbol (the orbit diagram uses the same ones); shown right up to the rim. */
  symbol?: 'marker' | 'pole' | 'pole-south'
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
  /** How the slider is labelled; Earth's months if unset. */
  calendar?: CalendarId
  /** Where the globe starts. */
  view?: View
  /** Isotherm spacing choices, fine to coarse; STEP_OPTIONS if unset. */
  stepOptions?: Record<Units, number[]>
  /** Default spacing: index into the spacing choices (0 = finest). */
  stepIndex?: number
  /** °C for [darkest blue, neutral gray, darkest red]; Earth's range if unset. */
  colors?: ColorRange
  /** Draw Earth's coastlines and borders. */
  coastlines?: boolean
  /** Otherwise: contour lines of the source's terrain at these elevations (metres), if it has terrain. */
  terrainLevels?: number[]
  features?: Feature[]
  /** Show Mercury's orbit seen from above under the globe. */
  orbitDiagram?: boolean
  /** A few short paragraphs explaining what the map shows. */
  about?: string[]
}

/** In order from the Sun. */
export const BODIES: Body[] = [
  {
    id: 'mercury',
    name: 'Mercury',
    source: 'mercury',
    quantity: 'Surface temperature (thermal model)',
    calendar: 'mercury',
    orbitDiagram: true,
    // Checked against the model: equator, night side, day 0.
    about: [
      'Mercury has no real atmosphere, only an extremely thin exosphere, so no air or wind moves heat around. Each spot\'s temperature depends only on its sunlight.',
      'Its day is very long: from one sunrise to the next takes 176 Earth days, two of its years. A spot gets about 88 days of sunshine, then 88 days of night.',
      'You can see that the cold side is not uniform: there is some lag, caused by rocks and dust slowly releasing the heat they stored during the day. It is about −155 °C just after sunset and −175 °C just before dawn.',
    ],
    // Day, night and the terminator in view, the 0° marker well inside the
    // disc, and level with the equator so both poles sit on the rim.
    view: { rotation: [45, 0], zoom: 1 },
    // About −205 to +425 °C: 2° lines would be hundreds of isotherms.
    stepOptions: { C: [10, 20, 50], F: [20, 50, 100] },
    stepIndex: 1,
    colors: [-200, 110, 420],
    features: [
      // Both symbols also appear in the orbit diagram.
      { name: 'North pole', lonLat: [0, 90], symbol: 'pole' },
      { name: 'South pole', lonLat: [0, -90], symbol: 'pole-south' },
      { name: '0°', lonLat: [0, 0], symbol: 'marker' },
    ],
  },
  { id: 'venus', name: 'Venus' },
  {
    id: 'earth',
    name: 'Earth',
    source: DATA_SOURCE,
    quantity: 'Average surface air temperature',
    calendar: 'earth',
    coastlines: true,
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
