import { h } from './dom'

export interface TourStep {
  readonly title: string
  readonly body: string
  /** CSS selector of the element to highlight */
  readonly target?: string
  readonly enter?: () => void
  readonly leave?: () => void
}

const KEY = 'kessler.toured.v1'

export const hasToured = (): boolean => {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

const markToured = (): void => {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    // best-effort
  }
}

export class Tour {
  private readonly card = h('div', { class: 'tour', hidden: true, role: 'dialog', 'aria-label': 'Tour' })
  private i = -1
  private lit: Element | null = null

  constructor(mount: HTMLElement, private readonly steps: readonly TourStep[], private readonly onDone: () => void) {
    mount.append(this.card)
  }

  get isRunning(): boolean {
    return this.i >= 0
  }

  start(): void {
    this.go(0)
  }

  private go(next: number): void {
    if (this.i >= 0) this.steps[this.i].leave?.()
    this.lit?.classList.remove('tour-hl')
    this.lit = null
    if (next >= this.steps.length) return this.finish()
    this.i = next
    const step = this.steps[next]
    step.enter?.()
    if (step.target) {
      this.lit = document.querySelector(step.target)
      this.lit?.classList.add('tour-hl')
    }
    const last = next === this.steps.length - 1
    this.card.replaceChildren(
      h('small', {}, `${next + 1} of ${this.steps.length}`),
      h('h3', {}, step.title),
      h('p', {}, step.body),
      h('div', { class: 'tour-actions' },
        last ? h('span') : h('button', { class: 'link', onClick: () => this.finish() }, 'Skip'),
        h('div', { class: 'dots' }, ...this.steps.map((_, k) => h('i', { class: k === next ? 'on' : '' }))),
        h('button', { class: 'primary', onClick: () => this.go(next + 1) }, last ? 'Done' : 'Next')),
    )
    this.card.hidden = false
    this.card.querySelector<HTMLElement>('.primary')?.focus({ preventScroll: true })
  }

  finish(): void {
    if (this.i >= 0) this.steps[this.i].leave?.()
    this.lit?.classList.remove('tour-hl')
    this.lit = null
    this.i = -1
    this.card.hidden = true
    markToured()
    this.onDone()
  }
}
