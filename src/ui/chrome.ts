import { OPERATORS } from '../data/registry'
import type { Sat } from '../data/types'
import type { CountryRow } from '../lib/countries'
import { fmt, h } from './dom'
import { glyph } from './glyphs'
import { icons } from './icons'

export interface ChromeActions {
  openSearch(): void
  openGuide(): void
  openData(): void
  fleet(operator: number): void
  fleetHover(operator: number): void
  country(code: string): void
  countryHover(code: string): void
  clearFocus(): void
  setWarp(warp: number): void
  togglePause(): void
  live(): void
}

const EARTH_WARPS = [10, 60, 300]
// solar system: simulated seconds per real second (a day, ten days, a year)
const SOLAR_WARPS = [86_400, 864_000, 31_557_600]
const SOLAR_LABELS = ['1 d/s', '10 d/s', '1 yr/s']
const COLLAPSE_KEY = 'kessler.fleets.collapsed'
const MODE_KEY = 'kessler.nav.mode'

export type NavMode = 'fleets' | 'countries'

const readMode = (): NavMode => {
  try {
    return localStorage.getItem(MODE_KEY) === 'countries' ? 'countries' : 'fleets'
  } catch {
    return 'fleets'
  }
}

const readCollapsed = (): boolean => {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

const iconEl = (markup: string): HTMLElement => {
  const s = h('span', { class: 'ico' })
  s.innerHTML = markup // constant markup from icons.ts only
  return s
}

/** The few floating controls: brand, search, guide, fleet and country nav, and the time pill. */
export class Chrome {
  private readonly count = h('span')
  private readonly sdot = h('i', { class: 'sdot ok' })
  private objectCount = 0
  private readonly clock = h('b')
  private readonly pause = h('button', { class: 'round', id: 'btn-pause', 'aria-label': 'Pause' })
  private readonly liveBtn = h('button', { class: 'seg on' }, 'Live')
  private readonly warpBtns: HTMLButtonElement[] = []
  private readonly chips = new Map<number, HTMLButtonElement>()
  private readonly countryItems = new Map<string, HTMLButtonElement>()
  private readonly fleetsNav: HTMLElement
  private readonly toggleBtn = h('button', { class: 'ftoggle' })
  private readonly clearBtn = h('button', { class: 'fclear', hidden: true }, 'Show all')
  private readonly fleetList = h('div', { class: 'flist fleets' })
  private readonly countryList = h('div', { class: 'flist countries' }, h('p', { class: 'muted pad' }, 'Loading country data…'))
  private readonly help = h('p', { class: 'fhelp' })
  private readonly tabBtns = new Map<NavMode, HTMLButtonElement>()
  private warps: number[] = [...EARTH_WARPS]
  private activeFleet = -1
  private activeCountry = ''
  private readonly fly = h('div', { id: 'fly', hidden: true }, h('b'), h('span'))
  readonly guideBtn = h('button', { class: 'round', id: 'btn-guide', 'aria-label': 'Guide and about' }, iconEl(icons.help))

  constructor(
    parts: { brand: HTMLElement; top: HTMLElement; fleets: HTMLElement; time: HTMLElement },
    sats: readonly Sat[],
    private readonly actions: ChromeActions,
    objectCount: number,
    status: { label: string; tone: 'ok' | 'warn' },
  ) {
    this.objectCount = objectCount
    this.sdot.className = `sdot ${status.tone}`
    this.count.textContent = `${fmt(objectCount)} objects · ${status.label}`
    parts.brand.replaceChildren(
      h('b', {}, 'Kessler'),
      h('button', { class: 'status', title: 'Positions are calculated live from real orbital data. Click for sources.', onClick: actions.openData }, this.sdot, this.count),
    )

    parts.top.replaceChildren(
      h('button', { class: 'pill', id: 'btn-search', onClick: actions.openSearch }, iconEl(icons.search), h('span', {}, 'Search'), h('kbd', {}, '/')),
      this.guideBtn,
    )
    this.guideBtn.addEventListener('click', actions.openGuide)

    this.fleetsNav = parts.fleets
    parts.fleets.parentElement?.append(this.fly)
    const counts = OPERATORS.map((_, i) => sats.filter((s) => s.operatorIndex === i).length)
    // SpaceX stays listed even when Starlink data is throttled: it still has launch data.
    const list = OPERATORS.map((op, i) => ({ op, i, n: counts[i] }))
      .filter((x) => x.n > 0 || x.op.id === 'spacex')
      .sort((a, b) => b.n - a.n)
    for (const { op, i, n } of list) {
      const b = this.item({
        color: op.color,
        label: op.name,
        count: n,
        short: op.short,
        icon: glyph(i),
        hint: n > 0 ? `${op.name}: ${fmt(n)} objects. Click to isolate on the globe.` : `${op.name}. Click for launches and info.`,
        onHover: (on) => actions.fleetHover(on ? i : -1),
        onClick: () => actions.fleet(i),
      })
      this.chips.set(i, b)
    }
    this.fleetList.append(...this.chips.values())

    this.toggleBtn.append(iconEl(icons.chevron), h('span', {}, 'Browse'))
    this.toggleBtn.addEventListener('click', () => this.setCollapsed(!this.collapsed, true))
    this.clearBtn.addEventListener('click', actions.clearFocus)
    const tabs = h('div', { class: 'segs ftabs' })
    for (const [mode, label] of [['fleets', 'Fleets'], ['countries', 'Countries']] as const) {
      const b = h('button', { class: 'seg', onClick: () => this.setMode(mode, true) }, label)
      this.tabBtns.set(mode, b)
      tabs.append(b)
    }
    parts.fleets.replaceChildren(h('div', { class: 'fhead' }, this.toggleBtn, this.clearBtn), tabs, this.help, this.fleetList, this.countryList)
    this.setMode(readMode(), false)
    this.setCollapsed(readCollapsed(), false)

    this.pause.addEventListener('click', actions.togglePause)
    this.liveBtn.addEventListener('click', actions.live)
    EARTH_WARPS.forEach((w, i) => {
      const b = h('button', { class: 'seg', onClick: () => actions.setWarp(this.warps[i]) }, `${w}×`)
      this.warpBtns.push(b)
    })
    parts.time.replaceChildren(this.pause, this.clock, h('div', { class: 'segs' }, this.liveBtn, ...this.warpBtns))
  }

  private item(o: {
    color: string
    label: string
    count: number
    short: string
    icon: HTMLElement
    hint: string
    onHover(on: boolean): void
    onClick(): void
  }): HTMLButtonElement {
    const b = h('button', {
      class: 'fleet',
      style: { '--c': o.color },
      onMouseenter: () => {
        o.onHover(true)
        this.reveal(b, o.label, o.count)
      },
      onMouseleave: () => {
        o.onHover(false)
        this.fly.hidden = true
      },
      onFocus: () => {
        o.onHover(true)
        this.reveal(b, o.label, o.count)
      },
      onBlur: () => {
        o.onHover(false)
        this.fly.hidden = true
      },
      onClick: o.onClick,
      title: o.hint,
    }, o.icon, h('b', { class: 'badge' }, o.short), h('span', { class: 'nm' }, o.label), h('em', {}, o.count > 0 ? fmt(o.count) : '–'))
    return b
  }

  /** Called once owner data has loaded. */
  setCountries(rows: readonly CountryRow[]): void {
    this.countryItems.clear()
    this.countryList.replaceChildren()
    for (const r of rows) {
      const flag = h('span', { class: 'flag', 'aria-hidden': 'true' }, r.flag)
      const b = this.item({
        color: '#9fd3ff',
        label: r.name,
        count: r.count,
        short: r.short,
        icon: flag,
        hint: `${r.name}: ${fmt(r.count)} objects. Click to isolate on the globe.`,
        onHover: (on) => this.actions.countryHover(on ? r.code.toLowerCase() : ''),
        onClick: () => this.actions.country(r.code.toLowerCase()),
      })
      this.countryItems.set(r.code.toLowerCase(), b)
      this.countryList.append(b)
    }
    this.setCountry(this.activeCountry)
  }

  /** Time speeds make sense differently for satellites (minutes) and planets (days). */
  setTimeMode(mode: 'earth' | 'solar'): void {
    this.warps = mode === 'earth' ? [...EARTH_WARPS] : [...SOLAR_WARPS]
    this.warpBtns.forEach((b, i) => {
      b.textContent = mode === 'earth' ? `${EARTH_WARPS[i]}×` : SOLAR_LABELS[i]
    })
  }

  setStatus(status: { label: string; tone: 'ok' | 'warn' }): void {
    this.sdot.className = `sdot ${status.tone}`
    this.count.textContent = `${fmt(this.objectCount)} objects · ${status.label}`
  }

  get mode(): NavMode {
    return this.fleetsNav.dataset.mode === 'countries' ? 'countries' : 'fleets'
  }

  setMode(mode: NavMode, persist = false): void {
    this.fleetsNav.dataset.mode = mode
    this.fleetList.hidden = mode !== 'fleets'
    this.countryList.hidden = mode !== 'countries'
    for (const [m, b] of this.tabBtns) {
      b.classList.toggle('on', m === mode)
      b.setAttribute('aria-pressed', String(m === mode))
    }
    this.help.textContent = mode === 'fleets' ? 'Click a fleet to isolate it on the globe and see its stats.' : 'Satellites by the country that owns them. Try India.'
    this.fly.hidden = true
    if (persist) {
      try {
        localStorage.setItem(MODE_KEY, mode)
      } catch {
        // best-effort
      }
    }
  }

  /** Collapsed rail only: floating label beside the hovered badge (fixed, so the nav's scroll never clips it). */
  private reveal(item: HTMLElement, name: string, count: number): void {
    if (!this.collapsed) return
    const r = item.getBoundingClientRect()
    this.fly.querySelector('b')!.textContent = name
    this.fly.querySelector('span')!.textContent = count > 0 ? `${fmt(count)} objects` : 'launches and info'
    this.fly.style.top = `${r.top + r.height / 2}px`
    this.fly.style.left = `${r.right + 10}px`
    this.fly.hidden = false
  }

  get collapsed(): boolean {
    return this.fleetsNav.classList.contains('collapsed')
  }

  setCollapsed(collapsed: boolean, persist = false): void {
    this.fleetsNav.classList.toggle('collapsed', collapsed)
    this.fly.hidden = true
    this.toggleBtn.setAttribute('aria-expanded', String(!collapsed))
    this.toggleBtn.title = collapsed ? 'Expand' : 'Collapse'
    if (persist) {
      try {
        localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
      } catch {
        // best-effort
      }
    }
  }

  private refreshClear(): void {
    this.clearBtn.hidden = this.activeFleet < 0 && this.activeCountry === ''
  }

  setFleet(operator: number): void {
    this.activeFleet = operator
    this.refreshClear()
    for (const [i, b] of this.chips) {
      b.classList.toggle('on', i === operator)
      b.setAttribute('aria-pressed', String(i === operator))
    }
  }

  setCountry(code: string): void {
    this.activeCountry = code
    this.refreshClear()
    for (const [c, b] of this.countryItems) {
      b.classList.toggle('on', c === code)
      b.setAttribute('aria-pressed', String(c === code))
    }
  }

  update(nowMs: number, warp: number, paused: boolean): void {
    const d = new Date(nowMs)
    this.clock.textContent = `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}  ${d.toISOString().slice(11, 19)} UTC`
    const live = !paused && warp === 1 && Math.abs(nowMs - Date.now()) < 3000
    this.liveBtn.classList.toggle('on', live)
    this.liveBtn.setAttribute('aria-pressed', String(live))
    this.warpBtns.forEach((b, i) => {
      const on = !paused && warp === this.warps[i]
      b.classList.toggle('on', on)
      b.setAttribute('aria-pressed', String(on))
    })
    this.pause.replaceChildren(iconEl(paused ? icons.play : icons.pause))
    this.pause.setAttribute('aria-label', paused ? 'Resume' : 'Pause')
  }
}
