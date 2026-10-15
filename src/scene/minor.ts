import * as THREE from 'three'
import { probeById, type Agency, type Probe } from '../data/probes'
import { blurbFor, type Row, type SmallBody, type SmallBodyFile, type SmallKind } from '../data/smallBodies'
import { julianDate } from '../lib/ephemeris'
import { orbitArc, positionFromElements, solveElliptic, type Elements } from '../lib/kepler'
import { trackPosition, type Track } from '../lib/trajectory'

export type MinorKind = 'probe' | SmallKind

export interface MinorInfo {
  readonly id: string
  readonly name: string
  readonly kind: MinorKind
  readonly color: string
  readonly probe?: Probe
  readonly body?: SmallBody
  readonly blurb: string
}

export interface ProbeTrack extends Track {
  readonly id: string
}

export interface ProbeFile {
  readonly generated: string
  readonly from: string
  readonly to: string
  readonly probes: readonly ProbeTrack[]
}

export type MinorLayer = 'craft' | 'small'

const KIND_COLOR: Readonly<Record<MinorKind, string>> = {
  probe: '#ffffff',
  comet: '#7ee8ff',
  asteroid: '#ffb86b',
  dwarf: '#c9a0ff',
  interstellar: '#ff7ad9',
}
const AGENCY_COLOR: Readonly<Record<Agency, string>> = { NASA: '#ff8a5c', ESA: '#7fb8ff', JAXA: '#ffd166' }

const toScene = (x: number, y: number, z: number, out: THREE.Vector3): THREE.Vector3 => out.set(x, z, -y)
const RAD = Math.PI / 180

/** A cloud of thousands of small bodies. Orbits are solved in double precision; the GPU only sees positions relative to the focus. */
class Crowd {
  readonly points: THREE.Points
  private readonly count: number
  private readonly consts: Float64Array // per body: a, e, mean motion, tp, P xyz, Q xyz
  private readonly abs: Float64Array
  private readonly buffer: Float32Array
  private lastJd = Number.NaN

  constructor(rows: readonly Row[], color: string, size: number, opacity: number) {
    this.count = rows.length
    this.consts = new Float64Array(rows.length * 10)
    this.abs = new Float64Array(rows.length * 3)
    this.buffer = new Float32Array(rows.length * 3)
    rows.forEach(([q, eRaw, i, om, w, tp], k) => {
      const e = Math.min(eRaw, 0.999999) // rounding can push a near-parabolic comet onto e = 1, which has no ellipse
      const a = q / (1 - e)
      const co = Math.cos(om * RAD)
      const so = Math.sin(om * RAD)
      const ci = Math.cos(i * RAD)
      const si = Math.sin(i * RAD)
      const cw = Math.cos(w * RAD)
      const sw = Math.sin(w * RAD)
      this.consts.set([a, e, 0.01720209895 / Math.sqrt(a ** 3), tp, co * cw - so * ci * sw, so * cw + co * ci * sw, si * sw, -co * sw - so * ci * cw, -so * sw + co * ci * cw, si * cw], k * 10)
    })
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.buffer, 3))
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: new THREE.Color(color) }, uSize: { value: size * Math.min(devicePixelRatio, 2) }, uOpacity: { value: opacity } },
      vertexShader: `uniform float uSize; void main() { gl_PointSize = uSize; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 uColor; uniform float uOpacity; void main() { float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(uColor, smoothstep(0.5, 0.12, d) * uOpacity); }`,
    })
    this.points = new THREE.Points(geo, material)
    this.points.frustumCulled = false
    this.points.renderOrder = 1
  }

  update(jd: number, focus: THREE.Vector3): void {
    const c = this.consts
    // orbits only need re-solving when simulated time has moved noticeably
    if (!(Math.abs(jd - this.lastJd) < 0.02)) {
      this.lastJd = jd
      for (let k = 0; k < this.count; k++) {
        const o = k * 10
        const a = c[o]
        const e = c[o + 1]
        const ea = solveElliptic(c[o + 2] * (jd - c[o + 3]), e)
        const px = a * (Math.cos(ea) - e)
        const py = a * Math.sqrt(1 - e * e) * Math.sin(ea)
        const x = px * c[o + 4] + py * c[o + 7]
        const y = px * c[o + 5] + py * c[o + 8]
        const z = px * c[o + 6] + py * c[o + 9]
        this.abs[k * 3] = x
        this.abs[k * 3 + 1] = z
        this.abs[k * 3 + 2] = -y
      }
    }
    for (let k = 0; k < this.count * 3; k += 3) {
      this.buffer[k] = this.abs[k] - focus.x
      this.buffer[k + 1] = this.abs[k + 1] - focus.y
      this.buffer[k + 2] = this.abs[k + 2] - focus.z
    }
    this.points.geometry.attributes.position.needsUpdate = true
  }
}

/** Glowing dust and ion tails: soft points strung along the line away from the Sun, fading with distance. */
class Tail {
  readonly ion: THREE.Points
  readonly dust: THREE.Points
  private static readonly N = 90
  private readonly ionBuf = new Float32Array(Tail.N * 3)
  private readonly dustBuf = new Float32Array(Tail.N * 3)

  constructor() {
    const alpha = new Float32Array(Tail.N)
    for (let k = 0; k < Tail.N; k++) alpha[k] = (1 - k / Tail.N) ** 1.6
    const make = (buf: Float32Array, color: string, strength: number): THREE.Points => {
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(buf, 3))
      geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1))
      const pts = new THREE.Points(
        geo,
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          uniforms: { uColor: { value: new THREE.Color(color) }, uStrength: { value: strength }, uScale: { value: 900 * Math.min(devicePixelRatio, 2) } },
          vertexShader: `uniform float uScale; attribute float aAlpha; varying float vA;
            void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vA = aAlpha; gl_PointSize = clamp(0.012 * uScale / -mv.z * (0.4 + aAlpha), 1.0, 46.0); gl_Position = projectionMatrix * mv; }`,
          fragmentShader: `uniform vec3 uColor; uniform float uStrength; varying float vA;
            void main() { float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(uColor, smoothstep(0.5, 0.0, d) * vA * uStrength); }`,
        }),
      )
      pts.frustumCulled = false
      pts.visible = false
      pts.renderOrder = 2
      return pts
    }
    this.ion = make(this.ionBuf, '#7fd8ff', 0.1)
    this.dust = make(this.dustBuf, '#ffe2b0', 0.07)
  }

  /** `rel` is the comet relative to the focus; `away` the unit vector pointing away from the Sun; `rSun` its distance from the Sun (AU). */
  update(rel: THREE.Vector3, away: THREE.Vector3, rSun: number): void {
    const length = rSun > 3.5 ? 0 : Math.min(0.7, 0.45 * (1.1 / Math.max(0.12, rSun)) ** 1.6)
    this.ion.visible = this.dust.visible = length > 0.0005
    if (!this.ion.visible) return
    const side = new THREE.Vector3(0, 1, 0).cross(away).normalize()
    for (let k = 0; k < Tail.N; k++) {
      const u = k / (Tail.N - 1)
      const ionT = length * u
      const dustT = length * 0.55 * u
      const bend = dustT * u * 0.5
      this.ionBuf[k * 3] = rel.x + away.x * ionT
      this.ionBuf[k * 3 + 1] = rel.y + away.y * ionT
      this.ionBuf[k * 3 + 2] = rel.z + away.z * ionT
      this.dustBuf[k * 3] = rel.x + away.x * dustT + side.x * bend
      this.dustBuf[k * 3 + 1] = rel.y + away.y * dustT + side.y * bend
      this.dustBuf[k * 3 + 2] = rel.z + away.z * dustT + side.z * bend
    }
    this.ion.geometry.attributes.position.needsUpdate = true
    this.dust.geometry.attributes.position.needsUpdate = true
  }
}

interface Marker {
  readonly info: MinorInfo
  readonly sprite: THREE.Sprite
  /** absolute heliocentric position, scene axes, AU */
  readonly pos: THREE.Vector3
  readonly el?: Elements
  readonly track?: Track
  readonly tail?: Tail
  readonly path?: THREE.Line
  /** false when the date is outside a spacecraft's published trajectory */
  inRange: boolean
}

function markerTexture(shape: 'ring' | 'diamond' | 'cross'): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  g.strokeStyle = '#fff'
  g.fillStyle = '#fff'
  g.lineWidth = 5
  g.lineCap = 'round'
  if (shape === 'ring') {
    g.beginPath()
    g.arc(32, 32, 17, 0, Math.PI * 2)
    g.stroke()
    g.beginPath()
    g.arc(32, 32, 4.5, 0, Math.PI * 2)
    g.fill()
  } else if (shape === 'diamond') {
    g.beginPath()
    g.moveTo(32, 12)
    g.lineTo(52, 32)
    g.lineTo(32, 52)
    g.lineTo(12, 32)
    g.closePath()
    g.stroke()
  } else {
    g.beginPath()
    g.moveTo(32, 10)
    g.lineTo(32, 54)
    g.moveTo(10, 32)
    g.lineTo(54, 32)
    g.stroke()
    g.beginPath()
    g.arc(32, 32, 6, 0, Math.PI * 2)
    g.fill()
  }
  return new THREE.CanvasTexture(c)
}

const SHAPE: Readonly<Record<MinorKind, 'ring' | 'diamond' | 'cross'>> = { probe: 'cross', comet: 'ring', interstellar: 'ring', asteroid: 'diamond', dwarf: 'diamond' }

/**
 * Spacecraft, named comets and asteroids, and thousands of unnamed small bodies, all from NASA/JPL data.
 * Spacecraft follow published Horizons trajectories; small bodies follow their Keplerian orbits.
 */
export class MinorBodies {
  readonly root = new THREE.Group()
  private readonly pathRoot = new THREE.Group()
  private readonly markers = new Map<string, Marker>()
  private readonly crowds: Crowd[] = []
  private readonly textures = new Map<string, THREE.CanvasTexture>()
  private orbit: THREE.Line | null = null
  private focusId = ''
  private layers: Record<MinorLayer, boolean> = { craft: true, small: true }
  private readonly tmp = new THREE.Vector3()
  private readonly rel = new THREE.Vector3()
  private readonly sun = new THREE.Vector3()
  generated = { probes: '', small: '' }
  /** end of the published trajectories, Julian date (earliest across craft that have one) */
  trajectoryRange: { from: string; to: string } | null = null

  constructor() {
    this.root.add(this.pathRoot)
  }

  get loaded(): boolean {
    return this.markers.size > 0
  }

  load(probes: ProbeFile | null, small: SmallBodyFile | null): void {
    if (probes) {
      this.generated.probes = probes.generated
      this.trajectoryRange = { from: probes.from, to: probes.to }
      for (const t of probes.probes) {
        const probe = probeById(t.id)
        if (!probe) continue
        const color = AGENCY_COLOR[probe.agency]
        const info: MinorInfo = { id: probe.id, name: probe.name, kind: 'probe', color, probe, blurb: probe.blurb }
        this.addMarker(info, { track: t, path: this.pathLine(t, color) })
      }
    }
    if (small) {
      this.generated.small = small.generated
      for (const body of small.notables) {
        const info: MinorInfo = { id: `sb-${body.id.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name: body.name.replace(/^\d+ /, ''), kind: body.kind, color: KIND_COLOR[body.kind], body, blurb: blurbFor(body) }
        this.addMarker(info, { el: body.el, tail: body.kind === 'comet' || body.kind === 'interstellar' ? new Tail() : undefined })
      }
      const p = small.populations
      const make = (rows: readonly Row[], color: string, size: number, opacity: number) => {
        if (rows.length === 0) return
        const crowd = new Crowd(rows, color, size, opacity)
        this.crowds.push(crowd)
        this.root.add(crowd.points)
      }
      make(p.main, '#9db4cc', 1.5, 0.55)
      make(p.trojans, '#7bd88f', 1.6, 0.6)
      make(p.tno, '#b794f6', 1.8, 0.65)
      make(p.neo, '#ffb347', 2.4, 0.85)
      make(p.comets, '#7ee8ff', 2.6, 0.85)
    }
    this.applyLayers()
  }

  private texture(kind: MinorKind): THREE.CanvasTexture {
    const shape = SHAPE[kind]
    let t = this.textures.get(shape)
    if (!t) {
      t = markerTexture(shape)
      this.textures.set(shape, t)
    }
    return t
  }

  private addMarker(info: MinorInfo, extra: { el?: Elements; track?: Track; tail?: Tail; path?: THREE.Line }): void {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texture(info.kind), color: info.color, sizeAttenuation: false, depthWrite: false, transparent: true }))
    sprite.scale.set(0.017, 0.017, 1)
    sprite.renderOrder = 3
    sprite.userData.minorId = info.id
    this.root.add(sprite)
    if (extra.tail) this.root.add(extra.tail.ion, extra.tail.dust)
    if (extra.path) this.pathRoot.add(extra.path)
    this.markers.set(info.id, { info, sprite, pos: new THREE.Vector3(), inRange: true, ...extra })
  }

  private pathLine(t: Track, color: string): THREE.Line {
    const n = t.pos.length / 3
    const stride = Math.max(1, Math.floor(n / 500))
    const pts: number[] = []
    for (let k = 0; k < n; k += stride) pts.push(t.pos[k * 3] * 1e-6, t.pos[k * 3 + 2] * 1e-6, -t.pos[k * 3 + 1] * 1e-6)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.05, depthWrite: false }))
    line.frustumCulled = false
    return line
  }

  list(): readonly MinorInfo[] {
    return [...this.markers.values()].map((m) => m.info)
  }

  info(id: string): MinorInfo | undefined {
    return this.markers.get(id)?.info
  }

  has(id: string): boolean {
    return this.markers.has(id)
  }

  /** Absolute heliocentric position (scene axes, AU) as of the last update. */
  position(id: string): THREE.Vector3 | undefined {
    return this.markers.get(id)?.pos
  }

  inRange(id: string): boolean {
    return this.markers.get(id)?.inRange ?? true
  }

  setLayer(layer: MinorLayer, on: boolean): void {
    this.layers = { ...this.layers, [layer]: on }
    this.applyLayers()
  }

  private applyLayers(): void {
    for (const c of this.crowds) c.points.visible = this.layers.small
    for (const m of this.markers.values()) {
      const show = m.info.kind === 'probe' ? this.layers.craft : this.layers.small
      m.sprite.visible = show || m.info.id === this.focusId
      if (m.path) m.path.visible = this.layers.craft
      if (m.tail && !show) m.tail.ion.visible = m.tail.dust.visible = false
    }
  }

  /** Brighten and draw the orbit of whatever is in focus. */
  setFocus(id: string): void {
    this.focusId = id
    for (const m of this.markers.values()) {
      const on = m.info.id === id
      m.sprite.scale.setScalar(on ? 0.03 : 0.017)
      if (m.path) (m.path.material as THREE.LineBasicMaterial).opacity = on ? 0.7 : 0.05
    }
    if (this.orbit) {
      this.pathRoot.remove(this.orbit)
      this.orbit.geometry.dispose()
      this.orbit = null
    }
    const focused = this.markers.get(id)
    if (focused?.el) {
      const arc = orbitArc(focused.el, 160, 420)
      const flat = new Float32Array(arc.length)
      for (let k = 0; k < arc.length; k += 3) {
        flat[k] = arc[k]
        flat[k + 1] = arc[k + 2]
        flat[k + 2] = -arc[k + 1]
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(flat, 3))
      this.orbit = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: focused.info.color, transparent: true, opacity: 0.55, depthWrite: false }))
      this.orbit.frustumCulled = false
      this.pathRoot.add(this.orbit)
    }
    this.applyLayers()
  }

  /** `sunRel` is the Sun's position relative to the focus, so tails can point away from it. */
  update(nowMs: number, focus: THREE.Vector3, sunRel: THREE.Vector3): void {
    if (!this.loaded && this.crowds.length === 0) return
    const jd = julianDate(nowMs)
    this.pathRoot.position.copy(focus).negate()
    this.sun.copy(sunRel)
    for (const m of this.markers.values()) {
      if (m.track) {
        const r = trackPosition(m.track, jd)
        toScene(r.pos.x, r.pos.y, r.pos.z, m.pos)
        m.inRange = r.inRange
      } else if (m.el) {
        const p = positionFromElements(m.el, jd)
        toScene(p.x, p.y, p.z, m.pos)
      }
      this.rel.copy(m.pos).sub(focus)
      m.sprite.position.copy(this.rel)
      ;(m.sprite.material as THREE.SpriteMaterial).opacity = m.inRange ? 1 : 0.4
      if (m.tail && m.sprite.visible) {
        this.tmp.copy(m.pos).normalize() // away from the Sun, which sits at the origin
        m.tail.update(this.rel, this.tmp, m.pos.length())
      }
    }
    if (this.layers.small) for (const c of this.crowds) c.update(jd, focus)
  }

  /** Nearest marker under a ray, if any. */
  pick(raycaster: THREE.Raycaster): { id: string; distance: number } | null {
    let best: { id: string; distance: number } | null = null
    for (const m of this.markers.values()) {
      if (!m.sprite.visible) continue
      const hit = raycaster.intersectObject(m.sprite, false)[0]
      if (hit && (!best || hit.distance < best.distance)) best = { id: m.info.id, distance: hit.distance }
    }
    return best
  }

  /** Marker positions relative to the focus, for placing labels. */
  relativePositions(focus: THREE.Vector3): { info: MinorInfo; rel: THREE.Vector3 }[] {
    return [...this.markers.values()].filter((m) => m.sprite.visible).map((m) => ({ info: m.info, rel: m.pos.clone().sub(focus) }))
  }
}

