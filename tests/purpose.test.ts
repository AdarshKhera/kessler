import { describe, expect, it } from 'vitest'
import { describePurpose } from '../src/lib/purpose'
import type { OrbitSummary } from '../src/lib/orbit'

const orbit = (o: Partial<OrbitSummary> = {}): OrbitSummary => ({
  periodMin: 95,
  perigeeKm: 550,
  apogeeKm: 560,
  inclinationDeg: 53,
  eccentricity: 0.0001,
  epochAgeHours: 3,
  bstar: 0.0001,
  regime: 'LEO',
  decayRisk: 'LOW',
  ...o,
})

const geo = orbit({ periodMin: 1436, perigeeKm: 35780, apogeeKm: 35795, inclinationDeg: 0.1, regime: 'GEO' })
const who = (name: string, operatorId = 'other', o = orbit()) => describePurpose({ name, operatorId, orbit: o })

describe('describePurpose', () => {
  it('recognises well-known craft by name', () => {
    expect(who('ISS (ZARYA)', 'stations').category).toBe('Space station')
    expect(who('HST').category).toBe('Space telescope')
    expect(who('STARLINK-1234', 'spacex').category).toBe('Broadband internet')
    expect(who('IRNSS-1A', 'other', geo).category).toBe('Navigation')
    expect(who('GSAT-30', 'other', geo).category).toBe('Communications')
    expect(who('CARTOSAT-2A').category).toBe('Earth observation')
    expect(who('INSAT-3D', 'other', geo).category).toBe('Weather')
    expect(who('NOAA 19').category).toBe('Weather')
  })
  it('treats debris and rocket bodies honestly', () => {
    expect(who('FENGYUN 1C DEB', 'debris').category).toBe('Debris')
    expect(who('SL-16 R/B').category).toBe('Rocket body')
  })
  it('does not claim to know classified payloads', () => {
    const p = who('USA 245')
    expect(p.category).toBe('Government')
    expect(p.line.toLowerCase()).toContain('classified')
  })
  it('falls back to the fleet, then to the orbit', () => {
    expect(who('SOMETHING NEW', 'gps', orbit({ regime: 'MEO' })).category).toBe('Navigation')
    expect(who('UNKNOWN SAT', 'other', geo).basis).toBe('orbit')
    expect(who('UNKNOWN SAT', 'other', orbit({ inclinationDeg: 97.6, perigeeKm: 600, apogeeKm: 610 })).category).toBe('Earth observation')
  })
  it('marks guesses as inferred and name matches as known', () => {
    expect(who('ISS (ZARYA)', 'stations').basis).toBe('name')
    expect(who('UNKNOWN SAT', 'other', geo).basis).toBe('orbit')
  })
  it('always returns a non-empty line', () => {
    expect(who('???').line.length).toBeGreaterThan(10)
  })
})
