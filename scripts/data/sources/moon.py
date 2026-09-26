"""Moon: surface temperature over one lunar day, from a thermal model.

The same airless-body model as Mercury (thermal.py), with the lunar values
of Hayne et al. (2017), whose regolith model was fitted to the Moon and
checked against the Diviner radiometer on the Lunar Reconnaissance Orbiter.

The Moon keeps the same face to Earth: its 0° longitude faces Earth. A lunar
day (new moon to new moon) is 29.53 Earth days, and the Sun is about 1 AU
away all the time. Obliquity (1.5°) is ignored.

72 snapshots through one lunar day, starting at new moon, when the Sun is
overhead on the far side (180°); it is overhead at 0° at full moon.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np

from grid import ClimateGrid, uniform_poles
from sources.thermal import STEP, run_model

CREDIT = "Thermal model (Hayne et al. 2017 lunar regolith) computed for this site"

SYNODIC_DAYS = 29.530589  # new moon to new moon
ALBEDO = 0.12
GEOTHERMAL_FLUX = 0.018  # W/m²


def subsolar(t_days: float) -> tuple[float, float]:
    """(Sun distance in AU, subsolar east longitude) t days after new moon."""
    # The Sun moves west across the sky, a full turn per lunar day.
    lon = 180 - 360 * t_days / SYNODIC_DAYS
    return 1.0, (lon + 180) % 360 - 180


def load(cache_dir: Path) -> ClimateGrid:
    cached = cache_dir / "moon-model.npz"
    if not cached.exists():
        kelvin = run_model(subsolar, SYNODIC_DAYS, albedo=ALBEDO, geothermal_flux=GEOTHERMAL_FLUX)
        np.savez_compressed(cached, kelvin=kelvin)
    kelvin = np.load(cached)["kelvin"]

    return ClimateGrid(
        source="moon",
        title="Moon surface temperature (thermal model)",
        period="one lunar day",
        lats=np.linspace(90, -90, int(180 / STEP) + 1),
        lons=np.arange(-180, 180, STEP),
        celsius=uniform_poles(kelvin - 273.15),
    )
