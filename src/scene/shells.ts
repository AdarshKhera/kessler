import * as THREE from 'three'
import { EARTH_RADIUS } from '../lib/frames'

const SHELLS = [
  { label: 'LEO 2,000 km', altKm: 2000, opacity: 0.1 },
  { label: 'MEO 20,200 km', altKm: 20200, opacity: 0.1 },
  { label: 'GEO 35,786 km', altKm: 35786, opacity: 0.18 },
] as const

const PLANES: readonly ((c: number, s: number) => [number, number, number])[] = [
  (c, s) => [c, 0, s], // equator
  (c, s) => [c, s, 0], // meridian ring
  (c, s) => [0, s, c], // meridian ring, 90 degrees round
]

function circle(radius: number, plane: (typeof PLANES)[number], segments = 192): number[] {
  const out: number[] = []
  for (let i = 0; i < segments; i++) {
    for (const k of [i, i + 1]) {
      const a = (k / segments) * Math.PI * 2
      const [x, y, z] = plane(Math.cos(a), Math.sin(a))
      out.push(x * radius, y * radius, z * radius)
    }
  }
  return out
}

function label(text: string): THREE.Sprite {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 40
  const ctx = c.getContext('2d')!
  ctx.font = '500 20px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.fillStyle = 'rgba(150,235,255,0.5)'
  ctx.fillText(text, 4, 28)
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }))
  sprite.scale.set(5, 0.78, 1)
  sprite.center.set(0, 0.5)
  return sprite
}

/** Orbital regime rings: equatorial plus two crossing great circles per shell. */
export function createShells(): THREE.Group {
  const group = new THREE.Group()
  for (const s of SHELLS) {
    const r = EARTH_RADIUS + s.altKm / 1000
    const pts = PLANES.flatMap((p) => circle(r, p))
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    const ring = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({ color: '#5ef2ff', transparent: true, opacity: s.opacity, depthWrite: false, blending: THREE.AdditiveBlending }),
    )
    group.add(ring)
    const tag = label(s.label)
    tag.position.set(r * 0.72, 0.0, r * 0.72)
    group.add(tag)
  }
  return group
}
