import { describe, expect, it } from 'vitest'
import { uniqueId } from './id'

describe('uniqueId', () => {
  it('gives another id on every call, behind the prefix', () => {
    const first = uniqueId('lintje-menu')
    const second = uniqueId('lintje-menu')
    const other = uniqueId('lintje-chart')
    expect(first).toMatch(/^lintje-menu-\d+$/)
    expect(second).toMatch(/^lintje-menu-\d+$/)
    expect(other).toMatch(/^lintje-chart-\d+$/)
    expect(new Set([first, second, other]).size).toBe(3)
  })
})
