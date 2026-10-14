const FOCUSABLE = 'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'
const BACKGROUND = ['brand', 'top', 'fleets', 'card', 'time', 'dock', 'foot', 'gl']

/** Make the page behind a dialog unreachable for keyboard and assistive tech. */
export function setBackgroundInert(on: boolean): void {
  for (const id of BACKGROUND) {
    const el = document.getElementById(id)
    if (!el) continue
    // the card stays inert while it is closed
    el.inert = on || (id === 'card' && !el.classList.contains('open'))
  }
}

/**
 * Keeps Tab inside a dialog, focuses its first control, and returns focus on release.
 * Returns the release function.
 */
export function trapFocus(container: HTMLElement, initial?: HTMLElement): () => void {
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const items = () => [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return
    const list = items()
    if (list.length === 0) return
    const first = list[0]
    const last = list[list.length - 1]
    if (!container.contains(document.activeElement)) {
      e.preventDefault()
      first.focus()
    } else if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }
  document.addEventListener('keydown', onKey)
  setBackgroundInert(true)
  requestAnimationFrame(() => (initial ?? items()[0])?.focus())
  return () => {
    document.removeEventListener('keydown', onKey)
    setBackgroundInert(false)
    previous?.focus()
  }
}
