/**
 * Approximate planet positions from the JPL "Keplerian elements for approximate positions of the
 * major planets" (E.M. Standish), valid 1800-2050 AD. Good to roughly an arcminute to a few arcminutes,
 * which is far below what is visible at solar-system scale. Ecliptic J2000 frame, AU.
 */
export type PlanetId = 'mercury' | 'venus' | 'earth' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'pluto'

export const PLANET_IDS: readonly PlanetId[] = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto']

export const AU_KM = 149_597_870.7
export const KM_PER_LIGHT_MINUTE = 17_987_547.48

/** [value at J2000, change per Julian century] for a, e, I, L, long.peri, long.node. Angles in degrees. */
type Elements = readonly [readonly [number, number], readonly [number, number], readonly [number, number], readonly [number, number], readonly [number, number], readonly [number, number]]

const ELEMENTS: Readonly<Record<PlanetId, Elements>> = {
  mercury: [[0.38709927, 0.00000037], [0.20563593, 0.00001906], [7.00497902, -0.00594749], [252.2503235, 149472.67411175], [77.45779628, 0.16047689], [48.33076593, -0.12534081]],
  venus: [[0.72333566, 0.0000039], [0.00677672, -0.00004107], [3.39467605, -0.0007889], [181.9790995, 58517.81538729], [131.60246718, 0.00268329], [76.67984255, -0.27769418]],
  earth: [[1.00000261, 0.00000562], [0.01671123, -0.00004392], [-0.00001531, -0.01294668], [100.46457166, 35999.37244981], [102.93768193, 0.32327364], [0, 0]],
  mars: [[1.52371034, 0.00001847], [0.0933941, 0.00007882], [1.84969142, -0.00813131], [-4.55343205, 19140.30268499], [-23.94362959, 0.44441088], [49.55953891, -0.29257343]],
  jupiter: [[5.202887, -0.00011607], [0.04838624, -0.00013253], [1.30439695, -0.00183714], [34.39644051, 3034.74612775], [14.72847983, 0.21252668], [100.47390909, 0.20469106]],
  saturn: [[9.53667594, -0.0012506], [0.05386179, -0.00050991], [2.48599187, 0.00193609], [49.95424423, 1222.49362201], [92.59887831, -0.41897216], [113.66242448, -0.28867794]],
  uranus: [[19.18916464, -0.00196176], [0.04725744, -0.00004397], [0.77263783, -0.00242939], [313.23810451, 428.48202785], [170.9542763, 0.40805281], [74.01692503, 0.04240589]],
  neptune: [[30.06992276, 0.00026291], [0.00859048, 0.00005105], [1.77004347, 0.00035372], [-55.12002969, 218.45945325], [44.96476227, -0.32241464], [131.78422574, -0.00508664]],
  pluto: [[39.48211675, -0.00031596], [0.2488273, 0.0000517], [17.14001206, 0.00004818], [238.92903833, 145.20780515], [224.06891629, -0.04062942], [110.30393684, -0.01183482]],
}

export interface Vec3 {
  readonly x: number
  readonly y: number
  readonly z: number
}

const RAD = Math.PI / 180

export const julianDate = (ms: number): number => ms / 86_400_000 + 2_440_587.5
const centuries = (ms: number): number => (julianDate(ms) - 2_451_545.0) / 36_525

/** Solve Kepler's equation M = E - e sin E. */
function solveKepler(M: number, e: number): number {
  let E = M + e * Math.sin(M)
  for (let i = 0; i < 12; i++) {
    const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E))
    E -= d
    if (Math.abs(d) < 1e-12) break
  }
  return E
}

function rotate(xp: number, yp: number, w: number, node: number, inc: number): Vec3 {
  const cw = Math.cos(w)
  const sw = Math.sin(w)
  const cn = Math.cos(node)
  const sn = Math.sin(node)
  const ci = Math.cos(inc)
  const si = Math.sin(inc)
  return {
    x: (cw * cn - sw * sn * ci) * xp + (-sw * cn - cw * sn * ci) * yp,
    y: (cw * sn + sw * cn * ci) * xp + (-sw * sn + cw * cn * ci) * yp,
    z: sw * si * xp + cw * si * yp,
  }
}

const at = (pair: readonly [number, number], T: number): number => pair[0] + pair[1] * T

/** Heliocentric ecliptic position in AU. */
export function heliocentric(id: PlanetId, ms: number): Vec3 {
  const T = centuries(ms)
  const el = ELEMENTS[id]
  const a = at(el[0], T)
  const e = at(el[1], T)
  const inc = at(el[2], T) * RAD
  const L = at(el[3], T)
  const peri = at(el[4], T)
  const node = at(el[5], T) * RAD
  let M = (((L - peri) % 360) + 540) % 360 - 180
  M *= RAD
  const E = solveKepler(M, e)
  const xp = a * (Math.cos(E) - e)
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E)
  return rotate(xp, yp, (peri - at(el[5], T)) * RAD, node, inc)
}

/** One full orbit as xyz triples (AU), using the J2000 elements. For drawing the path. */
export function orbitPath(id: PlanetId, points = 256): Float64Array {
  const el = ELEMENTS[id]
  const a = el[0][0]
  const e = el[1][0]
  const inc = el[2][0] * RAD
  const w = (el[4][0] - el[5][0]) * RAD
  const node = el[5][0] * RAD
  const out = new Float64Array(points * 3)
  for (let i = 0; i < points; i++) {
    const E = (i / points) * Math.PI * 2
    const v = rotate(a * (Math.cos(E) - e), a * Math.sqrt(1 - e * e) * Math.sin(E), w, node, inc)
    out[i * 3] = v.x
    out[i * 3 + 1] = v.y
    out[i * 3 + 2] = v.z
  }
  return out
}

/** Moon relative to Earth, ecliptic AU. Low-precision series (a few tenths of a degree), plenty for a visual. */
export function moonGeocentric(ms: number): Vec3 {
  const d = julianDate(ms) - 2_451_545.0
  const L = (218.316 + 13.176396 * d) * RAD
  const M = (134.963 + 13.064993 * d) * RAD
  const F = (93.272 + 13.22935 * d) * RAD
  const lon = L + 6.289 * RAD * Math.sin(M)
  const lat = 5.128 * RAD * Math.sin(F)
  const r = (385_001 - 20_905 * Math.cos(M)) / AU_KM
  return { x: r * Math.cos(lat) * Math.cos(lon), y: r * Math.cos(lat) * Math.sin(lon), z: r * Math.sin(lat) }
}

export const lightMinutes = (au: number): number => (au * AU_KM) / KM_PER_LIGHT_MINUTE

const OBLIQUITY_RAD = (23.4392911 * Math.PI) / 180

/** Direction of a body's north pole in the ecliptic frame, from its equatorial right ascension and declination (degrees). */
export function poleEcliptic(raDeg: number, decDeg: number): Vec3 {
  const a = raDeg * RAD
  const d = decDeg * RAD
  const x = Math.cos(d) * Math.cos(a)
  const y = Math.cos(d) * Math.sin(a)
  const z = Math.sin(d)
  return { x, y: y * Math.cos(OBLIQUITY_RAD) + z * Math.sin(OBLIQUITY_RAD), z: -y * Math.sin(OBLIQUITY_RAD) + z * Math.cos(OBLIQUITY_RAD) }
}
