import { describe, expect, it } from 'vitest'
import { LINTJE_VERSION } from './version'

describe('LINTJE_VERSION', () => {
  it('is "dev" while the source runs unbuilt', () => {
    expect(LINTJE_VERSION).toBe('dev')
  })
})
