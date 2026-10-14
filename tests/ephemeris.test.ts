import { describe, expect, it } from 'vitest'
import { PLANET_IDS, heliocentric, julianDate, moonGeocentric, orbitPath, lightMinutes, poleEcliptic } from '../src/lib/ephemeris'

const OCT_14_2026 = Date.UTC(2026, 9, 14, 12)
const lonDeg = (p: { x: number; y: number }) => ((Math.atan2(p.y, p.x) * 180) / Math.PI + 360) % 360
const dist = (p: { x: number; y: number; z: number }) => Math.hypot(p.x, p.y, p.z)

describe('julianDate', () => {
  it('matches the J2000 epoch', () => {
    expect(julianDate(Date.UTC(2000, 0, 1, 12))).toBeCloseTo(2451545.0, 6)
  })
})

describe('heliocentric positions on 14 Oct 2026', () => {
  it('puts Earth about 0.996 AU from the Sun, near ecliptic longitude 21 degrees', () => {
    const e = heliocentric('earth', OCT_14_2026)
    expect(dist(e)).toBeGreaterThan(0.99)
    expect(dist(e)).toBeLessThan(1.003)
    expect(Math.abs(lonDeg(e) - 21)).toBeLessThan(1.5)
  })
  it('places the outer planets where observers see them', () => {
    expect(lonDeg(heliocentric('jupiter', OCT_14_2026))).toBeGreaterThan(125)
    expect(lonDeg(heliocentric('jupiter', OCT_14_2026))).toBeLessThan(140)
    const sat = lonDeg(heliocentric('saturn', OCT_14_2026))
    expect(sat).toBeGreaterThan(5)
    expect(sat).toBeLessThan(20)
    const nep = lonDeg(heliocentric('neptune', OCT_14_2026))
    expect(nep > 355 || nep < 8).toBe(true)
    expect(lonDeg(heliocentric('uranus', OCT_14_2026))).toBeGreaterThan(55)
    expect(lonDeg(heliocentric('uranus', OCT_14_2026))).toBeLessThan(70)
  })
  it('keeps every planet inside a plausible distance band', () => {
    const bands: Record<string, [number, number]> = {
      mercury: [0.3, 0.47], venus: [0.71, 0.73], earth: [0.98, 1.02], mars: [1.38, 1.67],
      jupiter: [4.95, 5.46], saturn: [9.0, 10.1], uranus: [18.3, 20.1], neptune: [29.7, 30.4], pluto: [29.6, 49.4],
    }
    for (const id of PLANET_IDS) {
      const d = dist(heliocentric(id, OCT_14_2026))
      expect(d).toBeGreaterThanOrEqual(bands[id][0])
      expect(d).toBeLessThanOrEqual(bands[id][1])
    }
  })
})

describe('orbitPath', () => {
  it('returns a closed-looking loop of the requested size at the right scale', () => {
    const path = orbitPath('earth', 90)
    expect(path.length).toBe(90 * 3)
    for (let i = 0; i < 90; i++) {
      const r = Math.hypot(path[i * 3], path[i * 3 + 1], path[i * 3 + 2])
      expect(r).toBeGreaterThan(0.98)
      expect(r).toBeLessThan(1.02)
    }
  })
})

describe('moonGeocentric', () => {
  it('sits about 384,000 km from Earth', () => {
    const m = moonGeocentric(OCT_14_2026)
    const km = dist(m) * 149_597_870.7
    expect(km).toBeGreaterThan(356_000)
    expect(km).toBeLessThan(407_000)
  })
})

describe('poleEcliptic', () => {
  const tiltFromEclipticNorth = (ra: number, dec: number) => {
    const p = poleEcliptic(ra, dec)
    return (Math.acos(p.z / Math.hypot(p.x, p.y, p.z)) * 180) / Math.PI
  }
  it('puts Earth’s pole 23.4 degrees from the ecliptic pole', () => {
    expect(tiltFromEclipticNorth(0, 90)).toBeCloseTo(23.44, 1)
  })
  it('reproduces Saturn’s and Uranus’s axial tilts', () => {
    expect(tiltFromEclipticNorth(40.589, 83.537)).toBeGreaterThan(25)
    expect(tiltFromEclipticNorth(40.589, 83.537)).toBeLessThan(29)
    // the IAU pole is the one that makes Uranus spin the "negative" way, so it lies on the other side of 90
    expect(tiltFromEclipticNorth(257.311, -15.175)).toBeGreaterThan(80)
    expect(tiltFromEclipticNorth(257.311, -15.175)).toBeLessThan(85)
  })
  it('returns a unit vector', () => {
    const p = poleEcliptic(132.993, -6.163)
    expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(1, 6)
  })
})

describe('lightMinutes', () => {
  it('is about 8.3 minutes per AU', () => {
    expect(lightMinutes(1)).toBeCloseTo(8.317, 2)
  })
})
