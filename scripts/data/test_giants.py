"""Tests for the giant-planet helpers (sources/giants.py)."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sources.giants import brightness_temperature, fill_gaps, to_app_grid  # noqa: E402


def planck(kelvin: float, wavelength_um: float) -> float:
    """Spectral radiance in W / (cm² sr cm⁻¹) of a black body."""
    h, c, k = 6.62607e-34, 2.99792e8, 1.380649e-23
    nu = 1e4 / wavelength_um * 100  # 1/m
    per_m = 2 * h * c**2 * nu**3 / np.expm1(h * c * nu / (k * kelvin))  # W / (m² sr m⁻¹)
    return per_m / 1e4 * 100


class BrightnessTemperatureTest(unittest.TestCase):
    def test_inverts_planck(self) -> None:
        for kelvin in (110.0, 125.0):
            radiance = np.array([planck(kelvin, 18.72)])
            self.assertAlmostEqual(brightness_temperature(radiance, 18.72)[0], kelvin, places=3)

    def test_no_signal_is_nan(self) -> None:
        self.assertTrue(np.isnan(brightness_temperature(np.array([0.0, -1.0]), 18.72)).all())


class FillGapsTest(unittest.TestCase):
    def test_interpolates_round_the_latitude_circle(self) -> None:
        row = np.full(8, np.nan)
        row[1], row[6] = 10.0, 20.0  # the gap from 6 to 1 crosses the end of the row
        out = fill_gaps(row[None], min_coverage=0.2)[0]
        self.assertAlmostEqual(out[7], 20 - 10 / 3)
        self.assertAlmostEqual(out[0], 20 - 20 / 3)
        self.assertAlmostEqual(out[3], 10 + 20 / 5)

    def test_unseen_polar_rows_take_the_nearest_zonal_mean(self) -> None:
        grid = np.full((3, 4), np.nan)
        grid[1] = [1.0, 2.0, 3.0, 6.0]
        out = fill_gaps(grid)
        np.testing.assert_allclose(out[0], 3.0)
        np.testing.assert_allclose(out[2], 3.0)


class ToAppGridTest(unittest.TestCase):
    def test_orientation_and_shape(self) -> None:
        # 90° cells, south first, lon 0..360 east: value = lat index * 10 + lon index.
        cells = np.arange(2)[:, None] * 10 + np.arange(4)[None, :]
        cells = cells.astype(float)
        out = to_app_grid(cells, 90.0)
        self.assertEqual(out.shape, (3, 4))  # lats 90, 0, -90; lons -180, -90, 0, 90
        np.testing.assert_allclose(out[0], 11.5)  # north pole: mean of the northern cells
        np.testing.assert_allclose(out[2], 1.5)
        # The equator point at lon 0 sits between cells 3 (270-360) and 0 (0-90).
        self.assertAlmostEqual(out[1, 2], (3 + 0 + 13 + 10) / 4)
        # And at lon 90, between cells 0 and 1.
        self.assertAlmostEqual(out[1, 3], (0 + 1 + 10 + 11) / 4)


if __name__ == "__main__":
    unittest.main()
