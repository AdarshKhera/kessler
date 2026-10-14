export interface Launch {
  readonly id: string
  readonly name: string
  readonly netMs: number
  readonly pad: string
  readonly location: string
  readonly status: string
}

export interface LaunchInfo {
  readonly upcoming: readonly Launch[]
  readonly thisYear: number | null
  readonly source: 'live' | 'cache' | 'offline'
  readonly fetchedAt: number
}

const BASE = 'https://ll.thespacedevs.com/2.2.0'
const KEY = 'kessler.launches.v1'
const TTL_MS = 60 * 60_000 // Launch Library 2 free tier is 15 calls/hour per IP

interface Stored {
  readonly at: number
  readonly upcoming: readonly Launch[]
  readonly thisYear: number | null
}

const read = (): Stored | null => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Stored> | null
    if (!v || typeof v.at !== 'number' || !Array.isArray(v.upcoming)) return null
    const upcoming = v.upcoming.filter((l): l is Launch => typeof l?.name === 'string' && Number.isFinite(l.netMs))
    return { at: v.at, upcoming, thisYear: typeof v.thisYear === 'number' ? v.thisYear : null }
  } catch {
    return null
  }
}

const write = (v: Stored): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(v))
  } catch {
    // best-effort cache
  }
}

async function getJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Launch Library responded ${res.status}`)
  return (await res.json()) as Record<string, unknown>
}

function toLaunch(r: Record<string, unknown>): Launch | null {
  const net = Date.parse(String(r.net ?? ''))
  if (!Number.isFinite(net)) return null
  const status = (r.status as { abbrev?: string } | undefined)?.abbrev ?? ''
  return {
    id: String(r.id ?? ''),
    name: String(r.name ?? 'Unnamed launch'),
    netMs: net,
    pad: String(r.pad ?? ''),
    location: String(r.location ?? ''),
    status,
  }
}

/** Next SpaceX launches and how many they have flown this year. Two small calls, cached for an hour. */
export async function loadLaunches(nowMs = Date.now()): Promise<LaunchInfo> {
  const cached = read()
  if (cached && nowMs - cached.at < TTL_MS) return { ...cached, source: 'cache', fetchedAt: cached.at }
  try {
    const since = new Date(nowMs - 3 * 3_600_000).toISOString()
    const yearStart = `${new Date(nowMs).getUTCFullYear()}-01-01T00:00:00Z`
    const [up, prev] = await Promise.all([
      getJson(`${BASE}/launch/upcoming/?limit=6&mode=list&lsp__name=SpaceX&ordering=net&net__gte=${encodeURIComponent(since)}`),
      getJson(`${BASE}/launch/previous/?limit=1&mode=list&lsp__name=SpaceX&net__gte=${encodeURIComponent(yearStart)}`),
    ])
    const upcoming = ((up.results as Record<string, unknown>[] | undefined) ?? [])
      .map(toLaunch)
      .filter((l): l is Launch => l !== null)
    const thisYear = typeof prev.count === 'number' ? prev.count : null
    write({ at: nowMs, upcoming, thisYear })
    return { upcoming, thisYear, source: 'live', fetchedAt: nowMs }
  } catch {
    if (cached) return { ...cached, source: 'cache', fetchedAt: cached.at }
    return { upcoming: [], thisYear: null, source: 'offline', fetchedAt: nowMs }
  }
}
