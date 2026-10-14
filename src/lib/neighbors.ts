export interface Neighbor {
  readonly index: number
  readonly distance: number
}

/** Brute-force k nearest by 3D distance. `positions` is an xyz-interleaved array; NaN rows are skipped. */
export function nearestTo(
  positions: Float32Array,
  index: number,
  k: number,
  skip?: (i: number) => boolean,
): Neighbor[] {
  const n = positions.length / 3
  const bx = positions[index * 3]
  const by = positions[index * 3 + 1]
  const bz = positions[index * 3 + 2]
  const best: Neighbor[] = []
  let worst = Infinity
  for (let i = 0; i < n; i++) {
    if (i === index) continue
    const x = positions[i * 3]
    if (x !== x) continue
    if (skip?.(i)) continue
    const dx = x - bx
    const dy = positions[i * 3 + 1] - by
    const dz = positions[i * 3 + 2] - bz
    const d2 = dx * dx + dy * dy + dz * dz
    if (best.length < k || d2 < worst) {
      best.push({ index: i, distance: d2 })
      best.sort((a, b) => a.distance - b.distance)
      if (best.length > k) best.pop()
      if (best.length === k) worst = best[k - 1].distance
    }
  }
  return best.map((b) => ({ index: b.index, distance: Math.sqrt(b.distance) }))
}
