# Thermal Atlas of the Solar System

**https://isotherms.org**

Interactive temperature maps of the planets and the Moon: isotherms (lines of
equal temperature) on a 3D globe that you can rotate and zoom, moving through
the seasons, a solar day or an orbit.

## Data

| Body | Source |
|---|---|
| Mercury, Moon | Thermal model computed for this site (Hayne et al. 2017 regolith properties) |
| Venus | Magellan topography (USGS Astrogeology) with the VIRA temperature profile (Seiff et al. 1985) |
| Earth | ERA5, 1991–2020 averages. Contains modified Copernicus Climate Change Service information |
| Mars | NASA Ames Mars Climate Modeling Center, FV3-based Mars GCM |
| Jupiter | ESO VLT/VISIR images calibrated by Bardet et al. (2024), CC BY 4.0 |
| Saturn | Cassini/CIRS temperatures reconstructed by Fletcher et al. (2018) |
| Uranus, Neptune | Voyager 2/IRIS temperatures retrieved by Fletcher et al. (2018) |

The data remain under their providers' terms.

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm test
```

The data pipeline is in `scripts/data/`, and hosting (AWS S3 + CloudFront,
Cloudflare DNS) is in `infra/`.

## License

The code is MIT licensed, see [LICENSE](LICENSE).
