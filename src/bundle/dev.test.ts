/**
 * The check a host loads while developing: it names the `lintje-…` elements on the page that no
 * module defined, once each.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import '../primitives/button/button'
import { reportUndefinedTags, undefinedTags } from './dev'

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('the tags a page forgot to import', () => {
  it('names an undefined lintje tag and leaves a defined one and a foreign one alone', () => {
    document.body.innerHTML =
      '<lintje-button></lintje-button><lintje-not-loaded></lintje-not-loaded><other-tag></other-tag>'
    expect(undefinedTags()).toEqual(['lintje-not-loaded'])
  })

  it('warns once per tag, with the file to import', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    document.body.innerHTML =
      '<lintje-date-thing></lintje-date-thing><lintje-date-thing></lintje-date-thing>'
    expect(reportUndefinedTags()).toEqual(['lintje-date-thing'])
    expect(reportUndefinedTags()).toEqual([])
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]![0]).toContain('tag/date-thing.js')
  })
})
