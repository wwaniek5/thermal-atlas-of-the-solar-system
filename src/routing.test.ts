import { describe, expect, it } from 'vitest'
import { bodyFromPath, pathFor } from './routing'

describe('routes', () => {
  it('maps a body to its path and back', () => {
    expect(pathFor('earth')).toBe('/earth')
    expect(bodyFromPath('/earth')).toBe('earth')
  })

  it('tolerates a trailing slash and capitals', () => {
    expect(bodyFromPath('/earth/')).toBe('earth')
    expect(bodyFromPath('/Earth')).toBe('earth')
  })

  it('names no body for the root, unknown paths, or bodies without data yet', () => {
    expect(bodyFromPath('/')).toBeNull()
    expect(bodyFromPath('/pluto')).toBeNull()
    expect(bodyFromPath('/mars')).toBeNull()
  })
})
