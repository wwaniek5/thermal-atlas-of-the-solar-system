"""Mercury: surface temperature over one solar day, from a thermal model.

There is no global measured temperature dataset for Mercury, so this
computes one, the way published maps are made:

- Sunlight from Mercury's real orbit: eccentricity 0.2056 and a 3:2
  spin-orbit resonance (3 rotations per 2 orbits), so one solar day is
  exactly two years (175.94 Earth days). Obliquity is ~0, so no seasons.
- One-dimensional heat conduction into the regolith at every grid point,
  with depth- and temperature-dependent density, conductivity and heat
  capacity following the lunar regolith model of Hayne et al. (2017, JGR
  Planets 122), commonly used for Mercury too (cf. Vasavada et al. 1999).
- Surface energy balance: absorbed sunlight = emitted infrared + heat
  conducted downward; a small geothermal flux at the bottom.

The model is spun up for several solar days, then 72 snapshots are
recorded at equal steps through one solar day (every 2.4 Earth days), so
the app's blending between neighbours stays close to the real motion. Step 0 is perihelion with
the Sun overhead at 0° longitude (a "hot pole"); step 6 is the next
perihelion with the Sun over 180°. Longitudes are east-positive.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np

from grid import ClimateGrid, uniform_poles

CREDIT = "Thermal model (Hayne et al. 2017 regolith properties) computed for this site"

# Orbit and rotation.
SEMI_MAJOR_AU = 0.387098
ECCENTRICITY = 0.205630
ORBIT_DAYS = 87.9691
ROTATION_DAYS = 58.6462  # sidereal
SOLAR_DAY_DAYS = 1 / (1 / ROTATION_DAYS - 1 / ORBIT_DAYS)  # 175.94
SOLAR_CONSTANT = 1361.0  # W/m² at 1 AU

# Surface.
ALBEDO = 0.1
EMISSIVITY = 0.95
SIGMA = 5.670374e-8
GEOTHERMAL_FLUX = 0.02  # W/m²

# Regolith (Hayne et al. 2017).
RHO_SURFACE, RHO_DEEP, RHO_SCALE = 1100.0, 1800.0, 0.06  # kg/m³, m
K_SURFACE, K_DEEP = 7.4e-4, 3.4e-3  # W/m/K, solid (contact) conductivity
CHI = 2.7  # radiative conductivity parameter, at 350 K
HEAT_CAPACITY = (-3.6125, 2.7431, 2.3616e-3, -1.2340e-5, 8.9093e-9)  # c(T) = Σ cᵢ Tⁱ, J/kg/K

STEP = 2.0  # grid spacing, degrees
SNAPSHOTS = 72
SPIN_UP_DAYS = 4  # solar days before recording
DT = 1800.0  # s; implicit, so stable at any step


def load(cache_dir: Path) -> ClimateGrid:
    cached = cache_dir / "mercury-model.npz"
    if not cached.exists():
        kelvin = run_model()
        np.savez_compressed(cached, kelvin=kelvin)
    kelvin = np.load(cached)["kelvin"]

    lats = np.linspace(90, -90, int(180 / STEP) + 1)
    lons = np.arange(-180, 180, STEP)
    return ClimateGrid(
        source="mercury",
        title="Mercury surface temperature (thermal model)",
        period="one solar day",
        lats=lats,
        lons=lons,
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


def heat_capacity(T: np.ndarray) -> np.ndarray:
    c = np.zeros_like(T)
    for i, ci in enumerate(HEAT_CAPACITY):
        c += ci * T**i
    return c


def run_model() -> np.ndarray:
    """Temperatures in K, shape (SNAPSHOTS, nlat, nlon) on the 2° grid (90..-90, -180..<180)."""
    lats = np.linspace(90, -90, int(180 / STEP) + 1)
    lons = np.arange(-180, 180, STEP)
    # No obliquity: the south mirrors the north, so compute 0..90 only.
    north = lats[lats >= 0]
    LAT, LON = np.meshgrid(np.radians(north), np.radians(lons), indexing="ij")
    cols = LAT.size
    cos_lat = np.cos(LAT).ravel()
    lon = LON.ravel()

    # Layers: 2 mm at the top, growing 10% per layer, down to ~1.5 m
    # (more than ten diurnal skin depths).
    dz = [0.002]
    while sum(dz) < 1.5:
        dz.append(dz[-1] * 1.1)
    dz = np.array(dz)
    depth = np.cumsum(dz) - dz / 2
    n = len(dz)
    rho = (RHO_DEEP - (RHO_DEEP - RHO_SURFACE) * np.exp(-depth / RHO_SCALE))[:, None]
    kc = (K_DEEP - (K_DEEP - K_SURFACE) * (RHO_DEEP - rho[:, 0]) / (RHO_DEEP - RHO_SURFACE))[:, None]

    T = np.full((n, cols), 300.0)
    steps_per_day = int(round(SOLAR_DAY_DAYS * 86400 / DT))
    # Record at the steps nearest to equal fractions of the last solar day.
    start = steps_per_day * SPIN_UP_DAYS
    record_at = {start + round(i * steps_per_day / SNAPSHOTS) for i in range(SNAPSHOTS)}
    snapshots = []
    total = steps_per_day * (SPIN_UP_DAYS + 1)
    print(f"  thermal model: {total} steps of {DT / 60:.0f} min over {SPIN_UP_DAYS + 1} solar days (~20 min)")
    for step in range(total):
        if step % steps_per_day == 0:
            print(f"  solar day {step // steps_per_day + 1} of {SPIN_UP_DAYS + 1}")
        t_days = step * DT / 86400
        dist, sub_lon = subsolar(t_days)
        cos_z = np.clip(cos_lat * np.cos(lon - np.radians(sub_lon)), 0, None)
        absorbed = (1 - ALBEDO) * SOLAR_CONSTANT / dist**2 * cos_z

        if step in record_at:
            snapshots.append(T[0].copy())

        T = _implicit_step(T, dz, rho, kc, absorbed)

    top = np.stack(snapshots).reshape(SNAPSHOTS, len(north), len(lons))
    return np.concatenate([top, top[:, -2::-1]], axis=1)  # mirror to the south, pole-to-pole


def _implicit_step(T, dz, rho, kc, absorbed):
    """One backward-Euler step, with properties and radiation linearised at T."""
    k = kc * (1 + CHI * (T / 350.0) ** 3)
    cap = rho * heat_capacity(T) * dz[:, None]  # J/m²/K per layer
    # Conductance between layer centres (harmonic mean).
    half = dz[:, None] / 2
    g = 1 / (half[:-1] / k[:-1] + half[1:] / k[1:])  # (n-1, cols)

    n, cols = T.shape
    a = np.zeros((n, cols))  # sub-diagonal
    b = cap / DT  # diagonal
    c = np.zeros((n, cols))  # super-diagonal
    d = cap / DT * T
    b[:-1] += g
    b[1:] += g
    c[:-1] = -g
    a[1:] = -g
    # Surface: absorbed - εσT⁴, linearised around the current temperature.
    T0 = T[0]
    rad = EMISSIVITY * SIGMA * T0**4
    b[0] += 4 * rad / T0
    d[0] += absorbed - rad + 4 * rad
    # Bottom: geothermal heat flowing in.
    d[-1] += GEOTHERMAL_FLUX

    # Thomas algorithm, vectorised over columns.
    cp = np.zeros((n, cols))
    dp = np.zeros((n, cols))
    cp[0] = c[0] / b[0]
    dp[0] = d[0] / b[0]
    for i in range(1, n):
        m = b[i] - a[i] * cp[i - 1]
        cp[i] = c[i] / m
        dp[i] = (d[i] - a[i] * dp[i - 1]) / m
    out = np.empty_like(T)
    out[-1] = dp[-1]
    for i in range(n - 2, -1, -1):
        out[i] = dp[i] - cp[i] * out[i + 1]
    return out
