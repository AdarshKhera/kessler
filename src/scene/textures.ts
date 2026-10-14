import * as THREE from 'three'
import { landCanvas } from './globe'

/** Small seeded value noise: enough to make convincing procedural planets without shipping image files. */
function hash(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 2246822519)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function valueNoise(x: number, y: number, seed: number, wrapX: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  const w = (v: number) => ((v % wrapX) + wrapX) % wrapX
  const a = hash(w(x0), y0, seed)
  const b = hash(w(x0 + 1), y0, seed)
  const c = hash(w(x0), y0 + 1, seed)
  const d = hash(w(x0 + 1), y0 + 1, seed)
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
}

function fbm(u: number, v: number, base: number, octaves: number, seed: number): number {
  let sum = 0
  let amp = 0.5
  let freq = base
  let norm = 0
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise(u * freq * 2, v * freq, seed + o * 31, Math.round(freq * 2))
    norm += amp
    amp *= 0.5
    freq *= 2
  }
  return sum / norm
}

const mix = (a: readonly number[], b: readonly number[], t: number): number[] => a.map((v, i) => v + (b[i] - v) * t)
const rgb = (hex: string): number[] => {
  const c = new THREE.Color(hex)
  return [c.r * 255, c.g * 255, c.b * 255]
}

type Painter = (u: number, v: number) => number[]

function paint(w: number, h: number, fn: Painter): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(w, h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = fn(x / w, y / h)
      const i = (y * w + x) * 4
      img.data[i] = r
      img.data[i + 1] = g
      img.data[i + 2] = b
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

function bandPainter(stops: readonly string[], turbulence: number, seed: number, spot?: { u: number; v: number; rx: number; ry: number; color: string }): Painter {
  const colors = stops.map(rgb)
  return (u, v) => {
    const warp = (fbm(u, v, 3, 3, seed) - 0.5) * turbulence
    const t = Math.min(0.999, Math.max(0, v + warp * 0.12)) * colors.length
    const i = Math.floor(t)
    let c = mix(colors[i], colors[Math.min(colors.length - 1, i + 1)], t - i)
    const fine = (fbm(u, v * 4, 6, 2, seed + 9) - 0.5) * 18
    c = c.map((x) => x + fine)
    if (spot) {
      const dx = (((u - spot.u + 1.5) % 1) - 0.5) / spot.rx
      const dy = (v - spot.v) / spot.ry
      const d = dx * dx + dy * dy
      if (d < 1) c = mix(c, rgb(spot.color), (1 - d) * 0.85)
    }
    return c
  }
}

function craterPainter(base: string, dark: string, seed: number): Painter {
  const a = rgb(base)
  const b = rgb(dark)
  return (u, v) => {
    const n = fbm(u, v, 6, 5, seed)
    const c = fbm(u, v, 14, 2, seed + 5)
    return mix(a, b, Math.min(1, Math.max(0, (n - 0.35) * 1.6 + (c > 0.62 ? 0.25 : 0))))
  }
}

const cache = new Map<string, THREE.CanvasTexture>()

function textured(key: string, canvas: () => HTMLCanvasElement): THREE.CanvasTexture {
  const hit = cache.get(key)
  if (hit) return hit
  const tex = new THREE.CanvasTexture(canvas())
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  cache.set(key, tex)
  return tex
}

/** Procedural surface for a body, generated once on first use. */
export function bodyTexture(id: string): THREE.CanvasTexture {
  return textured(id, () => {
    switch (id) {
      case 'jupiter':
        return paint(1024, 512, bandPainter(['#8a6b4c', '#d9b98e', '#f0e1c4', '#b98a5e', '#e6cfa6', '#c2915f', '#f3e5cc', '#a7794f', '#d9b98e', '#8a6b4c'], 1.4, 11, { u: 0.35, v: 0.62, rx: 0.07, ry: 0.045, color: '#b5502f' }))
      case 'saturn':
        return paint(1024, 512, bandPainter(['#a58d62', '#d9c48f', '#ecdcae', '#cdb57f', '#e8d8a8', '#c7ae78', '#e2d09b', '#b79f6c'], 0.6, 21))
      case 'uranus':
        return paint(512, 256, bandPainter(['#8fd0d6', '#a6e0e3', '#b6e8ea', '#9bd7dc', '#a9e1e4'], 0.25, 31))
      case 'neptune':
        return paint(512, 256, bandPainter(['#2f55c9', '#4a77e6', '#5b8bf0', '#3a62d6', '#2a4cb8'], 0.8, 41, { u: 0.55, v: 0.55, rx: 0.06, ry: 0.04, color: '#1b2f86' }))
      case 'venus':
        return paint(512, 256, (u, v) => mix(rgb('#d9b878'), rgb('#f2e0b0'), fbm(u, v, 4, 4, 51)))
      case 'mars': {
        const dust = rgb('#b9572f')
        const dark = rgb('#6e3a26')
        const cap = rgb('#f4eee8')
        return paint(1024, 512, (u, v) => {
          const n = fbm(u, v, 5, 5, 61)
          let c = mix(dust, dark, Math.min(1, Math.max(0, (n - 0.45) * 2.4)))
          const pole = Math.abs(v - 0.5) * 2
          if (pole > 0.9) c = mix(c, cap, Math.min(1, (pole - 0.9) * 10))
          return c
        })
      }
      case 'earth': {
        const land = landCanvas(1024, 512)
        const lctx = land.getContext('2d')!
        const mask = lctx.getImageData(0, 0, 1024, 512).data
        const ocean = rgb('#1c4f9c')
        const deep = rgb('#0e2f6e')
        const green = rgb('#4f8a4a')
        const sand = rgb('#b9a874')
        const ice = rgb('#f2f6fa')
        return paint(1024, 512, (u, v) => {
          const x = Math.min(1023, Math.floor(u * 1024))
          const y = Math.min(511, Math.floor(v * 512))
          const isLand = mask[(y * 1024 + x) * 4 + 3] > 128
          const n = fbm(u, v, 5, 4, 71)
          let c = isLand ? mix(green, sand, Math.min(1, Math.max(0, (n - 0.4) * 2.5 + Math.abs(v - 0.5) * -0.5 + 0.2))) : mix(deep, ocean, n)
          const pole = Math.abs(v - 0.5) * 2
          if (pole > 0.9) c = mix(c, ice, Math.min(1, (pole - 0.9) * 12))
          const cloud = Math.max(0, fbm(u, v, 7, 4, 81) - 0.58) * 3.2
          return mix(c, [255, 255, 255], Math.min(0.75, cloud))
        })
      }
      case 'moon':
      case 'mercury':
        return paint(512, 256, craterPainter(id === 'moon' ? '#b8b8b8' : '#a39a90', id === 'moon' ? '#6f6f6f' : '#6b645d', 91))
      case 'pluto':
        return paint(512, 256, (u, v) => mix(rgb('#8e7a68'), rgb('#e7d9c6'), fbm(u, v, 4, 4, 101) + (Math.hypot(u - 0.62, v - 0.55) < 0.12 ? 0.3 : 0)))
      default:
        return paint(256, 128, craterPainter('#bdb6ad', '#6d675f', 111))
    }
  })
}

/** Saturn-style ring texture: radial bands with the Cassini and Encke gaps. u runs inner to outer edge. */
export function ringTexture(): THREE.CanvasTexture {
  return textured('rings', () => {
    const w = 1024
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = 4
    const ctx = canvas.getContext('2d')!
    const img = ctx.createImageData(w, 4)
    for (let x = 0; x < w; x++) {
      const t = x / w // 0 = inner edge (C ring), 1 = outer (A ring and beyond)
      let a = 0
      if (t < 0.12) a = 0.12 + 0.18 * (t / 0.12) // C ring, faint
      else if (t < 0.45) a = 0.78 + 0.18 * Math.sin(t * 90) // B ring, dense
      else if (t < 0.5) a = 0.04 // Cassini division
      else if (t < 0.93) a = 0.55 + 0.12 * Math.sin(t * 140) // A ring
      else a = 0.08
      if (Math.abs(t - 0.85) < 0.008) a = 0.05 // Encke gap
      const g = 0.5 + 0.5 * hash(x, 3, 7)
      const shade = 190 + g * 55
      for (let y = 0; y < 4; y++) {
        const i = (y * w + x) * 4
        img.data[i] = shade
        img.data[i + 1] = shade * 0.93
        img.data[i + 2] = shade * 0.8
        img.data[i + 3] = Math.max(0, Math.min(255, a * 255))
      }
    }
    ctx.putImageData(img, 0, 0)
    return canvas
  })
}
