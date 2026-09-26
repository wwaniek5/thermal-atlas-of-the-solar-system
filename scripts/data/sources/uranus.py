"""Uranus: upper-troposphere temperature from Voyager 2, January 1986.

Voyager 2's infrared spectrometer (IRIS) mapped Uranus from pole to pole
during its flyby. The temperatures are the retrieval by L. N. Fletcher
(github.com/leighfletcher/Voyager) with updated hydrogen absorption
(Fletcher et al. 2018); they match the earlier retrievals of Orton et al.
(2015). Values are zonal (averaged along latitude circles), at 100 mbar.

Ground-based images at the same level from 2018 differ from Voyager's by
less than 0.3 K at most latitudes (Roman et al. 2020), despite Uranus's
98° tilt taking it from southern summer to northern spring in between, so
one static map stands for the whole period.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np

from grid import ClimateGrid
from sources import giants

CREDIT = "Voyager 2/IRIS temperatures retrieved by Fletcher et al. (2018)"
PRESSURE_BAR = 0.1
STEP = 1.0
POLAR_TO_EQUATORIAL = 24973 / 25559  # radii (km)


def load(cache_dir: Path) -> ClimateGrid:
    lats, kelvin = giants.voyager_profile(cache_dir, "Uranus", "ura", PRESSURE_BAR)
    lats = giants.planetographic_to_centric(lats, POLAR_TO_EQUATORIAL)
    return ClimateGrid(
        source="uranus",
        title="Uranus temperature at 100 mbar (Voyager 2/IRIS)",
        period="January 1986",
        lats=np.linspace(90, -90, int(180 / STEP) + 1),
        lons=np.arange(-180, 180, STEP),
        celsius=giants.zonal_grid(lats, kelvin, STEP)[None] - 273.15,
    )
