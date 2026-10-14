import { EARTH_RADIUS_KM } from './frames'

const MU_KM3_S2 = 398600.4418

export type Regime = 'LEO' | 'MEO' | 'GEO' | 'HEO'
export type DecayRisk = 'LOW' | 'ELEVATED' | 'IMMINENT'

export interface OrbitElements {
  readonly MEAN_MOTION: number | string
  readonly ECCENTRICITY: number | string
  readonly INCLINATION: number | string
  readonly EPOCH: string
  readonly BSTAR: number | string
}

export interface OrbitSummary {
  readonly periodMin: number
  readonly perigeeKm: number
  readonly apogeeKm: number
  readonly inclinationDeg: number
  readonly eccentricity: number
  readonly epochAgeHours: number
  readonly bstar: number
  readonly regime: Regime
  readonly decayRisk: DecayRisk
}

export function regimeOf(perigeeKm: number, apogeeKm: number): Regime {
  if (apogeeKm - perigeeKm > 8000) return 'HEO'
  if (apogeeKm < 2200) return 'LEO'
  if (perigeeKm > 35000 && apogeeKm < 36600) return 'GEO'
  return 'MEO'
}

export function decayRiskOf(perigeeKm: number): DecayRisk {
  if (perigeeKm < 250) return 'IMMINENT'
  if (perigeeKm < 350) return 'ELEVATED'
  return 'LOW'
}

export function orbitSummary(el: OrbitElements, nowMs: number): OrbitSummary {
  const meanMotion = Number(el.MEAN_MOTION)
  const ecc = Number(el.ECCENTRICITY)
  const nRadS = (meanMotion * 2 * Math.PI) / 86400
  const a = Math.cbrt(MU_KM3_S2 / (nRadS * nRadS))
  const perigeeKm = a * (1 - ecc) - EARTH_RADIUS_KM
  const apogeeKm = a * (1 + ecc) - EARTH_RADIUS_KM
  const epochMs = Date.parse(el.EPOCH.endsWith('Z') ? el.EPOCH : `${el.EPOCH}Z`)
  return {
    periodMin: 1440 / meanMotion,
    perigeeKm,
    apogeeKm,
    inclinationDeg: Number(el.INCLINATION),
    eccentricity: ecc,
    epochAgeHours: (nowMs - epochMs) / 3_600_000,
    bstar: Number(el.BSTAR),
    regime: regimeOf(perigeeKm, apogeeKm),
    decayRisk: decayRiskOf(perigeeKm),
  }
}
