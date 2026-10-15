import { describe, expect, it } from 'vitest'
import { GAUSS_K, aphelion, periodDays, positionFromElements, solveElliptic, solveHyperbolic } from '../src/lib/kepler'
import { trackPosition, trackSpeedKmS } from '../src/lib/trajectory'

describe('kepler', () => {
  it('solves the elliptic equation across eccentricities', () => {
    for (const e of [0, 0.3, 0.9, 0.967, 0.999]) {
      for (const m of [-3, -1, 0, 0.5, 2, 3.1]) {
        const ea = solveElliptic(m, e)
        expect(ea - e * Math.sin(ea)).toBeCloseTo(m, 8)
      }
    }
  })

  it('solves the hyperbolic equation', () => {
    for (const m of [-5, -0.4, 0, 1, 20]) {
      const h = solveHyperbolic(m, 3.4)
      expect(3.4 * Math.sinh(h) - h).toBeCloseTo(m, 8)
    }
  })

  it('puts a body at perihelion distance q at time tp, and at aphelion half a period later', () => {
    const el = { q: 0.586, e: 0.967, i: 162.26, om: 58.42, w: 111.33, tp: 2446467.4 } // Halley
    const near = positionFromElements(el, el.tp)
    expect(Math.hypot(near.x, near.y, near.z)).toBeCloseTo(0.586, 6)
    const half = periodDays(el.q, el.e)! / 2
    const far = positionFromElements(el, el.tp + half)
    expect(Math.hypot(far.x, far.y, far.z)).toBeCloseTo(aphelion(el.q, el.e)!, 3)
  })

  it('gives Earth-like period for a=1 and keeps circular orbits circular', () => {
    expect(periodDays(1, 0)).toBeCloseTo((2 * Math.PI) / GAUSS_K, 6)
    const el = { q: 2, e: 0, i: 10, om: 40, w: 0, tp: 0 }
    for (const d of [0, 100, 777]) {
      const p = positionFromElements(el, d)
      expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(2, 9)
    }
  })

  it('keeps an interstellar comet on an open orbit', () => {
    const el = { q: 1.36, e: 6.14, i: 175.1, om: 322.2, w: 128.0, tp: 2460977 } // roughly 3I/ATLAS
    const early = positionFromElements(el, el.tp - 500)
    const late = positionFromElements(el, el.tp + 500)
    expect(Math.hypot(early.x, early.y, early.z)).toBeGreaterThan(5)
    expect(Math.hypot(late.x, late.y, late.z)).toBeGreaterThan(5)
    expect(periodDays(el.q, el.e)).toBeNull()
  })
})

describe('trajectory', () => {
  const t = { startJd: 100, stepDays: 2, pos: [0, 0, 0, 2_000_000, 0, 0, 4_000_000, 0, 0, 6_000_000, 0, 0] }

  it('interpolates between samples and passes through them', () => {
    expect(trackPosition(t, 100).pos.x).toBeCloseTo(0, 9)
    expect(trackPosition(t, 102).pos.x).toBeCloseTo(2, 9)
    expect(trackPosition(t, 103).pos.x).toBeCloseTo(3, 6)
  })

  it('reports dates outside the data and holds the end point', () => {
    const r = trackPosition(t, 500)
    expect(r.inRange).toBe(false)
    expect(r.pos.x).toBeCloseTo(6, 9)
    expect(trackPosition(t, 99).inRange).toBe(false)
  })

  it('computes speed in km/s', () => {
    // 1 AU per day = 1731 km/s
    expect(trackSpeedKmS({ startJd: 0, stepDays: 1, pos: [0, 0, 0, 1_000_000, 0, 0, 2_000_000, 0, 0, 3_000_000, 0, 0] }, 1.5)).toBeCloseTo(1731.46, 0)
  })
})

import { orbitArc } from '../src/lib/kepler'

describe('orbitArc', () => {
  it('stays on the orbit and inside the distance limit', () => {
    const el = { q: 0.575, e: 0.968, i: 162, om: 59, w: 112, tp: 0 }
    const pts = orbitArc(el, 20, 200)
    let max = 0
    for (let k = 0; k < 200; k++) max = Math.max(max, Math.hypot(pts[k * 3], pts[k * 3 + 1], pts[k * 3 + 2]))
    expect(max).toBeLessThanOrEqual(20.001)
    expect(max).toBeGreaterThan(19)
    // the middle of the arc is perihelion
    expect(Math.hypot(pts[99 * 3], pts[99 * 3 + 1], pts[99 * 3 + 2])).toBeLessThan(0.7)
  })

  it('draws the whole ellipse when it fits', () => {
    const pts = orbitArc({ q: 1, e: 0.2, i: 0, om: 0, w: 0, tp: 0 }, 150, 100)
    let max = 0
    for (let k = 0; k < 100; k++) max = Math.max(max, Math.hypot(pts[k * 3], pts[k * 3 + 1]))
    expect(max).toBeCloseTo(1.5, 1)
  })
})
