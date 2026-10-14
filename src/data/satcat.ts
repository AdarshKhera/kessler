export interface SatcatRecord {
  readonly objectType: string
  readonly opsStatus: string
  readonly owner: string
  readonly launchDate: string
  readonly launchSite: string
  readonly rcs: number | null
}

const memo = new Map<number, SatcatRecord | null>()

export const OPS_STATUS: Readonly<Record<string, string>> = {
  '+': 'Operational',
  '-': 'Non-operational',
  P: 'Partially operational',
  B: 'Backup',
  S: 'Spare',
  X: 'Extended mission',
  D: 'Decayed',
  '?': 'Unknown',
}

export const OBJECT_TYPE: Readonly<Record<string, string>> = { PAY: 'Payload', 'R/B': 'Rocket body', DEB: 'Debris', UNK: 'Unknown' }

/** Lazy per-satellite lookup so we only pull one tiny record on selection. */
export async function fetchSatcat(noradId: number): Promise<SatcatRecord | null> {
  if (memo.has(noradId)) return memo.get(noradId) ?? null
  try {
    const res = await fetch(`https://celestrak.org/satcat/records.php?CATNR=${noradId}&FORMAT=json`)
    if (!res.ok) throw new Error(String(res.status))
    const rows = (await res.json()) as Record<string, unknown>[]
    const r = rows[0]
    const rec: SatcatRecord | null = r
      ? {
          objectType: String(r.OBJECT_TYPE ?? ''),
          opsStatus: String(r.OPS_STATUS_CODE ?? ''),
          owner: String(r.OWNER ?? ''),
          launchDate: String(r.LAUNCH_DATE ?? ''),
          launchSite: String(r.LAUNCH_SITE ?? ''),
          rcs: typeof r.RCS === 'number' ? r.RCS : null,
        }
      : null
    memo.set(noradId, rec)
    return rec
  } catch {
    memo.set(noradId, null)
    return null
  }
}
