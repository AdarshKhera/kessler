// Deep-space data from NASA/JPL: node scripts/snapshot-space.mjs
// Writes public/space/probes.json (JPL Horizons trajectories) and small-bodies.json (JPL Small-Body Database).
// JPL's APIs send no CORS headers, so the app cannot call them from the browser: this runs here and ships the result as
// static files. It drives a real Chrome page (via Playwright) because that is the one thing that always trusts JPL's certificate.
// Polite by design: one request at a time, short pauses, no retries inside a run.
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const HORIZONS = 'https://ssd.jpl.nasa.gov/api/horizons.api'
const SBDB = 'https://ssd-api.jpl.nasa.gov/sbdb.api'
const SBDB_QUERY = 'https://ssd-api.jpl.nasa.gov/sbdb_query.api'
const K = 0.01720209895 // Gaussian gravitational constant, AU^1.5 / day
const START = '2026-01-01'
const STOP = '2028-12-31'
const OUT = 'public/space'

/** id is ours (see src/data/probes.ts); hid is the Horizons target; step in days (or hours for Parker). */
const PROBES = [
  { id: 'voyager-1', hid: '-31', step: '4d' },
  { id: 'voyager-2', hid: '-32', step: '4d' },
  { id: 'pioneer-10', hid: '-23', step: '4d' },
  { id: 'pioneer-11', hid: '-24', step: '4d' },
  { id: 'new-horizons', hid: '-98', step: '4d' },
  { id: 'parker', hid: '-96', step: '6h' },
  { id: 'lucy', hid: '-49', step: '2d' },
  { id: 'psyche', hid: '-255', step: '2d' },
  { id: 'osiris-apex', hid: '-64', step: '2d' },
  { id: 'europa-clipper', hid: '-159', step: '2d' },
  { id: 'jwst', hid: '-170', step: '1d' },
  { id: 'stereo-a', hid: '-234', step: '2d' },
  { id: 'solar-orbiter', hid: '-144', step: '1d' },
  { id: 'bepicolombo', hid: '-121', step: '2d' },
  { id: 'juice', hid: '-28', step: '2d' },
  { id: 'hera', hid: '-91', step: '2d' },
  { id: 'hayabusa2', hid: '-37', step: '2d' },
]

/** Named comets, asteroids and dwarf planets that get their own card. sstr is what SBDB looks up. */
const NOTABLES = [
  ['1P', 'comet'], ['2P', 'comet'], ['9P', 'comet'], ['12P', 'comet'], ['67P', 'comet'], ['81P', 'comet'], ['103P', 'comet'], ['109P', 'comet'],
  ['C/1995 O1', 'comet'], ['C/2020 F3', 'comet'], ['C/2023 A3', 'comet'], ['C/2024 G3', 'comet'],
  ['1I', 'interstellar'], ['2I', 'interstellar'], ['3I', 'interstellar'],
  ['1 Ceres', 'asteroid'], ['4 Vesta', 'asteroid'], ['2 Pallas', 'asteroid'], ['10 Hygiea', 'asteroid'], ['16 Psyche', 'asteroid'],
  ['433 Eros', 'asteroid'], ['101955 Bennu', 'asteroid'], ['162173 Ryugu', 'asteroid'], ['25143 Itokawa', 'asteroid'], ['65803 Didymos', 'asteroid'],
  ['99942 Apophis', 'asteroid'], ['152830 Dinkinesh', 'asteroid'], ['52246 Donaldjohanson', 'asteroid'], ['3548 Eurybates', 'asteroid'],
  ['617 Patroclus', 'asteroid'], ['469219 Kamo`oalewa', 'asteroid'], ['2024 YR4', 'asteroid'],
  ['486958 Arrokoth', 'asteroid'], ['136199 Eris', 'dwarf'], ['136108 Haumea', 'dwarf'], ['136472 Makemake', 'dwarf'], ['90377 Sedna', 'asteroid'],
]

const page = await (await chromium.launch({ channel: 'chrome' })).newPage()
const pause = (ms) => new Promise((r) => setTimeout(r, ms))
async function get(url) {
  await page.goto(url)
  await pause(450)
  return page.textContent('body')
}
const q = (obj) => Object.entries(obj).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')

const MONTHS = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06', JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' }

async function trajectory({ id, hid, step }, stop = STOP) {
  const url = `${HORIZONS}?${q({ format: 'text', COMMAND: `'${hid}'`, OBJ_DATA: "'NO'", MAKE_EPHEM: "'YES'", EPHEM_TYPE: "'VECTORS'", CENTER: "'500@10'", REF_PLANE: "'ECLIPTIC'", OUT_UNITS: "'AU-D'", VEC_TABLE: "'1'", CSV_FORMAT: "'YES'", START_TIME: `'${START}'`, STOP_TIME: `'${stop}'`, STEP_SIZE: `'${step}'` })}`
  const text = await get(url)
  const body = /\$\$SOE\s*\n([\s\S]*?)\$\$EOE/.exec(text)?.[1]
  if (!body) {
    // a spacecraft's trajectory ends where its published ephemeris ends: retry up to that day
    const end = /after A\.D\. (\d{4})-([A-Z]{3})-(\d{2})/.exec(text)
    if (end && stop === STOP) return trajectory({ id, hid, step }, `${end[1]}-${MONTHS[end[2]]}-${String(Math.max(1, Number(end[3]) - 1)).padStart(2, '0')}`)
    throw new Error(`${id}: ${text.replace(/\s+/g, ' ').slice(0, 200)}`)
  }
  const rows = body.trim().split('\n').map((l) => l.split(',').map((x) => x.trim()))
  const startJd = Number(rows[0][0])
  const stepDays = rows.length > 1 ? Number(rows[1][0]) - startJd : 1
  // positions in micro-AU as integers: about 150 m, and far smaller on disk than floats
  const pos = rows.flatMap((r) => [Number(r[2]), Number(r[3]), Number(r[4])].map((v) => Math.round(v * 1e6)))
  const nameLine = /Target body name: ([^{]+)/.exec(text)?.[1]?.trim()
  process.stdout.write(`${id.padEnd(16)} ${String(rows.length).padStart(5)} rows  ${nameLine}\n`)
  return { id, hid, startJd, stepDays, pos }
}

const round = (v, d) => (v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(Number(v).toFixed(d)))

/** Elements in the form the app uses: perihelion distance, eccentricity, angles in degrees, time of perihelion (JD). */
function toTp({ e, q: peri, ma, epoch, tp }) {
  if (tp !== undefined && tp !== null && tp !== '') return Number(tp)
  const a = peri / (1 - e)
  const n = (K / Math.sqrt(Math.abs(a) ** 3)) * (180 / Math.PI) // deg/day
  return Number(epoch) - Number(ma) / n
}

async function notable([sstr, kind]) {
  const text = await get(`${SBDB}?${q({ sstr, 'phys-par': '1', discovery: '1', 'full-prec': '1' })}`)
  const d = JSON.parse(text)
  if (!d.orbit) throw new Error(`${sstr}: ${text.slice(0, 120)}`)
  const el = Object.fromEntries(d.orbit.elements.map((x) => [x.name, x.value]))
  const phys = Object.fromEntries((d.phys_par ?? []).map((x) => [x.name, x.value]))
  const tp = toTp({ e: Number(el.e), q: Number(el.q), ma: el.ma, epoch: d.orbit.epoch, tp: el.tp })
  process.stdout.write(`${sstr.padEnd(22)} ${d.object.fullname}\n`)
  return {
    id: d.object.des,
    name: d.object.shortname ?? d.object.fullname,
    full: d.object.fullname,
    kind,
    cls: d.object.orbit_class?.name ?? null,
    el: { q: round(el.q, 6), e: round(el.e, 6), i: round(el.i, 4), om: round(el.om, 4), w: round(el.w, 4), tp: round(tp, 3) },
    per: el.per ? round(el.per, 3) : null,
    H: phys.H ? round(phys.H, 2) : null,
    diameterKm: phys.diameter ? round(phys.diameter, 3) : null,
    rotationH: phys.rot_per ? round(phys.rot_per, 3) : null,
    albedo: phys.albedo ? round(phys.albedo, 3) : null,
    spectral: phys.spec_T ?? phys.spec_B ?? null,
    discovery: d.discovery ? { date: d.discovery.date ?? null, by: d.discovery.name ?? null, site: d.discovery.location ?? null } : null,
  }
}

async function crowd(label, params, limit) {
  const text = await get(`${SBDB_QUERY}?${q({ fields: 'e,q,i,om,w,ma,epoch,tp', ...params, sort: 'H', limit, 'full-prec': '1' })}`)
  const d = JSON.parse(text)
  if (!d.data) throw new Error(`${label}: ${text.slice(0, 200)}`)
  const f = d.fields
  const idx = Object.fromEntries(f.map((name, i) => [name, i]))
  const rows = d.data
    .map((r) => ({ e: Number(r[idx.e]), q: Number(r[idx.q]), i: Number(r[idx.i]), om: Number(r[idx.om]), w: Number(r[idx.w]), ma: r[idx.ma], epoch: r[idx.epoch], tp: r[idx.tp] }))
    .filter((r) => [r.e, r.q, r.i, r.om, r.w].every(Number.isFinite) && r.e < 1 && r.q > 0)
    .map((r) => [round(r.q, 4), Math.min(round(r.e, 6), 0.999999), round(r.i, 2), round(r.om, 2), round(r.w, 2), round(toTp(r), 1)])
  process.stdout.write(`${label.padEnd(12)} ${rows.length} of ${d.count ?? '?'}\n`)
  return rows
}

await mkdir(OUT, { recursive: true })
const generated = new Date().toISOString()

const probes = []
for (const p of process.env.ONLY_SMALL ? [] : PROBES) {
  try {
    probes.push(await trajectory(p))
  } catch (e) {
    process.stdout.write(`SKIP ${e.message}\n`)
  }
  await pause(300)
}
if (!process.env.ONLY_SMALL) await writeFile(`${OUT}/probes.json`, JSON.stringify({ generated, source: 'NASA/JPL Horizons', from: START, to: STOP, probes }))

const notables = []
for (const n of NOTABLES) {
  try {
    notables.push(await notable(n))
  } catch (e) {
    process.stdout.write(`SKIP ${e.message}\n`)
  }
  await pause(300)
}
const comets = await crowd('comets', { 'sb-kind': 'c', 'sb-cdata': JSON.stringify({ AND: ['e|LT|1', 'q|LT|8'] }) }, 4000)
const main = await crowd('main belt', { 'sb-kind': 'a', 'sb-class': 'MBA', 'sb-ns': 'n' }, 2200)
const neo = await crowd('near-Earth', { 'sb-kind': 'a', 'sb-group': 'pha' }, 1500)
const trojans = await crowd('trojans', { 'sb-kind': 'a', 'sb-class': 'TJN' }, 600)
const tno = await crowd('Kuiper belt', { 'sb-kind': 'a', 'sb-class': 'TNO' }, 500)
await writeFile(`${OUT}/small-bodies.json`, JSON.stringify({ generated, source: 'NASA/JPL Small-Body Database', notables, populations: { comets, main, neo, trojans, tno } }))
process.stdout.write('done\n')
await page.context().browser().close()
