/**
 * The tag reference is derived from the source (`scripts/manifest.mjs`), so it has to find
 * every tag the bundle defines, with its properties, events and slots.
 */
import { describe, expect, it } from 'vitest'
import { buildDataTypes, buildManifest, declarationsByTag } from '../../scripts/manifest.mjs'
import { LINTJE_TAGS } from './index'

const declarations = declarationsByTag(buildManifest('src'))
const of = (tag: string) => declarations.get(tag)!
const data = buildDataTypes('src')

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

  it('names a slot bound per item after the field, not as the default slot', () => {
    for (const tag of ['lintje-stepper', 'lintje-tabs']) {
      const slots = of(tag).slots
      expect(slots.map((slot) => slot.name)).toEqual(['<value>'])
      expect(slots[0]!.description).toContain('per item')
    }
  })
})

describe('the data types', () => {
  const type = (name: string) => data.types[name]!

  it('tells a chart spec as one table per kind', () => {
    const spec = type('ChartSpec')
    if (spec.kind !== 'union') throw new Error('ChartSpec is not a union')
    expect(spec.discriminant).toBe('kind')
    expect(spec.variants.map((variant) => variant.value)).toEqual([
      'line',
      'bar',
      'horizontal-bar',
      'target-progress',
      'grouped-bar',
      'stacked-bar',
      'stacked-area',
      'pie',
      'dual-axis',
      'scatter',
      'heatmap',
      'histogram',
      'radar',
      'dumbbell',
      'treemap',
      'sankey',
    ])
    const pie = spec.variants.find((variant) => variant.value === 'pie')!
    const field = (name: string) => pie.fields.find((f) => f.name === name)
    expect(pie.fields.map((f) => f.name)).not.toContain('kind')
    expect(field('segments')).toMatchObject({ optional: false })
    expect(field('donut')).toMatchObject({ optional: true })
    expect(field('color')?.description).toMatch(/^The variable the pie divides/)
  })

  it('tells an interface with what it extends and what its fields say', () => {
    const chart = type('ChartData')
    if (chart.kind !== 'interface') throw new Error('ChartData is not an interface')
    expect(chart.module).toBe('src/types.ts')
    expect(chart.extends).toEqual(['FrameSettings', 'TileData', 'ContentState'])
    const field = (name: string) => chart.fields.find((f) => f.name === name)
    expect(field('chart')).toMatchObject({ type: 'ChartSpec', optional: false })
    expect(field('description')).toMatchObject({ optional: false })
    expect(field('description')?.description).toMatch(/^The chart's `<desc>`/)
  })

  it('writes a type that is no object out as its text', () => {
    const content = type('ContentState')
    if (content.kind !== 'interface') throw new Error('ContentState is not an interface')
    expect(content.fields.find((f) => f.name === 'state')?.type).toBe('ContentStateKind')
    expect(type('ContentStateKind')).toMatchObject({
      kind: 'alias',
      text: "'ready' | 'loading' | 'empty' | 'error'",
    })
    expect(type('ButtonVariant')).toMatchObject({ kind: 'alias' })
  })

  it('tells a filter as one interface, its kind a union of strings', () => {
    const filter = type('FilterDefinition')
    expect(filter.kind).toBe('interface')
    expect(type('FilterKind').kind).toBe('alias')
  })

  it('lets the contract speak where a name is declared twice', () => {
    expect(type('ContentState').module).toBe('src/types.ts')
    expect(data.duplicates?.map(({ name, modules }) => [name, modules[0]]).sort()).toEqual([
      ['ContentState', 'src/types.ts'],
      ['FilterValue', 'src/types.ts'],
      ['FrameSettings', 'src/types.ts'],
    ])
  })
})
