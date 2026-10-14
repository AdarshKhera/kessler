import type { OrbitSummary } from './orbit'

export interface Purpose {
  readonly category: string
  /** One plain sentence: what is it for? */
  readonly line: string
  /** name: matched a known craft or family. fleet: from its fleet. orbit: guessed from the orbit alone. */
  readonly basis: 'name' | 'fleet' | 'orbit'
}

interface Rule {
  readonly test: RegExp
  readonly category: string
  readonly line: string
}

const COMMS_GEO = 'Relays TV, internet and phone traffic from 35,786 km, hovering over one spot.'

/** Order matters: first match wins, so specific families come before general words. */
const NAME_RULES: readonly Rule[] = [
  { test: /\bDEB\b|DEBRIS/, category: 'Debris', line: 'A fragment from a breakup. It no longer does anything and is tracked so nothing runs into it.' },
  { test: /\bR\/B\b|ROCKET BODY|\bAKM\b|\bPAM-?D\b/, category: 'Rocket body', line: 'A spent rocket stage left in orbit after delivering a payload.' },
  { test: /^ISS\b|ZARYA|ZVEZDA|NAUKA|POISK|RASSVET|UNITY|DESTINY|HARMONY|TRANQUILITY|PIRS/, category: 'Space station', line: 'Part of the International Space Station, a permanently crewed laboratory in microgravity.' },
  { test: /TIANHE|WENTIAN|MENGTIAN|^CSS\b|TIANGONG/, category: 'Space station', line: "Part of China's Tiangong station, a crewed laboratory in low orbit." },
  { test: /PROGRESS|SOYUZ|SHENZHOU|TIANZHOU|DRAGON|CYGNUS|DREAM CHASER|STARLINER/, category: 'Visiting vehicle', line: 'A crew or cargo ship that ferries people and supplies to a space station.' },
  { test: /^HST\b|HUBBLE/, category: 'Space telescope', line: 'Hubble: has photographed deep space in visible and ultraviolet light since 1990.' },
  { test: /\bTESS\b|SWIFT|FERMI|CHANDRA|NUSTAR|XMM|NEOWISE|SPITZER|\bIXPE\b|NICER|INTEGRAL|HERSCHEL|GALEX|KEPLER|ASTROSAT|XPOSAT|HXMT|INSIGHT|EUCLID|CHEOPS|GAIA/, category: 'Space telescope', line: 'An observatory in space studying stars, black holes and galaxies without the atmosphere in the way.' },
  { test: /\bMMS\b|THEMIS|VAN ALLEN|RBSP|CLUSTER|ARTEMIS|TIMED|ICON\b|GOLD\b|SDO|STEREO|SOHO|PARKER|IRIS\b/, category: 'Space science', line: 'A science mission studying the Sun, its wind and how it shapes near-Earth space.' },
  { test: /CHANDRAYAAN|LUNAR|MOON|ARTEMIS|CAPSTONE|DESTINY\+/, category: 'Lunar mission', line: 'Part of a mission to the Moon.' },
  { test: /STARLINK/, category: 'Broadband internet', line: "Part of SpaceX's constellation delivering internet to homes, ships and aircraft." },
  { test: /ONEWEB/, category: 'Broadband internet', line: 'Part of the OneWeb network giving internet to airlines, ships and remote regions.' },
  { test: /IRIDIUM/, category: 'Satellite phones', line: 'Cross-linked satellites that give phone and data coverage anywhere on Earth, poles included.' },
  { test: /GLOBALSTAR|ORBCOMM|GONETS|SWARM\b/, category: 'Messaging and tracking', line: 'Small-data and voice links for asset trackers, remote sensors and satellite phones.' },
  { test: /\bGPS\b|NAVSTAR|\bBII|\bBIII/, category: 'Navigation', line: 'A GPS satellite. Its atomic clocks and radio signals let receivers work out where they are.' },
  { test: /GALILEO/, category: 'Navigation', line: "Part of Europe's Galileo navigation system, accurate to about a metre." },
  { test: /BEIDOU|\bBDS\b/, category: 'Navigation', line: "Part of China's BeiDou navigation system." },
  { test: /GLONASS|\bGLO\b/, category: 'Navigation', line: "Part of Russia's GLONASS navigation system." },
  { test: /IRNSS|NAVIC|\bNVS\b/, category: 'Navigation', line: "Part of NavIC, India's regional navigation system covering India and its surroundings." },
  { test: /QZS|MICHIBIKI/, category: 'Navigation', line: "Part of Japan's QZSS, which improves GPS accuracy over Asia and Oceania." },
  { test: /INSAT-3D|INSAT-3DR|INSAT-3DS|KALPANA/, category: 'Weather', line: "An Indian weather satellite watching cyclones, monsoons and cloud cover from geostationary orbit." },
  { test: /NOAA|GOES|METEOSAT|\bMSG\b|METOP|FENGYUN|\bFY-?\d|HIMAWARI|ELEKTRO|METEOR|DMSP|SUOMI|JPSS|GEO-KOMPSAT|COMS\b|MTSAT|ARKTIKA|WEATHERSAT/, category: 'Weather', line: 'A weather satellite tracking clouds, storms and temperature for forecasts.' },
  { test: /CARTOSAT/, category: 'Earth observation', line: "An Indian mapping satellite taking sharp pictures for cartography, urban planning and infrastructure." },
  { test: /RISAT/, category: 'Earth observation', line: 'An Indian radar-imaging satellite that sees through cloud and at night.' },
  { test: /OCEANSAT|EOS-0?6/, category: 'Earth observation', line: 'Watches the oceans: sea colour, plankton and winds over water.' },
  { test: /RESOURCESAT|HYSIS|EMISAT|SCATSAT|EOS-/, category: 'Earth observation', line: 'An Indian Earth-observation satellite for crops, land, water and climate.' },
  { test: /LANDSAT|SENTINEL|TERRA\b|AQUA\b|AURA\b|COPERNICUS|WORLDVIEW|PLEIADES|SKYSAT|FLOCK|PELICAN|LEMUR|YAOGAN|JILIN|GAOFEN|ZIYUAN|\bSPOT\b|KOMPSAT|ALOS|CBERS|ICEYE|CAPELLA|UMBRA|BLACKSKY|SWOT|JASON|ICESAT|SMAP|\bOCO-?\d|GRACE|CALIPSO|CLOUDSAT|RADARSAT|TERRASAR|TANDEM|COSMO-SKYMED|PAZ\b|SAOCOM|DMC|PLANET/, category: 'Earth observation', line: 'Takes images or measurements of Earth for mapping, farming, climate, disasters and ships.' },
  { test: /TDRS/, category: 'Communications', line: "NASA's relay satellite that links the ISS, Hubble and others to the ground." },
  { test: /INTELSAT|\bSES\b|EUTELSAT|ASTRA|ARABSAT|BADR|THURAYA|INMARSAT|VIASAT|TELSTAR|ECHOSTAR|DIRECTV|SKY\b|AMAZONAS|HISPASAT|NILESAT|TURKSAT|YAMAL|EXPRESS|SINOSAT|APSTAR|CHINASAT|ASIASAT|OPTUS|JCSAT|SUPERBIRD|KOREASAT|MEASAT|THAICOM|AL YAH|O3B|GSAT|INSAT|CMS-0|ANIK|NIMIQ|SPACEWAY|WGS\b|AEHF|MUOS|SKYNET|SATCOM/, category: 'Communications', line: COMMS_GEO },
  { test: /^USA[ -]?\d+|NROL|\bNOSS\b|\bLACROSSE\b|\bKH-?\d|MENTOR|ORION\b|TRUMPET|MISTY/, category: 'Government', line: 'A US government satellite. Its exact job is classified: typically reconnaissance, early warning or secure communications.' },
  { test: /^COSMOS|^KOSMOS|^KANOPUS|^LOTOS|^PION|^TOPAZ/, category: 'Military', line: 'A Russian military or government satellite: navigation, reconnaissance, communications or early warning.' },
  { test: /^SBIRS|^DSP\b|^STSS|^TSIS/, category: 'Early warning', line: 'Watches for missile launches by spotting their infrared heat.' },
]

const FLEET_DEFAULTS: Readonly<Record<string, Purpose>> = {
  spacex: { category: 'Broadband internet', line: "Part of SpaceX's constellation delivering internet to homes, ships and aircraft.", basis: 'fleet' },
  oneweb: { category: 'Broadband internet', line: 'Part of the OneWeb network giving internet to airlines, ships and remote regions.', basis: 'fleet' },
  gps: { category: 'Navigation', line: 'A GPS satellite. Its atomic clocks and radio signals let receivers work out where they are.', basis: 'fleet' },
  galileo: { category: 'Navigation', line: "Part of Europe's Galileo navigation system.", basis: 'fleet' },
  china: { category: 'Navigation', line: "Part of China's BeiDou navigation system.", basis: 'fleet' },
  glonass: { category: 'Navigation', line: "Part of Russia's GLONASS navigation system.", basis: 'fleet' },
  iridium: { category: 'Satellite phones', line: 'Cross-linked satellites that give phone and data coverage anywhere on Earth.', basis: 'fleet' },
  eo: { category: 'Earth observation', line: 'A small imaging satellite photographing Earth, or tracking ships and weather.', basis: 'fleet' },
  weather: { category: 'Weather', line: 'A weather satellite tracking clouds, storms and temperature for forecasts.', basis: 'fleet' },
  stations: { category: 'Space station', line: 'Part of a crewed space station.', basis: 'fleet' },
  science: { category: 'Space science', line: 'A research mission studying Earth, the Sun or the universe.', basis: 'fleet' },
  debris: { category: 'Debris', line: 'A fragment from a breakup. It no longer does anything and is tracked so nothing runs into it.', basis: 'fleet' },
  geo: { category: 'Communications', line: COMMS_GEO, basis: 'fleet' },
}

export interface PurposeInput {
  readonly name: string
  readonly operatorId: string
  readonly orbit: Pick<OrbitSummary, 'regime' | 'inclinationDeg' | 'perigeeKm' | 'apogeeKm' | 'eccentricity'>
}

/** Best-effort, honest description of what a satellite is for. Public catalogues do not list purpose. */
export function describePurpose({ name, operatorId, orbit }: PurposeInput): Purpose {
  const upper = name.toUpperCase()
  for (const r of NAME_RULES) if (r.test.test(upper)) return { category: r.category, line: r.line, basis: 'name' }

  const byFleet = FLEET_DEFAULTS[operatorId]
  if (byFleet) return byFleet

  const { regime, inclinationDeg: inc, perigeeKm, apogeeKm, eccentricity } = orbit
  if (regime === 'GEO') return { category: 'Communications', line: 'Parked at 35,786 km over one spot: most likely relaying TV, internet and phone traffic, or watching weather.', basis: 'orbit' }
  if (regime === 'MEO') return { category: 'Navigation', line: 'Medium orbits around 20,000 km are where navigation satellites fly, so this is probably one.', basis: 'orbit' }
  if (regime === 'HEO' || eccentricity > 0.3) return { category: 'Specialised orbit', line: 'A very elongated orbit that lingers over high latitudes: typical for polar communications and early warning.', basis: 'orbit' }
  if (inc > 95 && inc < 102 && perigeeKm < 1000) return { category: 'Earth observation', line: 'A sun-synchronous polar orbit passes over each place at the same local time: the classic choice for imaging Earth.', basis: 'orbit' }
  if (inc < 30 && apogeeKm < 800) return { category: 'Low-latitude mission', line: 'A low, near-equatorial orbit used by small satellites that serve the tropics.', basis: 'orbit' }
  return { category: 'Satellite', line: 'Public catalogues do not say what this one does. Its orbit alone is not distinctive.', basis: 'orbit' }
}
