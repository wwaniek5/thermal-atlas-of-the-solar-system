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
  /** An orbit diagram under the globe that is also the time control. */
  orbitDiagram?: 'mercury' | 'moon'
  /** Where the slider starts, 0..12; the first step if unset. */
  startPosition?: number
  /** A few short paragraphs explaining what the map shows. */
  about?: string[]
  /** Temperatures don't change over time: no slider or playback, and this heading. */
  staticTitle?: string
  /**
   * Scales the zoom detail budget (grid points contoured for what's on
   * screen). Below 1 for noisy data, whose isotherms have many more points
   * per grid point.
   */
  detailScale?: number
  /**
   * Latitudes north of this were never measured: covered in gray on the
   * globe, with no temperatures. The data holds the last measured value
   * flat beyond it, so no isotherms are drawn there.
   */
  unmeasuredNorthOf?: number
}

/** In order from the Sun. */
export const BODIES: Body[] = [
  {
    id: 'mercury',
    name: 'Mercury',
    source: 'mercury',
    quantity: 'Surface temperature (thermal model)',
    calendar: 'mercury',
    orbitDiagram: 'mercury',
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
  {
    id: 'venus',
    name: 'Venus',
    source: 'venus',
    quantity: 'Surface temperature (from altitude)',
    staticTitle: 'Always about the same',
    // Ishtar Terra with Maxwell Montes, and Aphrodite Terra.
    view: { rotation: [-45, -30], zoom: 1 },
    // Radar relief is noisy: about 4x the isotherm points per grid point of
    // Earth's temperatures, so contour a quarter as many grid points.
    detailScale: 0.25,
    // Coldest on Maxwell Montes (~386 °C), average 463 °C, lowest plains ~483 °C.
    colors: [385, 463, 485],
    features: [
      { name: 'Maxwell Montes', lonLat: [3.3, 65.2] },
      { name: 'Ishtar Terra', lonLat: [27.5, 70.4] },
      { name: 'Aphrodite Terra', lonLat: [104.8, -5.8] },
      { name: 'Beta Regio', lonLat: [-77.2, 25.3] },
      { name: 'Atla Regio', lonLat: [-160.4, 9.2] },
      { name: 'Atalanta Planitia', lonLat: [165.8, 45.8] },
    ],
    // Checked against the data: mean 463 °C, coldest on Maxwell Montes.
    about: [
      'Venus has a thick carbon dioxide atmosphere, about 92 times the pressure on Earth. It spreads heat so well that day and night, equator and poles are all at nearly the same temperature, and there are almost no seasons.',
      'What changes the temperature is height: it drops about 8 °C for every kilometre up, like on Earth\'s mountains. So the isotherms trace the relief: from about 480 °C in the lowest plains to about 385 °C on top of Maxwell Montes, 11 km high.',
    ],
  },
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
  {
    id: 'moon',
    name: 'Moon',
    parent: 'earth',
    source: 'moon',
    quantity: 'Surface temperature (thermal model)',
    calendar: 'moon',
    orbitDiagram: 'moon',
    // Last quarter: the Moon is at the top of the orbit diagram, in view on
    // phones, and sunset runs down the middle of the near side.
    startPosition: 9,
    // Centred between the near side's middle (0°) and the noon spot (90°E), level with the equator.
    view: { rotation: [-45, 0], zoom: 1 },
    // About −200 to +120 °C.
    stepOptions: { C: [10, 20, 50], F: [20, 50, 100] },
    stepIndex: 0,
    colors: [-190, -40, 120],
    features: [
      { name: 'North pole', lonLat: [0, 90], symbol: 'pole' },
      { name: 'South pole', lonLat: [0, -90], symbol: 'pole-south' },
      { name: '0° faces Earth', lonLat: [0, 0], symbol: 'marker' },
      { name: 'Mare Imbrium', lonLat: [-15.6, 32.8] },
      { name: 'Mare Serenitatis', lonLat: [17.5, 28] },
      { name: 'Mare Tranquillitatis', lonLat: [31.4, 8.5] },
      { name: 'Mare Crisium', lonLat: [59.1, 17] },
      { name: 'Oceanus Procellarum', lonLat: [-57.4, 18.4] },
      { name: 'Tycho', lonLat: [-11.2, -43.3] },
    ],
    // Checked against the model and Diviner: equator ~112 °C at noon, ~−175 °C before dawn.
    about: [
      'Like Mercury, the Moon has no atmosphere, so each spot\'s temperature depends only on its sunlight: about 112 °C at noon on the equator.',
      'The Moon always shows the same face to Earth, but it still turns relative to the Sun: a lunar day, from one new moon to the next, lasts 29.5 Earth days. Each spot has about 15 days of sunshine, then 15 days of night.',
      'The night side is not uniform: rocks and dust slowly release the heat they stored during the day. It is about −150 °C just after sunset and −175 °C just before dawn.',
    ],
  },
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
  {
    id: 'jupiter',
    name: 'Jupiter',
    source: 'jupiter',
    quantity: 'Temperature high in the atmosphere (infrared, VLT telescope)',
    staticTitle: '24–27 May 2018',
    // The Great Red Spot, with both equatorial belts.
    view: { rotation: [150, 10], zoom: 1 },
    // About −160 to −147 °C (113-126 K): 2 °C lines would be only a handful.
    stepOptions: { C: [1, 2, 5], F: [2, 5, 10] },
    stepIndex: 0,
    colors: [-160, -154, -147],
    features: [
      { name: 'Great Red Spot', lonLat: [-157, -20] },
      { name: 'North Equatorial Belt', lonLat: [-110, 15] },
      { name: 'Equatorial Zone', lonLat: [-120, 1] },
      { name: 'South Equatorial Belt', lonLat: [-110, -15] },
    ],
    // Checked against the data: belts ~122-123 K, equator ~118 K, 80° ~114 K.
    about: [
      'Jupiter has no surface. This is the temperature of the air high in its atmosphere, just above the clouds, where the pressure is a few tenths of Earth\'s. A telescope in Chile measured the infrared light this air gives off over four nights in May 2018.',
      'The stripes are belts and zones. In the dark belts air sinks and warms, and in the pale zones it rises and cools, so the belts are a few degrees warmer. The Great Red Spot is a giant storm, colder than its surroundings.',
      'There are almost no seasons (the axis is tilted only 3°), and Jupiter\'s own inner heat evens out the temperature, so the equator is barely warmer than the mid-latitudes. The polar regions are colder. The telescope can\'t see well beyond about 78°, so there the map just continues the last measured values.',
    ],
  },
  {
    id: 'saturn',
    name: 'Saturn',
    source: 'saturn',
    quantity: 'Temperature at 100 mbar (Cassini spacecraft)',
    calendar: 'saturn',
    startPosition: 0,
    // Level with the equator: both poles on the rim, for the pole-to-pole seasonal swing.
    view: { rotation: [0, 0], zoom: 1 },
    // About −194 to −173 °C (79-100 K).
    stepOptions: { C: [1, 2, 5], F: [2, 5, 10] },
    stepIndex: 0,
    colors: [-194, -185, -173],
    features: [
      { name: 'North pole', lonLat: [0, 90], symbol: 'pole' },
      { name: 'South pole', lonLat: [0, -90], symbol: 'pole-south' },
    ],
    // Checked against the data: south pole 100 K in 2007, 94 K in mid-2011
    // (north 87 K); north pole 94 K and south 84 K in 2017.
    about: [
      'Saturn has no surface. This is the temperature near the top of its lower atmosphere, where the pressure is a tenth of Earth\'s, measured by the Cassini spacecraft from orbit.',
      'Saturn is tilted 27°, a bit more than Earth, but its year lasts 29.5 Earth years, so each season lasts about 7. In 2007 it was late summer in the south, and the south pole was the warmest place. After the equinox in August 2009 the north slowly warmed and the south cooled. The temperatures lag behind the Sun: two years after the equinox the south was still warmer. By 2017, close to northern midsummer, the warm pole was in the north.',
      'Day and night make no difference: a day is under 11 hours, and this air takes years to warm up or cool down. Cassini\'s measurements were averaged around each latitude, so the map shows bands only, without storms or the hexagon at the north pole.',
    ],
  },
  {
    id: 'uranus',
    name: 'Uranus',
    source: 'uranus',
    quantity: 'Temperature at 100 mbar (Voyager 2)',
    staticTitle: 'January 1986',
    // Level with the equator: the warm equator and both warm poles.
    view: { rotation: [0, 0], zoom: 1 },
    // About −222.2 to −219.4 °C (51-54 K): the whole range is under 3 °C.
    stepOptions: { C: [0.5, 1, 2], F: [1, 2, 5] },
    stepIndex: 0,
    colors: [-222.2, -221.2, -219.4],
    features: [
      { name: 'North pole', lonLat: [0, 90], symbol: 'pole' },
      { name: 'South pole', lonLat: [0, -90], symbol: 'pole-south' },
    ],
    // Checked against the data: equator 53.4 K, 30° 51.2 K, 70° 52.4 K.
    about: [
      'Uranus has no surface. This is the temperature near the top of its lower atmosphere, where the pressure is a tenth of Earth\'s, measured by Voyager 2 when it flew past in January 1986. It is the coldest planet: about −221 °C here.',
      'Uranus is tipped on its side (98°), so each pole gets about 42 years of sunlight and then 42 years of darkness. In 1986 the south pole pointed almost at the Sun. Yet the temperatures have barely changed: telescope images from 2018, in northern spring, match Voyager\'s to within 0.3 °C at most latitudes.',
      'The equator is about 2 °C warmer than the mid-latitudes, and the poles about 1 °C. Air is thought to rise and cool at mid-latitudes and to sink and warm over the equator and poles. Voyager\'s measurements were averaged around each latitude, so the map shows bands only.',
    ],
  },
  {
    id: 'neptune',
    name: 'Neptune',
    source: 'neptune',
    quantity: 'Temperature at 100 mbar (Voyager 2)',
    staticTitle: 'August 1989',
    // The measured southern hemisphere, with the gray cap on the northern rim.
    view: { rotation: [0, 10], zoom: 1 },
    // About −221.6 to −216.4 °C (51.6-56.8 K).
    stepOptions: { C: [0.5, 1, 2], F: [1, 2, 5] },
    stepIndex: 0,
    colors: [-221.6, -219, -216.4],
    // Matches UNMEASURED_NORTH_OF in scripts/data/sources/neptune.py.
    unmeasuredNorthOf: 44,
    features: [
      { name: 'Not measured', lonLat: [0, 52] },
      { name: 'North pole', lonLat: [0, 90], symbol: 'pole' },
      { name: 'South pole', lonLat: [0, -90], symbol: 'pole-south' },
    ],
    // Checked against the data: equator 56.8 K, 45-50°S 51.6 K, south pole 56.2 K.
    about: [
      'Neptune has no surface. This is the temperature near the top of its lower atmosphere, where the pressure is a tenth of Earth\'s, measured by Voyager 2, the only spacecraft to visit, when it flew past in August 1989.',
      'As on Uranus, the equator is the warmest, the mid-latitudes are about 5 °C colder, and it warms again towards the south pole. It was southern summer: the far north was in the long polar night and out of Voyager\'s view, so it is shown gray.',
      'Each season on Neptune lasts about 40 years. Telescope images from 2003-2007 show the same pattern at low and middle latitudes, while around the south pole it had warmed by 5-6 °C. Voyager\'s measurements were averaged around each latitude, so the map shows bands only.',
    ],
  },
]

export const DEFAULT_BODY = 'earth'
