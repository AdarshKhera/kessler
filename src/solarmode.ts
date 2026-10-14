import { gstime } from 'satellite.js'
import * as THREE from 'three'
import { BODIES, MOONS, bodyById, moonsOf, type Body } from './data/bodies'
import { lightMinutes } from './lib/ephemeris'
import { toHash } from './lib/urlstate'
import { SAT_UNIT_AU, SolarSystem } from './scene/solar'
import type { Stage } from './scene/stage'
import { createStars } from './scene/stars'
import type { Swarm } from './scene/swarm'
import type { Engine } from './sim/engine'
import type { Card } from './ui/card'
import type { Chrome } from './ui/chrome'
import { BodiesNav } from './ui/bodies'
import { fmt } from './ui/dom'
import type { FocusBar } from './ui/focusbar'
import { Labels } from './ui/labels'
import type { ModeSwitch } from './ui/modes'
import { toast } from './ui/toast'

const $ = (id: string) => document.getElementById(id)!
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const OVERVIEW_AU = 120

export interface SolarDeps {
  readonly stage: Stage
  readonly swarm: Swarm
  readonly engine: Engine
  readonly card: Card
  readonly chrome: Chrome
  readonly focusBar: FocusBar
  readonly modeSwitch: ModeSwitch
  /** clear any satellite, fleet or country selection in the Earth view */
  readonly clearEarthView: () => void
  /** restore title, hash and focus bar for the Earth view */
  readonly restoreEarthView: () => void
}

function writeHash(hash: string): void {
  history.replaceState(null, '', `${location.pathname}${location.search}${hash}`)
}

/** Orchestrates the solar-system view: transitions, focus, labels, and the satellite cloud around Earth. */
export function createSolarMode(d: SolarDeps) {
  const solar = new SolarSystem()
  d.stage.solar.scene.add(createStars(2600, 2400), solar.root)
  d.stage.solar.controls.addEventListener('start', () => solar.cancelZoom())
  const veil = $('veil')
  let active = false
  let busy = false
  let satsOn = false
  let lastSlow = 0
  let wheelAcc = 0

  const labels = new Labels($('labels'), (id) => focusBody(id))
  const nav = new BodiesNav($('bodies'), (id) => focusBody(id), (k) => preset(k), () => void leave())
  const scaleEl = $('scale')
  let atOverview = false

  const asBody = (id: string): Body | undefined => {
    const b = bodyById(id)
    if (b) return b
    const m = MOONS.find((x) => x.id === id)
    return m
      ? { id: m.id, name: m.name, kind: 'moon', radiusKm: m.radiusKm, color: m.color, tilt: 0, pole: { ra: 270, dec: 66.56 }, rotationHours: m.periodDays * 24, periodDays: m.periodDays, blurb: m.blurb, facts: [`Circles ${bodyById(m.parent)?.name} every ${m.periodDays < 10 ? m.periodDays.toFixed(2) : m.periodDays.toFixed(1)} days at ${fmt(m.orbitKm)} km.`] }
      : undefined
  }

  function focusBody(id: string, cinematic = false): void {
    const body = asBody(id)
    if (!body || !solar.isBuilt) return
    const cam = d.stage.solar.camera
    solar.setFocus(id, cinematic)
    d.stage.solar.controls.minDistance = solar.minDistance(id)
    atOverview = false
    const sunSide = id === 'sun' ? undefined : solar.sunSideDirection(id)
    if (cinematic) {
      // begin hugging Earth, seen from its sunlit side, then pull back to reveal the system
      if (sunSide) cam.position.copy(sunSide)
      cam.position.setLength(solar.minDistance('earth') * 4)
      solar.startZoom(cam, 3.2, 5, cam.position.length())
    } else solar.startZoom(cam, solar.viewDistance(id), 2.4, cam.position.length(), sunSide)
    nav.setFocus(id)
    d.card.showBody(body, { sunAu: solar.distanceFromSunAu(id), earthAu: solar.distanceFromEarthAu(id), moons: moonsOf(id) })
    d.focusBar.set({ kind: 'body', label: `Viewing ${body.name}`, detail: { star: 'Star', planet: 'Planet', dwarf: 'Dwarf planet', moon: 'Moon' }[body.kind], hint: 'Drag to orbit · scroll to zoom · ← → next world · Clear for the whole system' })
    writeHash(toHash({ body: id }))
    document.title = `${body.name} | Kessler`
  }

  const todayHint = (): string => `Planets shown where they are on ${new Date(d.engine.clock.now()).toISOString().slice(0, 16).replace('T', ' ')} UTC. Use the speed buttons to watch them move.`

  function overview(distanceAu = OVERVIEW_AU): void {
    if (!active) return
    solar.setFocus('sun')
    atOverview = true
    d.stage.solar.controls.minDistance = solar.minDistance('sun')
    const cam = d.stage.solar.camera
    // look from above the ecliptic so the orbits open up like a map
    solar.startZoom(cam, distanceAu, 3, cam.position.length(), new THREE.Vector3(0.18, 0.78, 0.6))
    nav.setFocus('')
    d.card.hide()
    d.focusBar.set({ kind: 'solar-idle', label: '', hint: todayHint() })
    writeHash(toHash({ solar: true }))
    document.title = 'Solar System | Kessler'
  }

  async function enter(bodyId?: string): Promise<void> {
    if (active || busy) return
    busy = true
    veil.classList.add('on')
    await sleep(460)
    d.clearEarthView()
    solar.build()
    solar.prime(d.engine.clock.now())
    active = true
    d.stage.setMode('solar')
    d.engine.setSuspended(true)
    d.stage.scene.remove(d.swarm.points)
    solar.earthFrame.add(d.swarm.points)
    d.swarm.points.scale.setScalar(SAT_UNIT_AU)
    d.swarm.setUnit(SAT_UNIT_AU)
    d.swarm.points.visible = false
    satsOn = false
    d.modeSwitch.set('solar')
    $('fleets').hidden = true
    $('bodies').hidden = false
    d.chrome.setTimeMode('solar')
    d.engine.setWarp(1)
    if (bodyId && asBody(bodyId)) {
      solar.setFocus(bodyId, true)
      focusBody(bodyId)
    } else {
      focusBody('earth', true)
      toast('Zooming out from Earth. Pick any world on the left.', 4200)
    }
    await sleep(120)
    veil.classList.remove('on')
    busy = false
  }

  async function leave(): Promise<void> {
    if (!active || busy) return
    busy = true
    veil.classList.add('on')
    await sleep(460)
    active = false
    d.stage.setMode('earth')
    solar.earthFrame.remove(d.swarm.points)
    d.stage.scene.add(d.swarm.points)
    d.swarm.points.scale.setScalar(1)
    d.swarm.setUnit(1)
    d.swarm.points.visible = true
    d.engine.setSuspended(false)
    if (d.engine.clock.warp > 300) d.engine.setWarp(1)
    d.chrome.setTimeMode('earth')
    d.modeSwitch.set('earth')
    labels.clear()
    scaleEl.hidden = true
    d.card.hide()
    $('fleets').hidden = false
    $('bodies').hidden = true
    d.restoreEarthView()
    await sleep(120)
    veil.classList.remove('on')
    busy = false
  }

  /** Called every frame while the solar view is showing. */
  d.stage.onSolarFrame = (dt) => {
    if (!active) return
    const now = d.engine.clock.now()
    const cam = d.stage.solar.camera
    solar.earthSpin = gstime(new Date(now))
    solar.update(now, cam, dt)
    const { width, height } = d.stage.size()
    labels.update(solar.labels(cam, width, height), solar.focusId)

    // the satellite cloud only makes sense close to Earth and in real time
    const wantSats = solar.focusId === 'earth' && solar.distanceToEarth(cam) < 0.0014 && d.engine.clock.warp === 1 && !d.engine.clock.paused
    if (wantSats !== satsOn) {
      satsOn = wantSats
      d.swarm.points.visible = wantSats
      d.engine.setSuspended(!wantSats)
    }

    scaleEl.hidden = false
    const spanAu = solar.viewWidthAu(cam)
    const km = spanAu * 149_597_870.7
    const lm = lightMinutes(spanAu)
    scaleEl.textContent = `Screen spans ${spanAu >= 1 ? `${spanAu.toFixed(spanAu < 10 ? 2 : 0)} AU` : km > 1e6 ? `${(km / 1e6).toFixed(1)} million km` : `${Math.round(km).toLocaleString('en-US')} km`} · light crosses it in ${lm >= 1 ? `${lm.toFixed(lm < 10 ? 1 : 0)} min` : `${(lm * 60).toFixed(1)} s`}`

    if (performance.now() - lastSlow > 1000) {
      lastSlow = performance.now()
      nav.setDistances((id) => solar.distanceFromSunAu(id))
      if (atOverview) d.focusBar.set({ kind: 'solar-idle', label: '', hint: todayHint() })
      if (solar.focusId !== 'sun') d.card.setBodyDistances(solar.distanceFromSunAu(solar.focusId), solar.distanceFromEarthAu(solar.focusId))
    }
  }

  // zooming all the way into Earth hands control back to the satellite view
  d.stage.canvas.addEventListener('wheel', (e: WheelEvent) => {
    if (!active || busy || solar.focusId !== 'earth' || e.deltaY >= 0) {
      wheelAcc = 0
      return
    }
    if (d.stage.solar.camera.position.length() <= solar.minDistance('earth') * 1.1) {
      wheelAcc += -e.deltaY
      if (wheelAcc > 240) void leave()
    }
  }, { passive: true })

  function preset(kind: 'inner' | 'outer' | 'whole'): void {
    overview(kind === 'inner' ? 4.5 : kind === 'outer' ? 90 : OVERVIEW_AU)
  }

  /** Visit the next or previous body in Sun-to-Pluto order (moons count as their planet). */
  function step(delta: number): void {
    if (!active) return
    const parent = MOONS.find((m) => m.id === solar.focusId)?.parent ?? solar.focusId
    const i = atOverview ? -1 : BODIES.findIndex((b) => b.id === parent)
    const next = BODIES[(((i < 0 ? (delta > 0 ? -1 : 0) : i) + delta) % BODIES.length + BODIES.length) % BODIES.length]
    focusBody(next.id)
  }

  /** Click or tap in space: fly to whatever world is under the pointer. */
  function pickAt(px: number, py: number): boolean {
    if (!active || busy) return false
    const { width, height } = d.stage.size()
    const id = solar.pickBody((px / width) * 2 - 1, -((py / height) * 2 - 1), d.stage.solar.camera)
    if (!id || id === solar.focusId) return false
    focusBody(id)
    return true
  }

  return {
    get active() {
      return active
    },
    get camera(): THREE.PerspectiveCamera {
      return d.stage.solar.camera
    },
    solar,
    enter,
    leave,
    overview: () => overview(),
    preset,
    step,
    pickAt,
    get focusId(): string {
      return solar.focusId
    },
    focusBody: (id: string) => focusBody(id),
    /** Earth-view wheel handler: lets the user zoom out of Earth's neighbourhood into the solar system. */
    wheelOutOfEarth(e: WheelEvent): void {
      if (active || busy) return
      const cam = d.stage.camera
      if (e.deltaY > 0 && cam.position.length() >= d.stage.controls.maxDistance * 0.97) {
        wheelAcc += e.deltaY
        if (wheelAcc > 260) {
          wheelAcc = 0
          void enter()
        } else if (wheelAcc > 60) toast('Keep zooming out to leave Earth for the solar system.', 2400)
      } else wheelAcc = 0
    },
  }
}
