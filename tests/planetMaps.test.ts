import { describe, expect, it } from 'vitest'
import { MOONS } from '../src/data/bodies'
import { BORROWS_MOON_SURFACE, EARTH_LAYERS, RING_INNER, RING_OUTER, RING_MAP, SKY_MAP, SURFACE_MAPS } from '../src/data/planetMaps'

const shipped = new Set(Object.keys(import.meta.glob('../public/textures/planets/*')).map((p) => p.split('/').pop()))

describe('planet maps', () => {
  it('ships every image the manifest names', () => {
    const files = [
      ...Object.values(SURFACE_MAPS).flatMap((m) => [m.lo, ...(m.hi ? [m.hi] : [])]),
      ...Object.values(EARTH_LAYERS),
      RING_MAP,
      SKY_MAP,
    ]
    for (const f of files) expect(shipped.has(f), f).toBe(true)
  })

  it('only borrows the Moon surface for real moons', () => {
    const ids = new Set(MOONS.map((m) => m.id))
    for (const id of BORROWS_MOON_SURFACE) expect(ids.has(id), id).toBe(true)
  })

  it('places Saturn ring edges at the C ring and the F ring', () => {
    expect(RING_INNER * 58_232).toBeCloseTo(71_700, 0)
    expect(RING_OUTER).toBeGreaterThan(RING_INNER)
  })
})
