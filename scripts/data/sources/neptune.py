"""Neptune: upper-troposphere temperature from Voyager 2, August 1989.

The same Voyager/IRIS retrievals as Uranus (github.com/leighfletcher/Voyager,
inbound north-south map), at 100 mbar, zonal. Neptune was in southern
summer; north of about 45°N lay in polar night and out of IRIS's view, so
there is no data there. The grid holds the 45°N value flat to the pole (so
no isotherms are drawn there) and the app covers it as "not measured"
(UNMEASURED_NORTH_OF, matching unmeasuredNorthOf in src/bodies.ts).

Telescope images from 2003-2007 show the same pattern at low and middle
latitudes, while 70-90°S had warmed by 5-6 K (Fletcher et al. 2014).
"""

from __future__ import annotations

from pathlib import Path

import numpy as np

from grid import ClimateGrid
from sources import giants

CREDIT = "Voyager 2/IRIS temperatures retrieved by Fletcher et al. (2018)"
PRESSURE_BAR = 0.1
STEP = 1.0
POLAR_TO_EQUATORIAL = 24341 / 24764  # radii (km)
UNMEASURED_NORTH_OF = 44  # the last retrieval is at 44.4°N (planetocentric)


def load(cache_dir: Path) -> ClimateGrid:
    lats, kelvin = giants.voyager_profile(cache_dir, "Neptune", "nep", PRESSURE_BAR)
    lats = giants.planetographic_to_centric(lats, POLAR_TO_EQUATORIAL)
    print(f"  measured {lats.min():.1f} to {lats.max():.1f} (planetocentric)")
    return ClimateGrid(
        source="neptune",
        title="Neptune temperature at 100 mbar (Voyager 2/IRIS)",
        period="August 1989",
        lats=np.linspace(90, -90, int(180 / STEP) + 1),
        lons=np.arange(-180, 180, STEP),
        # np.interp holds the end values beyond the measured latitudes.
        celsius=giants.zonal_grid(lats, kelvin, STEP)[None] - 273.15,
    )
