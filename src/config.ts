import type { Units } from './map/scale'

/** Which folder under public/data/ to read. Each source is produced by
 * scripts/data/prepare_data.py and shares the same format. */
export const DATA_SOURCE = 'noaa'

export const DEFAULT_UNITS: Units = 'C'

/** Index into STEP_OPTIONS: 0 fine, 1 default, 2 coarse. */
export const DEFAULT_STEP_INDEX = 1

/** 1 = January ... 12 = December. */
export const DEFAULT_MONTH = 1

/** Playback speed: a full year takes 12 / this many seconds. */
export const PLAY_MONTHS_PER_SECOND = 1
