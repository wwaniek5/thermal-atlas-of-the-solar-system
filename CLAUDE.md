# Thermal Atlas of the Solar System

https://isotherms.org. React + TypeScript (Vite) site showing temperature isotherms of
the planets and the Moon on a D3 orthographic globe, with a time slider (or orbit
diagram) and zoom. One page per body (`src/bodies.ts`).

## Commands

```bash
npm run dev      # http://localhost:5173
npm test         # vitest
npx tsc -b && npx oxlint && npm run build
.venv/bin/python -m unittest discover scripts/data   # data pipeline tests
```

## Layout

- `src/config.ts`: `DATA_SOURCE` switches between `'era5'` (default, 0.25° tiled
  pyramid) and `'noaa'` (~1.9°). Keep both sources' data.
- `src/map/isotherms.ts`: contours on the grid, cut at grid edges and rejoined across
  the ±180° seam. Grid-edge, pole and seam handling here is subtle; the tests in
  `isotherms.test.ts` cover past bugs, so keep them passing.
- `src/data/tiles.ts`, `src/data/useRegion.ts`, `src/map/view.ts`: zoom detail.
  The finest tile level that fits a point budget is loaded for what's on screen.
- `src/seo.ts`, `scripts/prerender.ts`: page titles and descriptions; the build
  writes a static page per body (`dist/<id>.html`), `sitemap.xml` and `robots.txt`.
  A body needs a `description` in `bodies.ts`.
- `scripts/data/`: Python pipeline that writes `public/data/<source>/`
  (see the `prepare-climate-data` skill).
- `infra/`: Terraform for S3 + CloudFront hosting (see the `deploy-site` skill).

## Conventions

- Check visual changes in the running app (Chrome), not just tests.
- Colors: blue ↔ red diverging scale with gray at 0 °C (`src/map/colors.ts`).
