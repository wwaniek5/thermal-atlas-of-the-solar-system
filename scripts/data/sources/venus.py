"""Venus: surface temperature from altitude.

Venus's atmosphere (about 92 bar of CO2) spreads heat so well that the
surface temperature barely depends on latitude, day or night, or season:
it is set by altitude. So this derives one static map, the way published
Venus surface temperature maps are made:

- Topography: Magellan Global Topography 4641 m (USGS Astrogeology, GTDR v2),
  heights in metres relative to a radius of 6051 km. About 8% of pixels are
  gaps; they are filled from their neighbours after averaging to the grid.
- Temperature from altitude: the Venus International Reference Atmosphere
  (Seiff et al. 1985), whose altitudes are above a radius of 6052 km.
"""

from __future__ import annotations

import warnings
from pathlib import Path

import numpy as np

from grid import ClimateGrid, uniform_poles
from pyramid import Level
from sources.download import download

URL = "https://planetarymaps.usgs.gov/mosaic/Venus_Magellan_Topography_Global_4641m_v02.tif"
CREDIT = "Magellan topography (USGS Astrogeology) with the VIRA temperature profile (Seiff et al. 1985)"
STEP = 0.125  # degrees: the finest level, about 3 Magellan pixels per cell

# The whole globe at 2° (Venus's radar relief is noisy: finer is too many
# isotherm points to redraw smoothly); detail tiles for zooming in.
LEVELS = [Level(2.0), Level(1.0, 60), Level(0.5, 30), Level(0.25, 30), Level(0.125, 15)]

DATUM_RADIUS_M = 6051000.0  # Magellan heights are relative to this
VIRA_RADIUS_M = 6052000.0  # VIRA altitude 0
# VIRA temperatures near the surface: altitude (km) -> K.
VIRA_KM = np.array([0.0, 5.0, 10.0, 15.0])
VIRA_K = np.array([735.3, 696.8, 658.2, 620.8])


def load(cache_dir: Path) -> ClimateGrid:
    import tifffile  # only needed for Venus

    path = download(URL, cache_dir / "venus" / "Venus_Magellan_Topography_Global_4641m_v02.tif")
    with tifffile.TiffFile(path) as tif:
        dn = tif.pages[0].asarray()
        nodata = int(tif.pages[0].tags["GDAL_NODATA"].value)
    heights = _to_grid(dn, nodata)

    return ClimateGrid(
        source="venus",
        title="Venus surface temperature (from Magellan topography and VIRA)",
        period="nearly constant",
        lats=np.linspace(90, -90, int(180 / STEP) + 1),
        lons=np.arange(-180, 180, STEP),
        # No separate terrain: the isotherms themselves trace the relief.
        celsius=uniform_poles(temperature_k(heights)[None] - 273.15),
    )


def temperature_k(height_m: np.ndarray) -> np.ndarray:
    """Surface temperature (K) at a Magellan height (m above 6051 km)."""
    z_km = (height_m + DATUM_RADIUS_M - VIRA_RADIUS_M) / 1000
    t = np.interp(z_km, VIRA_KM, VIRA_K)
    # Below VIRA's 0 km (the lowest plains), continue its lowest lapse rate.
    lapse = (VIRA_K[1] - VIRA_K[0]) / (VIRA_KM[1] - VIRA_KM[0])
    return np.where(z_km < 0, VIRA_K[0] + lapse * z_km, t)


def _to_grid(dn: np.ndarray, nodata: int) -> np.ndarray:
    """Average the equirectangular 8192 x 4096 map into STEP-degree cells centred on grid points."""
    rows, cols = dn.shape
    lat = 90 - (np.arange(rows) + 0.5) * 180 / rows
    lon = -180 + (np.arange(cols) + 0.5) * 360 / cols
    nlat, nlon = int(180 / STEP) + 1, int(360 / STEP)
    r = np.rint((90 - lat) / STEP).astype(int)  # grid row of each pixel row
    c = np.rint((lon + 180) / STEP).astype(int) % nlon  # grid column of each pixel column (wraps)

    valid = dn != nodata
    cell = (r[:, None] * nlon + c[None, :])[valid]
    sums = np.bincount(cell, weights=dn[valid].astype(np.float64), minlength=nlat * nlon)
    counts = np.bincount(cell, minlength=nlat * nlon)
    # A cell decided by a handful of pixels (near the patchy south pole) gives
    # spurious extremes; treat it as a gap unless 20% of its pixels have data.
    expected = (rows / 180 * STEP) * (cols / 360 * STEP)
    enough = counts >= 0.2 * expected
    grid = np.full(nlat * nlon, np.nan)
    grid[enough] = sums[enough] / counts[enough]
    grid = grid.reshape(nlat, nlon)
    print(f"  cells with too little Magellan data: {np.isnan(grid).mean():.1%} (filled from neighbours)")
    return _fill_gaps(grid)


def _fill_gaps(grid: np.ndarray) -> np.ndarray:
    """Fill NaN cells with the mean of their valid neighbours, repeating until none are left."""
    grid = grid.copy()
    while np.isnan(grid).any():
        padded = np.pad(grid, ((1, 1), (0, 0)), mode="edge")
        neighbours = np.stack(
            [np.roll(padded, s, axis=a)[1:-1] for a, s in ((0, 1), (0, -1), (1, 1), (1, -1))]
        )
        with warnings.catch_warnings():  # cells with no valid neighbour yet stay NaN this round
            warnings.simplefilter("ignore", RuntimeWarning)
            mean = np.nanmean(neighbours, axis=0)
        holes = np.isnan(grid) & ~np.isnan(mean)
        grid[holes] = mean[holes]
    return grid
