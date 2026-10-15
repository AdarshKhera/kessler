import * as THREE from 'three'

export type TextureKind = 'color' | 'data'

/** Loads planet images once, sets them up for sharp sampling, and reports failures as null so callers can fall back. */
export class TextureStore {
  private readonly loader = new THREE.TextureLoader()
  private readonly pending = new Map<string, Promise<THREE.Texture | null>>()
  private readonly base = `${import.meta.env.BASE_URL}textures/planets/`

  constructor(private readonly anisotropy: number) {}

  load(file: string, kind: TextureKind = 'color'): Promise<THREE.Texture | null> {
    const key = `${kind}:${file}`
    let hit = this.pending.get(key)
    if (!hit) {
      hit = this.loader
        .loadAsync(this.base + file)
        .then((tex) => {
          tex.colorSpace = kind === 'color' ? THREE.SRGBColorSpace : THREE.NoColorSpace
          tex.anisotropy = this.anisotropy
          tex.wrapS = THREE.RepeatWrapping
          return tex
        })
        .catch(() => {
          this.pending.delete(key) // allow a retry later
          return null
        })
      this.pending.set(key, hit)
    }
    return hit
  }

  /** Forget a finished texture so a later request loads it again (used when freeing high-resolution maps). */
  forget(file: string, kind: TextureKind = 'color'): void {
    this.pending.delete(`${kind}:${file}`)
  }
}

/** Largest map the GPU can hold and the device should be asked to. Phones stay on 4k to protect memory. */
export function allowHugeMaps(maxTextureSize: number): boolean {
  const coarse = matchMedia('(pointer: coarse)').matches
  return !coarse && maxTextureSize >= 8192
}
