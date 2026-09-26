import { describe, expect, it } from 'vitest'
import { saturnLabel, saturnYear } from './saturn'

describe('Saturn timeline', () => {
  it('runs from 2007 to 2017 without wrapping', () => {
    expect(saturnYear(0)).toBe(2007)
    expect(saturnYear(6)).toBe(2012)
    expect(saturnYear(12)).toBe(2017)
    expect(saturnYear(13)).toBe(2017)
  })

  it('labels the date and season', () => {
    expect(saturnLabel(0)).toBe('January 2007 · Northern winter')
    expect(saturnLabel(12)).toBe('January 2017 · Northern spring')
    // August 2009 is the equinox.
    expect(saturnLabel((12 * (2009 + 7 / 12 - 2007)) / 10)).toBe('August 2009 · Equinox')
  })
})
