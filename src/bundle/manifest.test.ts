/**
 * The tag reference is derived from the source (`scripts/manifest.mjs`), so it has to find
 * every tag the bundle defines, with its properties, events and slots.
 */
import { describe, expect, it } from 'vitest'
import { buildManifest, declarationsByTag } from '../../scripts/manifest.mjs'
import { LINTJE_TAGS } from './index'

const declarations = declarationsByTag(buildManifest('src'))
const of = (tag: string) => declarations.get(tag)!

describe('the tag reference', () => {
  it('describes every tag of the bundle, and no other', () => {
    expect([...declarations.keys()].sort()).toEqual([...LINTJE_TAGS].sort())
  })

  it('says what every tag is', () => {
    const silent = [...declarations.values()].filter((d) => !d.description).map((d) => d.tagName)
    expect(silent).toEqual([])
  })

  it('reads properties with their attribute, type and default, inherited ones included', () => {
    const field = (name: string) =>
      of('lintje-text-input').members.find((member) => member.name === name)
    expect(field('commitOn')).toMatchObject({ attribute: 'commit', default: "'change'" })
    expect(field('hideLabel')).toMatchObject({
      attribute: 'hide-label',
      type: { text: 'boolean' },
      inheritedFrom: { name: 'LintjeInputElement' },
    })
  })

  it('leaves a property without an attribute out of the attributes', () => {
    const list = of('lintje-job-list')
    expect(list.members.map((member) => member.name)).toContain('jobs')
    expect(list.attributes.map((attribute) => attribute.name)).not.toContain('jobs')
  })

  it('finds the events a tag sends, also by a name it holds in a table', () => {
    const names = (tag: string) => of(tag).events.map((event) => event.name)
    expect(names('lintje-tile')).toEqual(['lintje-tile-download', 'lintje-tile-expand'])
    expect(names('lintje-job-list')).toContain('lintje-job-retry')
  })

  it('finds what a host may call: the public methods and getters that carry a doc', () => {
    const names = of('lintje-form').methods.map((method) => method.name)
    expect(names).toEqual(expect.arrayContaining(['submit', 'saved', 'restoredDraft']))
    expect(of('lintje-badge').methods).toEqual([])
  })

  it('finds the slots', () => {
    const slots = of('lintje-tile').slots.map((slot) => slot.name)
    expect(slots).toEqual(expect.arrayContaining(['', 'legend', 'footnote']))
  })
})
