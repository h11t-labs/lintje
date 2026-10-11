/**
 * The forms category on a page that loaded nothing else: its own tags exist, and the charts, the
 * table and the map do not. `entries.test.ts` checks the same on the import graph; this is the
 * registry a page would see.
 */
import { describe, expect, it } from 'vitest'
import { CATEGORIES, tagsOf } from '../categories'
import './forms'

const forms = CATEGORIES.find((category) => category.name === 'forms')!

describe('a page that loads the forms category', () => {
  it('defines every tag the category names', () => {
    expect(tagsOf(forms).filter((tag) => !customElements.get(tag))).toEqual([])
  })

  it('defines the fields a form holds', () => {
    const inputs = CATEGORIES.find((category) => category.name === 'inputs')!
    expect(tagsOf(inputs).filter((tag) => !customElements.get(tag))).toEqual([])
  })

  it('defines the primitives a form draws with', () => {
    expect(customElements.get('lintje-button')).toBeDefined()
  })

  it('defines no chart, table, map, chat or shell', () => {
    for (const tag of [
      'lintje-chart',
      'lintje-data-table',
      'lintje-map',
      'lintje-chat',
      'lintje-shell',
    ])
      expect(customElements.get(tag), tag).toBeUndefined()
  })
})
