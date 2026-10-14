import * as THREE from 'three'
import { EARTH_RADIUS } from '../lib/frames'

const FOOTPRINT_POINTS = 96
const MAX_LINKS = 8

function lineMat(color: THREE.ColorRepresentation, opacity: number): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending })
}

/** Everything drawn for the selected satellite: orbit, ground track, nadir, footprint, neighbour links. */
export class FocusVisuals {
  readonly root = new THREE.Group()
  private readonly orbit = new THREE.LineLoop(new THREE.BufferGeometry(), lineMat('#ffffff', 0.9))
  private readonly ground = new THREE.Line(new THREE.BufferGeometry(), lineMat('#ffffff', 0.75))
  private readonly nadir = new THREE.Line(new THREE.BufferGeometry(), lineMat('#ffffff', 0.5))
  private readonly footprint = new THREE.LineLoop(new THREE.BufferGeometry(), lineMat('#ffffff', 0.55))
  private readonly links = new THREE.LineSegments(new THREE.BufferGeometry(), lineMat('#8be9ff', 0.55))
  private readonly partner = new THREE.LineSegments(new THREE.BufferGeometry(), lineMat('#ff3b5c', 0.95))
  private readonly nadirPos = new Float32Array(6)
  private readonly footPos = new Float32Array(FOOTPRINT_POINTS * 3)
  private readonly linkPos = new Float32Array(MAX_LINKS * 6)
  private readonly partnerPos = new Float32Array(6)
  private readonly u = new THREE.Vector3()
  private readonly e1 = new THREE.Vector3()
  private readonly e2 = new THREE.Vector3()

  constructor(private readonly earth: THREE.Group) {
    this.nadir.geometry.setAttribute('position', new THREE.BufferAttribute(this.nadirPos, 3))
    this.footprint.geometry.setAttribute('position', new THREE.BufferAttribute(this.footPos, 3))
    this.links.geometry.setAttribute('position', new THREE.BufferAttribute(this.linkPos, 3))
    this.partner.geometry.setAttribute('position', new THREE.BufferAttribute(this.partnerPos, 3))
    for (const o of [this.orbit, this.ground, this.nadir, this.footprint, this.links, this.partner]) {
      o.frustumCulled = false
      o.visible = false
    }
    this.root.add(this.orbit, this.nadir, this.footprint, this.links, this.partner)
    this.earth.add(this.ground)
  }

  private static setPath(line: THREE.Line, data: Float32Array): void {
    line.geometry.setAttribute('position', new THREE.BufferAttribute(data, 3))
    line.geometry.computeBoundingSphere()
  }

  setColor(color: THREE.ColorRepresentation): void {
    for (const o of [this.orbit, this.ground, this.nadir, this.footprint]) (o.material as THREE.LineBasicMaterial).color.set(color)
  }

  setTrack(orbit: Float32Array, ground: Float32Array): void {
    FocusVisuals.setPath(this.orbit, orbit)
    FocusVisuals.setPath(this.ground, ground)
    this.orbit.visible = true
    this.ground.visible = true
  }

  clear(): void {
    for (const o of [this.orbit, this.ground, this.nadir, this.footprint, this.links, this.partner]) o.visible = false
  }

  /** `pos` is the live positions array; `neighbors` and `partner` are satellite indices. */
  update(pos: Float32Array, selected: number, neighbors: readonly number[], partner: number): void {
    if (selected < 0) return
    const x = pos[selected * 3]
    if (x !== x) return
    const p = this.u.set(x, pos[selected * 3 + 1], pos[selected * 3 + 2])
    const dist = p.length()
    const ux = p.x / dist
    const uy = p.y / dist
    const uz = p.z / dist

    this.nadirPos.set([x, p.y, p.z, ux * EARTH_RADIUS, uy * EARTH_RADIUS, uz * EARTH_RADIUS])
    ;(this.nadir.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
    this.nadir.visible = true

    // footprint: horizon circle on the surface under the satellite
    const lambda = Math.acos(Math.min(1, EARTH_RADIUS / dist))
    this.e1.set(-uz, 0, ux)
    if (this.e1.lengthSq() < 1e-6) this.e1.set(1, 0, 0)
    this.e1.normalize()
    this.e2.set(uy * this.e1.z - uz * this.e1.y, uz * this.e1.x - ux * this.e1.z, ux * this.e1.y - uy * this.e1.x)
    const cl = Math.cos(lambda)
    const sl = Math.sin(lambda)
    for (let i = 0; i < FOOTPRINT_POINTS; i++) {
      const a = (i / FOOTPRINT_POINTS) * Math.PI * 2
      const c = Math.cos(a)
      const s = Math.sin(a)
      this.footPos[i * 3] = EARTH_RADIUS * 1.003 * (cl * ux + sl * (c * this.e1.x + s * this.e2.x))
      this.footPos[i * 3 + 1] = EARTH_RADIUS * 1.003 * (cl * uy + sl * (c * this.e1.y + s * this.e2.y))
      this.footPos[i * 3 + 2] = EARTH_RADIUS * 1.003 * (cl * uz + sl * (c * this.e1.z + s * this.e2.z))
    }
    ;(this.footprint.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
    this.footprint.visible = true

    const n = Math.min(neighbors.length, MAX_LINKS)
    for (let k = 0; k < MAX_LINKS; k++) {
      const j = k < n ? neighbors[k] : selected
      this.linkPos.set([x, p.y, p.z, pos[j * 3], pos[j * 3 + 1], pos[j * 3 + 2]], k * 6)
    }
    ;(this.links.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
    this.links.visible = n > 0

    if (partner >= 0 && pos[partner * 3] === pos[partner * 3]) {
      this.partnerPos.set([x, p.y, p.z, pos[partner * 3], pos[partner * 3 + 1], pos[partner * 3 + 2]])
      ;(this.partner.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
      this.partner.visible = true
    } else {
      this.partner.visible = false
    }
  }
}
