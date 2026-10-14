import { describe, expect, it } from 'vitest'
import { isValidOmm } from '../src/lib/validate'

const good = {
  OBJECT_NAME: 'ISS (ZARYA)',
  OBJECT_ID: '1998-067A',
  EPOCH: '2026-10-13T10:25:54.274080',
  MEAN_MOTION: 15.4885,
  ECCENTRICITY: 0.0006,
  INCLINATION: 51.63,
  RA_OF_ASC_NODE: 74.9,
  ARG_OF_PERICENTER: 257.8,
  MEAN_ANOMALY: 102.2,
  NORAD_CAT_ID: 25544,
  BSTAR: 0.0001,
}

describe('isValidOmm', () => {
  it('accepts a complete record', () => {
    expect(isValidOmm(good)).toBe(true)
  })
  it('rejects non-objects', () => {
    expect(isValidOmm(null)).toBe(false)
    expect(isValidOmm('x')).toBe(false)
    expect(isValidOmm(5)).toBe(false)
  })
  it.each(['OBJECT_NAME', 'EPOCH', 'MEAN_MOTION', 'NORAD_CAT_ID', 'INCLINATION'])('rejects a record missing %s', (key) => {
    const { [key]: _omit, ...rest } = good as Record<string, unknown>
    expect(isValidOmm(rest)).toBe(false)
  })
  it('rejects unparseable epochs and non-finite numbers', () => {
    expect(isValidOmm({ ...good, EPOCH: 'yesterday-ish' })).toBe(false)
    expect(isValidOmm({ ...good, MEAN_MOTION: NaN })).toBe(false)
    expect(isValidOmm({ ...good, MEAN_MOTION: 0 })).toBe(false)
  })
})
