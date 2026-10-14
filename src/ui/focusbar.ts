import { h } from './dom'
import { icons } from './icons'

export type FocusKind = 'idle' | 'sat' | 'fleet' | 'country' | 'body' | 'solar-idle'

export interface FocusInfo {
  readonly kind: FocusKind
  readonly label: string
  readonly detail?: string
  readonly icon?: HTMLElement
  readonly hint?: string
}

const touch = (): boolean => typeof matchMedia === 'function' && matchMedia('(hover: none)').matches

const HINTS = (): Readonly<Record<FocusKind, string>> =>
  touch()
    ? {
        idle: 'Tap a dot to inspect it · Drag to rotate · Pinch to zoom',
        sat: 'Tap Clear to go back. Only its fleet-mates can be tapped.',
        fleet: 'Everything else is dimmed. Taps work inside this view only.',
        country: 'Everything else is dimmed. Taps work inside this view only.',
        body: 'Drag to orbit · pinch to zoom · Clear for the whole system',
        'solar-idle': 'Tap a planet or its name · Drag to rotate · Pinch to zoom out to Pluto',
      }
    : {
        idle: 'Hover a dot to preview its fleet · Click to inspect · Drag to rotate',
        sat: 'Hover shows only its fleet-mates. Esc or Clear to go back.',
        fleet: 'Everything else is dimmed. Hover and click work inside this view only.',
        country: 'Everything else is dimmed. Hover and click work inside this view only.',
        body: 'Drag to orbit it, scroll to zoom. Pick another world on the left, or Clear to see the whole system.',
        'solar-idle': 'Click a planet or a name · Drag to rotate · Scroll to zoom out to Pluto',
      }

/** Always-visible statement of what you are looking at, with the one obvious way out. */
export class FocusBar {
  private readonly title = h('b')
  private readonly detail = h('span')
  private readonly iconSlot = h('span', { class: 'fb-icon' })
  private readonly hint = h('p', { class: 'fb-hint' })
  private readonly pill: HTMLElement
  private readonly root: HTMLElement

  constructor(root: HTMLElement, onClear: () => void) {
    this.root = root
    const clear = h('button', { class: 'fb-clear', onClick: onClear }, h('span', {}, 'Clear'), this.ico())
    this.pill = h('div', { class: 'fb-pill', hidden: true }, this.iconSlot, h('div', { class: 'fb-text' }, this.title, this.detail), clear)
    root.replaceChildren(this.pill, this.hint)
  }

  private ico(): HTMLElement {
    const s = h('span', { class: 'ico' })
    s.innerHTML = icons.close // constant markup
    return s
  }

  set(info: FocusInfo): void {
    const active = info.kind !== 'idle' && info.kind !== 'solar-idle'
    this.pill.hidden = !active
    this.title.textContent = info.label
    this.detail.textContent = info.detail ?? ''
    this.iconSlot.replaceChildren(...(info.icon ? [info.icon] : []))
    this.hint.textContent = info.hint ?? HINTS()[info.kind]
    this.hint.dataset.kind = info.kind
    this.root.dataset.kind = info.kind
  }
}
