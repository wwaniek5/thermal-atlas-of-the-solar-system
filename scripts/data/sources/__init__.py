"""Data source registry. To add a source (e.g. ERA5), write a module with a
`load(cache_dir) -> ClimateGrid` function and register it here."""

from sources import noaa

SOURCES = {
    "noaa": noaa.load,
}
