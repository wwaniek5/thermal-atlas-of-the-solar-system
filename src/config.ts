import type { Units } from './map/scale'

/**
 * Which folder under public/data/ to read, as produced by
 * scripts/data/prepare_data.py:
 *   'noaa' - NCEP/NCAR Reanalysis 1, ~1.9° (format 1)
 *   'era5' - ERA5, 0.25° resolution pyramid; the globe view uses its 1° level (format 2)
 */
export const DATA_SOURCE: 'noaa' | 'era5' = 'era5'

export const DEFAULT_UNITS: Units = 'C'

/** Index into STEP_OPTIONS: 0 fine, 1 default, 2 coarse. */
export const DEFAULT_STEP_INDEX = 1

/** 1 = January ... 12 = December. */
export const DEFAULT_MONTH = 1

/** Playback speed: a full year takes 12 / this many seconds. */
export const PLAY_MONTHS_PER_SECOND = 1
