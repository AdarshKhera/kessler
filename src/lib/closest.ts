export interface Approach {
  readonly t: number
  readonly distance: number
}

/**
 * Two-pass minimum search: coarse scan, then fine scan around the best coarse sample.
 * Returns null if the coarse minimum never gets inside `threshold`.
 */
export function closestApproach(
  distAt: (t: number) => number,
  tStart: number,
  tEnd: number,
  coarseStep: number,
  fineStep: number,
  threshold: number,
): Approach | null {
  let bestT = tStart
  let bestD = Infinity
  for (let t = tStart; t <= tEnd; t += coarseStep) {
    const d = distAt(t)
    if (d < bestD) {
      bestD = d
      bestT = t
    }
  }
  if (bestD > threshold) return null
  let fineT = bestT
  let fineD = bestD
  const lo = Math.max(tStart, bestT - coarseStep)
  const hi = Math.min(tEnd, bestT + coarseStep)
  for (let t = lo; t <= hi; t += fineStep) {
    const d = distAt(t)
    if (d < fineD) {
      fineD = d
      fineT = t
    }
  }
  return { t: fineT, distance: fineD }
}
