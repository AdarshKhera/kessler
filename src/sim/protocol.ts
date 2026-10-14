import type { Omm } from '../data/types'

export type WorkerRequest =
  | { type: 'init'; omms: Omm[] }
  | { type: 'tick'; id: number; t: number }
  | { type: 'track'; id: number; index: number; t: number }
  | { type: 'conj'; id: number; index: number; t: number; hours: number }

export interface ConjunctionHit {
  readonly index: number
  readonly tcaMs: number
  readonly missKm: number
  readonly relKmS: number
}

export type WorkerResponse =
  | { type: 'ready'; count: number; failed: number }
  | { type: 'tick'; id: number; t: number; pos: Float32Array; vel: Float32Array }
  | { type: 'track'; id: number; index: number; t: number; orbit: Float32Array; ground: Float32Array }
  | { type: 'conj'; id: number; index: number; hits: ConjunctionHit[]; scanned: number }
