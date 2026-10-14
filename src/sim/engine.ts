import type { Sat } from '../data/types'
import { SimClock } from './clock'
import type { ConjunctionHit, WorkerRequest, WorkerResponse } from './protocol'

export interface TrackResult {
  readonly index: number
  readonly t: number
  readonly orbit: Float32Array
  readonly ground: Float32Array
}

/**
 * Owns the propagation workers. The worker returns position and velocity every few
 * hundred ms; between returns we extrapolate linearly (error stays under a few km).
 */
export class Engine {
  readonly clock = new SimClock()
  /** Extrapolated positions in scene units, refreshed by `step()`. NaN rows are decayed/failed. */
  readonly positions: Float32Array

  private readonly basePos: Float32Array
  private baseVel: Float32Array
  private baseT = 0
  private readonly propagator = new Worker(new URL('./sgp.worker.ts', import.meta.url), { type: 'module' })
  private readonly screener = new Worker(new URL('./sgp.worker.ts', import.meta.url), { type: 'module' })
  private busy = false
  private seq = 0
  private minId = 0
  private suspended = false
  private timer = 0
  private trackListener: ((r: TrackResult) => void) | null = null
  private conjListener: ((index: number, hits: ConjunctionHit[], scanned: number) => void) | null = null
  private trackSeq = 0
  private conjSeq = 0

  constructor(readonly sats: readonly Sat[]) {
    const n = sats.length
    this.positions = new Float32Array(n * 3).fill(NaN)
    this.basePos = new Float32Array(n * 3).fill(NaN)
    this.baseVel = new Float32Array(n * 3)
  }

  async start(): Promise<{ failed: number }> {
    const omms = this.sats.map((s) => s.omm)
    const ready = (w: Worker) =>
      new Promise<number>((resolve, reject) => {
        const on = (e: MessageEvent<WorkerResponse>) => {
          if (e.data.type !== 'ready') return
          w.removeEventListener('message', on)
          resolve(e.data.failed)
        }
        w.addEventListener('message', on)
        w.addEventListener('error', (e) => reject(new Error(`Orbit worker failed: ${e.message}`)))
        w.addEventListener('messageerror', () => reject(new Error('Orbit worker sent unreadable data')))
        w.postMessage({ type: 'init', omms } satisfies WorkerRequest)
      })
    const [failed] = await Promise.all([ready(this.propagator), ready(this.screener)])
    this.propagator.addEventListener('message', (e: MessageEvent<WorkerResponse>) => this.onPropagator(e.data))
    this.screener.addEventListener('message', (e: MessageEvent<WorkerResponse>) => this.onScreener(e.data))
    this.requestTick()
    await new Promise<void>((resolve, reject) => {
      const started = performance.now()
      const wait = () => {
        if (this.baseT > 0) resolve()
        else if (performance.now() - started > 15_000) reject(new Error('Orbit worker did not respond'))
        else setTimeout(wait, 20)
      }
      wait()
    })
    this.schedule()
    return { failed }
  }

  /** Stop calculating satellite positions (used while looking at the solar system). */
  setSuspended(suspended: boolean): void {
    this.suspended = suspended
    window.clearTimeout(this.timer)
    if (!suspended) this.resync()
  }

  private schedule(): void {
    if (this.suspended) return
    const ms = Math.max(80, Math.min(500, 30_000 / Math.max(1, this.clock.warp)))
    window.clearTimeout(this.timer)
    this.timer = window.setTimeout(() => {
      this.requestTick()
      this.schedule()
    }, ms)
  }

  setWarp(warp: number): void {
    this.clock.setWarp(warp)
    this.resync()
  }

  setPaused(paused: boolean): void {
    this.clock.setPaused(paused)
    this.resync()
  }

  jumpTo(ms: number): void {
    this.clock.jumpTo(ms)
    this.resync()
  }

  jumpToLive(): void {
    this.clock.jumpToLive()
    this.resync()
  }

  /** Sim time just jumped or changed rate: drop in-flight ticks and fetch a fresh one now. */
  private resync(): void {
    this.minId = this.seq + 1
    this.busy = false
    this.requestTick()
    this.schedule()
  }

  private requestTick(): void {
    if (this.busy || this.suspended) return
    this.busy = true
    this.propagator.postMessage({ type: 'tick', id: ++this.seq, t: this.clock.now() } satisfies WorkerRequest)
  }

  private onPropagator(m: WorkerResponse): void {
    if (m.type === 'tick') {
      if (m.id < this.minId) return // computed for a sim time we have since left
      this.basePos.set(m.pos)
      this.baseVel = m.vel
      this.baseT = m.t
      this.busy = false
    } else if (m.type === 'track' && m.id === this.trackSeq && this.trackListener) {
      this.trackListener({ index: m.index, t: m.t, orbit: m.orbit, ground: m.ground })
    }
  }

  private onScreener(m: WorkerResponse): void {
    if (m.type === 'conj' && m.id === this.conjSeq) this.conjListener?.(m.index, m.hits, m.scanned)
  }

  /** Recompute `positions` for the current sim time. Call once per frame. */
  step(): number {
    const now = this.clock.now()
    const dt = Math.max(-5, Math.min(5, (now - this.baseT) / 1000))
    const { positions, basePos, baseVel } = this
    for (let i = 0; i < positions.length; i++) positions[i] = basePos[i] + baseVel[i] * dt
    return now
  }

  onTrack(fn: (r: TrackResult) => void): void {
    this.trackListener = fn
  }

  onConjunctions(fn: (index: number, hits: ConjunctionHit[], scanned: number) => void): void {
    this.conjListener = fn
  }

  requestTrack(index: number): void {
    this.propagator.postMessage({ type: 'track', id: ++this.trackSeq, index, t: this.clock.now() } satisfies WorkerRequest)
  }

  requestConjunctions(index: number, hours = 3): void {
    this.screener.postMessage({ type: 'conj', id: ++this.conjSeq, index, t: this.clock.now(), hours } satisfies WorkerRequest)
  }

  cancelConjunctions(): void {
    // a fresh id with no listener match makes the worker abandon its scan
    this.screener.postMessage({ type: 'conj', id: ++this.conjSeq, index: -1, t: 0, hours: 0 } satisfies WorkerRequest)
  }
}
