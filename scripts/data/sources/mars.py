"""Mars: surface temperature by Martian month, from the NASA Ames FV3-based
Mars Global Climate Model reference simulation (Beta Output Release 1).

https://data.nas.nasa.gov/mcmcref/
2° x 2° output, one simulated Mars year in 5-sol averages. `ts` is the
surface (ground) temperature in K; `areo` is the solar longitude Ls.

A Martian "month" here is 30° of Ls, starting at the northern spring
equinox (Month 1 = Ls 0-30°). Each month averages all 5-sol records that
fall in it, so day and night are both included, like Earth's monthly means.

The average file is 4.5 GB (the server doesn't support partial downloads).
Only `ts` by month is kept, in .cache/mars-ts-monthly.npz, and the big file
is deleted afterwards.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import xarray as xr

from grid import ClimateGrid, to_regular_lats, uniform_poles
from sources.download import download

BASE = "https://data.nas.nasa.gov/legacygcm/fv3betaout1/fv3betaout1"
CREDIT = "NASA Ames Mars Climate Modeling Center, FV3-based Mars GCM reference simulation"
STEP = 2.0


def load(cache_dir: Path) -> ClimateGrid:
    monthly = cache_dir / "mars-ts-monthly.npz"
    if not monthly.exists():
        kelvin, src_lats, src_lons = _monthly_means(cache_dir / "mars")
        np.savez_compressed(monthly, kelvin=kelvin, lats=src_lats, lons=src_lons)
    data = np.load(monthly)

    fixed = download(f"{BASE}/03340.fixed.nc", cache_dir / "mars" / "03340.fixed.nc")
    with xr.open_dataset(fixed, decode_times=False) as ds:
        zsurf = ds["zsurf"].values.astype(np.float64)[None]  # (1, lat, lon), metres

    lats, lons, celsius = _to_app_grid(data["kelvin"] - 273.15, data["lats"], data["lons"])
    _, _, terrain = _to_app_grid(zsurf, data["lats"], data["lons"])

    return ClimateGrid(
        source="mars",
        title="Mars surface temperature (NASA Ames FV3 Mars GCM)",
        period="simulated Mars year",
        lats=lats,
        lons=lons,
        celsius=uniform_poles(celsius),
        terrain=terrain[0],
    )


def _monthly_means(folder: Path) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    path = download(f"{BASE}/03340.atmos_average.nc", folder / "03340.atmos_average.nc")
    with xr.open_dataset(path, decode_times=False) as ds:
        assert ds["ts"].attrs.get("units", "K") in ("K", "degK"), ds["ts"].attrs
        ls = ds["areo"].values.reshape(len(ds["time"]), -1)[:, 0] % 360
        month = (ls // 30).astype(int)
        counts = np.bincount(month, minlength=12)
        assert (counts > 0).all(), f"records per Mars month: {counts}"
        ts = ds["ts"].values.astype(np.float64)  # (time, lat, lon)
        kelvin = np.stack([ts[month == m].mean(axis=0) for m in range(12)])
        lats = ds["lat"].values.astype(np.float64)
        lons = ds["lon"].values.astype(np.float64)
    print(f"  5-sol records per Mars month: {counts.tolist()}")
    path.unlink()  # 4.5 GB; the monthly means are cached instead
    return kelvin, lats, lons


def _to_app_grid(values: np.ndarray, src_lats: np.ndarray, src_lons: np.ndarray):
    """Cell centres (lat -89..89, lon 1..359) -> grid points 90..-90, -180..<180."""
    lats, values = to_regular_lats(values, src_lats, STEP)
    target = np.arange(-180, 180, STEP)
    x = np.concatenate([src_lons - 360, src_lons, src_lons + 360])
    v = np.concatenate([values, values, values], axis=-1)
    out = np.apply_along_axis(lambda row: np.interp(target, x, row), -1, v)
    return lats, target.astype(np.float64), out
