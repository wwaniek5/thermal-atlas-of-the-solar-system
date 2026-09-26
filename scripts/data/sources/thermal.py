"""Surface temperature of an airless body over one solar day (Mercury, Moon).

- Sunlight from the body's orbit and spin, given as a function of time.
  Obliquity is taken as zero, so the south mirrors the north.
- One-dimensional heat conduction into the regolith at every grid point,
  with depth- and temperature-dependent density, conductivity and heat
  capacity following the lunar regolith model of Hayne et al. (2017, JGR
  Planets 122).
- Surface energy balance: absorbed sunlight = emitted infrared + heat
  conducted downward; a small geothermal flux at the bottom.

The model is spun up for several solar days, then snapshots are recorded at
equal steps through one more solar day.
"""

from __future__ import annotations

from typing import Callable

import numpy as np

SOLAR_CONSTANT = 1361.0  # W/m² at 1 AU
EMISSIVITY = 0.95
SIGMA = 5.670374e-8

# Regolith (Hayne et al. 2017).
RHO_SURFACE, RHO_DEEP, RHO_SCALE = 1100.0, 1800.0, 0.06  # kg/m³, m
K_SURFACE, K_DEEP = 7.4e-4, 3.4e-3  # W/m/K, solid (contact) conductivity
CHI = 2.7  # radiative conductivity parameter, at 350 K
HEAT_CAPACITY = (-3.6125, 2.7431, 2.3616e-3, -1.2340e-5, 8.9093e-9)  # c(T) = Σ cᵢ Tⁱ, J/kg/K

STEP = 2.0  # grid spacing, degrees
DT = 1800.0  # s; implicit, so stable at any step

#: Sun distance (AU) and subsolar east longitude (degrees) at a time in days.
SunPosition = Callable[[float], tuple[float, float]]


def run_model(
    sun: SunPosition,
    solar_day_days: float,
    *,
    albedo: float,
    geothermal_flux: float,
    snapshots: int = 72,
    spin_up_days: int = 4,
) -> np.ndarray:
    """Temperatures in K, shape (snapshots, nlat, nlon) on the 2° grid (90..-90, -180..<180)."""
    lats = np.linspace(90, -90, int(180 / STEP) + 1)
    lons = np.arange(-180, 180, STEP)
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
    steps_per_day = int(round(solar_day_days * 86400 / DT))
    # Record at the steps nearest to equal fractions of the last solar day.
    start = steps_per_day * spin_up_days
    record_at = {start + round(i * steps_per_day / snapshots) for i in range(snapshots)}
    recorded = []
    total = steps_per_day * (spin_up_days + 1)
    minutes = total * cols * 3.3e-6 / 60  # ~27 ms per step for Mercury's 8280 columns
    print(f"  thermal model: {total} steps of {DT / 60:.0f} min over {spin_up_days + 1} solar days (~{minutes:.0f} min)")
    for step in range(total):
        if step % steps_per_day == 0:
            print(f"  solar day {step // steps_per_day + 1} of {spin_up_days + 1}")
        dist, sub_lon = sun(step * DT / 86400)
        cos_z = np.clip(cos_lat * np.cos(lon - np.radians(sub_lon)), 0, None)
        absorbed = (1 - albedo) * SOLAR_CONSTANT / dist**2 * cos_z

        if step in record_at:
            recorded.append(T[0].copy())

        T = _implicit_step(T, dz, rho, kc, absorbed, geothermal_flux)

    top = np.stack(recorded).reshape(snapshots, len(north), len(lons))
    return np.concatenate([top, top[:, -2::-1]], axis=1)  # mirror to the south, pole-to-pole


def heat_capacity(T: np.ndarray) -> np.ndarray:
    c = np.zeros_like(T)
    for i, ci in enumerate(HEAT_CAPACITY):
        c += ci * T**i
    return c


def _implicit_step(T, dz, rho, kc, absorbed, geothermal_flux):
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
    d[-1] += geothermal_flux

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
