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
from sources import era5, jupiter, mars, mercury, moon, neptune, noaa, saturn, uranus, venus


@dataclass(frozen=True)
class Source:
    load: Callable[[Path], ClimateGrid]
    levels: list[Level] | None = None
    credit: str = ""
    # Even out resolution near the poles (see pyramid.even_out_poles).
    even_poles: bool = False


SOURCES = {
    "noaa": Source(noaa.load, credit=noaa.CREDIT),
    "era5": Source(era5.load, levels=era5.LEVELS, credit=era5.CREDIT),
    "mars": Source(mars.load, credit=mars.CREDIT),
    "mercury": Source(mercury.load, credit=mercury.CREDIT),
    "moon": Source(moon.load, credit=moon.CREDIT),
    # Radar noise makes pole spokes very visible on Venus.
    "venus": Source(venus.load, levels=venus.LEVELS, credit=venus.CREDIT, even_poles=True),
    "jupiter": Source(jupiter.load, credit=jupiter.CREDIT),
    "saturn": Source(saturn.load, credit=saturn.CREDIT),
    "uranus": Source(uranus.load, credit=uranus.CREDIT),
    "neptune": Source(neptune.load, credit=neptune.CREDIT),
}
