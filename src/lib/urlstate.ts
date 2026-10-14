export interface ViewState {
  readonly sat?: number
  readonly fleet?: string
  readonly country?: string
  /** solar-system view: a body id, or `solar` for the overview */
  readonly body?: string
  readonly solar?: boolean
}

/** Shareable view in the URL hash: #sat=25544 or #fleet=gps. Anything else is ignored. */
export function parseHash(hash: string): ViewState {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const body = params.get('body')
  if (body && /^[a-z]{2,12}$/.test(body)) return { body }
  if (params.get('solar') === '1') return { solar: true }
  const sat = Number(params.get('sat'))
  if (Number.isInteger(sat) && sat > 0) return { sat }
  const fleet = params.get('fleet')
  if (fleet && /^[a-z0-9-]{1,24}$/.test(fleet)) return { fleet }
  const country = params.get('country')
  if (country && /^[a-z0-9]{1,6}$/.test(country)) return { country }
  return {}
}

export function toHash(view: ViewState): string {
  if (view.body) return `#body=${view.body}`
  if (view.solar) return '#solar=1'
  if (view.sat !== undefined) return `#sat=${view.sat}`
  if (view.fleet) return `#fleet=${view.fleet}`
  if (view.country) return `#country=${view.country}`
  return ''
}
