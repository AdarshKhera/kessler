import * as THREE from 'three'
import { OPERATORS } from '../data/registry'
import type { Sat } from '../data/types'
import { EARTH_RADIUS } from '../lib/frames'

export interface FocusState {
  /** operator index or -1 */
  readonly operator: number
  /** group (constellation) index or -1 */
  readonly group: number
  /** country index or -1 */
  readonly country: number
  readonly hover: number
  readonly selected: number
}

export const NO_FOCUS: FocusState = { operator: -1, group: -1, country: -1, hover: -1, selected: -1 }

/** One Points object for every tracked object. Focus dimming happens in the shader. */
export class Swarm {
  readonly points: THREE.Points
  private readonly material: THREE.ShaderMaterial
  private readonly hidden = new Float32Array(16)
  private readonly geometry = new THREE.BufferGeometry()
  private readonly posAttr: THREE.BufferAttribute
  private readonly tmp = new THREE.Vector3()
  private readonly ray = new THREE.Vector3()

  constructor(private readonly sats: readonly Sat[], positions: Float32Array) {
    const n = sats.length
    this.posAttr = new THREE.BufferAttribute(positions, 3)
    this.posAttr.setUsage(THREE.DynamicDrawUsage)
    const color = new Float32Array(n * 3)
    const op = new Float32Array(n)
    const grp = new Float32Array(n)
    const idx = new Float32Array(n)
    const size = new Float32Array(n)
    const palette = OPERATORS.map((o) => new THREE.Color(o.color))
    sats.forEach((s, i) => {
      palette[s.operatorIndex].toArray(color, i * 3)
      op[i] = s.operatorIndex
      grp[i] = s.groupIndex
      idx[i] = i
      size[i] = OPERATORS[s.operatorIndex].id === 'stations' ? 3.2 : OPERATORS[s.operatorIndex].id === 'debris' ? 0.85 : OPERATORS[s.operatorIndex].id === 'spacex' ? 0.78 : 1
    })
    this.geometry.setAttribute('position', this.posAttr)
    this.geometry.setAttribute('aColor', new THREE.BufferAttribute(color, 3))
    this.geometry.setAttribute('aOp', new THREE.BufferAttribute(op, 1))
    this.geometry.setAttribute('aGroup', new THREE.BufferAttribute(grp, 1))
    this.geometry.setAttribute('aIdx', new THREE.BufferAttribute(idx, 1))
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    this.geometry.setAttribute('aCountry', new THREE.BufferAttribute(new Float32Array(n).fill(-1), 1))
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1000)

    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uHidden: { value: this.hidden },
        uFocusOp: { value: -1 },
        uFocusGroup: { value: -1 },
        uFocusCountry: { value: -1 },
        uUnit: { value: 1 },
        uHover: { value: -1 },
        uSel: { value: -1 },
        uPx: { value: Math.min(devicePixelRatio, 2) },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aColor; attribute float aOp; attribute float aGroup; attribute float aIdx; attribute float aSize; attribute float aCountry;
        uniform float uFocusCountry; uniform float uUnit; uniform float uHidden[16]; uniform float uFocusOp; uniform float uFocusGroup; uniform float uHover; uniform float uSel; uniform float uPx;
        varying vec3 vColor; varying float vAlpha;
        void main() {
          float alpha = 0.78; float s = 1.0;
          if (uFocusCountry >= 0.0) {
            bool inCountry = abs(aCountry - uFocusCountry) < 0.5;
            alpha = inCountry ? 1.0 : 0.06;
            s = inCountry ? 1.6 : 1.0;
          } else if (uFocusOp >= 0.0) {
            bool inGroup = abs(aGroup - uFocusGroup) < 0.5;
            bool inOp = abs(aOp - uFocusOp) < 0.5;
            alpha = inGroup ? 1.0 : (inOp ? (uFocusGroup < 0.0 ? 1.0 : 0.55) : 0.06);
            s = inGroup ? 1.5 : 1.0;
          }
          bool special = abs(aIdx - uSel) < 0.5 || abs(aIdx - uHover) < 0.5;
          if (special) { alpha = 1.0; s = 3.2; }
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = (uHidden[int(aOp + 0.5)] > 0.5) ? 0.0 : aSize * s * uPx * clamp(40.0 * uUnit / -mv.z, 2.2, 8.0);
          gl_Position = projectionMatrix * mv;
          vColor = special ? vec3(1.0) : aColor;
          vAlpha = alpha;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vColor; varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.05, d);
          gl_FragColor = vec4(vColor * (1.0 + a * 0.6), a * vAlpha);
        }`,
    })
    this.points = new THREE.Points(this.geometry, this.material)
    this.points.frustumCulled = false
  }

  /** Call after the engine refreshed `positions`. */
  touchPositions(): void {
    this.posAttr.needsUpdate = true
  }

  setFocus(f: FocusState): void {
    const u = this.material.uniforms
    u.uFocusOp.value = f.operator
    u.uFocusGroup.value = f.group
    u.uFocusCountry.value = f.country
    u.uHover.value = f.hover
    u.uSel.value = f.selected
  }

  /** Per-satellite country index (or -1), set once owner data arrives. */
  setCountries(ids: Float32Array): void {
    const attr = this.geometry.getAttribute('aCountry') as THREE.BufferAttribute
    attr.set(ids)
    attr.needsUpdate = true
  }

  /** Scene units per satellite-scene unit: 1 in the Earth view, a tiny AU factor inside the solar system. */
  setUnit(unit: number): void {
    this.material.uniforms.uUnit.value = unit
  }

  setOperatorHidden(operatorIndex: number, hidden: boolean): void {
    this.hidden[operatorIndex] = hidden ? 1 : 0
  }

  isHidden(operatorIndex: number): boolean {
    return this.hidden[operatorIndex] > 0.5
  }

  /** Nearest visible, un-occluded satellite to a pixel, within `radiusPx`. -1 if none. */
  pick(px: number, py: number, width: number, height: number, camera: THREE.PerspectiveCamera, radiusPx = 12, allow?: (index: number) => boolean): number {
    const pos = this.posAttr.array as Float32Array
    camera.updateMatrixWorld()
    const m = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    const e = m.elements
    const cands: { i: number; d: number }[] = []
    const r2 = radiusPx * radiusPx
    for (let i = 0; i < this.sats.length; i++) {
      const x = pos[i * 3]
      if (x !== x || this.hidden[this.sats[i].operatorIndex] > 0.5 || (allow && !allow(i))) continue
      const y = pos[i * 3 + 1]
      const z = pos[i * 3 + 2]
      const w = e[3] * x + e[7] * y + e[11] * z + e[15]
      if (w <= 0) continue
      const sx = ((e[0] * x + e[4] * y + e[8] * z + e[12]) / w * 0.5 + 0.5) * width
      const sy = (1 - ((e[1] * x + e[5] * y + e[9] * z + e[13]) / w * 0.5 + 0.5)) * height
      const d2 = (sx - px) * (sx - px) + (sy - py) * (sy - py)
      if (d2 < r2) cands.push({ i, d: d2 })
    }
    cands.sort((a, b) => a.d - b.d)
    for (const c of cands) {
      this.tmp.set(pos[c.i * 3], pos[c.i * 3 + 1], pos[c.i * 3 + 2])
      if (!this.occluded(camera.position, this.tmp)) return c.i
    }
    return -1
  }

  /** Segment camera->point intersects the Earth sphere before reaching the point. */
  private occluded(cam: THREE.Vector3, p: THREE.Vector3): boolean {
    this.ray.subVectors(p, cam)
    const len = this.ray.length()
    this.ray.divideScalar(len)
    const b = cam.dot(this.ray)
    const c = cam.lengthSq() - EARTH_RADIUS * EARTH_RADIUS
    const disc = b * b - c
    if (disc < 0) return false
    const t = -b - Math.sqrt(disc)
    return t > 0 && t < len
  }
}
