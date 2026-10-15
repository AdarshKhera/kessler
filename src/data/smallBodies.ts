export type SmallKind = 'comet' | 'asteroid' | 'dwarf' | 'interstellar'

export interface SmallBody {
  readonly id: string
  readonly name: string
  readonly full: string
  readonly kind: SmallKind
  readonly cls: string | null
  readonly el: { readonly q: number; readonly e: number; readonly i: number; readonly om: number; readonly w: number; readonly tp: number }
  readonly per: number | null
  readonly H: number | null
  readonly diameterKm: number | null
  readonly rotationH: number | null
  readonly albedo: number | null
  readonly spectral: string | null
  readonly discovery: { readonly date: string | null; readonly by: string | null; readonly site: string | null } | null
}

/** [q, e, i, om, w, tp]: the same orbit elements as a notable body, packed for thousands of rows. */
export type Row = readonly [number, number, number, number, number, number]

export interface SmallBodyFile {
  readonly generated: string
  readonly notables: readonly SmallBody[]
  readonly populations: { readonly comets: readonly Row[]; readonly main: readonly Row[]; readonly neo: readonly Row[]; readonly trojans: readonly Row[]; readonly tno: readonly Row[] }
}

/** One sentence for the ones people ask about. Everything else gets a line from its class. */
const BLURBS: Readonly<Record<string, string>> = {
  '1P': 'The most famous comet. It returns about every 76 years, and last passed in 1986. Next: 2061.',
  '2P': 'The comet with the shortest known period, 3.3 years, so it swings round the inner solar system constantly.',
  '9P': 'NASA’s Deep Impact fired a probe into this comet in 2005 to see what lay under its surface.',
  '12P': 'A bright periodic comet that flared in outbursts in 2023 and 2024 and was visible to the eye.',
  '67P': 'The comet ESA’s Rosetta orbited for two years and where the Philae lander touched down, in 2014.',
  '81P': 'NASA’s Stardust caught dust from this comet’s tail in 2004 and brought it home.',
  '103P': 'A small comet that NASA’s EPOXI craft flew past in 2010, finding it throws off chunks of ice.',
  '109P': 'The parent of the Perseid meteor shower, and one of the largest objects that crosses Earth’s path.',
  '1995 O1': 'One of the brightest comets of the 20th century, visible to the naked eye for 18 months in 1996 and 1997.',
  '2020 F3': 'Comet NEOWISE, the bright comet of July 2020. Its next visit is in about 6,800 years.',
  '2023 A3': 'Comet Tsuchinshan-ATLAS, the bright comet of October 2024. It will not return for tens of thousands of years.',
  '2024 G3': 'A comet that flew very close to the Sun in January 2025 and put on a bright show in the southern sky.',
  '2017 U1': '‘Oumuamua, the first known visitor from another star system, found in 2017. Its odd shape and motion are still debated.',
  '2019 Q4': 'Comet Borisov, the first interstellar comet, found in 2019. It looks like a comet from our own system.',
  '2025 N1': '3I/ATLAS, the third known object to arrive from another star system, found in July 2025.',
  '1': 'The largest object in the asteroid belt, and a dwarf planet. NASA’s Dawn orbited it and found bright salt deposits.',
  '4': 'The second most massive asteroid. It has a giant crater and was also visited by Dawn.',
  '2': 'The third largest asteroid, tilted well away from the plane the planets orbit in.',
  '10': 'The fourth largest asteroid, a dark, nearly round world.',
  '16': 'A large metal-rich asteroid and the target of NASA’s Psyche mission. It may be the core of an early planet.',
  '433': 'The first asteroid orbited and landed on by a spacecraft: NASA’s NEAR Shoemaker in 2000 and 2001.',
  '101955': 'The rubble pile that NASA’s OSIRIS-REx visited and took a sample from. Its rock arrived on Earth in 2023.',
  '162173': 'A dark, diamond-shaped asteroid. Japan’s Hayabusa2 collected samples here and returned them in 2020.',
  '25143': 'The first asteroid to have a sample brought back, by Japan’s Hayabusa in 2010.',
  '65803': 'The binary asteroid whose small moon Dimorphos NASA’s DART hit in 2022, changing its orbit.',
  '99942': 'It will pass about 32,000 km from Earth on 13 April 2029, closer than our TV satellites, and visible to the naked eye.',
  '152830': 'A small main-belt asteroid that Lucy flew past in November 2023, and found to be two rocks stuck together.',
  '52246': 'A main-belt asteroid that Lucy visited in April 2025.',
  '3548': 'A Jupiter Trojan and the first one Lucy will visit, in 2027.',
  '617': 'A Jupiter Trojan that is really two bodies circling each other. Lucy will visit in 2033.',
  '469219': 'A small asteroid that travels alongside Earth as a quasi-moon. China’s Tianwen-2 is on its way to bring a sample back.',
  '2024 YR4': 'An asteroid found in December 2024 that briefly had a small chance of hitting Earth in 2032. Later tracking ruled Earth out.',
  '486958': 'A snowman-shaped object in the Kuiper Belt, the most distant world ever visited, by New Horizons in 2019.',
  '136199': 'A dwarf planet nearly the size of Pluto, whose discovery in 2005 helped lead to Pluto being reclassified.',
  '136108': 'A fast-spinning, egg-shaped dwarf planet with a ring and two moons.',
  '136472': 'A bright, icy dwarf planet in the Kuiper Belt, the second brightest after Pluto.',
  '90377': 'An extremely distant world whose orbit takes about 11,000 years. At its closest it is still far beyond Neptune.',
}

const CLASS_LINE: Readonly<Record<SmallKind, string>> = {
  comet: 'A ball of ice and dust that grows a glowing tail when it nears the Sun.',
  asteroid: 'A rocky leftover from the building of the planets.',
  dwarf: 'A dwarf planet: big enough to be round, but not clear of its neighbours.',
  interstellar: 'A visitor from another star system, passing through on an open orbit and never coming back.',
}

export const blurbFor = (b: SmallBody): string => BLURBS[b.id] ?? CLASS_LINE[b.kind]
