import { describe, expect, it } from 'vitest'
import { eciToScene, sceneUnitsPerKm } from '../src/lib/frames'

describe('eciToScene', () => {
  it('maps ECI z (north) to scene +y and ECI y to scene -z', () => {
    const out = new Float32Array(3)
    eciToScene(1000, 2000, 3000, out, 0)
    expect(out[0]).toBeCloseTo(1000 * sceneUnitsPerKm)
    expect(out[1]).toBeCloseTo(3000 * sceneUnitsPerKm)
    expect(out[2]).toBeCloseTo(-2000 * sceneUnitsPerKm)
  })
  it('writes at the given offset only', () => {
    const out = new Float32Array(6)
    eciToScene(1, 1, 1, out, 3)
    expect(out[0]).toBe(0)
    expect(out[3]).not.toBe(0)
  })
})
