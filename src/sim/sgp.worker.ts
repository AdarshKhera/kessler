/// <reference lib="webworker" />
import { eciToEcf, gstime, json2satrec, sgp4, type EciVec3, type Kilometer, type SatRec } from 'satellite.js'
import { EARTH_RADIUS_KM, eciToScene } from '../lib/frames'
import { closestApproach } from '../lib/closest'
import type { ConjunctionHit, WorkerRequest, WorkerResponse } from './protocol'

const MU = 398600.4418
const UNIX_EPOCH_JD = 2440587.5

let sats: (SatRec | null)[] = []
let bands: Float32Array = new Float32Array(0) // [perigeeRadiusKm, apogeeRadiusKm] per sat
let latestConj = -1

const post = (msg: WorkerResponse, transfer: Transferable[] = []) => postMessage(msg, transfer)

function stateAt(rec: SatRec, tMs: number): { p: EciVec3<Kilometer>; v: EciVec3<number> } | null {
  const jd = tMs / 86_400_000 + UNIX_EPOCH_JD
  const r = sgp4(rec, (jd - rec.jdsatepoch) * 1440)
  if (!r || typeof r.position === 'boolean') return null
  const p = r.position
  if (!Number.isFinite(p.x)) return null
  return { p, v: r.velocity }
}

function init(omms: Parameters<typeof json2satrec>[0][]): void {
  let failed = 0
  sats = omms.map((o) => {
    try {
      const rec = json2satrec(o)
      return rec.error === 0 ? rec : (failed++, null)
    } catch {
      failed++
      return null
    }
  })
  bands = new Float32Array(sats.length * 2)
  sats.forEach((rec, i) => {
    if (!rec) return
    const a = Math.cbrt(MU / ((rec.no / 60) * (rec.no / 60)))
    bands[i * 2] = a * (1 - rec.ecco)
    bands[i * 2 + 1] = a * (1 + rec.ecco)
  })
  post({ type: 'ready', count: sats.length, failed })
}

function tick(id: number, t: number): void {
  try {
    runTick(id, t)
  } catch {
    // always reply so the main thread never waits forever
    post({ type: 'tick', id, t, pos: new Float32Array(sats.length * 3).fill(NaN), vel: new Float32Array(sats.length * 3) })
  }
}

function runTick(id: number, t: number): void {
  const n = sats.length
  const pos = new Float32Array(n * 3)
  const vel = new Float32Array(n * 3)
  const v2 = new Float32Array(3)
  for (let i = 0; i < n; i++) {
    const rec = sats[i]
    const s = rec ? stateAt(rec, t) : null
    if (!s) {
      pos[i * 3] = NaN
      continue
    }
    eciToScene(s.p.x, s.p.y, s.p.z, pos, i * 3)
    eciToScene(s.v.x, s.v.y, s.v.z, v2, 0) // km/s -> scene units/s
    vel.set(v2, i * 3)
  }
  post({ type: 'tick', id, t, pos, vel }, [pos.buffer, vel.buffer])
}

function track(id: number, index: number, t: number): void {
  const rec = sats[index]
  const empty = new Float32Array(0)
  if (!rec) return post({ type: 'track', id, index, t, orbit: empty, ground: empty })
  const periodMs = ((2 * Math.PI) / rec.no) * 60_000
  const N = 180
  const orbit = new Float32Array(N * 3)
  for (let k = 0; k < N; k++) {
    const s = stateAt(rec, t + (k / N) * periodMs)
    if (s) eciToScene(s.p.x, s.p.y, s.p.z, orbit, k * 3)
  }
  const G = 240
  const ground = new Float32Array(G * 3)
  for (let k = 0; k < G; k++) {
    const tk = t + (-0.15 + (1.35 * k) / (G - 1)) * periodMs
    const s = stateAt(rec, tk)
    if (!s) continue
    const ecf = eciToEcf(s.p, gstime(new Date(tk)))
    const m = Math.hypot(ecf.x, ecf.y, ecf.z) || 1
    const k2 = EARTH_RADIUS_KM / m
    eciToScene(ecf.x * k2, ecf.y * k2, ecf.z * k2, ground, k * 3)
  }
  post({ type: 'track', id, index, t, orbit, ground }, [orbit.buffer, ground.buffer])
}

const COARSE_S = 30
const MISS_THRESHOLD_KM = 400
const BAND_MARGIN_KM = 60 // only objects in altitude bands within this margin are screened
const MIN_REL_KM_S = 0.2

/** Newton steps on the relative motion: time of closest approach is -(r.v)/(v.v). */
function refine(a: SatRec, b: SatRec, tMs: number): { tMs: number; missKm: number; relKmS: number } | null {
  let t = tMs
  for (let k = 0; k < 4; k++) {
    const sa = stateAt(a, t)
    const sb = stateAt(b, t)
    if (!sa || !sb) return null
    const rx = sb.p.x - sa.p.x
    const ry = sb.p.y - sa.p.y
    const rz = sb.p.z - sa.p.z
    const vx = sb.v.x - sa.v.x
    const vy = sb.v.y - sa.v.y
    const vz = sb.v.z - sa.v.z
    const vv = vx * vx + vy * vy + vz * vz
    const rel = Math.sqrt(vv)
    if (vv < 1e-12) return { tMs: t, missKm: Math.hypot(rx, ry, rz), relKmS: 0 }
    const dt = -(rx * vx + ry * vy + rz * vz) / vv
    if (Math.abs(dt) < 0.02 || k === 3) {
      const tt = t + dt * 1000
      const fa = stateAt(a, tt)
      const fb = stateAt(b, tt)
      if (!fa || !fb) return null
      return { tMs: tt, missKm: Math.hypot(fb.p.x - fa.p.x, fb.p.y - fa.p.y, fb.p.z - fa.p.z), relKmS: rel }
    }
    t += dt * 1000
  }
  return null
}

async function conjunctions(id: number, index: number, t: number, hours: number): Promise<void> {
  latestConj = id
  const sel = sats[index]
  if (!sel) return post({ type: 'conj', id, index, hits: [], scanned: 0 })
  const steps = Math.ceil((hours * 3600) / COARSE_S)
  const selPos = new Float64Array((steps + 1) * 3)
  for (let k = 0; k <= steps; k++) {
    const s = stateAt(sel, t + k * COARSE_S * 1000)
    selPos[k * 3] = s ? s.p.x : NaN
    selPos[k * 3 + 1] = s ? s.p.y : 0
    selPos[k * 3 + 2] = s ? s.p.z : 0
  }
  const lo = bands[index * 2] - BAND_MARGIN_KM
  const hi = bands[index * 2 + 1] + BAND_MARGIN_KM
  const hits: ConjunctionHit[] = []
  let scanned = 0
  for (let j = 0; j < sats.length; j++) {
    if (latestConj !== id) return // superseded by a newer request
    if (j % 600 === 0) await new Promise((r) => setTimeout(r))
    const rec = sats[j]
    if (!rec || j === index || bands[j * 2 + 1] < lo || bands[j * 2] > hi) continue
    scanned++
    const distAt = (tt: number): number => {
      const k = Math.round((tt - t) / 1000 / COARSE_S)
      const a = tt === t + k * COARSE_S * 1000 && selPos[k * 3] === selPos[k * 3] ? { x: selPos[k * 3], y: selPos[k * 3 + 1], z: selPos[k * 3 + 2] } : stateAt(sel, tt)?.p
      const b = stateAt(rec, tt)?.p
      if (!a || !b) return Infinity
      return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
    }
    // coarse scan only (fine step bigger than the window), then solve the closest point analytically
    const coarse = closestApproach(distAt, t, t + hours * 3_600_000, COARSE_S * 1000, COARSE_S * 2000, MISS_THRESHOLD_KM)
    if (!coarse) continue
    const hit = refine(sel, rec, coarse.t)
    if (!hit || hit.relKmS < MIN_REL_KM_S) continue // null or co-orbiting pair, not a crossing
    hits.push({ index: j, tcaMs: hit.tMs, missKm: hit.missKm, relKmS: hit.relKmS })
  }
  hits.sort((a, b) => a.missKm - b.missKm)
  post({ type: 'conj', id, index, hits: hits.slice(0, 12), scanned })
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const m = e.data
  if (m.type === 'init') init(m.omms)
  else if (m.type === 'tick') tick(m.id, m.t)
  else if (m.type === 'track') track(m.id, m.index, m.t)
  else void conjunctions(m.id, m.index, m.t, m.hours)
}
