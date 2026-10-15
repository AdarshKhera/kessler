import { BODIES } from '../data/bodies'
import type { MinorInfo } from '../scene/minor'
import { fmt, h } from './dom'

type Tab = 'worlds' | 'craft' | 'small'

const SMALL_ORDER: Readonly<Record<string, number>> = { comet: 0, interstellar: 1, asteroid: 2, dwarf: 3 }

/** Left nav for the solar-system view: planets, then spacecraft and small bodies from NASA/JPL data, with live distance from the Sun. */
export class BodiesNav {
  private readonly rows = new Map<string, { btn: HTMLButtonElement; dist: HTMLElement; tab: Tab }>()
  private readonly lists: Record<Tab, HTMLElement>
  private readonly tabButtons = new Map<Tab, HTMLButtonElement>()
  private readonly tabBar: HTMLElement
  private readonly dots: HTMLButtonElement
  private tab: Tab = 'worlds'
  private dotsOn = true

  constructor(
    root: HTMLElement,
    private readonly onPick: (id: string) => void,
    onPreset: (kind: 'inner' | 'outer' | 'whole') => void,
    onEarth: () => void,
    private readonly onDots: (on: boolean) => void = () => undefined,
  ) {
    this.lists = { worlds: h('div', { class: 'blist' }), craft: h('div', { class: 'blist' }), small: h('div', { class: 'blist' }) }
    this.lists.craft.hidden = this.lists.small.hidden = true
    for (const b of BODIES) this.lists.worlds.append(this.row(b.id, b.name, b.color, 'worlds', b.id === 'sun' ? '' : '–'))
    this.tabBar = h('div', { class: 'segs ftabs btabs', hidden: true },
      ...([['worlds', 'Worlds'], ['craft', 'Craft'], ['small', 'Comets']] as const).map(([k, label]) => {
        const btn = h('button', { class: 'seg', title: { worlds: 'Sun and planets', craft: 'NASA and partner spacecraft', small: 'Comets, asteroids and dwarf planets' }[k], onClick: () => this.show(k) }, label)
        this.tabButtons.set(k, btn)
        return btn
      }))
    this.dots = h('button', { class: 'dotstoggle', 'aria-pressed': 'true', title: 'Thousands of unnamed asteroids and comets drawn as dots', onClick: () => this.toggleDots() }, 'Hide asteroid dots')
    this.dots.hidden = true
    root.replaceChildren(
      h('div', { class: 'fhead' }, h('span', { class: 'ftitle' }, 'Bodies')),
      h('button', { class: 'backearth', onClick: onEarth, title: 'Return to the satellite view of Earth' }, '← Satellite view'),
      h('div', { class: 'segs ftabs' },
        ...([['inner', 'Inner'], ['outer', 'Outer'], ['whole', 'All']] as const).map(([k, label]) => h('button', { class: 'seg', title: `Show the ${label.toLowerCase()} planets`, onClick: () => onPreset(k) }, label))),
      this.tabBar,
      h('p', { class: 'fhelp' }, 'Click a world, here or in space, to fly to it. ← → visits the next one.'),
      this.lists.worlds,
      this.lists.craft,
      this.lists.small,
      this.dots,
    )
    this.show('worlds')
  }

  private row(id: string, name: string, color: string, tab: Tab, dist: string): HTMLButtonElement {
    const em = h('em', {}, dist)
    const btn = h('button', { class: 'fleet', style: { '--c': color }, onClick: () => this.onPick(id), title: `${name}. Click to fly there.` }, h('span', { class: 'orb' }), h('span', { class: 'nm' }, name), em)
    this.rows.set(id, { btn, dist: em, tab })
    return btn
  }

  /** Spacecraft and small bodies arrive after the planets, once their data files have loaded. */
  setSpace(list: readonly MinorInfo[]): void {
    if (list.length === 0 || this.tabBar.hidden === false) return
    const craft = list.filter((m) => m.kind === 'probe')
    const small = list.filter((m) => m.kind !== 'probe').sort((a, b) => (SMALL_ORDER[a.kind] ?? 9) - (SMALL_ORDER[b.kind] ?? 9))
    for (const m of craft) this.lists.craft.append(this.row(m.id, m.name, m.color, 'craft', '–'))
    for (const m of small) this.lists.small.append(this.row(m.id, m.name, m.color, 'small', '–'))
    this.tabBar.hidden = false
    this.dots.hidden = false
    this.show(this.tab)
  }

  private show(tab: Tab): void {
    this.tab = tab
    for (const [k, list] of Object.entries(this.lists)) list.hidden = k !== tab
    for (const [k, btn] of this.tabButtons) {
      btn.classList.toggle('on', k === tab)
      btn.setAttribute('aria-pressed', String(k === tab))
    }
    this.dots.hidden = this.tabBar.hidden || tab !== 'small'
  }

  private toggleDots(): void {
    this.dotsOn = !this.dotsOn
    this.dots.textContent = this.dotsOn ? 'Hide asteroid dots' : 'Show asteroid dots'
    this.dots.setAttribute('aria-pressed', String(this.dotsOn))
    this.onDots(this.dotsOn)
  }

  setFocus(id: string): void {
    for (const [k, r] of this.rows) {
      r.btn.classList.toggle('on', k === id)
      r.btn.setAttribute('aria-pressed', String(k === id))
    }
    const tab = this.rows.get(id)?.tab
    if (tab && !this.tabBar.hidden && tab !== this.tab) this.show(tab)
  }

  /** distances in AU from the Sun */
  setDistances(au: (id: string) => number): void {
    for (const [id, r] of this.rows) {
      if (id === 'sun' || r.tab !== this.tab) continue
      const d = au(id)
      r.dist.textContent = `${fmt(d, d < 10 ? 2 : d < 100 ? 1 : 0)} AU`
    }
  }
}
