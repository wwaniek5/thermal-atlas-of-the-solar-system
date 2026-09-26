import { geoDistance, geoOrthographic } from 'd3-geo'
import { describe, expect, it } from 'vitest'
import type { Isotherm } from './isotherms'
import { createLabelPlacer, placeLabels } from './labels'

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

  it('keeps labels on the same spot of the Earth when the globe rotates', () => {
    const isos = [parallel(0), parallel(20), parallel(40)]
    const values = [25, 20, 15]
    const view = (lon: number) => geoOrthographic().fitExtent([[0, 0], [640, 640]], { type: 'Sphere' }).rotate([lon, -10])
    const before = placeLabels(isos, values, 0, view(0))
    const after = placeLabels(isos, values, 0, view(-8), before)
    // Every label still well inside the new view keeps its spot.
    const stillInView = before.filter((l) => geoDistance(l.lonLat, [8, 10]) < (60 * Math.PI) / 180)
    expect(stillInView.length).toBeGreaterThan(0)
    for (const label of stillInView) {
      expect(after.map((l) => l.lonLat)).toContainEqual(label.lonLat)
    }
  })

  it('lets labels follow their isotherm when it moves', () => {
    const before = placeLabels([parallel(20)], [20], 0, projection)
    const after = placeLabels([parallel(22)], [20], 0, projection, before)
    expect(after).toHaveLength(before.length)
    after.forEach((label, i) => {
      expect(label.lonLat[0]).toBe(before[i].lonLat[0]) // same longitude
      expect(label.lonLat[1]).toBe(22) // moved north with the line
    })
  })

  it('copes with previous labels whose isotherms are not available', () => {
    const before = placeLabels([parallel(20)], [20], 0, projection)
    expect(placeLabels([], [20], 0, projection, before)).toEqual([])
  })

  it('moves the last labels with the view without re-placing them', () => {
    const placer = createLabelPlacer()
    const view = (lon: number) => geoOrthographic().fitExtent([[0, 0], [640, 640]], { type: 'Sphere' }).rotate([lon, 0])
    const placed = placer.place([parallel(0), parallel(30)], [25, 15], 0, view(0))
    const moved = placer.move(view(-5))
    expect(moved.length).toBeGreaterThan(0)
    for (const l of moved) {
      const same = placed.find((p) => p.lonLat === l.lonLat)!
      const [x, y] = view(-5)(l.lonLat)!
      expect([l.x, l.y]).toEqual([x, y]) // same spot on the planet, new screen position
      expect(same.text).toBe(l.text)
    }
  })

  it('places the freezing line first and marks it', () => {
    const labels = placeLabels([parallel(10), parallel(12)], [5, 0], 0, projection, [], { minGap: 1000 })
    expect(labels).toHaveLength(1)
    expect(labels[0]).toMatchObject({ text: '0', freezing: true })
  })
})
