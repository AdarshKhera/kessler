import { describe, expect, it } from 'vitest'
import { orbitSummary, regimeOf, decayRiskOf } from '../src/lib/orbit'

const ISS = { MEAN_MOTION: 15.48850287, ECCENTRICITY: 0.0006732, INCLINATION: 51.6321, EPOCH: '2026-10-13T10:25:54.274080', BSTAR: 0.00011657223 }

describe('orbitSummary', () => {
  it('derives ISS-like altitude and period from mean motion', () => {
    const s = orbitSummary(ISS, Date.parse('2026-10-14T10:25:54Z'))
    expect(s.periodMin).toBeGreaterThan(92)
    expect(s.periodMin).toBeLessThan(94)
    expect(s.perigeeKm).toBeGreaterThan(400)
    expect(s.apogeeKm).toBeLessThan(440)
    expect(s.epochAgeHours).toBeCloseTo(24, 0)
    expect(s.regime).toBe('LEO')
  })
  it('does not mutate its input', () => {
    const copy = { ...ISS }
    orbitSummary(ISS, 0)
    expect(ISS).toEqual(copy)
  })
})

describe('regimeOf', () => {
  it('classifies regimes', () => {
    expect(regimeOf(500, 520)).toBe('LEO')
    expect(regimeOf(19000, 21000)).toBe('MEO')
    expect(regimeOf(35700, 35880)).toBe('GEO')
    expect(regimeOf(500, 39000)).toBe('HEO')
  })
})

describe('decayRiskOf', () => {
  it('flags low perigee', () => {
    expect(decayRiskOf(200)).toBe('IMMINENT')
    expect(decayRiskOf(320)).toBe('ELEVATED')
    expect(decayRiskOf(550)).toBe('LOW')
  })
})
