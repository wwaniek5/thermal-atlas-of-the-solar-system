"""Saturn: upper-troposphere temperature through its seasons, 2007-2017.

From Cassini's infrared spectrometer (CIRS): Fletcher et al. (2018) retrieved
temperature against pressure and latitude from spectra taken over the whole
mission, and interpolated them in time ("reconstructed" field, 10-day steps,
1° latitude). Published at github.com/leighfletcher/CassiniCIRS
(GlobalMIR2017/globaltemp.sav, an IDL save file).

Saturn's temperatures here are zonal: CIRS was averaged along latitude
circles, so the map has no longitude detail. What does change is the
season: the axis is tilted 26.7°, and a year is 29.5 Earth years. Cassini saw
the end of northern winter, the equinox (August 2009) and northern spring
up to the summer solstice (May 2017).

The timeline starts in 2007: before that the north polar winter was not
yet observed. Values are taken at 100 mbar, near the tropopause, where CIRS's
mid-infrared spectra are most sensitive and the seasonal change is large.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np

from grid import ClimateGrid
from sources import giants
from sources.download import download

URL = "https://raw.githubusercontent.com/leighfletcher/CassiniCIRS/master/GlobalMIR2017/globaltemp.sav"
CREDIT = "Cassini/CIRS temperatures reconstructed by Fletcher et al. (2018)"

PRESSURE_BAR = 0.1
FIRST_YEAR, LAST_YEAR = 2007, 2017
STEPS_PER_YEAR = 4
STEP = 2.0  # degrees: the retrievals have 2° latitude resolution
POLAR_TO_EQUATORIAL = 54364 / 60268  # radii (km), for planetographic to planetocentric
J2000 = 2451545.0  # Julian date of 2000-01-01 12:00


def load(cache_dir: Path) -> ClimateGrid:
    from scipy.io import readsav  # only needed for Saturn

    data = readsav(download(URL, cache_dir / "saturn" / "globaltemp.sav"))
    kelvin = data["finaltemp"].astype(np.float64)  # (days, lat, pressure); 0 = no data
    days, pressures = data["newdays"], data["press"]  # Julian dates, atm
    lats = giants.planetographic_to_centric(data["newlat"], POLAR_TO_EQUATORIAL)

    # Pressure levels are ~15% apart: interpolate in log pressure.
    level = np.interp(np.log(PRESSURE_BAR), np.log(pressures[::-1]), np.arange(len(pressures))[::-1])
    below = int(np.floor(level))
    w = level - below
    at_level = (1 - w) * kelvin[:, :, below] + w * kelvin[:, :, below + 1]
    at_level[(kelvin[:, :, below] <= 0) | (kelvin[:, :, below + 1] <= 0)] = np.nan

    steps = []
    for date in step_dates():
        i = np.searchsorted(days, date)
        t = (date - days[i - 1]) / (days[i] - days[i - 1])
        profile = (1 - t) * at_level[i - 1] + t * at_level[i]
        if np.isnan(profile).any():
            raise ValueError(f"no data at some latitudes on Julian date {date}")
        steps.append(giants.zonal_grid(lats, profile, STEP))

    return ClimateGrid(
        source="saturn",
        title="Saturn temperature at 100 mbar (Cassini/CIRS)",
        period=f"{FIRST_YEAR}-{LAST_YEAR}",
        lats=np.linspace(90, -90, int(180 / STEP) + 1),
        lons=np.arange(-180, 180, STEP),
        celsius=np.array(steps) - 273.15,
    )


def step_dates() -> np.ndarray:
    """Julian dates of the steps: every quarter year from 1 January FIRST_YEAR to 1 January LAST_YEAR."""
    years = np.linspace(FIRST_YEAR, LAST_YEAR, (LAST_YEAR - FIRST_YEAR) * STEPS_PER_YEAR + 1)
    return J2000 - 0.5 + (years - 2000) * 365.25
