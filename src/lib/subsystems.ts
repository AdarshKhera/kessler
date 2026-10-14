import type { Regime } from './orbit'

export interface SubsystemInput {
  readonly perigeeKm: number
  readonly apogeeKm: number
  readonly epochAgeHours: number
  readonly bstar: number
  readonly regime: Regime
}

export interface Subsystem {
  readonly key: 'power' | 'comms' | 'thermal' | 'propulsion' | 'adcs'
  readonly label: string
  readonly health: number
}

/** mulberry32: tiny seeded PRNG so a satellite always gets the same modelled values. */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)))

/**
 * MODELLED, not telemetry: nobody publishes real subsystem health. Seeded noise plus
 * real orbital signals (drag/perigee for propulsion, TLE staleness for ADCS) so the
 * numbers react to the actual orbit.
 */
export function modelSubsystems(noradId: number, o: SubsystemInput): Subsystem[] {
  const r = rng(noradId * 2654435761)
  const base = () => 82 + r() * 16
  const lowPerigeePenalty = o.perigeeKm < 350 ? (350 - o.perigeeKm) * 0.35 : 0
  const dragPenalty = Math.min(20, Math.abs(o.bstar) * 40000)
  const stalePenalty = Math.min(25, o.epochAgeHours / 8)
  return [
    { key: 'power', label: 'Power', health: clamp(base()) },
    { key: 'comms', label: 'Comms', health: clamp(base()) },
    { key: 'thermal', label: 'Thermal', health: clamp(base() - (o.regime === 'LEO' ? 3 : 0)) },
    { key: 'propulsion', label: 'Propulsion', health: clamp(base() - lowPerigeePenalty - dragPenalty) },
    { key: 'adcs', label: 'Attitude', health: clamp(base() - stalePenalty) },
  ]
}
