import { describe, expect, it } from 'vitest'
import { SimClock } from '../src/sim/clock'

describe('SimClock', () => {
  it('follows real time at 1x', () => {
    const c = new SimClock()
    expect(Math.abs(c.now() - Date.now())).toBeLessThan(50)
  })
  it('jumps to an absolute instant and keeps ticking from there', async () => {
    const c = new SimClock()
    const target = Date.UTC(2030, 0, 1)
    c.jumpTo(target)
    expect(c.now() - target).toBeLessThan(50)
    await new Promise((r) => setTimeout(r, 30))
    expect(c.now() - target).toBeGreaterThanOrEqual(25)
  })
  it('keeps the pause state when jumping', () => {
    const c = new SimClock()
    c.setPaused(true)
    c.jumpTo(1_000_000)
    expect(c.now()).toBe(1_000_000)
    expect(c.paused).toBe(true)
  })
  it('scales elapsed time by the warp factor', async () => {
    const c = new SimClock()
    c.jumpTo(0)
    c.setWarp(1000)
    await new Promise((r) => setTimeout(r, 30))
    expect(c.now()).toBeGreaterThan(20_000)
  })
  it('returns to live time', () => {
    const c = new SimClock()
    c.setWarp(300)
    c.jumpTo(0)
    c.jumpToLive()
    expect(c.warp).toBe(1)
    expect(Math.abs(c.now() - Date.now())).toBeLessThan(50)
  })
})
