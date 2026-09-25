"""Data source registry. To add a source, write a module with a
`load(cache_dir) -> ClimateGrid` function and register it here.

Sources without `levels` are written in format 1 (JSON per month, see
grid.py); sources with `levels` in format 2 (tiled pyramid, see pyramid.py).
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from grid import ClimateGrid
from pyramid import Level
from sources import era5, noaa


@dataclass(frozen=True)
class Source:
    load: Callable[[Path], ClimateGrid]
    levels: list[Level] | None = None
    credit: str = ""


SOURCES = {
    "noaa": Source(noaa.load, credit=noaa.CREDIT),
    "era5": Source(era5.load, levels=era5.LEVELS, credit=era5.CREDIT),
}
