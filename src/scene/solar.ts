import * as THREE from 'three'
import { BODIES, MOONS, SUN, bodyById, moonsOf, type Body, type Moon } from '../data/bodies'
import { ATMOSPHERES, BORROWS_MOON_SURFACE, BUMP, RING_INNER, RING_OUTER } from '../data/planetMaps'
import { AU_KM, PLANET_IDS, heliocentric, moonGeocentric, orbitPath, poleEcliptic, type PlanetId, type Vec3 } from '../lib/ephemeris'
import { atmosphereShells, patchEarth, patchRingShadow, ringMaterial, texUniform, trackLocal, trackSunView, vec3Uniform } from './shading'
import { SurfaceLoader, type Layer, type SurfaceSink } from './surfaces'
import { TextureStore, allowHugeMaps } from './textureStore'
import { MinorBodies, type MinorInfo } from './minor'
import { bodyTexture, ringTexture } from './textures'

/** One scene unit in the satellite scene is 1000 km; this converts it to AU. */
export const SAT_UNIT_AU = 1000 / AU_KM
const MIN_ANGULAR = { star: 0.03, planet: 0.011, dwarf: 0.008, moon: 0.004 } as const
const SKY_RADIUS = 3500
/** Linear HDR multiplier on the Sun's surface image, so it blooms like a star rather than a painted ball. */
const SUN_TINT = new THREE.Color(1.75, 1.5, 1.15)

/** Ecliptic (x east, z north) to three.js (y up). */
const toScene = (v: Vec3, out: THREE.Vector3 = new THREE.Vector3()): THREE.Vector3 => out.set(v.x, v.z, -v.y)
const radiusAu = (b: { radiusKm: number }): number => b.radiusKm / AU_KM

interface PlanetNode {
  readonly body: Body
  readonly group: THREE.Group
  readonly tilt: THREE.Group
  readonly spin: THREE.Mesh
  readonly material: THREE.MeshStandardMaterial
  readonly orbit: THREE.LineLoop
  readonly moonRoot: THREE.Group
  /** absolute heliocentric position, scene axes, AU (double precision) */
  pos: THREE.Vector3
  /** unit vector from this body toward the Sun, scene axes */
  readonly sunDir: THREE.Vector3
}

interface MoonNode {
  readonly moon: Moon
  readonly mesh: THREE.Mesh
  readonly material: THREE.MeshStandardMaterial
  readonly phase0: number
  pos: THREE.Vector3
  readonly sunDir: THREE.Vector3
}

export interface LabelPoint {
  readonly id: string
  readonly name: string
  readonly kind: Body['kind'] | 'moon' | MinorInfo['kind']
  readonly x: number
  readonly y: number
  readonly visible: boolean
}

export interface SolarOptions {
  readonly maxAnisotropy: number
  readonly maxTextureSize: number
}

function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128)
  grad.addColorStop(0, 'rgba(255,240,205,1)')
  grad.addColorStop(0.1, 'rgba(255,222,160,0.8)')
  grad.addColorStop(0.3, 'rgba(255,176,90,0.26)')
  grad.addColorStop(0.65, 'rgba(255,140,50,0.06)')
  grad.addColorStop(1, 'rgba(255,120,30,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 256)
  return new THREE.CanvasTexture(c)
}

/**
 * The solar system with a floating origin: everything is positioned relative to the focused body, in
 * double precision, so the camera always works near the origin and nothing jitters even 40 AU out.
 */
export class SolarSystem implements SurfaceSink {
  readonly root = new THREE.Group()
  private readonly world = new THREE.Group()
  private readonly planets = new Map<string, PlanetNode>()
  private readonly moons: MoonNode[] = []
  private readonly sunGroup = new THREE.Group()
  private readonly sunMesh: THREE.Mesh
  private readonly sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffe2a8 })
  private readonly sunGlow: THREE.Sprite
  private readonly light = new THREE.PointLight(0xfff1dc, 3.2, 0, 0)
  private readonly sky: THREE.Mesh
  readonly minor = new MinorBodies()
  private readonly skyMaterial = new THREE.MeshBasicMaterial({ side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, color: new THREE.Color(1.9, 1.9, 2.2) })
  private clouds: THREE.Mesh | null = null
  private ring: THREE.Mesh | null = null
  private readonly ringMap = texUniform()
  private readonly earthSpecMap = texUniform()
  private surfaces: SurfaceLoader | null = null
  private readonly options: SolarOptions
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

  constructor(options: SolarOptions = { maxAnisotropy: 4, maxTextureSize: 4096 }) {
    this.options = options
    this.sunMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), this.sunMaterial)
    this.sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }))
    this.sunGroup.add(this.sunMesh, this.sunGlow, this.light)
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS, 64, 32), this.skyMaterial)
    this.sky.renderOrder = -10
    this.sky.visible = false
    this.sky.frustumCulled = false
    this.sky.rotation.set(1.05, 0.9, 0) // the image is in galactic coordinates; tip the band about 60 degrees to the ecliptic
    this.root.add(this.sky, this.world, this.sunGroup, this.minor.root, new THREE.AmbientLight(0xffffff, 0.1))
  }

  /** Builds meshes. Deferred so the cost is only paid when someone opens the solar system; images arrive via loadSurfaces. */
  build(): void {
    if (this.built) return
    this.built = true
    const sphere = new THREE.SphereGeometry(1, 128, 96)
    for (const body of BODIES) {
      if (body.id === 'sun') continue
      const id = body.id as PlanetId
      const group = new THREE.Group()
      const tilt = new THREE.Group()
      const material = new THREE.MeshStandardMaterial({ color: new THREE.Color(body.color), roughness: 1, metalness: 0 })
      const spin = new THREE.Mesh(sphere, material)
      const sunDir = new THREE.Vector3(1, 0, 0)
      tilt.add(spin)
      if (body.id === 'earth') this.dressEarth(material, spin, tilt, sunDir)
      if (body.rings) this.addRings(material, spin, tilt, sunDir)
      this.addAtmosphere(body.id, group, sunDir)
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
      this.planets.set(body.id, { body, group, tilt, spin, material, orbit, moonRoot, pos: new THREE.Vector3(), sunDir })
    }
    MOONS.forEach((moon, i) => {
      const tint = new THREE.Color(moon.color)
      if (BORROWS_MOON_SURFACE.has(moon.id)) tint.multiplyScalar(1.7)
      const material = new THREE.MeshStandardMaterial({ color: tint, roughness: 1 })
      const mesh = new THREE.Mesh(sphere, material)
      mesh.visible = false
      const sunDir = new THREE.Vector3(1, 0, 0)
      this.addAtmosphere(moon.id, mesh, sunDir)
      this.planets.get(moon.parent)?.moonRoot.add(mesh)
      this.moons.push({ moon, mesh, material, phase0: ((i * 2.399963) % (Math.PI * 2)), pos: new THREE.Vector3(), sunDir })
    })
    this.surfaces = new SurfaceLoader(
      new TextureStore(this.options.maxAnisotropy),
      this,
      matchMedia('(pointer: coarse)').matches ? 1 : 3,
      allowHugeMaps(this.options.maxTextureSize),
      (id) => (id === 'rings' ? ringTexture() : id === 'sun' ? null : bodyTexture(MOONS.some((m) => m.id === id) ? (id === 'moon' ? 'moon' : 'default') : id)),
    )
  }

  /** Earth gets a night side with city lights, ocean glint, relief and a drifting cloud layer. */
  private dressEarth(material: THREE.MeshStandardMaterial, spin: THREE.Mesh, tilt: THREE.Group, sunDir: THREE.Vector3): void {
    const sunView = vec3Uniform()
    patchEarth(material, sunView, this.earthSpecMap)
    trackSunView(spin, sunDir, sunView)
    material.emissive.set(0x000000)
    material.normalScale.set(0.9, 0.9)
    const clouds = new THREE.Mesh(
      spin.geometry,
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, depthWrite: false }),
    )
    clouds.scale.setScalar(1.0065)
    clouds.visible = false
    clouds.raycast = () => undefined
    tilt.add(clouds)
    this.clouds = clouds
  }

  /** Saturn: the real ring image, shadowed by the planet, throwing its own shadow back onto the globe. */
  private addRings(material: THREE.MeshStandardMaterial, spin: THREE.Mesh, tilt: THREE.Group, sunDir: THREE.Vector3): void {
    const sunOnGlobe = vec3Uniform()
    patchRingShadow(material, sunOnGlobe, this.ringMap)
    trackLocal(spin, sunDir, sunOnGlobe)
    const sunOnRing = vec3Uniform()
    const camOnRing = vec3Uniform()
    const ring = new THREE.Mesh(new THREE.RingGeometry(RING_INNER, RING_OUTER, 256, 1), ringMaterial(this.ringMap, sunOnRing, camOnRing))
    ring.rotation.x = -Math.PI / 2
    ring.visible = false
    ring.raycast = () => undefined
    trackLocal(ring, sunDir, sunOnRing, camOnRing)
    tilt.add(ring)
    this.ring = ring
  }

  private addAtmosphere(id: string, parent: THREE.Object3D, sunDir: THREE.Vector3): void {
    const spec = ATMOSPHERES[id]
    if (!spec) return
    const sunView = vec3Uniform()
    const { rim, glow } = atmosphereShells(spec, sunView, id === 'earth' ? 0.3 : 0.12)
    trackSunView(rim, sunDir, sunView)
    trackSunView(glow, sunDir, sunView)
    parent.add(rim, glow)
  }

  // ---- images ----

  /** Resolves once the first view has what it needs; every other world keeps loading and appears as it arrives. */
  async loadSurfaces(firstIds: readonly string[], onProgress?: (done: number, total: number) => void): Promise<void> {
    const surfaces = this.surfaces
    if (!surfaces) return
    const first = ['sun', ...firstIds]
    await surfaces.loadFirst(first, onProgress)
    const rest = [...BODIES.map((b) => b.id), ...MOONS.map((m) => m.id)].filter((id) => !first.includes(id))
    surfaces.loadRest(rest)
  }

  /** A sharper map for the world being looked at (no-op for worlds that only have one). */
  sharpen(id: string): void {
    void this.surfaces?.sharpen(id).then(() => this.surfaces?.touch(id))
  }

  setMap(id: string, tex: THREE.Texture | null): void {
    const mat = id === 'sun' ? this.sunMaterial : (this.planets.get(id)?.material ?? this.moons.find((m) => m.moon.id === id)?.material)
    if (!mat || !tex) return
    const first = !mat.map
    mat.map = tex
    if (mat instanceof THREE.MeshStandardMaterial) {
      const bump = BUMP[id]
      if (bump !== undefined) {
        mat.bumpMap = tex
        mat.bumpScale = bump
      }
      mat.color.set(BORROWS_MOON_SURFACE.has(id) ? new THREE.Color(MOONS.find((m) => m.id === id)?.color ?? '#ffffff').multiplyScalar(1.7) : 0xffffff)
    } else mat.color.copy(SUN_TINT)
    if (first) mat.needsUpdate = true
  }

  setLayer(layer: Layer, tex: THREE.Texture): void {
    switch (layer) {
      case 'earthNight': {
        const earth = this.planets.get('earth')?.material
        if (!earth) return
        earth.emissiveMap = tex
        earth.emissive.setRGB(1, 0.8, 0.5)
        earth.emissiveIntensity = 1.5
        earth.needsUpdate = true
        return
      }
      case 'earthNormal': {
        const earth = this.planets.get('earth')?.material
        if (!earth) return
        earth.normalMap = tex
        earth.needsUpdate = true
        return
      }
      case 'earthSpec':
        this.earthSpecMap.value = tex
        return
      case 'earthClouds': {
        const mat = this.clouds?.material as THREE.MeshStandardMaterial | undefined
        if (!mat || !this.clouds) return
        mat.alphaMap = tex
        mat.needsUpdate = true
        this.clouds.visible = true
        return
      }
      case 'saturnRing':
        this.ringMap.value = tex
        if (this.ring) this.ring.visible = true
        return
      case 'sky':
        this.skyMaterial.map = tex
        this.skyMaterial.needsUpdate = true
        this.sky.visible = true
        return
    }
  }

  // ---- positions ----

  /** Absolute heliocentric position of any body, scene axes, AU. */
  private absolute(id: string): THREE.Vector3 {
    if (id === 'sun') return this.tmp.set(0, 0, 0)
    const moon = this.moons.find((m) => m.moon.id === id)
    if (moon) return moon.pos
    return this.planets.get(id)?.pos ?? this.minor.position(id) ?? this.tmp.set(0, 0, 0)
  }

  private posOf(id: string): THREE.Vector3 | undefined {
    return id === 'sun' ? new THREE.Vector3() : (this.planets.get(id)?.pos ?? this.moons.find((m) => m.moon.id === id)?.pos ?? this.minor.position(id))
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
    this.minor.setFocus(id)
    if (immediate) this.focusSnap = true
  }

  /** Smallest sensible camera distance for a body (AU). */
  minDistance(id: string): number {
    if (this.minor.has(id)) return 1e-5
    const body = id === 'sun' ? SUN : (bodyById(id) ?? MOONS.find((m) => m.id === id))
    return body ? radiusAu(body) * 1.18 : 1e-5
  }

  /** A comfortable first view of a body (AU). */
  viewDistance(id: string): number {
    if (id === 'sun') return 0.03
    const small = this.minor.info(id)
    if (small) return id === 'jwst' ? 0.006 : small.kind === 'probe' ? 0.06 : small.kind === 'comet' ? 0.15 : small.kind === 'interstellar' ? 0.3 : 0.05
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
    const marker = this.minor.pick(this.raycaster)
    if (marker && (!best || marker.distance < best.d)) best = { id: marker.id, d: marker.distance }
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
    if (!this.built) return
    this.computePositions(nowMs)
    this.minor.update(nowMs, this.focus, this.sunGroup.position)
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
    this.minor.update(nowMs, this.focus, this.sunGroup.position)
    const sunDist = camera.position.distanceTo(sunRel)
    const sunScale = Math.max(radiusAu(SUN), MIN_ANGULAR.star * sunDist * 0.55)
    this.sunMesh.scale.setScalar(sunScale)
    this.sunMesh.rotation.y = (nowMs / 3_600_000 / SUN.rotationHours) * Math.PI * 2
    this.sunGlow.scale.setScalar(sunScale * 5)
    this.sky.position.copy(camera.position)

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
      node.sunDir.copy(sunRel).sub(node.group.position).normalize()
      if (node.body.id === 'earth' && this.clouds) this.clouds.rotation.y = turns + (nowMs / 3_600_000) * 0.01
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
      m.sunDir.copy(this.sunGroup.position).sub(world).normalize()
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
    const cam = camera.position
    for (const { info, rel } of this.minor.relativePositions(this.focus)) {
      const near = info.id === this.focusId || rel.distanceTo(cam) < this.viewDistance(info.id) * 14
      push(info.id, info.name, info.kind, rel, near)
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
