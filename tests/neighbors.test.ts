import { describe, expect, it } from 'vitest'
import { nearestTo } from '../src/lib/neighbors'

describe('nearestTo', () => {
  const pos = new Float32Array([0, 0, 0, 3, 0, 0, 1, 0, 0, 10, 0, 0, NaN, NaN, NaN])
  it('returns the k nearest in ascending distance, skipping self and NaN', () => {
    const r = nearestTo(pos, 0, 2)
    expect(r.map((n) => n.index)).toEqual([2, 1])
    expect(r[0].distance).toBeCloseTo(1)
  })
  it('honours a skip predicate', () => {
    const r = nearestTo(pos, 0, 1, (i) => i === 2)
    expect(r[0].index).toBe(1)
  })
})
