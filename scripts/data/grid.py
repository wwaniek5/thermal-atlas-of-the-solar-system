"""Common grid format shared by all data sources.

Every source converter produces a ClimateGrid; `write_grid` turns it into the
files the web app reads:

    public/data/<source>/manifest.json             grid geometry + metadata
    public/data/<source>/<version>/month-01.json   values for January
    ...
    public/data/<source>/<version>/month-12.json

(<version> is a content hash; see publish.py.) Optionally terrain.json:
surface elevation in whole metres, same grid, row-major.

Grid conventions (the app relies on these):
    - regular spacing in both directions
    - rows run north -> south, starting at +90
    - columns run west -> east, starting at -180, NOT repeating +180
      (the app wraps the last column onto the first)
    - values are temperatures in tenths of a degree Celsius, stored as
      integers, row-major: index = row * nlon + col
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from publish import publish

SCALE = 0.1  # stored integer * SCALE = degrees Celsius


@dataclass
class ClimateGrid:
    source: str  # short id, used as the output folder name
    title: str
    period: str  # e.g. "1991-2020"
    lats: np.ndarray  # shape (nlat,), 90 -> -90, evenly spaced
    lons: np.ndarray  # shape (nlon,), -180 -> <180, evenly spaced
    # shape (steps, nlat, nlon): 12 months, more steps through the cycle for
    # bodies that change fast (Mercury's solar day has 72), or 1 for a body
    # that doesn't change (Venus).
    celsius: np.ndarray
    # Optional surface elevation in metres on the same grid (nlat, nlon), for
    # drawing terrain outlines on bodies without coastlines.
    terrain: np.ndarray | None = None

    def validate(self) -> None:
        assert self.celsius.shape[1:] == (len(self.lats), len(self.lons)), self.celsius.shape
        assert len(self.celsius) >= 1, "need at least one step"
        assert np.isfinite(self.celsius).all(), "grid contains missing values"
        assert np.isclose(self.lats[0], 90) and np.isclose(self.lats[-1], -90), "lats must span 90..-90"
        assert np.isclose(self.lons[0], -180), "lons must start at -180"
        assert np.isclose(self.lons[-1] + _step(self.lons), 180), "lons must stop one step before 180"
        # A pole is one point: its row must hold one value, or isotherms run into it.
        for row in (0, -1):
            spread = np.ptp(self.celsius[:, row, :], axis=-1).max()
            assert spread < 1e-6, f"pole row {row} varies by {spread:.3g} degC"
        _step(self.lats)
        _step(self.lons)


def _step(axis: np.ndarray) -> float:
    steps = np.diff(axis)
    assert np.allclose(steps, steps[0]), "axis is not evenly spaced"
    return float(steps[0])


def to_regular_lats(values: np.ndarray, src_lats: np.ndarray, step: float) -> tuple[np.ndarray, np.ndarray]:
    """Linearly interpolate (..., lat, lon) data onto evenly spaced lats 90..-90.

    Sources rarely reach the poles, so each pole is filled with the zonal mean
    of the nearest row before interpolating.
    """
    order = np.argsort(src_lats)  # np.interp needs ascending x
    lats_asc = src_lats[order]
    vals_asc = values[..., order, :]

    south = vals_asc[..., :1, :].mean(axis=-1, keepdims=True).repeat(vals_asc.shape[-1], axis=-1)
    north = vals_asc[..., -1:, :].mean(axis=-1, keepdims=True).repeat(vals_asc.shape[-1], axis=-1)
    lats_asc = np.concatenate([[-90.0], lats_asc, [90.0]])
    vals_asc = np.concatenate([south, vals_asc, north], axis=-2)

    nlat = int(round(180 / step)) + 1
    target = np.linspace(90, -90, nlat)
    out = np.apply_along_axis(lambda col: np.interp(target, lats_asc, col), -2, vals_asc)
    return target, out


def uniform_poles(celsius: np.ndarray) -> np.ndarray:
    """Set each pole row to its mean: a pole is a single point."""
    out = celsius.copy()
    for row in (0, -1):
        out[:, row, :] = out[:, row, :].mean(axis=-1, keepdims=True)
    return out


def to_lons_from_minus_180(values: np.ndarray, src_lons: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Convert 0..360 longitudes to -180..180 and reorder columns to match."""
    lons = ((src_lons + 180) % 360) - 180
    order = np.argsort(lons)
    return lons[order], values[..., order]


def write_grid(grid: ClimateGrid, out_root: Path, credit: str) -> Path:
    grid.validate()

    def write(folder: Path) -> dict:
        steps = len(grid.celsius)
        name = "month" if steps == 12 else "step"
        months = [f"{name}-{m:02d}.json" for m in range(1, steps + 1)]
        for m, filename in enumerate(months):
            ints = np.rint(grid.celsius[m] / SCALE).astype(int).ravel().tolist()
            (folder / filename).write_text(json.dumps({"month": m + 1, "values": ints}, separators=(",", ":")))
        extra = {}
        if grid.terrain is not None:
            assert grid.terrain.shape == (len(grid.lats), len(grid.lons)), grid.terrain.shape
            metres = np.rint(grid.terrain).astype(int).ravel().tolist()
            (folder / "terrain.json").write_text(json.dumps({"values": metres}, separators=(",", ":")))
            extra["terrain"] = "terrain.json"
        return {
            **extra,
            "source": grid.source,
            "title": grid.title,
            "period": grid.period,
            "credit": credit,
            "units": "degC",
            "scale": SCALE,
            "nlat": len(grid.lats),
            "nlon": len(grid.lons),
            "lat0": float(grid.lats[0]),
            "dlat": _step(grid.lats),
            "lon0": float(grid.lons[0]),
            "dlon": _step(grid.lons),
            "months": months,
        }

    return publish(out_root / grid.source, write)
