import { describe, expect, it } from 'vitest'
import { closestApproach } from '../src/lib/closest'

describe('closestApproach', () => {
  it('finds the minimum of a smooth distance function', () => {
    const dist = (t: number) => Math.hypot(t - 4321, 2)
    const r = closestApproach(dist, 0, 10000, 30, 1, 500)
    expect(r).not.toBeNull()
    expect(Math.abs(r!.t - 4321)).toBeLessThanOrEqual(1)
    expect(r!.distance).toBeCloseTo(2, 0)
  })
  it('returns null when never inside the threshold', () => {
    expect(closestApproach(() => 9999, 0, 1000, 30, 1, 500)).toBeNull()
  })
})
