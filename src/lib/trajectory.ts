import type { Vec3 } from './ephemeris'

/** A spacecraft path sampled at equal time steps, positions in micro-AU (see scripts/snapshot-space.mjs). */
export interface Track {
  readonly startJd: number
  readonly stepDays: number
  readonly pos: readonly number[]
}

const SCALE = 1e-6

export const trackEndJd = (t: Track): number => t.startJd + ((t.pos.length / 3 - 1) * t.stepDays)

const at = (t: Track, i: number, axis: number): number => t.pos[Math.min(t.pos.length / 3 - 1, Math.max(0, i)) * 3 + axis] * SCALE

/**
 * Where the craft is at Julian date `jd`: a smooth Catmull-Rom curve through the samples.
 * `inRange` is false when the date falls outside the published trajectory; the nearest end point is returned.
 */
export function trackPosition(t: Track, jd: number, out: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 }): { pos: Vec3; inRange: boolean } {
  const last = t.pos.length / 3 - 1
  const f = (jd - t.startJd) / t.stepDays
  const inRange = f >= 0 && f <= last
  const c = Math.min(last, Math.max(0, f))
  const i = Math.min(last - 1, Math.floor(c))
  const u = last === 0 ? 0 : c - i
  const u2 = u * u
  const u3 = u2 * u
  const axes = [0, 0, 0]
  for (let k = 0; k < 3; k++) {
    const p0 = at(t, i - 1, k)
    const p1 = at(t, i, k)
    const p2 = at(t, i + 1, k)
    const p3 = at(t, i + 2, k)
    axes[k] = 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3)
  }
  out.x = axes[0]
  out.y = axes[1]
  out.z = axes[2]
  return { pos: out, inRange }
}

/** Speed in km/s from two nearby samples. */
export function trackSpeedKmS(t: Track, jd: number): number {
  const a = { x: 0, y: 0, z: 0 }
  const b = { x: 0, y: 0, z: 0 }
  const dt = Math.min(0.5, t.stepDays / 2)
  trackPosition(t, jd - dt, a)
  trackPosition(t, jd + dt, b)
  return (Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) * 149_597_870.7) / (2 * dt * 86_400)
}
