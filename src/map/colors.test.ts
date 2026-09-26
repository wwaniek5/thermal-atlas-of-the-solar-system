import { describe, expect, it } from 'vitest'
import { EARTH_COLORS, makeColorScale } from './colors'

describe('makeColorScale', () => {
  const earth = makeColorScale(EARTH_COLORS)
  const mars = makeColorScale([-130, -70, -15])

  it("keeps Earth's colors: navy at -50 °C, gray at 0 °C, dark red at 35 °C", () => {
    expect(earth(-50)).toBe('rgb(13, 54, 107)')
    expect(earth(0)).toBe('rgb(240, 239, 236)')
    expect(earth(35)).toBe('rgb(122, 22, 22)')
  })

  it("stretches the same palette onto another body's range", () => {
    expect(mars(-130)).toBe(earth(-50))
    expect(mars(-70)).toBe(earth(0))
    expect(mars(-15)).toBe(earth(35))
    expect(mars(-100)).toBe(earth(-25)) // halfway down the blue arm
  })

  it('clamps beyond the ends', () => {
    expect(mars(-200)).toBe(earth(-50))
    expect(mars(20)).toBe(earth(35))
  })
})
