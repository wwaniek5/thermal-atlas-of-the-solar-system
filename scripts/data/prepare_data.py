"""Download a climate data source and convert it to the app's grid format.

Usage (from the repo root):
    .venv/bin/python scripts/data/prepare_data.py noaa
    .venv/bin/python scripts/data/prepare_data.py era5   # needs ~/.cdsapirc
"""

from __future__ import annotations

import argparse
from pathlib import Path

from grid import write_grid
from pyramid import write_pyramid
from sources import SOURCES

REPO = Path(__file__).resolve().parents[2]
CACHE_DIR = Path(__file__).resolve().parent / ".cache"
OUT_ROOT = REPO / "public" / "data"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("source", choices=sorted(SOURCES))
    args = parser.parse_args()

    source = SOURCES[args.source]
    grid = source.load(CACHE_DIR)
    if source.levels:
        out_dir = write_pyramid(grid, source.levels, OUT_ROOT, source.credit, source.even_poles)
    else:
        out_dir = write_grid(grid, OUT_ROOT, source.credit)

    c = grid.celsius
    size = sum(f.stat().st_size for f in out_dir.rglob("*") if f.is_file())
    print(f"Wrote {out_dir.relative_to(REPO)}: {len(grid.lats)} x {len(grid.lons)} grid, {len(c)} steps, {size / 1e6:.1f} MB")
    print(f"  range {c.min():.1f} .. {c.max():.1f} degC")


if __name__ == "__main__":
    main()
