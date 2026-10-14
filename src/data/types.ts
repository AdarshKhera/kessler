import type { OMMJsonObject } from 'satellite.js'

export type Omm = OMMJsonObject

/** Static per-satellite metadata, index-aligned with the propagator buffers. */
export interface Sat {
  readonly index: number
  readonly id: number
  readonly name: string
  readonly groupIndex: number
  readonly operatorIndex: number
  readonly omm: Omm
}
