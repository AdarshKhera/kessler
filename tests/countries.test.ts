import { describe, expect, it } from 'vitest'
import { COUNTRIES, countryOf, countrySummary, listCountries, satelliteFamily } from '../src/lib/countries'
import type { Sat } from '../src/data/types'

const mk = (index: number, name: string, mm = 15, ecc = 0.001): Sat =>
  ({
    index,
    id: 1000 + index,
    name,
    groupIndex: 0,
    operatorIndex: 0,
    omm: { OBJECT_NAME: name, OBJECT_ID: `2020-0${10 + index}A`, MEAN_MOTION: mm, ECCENTRICITY: ecc, INCLINATION: 98, EPOCH: '2026-10-13T00:00:00' },
  }) as unknown as Sat

describe('countryOf', () => {
  it('knows India and the United States', () => {
    expect(countryOf('IND').name).toBe('India')
    expect(countryOf('US').name).toBe('United States')
  })
  it('falls back gracefully for unknown codes', () => {
    expect(countryOf('ZZZ').name).toBe('ZZZ')
    expect(countryOf(undefined).name).toBe('Unknown')
  })
  it('every listed country has a name and flag', () => {
    for (const c of Object.values(COUNTRIES)) {
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.flag.length).toBeGreaterThan(0)
    }
  })
})

describe('satelliteFamily', () => {
  it('takes the leading word of a name', () => {
    expect(satelliteFamily('GSAT-30')).toBe('GSAT')
    expect(satelliteFamily('CARTOSAT-2A')).toBe('CARTOSAT')
    expect(satelliteFamily('IRNSS-1A')).toBe('IRNSS')
    expect(satelliteFamily('NVS-01 (IRNSS-1J)')).toBe('NVS')
  })
})

describe('listCountries', () => {
  it('counts per owner, biggest first, ignoring unknowns', () => {
    const owners = ['IND', 'IND', 'US', undefined, 'IND', 'US']
    const list = listCountries(owners, 1)
    expect(list.map((c) => c.code)).toEqual(['IND', 'US'])
    expect(list[0].count).toBe(3)
  })
  it('never lists unassigned objects as a country', () => {
    expect(listCountries(['TBD', 'TBD', 'US'], 1).map((c) => c.code)).toEqual(['US'])
  })
  it('drops owners below the minimum', () => {
    expect(listCountries(['IND', 'US', 'US'], 2).map((c) => c.code)).toEqual(['US'])
  })
})

describe('countrySummary', () => {
  const sats = [mk(0, 'GSAT-1'), mk(1, 'GSAT-2'), mk(2, 'CARTOSAT-2A'), mk(3, 'OTHER 1')]
  const owners = ['IND', 'IND', 'IND', 'US']
  it('summarises one country', () => {
    const s = countrySummary(sats, owners, 'IND', Date.parse('2026-10-14'))
    expect(s.count).toBe(3)
    expect(s.sharePct).toBeCloseTo(75)
    expect(s.members).toEqual([2, 0, 1].sort((a, b) => sats[a].name.localeCompare(sats[b].name)))
    expect(s.families[0]).toEqual({ name: 'GSAT', count: 2 })
    expect(s.regimes.LEO).toBe(3)
  })
  it('handles a country with nothing', () => {
    expect(countrySummary(sats, owners, 'FR', 0).count).toBe(0)
  })
})
