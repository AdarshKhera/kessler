import type { Vec3 } from './ephemeris'

/** Gaussian gravitational constant: sqrt(GM of the Sun) in AU^1.5 per day. */
export const GAUSS_K = 0.01720209895
const RAD = Math.PI / 180

/** Orbit around the Sun in the ecliptic J2000 frame. q in AU, angles in degrees, tp is a Julian date. */
export interface Elements {
  readonly q: number
  readonly e: number
  readonly i: number
  readonly om: number
  readonly w: number
  readonly tp: number
}

/** Solve M = E - e sin E (ellipse). Newton's method converges in a few steps for any e < 1. */
export function solveElliptic(m: number, e: number): number {
  const wrapped = ((((m + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI
  let ea = e < 0.8 ? wrapped : Math.PI * Math.sign(wrapped || 1)
  for (let n = 0; n < 80; n++) {
    const d = (ea - e * Math.sin(ea) - wrapped) / (1 - e * Math.cos(ea))
    ea -= d
    if (Math.abs(d) < 1e-12) break
  }
  return ea
}

/** Solve M = e sinh H - H (hyperbola). */
export function solveHyperbolic(m: number, e: number): number {
  let h = Math.asinh(m / e)
  for (let n = 0; n < 60; n++) {
    const d = (e * Math.sinh(h) - h - m) / (e * Math.cosh(h) - 1)
    h -= d
    if (Math.abs(d) < 1e-12) break
  }
  return h
}

/** Position in the orbital plane, then rotated into ecliptic axes. Works for ellipses (e < 1) and hyperbolas (e > 1). */
export function positionFromElements(el: Elements, jd: number, out: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 }): Vec3 {
  const { q, e } = el
  const a = q / (1 - e) // negative for a hyperbola
  const n = GAUSS_K / Math.sqrt(Math.abs(a) ** 3)
  const m = n * (jd - el.tp)
  let px: number
  let py: number
  if (e < 1) {
    const ea = solveElliptic(m, e)
    px = a * (Math.cos(ea) - e)
    py = a * Math.sqrt(1 - e * e) * Math.sin(ea)
  } else {
    const h = solveHyperbolic(m, e)
    px = -a * (e - Math.cosh(h))
    py = -a * Math.sqrt(e * e - 1) * Math.sinh(h)
  }
  const co = Math.cos(el.om * RAD)
  const so = Math.sin(el.om * RAD)
  const ci = Math.cos(el.i * RAD)
  const si = Math.sin(el.i * RAD)
  const cw = Math.cos(el.w * RAD)
  const sw = Math.sin(el.w * RAD)
  // rotate by argument of perihelion, inclination, longitude of node
  const x1 = cw * px - sw * py
  const y1 = sw * px + cw * py
  out.x = co * x1 - so * ci * y1
  out.y = so * x1 + co * ci * y1
  out.z = si * y1
  return out
}

/** Orbital period in days for a bound orbit, or null for a hyperbola. */
export function periodDays(q: number, e: number): number | null {
  if (e >= 1) return null
  const a = q / (1 - e)
  return (2 * Math.PI) / (GAUSS_K / Math.sqrt(a ** 3))
}

/** Furthest distance from the Sun, AU, or null if the orbit is open. */
export const aphelion = (q: number, e: number): number | null => (e >= 1 ? null : (q * (1 + e)) / (1 - e))

/**
 * Points along an orbit for drawing, as xyz triples in ecliptic axes. Sampled evenly in eccentric anomaly so the sharp end
 * near perihelion stays smooth, and cut where the body is further than `rMax` AU from the Sun.
 */
export function orbitArc(el: Elements, rMax = 150, count = 360): Float64Array {
  const { q, e } = el
  const a = q / (1 - e)
  const out = new Float64Array(count * 3)
  const co = Math.cos(el.om * RAD)
  const so = Math.sin(el.om * RAD)
  const ci = Math.cos(el.i * RAD)
  const si = Math.sin(el.i * RAD)
  const cw = Math.cos(el.w * RAD)
  const sw = Math.sin(el.w * RAD)
  const limit = e < 1
    ? Math.PI * (rMax >= (q * (1 + e)) / (1 - e) ? 1 : 0) || Math.acos(Math.max(-1, Math.min(1, (1 - rMax / a) / e)))
    : Math.acosh(Math.max(1, ((rMax / Math.abs(a)) + 1) / e))
  for (let k = 0; k < count; k++) {
    const t = -limit + (2 * limit * k) / (count - 1)
    let px: number
    let py: number
    if (e < 1) {
      px = a * (Math.cos(t) - e)
      py = a * Math.sqrt(1 - e * e) * Math.sin(t)
    } else {
      px = -a * (e - Math.cosh(t))
      py = -a * Math.sqrt(e * e - 1) * Math.sinh(t)
    }
    const x1 = cw * px - sw * py
    const y1 = sw * px + cw * py
    out[k * 3] = co * x1 - so * ci * y1
    out[k * 3 + 1] = so * x1 + co * ci * y1
    out[k * 3 + 2] = si * y1
  }
  return out
}
