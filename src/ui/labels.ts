import { h } from './dom'
import type { LabelPoint } from '../scene/solar'

/** Floating, clickable body names that follow their worlds across the screen. */
export class Labels {
  private readonly els = new Map<string, HTMLButtonElement>()

  constructor(private readonly root: HTMLElement, private readonly onPick: (id: string) => void) {}

  clear(): void {
    this.root.replaceChildren()
    this.els.clear()
  }

  update(points: readonly LabelPoint[], focusId: string): void {
    const seen = new Set<string>()
    for (const p of points) {
      seen.add(p.id)
      let el = this.els.get(p.id)
      if (!el) {
        el = h('button', { class: `plabel ${p.kind}`, onClick: () => this.onPick(p.id) }, p.name)
        this.els.set(p.id, el)
        this.root.append(el)
      }
      el.hidden = !p.visible
      el.classList.toggle('on', p.id === focusId)
      if (p.visible) el.style.transform = `translate(${p.x + 10}px, ${p.y - 8}px)`
    }
    for (const [id, el] of this.els) {
      if (!seen.has(id)) {
        el.remove()
        this.els.delete(id)
      }
    }
  }
}
