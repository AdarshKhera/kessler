import type { Fact } from '../lib/facts'
import { clear, h } from './dom'
import { SUPPORT_URL } from '../config'
import { trapFocus } from './focus'
import { icons } from './icons'

export type SourceState = 'live' | 'cache' | 'snapshot' | 'offline' | 'local'

export interface SourceStatus {
  readonly name: string
  readonly what: string
  readonly state: SourceState
  readonly detail: string
  readonly href?: string
}

export interface GuideContext {
  facts(): Fact[]
  sources(): SourceStatus[]
  replayTour(): void
}

type Tab = 'facts' | 'how' | 'data' | 'credits'

const HOW: readonly (readonly [string, string])[] = [
  ['Drag', 'Turn the Earth. Scroll or pinch to zoom.'],
  ['Hover', 'Point at a dot to light up its whole fleet.'],
  ['Click', 'Inspect a satellite: orbit, ground track, neighbours, close approaches.'],
  ['/', 'Search by name, fleet or NORAD number.'],
  ['+  −', 'Zoom in and out. R resets the view.'],
  ['Space', 'Pause or resume time. Use 10×, 60× or 300× to watch orbits unfold.'],
  ['Esc', 'Close whatever is open.'],
]

const STATE_LABEL: Readonly<Record<SourceState, string>> = {
  live: 'Live',
  cache: 'Cached',
  snapshot: 'Snapshot',
  offline: 'Offline',
  local: 'In your browser',
}

export class Guide {
  private readonly shell = h('div', { class: 'overlay', hidden: true })
  private readonly body = h('div', { class: 'sheet-body' })
  private readonly tabs = new Map<Tab, HTMLButtonElement>()
  private tab: Tab = 'facts'
  private release: (() => void) | null = null

  constructor(mount: HTMLElement, private readonly ctx: GuideContext) {
    const segs = h('div', { class: 'segs wide' })
    for (const [key, label] of [['facts', 'Facts'], ['how', 'How to'], ['data', 'Data'], ['credits', 'Credits']] as const) {
      const b = h('button', { class: 'seg', onClick: () => this.go(key) }, label)
      this.tabs.set(key, b)
      segs.append(b)
    }
    const close = h('button', { class: 'x', 'aria-label': 'Close', onClick: () => this.close() })
    const ico = h('span', { class: 'ico' })
    ico.innerHTML = icons.close // constant markup
    close.append(ico)
    this.shell.append(
      h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Guide' },
        close,
        h('h2', {}, 'Kessler'),
        h('p', { class: 'lede' }, 'A live map of everything in orbit, calculated in your browser from public tracking data.'),
        segs,
        this.body,
        h('div', { class: 'sheet-foot' },
          h('button', { class: 'link', onClick: () => { this.close(); ctx.replayTour() } }, 'Replay the tour'),
          h('span', {}, 'Created by Adarsh Khera'))),
    )
    this.shell.addEventListener('pointerdown', (e) => {
      if (e.target === this.shell) this.close()
    })
    mount.append(this.shell)
  }

  get isOpen(): boolean {
    return !this.shell.hidden
  }

  open(tab: Tab = 'facts'): void {
    this.shell.hidden = false
    this.go(tab)
    this.release?.()
    this.release = trapFocus(this.shell, this.tabs.get(tab))
  }

  close(): void {
    this.shell.hidden = true
    this.release?.()
    this.release = null
  }

  /** Re-render if showing, e.g. when launch data arrives. */
  refresh(): void {
    if (this.isOpen) this.go(this.tab)
  }

  private go(tab: Tab): void {
    this.tab = tab
    for (const [k, b] of this.tabs) {
      b.classList.toggle('on', k === tab)
      b.setAttribute('aria-pressed', String(k === tab))
    }
    clear(this.body)
    if (tab === 'facts') this.body.append(...this.ctx.facts().map((f) => h('article', { class: 'fact' }, h('small', {}, f.kicker), h('h3', {}, f.title), h('p', {}, f.body))))
    else if (tab === 'how') this.body.append(h('dl', { class: 'how' }, ...HOW.flatMap(([k, v]) => [h('dt', {}, h('kbd', {}, k)), h('dd', {}, v)])))
    else if (tab === 'data') this.data()
    else this.credits()
  }

  private credits(): void {
    const link = (label: string, href: string) => h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, label)
    const item = (name: string, href: string, by: string, licence: string) =>
      h('div', { class: 'credit' }, h('span', {}, link(name, href), by ? ` · ${by}` : ''), h('em', {}, licence))
    this.body.append(
      h('article', { class: 'maker' },
        h('small', {}, 'Created by'),
        h('h3', {}, 'Adarsh Khera'),
        h('p', {}, 'A personal project, built for the love of looking up. Named after the Kessler syndrome, the idea from NASA scientist Donald Kessler that enough debris could make orbits unusable.'),
        h('p', { class: 'fine' }, link('github.com/AdarshKhera', 'https://github.com/AdarshKhera')),
        h('p', {}, h('a', { class: 'coffee-btn', href: SUPPORT_URL, target: '_blank', rel: 'noopener noreferrer' }, 'Buy me a coffee ☕'), h('span', { class: 'fine' }, '  Free, ad-free, made by one person.'))),
      h('h4', { class: 'cap' }, 'Open source'),
      h('div', { class: 'credits' },
        item('three.js', 'https://threejs.org', 'mrdoob and contributors', 'MIT'),
        item('satellite.js', 'https://github.com/shashwatak/satellite-js', 'Shashwat Kandadai and contributors', 'MIT'),
        item('d3-geo', 'https://github.com/d3/d3-geo', 'Mike Bostock', 'ISC'),
        item('topojson-client', 'https://github.com/topojson/topojson-client', 'Mike Bostock', 'ISC'),
        item('world-atlas', 'https://github.com/topojson/world-atlas', 'Mike Bostock', 'ISC'),
        item('Natural Earth', 'https://www.naturalearthdata.com', 'coastlines and borders', 'Public domain'),
        item('Vite', 'https://vite.dev', 'Evan You and contributors', 'MIT'),
        item('TypeScript', 'https://www.typescriptlang.org', 'Microsoft', 'Apache-2.0')),
      h('h4', { class: 'cap' }, 'Data'),
      h('div', { class: 'credits' },
        item('CelesTrak', 'https://celestrak.org', 'Dr. T.S. Kelso', 'Free to use'),
        item('Launch Library 2', 'https://thespacedevs.com/llapi', 'The Space Devs', 'Free tier')),
      h('p', { class: 'fine' }, 'Privacy: no accounts, no cookies, no analytics. Your browser stores only display preferences (and a cache of orbit data) on your own device. Requests go to CelesTrak and Launch Library only.'),
      h('p', { class: 'fine' }, 'Orbital element data originates from the US Space Force tracking network and is redistributed by CelesTrak. Inspired by stuffin.space and KeepTrack. Independent project: not affiliated with or endorsed by SpaceX, CelesTrak, NASA or any operator shown. Names and trademarks belong to their owners.'),
    )
  }

  private data(): void {
    const sources = this.ctx.sources()
    this.body.append(
      h('div', { class: 'steps' },
        ...[['1', 'Fetch', 'Orbital elements arrive from CelesTrak, a public tracking service.'], ['2', 'Calculate', 'Your browser predicts every position with the SGP4 model.'], ['3', 'Draw', 'About 16,000 points are drawn on the GPU, 60 times a second.']].map(([n, t, d]) =>
          h('div', {}, h('b', {}, n), h('h4', {}, t), h('p', {}, d)))),
      ...sources.map((s) =>
        h('article', { class: 'source' },
          h('div', { class: 'srow' }, h('h3', {}, s.href ? h('a', { href: s.href, target: '_blank', rel: 'noopener noreferrer' }, s.name) : s.name), h('span', { class: `state ${s.state}` }, STATE_LABEL[s.state])),
          h('p', {}, s.what),
          h('p', { class: 'fine' }, s.detail))),
      h('p', { class: 'fine pad' }, 'Orbit predictions from public data are good to about a kilometre when fresh and drift over days. Close approaches here are a rough screen, not a safety assessment.'),
    )
  }
}
