import { h } from './dom'

export type ViewMode = 'earth' | 'solar'

/** Earth | Solar System switch. Always visible so the extra dimension is never hidden. */
export class ModeSwitch {
  private readonly buttons = new Map<ViewMode, HTMLButtonElement>()

  constructor(root: HTMLElement, onPick: (mode: ViewMode) => void) {
    const segs = h('div', { class: 'segs modes', role: 'group', 'aria-label': 'View' })
    for (const [mode, label, hint] of [
      ['earth', 'Earth', 'Satellites and debris around Earth'],
      ['solar', 'Solar System', 'Planets, moons and the Sun'],
    ] as const) {
      const b = h('button', { class: 'seg', title: hint, onClick: () => onPick(mode) }, label)
      this.buttons.set(mode, b)
      segs.append(b)
    }
    root.replaceChildren(segs)
    this.set('earth')
  }

  set(mode: ViewMode): void {
    for (const [m, b] of this.buttons) {
      b.classList.toggle('on', m === mode)
      b.setAttribute('aria-pressed', String(m === mode))
    }
  }
}
