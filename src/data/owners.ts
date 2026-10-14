/** NORAD id to SATCAT owner code. Bundled at build time, so it costs a few hundred KB, not the 6 MB SATCAT. */
export async function loadOwners(): Promise<Map<number, string>> {
  try {
    const res = await fetch('./data/owners.json')
    if (!res.ok) throw new Error(String(res.status))
    const raw = (await res.json()) as Record<string, unknown>
    const out = new Map<number, string>()
    for (const [id, owner] of Object.entries(raw)) if (typeof owner === 'string') out.set(Number(id), owner)
    return out
  } catch {
    return new Map()
  }
}
