import { BODIES } from '../data/bodies'
import { fmt, h } from './dom'

/** Left nav for the solar-system view: Sun and planets, with their live distance from the Sun. */
export class BodiesNav {
  private readonly rows = new Map<string, { btn: HTMLButtonElement; dist: HTMLElement }>()

  constructor(root: HTMLElement, onPick: (id: string) => void, onPreset: (kind: 'inner' | 'outer' | 'whole') => void, onEarth: () => void) {
    root.replaceChildren(
      h('div', { class: 'fhead' }, h('span', { class: 'ftitle' }, 'Bodies')),
      h('button', { class: 'backearth', onClick: onEarth, title: 'Return to the satellite view of Earth' }, '← Satellite view'),
      h('div', { class: 'segs ftabs' },
        ...([['inner', 'Inner'], ['outer', 'Outer'], ['whole', 'All']] as const).map(([k, label]) => h('button', { class: 'seg', title: `Show the ${label.toLowerCase()} planets`, onClick: () => onPreset(k) }, label))),
      h('p', { class: 'fhelp' }, 'Click a world, here or in space, to fly to it. ← → visits the next one.'),
      ...BODIES.map((b) => {
        const dist = h('em', {}, b.id === 'sun' ? '' : '–')
        const btn = h('button', { class: 'fleet', style: { '--c': b.color }, onClick: () => onPick(b.id), title: `${b.name}. Click to fly there.` }, h('span', { class: 'orb' }), h('span', { class: 'nm' }, b.name), dist)
        this.rows.set(b.id, { btn, dist })
        return btn
      }),
    )
  }

  setFocus(id: string): void {
    for (const [k, r] of this.rows) {
      r.btn.classList.toggle('on', k === id)
      r.btn.setAttribute('aria-pressed', String(k === id))
    }
  }

  /** distances in AU from the Sun */
  setDistances(au: (id: string) => number): void {
    for (const [id, r] of this.rows) if (id !== 'sun') r.dist.textContent = `${fmt(au(id), au(id) < 10 ? 2 : 1)} AU`
  }
}
