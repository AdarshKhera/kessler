export interface Operator {
  readonly id: string
  readonly name: string
  readonly color: string
  /** two-letter badge for the collapsed nav */
  readonly short: string
}

export interface Group {
  /** CelesTrak GROUP name. Order in GROUPS is dedupe priority (specific before generic). */
  readonly id: string
  readonly name: string
  readonly operator: string
}

export const OPERATORS: readonly Operator[] = [
  { id: 'spacex', name: 'SpaceX', color: '#4de3ff', short: 'SX' },
  { id: 'oneweb', name: 'Eutelsat OneWeb', color: '#8f9bff', short: 'OW' },
  { id: 'gps', name: 'US Space Force', color: '#ffd166', short: 'GP' },
  { id: 'galileo', name: 'European Union', color: '#5cff9d', short: 'EU' },
  { id: 'china', name: 'China (BDS)', color: '#ff9f4a', short: 'CN' },
  { id: 'glonass', name: 'Roscosmos', color: '#c792ff', short: 'RU' },
  { id: 'iridium', name: 'Iridium', color: '#ff7ad9', short: 'IR' },
  { id: 'eo', name: 'Commercial EO', color: '#8affd6', short: 'EO' },
  { id: 'geo', name: 'GEO Comsats', color: '#e6edff', short: 'GE' },
  { id: 'weather', name: 'Meteorology', color: '#6cb6ff', short: 'WX' },
  { id: 'stations', name: 'Crewed Stations', color: '#ffffff', short: 'ST' },
  { id: 'science', name: 'Science', color: '#ffe08a', short: 'SC' },
  { id: 'debris', name: 'Collision Debris', color: '#ff3b5c', short: 'DB' },
  { id: 'other', name: 'Other satellites', color: '#a1a1ad', short: 'OT' },
]

export const GROUPS: readonly Group[] = [
  { id: 'stations', name: 'Stations', operator: 'stations' },
  { id: 'starlink', name: 'Starlink', operator: 'spacex' },
  { id: 'oneweb', name: 'OneWeb', operator: 'oneweb' },
  { id: 'gps-ops', name: 'GPS', operator: 'gps' },
  { id: 'galileo', name: 'Galileo', operator: 'galileo' },
  { id: 'beidou', name: 'BeiDou', operator: 'china' },
  { id: 'glo-ops', name: 'GLONASS', operator: 'glonass' },
  { id: 'iridium-NEXT', name: 'Iridium NEXT', operator: 'iridium' },
  { id: 'planet', name: 'Planet Flock', operator: 'eo' },
  { id: 'spire', name: 'Spire Lemur', operator: 'eo' },
  { id: 'weather', name: 'Weather', operator: 'weather' },
  { id: 'science', name: 'Science', operator: 'science' },
  { id: 'intelsat', name: 'Intelsat', operator: 'geo' },
  { id: 'ses', name: 'SES', operator: 'geo' },
  { id: 'eutelsat', name: 'Eutelsat', operator: 'geo' },
  { id: 'geo', name: 'Other GEO', operator: 'geo' },
  { id: 'fengyun-1c-debris', name: 'Fengyun-1C (2007 ASAT)', operator: 'debris' },
  { id: 'cosmos-2251-debris', name: 'Cosmos 2251 (2009 collision)', operator: 'debris' },
  { id: 'iridium-33-debris', name: 'Iridium 33 (2009 collision)', operator: 'debris' },
  { id: 'cosmos-1408-debris', name: 'Cosmos 1408 (2021 ASAT)', operator: 'debris' },
  { id: 'active', name: 'Other active satellites', operator: 'other' },
  { id: 'india-extra', name: 'Indian retired satellites and launch stages', operator: 'other' },
]

export function dedupeById<T extends { readonly id: number }>(rows: readonly T[]): T[] {
  const seen = new Set<number>()
  const out: T[] = []
  for (const r of rows) {
    if (seen.has(r.id)) continue
    seen.add(r.id)
    out.push(r)
  }
  return out
}
