import type { ProbeFile } from '../scene/minor'
import type { SmallBodyFile } from './smallBodies'

export interface SpaceData {
  readonly probes: ProbeFile | null
  readonly small: SmallBodyFile | null
}

async function fetchJson<T>(name: string): Promise<T | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}space/${name}`)
    return res.ok ? ((await res.json()) as T) : null
  } catch {
    return null
  }
}

let cached: Promise<SpaceData> | null = null

/** NASA/JPL spacecraft paths and small-body orbits, shipped as static files (JPL's APIs cannot be called from a browser). */
export function loadSpaceData(): Promise<SpaceData> {
  cached ??= Promise.all([fetchJson<ProbeFile>('probes.json'), fetchJson<SmallBodyFile>('small-bodies.json')]).then(([probes, small]) => ({ probes, small }))
  return cached
}
