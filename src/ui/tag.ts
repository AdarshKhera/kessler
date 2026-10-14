import { OPERATORS } from '../data/registry'
import { h } from './dom'
import { glyph } from './glyphs'

/** Name label that follows the selected satellite across the globe. */
export class SatTag {
  private readonly name = h('b')
  private readonly icon = h('span', { class: 'tagicon' })
  private readonly el = h('div', { id: 'tag', hidden: true }, this.icon, this.name)

  constructor(mount: HTMLElement) {
    mount.append(this.el)
  }

  show(name: string, operatorIndex: number): void {
    this.name.textContent = name
    this.icon.replaceChildren(glyph(operatorIndex))
    this.el.style.setProperty('--c', OPERATORS[operatorIndex].color)
  }

  hide(): void {
    this.el.hidden = true
  }

  place(x: number, y: number, visible: boolean): void {
    this.el.hidden = !visible
    if (visible) this.el.style.transform = `translate(${x + 12}px, ${y - 12}px)`
  }
}
