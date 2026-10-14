import type { Sat } from '../data/types'
import { orbitSummary, type Regime } from './orbit'

export interface Country {
  readonly code: string
  readonly name: string
  readonly flag: string
  /** short badge for the collapsed nav */
  readonly short: string
  readonly blurb?: string
}

const c = (code: string, name: string, flag: string, short: string, blurb?: string): [string, Country] => [code, { code, name, flag, short, blurb }]

/** SATCAT owner codes. Organisations that span countries get a globe. */
export const COUNTRIES: Readonly<Record<string, Country>> = Object.fromEntries([
  c('US', 'United States', '🇺🇸', 'US', 'The biggest fleet by far: Starlink, GPS, imaging constellations, military and science missions.'),
  c('PRC', 'China', '🇨🇳', 'CN', 'BeiDou navigation, Yaogan imaging, the Tiangong station and fast-growing broadband constellations.'),
  c('UK', 'United Kingdom', '🇬🇧', 'GB', 'Mostly OneWeb, which is registered in the UK, plus Earth observation and science missions.'),
  c('CIS', 'Russia and CIS', '🇷🇺', 'RU', 'GLONASS navigation, Cosmos military satellites, Meteor weather and communications.'),
  c('JPN', 'Japan', '🇯🇵', 'JP', 'QZSS navigation, Himawari weather, ALOS Earth observation and many small satellites.'),
  c('IND', 'India', '🇮🇳', 'IN', 'ISRO and Indian operators: NavIC navigation, Cartosat and RISAT imaging, GSAT and INSAT communications, plus science missions like AstroSat and XPoSat. The list also includes retired satellites and spent PSLV and GSLV stages still in orbit.'),
  c('IT', 'Italy', '🇮🇹', 'IT'),
  c('SKOR', 'South Korea', '🇰🇷', 'KR'),
  c('FR', 'France', '🇫🇷', 'FR'),
  c('GER', 'Germany', '🇩🇪', 'DE'),
  c('ESA', 'European Space Agency', '🇪🇺', 'EU'),
  c('CA', 'Canada', '🇨🇦', 'CA'),
  c('SPN', 'Spain', '🇪🇸', 'ES'),
  c('TURK', 'Türkiye', '🇹🇷', 'TR'),
  c('AUS', 'Australia', '🇦🇺', 'AU'),
  c('FIN', 'Finland', '🇫🇮', 'FI'),
  c('ARGN', 'Argentina', '🇦🇷', 'AR'),
  c('ROC', 'Taiwan', '🇹🇼', 'TW'),
  c('UAE', 'United Arab Emirates', '🇦🇪', 'AE'),
  c('NOR', 'Norway', '🇳🇴', 'NO'),
  c('ISRA', 'Israel', '🇮🇱', 'IL'),
  c('GREC', 'Greece', '🇬🇷', 'GR'),
  c('SING', 'Singapore', '🇸🇬', 'SG'),
  c('SAUD', 'Saudi Arabia', '🇸🇦', 'SA'),
  c('POL', 'Poland', '🇵🇱', 'PL'),
  c('BRAZ', 'Brazil', '🇧🇷', 'BR'),
  c('IRAN', 'Iran', '🇮🇷', 'IR'),
  c('LUXE', 'Luxembourg', '🇱🇺', 'LU'),
  c('POR', 'Portugal', '🇵🇹', 'PT'),
  c('INDO', 'Indonesia', '🇮🇩', 'ID'),
  c('BEL', 'Belgium', '🇧🇪', 'BE'),
  c('EGYP', 'Egypt', '🇪🇬', 'EG'),
  c('SWTZ', 'Switzerland', '🇨🇭', 'CH'),
  c('THAI', 'Thailand', '🇹🇭', 'TH'),
  c('MALA', 'Malaysia', '🇲🇾', 'MY'),
  c('ITSO', 'Intelsat', '🌐', 'IS'),
  c('SES', 'SES', '🌐', 'SE'),
  c('O3B', 'O3b Networks', '🌐', 'O3'),
  c('EUTE', 'Eutelsat', '🌐', 'ET'),
  c('GLOB', 'Globalstar', '🌐', 'GL'),
  c('ORB', 'Orbcomm', '🌐', 'OB'),
  c('IM', 'Inmarsat', '🌐', 'IM'),
  c('AB', 'Arabsat', '🌐', 'AB'),
  c('EUME', 'EUMETSAT', '🇪🇺', 'EM'),
  c('ISS', 'ISS partners', '🌐', 'IS'),
  c('TBD', 'Unassigned', '🛰️', '??'),
])

export function countryOf(code: string | undefined): Country {
  if (!code) return { code: '', name: 'Unknown', flag: '🛰️', short: '??' }
  return COUNTRIES[code] ?? { code, name: code, flag: '🛰️', short: code.slice(0, 2) }
}

export interface CountryRow extends Country {
  readonly count: number
}

/** Countries with at least `min` objects, biggest first. `owners` is aligned with the satellite list. */
export function listCountries(owners: readonly (string | undefined)[], min = 8): CountryRow[] {
  const counts = new Map<string, number>()
  for (const o of owners) if (o && o !== 'TBD') counts.set(o, (counts.get(o) ?? 0) + 1) // TBD = not yet assigned
  return [...counts]
    .filter(([, n]) => n >= min)
    .map(([code, count]) => ({ ...countryOf(code), count }))
    .sort((a, b) => b.count - a.count)
}

/** "GSAT-30" -> "GSAT": the leading word, used to group a country's missions. */
export function satelliteFamily(name: string): string {
  return /^[A-Za-z]+/.exec(name.trim())?.[0].toUpperCase() ?? name
}

export interface CountrySummary {
  readonly count: number
  readonly sharePct: number
  readonly medianAltitudeKm: number
  readonly regimes: Readonly<Record<Regime, number>>
  readonly families: readonly { name: string; count: number }[]
  /** satellite indices, sorted by name */
  readonly members: readonly number[]
}

export function countrySummary(sats: readonly Sat[], owners: readonly (string | undefined)[], code: string, nowMs: number): CountrySummary {
  const members: number[] = []
  const alts: number[] = []
  const regimes: Record<Regime, number> = { LEO: 0, MEO: 0, GEO: 0, HEO: 0 }
  const families = new Map<string, number>()
  sats.forEach((s, i) => {
    if (owners[i] !== code) return
    members.push(i)
    const o = orbitSummary(s.omm, nowMs)
    alts.push((o.perigeeKm + o.apogeeKm) / 2)
    regimes[o.regime] += 1
    const fam = satelliteFamily(s.name)
    families.set(fam, (families.get(fam) ?? 0) + 1)
  })
  alts.sort((a, b) => a - b)
  members.sort((a, b) => sats[a].name.localeCompare(sats[b].name))
  return {
    count: members.length,
    sharePct: sats.length ? (members.length / sats.length) * 100 : 0,
    medianAltitudeKm: alts.length ? alts[Math.floor(alts.length / 2)] : 0,
    regimes,
    families: [...families].filter(([, n]) => n >= 2).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 6),
    members,
  }
}
