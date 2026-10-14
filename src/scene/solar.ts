import * as THREE from 'three'
import { BODIES, MOONS, SUN, bodyById, moonsOf, type Body, type Moon } from '../data/bodies'
import { AU_KM, PLANET_IDS, heliocentric, moonGeocentric, orbitPath, poleEcliptic, type PlanetId, type Vec3 } from '../lib/ephemeris'
import { bodyTexture, ringTexture } from './textures'

/** One scene unit in the satellite scene is 1000 km; this converts it to AU. */
export const SAT_UNIT_AU = 1000 / AU_KM
const MIN_ANGULAR = { star: 0.03, planet: 0.011, dwarf: 0.008, moon: 0.004 } as const

/** Ecliptic (x east, z north) to three.js (y up). */
const toScene = (v: Vec3, out: THREE.Vector3 = new THREE.Vector3()): THREE.Vector3 => out.set(v.x, v.z, -v.y)
const radiusAu = (b: { radiusKm: number }): number => b.radiusKm / AU_KM

interface PlanetNode {
  readonly body: Body
  readonly group: THREE.Group
  readonly tilt: THREE.Group
  readonly spin: THREE.Mesh
  readonly orbit: THREE.LineLoop
  readonly moonRoot: THREE.Group
  /** absolute heliocentric position, scene axes, AU (double precision) */
  pos: THREE.Vector3
}

interface MoonNode {
  readonly moon: Moon
  readonly mesh: THREE.Mesh
  readonly phase0: number
  pos: THREE.Vector3
}

export interface LabelPoint {
  readonly id: string
  readonly name: string
  readonly kind: Body['kind'] | 'moon'
  readonly x: number
  readonly y: number
  readonly visible: boolean
}

function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128)
  grad.addColorStop(0, 'rgba(255,236,190,1)')
  grad.addColorStop(0.12, 'rgba(255,214,140,0.85)')
  grad.addColorStop(0.35, 'rgba(255,170,80,0.28)')
  grad.addColorStop(1, 'rgba(255,140,40,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 256)
  return new THREE.CanvasTexture(c)
}

/**
 * The solar system with a floating origin: everything is positioned relative to the focused body, in
 * double precision, so the camera always works near the origin and nothing jitters even 40 AU out.
 */
export class SolarSystem {
  readonly root = new THREE.Group()
  private readonly world = new THREE.Group()
  private readonly planets = new Map<string, PlanetNode>()
  private readonly moons: MoonNode[] = []
  private readonly sunGroup = new THREE.Group()
  private readonly sunMesh: THREE.Mesh
  private readonly sunGlow: THREE.Sprite
  private readonly light = new THREE.PointLight(0xfff1dc, 3.2, 0, 0)
  private built = false
  private focus = new THREE.Vector3()
  private focusTarget = new THREE.Vector3()
  private focusSnap = true
  focusId = 'earth'
  /** Earth's sidereal angle in radians, set by the caller each frame. */
  earthSpin = 0
  private zoom: { from: number; to: number; t0: number; seconds: number; dirFrom?: THREE.Vector3; turn?: THREE.Quaternion } | null = null
  private readonly raycaster = new THREE.Raycaster()
  private readonly tmp = new THREE.Vector3()

  constructor() {
    this.sunMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshBasicMaterial({ color: 0xffe2a8 }))
    this.sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }))
    this.sunGroup.add(this.sunMesh, this.sunGlow, this.light)
    this.root.add(this.world, this.sunGroup, new THREE.AmbientLight(0xffffff, 0.12))
  }

  /** Builds meshes and textures. Deferred so the cost is only paid when someone opens the solar system. */
  build(): void {
    if (this.built) return
    this.built = true
    const sphere = new THREE.SphereGeometry(1, 64, 48)
    for (const body of BODIES) {
      if (body.id === 'sun') continue
      const id = body.id as PlanetId
      const group = new THREE.Group()
      const tilt = new THREE.Group()
      const spin = new THREE.Mesh(sphere, new THREE.MeshStandardMaterial({ map: bodyTexture(body.id), roughness: 1, metalness: 0 }))
      tilt.add(spin)
      if (body.rings) tilt.add(this.makeRings())
      // orient the spin axis along the body's real north pole (ecliptic frame, then to scene axes)
      const pole = toScene(poleEcliptic(body.pole.ra, body.pole.dec)).normalize()
      tilt.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pole)
      group.add(tilt)
      const path = orbitPath(id, 360)
      const flat = new Float32Array(path.length)
      for (let i = 0; i < path.length; i += 3) {
        flat[i] = path[i]
        flat[i + 1] = path[i + 2]
        flat[i + 2] = -path[i + 1]
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(flat, 3))
      const orbit = new THREE.LineLoop(geo, new THREE.LineBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.16, depthWrite: false }))
      orbit.frustumCulled = false
      const moonRoot = new THREE.Group()
      this.world.add(orbit)
      this.root.add(group, moonRoot)
      this.planets.set(body.id, { body, group, tilt, spin, orbit, moonRoot, pos: new THREE.Vector3() })
    }
    MOONS.forEach((moon, i) => {
      const mesh = new THREE.Mesh(sphere, new THREE.MeshStandardMaterial({ map: bodyTexture(moon.id === 'moon' ? 'moon' : 'default'), color: new THREE.Color(moon.color), roughness: 1 }))
      mesh.visible = false
      this.planets.get(moon.parent)?.moonRoot.add(mesh)
      this.moons.push({ moon, mesh, phase0: ((i * 2.399963) % (Math.PI * 2)), pos: new THREE.Vector3() })
    })
  }

  private makeRings(): THREE.Mesh {
    const inner = 1.24
    const outer = 2.27
    const geo = new THREE.RingGeometry(inner, outer, 160, 1)
    const pos = geo.attributes.position
    const uv = geo.attributes.uv
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (Math.hypot(pos.getX(i), pos.getY(i)) - inner) / (outer - inner), 0.5)
    const ring = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: ringTexture(), transparent: true, side: THREE.DoubleSide, depthWrite: false, roughness: 1, emissive: 0x2a2620 }))
    ring.rotation.x = -Math.PI / 2
    return ring
  }

  // ---- positions ----

  /** Absolute heliocentric position of any body, scene axes, AU. */
  private absolute(id: string): THREE.Vector3 {
    if (id === 'sun') return this.tmp.set(0, 0, 0)
    const moon = this.moons.find((m) => m.moon.id === id)
    if (moon) return moon.pos
    return this.planets.get(id)?.pos ?? this.tmp.set(0, 0, 0)
  }

  private posOf(id: string): THREE.Vector3 | undefined {
    return id === 'sun' ? new THREE.Vector3() : (this.planets.get(id)?.pos ?? this.moons.find((m) => m.moon.id === id)?.pos)
  }

  distanceFromSunAu(id: string): number {
    return this.posOf(id)?.length() ?? 0
  }

  distanceFromEarthAu(id: string): number {
    const earth = this.planets.get('earth')
    const p = this.posOf(id)
    return earth && p ? earth.pos.distanceTo(p) : 0
  }

  // ---- focus and camera ----

  setFocus(id: string, immediate = false): void {
    this.focusId = id
    if (immediate) this.focusSnap = true
  }

  /** Smallest sensible camera distance for a body (AU). */
  minDistance(id: string): number {
    const body = id === 'sun' ? SUN : (bodyById(id) ?? MOONS.find((m) => m.id === id))
    return body ? radiusAu(body) * 1.18 : 1e-5
  }

  /** A comfortable first view of a body (AU). */
  viewDistance(id: string): number {
    if (id === 'sun') return 0.03
    const moon = MOONS.find((m) => m.id === id)
    if (moon) return radiusAu(moon) * 6
    const body = bodyById(id)!
    const moonSpan = Math.max(0, ...moonsOf(id).map((m) => m.orbitKm)) / AU_KM
    return Math.max(radiusAu(body) * 5, id === 'saturn' ? radiusAu(body) * 7 : moonSpan * 0.9)
  }

  /** Fly the camera distance to `to` (log-eased) and, optionally, swing it round to look along `direction`. */
  startZoom(camera: THREE.PerspectiveCamera, to: number, seconds: number, from = camera.position.length(), direction?: THREE.Vector3): void {
    if (camera.position.lengthSq() === 0) camera.position.set(0.35, 0.45, 0.82)
    const dirFrom = camera.position.clone().normalize()
    const turn = direction ? new THREE.Quaternion().setFromUnitVectors(dirFrom, direction.clone().normalize()) : undefined
    this.zoom = { from, to, t0: performance.now(), seconds, dirFrom, turn }
  }

  /**
   * A camera direction that looks at a body from its sunlit side, swung 40 degrees round and lifted a little
   * so the day/night terminator shows. Based on where the body actually is now.
   */
  sunSideDirection(id: string): THREE.Vector3 {
    const p = this.posOf(id) ?? new THREE.Vector3(1, 0, 0)
    const toSun = p.clone().negate()
    if (toSun.lengthSq() === 0) toSun.set(0, 0, 1)
    toSun.normalize()
    toSun.applyAxisAngle(new THREE.Vector3(0, 1, 0), (40 * Math.PI) / 180)
    toSun.y += 0.28
    return toSun.normalize()
  }

  /** The nearest body under a screen point, or null. */
  pickBody(ndcX: number, ndcY: number, camera: THREE.PerspectiveCamera): string | null {
    if (!this.built) return null
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera)
    const targets: { obj: THREE.Object3D; id: string }[] = [{ obj: this.sunMesh, id: 'sun' }]
    for (const n of this.planets.values()) targets.push({ obj: n.spin, id: n.body.id })
    for (const m of this.moons) if (m.mesh.visible) targets.push({ obj: m.mesh, id: m.moon.id })
    let best: { id: string; d: number } | null = null
    for (const t of targets) {
      const hit = this.raycaster.intersectObject(t.obj, false)[0]
      if (hit && (!best || hit.distance < best.d)) best = { id: t.id, d: hit.distance }
    }
    return best?.id ?? null
  }

  /** Width of the visible slice of space at the focus point, in AU. */
  viewWidthAu(camera: THREE.PerspectiveCamera): number {
    return 2 * camera.position.length() * Math.tan((camera.fov * Math.PI) / 360) * camera.aspect
  }

  cancelZoom(): void {
    this.zoom = null
  }

  get zooming(): boolean {
    return this.zoom !== null
  }

  // ---- per-frame ----

  /** Absolute positions in double precision for every planet and moon. */
  private computePositions(nowMs: number): void {
    for (const id of PLANET_IDS) {
      const node = this.planets.get(id)
      if (node) toScene(heliocentric(id, nowMs), node.pos)
    }
    const days = nowMs / 86_400_000
    for (const m of this.moons) {
      const parent = this.planets.get(m.moon.parent)!
      if (m.moon.id === 'moon') toScene(moonGeocentric(nowMs), m.pos)
      else {
        const a = m.phase0 + ((m.moon.retrograde ? -1 : 1) * 2 * Math.PI * days) / m.moon.periodDays
        const r = m.moon.orbitKm / AU_KM
        m.pos.set(r * Math.cos(a), 0, -r * Math.sin(a))
      }
      m.pos.add(parent.pos) // absolute
    }

  }

  /** Make positions available before the first rendered frame (used to aim the camera on arrival). */
  prime(nowMs: number): void {
    if (this.built) this.computePositions(nowMs)
  }


  update(nowMs: number, camera: THREE.PerspectiveCamera, dt: number): void {
    if (!this.built) return
    this.computePositions(nowMs)

    // smooth focus (floating origin)
    const target = this.focusId === 'sun' ? this.tmp.set(0, 0, 0) : this.absolute(this.focusId)
    this.focusTarget.copy(target)
    if (this.focusSnap) {
      this.focus.copy(this.focusTarget)
      this.focusSnap = false
    } else {
      const k = 1 - Math.exp(-dt * 4)
      this.focus.lerp(this.focusTarget, k)
      if (this.focus.distanceToSquared(this.focusTarget) < (this.minDistance(this.focusId) * 0.05) ** 2) this.focus.copy(this.focusTarget)
    }

    if (this.zoom) {
      const t = Math.min(1, (performance.now() - this.zoom.t0) / (this.zoom.seconds * 1000))
      const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
      const d = Math.exp(Math.log(this.zoom.from) + (Math.log(this.zoom.to) - Math.log(this.zoom.from)) * e)
      if (this.zoom.turn && this.zoom.dirFrom) {
        const q = new THREE.Quaternion().slerp(this.zoom.turn, e)
        camera.position.copy(this.zoom.dirFrom).applyQuaternion(q).setLength(d)
      } else camera.position.setLength(d)
      if (t >= 1) this.zoom = null
    }

    this.world.position.copy(this.focus).negate()
    const sunRel = this.tmp.copy(this.focus).negate()
    this.sunGroup.position.copy(sunRel)
    const sunDist = camera.position.distanceTo(sunRel)
    const sunScale = Math.max(radiusAu(SUN), MIN_ANGULAR.star * sunDist * 0.55)
    this.sunMesh.scale.setScalar(sunScale)
    this.sunGlow.scale.setScalar(sunScale * 9)

    for (const node of this.planets.values()) {
      node.group.position.copy(node.pos).sub(this.focus)
      node.moonRoot.position.copy(node.group.position)
      const dist = camera.position.distanceTo(node.group.position)
      const real = radiusAu(node.body)
      const kind = node.body.kind === 'dwarf' ? 'dwarf' : 'planet'
      node.group.scale.setScalar(Math.max(real, MIN_ANGULAR[kind] * dist))
      const hours = node.body.rotationHours
      const turns = node.body.id === 'earth' ? this.earthSpin : (((nowMs / 3_600_000) / hours) % 1) * Math.PI * 2
      node.spin.rotation.y = turns
      const focused = node.body.id === this.focusId
      ;(node.orbit.material as THREE.LineBasicMaterial).opacity = focused ? 0.5 : 0.16
      const showMoons = dist < Math.max(0.2, real * 400)
      for (const m of this.moons) if (m.moon.parent === node.body.id) m.mesh.visible = showMoons
    }
    this.light.position.copy(sunRel)

    for (const m of this.moons) {
      if (!m.mesh.visible) continue
      const parent = this.planets.get(m.moon.parent)!
      m.mesh.position.copy(m.pos).sub(parent.pos) // relative to the parent's moonRoot
      const world = this.tmp.copy(m.pos).sub(this.focus)
      const dist = camera.position.distanceTo(world)
      m.mesh.scale.setScalar(Math.max(radiusAu(m.moon), MIN_ANGULAR.moon * dist))
    }
  }

  /** Screen positions for clickable labels. */
  labels(camera: THREE.PerspectiveCamera, width: number, height: number): LabelPoint[] {
    const out: LabelPoint[] = []
    const v = new THREE.Vector3()
    const push = (id: string, name: string, kind: LabelPoint['kind'], world: THREE.Vector3, show = true) => {
      v.copy(world).project(camera)
      const visible = show && v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05
      out.push({ id, name, kind, x: (v.x * 0.5 + 0.5) * width, y: (1 - (v.y * 0.5 + 0.5)) * height, visible })
    }
    push('sun', 'Sun', 'star', this.sunGroup.position)
    for (const node of this.planets.values()) {
      // the body you are looking at fills the screen: its name would only sit on top of it
      const closeUp = node.body.id === this.focusId && camera.position.distanceTo(node.group.position) < radiusAu(node.body) * 40
      push(node.body.id, node.body.name, node.body.kind, node.group.position, !closeUp)
    }
    for (const m of this.moons) {
      if (!m.mesh.visible) continue
      const world = this.tmp.copy(m.pos).sub(this.focus)
      const dist = camera.position.distanceTo(world)
      push(m.moon.id, m.moon.name, 'moon', world.clone(), dist < 0.05)
    }
    return out
  }

  /** For attaching extra scene content (the satellite cloud) to Earth's frame. */
  get earthFrame(): THREE.Group {
    return this.planets.get('earth')!.tilt
  }

  /** Distance from the camera to Earth's centre, AU. */
  distanceToEarth(camera: THREE.PerspectiveCamera): number {
    const e = this.planets.get('earth')
    return e ? camera.position.distanceTo(e.group.position) : Infinity
  }

  get isBuilt(): boolean {
    return this.built
  }
}
