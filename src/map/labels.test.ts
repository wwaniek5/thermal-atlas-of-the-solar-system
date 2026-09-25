import { geoOrthographic } from 'd3-geo'
import { describe, expect, it } from 'vitest'
import type { Isotherm } from './isotherms'
import { placeLabels } from './labels'

/** An isotherm along a circle of latitude. */
function parallel(lat: number): Isotherm {
  const loop = Array.from({ length: 73 }, (_, i) => [-180 + i * 5, lat])
  return {
    threshold: lat,
    area: { type: 'Polygon', coordinates: [loop] },
    line: { type: 'MultiLineString', coordinates: [loop] },
  }
}

const projection = geoOrthographic().fitExtent([[0, 0], [640, 640]], { type: 'Sphere' }).rotate([0, 0])

describe('placeLabels', () => {
  it('labels visible isotherms, keeping labels apart', () => {
    const labels = placeLabels([parallel(0), parallel(20), parallel(40)], [25, 20, 15], 0, projection)
    expect(labels.length).toBeGreaterThan(0)
    for (const a of labels) {
      for (const b of labels) {
        if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(70)
      }
    }
    expect(new Set(labels.map((l) => l.text))).toEqual(new Set(['25', '20', '15']))
  })

  it('never labels the far side or the rim of the globe', () => {
    const labels = placeLabels([parallel(80)], [0], 0, geoOrthographic().rotate([0, 80]))
    expect(labels).toEqual([]) // the 80°N circle is on the far side
  })

  it('places the freezing line first and marks it', () => {
    const labels = placeLabels([parallel(10), parallel(12)], [5, 0], 0, projection, { minGap: 1000 })
    expect(labels).toHaveLength(1)
    expect(labels[0]).toMatchObject({ text: '0', freezing: true })
  })
})
