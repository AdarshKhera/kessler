import type { Omm } from '../data/types'

const finite = (v: unknown): boolean => v !== '' && v !== null && Number.isFinite(Number(v))

/** Guards against malformed rows from the network or a stale cache. */
export function isValidOmm(row: unknown): row is Omm {
  if (typeof row !== 'object' || row === null) return false
  const r = row as Record<string, unknown>
  if (typeof r.OBJECT_NAME !== 'string' || r.OBJECT_NAME.length === 0) return false
  if (typeof r.EPOCH !== 'string' || !Number.isFinite(Date.parse(r.EPOCH.endsWith('Z') ? r.EPOCH : `${r.EPOCH}Z`))) return false
  if (!Number.isInteger(Number(r.NORAD_CAT_ID)) || Number(r.NORAD_CAT_ID) <= 0) return false
  for (const k of ['MEAN_MOTION', 'ECCENTRICITY', 'INCLINATION', 'RA_OF_ASC_NODE', 'ARG_OF_PERICENTER', 'MEAN_ANOMALY'])
    if (!finite(r[k])) return false
  return Number(r.MEAN_MOTION) > 0
}
