import { OPERATORS } from '../data/registry'
import { h } from './dom'

const svg = (body: string) =>
  `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`

/** Static markup only. One glyph per kind of mission. */
const KINDS = {
  comms: svg('<circle cx="8" cy="8.5" r="1.1" fill="currentColor" stroke="none"/><path d="M5.4 6a3.8 3.8 0 0 0 0 5M10.6 6a3.8 3.8 0 0 1 0 5M3.2 4a6.8 6.8 0 0 0 0 9M12.8 4a6.8 6.8 0 0 1 0 9"/>'),
  nav: svg('<circle cx="8" cy="8" r="5.6"/><path d="M10.7 5.3 9.1 9.1 5.3 10.7 6.9 6.9z"/>'),
  eo: svg('<path d="M1.6 8S4 3.8 8 3.8 14.4 8 14.4 8 12 12.2 8 12.2 1.6 8 1.6 8z"/><circle cx="8" cy="8" r="1.9"/>'),
  weather: svg('<path d="M4.6 12.4a2.9 2.9 0 0 1-.4-5.8 4 4 0 0 1 7.6.9 2.5 2.5 0 0 1-.4 4.9z"/>'),
  station: svg('<rect x="6" y="4.8" width="4" height="6.4" rx="1"/><path d="M1.8 6.4h3.2v3.2H1.8zM11 6.4h3.2v3.2H11zM5 8h1M10 8h1"/>'),
  science: svg('<path d="M8 2.2c.4 3.2 1.6 4.4 5.8 5.8-4.2 1.4-5.4 2.6-5.8 5.8-.4-3.2-1.6-4.4-5.8-5.8C6.4 6.6 7.6 5.4 8 2.2z"/>'),
  debris: svg('<path d="M8 2.4v3M8 10.6v3M2.4 8h3M10.6 8h3M4 4l2 2M10 10l2 2M12 4l-2 2M6 10l-2 2"/>'),
  other: svg('<rect x="6" y="6" width="4" height="4" rx=".8"/><path d="M2.4 6.2h2.4v3.6H2.4zM11.2 6.2h2.4v3.6h-2.4zM4.8 8H6M10 8h1.2"/>'),
}

type Kind = keyof typeof KINDS

const KIND_OF: Readonly<Record<string, Kind>> = {
  spacex: 'comms',
  oneweb: 'comms',
  iridium: 'comms',
  geo: 'comms',
  gps: 'nav',
  galileo: 'nav',
  china: 'nav',
  glonass: 'nav',
  eo: 'eo',
  weather: 'weather',
  stations: 'station',
  science: 'science',
  nasa: 'science',
  debris: 'debris',
  other: 'other',
}

/** Small mission-type glyph tinted with the operator's colour. */
export function glyph(operatorIndex: number, extraClass = ''): HTMLElement {
  const op = OPERATORS[operatorIndex]
  const el = h('span', { class: `glyph ${extraClass}`.trim(), 'aria-hidden': 'true', style: { '--c': op.color } })
  el.innerHTML = KINDS[KIND_OF[op.id] ?? 'other'] // constant markup only
  return el
}
