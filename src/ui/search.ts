import { OPERATORS } from '../data/registry'
import type { Sat } from '../data/types'
import { clear, h } from './dom'
import { glyph } from './glyphs'
import { trapFocus } from './focus'
import { icons } from './icons'

export interface SearchActions {
  pickSat(index: number): void
  pickFleet(operator: number): void
  pickCountry(code: string): void
  countries(): readonly { code: string; name: string; flag: string; count: number }[]
}

interface Result {
  readonly label: string
  readonly hint: string
  readonly operator?: number
  readonly flag?: string
  readonly run: () => void
}

const MAX = 8

export class Search {
  private readonly input = h('input', { type: 'search', placeholder: 'Search satellites, fleets or NORAD numbers', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Search', role: 'combobox', 'aria-controls': 'search-results', 'aria-expanded': 'true', 'aria-autocomplete': 'list' })
  private readonly list = h('div', { class: 'results', role: 'listbox', id: 'search-results' })
  private readonly shell = h('div', { class: 'overlay', hidden: true })
  private results: Result[] = []
  private buttons: HTMLElement[] = []
  private active = 0
  private release: (() => void) | null = null

  constructor(
    mount: HTMLElement,
    private readonly sats: readonly Sat[],
    private readonly actions: SearchActions,
  ) {
    const field = h('div', { class: 'field' }, this.icon(), this.input)
    this.shell.append(h('div', { class: 'spot', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Search' }, field, this.list))
    this.shell.addEventListener('pointerdown', (e) => {
      if (e.target === this.shell) this.close()
    })
    this.input.addEventListener('input', () => this.refresh())
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') this.move(1, e)
      else if (e.key === 'ArrowUp') this.move(-1, e)
      else if (e.key === 'Enter' && !e.isComposing) this.results[this.active]?.run()
    })
    mount.append(this.shell)
  }

  private icon(): HTMLElement {
    const s = h('span', { class: 'ico' })
    s.innerHTML = icons.search // constant markup
    return s
  }

  get isOpen(): boolean {
    return !this.shell.hidden
  }

  open(): void {
    this.shell.hidden = false
    this.input.value = ''
    this.refresh()
    this.release?.()
    this.release = trapFocus(this.shell, this.input)
  }

  close(): void {
    this.shell.hidden = true
    this.release?.()
    this.release = null
  }

  private move(delta: number, e: Event): void {
    e.preventDefault()
    if (this.results.length === 0) return
    this.active = (this.active + delta + this.results.length) % this.results.length
    this.paint()
  }

  private refresh(): void {
    const q = this.input.value.trim().toLowerCase()
    const out: Result[] = []
    if (q) {
      OPERATORS.forEach((op, i) => {
        if (op.name.toLowerCase().includes(q)) out.push({ label: op.name, hint: 'Fleet', operator: i, run: () => this.pickFleet(i) })
      })
      for (const c of this.actions.countries()) {
        if (c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q)
          out.push({ label: c.name, hint: `Country · ${c.count}`, flag: c.flag, run: () => this.pickCountry(c.code.toLowerCase()) })
      }
      for (const s of this.sats) {
        if (out.length >= MAX) break
        if (s.name.toLowerCase().includes(q) || String(s.id) === q)
          out.push({ label: s.name, hint: String(s.id), operator: s.operatorIndex, run: () => this.pickSat(s.index) })
      }
    } else {
      for (const name of ['ISS (ZARYA)', 'HST', 'CSS (TIANHE)', 'ASTROSAT']) {
        const s = this.sats.find((x) => x.name === name)
        if (s) out.push({ label: s.name, hint: 'Try', operator: s.operatorIndex, run: () => this.pickSat(s.index) })
      }
    }
    this.results = out.slice(0, MAX)
    this.active = 0
    this.paint()
  }

  private pickSat(i: number): void {
    this.close()
    this.actions.pickSat(i)
  }

  private pickCountry(code: string): void {
    this.close()
    this.actions.pickCountry(code)
  }

  private pickFleet(i: number): void {
    this.close()
    this.actions.pickFleet(i)
  }

  private paint(): void {
    clear(this.list)
    if (this.results.length === 0 && this.input.value.trim()) {
      this.list.append(h('p', { class: 'muted pad' }, 'No match.'))
      return
    }
    this.buttons = this.results.map((r, i) =>
      h('button', { class: 'res', id: `res-${i}`, role: 'option', 'aria-selected': 'false', onMouseenter: () => { this.active = i; this.highlight() }, onClick: r.run },
        r.flag ? h('span', { class: 'flag', 'aria-hidden': 'true' }, r.flag) : glyph(r.operator ?? 0), h('span', { class: 'nm' }, r.label), h('em', {}, r.hint)),
    )
    this.list.append(...this.buttons)
    this.highlight()
  }

  private highlight(): void {
    this.buttons.forEach((b, i) => {
      b.classList.toggle('on', i === this.active)
      b.setAttribute('aria-selected', String(i === this.active))
    })
    if (this.buttons[this.active]) this.input.setAttribute('aria-activedescendant', `res-${this.active}`)
    else this.input.removeAttribute('aria-activedescendant')
  }
}
