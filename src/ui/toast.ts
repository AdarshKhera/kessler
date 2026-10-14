import { h } from './dom'

/** Small transient message, announced to screen readers via role=status. */
export function toast(message: string, ms = 3800): void {
  const host = document.getElementById('toasts')
  if (!host) return
  const el = h('div', { class: 'toast' }, message)
  host.append(el)
  requestAnimationFrame(() => el.classList.add('in'))
  window.setTimeout(() => {
    el.classList.remove('in')
    window.setTimeout(() => el.remove(), 400)
  }, ms)
}
