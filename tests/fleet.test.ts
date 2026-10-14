import { describe, expect, it } from 'vitest'
import { fleetSummary, launchIdOf } from '../src/lib/fleet'
import type { Sat } from '../src/data/types'

const mk = (index: number, objectId: string, inc: number, mm: number, operatorIndex = 0, groupIndex = 0): Sat =>
  ({
    index,
    id: 1000 + index,
    name: `SAT ${index}`,
    groupIndex,
    operatorIndex,
    omm: { OBJECT_NAME: `SAT ${index}`, OBJECT_ID: objectId, MEAN_MOTION: mm, ECCENTRICITY: 0.0001, INCLINATION: inc, EPOCH: '2026-10-13T00:00:00' },
  }) as unknown as Sat

describe('launchIdOf', () => {
  it('strips the piece letters from an international designator', () => {
    expect(launchIdOf('2019-074A')).toBe('2019-074')
    expect(launchIdOf('2019-074BC')).toBe('2019-074')
  })
  it('returns null for junk', () => {
    expect(launchIdOf('nope')).toBeNull()
  })
})

describe('fleetSummary', () => {
  const sats = [
    mk(0, '2024-001A', 53, 15.06),
    mk(1, '2024-001B', 53, 15.06),
    mk(2, '2024-002A', 53, 15.06),
    mk(3, '2024-003A', 97.6, 15.2),
    mk(4, '2020-009A', 10, 2, 1), // other operator, must be ignored
  ]
  it('counts satellites and distinct launches for one operator', () => {
    const s = fleetSummary(sats, 0, Date.parse('2026-10-14'))
    expect(s.count).toBe(4)
    expect(s.launches).toBe(3)
    expect(s.latestLaunch).toBe('2024-003')
  })
  it('groups into shells by inclination and altitude, biggest first', () => {
    const s = fleetSummary(sats, 0, Date.parse('2026-10-14'))
    expect(s.shells[0].count).toBe(3)
    expect(s.shells[0].inclinationDeg).toBe(53)
    expect(s.shells.length).toBe(2)
  })
  it('handles an operator with no satellites', () => {
    const s = fleetSummary(sats, 5, 0)
    expect(s.count).toBe(0)
    expect(s.shells).toEqual([])
    expect(s.latestLaunch).toBeNull()
  })
})
