/**
 * Named missions pulled out of CelesTrak's general lists into their own fleets. Public catalogues do not say who
 * flies what, so this table does: it matches the catalogue name and says what the mission is for.
 */
export interface Mission {
  readonly test: RegExp
  /** id of a derived group in the registry */
  readonly group: string
  readonly line: string
}

const EARTH = 'nasa-earth'
const ASTRO = 'nasa-astro'
const HELIO = 'nasa-helio'

/** First match wins. */
export const MISSIONS: readonly Mission[] = [
  // NASA: studying Earth
  { test: /^TERRA$/, group: EARTH, line: "NASA's Terra, flying since 1999: five instruments measuring land, air and clouds in the morning sky." },
  { test: /^AQUA$/, group: EARTH, line: "NASA's Aqua, flying since 2002: follows the water cycle through clouds, oceans, ice and rain." },
  { test: /^AURA$/, group: EARTH, line: "NASA's Aura: tracks ozone and the gases that make smog, from its place in the A-Train." },
  { test: /SUOMI NPP/, group: EARTH, line: 'Suomi NPP: a NASA and NOAA satellite whose night-time imagery shows city lights, fires and storms.' },
  { test: /^LANDSAT/, group: EARTH, line: 'Landsat: NASA and USGS imaging of the whole planet every 16 days, an unbroken record since 1972.' },
  { test: /^SMAP$/, group: EARTH, line: "NASA's SMAP: measures the water in the top layer of soil, for floods, droughts and crop forecasts." },
  { test: /ICESAT-2/, group: EARTH, line: "NASA's ICESat-2: fires laser pulses to measure ice sheets, sea ice and forests to the centimetre." },
  { test: /GRACE-FO/, group: EARTH, line: 'GRACE-FO: two spacecraft that weigh Earth’s water by feeling tiny tugs in gravity as they fly over.' },
  { test: /^OCO 2$|^OCO-2$/, group: EARTH, line: "NASA's Orbiting Carbon Observatory: maps where carbon dioxide is going into and out of the air." },
  { test: /GPM-CORE/, group: EARTH, line: 'The Global Precipitation Measurement core: radar that sees rain and snow falling, worldwide.' },
  { test: /^PACE$/, group: EARTH, line: "NASA's PACE: reads the colour of the oceans and tiny particles in the air to watch plankton and aerosols." },
  { test: /^SWOT$/, group: EARTH, line: 'SWOT: a radar that measures the height of nearly all the water on Earth, rivers and lakes included.' },
  { test: /^NISAR$/, group: EARTH, line: 'NISAR: a NASA and ISRO radar satellite that sees ground movement, ice and forests, through cloud and night.' },
  { test: /^PREFIRE/, group: EARTH, line: 'PREFIRE: a pair of small satellites measuring the heat Earth’s poles lose to space.' },
  { test: /SENTINEL-6|^JASON-3/, group: EARTH, line: 'Sea-level mission run with NASA: radar altimeters that track the height of the oceans to a few millimetres.' },
  { test: /^TROPICS/, group: EARTH, line: "NASA's TROPICS: small satellites that watch how tropical storms build, every hour." },
  // NASA: astronomy
  { test: /^HST$|^HUBBLE/, group: ASTRO, line: 'Hubble: NASA and ESA’s space telescope, photographing the universe in visible and ultraviolet light since 1990.' },
  { test: /^SWIFT$/, group: ASTRO, line: "NASA's Swift: swings round in seconds to catch gamma-ray bursts, the flashes of dying stars." },
  { test: /FGRST|GLAST|FERMI/, group: ASTRO, line: "NASA's Fermi: maps the most energetic light in the universe, from black holes and pulsars." },
  { test: /^NUSTAR$/, group: ASTRO, line: "NASA's NuSTAR: focuses high-energy X-rays to study black holes and exploded stars." },
  { test: /^IXPE$/, group: ASTRO, line: 'IXPE: measures the polarisation of X-rays to learn how black holes and neutron stars shine.' },
  { test: /^TESS$/, group: ASTRO, line: "NASA's TESS: watches bright stars for the tiny dimming that gives away a passing planet." },
  { test: /^XRISM/, group: ASTRO, line: 'XRISM: a JAXA and NASA X-ray telescope that reads the speed and chemistry of hot gas in galaxies.' },
  { test: /^SPHEREX/, group: ASTRO, line: 'SPHEREx: maps the whole sky in 102 colours of infrared to study how galaxies formed.' },
  // NASA: the Sun and near-Earth space
  { test: /^SDO$/, group: HELIO, line: "NASA's Solar Dynamics Observatory: a constant, high-definition watch on the Sun from geosynchronous orbit." },
  { test: /^IRIS$/, group: HELIO, line: "NASA's IRIS: studies the thin, violent layer between the Sun’s surface and its outer atmosphere." },
  { test: /^MMS \d/, group: HELIO, line: 'One of four Magnetospheric Multiscale craft that fly in a pyramid to catch magnetic reconnection in the act.' },
  { test: /^THEMIS/, group: HELIO, line: 'THEMIS: studies the auroras and the storms in Earth’s magnetic tail that power them.' },
  { test: /^TIMED$/, group: HELIO, line: "NASA's TIMED: studies the upper atmosphere where Earth meets space, since 2001." },
  { test: /^SORCE$/, group: HELIO, line: 'SORCE: measured how much energy the Sun sends us, for nearly two decades. Now retired.' },
  { test: /^TRACERS/, group: HELIO, line: 'TRACERS: a pair of satellites flying through the gaps in Earth’s magnetic field above the poles.' },
  { test: /^PUNCH/, group: HELIO, line: 'PUNCH: four satellites that together watch the Sun’s outer atmosphere become the solar wind.' },
  { test: /^POLAR$/, group: HELIO, line: "NASA's old Polar spacecraft, a spent magnetosphere mission now left in orbit." },
  // NASA: relay and technology
  { test: /^TDRS/, group: 'nasa-relay', line: "NASA's Tracking and Data Relay Satellite: keeps the ISS, Hubble and others in contact from 35,786 km up." },
  { test: /^STARLING/, group: 'nasa-tech', line: 'STARLING: four small satellites testing how a swarm can coordinate itself without waiting for the ground.' },
  // SpaceX beyond Starlink
  { test: /DRAGON/, group: 'spacex-other', line: "A SpaceX Dragon: the capsule that carries crew and cargo to the space station and back." },
]

/** What kind of mission each derived group is, in the words the card uses. */
export const MISSION_CATEGORY: Readonly<Record<string, string>> = {
  'nasa-earth': 'Earth observation',
  'nasa-astro': 'Space telescope',
  'nasa-helio': 'Space science',
  'nasa-relay': 'Communications',
  'nasa-tech': 'Technology demonstration',
  'spacex-other': 'Visiting vehicle',
}

export function missionFor(name: string): Mission | undefined {
  const upper = name.toUpperCase()
  return MISSIONS.find((m) => m.test.test(upper))
}
