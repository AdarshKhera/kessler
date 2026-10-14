import { INDIA_OWNER, INDIA_QUERIES } from './extras'
import { GROUPS, OPERATORS, dedupeById } from './registry'
import { isValidOmm } from '../lib/validate'
import type { Omm, Sat } from './types'

const CELESTRAK = 'https://celestrak.org/NORAD/elements/gp.php'
const TTL_MS = 2 * 3_600_000 // CelesTrak asks for no more than one pull per group per 2h
const DB = 'kessler'
const STORE = 'gp'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => {
      req.result.onversionchange = () => req.result.close()
      resolve(req.result)
    }
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

async function cacheGet(key: string): Promise<{ at: number; rows: Omm[] } | null> {
  try {
    const db = await openDb()
    return await new Promise((resolve) => {
      const req = db.transaction(STORE).objectStore(STORE).get(key)
      req.onsuccess = () => {
        const v = req.result as { at?: unknown; rows?: unknown } | undefined
        resolve(v && typeof v.at === 'number' && Array.isArray(v.rows) ? { at: v.at, rows: v.rows.filter(isValidOmm) } : null)
      }
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

async function cachePut(key: string, rows: Omm[]): Promise<void> {
  try {
    const db = await openDb()
    db.transaction(STORE, 'readwrite').objectStore(STORE).put({ at: Date.now(), rows }, key)
  } catch {
    // cache is best-effort
  }
}

export type Source = 'live' | 'cache' | 'snapshot'

async function fetchJson(url: string): Promise<Omm[]> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} responded ${res.status} `)
  const rows = (await res.json()) as unknown[]
  if (!Array.isArray(rows)) throw new Error(`${url} did not return a list`)
  return rows.filter(isValidOmm)
}

const backoffKey = (id: string) => `kessler.backoff.${id}`

function inBackoff(id: string): boolean {
  try {
    return Date.now() < Number(localStorage.getItem(backoffKey(id)) ?? 0)
  } catch {
    return false
  }
}

function startBackoff(id: string): void {
  try {
    localStorage.setItem(backoffKey(id), String(Date.now() + TTL_MS))
  } catch {
    // best-effort
  }
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const isThrottle = (message: string): boolean => / 40[39] | 429 /.test(` ${message} `)

/**
 * Several small NAME queries. Stops at the first throttle response instead of sending the rest.
 * `complete` is true only when every query succeeded, so a partial result is never cached as if it were whole.
 */
async function fetchIndiaExtra(): Promise<{ rows: Omm[]; complete: boolean }> {
  const rows: Omm[] = []
  let ok = 0
  let throttled = false
  for (const name of INDIA_QUERIES) {
    try {
      rows.push(...(await fetchJson(`${CELESTRAK}?NAME=${encodeURIComponent(name)}&FORMAT=json`)))
      ok += 1
    } catch (e) {
      if (isThrottle((e as Error).message)) {
        throttled = true
        break
      }
    }
    await wait(250)
  }
  if (ok === 0) throw new Error(throttled ? 'Indian-object queries throttled by CelesTrak 403 ' : 'every Indian-object query failed')
  return { rows, complete: ok === INDIA_QUERIES.length } // owner filtering happens when read, so a newer owner table applies to cached rows too
}

async function loadGroup(id: string): Promise<{ rows: Omm[]; source: Source }> {
  const cached = await cacheGet(id)
  if (cached && Date.now() - cached.at < TTL_MS) return { rows: cached.rows, source: 'cache' }
  try {
    // a 403/429 from CelesTrak means we pulled this group too recently: stop asking for 2h
    if (inBackoff(id)) throw new Error('backing off after throttle')
    if (id === 'india-extra') {
      const r = await fetchIndiaExtra()
      if (r.complete) void cachePut(id, r.rows)
      return { rows: r.rows, source: 'live' }
    }
    const rows = await fetchJson(`${CELESTRAK}?GROUP=${encodeURIComponent(id)}&FORMAT=json`)
    void cachePut(id, rows)
    return { rows, source: 'live' }
  } catch (liveError) {
    if (isThrottle((liveError as Error).message)) startBackoff(id)
    if (cached) return { rows: cached.rows, source: 'cache' }
    try {
      return { rows: await fetchJson(`./data/${id}.json`), source: 'snapshot' }
    } catch {
      throw new Error(`No data for group ${id}: ${(liveError as Error).message}`)
    }
  }
}

export interface Catalog {
  readonly sats: readonly Sat[]
  readonly sources: Readonly<Record<Source, number>>
  readonly failedGroups: readonly string[]
}

export async function loadCatalog(onProgress: (done: number, total: number, groupName: string) => void, owners: ReadonlyMap<number, string> = new Map()): Promise<Catalog> {
  const sources: Record<Source, number> = { live: 0, cache: 0, snapshot: 0 }
  const failedGroups: string[] = []
  const results: { groupIndex: number; rows: Omm[] }[] = []
  let done = 0
  const queue = GROUPS.map((g, groupIndex) => ({ g, groupIndex }))
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      try {
        const { rows, source } = await loadGroup(job.g.id)
        sources[source] += 1
        const kept = job.g.id === 'india-extra' ? rows.filter((r) => owners.get(Number(r.NORAD_CAT_ID)) === INDIA_OWNER) : rows
        results.push({ groupIndex: job.groupIndex, rows: kept })
      } catch {
        failedGroups.push(job.g.id)
      }
      done += 1
      onProgress(done, GROUPS.length, job.g.name)
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()])

  const flat = results
    .sort((a, b) => a.groupIndex - b.groupIndex)
    .flatMap(({ groupIndex, rows }) => rows.map((omm) => ({ id: Number(omm.NORAD_CAT_ID), groupIndex, omm })))
  const unique = dedupeById(flat)
  const opIndex = new Map(OPERATORS.map((o, i) => [o.id, i]))
  const sats: Sat[] = unique.map((u, index) => ({
    index,
    id: u.id,
    name: u.omm.OBJECT_NAME,
    groupIndex: u.groupIndex,
    operatorIndex: opIndex.get(GROUPS[u.groupIndex].operator) ?? 0,
    omm: u.omm,
  }))
  return { sats, sources, failedGroups }
}

/** When we may ask CelesTrak for this group live again, or 0 if not throttled. */
export function backoffUntil(id: string): number {
  try {
    return Number(localStorage.getItem(backoffKey(id)) ?? 0)
  } catch {
    return 0
  }
}
