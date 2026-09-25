"""NOAA NCEP/NCAR Reanalysis 1: 2 m air temperature, monthly means 1991-2020.

https://psl.noaa.gov/data/gridded/data.ncep.reanalysis.derived.html
Native grid: T62 Gaussian, 192 x 94 (~1.9 degrees), Kelvin.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import xarray as xr

from grid import ClimateGrid, to_lons_from_minus_180, to_regular_lats
from sources.download import download

URL = "https://downloads.psl.noaa.gov/Datasets/ncep.reanalysis.derived/surface_gauss/air.2m.mon.ltm.1991-2020.nc"
LAT_STEP = 1.875  # match the native longitude spacing


def load(cache_dir: Path) -> ClimateGrid:
    path = download(URL, cache_dir / "noaa-air.2m.mon.ltm.1991-2020.nc")

    # The long-term-mean file uses year-1 dates that don't decode; the 12
    # time steps are simply January..December.
    with xr.open_dataset(path, decode_times=False) as ds:
        air = ds["air"]
        assert air.attrs.get("units") == "degK", air.attrs.get("units")
        kelvin = air.values.astype(np.float64)
        src_lats = ds["lat"].values.astype(np.float64)
        src_lons = ds["lon"].values.astype(np.float64)

    lons, values = to_lons_from_minus_180(kelvin - 273.15, src_lons)
    lats, values = to_regular_lats(values, src_lats, LAT_STEP)

    return ClimateGrid(
        source="noaa",
        title="NCEP/NCAR Reanalysis 1, 2 m air temperature",
        period="1991-2020",
        lats=lats,
        lons=lons,
        celsius=values,
    )
