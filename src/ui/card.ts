import { GROUPS, OPERATORS } from '../data/registry'
import type { LaunchInfo } from '../data/launches'
import { OBJECT_TYPE, OPS_STATUS, type SatcatRecord } from '../data/satcat'
import type { Sat } from '../data/types'
import type { Body, Moon } from '../data/bodies'
import type { Country, CountrySummary } from '../lib/countries'
import { lightMinutes } from '../lib/ephemeris'
import type { FleetSummary } from '../lib/fleet'
import type { OrbitSummary } from '../lib/orbit'
import type { Purpose } from '../lib/purpose'
import { modelSubsystems } from '../lib/subsystems'
import type { ConjunctionHit } from '../sim/protocol'
import { clear, fmt, h } from './dom'
import { glyph } from './glyphs'
import { icons } from './icons'

export interface CardActions {
  close(): void
  selectSat(index: number): void
  partner(index: number): void
  openFleet(operator: number): void
  share(): void
  enterEarth?(): void
}

export interface LiveSample {
  readonly altitudeKm: number
  readonly speedKmS: number
  readonly neighbors: readonly { index: number; distance: number }[]
}

const BASIS_NOTE: Readonly<Record<Purpose['basis'], string>> = {
  name: 'Based on the satellite’s name.',
  fleet: 'Based on its fleet. Public catalogues do not list purpose.',
  orbit: 'Inferred from its orbit. Public catalogues do not list purpose.',
}

export const FLEET_BLURB: Readonly<Record<string, string>> = {
  spacex: 'Starlink, the largest satellite constellation ever flown. Broadband from low orbit.',
  oneweb: 'Eutelsat OneWeb. Global broadband from about 1,200 km up.',
  gps: 'GPS, run by the US Space Force. Navigation from 20,200 km.',
  galileo: "Europe's own navigation system.",
  china: "BeiDou, China's navigation network, using three kinds of orbit.",
  glonass: "GLONASS, Russia's navigation system.",
  iridium: 'Cross-linked satellites that give phone coverage everywhere, poles included.',
  eo: 'Planet and Spire. Hundreds of small satellites imaging Earth and tracking ships and weather.',
  geo: 'Communications satellites parked at 35,786 km, fixed over one spot.',
  weather: 'Weather satellites watching clouds, storms and oceans.',
  stations: "Crewed stations: the ISS and China's Tiangong.",
  science: 'Telescopes and research missions.',
  debris: 'Fragments from two collisions and two anti-satellite tests. Each piece is a bullet.',
}

const when = (ms: number, now: number): string => {
  const d = ms - now
  if (d < -3_600_000) return 'launched'
  if (d < 0) return 'now'
  const h2 = d / 3_600_000
  if (h2 < 1) return `in ${Math.max(1, Math.round(d / 60_000))} min`
  if (h2 < 48) return `in ${Math.round(h2)} h`
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export class Card {
  private live = { alt: h('b'), spd: h('b'), nbrs: h('div', { class: 'list' }) }
  private conj = h('div', { class: 'list' })
  private satcat = h('div', { class: 'kv' })
  private launchBox = h('div', { class: 'launches' })
  private shownFleet = -1
  private nbrKey = ''
  private nbrEms = new Map<number, HTMLElement>()

  constructor(
    private readonly root: HTMLElement,
    private readonly sats: readonly Sat[],
    private readonly actions: CardActions,
  ) {}

  hide(): void {
    this.shownFleet = -1
    if (this.root.contains(document.activeElement)) document.getElementById('gl')?.focus()
    this.root.classList.remove('open')
    this.root.setAttribute('aria-hidden', 'true')
    this.root.inert = true
  }

  private show(...children: (Node | null)[]): void {
    const hadFocus = this.root.contains(document.activeElement)
    clear(this.root)
    this.root.append(
      h('button', { class: 'x share', 'aria-label': 'Copy link to this view', title: 'Copy link', onClick: () => this.actions.share() }, this.icon(icons.link)),
      h('button', { class: 'x', 'aria-label': 'Close', title: 'Close (Esc)', onClick: () => this.actions.close() }, this.icon(icons.close)),
      ...children.filter((c): c is Node => c !== null),
    )
    this.root.scrollTop = 0
    this.root.classList.add('open')
    this.root.setAttribute('aria-hidden', 'false')
    this.root.inert = false
    const title = this.root.querySelector('h2')
    title?.setAttribute('tabindex', '-1')
    if (hadFocus) title?.focus()
  }

  private icon(markup: string): HTMLElement {
    const span = h('span', { class: 'ico' })
    span.innerHTML = markup // constant markup from icons.ts only
    return span
  }

  showSat(sat: Sat, o: OrbitSummary, owner: Country | null = null, purpose: Purpose | null = null): void {
    this.shownFleet = -1
    const op = OPERATORS[sat.operatorIndex]
    this.live = { alt: h('b', {}, '–'), spd: h('b', {}, '–'), nbrs: h('div', { class: 'list' }) }
    this.nbrKey = ''
    this.nbrEms = new Map()
    this.conj = h('div', { class: 'list' }, h('p', { class: 'muted' }, 'Screening the next 3 hours…'))
    this.satcat = h('div', { class: 'kv' })
    const sub = modelSubsystems(sat.id, o)
    this.show(
      h('button', { class: 'eyebrow', onClick: () => this.actions.openFleet(sat.operatorIndex) },
        glyph(sat.operatorIndex), `${op.name} · ${GROUPS[sat.groupIndex].name}`, this.icon(icons.chevron)),
      h('h2', {}, sat.name),
      h('p', { class: 'sub' }, `NORAD ${sat.id} · ${o.regime} · ${o.decayRisk === 'LOW' ? 'stable orbit' : `decay risk ${o.decayRisk.toLowerCase()}`}`),
      purpose
        ? h('div', { class: 'purpose', style: { '--c': op.color } },
            h('small', {}, glyph(sat.operatorIndex), purpose.category),
            h('p', {}, purpose.line),
            h('span', { class: 'basis' }, BASIS_NOTE[purpose.basis]))
        : null,
      h('div', { class: 'stats' },
        this.stat(this.live.alt, 'km', 'altitude'),
        this.stat(this.live.spd, 'km/s', 'speed'),
        this.stat(h('b', {}, fmt(o.periodMin, 0)), 'min', 'per orbit'),
      ),
      h('p', { class: 'lede' }, `Circles Earth ${(1440 / o.periodMin).toFixed(1)} times a day on a ${o.inclinationDeg.toFixed(1)}° tilt.`),
      h('div', { class: 'legend', style: { '--c': op.color } },
        h('span', {}, h('i', { class: 'g orbit' }), 'Orbit'),
        h('span', {}, h('i', { class: 'g track' }), 'Ground track'),
        h('span', {}, h('i', { class: 'g cover' }), 'Coverage')),
      this.section('Orbit details', false,
        this.kv([
          ['Perigee', `${fmt(o.perigeeKm)} km`],
          ['Apogee', `${fmt(o.apogeeKm)} km`],
          ['Eccentricity', o.eccentricity.toFixed(5)],
          ['Element set age', `${fmt(o.epochAgeHours, 1)} h`],
          ['Designator', String(sat.omm.OBJECT_ID)],
          ...(owner ? ([['Country', `${owner.flag} ${owner.name}`]] as const) : []),
        ]),
        this.satcat),
      this.section('Nearby', false, this.live.nbrs),
      this.section('Close approaches', false, h('p', { class: 'muted' }, 'Closest passes in the next 3 hours among objects in similar orbits. Public orbits are only accurate to about a kilometre.'), this.conj),
      this.section('Health', false,
        h('p', { class: 'muted' }, 'Modelled, not telemetry. Nobody publishes real subsystem data.'),
        h('div', { class: 'bars' },
          ...sub.map((s) =>
            h('div', { class: 'bar' }, h('span', {}, s.label), h('div', { class: 'track' }, h('div', { class: `fill ${s.health < 70 ? 'warn' : ''}`, style: { width: `${s.health}%` } })), h('em', {}, String(s.health)))))),
    )
  }

  setSatcat(rec: SatcatRecord | null): void {
    clear(this.satcat)
    if (!rec) return
    this.kv(
      [
        ['Status', OPS_STATUS[rec.opsStatus] ?? 'Unknown'],
        ['Type', OBJECT_TYPE[rec.objectType] ?? rec.objectType],
        ['Owner code', rec.owner],
        ['Launched', rec.launchDate],
        ['Launch site', rec.launchSite],
        ['Radar size', rec.rcs === null ? 'n/a' : `${rec.rcs.toFixed(2)} m²`],
      ],
      this.satcat,
    )
  }

  updateLive(s: LiveSample): void {
    this.live.alt.textContent = fmt(s.altitudeKm)
    this.live.spd.textContent = s.speedKmS.toFixed(2)
    // rebuild rows only when the neighbour set changes, so hover, focus and clicks are never interrupted
    const key = s.neighbors.map((n) => n.index).sort((x, y) => x - y).join(',')
    if (key !== this.nbrKey) {
      this.nbrKey = key
      this.actions.partner(-1)
      clear(this.live.nbrs)
      this.nbrEms = new Map()
      for (const n of s.neighbors) {
        const row = this.satRow(n.index, `${fmt(n.distance)} km`)
        this.live.nbrs.append(row)
        this.nbrEms.set(n.index, row.lastElementChild as HTMLElement)
      }
      return
    }
    for (const n of s.neighbors) {
      const em = this.nbrEms.get(n.index)
      if (em) em.textContent = `${fmt(n.distance)} km`
    }
  }

  /** Decayed or unusable element set: no position to report. */
  noFix(): void {
    this.live.alt.textContent = '–'
    this.live.spd.textContent = '–'
    if (this.nbrKey !== 'nofix') {
      this.nbrKey = 'nofix'
      clear(this.live.nbrs)
      this.live.nbrs.append(h('p', { class: 'muted' }, 'No current position. This object has decayed or its element set is unusable.'))
    }
  }

  setConjunctions(hits: readonly ConjunctionHit[], scanned: number, nowMs: number): void {
    clear(this.conj)
    if (hits.length === 0) {
      this.conj.append(h('p', { class: 'muted' }, `No close passes among ${fmt(scanned)} objects in similar orbits.`))
      return
    }
    for (const hit of hits) {
      const dt = Math.max(0, hit.tcaMs - nowMs) / 60_000
      this.conj.append(this.satRow(hit.index, `${hit.missKm.toFixed(0)} km · ${Math.floor(dt / 60)}h ${String(Math.floor(dt % 60)).padStart(2, '0')}m`, hit.missKm < 25))
    }
  }

  showBody(body: Body, info: { sunAu: number; earthAu: number; moons: readonly Moon[] }): void {
    this.shownFleet = -1
    const kindLabel = { star: 'Star', planet: 'Planet', dwarf: 'Dwarf planet', moon: 'Moon' }[body.kind]
    const day = Math.abs(body.rotationHours)
    const dayText = day < 48 ? `${day.toFixed(day < 20 ? 1 : 0)} hours` : `${(day / 24).toFixed(day / 24 < 100 ? 1 : 0)} days`
    const yearText = body.periodDays === undefined ? '–' : body.periodDays < 700 ? `${Math.round(body.periodDays)} days` : `${(body.periodDays / 365.25).toFixed(body.periodDays / 365.25 < 100 ? 1 : 0)} years`
    this.liveBody = { sun: h('b'), earth: h('b') }
    this.setBodyDistances(info.sunAu, info.earthAu)
    const stats = [
      this.stat(h('b', {}, fmt(body.radiusKm)), 'km', 'radius'),
      this.stat(h('b', {}, dayText + (body.tilt > 90 ? ' ↺' : '')), '', body.tilt > 90 ? 'day, spins backwards' : 'day'),
      ...(body.id === 'sun' ? [] : [this.stat(h('b', {}, yearText), '', 'year')]),
      ...(body.id === 'sun' ? [] : [this.stat(this.liveBody.sun, 'AU', 'from the Sun')]),
      ...(body.id === 'sun' || body.id === 'earth' ? [] : [this.stat(this.liveBody.earth, 'AU', 'from Earth now')]),
    ]
    this.show(
      h('p', { class: 'eyebrow plain' }, h('span', { class: 'orb', style: { '--c': body.color } }), kindLabel),
      h('h2', {}, body.name),
      h('p', { class: 'lede' }, body.blurb),
      h('div', { class: 'stats two' }, ...stats),
      body.moons ? h('p', { class: 'sub' }, `Moons: ${body.moons}`) : null,
      this.section('Did you know', true, ...body.facts.map((f) => h('p', { class: 'fact-line' }, f))),
      info.moons.length > 0
        ? this.section('Main moons', body.id !== 'earth', ...info.moons.map((m) => h('div', { class: 'row static moon' }, h('span', { class: 'nm' }, m.name), h('em', {}, `${fmt(m.orbitKm)} km`))), h('p', { class: 'fine' }, 'Moon positions are exact for Earth’s Moon and illustrative for the others.'))
        : null,
      body.id === 'earth' && this.actions.enterEarth
        ? h('button', { class: 'primary wide', onClick: () => this.actions.enterEarth?.() }, 'Open satellite view')
        : null,
    )
  }

  private liveBody = { sun: h('b'), earth: h('b') }

  setBodyDistances(sunAu: number, earthAu: number): void {
    const f = (au: number) => `${au < 1 ? au.toFixed(3) : au < 10 ? au.toFixed(2) : au.toFixed(1)}`
    this.liveBody.sun.textContent = `${f(sunAu)}`
    this.liveBody.sun.title = `${lightMinutes(sunAu).toFixed(1)} light-minutes`
    this.liveBody.earth.textContent = f(earthAu)
    this.liveBody.earth.title = `${lightMinutes(earthAu).toFixed(1)} light-minutes`
  }

  showCountry(country: Country, s: CountrySummary): void {
    this.shownFleet = -1
    const empty = s.count === 0
    this.show(
      h('p', { class: 'eyebrow plain' }, h('span', { class: 'flag' }, country.flag), 'Country'),
      h('h2', {}, country.name),
      h('p', { class: 'lede' }, country.blurb ?? `Satellites registered to ${country.name} in the CelesTrak catalogue.`),
      empty
        ? h('p', { class: 'muted' }, 'No satellites loaded for this owner.')
        : h('div', { class: 'stats two' },
            this.stat(h('b', {}, fmt(s.count)), '', 'objects tracked'),
            this.stat(h('b', {}, `${s.sharePct < 1 ? s.sharePct.toFixed(1) : s.sharePct.toFixed(0)}%`), '', 'of everything shown'),
            this.stat(h('b', {}, fmt(s.medianAltitudeKm)), 'km', 'median altitude'),
            this.stat(h('b', {}, `${s.regimes.LEO} · ${s.regimes.MEO} · ${s.regimes.GEO}`), '', 'LEO · MEO · GEO')),
      s.families.length > 0
        ? this.section('Missions', true,
            h('div', { class: 'bars' },
              ...s.families.map((f) => h('div', { class: 'bar wide' }, h('span', {}, f.name), h('div', { class: 'track' }, h('div', { class: 'fill', style: { width: `${(f.count / s.families[0].count) * 100}%` } })), h('em', {}, fmt(f.count))))))
        : null,
      empty ? null : this.section(`All objects (${fmt(s.count)})`, false, h('div', { class: 'list' }, ...s.members.slice(0, 150).map((i) => this.satRow(i, String(this.sats[i].id)))),
        s.members.length > 150 ? h('p', { class: 'fine' }, `Showing 150 of ${fmt(s.members.length)}. Use search for the rest.`) : null),
    )
  }

  showFleet(operator: number, summary: FleetSummary, info: LaunchInfo | null, throttledUntil: number): void {
    this.shownFleet = operator
    const op = OPERATORS[operator]
    const groups = GROUPS.map((g, i) => ({ g, i, n: this.sats.filter((s) => s.groupIndex === i && s.operatorIndex === operator).length })).filter((x) => x.n > 0)
    this.launchBox = h('div', { class: 'launches' })
    const nowEmpty = summary.count === 0
    this.show(
      h('p', { class: 'eyebrow plain' }, glyph(operator), 'Fleet'),
      h('h2', {}, op.name),
      h('p', { class: 'lede' }, FLEET_BLURB[op.id] ?? ''),
      nowEmpty
        ? h('p', { class: 'muted' }, throttledUntil > Date.now()
            ? `Orbit data for this fleet is paused: CelesTrak throttled the request. Retrying after ${new Date(throttledUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
            : 'No orbit data loaded for this fleet.')
        : h('div', { class: 'stats two' },
            this.stat(h('b', {}, fmt(summary.count)), '', 'satellites'),
            this.stat(h('b', {}, fmt(summary.launches)), '', 'launches'),
            this.stat(h('b', {}, fmt(summary.medianAltitudeKm)), 'km', 'median altitude'),
            this.stat(h('b', {}, summary.latestLaunch ?? '–'), '', 'latest launch id')),
      summary.shells.length > 0 && summary.count > 0 ? this.section('Orbital shells', true, this.shells(summary)) : null,
      groups.length > 1 ? this.section('Constellations', true, ...groups.map((x) => h('div', { class: 'row static' }, h('span', { class: 'nm' }, x.g.name), h('em', {}, fmt(x.n))))) : null,
      op.id === 'spacex' ? this.section('Next launches', true, this.launchBox) : null,
    )
    if (op.id === 'spacex') this.setLaunches(info)
  }

  setLaunches(info: LaunchInfo | null): void {
    if (this.shownFleet < 0 || OPERATORS[this.shownFleet].id !== 'spacex') return
    clear(this.launchBox)
    if (!info || info.source === 'offline') {
      this.launchBox.append(h('p', { class: 'muted' }, info ? 'Launch Library is unreachable right now.' : 'Loading launch schedule…'))
      return
    }
    if (info.thisYear !== null) this.launchBox.append(h('p', { class: 'lede' }, `${fmt(info.thisYear)} SpaceX launches so far in ${new Date().getUTCFullYear()}.`))
    const now = Date.now()
    for (const l of info.upcoming.slice(0, 4))
      this.launchBox.append(h('div', { class: 'row static launch' }, h('span', { class: 'nm' }, l.name.replace('Falcon 9 Block 5 | ', '').replace('Falcon Heavy | ', 'FH · ')), h('em', {}, when(l.netMs, now))))
    if (info.upcoming.length === 0) this.launchBox.append(h('p', { class: 'muted' }, 'No upcoming launches listed.'))
    this.launchBox.append(h('p', { class: 'fine' }, `Launch Library 2 · ${info.source === 'cache' ? 'cached' : 'live'} · times can slip`))
  }

  private shells(s: FleetSummary): HTMLElement {
    const max = s.shells[0].count
    return h('div', { class: 'bars' },
      ...s.shells.map((sh) =>
        h('div', { class: 'bar wide' },
          h('span', {}, `${sh.inclinationDeg}° · ${fmt(sh.altitudeKm)} km`),
          h('div', { class: 'track' }, h('div', { class: 'fill', style: { width: `${(sh.count / max) * 100}%` } })),
          h('em', {}, fmt(sh.count)))))
  }

  private stat(value: HTMLElement, unit: string, label: string): HTMLElement {
    return h('div', { class: 'stat' }, h('div', {}, value, unit ? h('small', {}, unit) : null), h('span', {}, label))
  }

  private section(title: string, open: boolean, ...body: (Node | null)[]): HTMLElement {
    const d = h('details', { class: 'sec' }, h('summary', {}, title, this.icon(icons.chevron)), ...body.filter((b): b is Node => b !== null))
    if (open) d.setAttribute('open', '')
    return d
  }

  private kv(rows: readonly (readonly [string, string])[], into: HTMLElement = h('div', { class: 'kv' })): HTMLElement {
    for (const [k, v] of rows) into.append(h('div', {}, h('span', {}, k), h('b', {}, v)))
    return into
  }

  private satRow(index: number, trailing: string, hot = false): HTMLElement {
    const s = this.sats[index]
    return h('button', {
      class: `row ${hot ? 'hot' : ''}`,
      onMouseenter: () => this.actions.partner(index),
      onMouseleave: () => this.actions.partner(-1),
      onClick: () => this.actions.selectSat(index),
    }, glyph(s.operatorIndex), h('span', { class: 'nm' }, s.name), h('em', {}, trailing))
  }
}
