---
name: prepare-climate-data
description: Generate or refresh the monthly temperature grids in public/data/<source>/ that the isotherm globe reads, or add a new data source (e.g. ERA5). Use when data files are missing or stale, when the grid format changes, or when adding or switching a climate data source.
---

# Preparing climate data

`scripts/data/prepare_data.py` downloads a climate dataset and converts it into
the app's common grid format in `public/data/<source>/`.

## Setup (once)

From the repo root:

```bash
python3 -m venv .venv
.venv/bin/pip install -r scripts/data/requirements.txt
```

## Generate data

```bash
.venv/bin/python scripts/data/prepare_data.py noaa
```

- Raw downloads are cached in `scripts/data/.cache/` (gitignored). Delete a
  file there to force a fresh download.
- The output in `public/data/<source>/` is committed, so the app works without
  running Python.

Available sources:

| id     | dataset                                             | native grid           |
|--------|-----------------------------------------------------|-----------------------|
| `noaa` | NCEP/NCAR Reanalysis 1, 2 m air temp, 1991-2020 LTM | T62 Gaussian, ~1.9°   |

## Output format

The contract with the web app is defined in `scripts/data/grid.py`:

- `manifest.json` has `nlat`, `nlon`, `lat0` (90), `dlat` (negative),
  `lon0` (-180), `dlon`, `scale` (0.1), `units`, `period`, and `months` (file names)
- `month-01.json` .. `month-12.json` contain `{"month": n, "values": [...]}`,
  integers in tenths of °C, row-major (north→south, west→east),
  `index = row * nlon + col`
- The last column does not repeat +180°. The app wraps it onto the first.

Change the format only in `grid.py`, and update the app's reader to match.

## Verify after generating

Sanity-check a few known points. Expected NOAA values (approximate, since the
grid is coarse):

- global mean ≈ 14 °C
- Moscow ≈ -10 °C in Jan, ≈ 19 °C in Jul
- South Pole ≈ -23 °C in Jan, ≈ -58 °C in Jul
- no jump between the columns at lon -180 and lon 178.125

`ClimateGrid.validate()` already rejects missing values, uneven spacing, and
wrong axis ranges.

## Adding a source (e.g. ERA5)

1. Create `scripts/data/sources/<id>.py` with `load(cache_dir) -> ClimateGrid`.
   Convert to °C, use `to_lons_from_minus_180` and `to_regular_lats` from
   `grid.py` (or regrid with an equivalent method), and set `source="<id>"`.
2. Register it in `SOURCES` in `scripts/data/sources/__init__.py`.
3. Add any new Python dependencies to `scripts/data/requirements.txt`.
4. Run `prepare_data.py <id>`, verify as above, and add a row to the table here.

ERA5 needs a free Copernicus CDS account and API key. Never commit the key.
Keep it in `~/.cdsapirc`.
