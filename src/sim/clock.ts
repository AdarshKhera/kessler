/** Simulation clock: wall-clock anchored, with a warp multiplier and pause. */
export class SimClock {
  private anchorReal = performance.now()
  private anchorSim = Date.now()
  warp = 1
  paused = false

  now(): number {
    if (this.paused) return this.anchorSim
    return this.anchorSim + (performance.now() - this.anchorReal) * this.warp
  }

  private rebase(): void {
    this.anchorSim = this.now()
    this.anchorReal = performance.now()
  }

  setWarp(warp: number): void {
    this.rebase()
    this.warp = warp
  }

  setPaused(paused: boolean): void {
    this.rebase()
    this.paused = paused
  }

  /** Move simulated time to an absolute instant, keeping the current speed and pause state. */
  jumpTo(ms: number): void {
    this.anchorSim = ms
    this.anchorReal = performance.now()
  }

  jumpToLive(): void {
    this.anchorSim = Date.now()
    this.anchorReal = performance.now()
    this.warp = 1
    this.paused = false
  }
}
