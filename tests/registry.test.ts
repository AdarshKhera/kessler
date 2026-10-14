import { describe, expect, it } from 'vitest'
import { GROUPS, OPERATORS, dedupeById } from '../src/data/registry'

describe('registry', () => {
  it('every group maps to a known operator', () => {
    const ids = new Set(OPERATORS.map((o) => o.id))
    for (const g of GROUPS) expect(ids.has(g.operator)).toBe(true)
  })
  it('operator badges are unique and two letters', () => {
    expect(new Set(OPERATORS.map((o) => o.short)).size).toBe(OPERATORS.length)
    for (const o of OPERATORS) expect(o.short).toMatch(/^[A-Z]{2}$/)
  })
  it('group ids are unique', () => {
    expect(new Set(GROUPS.map((g) => g.id)).size).toBe(GROUPS.length)
  })
})

describe('dedupeById', () => {
  it('keeps the first occurrence in priority order', () => {
    const rows = [
      { id: 1, group: 'a' },
      { id: 2, group: 'a' },
      { id: 1, group: 'b' },
    ]
    expect(dedupeById(rows)).toEqual([
      { id: 1, group: 'a' },
      { id: 2, group: 'a' },
    ])
  })
})
