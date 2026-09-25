---
name: prepare-climate-data
description: Generate or refresh the monthly temperature data in public/data/<source>/ that the isotherm globe reads (NOAA or ERA5), or add a new data source. Use when data files are missing or stale, when the grid or pyramid format changes, or when adding or switching a climate data source.
---

# Preparing climate data

`scripts/data/prepare_data.py` downloads a climate dataset and converts it into
one of the app's formats in `public/data/<source>/`. The app picks the source
with `DATA_SOURCE` in `src/config.ts`.

## Setup (once)

From the repo root:

```bash
python3 -m venv .venv
.venv/bin/pip install -r scripts/data/requirements.txt
```

ERA5 also needs a free Copernicus CDS account: register at
https://cds.climate.copernicus.eu, accept the licence on the Download page of
"ERA5 monthly averaged data on single levels", and put your token in
`~/.cdsapirc` (never in the repo):

```
url: https://cds.climate.copernicus.eu/api
key: <your token>
```

## Generate data

```bash
.venv/bin/python scripts/data/prepare_data.py noaa
.venv/bin/python scripts/data/prepare_data.py era5
```

- Downloads are cached in `scripts/data/.cache/` (gitignored). Delete a file
  there to force a fresh download.
- ERA5 is fetched one year per request (30 requests; the CDS queue can take a
  while). An interrupted run resumes from the cached years. The averaged
  climatology is cached as `era5-t2m-monthly-1991-2020.npz`, so later runs
  only rewrite the output.

| id     | dataset                                            | native grid         | format |
|--------|----------------------------------------------------|---------------------|--------|
| `noaa` | NCEP/NCAR Reanalysis 1, 2 m air temp, 1991-2020    | T62 Gaussian, ~1.9° | 1      |
| `era5` | ERA5 monthly means, 2 m air temp, 1991-2020        | 0.25° regular       | 2      |

## Output formats

Data files go in a versioned folder named after a hash of their contents,
`public/data/<source>/<hash>/`. `manifest.json` stays at
`public/data/<source>/` and names that folder in `dataDir`
(`scripts/data/publish.py`). Regenerating removes the old folder. The site
caches data folders forever, so never edit files inside one by hand.

Both formats share the grid conventions: rows north→south from +90, columns
west→east from -180 **without** repeating +180 (the app wraps it), values in
tenths of °C. Each pole row holds a single value (a pole is one point);
`ClimateGrid.validate()` enforces this, because isotherms otherwise run into
the pole and can't be joined.

**Format 1** (`grid.py`, for small sources): `manifest.json` with the grid
geometry plus `month-01.json` .. `month-12.json` holding
`{"month": n, "values": [...]}`, row-major.

**Format 2** (`pyramid.py`, for detailed sources): a resolution pyramid.
`manifest.json` has `"format": 2` and a `levels` list, coarsest first. Every
`.bin` file is little-endian int16, `[month][row][col]`, all 12 months.
- Untiled levels (`file`) cover the whole globe. The app animates with the
  first one and shows the last untiled one when paused.
- Tiled levels (`tiles`, `tileSpan`, `tilePoints`, ...) are for zooming. A tile
  includes both edges, so neighbours share their edge rows and columns.

ERA5 levels: 2° and 1° untiled, 0.5° in 60° tiles, 0.25° in 30° tiles
(about 0.4 + 1.6 + 6.3 + 25 MB).

Change a format only in `grid.py` / `pyramid.py`, and update the app's reader
(`src/data/grid.ts`) to match.

## Verify after generating

```bash
.venv/bin/python -m unittest discover scripts/data   # pyramid tests
npm test                                             # app tests (use NOAA data)
```

Sanity-check a few known points. Expected values (NOAA; ERA5 should agree
within a few degrees and be sharper around mountains and coasts):

- global mean ≈ 14 °C
- Moscow ≈ -10 °C in Jan, ≈ 19 °C in Jul
- South Pole ≈ -23 °C in Jan, ≈ -58 °C in Jul
- no jump between the columns at lon -180 and the last column

## Adding a source

1. Create `scripts/data/sources/<id>.py` with `load(cache_dir) -> ClimateGrid`.
   Convert to °C, use `to_lons_from_minus_180`, `to_regular_lats` and
   `uniform_poles` from `grid.py` as needed, and set `source="<id>"`.
2. Register it in `SOURCES` in `scripts/data/sources/__init__.py`, with
   `levels` for format 2 and a `credit` line the data licence asks for.
3. Add any new Python dependencies to `scripts/data/requirements.txt`.
4. Run `prepare_data.py <id>`, verify as above, add a row to the table here,
   and add the id to `DATA_SOURCE`'s type in `src/config.ts`.
