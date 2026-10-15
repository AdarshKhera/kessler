/**
 * Where every surface image comes from, and what is drawn on top of it.
 * Files live in public/textures/planets and are credited in the Guide (Solar System Scope, CC BY 4.0, from NASA data;
 * Pluto and the small moons are NASA public-domain mosaics).
 */
export interface MapSet {
  /** loaded first, small enough to show quickly */
  readonly lo: string
  /** loaded when the body is focused */
  readonly hi?: string
}

export const SURFACE_MAPS: Readonly<Record<string, MapSet>> = {
  sun: { lo: 'sun-4k.jpg' },
  mercury: { lo: 'mercury-2k.jpg', hi: 'mercury-4k.jpg' },
  venus: { lo: 'venus-2k.jpg', hi: 'venus-4k.jpg' },
  earth: { lo: 'earth-day-4k.jpg', hi: 'earth-day-8k.jpg' },
  mars: { lo: 'mars-2k.jpg', hi: 'mars-4k.jpg' },
  jupiter: { lo: 'jupiter-2k.jpg', hi: 'jupiter-4k.jpg' },
  saturn: { lo: 'saturn-2k.jpg', hi: 'saturn-4k.jpg' },
  uranus: { lo: 'uranus-2k.jpg' },
  neptune: { lo: 'neptune-2k.jpg' },
  pluto: { lo: 'pluto-2k.jpg', hi: 'pluto-4k.jpg' },
  moon: { lo: 'moon-2k.jpg', hi: 'moon-4k.jpg' },
  io: { lo: 'io-2k.jpg' },
  enceladus: { lo: 'enceladus-2k.jpg' },
  mimas: { lo: 'mimas-2k.jpg' },
  tethys: { lo: 'tethys-2k.jpg' },
  dione: { lo: 'dione-2k.jpg' },
  rhea: { lo: 'rhea-2k.jpg' },
  iapetus: { lo: 'iapetus-2k.jpg' },
}

/** Moons with no usable public map borrow the Moon's cratered surface, tinted by their real colour. */
export const BORROWS_MOON_SURFACE: ReadonlySet<string> = new Set([
  'phobos', 'deimos', 'europa', 'ganymede', 'callisto', 'miranda', 'ariel', 'umbriel', 'titania', 'oberon', 'triton', 'charon',
])

/** Bodies that get a relief (bump) pass from their own colour map. Value is the bump scale. */
export const BUMP: Readonly<Record<string, number>> = {
  mercury: 1.6, moon: 1.6, mars: 1.1, phobos: 1.6, deimos: 1.6, europa: 0.5, ganymede: 1.2, callisto: 1.6,
  miranda: 1.2, ariel: 1.2, umbriel: 1.4, titania: 1.2, oberon: 1.4, triton: 0.8, charon: 1.2, io: 0.6,
  enceladus: 0.5, mimas: 1.4, tethys: 1.2, dione: 1.2, rhea: 1.4, iapetus: 1.2,
}

export const EARTH_LAYERS = {
  night: 'earth-night-4k.jpg',
  clouds: 'earth-clouds-4k.jpg',
  normal: 'earth-normal-2k.jpg',
  spec: 'earth-spec-2k.jpg',
} as const

export const RING_MAP = 'saturn-ring-4k.png'
export const SKY_MAP = 'milkyway-4k.jpg'

/** Saturn's ring texture spans 71,700 km to 140,670 km from the planet centre, in planet radii (58,232 km). */
export const RING_INNER = 71_700 / 58_232
export const RING_OUTER = 140_670 / 58_232

export interface Atmosphere {
  readonly color: string
  /** shell height above the surface, in body radii */
  readonly height: number
  /** brightness of the haze seen across the disc near the limb */
  readonly rim: number
  /** brightness of the glow outside the limb */
  readonly glow: number
}

export const ATMOSPHERES: Readonly<Record<string, Atmosphere>> = {
  venus: { color: '#f2d8a2', height: 0.032, rim: 0.7, glow: 0.8 },
  earth: { color: '#5d9dff', height: 0.028, rim: 1.0, glow: 1.0 },
  mars: { color: '#e8a27e', height: 0.02, rim: 0.3, glow: 0.35 },
  jupiter: { color: '#e6c9a0', height: 0.014, rim: 0.2, glow: 0.3 },
  saturn: { color: '#f0dfb2', height: 0.014, rim: 0.2, glow: 0.3 },
  uranus: { color: '#9fe8ef', height: 0.03, rim: 0.55, glow: 0.7 },
  neptune: { color: '#5f88ff', height: 0.03, rim: 0.6, glow: 0.8 },
  titan: { color: '#e6a14c', height: 0.07, rim: 0.7, glow: 0.9 },
}
