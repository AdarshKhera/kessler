import type { Sat } from '../data/types'
import { orbitSummary } from './orbit'

export interface Shell {
  readonly inclinationDeg: number
  readonly altitudeKm: number
  readonly count: number
}

export interface FleetSummary {
  readonly count: number
  readonly launches: number
  readonly latestLaunch: string | null
  readonly medianAltitudeKm: number
  readonly shells: readonly Shell[]
}

/** International designator "2019-074AB" -> launch "2019-074". */
export function launchIdOf(objectId: string): string | null {
  return /^(\d{4}-\d{3})/.exec(objectId)?.[1] ?? null
}

const ALT_BUCKET_KM = 20

export function fleetSummary(sats: readonly Sat[], operatorIndex: number, nowMs: number): FleetSummary {
  const members = sats.filter((s) => s.operatorIndex === operatorIndex)
  const launches = new Set<string>()
  const shells = new Map<string, Shell>()
  const alts: number[] = []
  for (const s of members) {
    const id = launchIdOf(String(s.omm.OBJECT_ID))
    if (id) launches.add(id)
    const o = orbitSummary(s.omm, nowMs)
    const alt = (o.perigeeKm + o.apogeeKm) / 2
    alts.push(alt)
    const inc = Math.round(o.inclinationDeg)
    const bucket = Math.round(alt / ALT_BUCKET_KM) * ALT_BUCKET_KM
    const key = `${inc}/${bucket}`
    const prev = shells.get(key)
    shells.set(key, { inclinationDeg: inc, altitudeKm: bucket, count: (prev?.count ?? 0) + 1 })
  }
  alts.sort((a, b) => a - b)
  return {
    count: members.length,
    launches: launches.size,
    latestLaunch: [...launches].sort().at(-1) ?? null,
    medianAltitudeKm: alts.length ? alts[Math.floor(alts.length / 2)] : 0,
    shells: [...shells.values()].sort((a, b) => b.count - a.count).slice(0, 4),
  }
}
