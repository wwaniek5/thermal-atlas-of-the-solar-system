import { useEffect, useMemo, useReducer } from 'react'
import { makeProjection, pickLevel, visibleBounds, type View } from '../map/view'
import type { Grid, PyramidManifest } from './grid'
import { regionFor, regionGrid, TileStore, tilesFor } from './tiles'

/**
 * The detailed grid for what's on screen, cut from zoom tiles, or null when
 * the whole-globe grid should be used: format 1 source, zoomed out, a pole in
 * view, or tiles still loading (then `loading` is true).
 */
export function useRegion(
  source: string,
  pyramid: PyramidManifest | null,
  view: View,
  position: number,
  /** Most grid points to contour for what's on screen (see DETAIL_POINTS_* in config). */
  budget: number,
): { grid: Grid | null; loading: boolean } {
  // Bumped as tiles arrive, so the region is rebuilt with them.
  const [tilesLoaded, onTileLoad] = useReducer((n: number) => n + 1, 0)
  const store = useMemo(() => (pyramid ? new TileStore(source, pyramid, onTileLoad) : null), [source, pyramid])

  const target = useMemo(() => {
    if (!pyramid) return null
    const bounds = visibleBounds(makeProjection(view))
    if (!bounds) return null
    const level = pickLevel(pyramid.levels, bounds, budget)
    if (level === null) return null
    return { level, region: regionFor(pyramid.levels[level], bounds) }
  }, [pyramid, view, budget])

  useEffect(() => {
    if (store && pyramid && target) store.request(tilesFor(pyramid, target.level, target.region))
  }, [store, pyramid, target])

  const grid = useMemo(
    () => (store && pyramid && target ? regionGrid(store, pyramid, target.level, target.region, position) : null),
    // tilesLoaded isn't read, but the store's contents change with it: rebuild once missing tiles arrive.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [store, pyramid, target, position, tilesLoaded],
  )
  return { grid, loading: target !== null && grid === null }
}
