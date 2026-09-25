"""Download a climate data source and convert it to the app's grid format.

Usage (from the repo root):
    .venv/bin/python scripts/data/prepare_data.py noaa
"""

from __future__ import annotations

import argparse
from pathlib import Path

from grid import write_grid
from sources import SOURCES

REPO = Path(__file__).resolve().parents[2]
CACHE_DIR = Path(__file__).resolve().parent / ".cache"
OUT_ROOT = REPO / "public" / "data"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("source", choices=sorted(SOURCES))
    args = parser.parse_args()

    grid = SOURCES[args.source](CACHE_DIR)
    out_dir = write_grid(grid, OUT_ROOT)

    c = grid.celsius
    print(f"Wrote {out_dir.relative_to(REPO)}: {len(grid.lats)} x {len(grid.lons)} grid, 12 months")
    print(f"  range {c.min():.1f} .. {c.max():.1f} degC")


if __name__ == "__main__":
    main()
