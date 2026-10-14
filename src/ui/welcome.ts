import { SUPPORT_URL } from '../config'
import { h } from './dom'
import { trapFocus } from './focus'

/** First-visit explainer: what this is, what you can do, where the data comes from. */
export class Welcome {
  private readonly shell = h('div', { class: 'overlay', hidden: true })
  private release: (() => void) | null = null

  constructor(
    mount: HTMLElement,
    private readonly onTour: () => void,
  ) {
    const block = (title: string, body: string) => h('div', { class: 'wblock' }, h('h3', {}, title), h('p', {}, body))
    const start = h('button', { class: 'primary big', onClick: () => this.finish(true) }, 'Take the 30-second tour')
    const skip = h('button', { class: 'link', onClick: () => this.finish(false) }, 'Just let me explore')
    const sheet = h('div', { class: 'sheet welcome', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Welcome' })
    sheet.append(
      h('small', { class: 'kick' }, 'Welcome'),
      h('h2', {}, 'Everything above you, live.'),
      block('What you are looking at', 'Real satellites, space stations and pieces of debris, each placed where it is right now from public tracking data. Nothing is pre-recorded.'),
      block('What you can do', 'Tap or click a dot to inspect it, and hover to preview its fleet. Filter by fleet or country, speed up time, or zoom out of Earth for a tour of the solar system.'),
      block('Where it comes from', 'Orbits come from CelesTrak and launch times from Launch Library 2. All the maths runs in your browser, and the Guide lists every source.'),
      h('div', { class: 'wactions' }, start, skip),
      h('p', { class: 'wcoffee' }, 'Free, ad-free and made by one person. ', h('a', { href: SUPPORT_URL, target: '_blank', rel: 'noopener noreferrer' }, 'Buy me a coffee ☕')),
    )
    this.shell.append(sheet)
    mount.append(this.shell)
  }

  get isOpen(): boolean {
    return !this.shell.hidden
  }

  open(): void {
    this.shell.hidden = false
    this.release?.()
    this.release = trapFocus(this.shell, this.shell.querySelector<HTMLElement>('.primary') ?? undefined)
  }

  /** `tour` true starts the guided tour; false just closes. */
  finish(tour: boolean): void {
    if (this.shell.hidden) return
    this.shell.hidden = true
    this.release?.()
    this.release = null
    try {
      localStorage.setItem('kessler.welcomed.v1', '1')
    } catch {
      // best-effort
    }
    if (tour) this.onTour()
  }
}

export const hasWelcomed = (): boolean => {
  try {
    return localStorage.getItem('kessler.welcomed.v1') === '1'
  } catch {
    return false
  }
}
