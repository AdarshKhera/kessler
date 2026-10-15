import type * as THREE from 'three'
import { BORROWS_MOON_SURFACE, EARTH_LAYERS, RING_MAP, SKY_MAP, SURFACE_MAPS } from '../data/planetMaps'
import type { TextureStore } from './textureStore'

export type Layer = 'earthNight' | 'earthClouds' | 'earthNormal' | 'earthSpec' | 'saturnRing' | 'sky'

/** What the loader needs from the scene: somewhere to put each image. */
export interface SurfaceSink {
  setMap(id: string, tex: THREE.Texture | null): void
  setLayer(layer: Layer, tex: THREE.Texture): void
}

const LAYERS: readonly { layer: Layer; file: string; kind: 'color' | 'data' }[] = [
  { layer: 'earthNight', file: EARTH_LAYERS.night, kind: 'color' },
  { layer: 'earthClouds', file: EARTH_LAYERS.clouds, kind: 'data' },
  { layer: 'earthNormal', file: EARTH_LAYERS.normal, kind: 'data' },
  { layer: 'earthSpec', file: EARTH_LAYERS.spec, kind: 'data' },
  { layer: 'saturnRing', file: RING_MAP, kind: 'color' },
  { layer: 'sky', file: SKY_MAP, kind: 'color' },
]

/** The image a body starts with: its own, or the Moon's for small cratered worlds. */
const fileFor = (id: string): string | undefined => (SURFACE_MAPS[id] ?? (BORROWS_MOON_SURFACE.has(id) ? SURFACE_MAPS.moon : undefined))?.lo

/**
 * Brings planet images in two tiers. Small maps first so the system appears at once, then a sharper map for
 * whichever world you look at. Only a few sharp maps stay in memory; the rest drop back to the small one.
 */
export class SurfaceLoader {
  private readonly small = new Map<string, THREE.Texture>()
  private readonly sharp = new Map<string, THREE.Texture>()
  private readonly sharpOrder: string[] = []
  private readonly requested = new Set<string>()

  constructor(
    private readonly store: TextureStore,
    private readonly sink: SurfaceSink,
    private readonly sharpLimit: number,
    private readonly allowHuge: boolean,
    /** last-resort image when a file will not load (offline) */
    private readonly fallback: (id: string) => THREE.Texture | null,
  ) {}

  /** Resolves when every listed body and the shared layers have arrived (or failed over to the fallback). */
  async loadFirst(bodyIds: readonly string[], onProgress?: (done: number, total: number) => void): Promise<void> {
    const jobs = [...bodyIds.map((id) => () => this.loadSmall(id)), ...LAYERS.map((l) => () => this.loadLayer(l))]
    let done = 0
    onProgress?.(0, jobs.length)
    await Promise.all(
      jobs.map(async (job) => {
        await job()
        onProgress?.(++done, jobs.length)
      }),
    )
  }

  /** Fire and forget: the rest of the bodies, applied as they arrive. */
  loadRest(bodyIds: readonly string[]): void {
    for (const id of bodyIds) void this.loadSmall(id)
  }

  private async loadLayer(l: (typeof LAYERS)[number]): Promise<void> {
    const tex = (await this.store.load(l.file, l.kind)) ?? (l.layer === 'saturnRing' ? this.fallback('rings') : null)
    if (tex) this.sink.setLayer(l.layer, tex)
  }

  private async loadSmall(id: string): Promise<void> {
    if (this.requested.has(id)) return
    const file = fileFor(id)
    if (!file) return
    this.requested.add(id)
    const tex = await this.store.load(file)
    const use = tex ?? this.fallback(id)
    if (!use) return
    this.small.set(id, use)
    if (!this.sharp.has(id)) this.sink.setMap(id, use)
  }

  /** Swap in the sharper map for a body, and let the oldest sharp map go. */
  async sharpen(id: string): Promise<void> {
    const set = SURFACE_MAPS[id]
    if (!set?.hi || this.sharp.has(id)) return
    const hiFile = id === 'earth' && !this.allowHuge ? set.lo : set.hi
    if (hiFile === set.lo) return
    const tex = await this.store.load(hiFile)
    if (!tex || this.sharp.has(id)) return
    this.sharp.set(id, tex)
    this.sharpOrder.push(id)
    this.sink.setMap(id, tex)
    while (this.sharpOrder.length > this.sharpLimit) this.release(this.sharpOrder.shift()!)
  }

  private release(id: string): void {
    const tex = this.sharp.get(id)
    const small = this.small.get(id)
    this.sharp.delete(id)
    if (small) this.sink.setMap(id, small)
    if (tex) {
      tex.dispose()
      const file = SURFACE_MAPS[id]?.hi
      if (file) this.store.forget(file)
    }
  }

  /** The body is being looked at: keep its sharp map warm. */
  touch(id: string): void {
    const i = this.sharpOrder.indexOf(id)
    if (i >= 0) {
      this.sharpOrder.splice(i, 1)
      this.sharpOrder.push(id)
    }
  }
}
