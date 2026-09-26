"""Mercury: surface temperature over one solar day, from a thermal model.

There is no global measured temperature dataset for Mercury, so this
computes one with the airless-body model in thermal.py, the way published
maps are made (cf. Vasavada et al. 1999). Sunlight comes from Mercury's real
orbit: eccentricity 0.2056 and a 3:2 spin-orbit resonance (3 rotations per
2 orbits), so one solar day is exactly two years (175.94 Earth days).

72 snapshots are recorded through one solar day (every 2.4 Earth days), so
the app's blending between neighbours stays close to the real motion. Step 0
is perihelion with the Sun overhead at 0° longitude (a "hot pole"); step 36
is the next perihelion with the Sun over 180°. Longitudes are east-positive.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np

from grid import ClimateGrid, uniform_poles
from sources.thermal import STEP, run_model

CREDIT = "Thermal model (Hayne et al. 2017 regolith properties) computed for this site"

SEMI_MAJOR_AU = 0.387098
ECCENTRICITY = 0.205630
ORBIT_DAYS = 87.9691
ROTATION_DAYS = 58.6462  # sidereal
SOLAR_DAY_DAYS = 1 / (1 / ROTATION_DAYS - 1 / ORBIT_DAYS)  # 175.94

ALBEDO = 0.1
GEOTHERMAL_FLUX = 0.02  # W/m²


def load(cache_dir: Path) -> ClimateGrid:
    cached = cache_dir / "mercury-model.npz"
    if not cached.exists():
        kelvin = run_model(
            lambda t: subsolar(t), SOLAR_DAY_DAYS, albedo=ALBEDO, geothermal_flux=GEOTHERMAL_FLUX
        )
        np.savez_compressed(cached, kelvin=kelvin)
    kelvin = np.load(cached)["kelvin"]

    return ClimateGrid(
        source="mercury",
        title="Mercury surface temperature (thermal model)",
        period="one solar day",
        lats=np.linspace(90, -90, int(180 / STEP) + 1),
        lons=np.arange(-180, 180, STEP),
        celsius=uniform_poles(kelvin - 273.15),
    )


def subsolar(t_days: np.ndarray | float) -> tuple[np.ndarray, np.ndarray]:
    """(Sun distance in AU, subsolar east longitude in degrees) at time t after perihelion."""
    mean_anomaly = 2 * np.pi * np.asarray(t_days) / ORBIT_DAYS
    e = ECCENTRICITY
    ecc = mean_anomaly.copy() if isinstance(mean_anomaly, np.ndarray) else np.array(mean_anomaly)
    for _ in range(30):  # Kepler's equation, Newton's method
        ecc = ecc - (ecc - e * np.sin(ecc) - mean_anomaly) / (1 - e * np.cos(ecc))
    true_anomaly = 2 * np.arctan2(np.sqrt(1 + e) * np.sin(ecc / 2), np.sqrt(1 - e) * np.cos(ecc / 2))
    distance = SEMI_MAJOR_AU * (1 - e * np.cos(ecc))
    rotation = 2 * np.pi * np.asarray(t_days) / ROTATION_DAYS
    # The Sun's direction in the planet's frame moves with the orbit (true
    # anomaly) and against the spin. East-positive, wrapped to [-180, 180).
    lon = np.degrees(true_anomaly - rotation)
    return distance, (lon + 180) % 360 - 180
