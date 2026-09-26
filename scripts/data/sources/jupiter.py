"""Jupiter: upper-troposphere temperature from VLT/VISIR, 24-27 May 2018.

Bardet et al. (2024, JGR Planets) imaged the whole planet with ESO's Very
Large Telescope over four nights, and published the calibrated maps of each
frame (Bardet 2023, Zenodo 10.5281/zenodo.8401816, CC-BY 4.0). This uses the
18.72 µm (Q2) filter, which sees the hydrogen-helium continuum: the
brightness temperature of the air in the upper troposphere, a little above
the ammonia clouds, where belts are warm and zones are cool.

Each frame is a 0.5° cylindrical map of radiance (planetocentric latitude,
south first; column c at System III longitude 360 - (c + 0.5) / 2 °W) and a
map of the emission angle cosine. VISIR's field of view is smaller than
Jupiter, so a frame covers the northern or southern half; the other half has
only chopping residuals and is dropped. Frames are limb-corrected and
combined with giants.py.

This is a snapshot of four nights, not a long-term average, but Jupiter's
belts and zones change little from year to year. It has no seasons to speak
of (the axis is tilted 3°).
"""

from __future__ import annotations

import json
import urllib.request
from pathlib import Path

import numpy as np

from grid import ClimateGrid
from sources import giants
from sources.download import download

RECORD = "https://zenodo.org/api/records/8401816"
CREDIT = "ESO VLT/VISIR frames calibrated by Bardet et al. (2024), combined for this site"
FILTER = "Q2"  # 18.72 µm
STEP = 1.0  # degrees: the telescope resolves about 1.5° at the disc centre
RADIANCE_UNIT = 1e-7  # the maps' radiance is in 10⁻⁷ W / (cm² sr cm⁻¹)
MU_MIN = 0.15  # drop the extreme limb (emission angle above ~81°)

LATS_CELLS = np.arange(-89.75, 90, 0.5)  # the frames' cell-centre latitudes


def load(cache_dir: Path) -> ClimateGrid:
    cached = cache_dir / "jupiter-q2.npz"
    if not cached.exists():
        cells = _mosaic(cache_dir / "jupiter" / "visir")
        np.savez_compressed(cached, kelvin=cells)
    cells = np.load(cached)["kelvin"]

    observed = np.isfinite(cells)
    print(f"  observed {observed.mean():.0%} of the 0.5° cells; the rest filled")
    cells = giants.fill_gaps(cells)
    kelvin = giants.to_app_grid(giants.block_mean(cells, int(STEP / 0.5)), STEP)

    return ClimateGrid(
        source="jupiter",
        title="Jupiter upper-troposphere temperature (VLT/VISIR 18.7 µm)",
        period="24-27 May 2018",
        lats=np.linspace(90, -90, int(180 / STEP) + 1),
        lons=np.arange(-180, 180, STEP),
        celsius=kelvin[None] - 273.15,
    )


def _mosaic(folder: Path) -> np.ndarray:
    """Limb-corrected median of all FILTER frames: (lat, lon) cells, south first, lon 0..360 east."""
    frames, mus = [], []
    for cmap_path, mu_path in _download_frames(folder):
        header, radiance = giants.read_fits(cmap_path)
        _, mu = giants.read_fits(mu_path)
        kelvin = giants.brightness_temperature(radiance * RADIANCE_UNIT, float(header["LAMBDA"]))
        _keep_observed_half(kelvin)
        frames.append(kelvin)
        mus.append(mu)
    corrected = giants.limb_correct(np.array(frames), np.array(mus), LATS_CELLS, mu_min=MU_MIN)
    cells = giants.mosaic(corrected)
    # Columns run west from 360°W, i.e. east longitude (c + 0.5) / 2: already 0..360 east.
    return cells


def _keep_observed_half(kelvin: np.ndarray) -> None:
    """Blank the hemisphere a frame didn't point at (it holds chopping residuals)."""
    half = kelvin.shape[0] // 2
    south, north = np.isfinite(kelvin[:half]).sum(), np.isfinite(kelvin[half:]).sum()
    # The first night's frames were centred on the equator and see both halves; keep those whole.
    if south > 3 * north:
        kelvin[half:] = np.nan
    elif north > 3 * south:
        kelvin[:half] = np.nan


def _download_frames(folder: Path) -> list[tuple[Path, Path]]:
    """The FILTER frames' radiance and emission-angle maps, downloaded once."""
    index = folder / "record.json"
    if not index.exists():
        folder.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(RECORD) as response:
            index.write_bytes(response.read())
    files = {f["key"]: f["links"]["self"] for f in json.loads(index.read_text())["files"]}
    pairs = []
    for key in sorted(files):
        if f"_{FILTER}_" in key and key.endswith(".cmap.gz"):
            mu_key = key.replace(".cmap.gz", ".mu.gz")
            pairs.append((download(files[key], folder / key), download(files[mu_key], folder / mu_key)))
    print(f"  {len(pairs)} {FILTER} frames")
    return pairs
