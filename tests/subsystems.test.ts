import { describe, expect, it } from 'vitest'
import { modelSubsystems } from '../src/lib/subsystems'

const base = { perigeeKm: 550, apogeeKm: 552, epochAgeHours: 6, bstar: 0.0001, regime: 'LEO' as const }

describe('modelSubsystems', () => {
  it('is deterministic per NORAD id', () => {
    expect(modelSubsystems(44713, base)).toEqual(modelSubsystems(44713, base))
  })
  it('differs between satellites', () => {
    expect(modelSubsystems(1, base)).not.toEqual(modelSubsystems(2, base))
  })
  it('keeps every health value inside 0..100', () => {
    for (let id = 1; id < 300; id++) {
      for (const s of modelSubsystems(id, base)) {
        expect(s.health).toBeGreaterThanOrEqual(0)
        expect(s.health).toBeLessThanOrEqual(100)
      }
    }
  })
  it('degrades propulsion margin for very low perigee', () => {
    const low = modelSubsystems(7, { ...base, perigeeKm: 210 }).find((s) => s.key === 'propulsion')!
    const high = modelSubsystems(7, base).find((s) => s.key === 'propulsion')!
    expect(low.health).toBeLessThan(high.health)
  })
})
