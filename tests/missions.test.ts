import { describe, expect, it } from 'vitest'
import { missionFor } from '../src/data/missions'
import { GROUPS, OPERATORS } from '../src/data/registry'
import { describePurpose } from '../src/lib/purpose'

const orbit = { regime: 'LEO', inclinationDeg: 98, perigeeKm: 700, apogeeKm: 705, eccentricity: 0.001 } as const

describe('missions', () => {
  it('recognises NASA craft by catalogue name', () => {
    for (const name of ['TERRA', 'AQUA', 'AURA', 'LANDSAT 9', 'ICESAT-2', 'GRACE-FO 1', 'HST', 'SWIFT', 'FGRST (GLAST)', 'SDO', 'MMS 3', 'TDRS 13', 'PUNCH-NFI (SMEX 15A)']) {
      expect(missionFor(name), name).toBeDefined()
    }
  })

  it('does not claim look-alikes', () => {
    for (const name of ['TERRA NOVA', 'IRIS-F2', 'TERRASAR-X', 'STARLINK-1234', 'AQUARIUS']) expect(missionFor(name), name).toBeUndefined()
  })

  it('points every mission at a real derived group whose operator exists', () => {
    for (const name of ['TERRA', 'HST', 'SDO', 'TDRS 3', 'STARLING 1', 'CREW DRAGON 13']) {
      const group = GROUPS.find((g) => g.id === missionFor(name)?.group)
      expect(group?.derived, name).toBe(true)
      expect(OPERATORS.some((o) => o.id === group?.operator), name).toBe(true)
    }
  })

  it('describes a named mission, not a debris fragment', () => {
    expect(describePurpose({ name: 'AQUA', operatorId: 'nasa', orbit }).category).toBe('Earth observation')
    expect(describePurpose({ name: 'AQUA DEB', operatorId: 'debris', orbit }).category).toBe('Debris')
  })
})
