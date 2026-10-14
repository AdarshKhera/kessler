import { h } from './dom'
import { icons } from './icons'

export type LayerKey = 'rings' | 'borders' | 'rotate'
export type Layers = Readonly<Record<LayerKey, boolean>>

export interface DockActions {
  zoom(factor: number): void
  reset(): void
  layer(key: LayerKey, on: boolean): void
}

const KEY = 'kessler.layers.v1'
export const DEFAULT_LAYERS: Layers = { rings: true, borders: true, rotate: true }

export function readLayers(): Layers {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Layers> | null
    return { ...DEFAULT_LAYERS, ...(raw ?? {}) }
  } catch {
    return DEFAULT_LAYERS
  }
}

const LABELS: readonly (readonly [LayerKey, string, string])[] = [
  ['rings', 'Orbit rings', 'LEO, MEO and GEO guides'],
  ['borders', 'Country borders', 'On the globe surface'],
  ['rotate', 'Auto-rotate', 'Slow spin when idle'],
]

const ico = (markup: string): HTMLElement => {
  const s = h('span', { class: 'ico' })
  s.innerHTML = markup // constant markup from icons.ts only
  return s
}

/** Zoom, reset and layer controls. */
export class Dock {
  private layers: Layers
  private readonly menu = h('div', { class: 'menu', hidden: true, role: 'group', 'aria-label': 'Layers' })
  private readonly layerBtn = h('button', { class: 'round', 'aria-label': 'Layers', 'aria-expanded': 'false', title: 'Layers' }, ico(icons.layers))
  private readonly switches = new Map<LayerKey, HTMLButtonElement>()

  constructor(root: HTMLElement, private readonly actions: DockActions, initial: Layers) {
    this.layers = initial
    for (const [key, label, hint] of LABELS) {
      const sw = h('button', { class: 'switch', role: 'switch', 'aria-checked': String(initial[key]), onClick: () => this.flip(key) },
        h('span', {}, h('b', {}, label), h('small', {}, hint)), h('i'))
      this.switches.set(key, sw)
      this.menu.append(sw)
    }
    this.layerBtn.addEventListener('click', () => this.toggleMenu())
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.menu.hidden) {
        e.stopPropagation()
        this.toggleMenu(false)
        this.layerBtn.focus()
      }
    })
    document.addEventListener('pointerdown', (e) => {
      if (!this.menu.hidden && !root.contains(e.target as Node)) this.toggleMenu(false)
    })
    root.replaceChildren(
      this.menu,
      h('div', { class: 'cluster' },
        h('button', { class: 'round', 'aria-label': 'Zoom in', title: 'Zoom in (+)', onClick: () => actions.zoom(0.8) }, ico(icons.plus)),
        h('button', { class: 'round', 'aria-label': 'Zoom out', title: 'Zoom out (-)', onClick: () => actions.zoom(1.25) }, ico(icons.minus)),
        h('button', { class: 'round', 'aria-label': 'Reset view', title: 'Reset view (R)', onClick: actions.reset }, ico(icons.home)),
        this.layerBtn),
    )
    for (const [key] of LABELS) this.actions.layer(key, initial[key])
  }

  private flip(key: LayerKey): void {
    this.layers = { ...this.layers, [key]: !this.layers[key] }
    this.switches.get(key)!.setAttribute('aria-checked', String(this.layers[key]))
    this.actions.layer(key, this.layers[key])
    try {
      localStorage.setItem(KEY, JSON.stringify(this.layers))
    } catch {
      // best-effort
    }
  }

  private toggleMenu(open = this.menu.hidden): void {
    this.menu.hidden = !open
    this.layerBtn.setAttribute('aria-expanded', String(open))
  }
}
