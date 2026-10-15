import { describe, expect, it } from 'vitest'
import probesFile from '../public/space/probes.json'
import smallFile from '../public/space/small-bodies.json'
import { PROBES } from '../src/data/probes'
import { positionFromElements } from '../src/lib/kepler'
import { trackPosition } from '../src/lib/trajectory'

const jd = 2_461_328.5 // 2026-10-15

describe('NASA/JPL snapshots', () => {
  it('has a path for every spacecraft we describe, and a description for every path', () => {
    const paths = new Set(probesFile.probes.map((p) => p.id))
    for (const p of PROBES) expect(paths.has(p.id), p.id).toBe(true)
    for (const id of paths) expect(PROBES.some((p) => p.id === id), id).toBe(true)
  })

  it('keeps every sample finite and evenly stepped', () => {
    for (const t of probesFile.probes) {
      expect(t.pos.length % 3).toBe(0)
      expect(t.pos.every(Number.isFinite), t.id).toBe(true)
      expect(t.stepDays).toBeGreaterThan(0)
    }
  })

  it('puts Voyager 1 in interstellar space and Parker close to the Sun', () => {
    const dist = (id: string) => {
      const p = trackPosition(probesFile.probes.find((t) => t.id === id)!, jd).pos
      return Math.hypot(p.x, p.y, p.z)
    }
    expect(dist('voyager-1')).toBeGreaterThan(160)
    expect(dist('voyager-1')).toBeLessThan(185)
    expect(dist('parker')).toBeLessThan(1.1)
    expect(dist('jwst')).toBeGreaterThan(0.97)
    expect(dist('jwst')).toBeLessThan(1.03)
  })

  it('holds only valid, bound orbits in the small-body crowds', () => {
    for (const [name, rows] of Object.entries(smallFile.populations)) {
      expect(rows.length, name).toBeGreaterThan(100)
      for (const r of rows) {
        expect(r.every((v) => Number.isFinite(v)), `${name} ${r}`).toBe(true)
        expect(r[0]).toBeGreaterThan(0)
        expect(r[1]).toBeLessThan(1)
      }
    }
  })

  it('places Halley and Bennu where they are known to be', () => {
    const at = (id: string) => {
      const b = smallFile.notables.find((n) => n.id === id)!
      const p = positionFromElements(b.el, jd)
      return Math.hypot(p.x, p.y, p.z)
    }
    expect(at('1P')).toBeGreaterThan(33) // far out, past Neptune, a few years after its 2023 aphelion
    expect(at('1P')).toBeLessThan(36)
    expect(at('101955')).toBeGreaterThan(0.89)
    expect(at('101955')).toBeLessThan(1.36)
  })
})
