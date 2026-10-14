import { describe, expect, it } from 'vitest'
import { parseHash, toHash } from '../src/lib/urlstate'

describe('urlstate', () => {
  it('round-trips a satellite', () => {
    expect(parseHash(toHash({ sat: 25544 }))).toEqual({ sat: 25544 })
  })
  it('round-trips a fleet', () => {
    expect(parseHash(toHash({ fleet: 'gps' }))).toEqual({ fleet: 'gps' })
  })
  it('round-trips a country, lower-cased', () => {
    expect(parseHash(toHash({ country: 'ind' }))).toEqual({ country: 'ind' })
    expect(parseHash('#country=<b>')).toEqual({})
  })
  it('round-trips solar-system views', () => {
    expect(parseHash(toHash({ body: 'saturn' }))).toEqual({ body: 'saturn' })
    expect(parseHash(toHash({ solar: true }))).toEqual({ solar: true })
    expect(parseHash('#body=<x>')).toEqual({})
  })
  it('produces an empty string for no state', () => {
    expect(toHash({})).toBe('')
  })
  it('ignores junk and unsafe values', () => {
    expect(parseHash('#sat=abc')).toEqual({})
    expect(parseHash('#sat=-5')).toEqual({})
    expect(parseHash('#fleet=<script>')).toEqual({})
    expect(parseHash('')).toEqual({})
  })
  it('prefers a satellite when both are present', () => {
    expect(parseHash('#sat=7&fleet=gps')).toEqual({ sat: 7 })
  })
})
