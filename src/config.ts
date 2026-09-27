import type { Units } from './map/scale'
import type { View } from './map/view'

/**
 * Which folder under public/data/ to read, as produced by
 * scripts/data/prepare_data.py:
 *   'noaa' - NCEP/NCAR Reanalysis 1, ~1.9° (format 1)
 *   'era5' - ERA5, 0.25° resolution pyramid; the globe view uses its 1° level (format 2)
 */
/** Shown on the home page's tab, in search results and in link previews (also in index.html). */
export const SITE_NAME = 'Thermal Atlas of the Solar System'

export const DATA_SOURCE: 'noaa' | 'era5' = 'era5'

export const DEFAULT_UNITS: Units = 'C'

/** Index into STEP_OPTIONS (fine to coarse): 0 = 2 °C / 5 °F. */
export const DEFAULT_STEP_INDEX = 0

/** 1 = January ... 12 = December. */
export const DEFAULT_MONTH = 1

/** Playback speed: a full year takes 12 / this many seconds. */
export const PLAY_MONTHS_PER_SECOND = 1

/** Where the globe starts: centered on 10°E 25°N, whole globe in view. */
export const DEFAULT_VIEW: View = { rotation: [-10, -25], zoom: 1 }

/**
 * Most grid points to contour for the zoomed-in detail layer. The finest
 * zoom level that fits is used, so frames cost about the same at any zoom.
 * Smaller while playing, to keep the animation smooth.
 */
export const DETAIL_POINTS_STILL = 60_000
export const DETAIL_POINTS_PLAYING = 15_000
