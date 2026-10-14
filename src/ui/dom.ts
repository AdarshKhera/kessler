const SAFE_ATTRS = new Set(['id', 'type', 'role', 'hidden', 'placeholder', 'autocomplete', 'spellcheck', 'title', 'href', 'target', 'rel'])

type Child = Node | string | null | undefined | false

/** Tiny hyperscript. Text always goes through text nodes, never innerHTML (CelesTrak names are untrusted). */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, unknown> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue
    if (k === 'class') el.className = String(v)
    else if (k === 'style' && typeof v === 'object') {
      for (const [name, value] of Object.entries(v as Record<string, string>)) {
        if (name.startsWith('--')) el.style.setProperty(name, value)
        else (el.style as unknown as Record<string, string>)[name] = value
      }
    }
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener)
    else if (SAFE_ATTRS.has(k) || k.startsWith('aria-')) el.setAttribute(k, String(v))
  }
  for (const c of children) if (c) el.append(c)
  return el
}

export const clear = (el: Element): void => el.replaceChildren()

export const fmt = (n: number, digits = 0): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
