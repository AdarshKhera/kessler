import type { PlanetId } from '../lib/ephemeris'

export type BodyKind = 'star' | 'planet' | 'dwarf' | 'moon'

export interface Body {
  readonly id: string
  readonly name: string
  readonly kind: BodyKind
  readonly radiusKm: number
  readonly color: string
  /** axial tilt in degrees */
  readonly tilt: number
  /** sidereal rotation in hours about the IAU pole; negative means it turns clockwise about that pole */
  readonly rotationHours: number
  /** orbital period in Earth days (planets and dwarf planets) */
  readonly periodDays?: number
  readonly moons?: string
  readonly blurb: string
  readonly facts: readonly string[]
  readonly rings?: boolean
  /** IAU north-pole direction (J2000 right ascension and declination, degrees) */
  readonly pole: { readonly ra: number; readonly dec: number }
}

export interface Moon {
  readonly id: string
  readonly name: string
  readonly parent: PlanetId
  readonly radiusKm: number
  /** orbital radius in km */
  readonly orbitKm: number
  readonly periodDays: number
  readonly retrograde?: boolean
  readonly color: string
  readonly blurb: string
}

export const SUN: Body = {
  id: 'sun', name: 'Sun', kind: 'star', radiusKm: 695_700, color: '#ffd27a', tilt: 7.25, rotationHours: 609.12, pole: { ra: 286.13, dec: 63.87 },
  blurb: 'The star at the centre of it all. Everything else on this map is falling around it.',
  facts: ['It holds 99.86% of the solar system’s mass.', 'Sunlight takes about 8 minutes 20 seconds to reach Earth.'],
}

export const PLANETS: readonly (Body & { readonly id: PlanetId })[] = [
  {
    id: 'mercury', name: 'Mercury', kind: 'planet', radiusKm: 2_439.7, color: '#a39a90', tilt: 0.03, rotationHours: 1407.6, periodDays: 87.97, moons: 'None',
    pole: { ra: 281.01, dec: 61.45 },
    blurb: 'The smallest planet and the closest to the Sun. Baked by day, frozen by night.',
    facts: ['One full day, sunrise to sunrise, lasts 176 Earth days.', 'Despite being closest to the Sun, it is not the hottest planet.'],
  },
  {
    id: 'venus', name: 'Venus', kind: 'planet', radiusKm: 6_051.8, color: '#e6cc92', tilt: 177.4, rotationHours: -5832.5, periodDays: 224.7, moons: 'None',
    pole: { ra: 272.76, dec: 67.16 },
    blurb: 'Earth’s size, but wrapped in thick carbon dioxide clouds that trap heat.',
    facts: ['The hottest planet: about 465 °C at the surface.', 'It spins backwards, so the Sun rises in the west.'],
  },
  {
    id: 'earth', name: 'Earth', kind: 'planet', radiusKm: 6_371, color: '#4b8be0', tilt: 23.44, rotationHours: 23.934, periodDays: 365.256, moons: '1 (the Moon)',
    pole: { ra: 0, dec: 90 },
    blurb: 'Home. The only world known to have life, and the one these satellites circle.',
    facts: ['About 71% of its surface is ocean.', 'Zoom all the way in to see every tracked satellite around it.'],
  },
  {
    id: 'mars', name: 'Mars', kind: 'planet', radiusKm: 3_389.5, color: '#c4673f', tilt: 25.19, rotationHours: 24.623, periodDays: 686.98, moons: '2 (Phobos, Deimos)',
    pole: { ra: 317.68, dec: 52.89 },
    blurb: 'A cold red desert with ancient river beds and the tallest volcano known.',
    facts: ['Olympus Mons is about 22 km high, roughly 2.5 times Everest.', 'A day is 24 hours 37 minutes, almost the same as ours.'],
  },
  {
    id: 'jupiter', name: 'Jupiter', kind: 'planet', radiusKm: 69_911, color: '#d9b790', tilt: 3.13, rotationHours: 9.925, periodDays: 4332.59, moons: '95+ known',
    pole: { ra: 268.06, dec: 64.5 },
    blurb: 'A gas giant more massive than all the other planets combined.',
    facts: ['The Great Red Spot is a storm wider than Earth, watched for over 150 years.', 'Its day is under 10 hours, the shortest of any planet.'],
  },
  {
    id: 'saturn', name: 'Saturn', kind: 'planet', radiusKm: 58_232, color: '#e5d2a2', tilt: 26.73, rotationHours: 10.656, periodDays: 10_759.22, moons: '270+ known', rings: true,
    pole: { ra: 40.59, dec: 83.54 },
    blurb: 'The ringed giant. Its rings are mostly water ice, from dust grains to house-sized blocks.',
    facts: ['The ring system is about 20 Earths wide yet often only around 10 metres thick.', 'It is less dense than water: in a big enough ocean it would float.'],
  },
  {
    id: 'uranus', name: 'Uranus', kind: 'planet', radiusKm: 25_362, color: '#a9dfe2', tilt: 97.77, rotationHours: -17.24, periodDays: 30_688.5, moons: '28+ known', rings: false,
    pole: { ra: 257.31, dec: -15.18 },
    blurb: 'An ice giant that rolls around the Sun on its side.',
    facts: ['Its axis is tilted 98 degrees, so each pole gets about 42 years of sunlight, then 42 of dark.', 'It was the first planet found with a telescope, in 1781.'],
  },
  {
    id: 'neptune', name: 'Neptune', kind: 'planet', radiusKm: 24_622, color: '#4f7be8', tilt: 28.32, rotationHours: 16.11, periodDays: 60_182, moons: '16 known',
    pole: { ra: 299.36, dec: 43.46 },
    blurb: 'The farthest planet: deep blue, and lashed by the fastest winds in the solar system.',
    facts: ['Winds reach roughly 2,000 km/h.', 'It finished its first orbit since discovery (1846) only in 2011.'],
  },
  {
    id: 'pluto', name: 'Pluto', kind: 'dwarf', radiusKm: 1_188.3, color: '#cdb6a0', tilt: 122.5, rotationHours: 153.29, periodDays: 90_560, moons: '5 known (Charon is the largest)',
    pole: { ra: 132.99, dec: -6.16 },
    blurb: 'A dwarf planet in the Kuiper Belt, with an orbit that swings inside Neptune’s at times.',
    facts: ['NASA’s New Horizons flew past in 2015 and found a heart-shaped plain of nitrogen ice.', 'One orbit takes 248 years.'],
  },
]

/** Circular-orbit approximations. Only Earth’s Moon is placed from an ephemeris; the rest use fixed starting phases. */
export const MOONS: readonly Moon[] = [
  { id: 'moon', name: 'Moon', parent: 'earth', radiusKm: 1737.4, orbitKm: 384_400, periodDays: 27.32, color: '#bdbdbd', blurb: 'Tidally locked: it always shows us the same face.' },
  { id: 'phobos', name: 'Phobos', parent: 'mars', radiusKm: 11.3, orbitKm: 9_376, periodDays: 0.319, color: '#8c8077', blurb: 'Orbits so close it circles Mars three times a day.' },
  { id: 'deimos', name: 'Deimos', parent: 'mars', radiusKm: 6.2, orbitKm: 23_463, periodDays: 1.263, color: '#9a8e84', blurb: 'The smaller, outer moon of Mars.' },
  { id: 'io', name: 'Io', parent: 'jupiter', radiusKm: 1821.6, orbitKm: 421_700, periodDays: 1.769, color: '#e6d37a', blurb: 'The most volcanically active world known.' },
  { id: 'europa', name: 'Europa', parent: 'jupiter', radiusKm: 1560.8, orbitKm: 671_034, periodDays: 3.551, color: '#d8c9b0', blurb: 'An ice shell over a global salty ocean.' },
  { id: 'ganymede', name: 'Ganymede', parent: 'jupiter', radiusKm: 2634.1, orbitKm: 1_070_412, periodDays: 7.155, color: '#a49b90', blurb: 'The largest moon in the solar system, bigger than Mercury.' },
  { id: 'callisto', name: 'Callisto', parent: 'jupiter', radiusKm: 2410.3, orbitKm: 1_882_709, periodDays: 16.689, color: '#7d7468', blurb: 'One of the most heavily cratered surfaces known.' },
  { id: 'mimas', name: 'Mimas', parent: 'saturn', radiusKm: 198.2, orbitKm: 185_539, periodDays: 0.942, color: '#b9b9b9', blurb: 'Its giant crater makes it look like the Death Star.' },
  { id: 'enceladus', name: 'Enceladus', parent: 'saturn', radiusKm: 252.1, orbitKm: 238_042, periodDays: 1.37, color: '#f3f6f8', blurb: 'Geysers of water ice spray from its south pole.' },
  { id: 'tethys', name: 'Tethys', parent: 'saturn', radiusKm: 531.1, orbitKm: 294_619, periodDays: 1.888, color: '#d6d6d6', blurb: 'A moon almost entirely of water ice.' },
  { id: 'dione', name: 'Dione', parent: 'saturn', radiusKm: 561.4, orbitKm: 377_396, periodDays: 2.737, color: '#cfcfcf', blurb: 'Icy, with wispy cliffs on its trailing side.' },
  { id: 'rhea', name: 'Rhea', parent: 'saturn', radiusKm: 763.8, orbitKm: 527_108, periodDays: 4.518, color: '#c4c0ba', blurb: 'Saturn’s second-largest moon.' },
  { id: 'titan', name: 'Titan', parent: 'saturn', radiusKm: 2574.7, orbitKm: 1_221_870, periodDays: 15.945, color: '#d9a85a', blurb: 'The only moon with a thick atmosphere, and lakes of liquid methane.' },
  { id: 'iapetus', name: 'Iapetus', parent: 'saturn', radiusKm: 734.5, orbitKm: 3_560_820, periodDays: 79.33, color: '#8e8478', blurb: 'Two-toned: one hemisphere dark, the other bright.' },
  { id: 'miranda', name: 'Miranda', parent: 'uranus', radiusKm: 235.8, orbitKm: 129_900, periodDays: 1.413, color: '#b6b6b6', blurb: 'A patchwork of cliffs and canyons.' },
  { id: 'ariel', name: 'Ariel', parent: 'uranus', radiusKm: 578.9, orbitKm: 190_900, periodDays: 2.52, color: '#c9c9c9', blurb: 'Bright, with a network of deep valleys.' },
  { id: 'umbriel', name: 'Umbriel', parent: 'uranus', radiusKm: 584.7, orbitKm: 266_000, periodDays: 4.144, color: '#7f7f7f', blurb: 'The darkest of the big Uranian moons.' },
  { id: 'titania', name: 'Titania', parent: 'uranus', radiusKm: 788.4, orbitKm: 436_300, periodDays: 8.706, color: '#b3aca4', blurb: 'The largest moon of Uranus.' },
  { id: 'oberon', name: 'Oberon', parent: 'uranus', radiusKm: 761.4, orbitKm: 583_500, periodDays: 13.463, color: '#9c948b', blurb: 'An old, cratered moon at the edge of the main group.' },
  { id: 'triton', name: 'Triton', parent: 'neptune', radiusKm: 1353.4, orbitKm: 354_759, periodDays: 5.877, retrograde: true, color: '#cfc2bb', blurb: 'Orbits backwards, which hints it was captured from the Kuiper Belt.' },
  { id: 'charon', name: 'Charon', parent: 'pluto', radiusKm: 606, orbitKm: 19_591, periodDays: 6.387, color: '#9d948c', blurb: 'So big beside Pluto that the two circle a point between them.' },
]

export const BODIES: readonly Body[] = [SUN, ...PLANETS]
export const bodyById = (id: string): Body | undefined => BODIES.find((b) => b.id === id)
export const moonsOf = (id: string): readonly Moon[] => MOONS.filter((m) => m.parent === id)
