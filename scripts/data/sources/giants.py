"""Shared by the giant planets: thermal-infrared maps to a temperature grid.

Giant planets have no surface, so what can be mapped is the temperature of
the air at some pressure level. Telescopes and spacecraft measure the
infrared radiance the planet gives off; at a wavelength where the gas is
opaque, the radiance fixes the temperature of the layer it comes from (its
"brightness temperature"). The hydrogen-helium continuum near 18-20 µm comes
from the upper troposphere, a little above the visible clouds.

The helpers here turn calibrated cylindrical maps (one per telescope frame,
each covering part of the planet) into one global grid:

- brightness_temperature: radiance to kelvin (Planck's law).
- limb_correct: the edge of the disc looks colder (limb darkening), because
  the line of sight there ends higher up, in colder air. Fit brightness
  temperature against the emission angle cosine (mu) and remove the trend.
- mosaic: the median of all frames that see each point, which drops
  single-frame artefacts (frame edges, chopping residuals).
- fill_gaps: longitudes no frame saw are interpolated along their latitude
  circle; latitudes too close to the pole to be seen are extended from the
  last observed one.
"""

from __future__ import annotations

import gzip
import warnings
from pathlib import Path

import numpy as np

H = 6.62607e-34  # Planck constant, J s
C = 2.99792e8  # speed of light, m/s
K = 1.380649e-23  # Boltzmann constant, J/K


def read_fits(path: Path) -> tuple[dict[str, str], np.ndarray]:
    """Header and 2-D image of a (gzipped) single-image FITS file, rows as stored."""
    raw = gzip.open(path).read() if path.suffix == ".gz" else path.read_bytes()
    header: dict[str, str] = {}
    i = 0
    while True:
        card = raw[i : i + 80].decode("ascii", "replace")
        i += 80
        if card.startswith("END"):
            break
        if card[8:10] == "= ":
            header[card[:8].strip()] = card[10:].split("/")[0].strip().strip("'").strip()
    start = -(-i // 2880) * 2880  # the data starts at the next 2880-byte block
    nx, ny = int(header["NAXIS1"]), int(header["NAXIS2"])
    dtype = {-32: ">f4", -64: ">f8"}[int(header["BITPIX"])]
    data = np.frombuffer(raw[start : start + nx * ny * abs(int(header["BITPIX"])) // 8], dtype=dtype)
    return header, data.reshape(ny, nx).astype(np.float64)


def brightness_temperature(radiance: np.ndarray, wavelength_um: float) -> np.ndarray:
    """Kelvin from spectral radiance in W / (cm² sr cm⁻¹); NaN where radiance <= 0."""
    nu = 1e4 / wavelength_um * 100  # wavenumber, 1/m
    # Per cm² to per m² is x 1e4; per cm⁻¹ to per m⁻¹ is / 100.
    rad = np.where(radiance > 0, radiance, np.nan) * 1e4 / 100  # W / (m² sr m⁻¹)
    with np.errstate(invalid="ignore"):
        return (H * C / K) * nu / np.log(2 * H * C**2 * nu**3 / rad + 1)


def limb_correct(
    kelvin: np.ndarray, mu: np.ndarray, lats: np.ndarray, *, mu_min: float, band: tuple[float, float] = (5, 30), degree: int = 3
) -> np.ndarray:
    """Remove the brightness temperature trend with emission angle.

    kelvin, mu: (frames, lat, lon). The trend is a polynomial in mu fitted in
    the latitude band (both hemispheres) after subtracting each latitude's
    near-disc-centre mean, so belts and zones don't leak into the fit. Values
    are moved to what they would be seen straight down (mu = 1).
    """
    in_band = (np.abs(lats) > band[0]) & (np.abs(lats) < band[1])
    centre = np.where(mu > 0.7, kelvin, np.nan)[:, in_band]
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        row_mean = np.nanmean(centre, axis=(0, 2))
    anomaly = kelvin[:, in_band] - row_mean[None, :, None]
    used = np.isfinite(anomaly) & (mu[:, in_band] > mu_min)
    coeffs = np.polyfit(mu[:, in_band][used], anomaly[used], degree)
    fitted = np.polyval(coeffs, np.clip(mu, mu_min, 1))
    out = kelvin + np.polyval(coeffs, 1.0) - fitted
    out[~(mu > mu_min)] = np.nan
    return out


def mosaic(kelvin: np.ndarray) -> np.ndarray:
    """Median over frames (axis 0), NaN where no frame has data."""
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)  # all-NaN points stay NaN
        return np.nanmedian(kelvin, axis=0)


def fill_gaps(values: np.ndarray, min_coverage: float = 0.25) -> np.ndarray:
    """Fill NaNs in a (lat, lon) grid covering all longitudes.

    Latitudes with at least `min_coverage` of their longitudes observed are
    interpolated along the latitude circle (wrapping round). The others,
    near the poles, take the zonal mean of the nearest filled latitude.
    """
    out = values.copy()
    n = out.shape[1]
    x = np.arange(n)
    filled = np.zeros(len(out), dtype=bool)
    for r, row in enumerate(out):
        ok = np.isfinite(row)
        if ok.mean() < min_coverage:
            continue
        xs = x[ok]
        # Wrap: repeat the observed points one turn either side.
        out[r] = np.interp(x, np.concatenate([xs - n, xs, xs + n]), np.tile(row[ok], 3))
        filled[r] = True
    if not filled.any():
        raise ValueError("no latitude has enough data to fill from")
    rows = np.flatnonzero(filled)
    for r in np.flatnonzero(~filled):
        nearest = rows[np.argmin(np.abs(rows - r))]
        out[r] = out[nearest].mean()
    return out


def block_mean(values: np.ndarray, factor: int) -> np.ndarray:
    """Average factor x factor blocks of a (lat, lon) grid."""
    ny, nx = values.shape
    return values.reshape(ny // factor, factor, nx // factor, factor).mean(axis=(1, 3))


def to_app_grid(cells: np.ndarray, step: float) -> np.ndarray:
    """Cell-centred (south-to-north, lon 0..360 east) grid to the app's grid.

    The app's grid has points at lats 90..-90 and lons -180..180-step. Point
    values are the average of the cells around them; pole rows are the mean
    of the last cell row.
    """
    ny, nx = cells.shape
    assert ny * step == 180 and nx * step == 360
    north_first = cells[::-1]
    # Interior points sit between two cell rows and two cell columns.
    rows = 0.5 * (north_first[:-1] + north_first[1:])
    rows = np.vstack([np.full((1, nx), north_first[0].mean()), rows, np.full((1, nx), north_first[-1].mean())])
    points = 0.5 * (rows + np.roll(rows, 1, axis=1))  # point at lon j*step, between cells j-1 and j
    # Reorder columns from 0..360 to -180..180.
    return np.roll(points, nx // 2, axis=1)
