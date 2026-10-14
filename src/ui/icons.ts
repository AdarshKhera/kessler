const svg = (body: string, size = 16) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`

/** Static markup only, never built from data. */
export const icons = {
  search: svg('<circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5 14 14"/>'),
  close: svg('<path d="M4 4l8 8M12 4l-8 8"/>'),
  pause: svg('<path d="M5.5 3.5v9M10.5 3.5v9"/>'),
  play: svg('<path d="M5 3.5v9l7-4.5z" fill="currentColor"/>'),
  help: svg('<circle cx="8" cy="8" r="6.25"/><path d="M6.2 6.3a1.9 1.9 0 1 1 2.6 1.8c-.5.3-.8.7-.8 1.3"/><circle cx="8" cy="11.6" r=".4" fill="currentColor"/>'),
  plus: svg('<path d="M8 3.5v9M3.5 8h9"/>'),
  minus: svg('<path d="M3.5 8h9"/>'),
  home: svg('<path d="M2.5 7.5 8 3l5.5 4.5M4 6.7V13h8V6.7"/>'),
  layers: svg('<path d="M8 2 2 5.2 8 8.4l6-3.2zM2 8.2l6 3.2 6-3.2M2 11l6 3.2 6-3.2"/>'),
  link: svg('<path d="M6.8 9.2a2.6 2.6 0 0 0 3.7 0l2-2a2.6 2.6 0 0 0-3.7-3.7l-.6.6M9.2 6.8a2.6 2.6 0 0 0-3.7 0l-2 2a2.6 2.6 0 0 0 3.7 3.7l.6-.6"/>'),
  chevron: svg('<path d="M6 4l4 4-4 4"/>', 12),
}
