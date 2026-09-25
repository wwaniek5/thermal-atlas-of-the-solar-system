"""ERA5 (Copernicus C3S): 2 m air temperature, monthly means averaged over 1991-2020.

https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels-monthly-means
Native grid: regular 0.25 degrees, 721 x 1440, Kelvin.

Downloading needs a free CDS account, the dataset licence accepted on its
Download page, and ~/.cdsapirc holding the API URL and your token. Each year
is one request (~12 fields, tens of MB) and is cached in .cache/era5/, so an
interrupted run resumes where it stopped. The finished climatology is cached
too, so later runs skip downloading entirely.
"""

from __future__ import annotations

import zipfile
from pathlib import Path

import numpy as np
import xarray as xr

from grid import ClimateGrid, to_lons_from_minus_180, uniform_poles
from pyramid import Level

DATASET = "reanalysis-era5-single-levels-monthly-means"
YEARS = range(1991, 2021)
CREDIT = "Contains modified Copernicus Climate Change Service information (ERA5)"

# Whole globe at 2° (fast enough to animate) and 1° (when paused); tiles for
# zooming in at 0.5° and the native 0.25°.
LEVELS = [Level(2.0), Level(1.0), Level(0.5, 60), Level(0.25, 30)]


def load(cache_dir: Path) -> ClimateGrid:
    climatology = cache_dir / "era5-t2m-monthly-1991-2020.npz"
    if not climatology.exists():
        kelvin, lats, lons = _average_years(cache_dir / "era5")
        np.savez_compressed(climatology, kelvin=kelvin, lats=lats, lons=lons)
    data = np.load(climatology)
    kelvin, lats, lons = data["kelvin"], data["lats"], data["lons"]

    assert np.isclose(lats[0], 90) and np.isclose(lats[-1], -90), "expected lats 90 -> -90"
    lons, celsius = to_lons_from_minus_180(kelvin - 273.15, lons)
    return ClimateGrid(
        source="era5",
        title="ERA5, 2 m air temperature",
        period=f"{YEARS[0]}-{YEARS[-1]}",
        lats=lats,
        lons=lons,
        # ERA5 repeats the pole value along its pole rows; make that exact.
        celsius=uniform_poles(celsius),
    )


def _average_years(year_dir: Path) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    total = None
    for year in YEARS:
        kelvin, lats, lons = _read_year(_download_year(year_dir, year))
        total = kelvin if total is None else total + kelvin
        print(f"  {year} added")
    return total / len(YEARS), lats, lons


def _download_year(year_dir: Path, year: int) -> Path:
    path = year_dir / f"t2m-{year}.nc"
    if path.exists():
        return path
    import cdsapi  # only needed when downloading

    year_dir.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".part")
    print(f"Requesting ERA5 {year} (the CDS queue can take a few minutes)")
    cdsapi.Client().retrieve(
        DATASET,
        {
            "product_type": ["monthly_averaged_reanalysis"],
            "variable": ["2m_temperature"],
            "year": [str(year)],
            "month": [f"{m:02d}" for m in range(1, 13)],
            "time": ["00:00"],
            "data_format": "netcdf",
            "download_format": "unarchived",
        },
        str(tmp),
    )
    # CDS sometimes wraps NetCDF output in a zip even when asked not to.
    if zipfile.is_zipfile(tmp):
        with zipfile.ZipFile(tmp) as z:
            [name] = [n for n in z.namelist() if n.endswith(".nc")]
            path.write_bytes(z.read(name))
        tmp.unlink()
    else:
        tmp.rename(path)
    return path


def _read_year(path: Path) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    with xr.open_dataset(path) as ds:
        time = next(d for d in ("valid_time", "time") if d in ds.dims)
        t2m = ds["t2m"].sortby(time)
        months = t2m[time].dt.month.values
        assert list(months) == list(range(1, 13)), f"{path.name}: months {months}"
        assert t2m.attrs.get("units") == "K", t2m.attrs.get("units")
        extra = [d for d in t2m.dims if d not in (time, "latitude", "longitude")]
        if extra:  # e.g. a length-1 "expver" dimension
            t2m = t2m.isel({d: 0 for d in extra})
        return (
            t2m.transpose(time, "latitude", "longitude").values.astype(np.float64),
            ds["latitude"].values.astype(np.float64),
            ds["longitude"].values.astype(np.float64),
        )
