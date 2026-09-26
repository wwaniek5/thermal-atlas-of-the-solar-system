"""Multi-resolution tiled output ("format 2") for detailed sources like ERA5.

The app draws the whole globe from a coarse level and, when zoomed in, loads
only the finer tiles in view. Layout:

    public/data/<source>/manifest.json
    public/data/<source>/<version>/L0.bin              level 0: whole globe, untiled
    public/data/<source>/<version>/L1/<row>_<col>.bin  level 1 tiles
    public/data/<source>/<version>/L2/<row>_<col>.bin  level 2 tiles
    ...

(<version> is a content hash; see publish.py.)

Every .bin file holds all the steps through the cycle (`steps` in the
manifest: 12 months, or 1 for a body that doesn't change), so animation works
at any zoom, as little-endian int16 in tenths of a degree Celsius, laid out
[step][row][col], rows north -> south, columns west -> east.

- An untiled level follows the format 1 grid conventions (see grid.py):
  rows 90 -> -90, columns -180 -> <180 without repeating +180.
- A tile covers `span` degrees each way and includes BOTH edges, so it has
  span / res + 1 points per side and shares its edge rows/columns with its
  neighbours; contours then join seamlessly. Tile (row, col) starts at
  lat 90 - row * span, lon -180 + col * span. The easternmost tiles end at
  +180, which repeats -180.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from grid import SCALE, ClimateGrid, uniform_poles
from publish import publish


@dataclass(frozen=True)
class Level:
    res: float  # degrees between grid points
    tile_span: float | None = None  # degrees per tile side; None = one untiled file


def coarsen(grid: ClimateGrid, res: float) -> ClimateGrid:
    """Resample to a coarser regular grid by averaging, not just subsampling.

    Each output point is the mean over a window one output cell wide centered
    on it (trapezoid weights, so points on the window edge count half).
    Longitude wraps; latitude windows are clamped at the poles.
    """
    native = abs(float(grid.lats[1] - grid.lats[0]))
    factor = res / native
    if not np.isclose(factor, round(factor)):
        raise ValueError(f"{res}° is not a whole multiple of the native {native}°")
    factor = int(round(factor))
    if factor == 1:
        return grid

    half = factor // 2
    weights = np.ones(2 * half + 1)
    if factor % 2 == 0:
        weights[0] = weights[-1] = 0.5
    weights /= weights.sum()

    values = grid.celsius
    # Longitude: periodic.
    smoothed = sum(w * np.roll(values, k - half, axis=-1) for k, w in enumerate(weights))
    # Latitude: clamp at the poles.
    padded = np.concatenate([smoothed[:, :1].repeat(half, 1), smoothed, smoothed[:, -1:].repeat(half, 1)], axis=1)
    nlat = smoothed.shape[1]
    smoothed = sum(w * padded[:, k : k + nlat] for k, w in enumerate(weights))

    return ClimateGrid(
        source=grid.source,
        title=grid.title,
        period=grid.period,
        lats=grid.lats[::factor],
        lons=grid.lons[::factor],
        # Averaging blends each pole with its neighbours; keep it one point.
        celsius=uniform_poles(smoothed[:, ::factor, ::factor]),
    )


def even_out_poles(grid: ClimateGrid) -> ClimateGrid:
    """Give every row about the same real-world resolution.

    Longitude columns crowd together towards the poles (at 88°, 30 times
    closer than at the equator), so rows there show far finer noise than the
    rest of the map, and the contours between that ring and the single pole
    value form a star of spokes. Averaging each row along longitude over
    about one equatorial cell's distance (1 / cos(latitude) columns) evens
    this out; at the pole it is the whole-ring mean, as before.
    """
    celsius = grid.celsius.copy()
    nlon = len(grid.lons)
    for row, lat in enumerate(grid.lats):
        cos_lat = np.cos(np.radians(lat))
        width = nlon if cos_lat < 1e-9 else min(nlon, int(round(1 / cos_lat)))
        if width <= 1:
            continue
        # Periodic moving average of `width` columns, centred.
        values = celsius[:, row, :]
        padded = np.concatenate([values[:, -(width // 2) :], values, values[:, : width - width // 2]], axis=-1)
        cumsum = np.cumsum(np.pad(padded, ((0, 0), (1, 0))), axis=-1)
        celsius[:, row, :] = (cumsum[:, width:] - cumsum[:, :-width])[:, :nlon] / width
    return ClimateGrid(grid.source, grid.title, grid.period, grid.lats, grid.lons, uniform_poles(celsius), grid.terrain)


def to_int16(celsius: np.ndarray) -> bytes:
    ints = np.rint(celsius / SCALE)
    assert np.abs(ints).max() < 2**15, "temperature out of int16 range"
    return ints.astype("<i2").tobytes()


def tile(grid: ClimateGrid, span: float, row: int, col: int) -> np.ndarray:
    """Values (12, n, n) of one tile, both edges included, wrapping in longitude."""
    res = abs(float(grid.lats[1] - grid.lats[0]))
    n = int(round(span / res)) + 1
    r0 = row * (n - 1)
    c0 = col * (n - 1)
    cols = (c0 + np.arange(n)) % len(grid.lons)
    return grid.celsius[:, r0 : r0 + n][:, :, cols]


def write_pyramid(
    grid: ClimateGrid, levels: list[Level], out_root: Path, credit: str, even_poles: bool = False
) -> Path:
    grid.validate()

    def write(folder: Path) -> dict:
        manifest_levels = []
        for index, level in enumerate(levels):
            g = coarsen(grid, level.res)
            if even_poles:
                g = even_out_poles(g)
            g.validate()
            name = f"L{index}"
            common = {"res": level.res, "lat0": 90.0, "lon0": -180.0, "nlat": len(g.lats), "nlon": len(g.lons)}
            if level.tile_span is None:
                (folder / f"{name}.bin").write_bytes(to_int16(g.celsius))
                manifest_levels.append({**common, "file": f"{name}.bin"})
                continue

            rows = 180 / level.tile_span
            cols = 360 / level.tile_span
            assert rows.is_integer() and cols.is_integer(), "tile span must divide 180 and 360"
            assert (level.tile_span / level.res).is_integer(), "tile span must be a whole number of points"
            (folder / name).mkdir(exist_ok=True)
            for r in range(int(rows)):
                for c in range(int(cols)):
                    (folder / name / f"{r}_{c}.bin").write_bytes(to_int16(tile(g, level.tile_span, r, c)))
            manifest_levels.append(
                {
                    **common,
                    "tileSpan": level.tile_span,
                    "tilePoints": int(level.tile_span / level.res) + 1,
                    "tileRows": int(rows),
                    "tileCols": int(cols),
                    "tiles": f"{name}/{{row}}_{{col}}.bin",
                }
            )

        manifest = {
            "format": 2,
            "steps": len(grid.celsius),
            "source": grid.source,
            "title": grid.title,
            "period": grid.period,
            "credit": credit,
            "units": "degC",
            "scale": SCALE,
            "levels": manifest_levels,
        }
        return manifest

    return publish(out_root / grid.source, write)
