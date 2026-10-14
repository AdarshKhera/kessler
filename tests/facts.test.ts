import { describe, expect, it } from 'vitest'
import { computeFacts } from '../src/lib/facts'
import type { Sat } from '../src/data/types'

const mk = (index: number, id: number, mm: number, ecc: number, operatorIndex: number, name = `S${index}`): Sat =>
  ({
    index,
    id,
    name,
    groupIndex: 0,
    operatorIndex,
    omm: { OBJECT_NAME: name, OBJECT_ID: '2000-001A', MEAN_MOTION: mm, ECCENTRICITY: ecc, INCLINATION: 51.6, EPOCH: '2026-10-13T00:00:00' },
  }) as unknown as Sat

describe('computeFacts', () => {
  it('returns facts with titles and bodies for a normal catalogue', () => {
    const sats = [mk(0, 25544, 15.49, 0.0007, 0, 'ISS (ZARYA)'), mk(1, 2, 1.0027, 0.0001, 1), mk(2, 3, 2.0, 0.7, 2)]
    const facts = computeFacts(sats, Date.parse('2026-10-14'), { debrisOperatorIndex: 2 })
    expect(facts.length).toBeGreaterThanOrEqual(4)
    for (const f of facts) {
      expect(f.title.length).toBeGreaterThan(0)
      expect(f.body.length).toBeGreaterThan(0)
    }
  })
  it('does not throw on an empty catalogue', () => {
    expect(() => computeFacts([], 0)).not.toThrow()
  })
  it('mentions the next launch when supplied', () => {
    const facts = computeFacts([mk(0, 1, 15, 0.001, 0)], 0, { nextLaunch: { name: 'Falcon 9 | Starlink 9-1', netMs: 3_600_000 * 5 } })
    expect(facts.some((f) => f.body.includes('Starlink 9-1'))).toBe(true)
  })
})
