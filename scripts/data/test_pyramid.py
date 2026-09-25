"""Run from the repo root: .venv/bin/python -m unittest discover scripts/data"""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))

from grid import SCALE, ClimateGrid, uniform_poles  # noqa: E402
from pyramid import Level, coarsen, tile, write_pyramid  # noqa: E402


def synthetic(res: float) -> ClimateGrid:
    lats = np.linspace(90, -90, int(180 / res) + 1)
    lons = np.arange(-180, 180, res)
    lat, lon = np.meshgrid(lats, lons, indexing="ij")
    months = np.arange(12)[:, None, None]
    celsius = 30 * np.cos(np.radians(lat)) - 10 + 5 * np.sin(np.radians(lon)) + months
    return ClimateGrid("test", "Synthetic", "2000", lats, lons, uniform_poles(celsius))


class CoarsenTest(unittest.TestCase):
    def test_keeps_geometry_conventions(self):
        g = coarsen(synthetic(2.5), 5)
        g.validate()
        self.assertEqual(g.celsius.shape, (12, 37, 72))

    def test_averages_smooth_fields_to_nearly_the_same_values(self):
        fine = synthetic(2.5)
        coarse = coarsen(fine, 5)
        # Pole rows blend in their neighbour (clamped window), so skip them.
        np.testing.assert_allclose(coarse.celsius[:, 1:-1], fine.celsius[:, ::2, ::2][:, 1:-1], atol=0.1)

    def test_keeps_each_pole_a_single_value(self):
        g = coarsen(synthetic(2.5), 5)
        for row in (0, -1):
            self.assertLess(np.ptp(g.celsius[:, row, :], axis=-1).max(), 1e-9)

    def test_rejects_non_multiples(self):
        with self.assertRaises(ValueError):
            coarsen(synthetic(2.5), 4)


class TileTest(unittest.TestCase):
    def test_neighbouring_tiles_share_edges_including_across_180(self):
        g = synthetic(2.5)
        span = 45
        cols = int(360 / span)
        for r in range(int(180 / span)):
            for c in range(cols):
                a = tile(g, span, r, c)
                east = tile(g, span, r, (c + 1) % cols)
                np.testing.assert_array_equal(a[:, :, -1], east[:, :, 0])
                if r + 1 < 180 / span:
                    south = tile(g, span, r + 1, c)
                    np.testing.assert_array_equal(a[:, -1, :], south[:, 0, :])


class WritePyramidTest(unittest.TestCase):
    def test_writes_manifest_and_round_trips_values(self):
        g = synthetic(2.5)
        with tempfile.TemporaryDirectory() as tmp:
            out = write_pyramid(g, [Level(5), Level(2.5, 45)], Path(tmp), credit="test")
            manifest = json.loads((out / "manifest.json").read_text())
            self.assertEqual(manifest["format"], 2)
            l0, l1 = manifest["levels"]
            self.assertEqual((l0["nlat"], l0["nlon"], l0["file"]), (37, 72, "L0.bin"))
            self.assertEqual((l1["tileRows"], l1["tileCols"], l1["tilePoints"]), (4, 8, 19))

            whole = np.frombuffer((out / "L0.bin").read_bytes(), "<i2").reshape(12, 37, 72) * SCALE
            np.testing.assert_allclose(whole, coarsen(g, 5).celsius, atol=SCALE / 2 + 1e-9)

            path = out / l1["tiles"].format(row=1, col=7)
            t = np.frombuffer(path.read_bytes(), "<i2").reshape(12, 19, 19) * SCALE
            np.testing.assert_allclose(t, tile(g, 45, 1, 7), atol=SCALE / 2 + 1e-9)


if __name__ == "__main__":
    unittest.main()
