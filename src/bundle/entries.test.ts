/// <reference types="node" />
/**
 * What an entry reaches. A page that loads a category or one tag gets that tag's module and what
 * it imports, so these are the promises of `docs/guides/loading.md` checked on the import graph:
 * every tag has an entry, a category imports exactly its tags, and the heavy parts — the map,
 * the charts — stay out of everything that does not draw them.
 */
import { readFileSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { importClosure, importsOf, tagEntryName, tagModules } from '../../scripts/entries.mjs'
import { CATEGORIES, tagsOf } from '../categories'
import { LINTJE_TAGS } from './index'

// The runner's working directory is the repository root (`vitest.config.ts`).
const SRC = resolve('src')
const modules = tagModules(SRC)
const entry = (name: string) => resolve(SRC, 'bundle', `${name}.ts`)
const moduleOf = (tag: string) => modules.get(tag)!

/** The tags whose module is among `files`. */
const tagsIn = (files: Set<string>) =>
  [...modules].filter(([, file]) => files.has(file)).map(([tag]) => tag)

const isMap = (file: string) =>
  file === 'leaflet' ||
  file.startsWith('leaflet/') ||
  file.includes(`${sep}charts${sep}map-chart${sep}`) ||
  file.includes(`${sep}assets${sep}geo${sep}`)

describe('the entries per tag', () => {
  it('finds a module for every tag the bundle lists, and no other', () => {
    expect([...modules.keys()]).toEqual([...LINTJE_TAGS].sort((a, b) => a.localeCompare(b)))
  })

  it('names an entry after its tag, without the prefix', () => {
    expect(tagEntryName('lintje-date-input')).toBe('tag/date-input')
  })

  it('reads an import that spans lines and skips a type-only one', () => {
    const imports = [...importsOf(moduleOf('lintje-chart-tile'))]
    expect(imports).toContain('lit')
    expect(imports).toContain(resolve(SRC, 'components/tables/data-table/data-table.ts'))
    expect(imports).not.toContain(resolve(SRC, 'types.ts'))
  })
})

describe('what a tag imports', () => {
  it('reaches no barrel: a tag imports the tags it draws by path', () => {
    const barrels = ['primitives', 'components', 'components/shared/charts', 'bundle'].map(
      (layer) => resolve(SRC, layer, 'index.ts'),
    )
    const through = [...modules]
      .filter(([, file]) => barrels.some((barrel) => importClosure(file).has(barrel)))
      .map(([tag]) => tag)
    expect(through).toEqual([])
  })
})

describe('what a tag draws', () => {
  // A module's own text without its comments: a doc comment shows tags it does not draw.
  const written = new Map<string, string[]>()
  const tagsWrittenIn = (file: string): string[] => {
    if (!written.has(file)) {
      const source = file.endsWith('.ts')
        ? readFileSync(file, 'utf8')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/(^|\s)\/\/.*$/gm, '')
        : ''
      const tags = [...source.matchAll(/<(lintje-[a-z0-9-]+)/g)].map((match) => match[1]!)
      written.set(
        file,
        [...new Set(tags)].filter((tag) => modules.has(tag)),
      )
    }
    return written.get(file)!
  }

  it('imports every tag its templates write, so a tag loaded alone is complete', () => {
    const missing: string[] = []
    for (const [tag, file] of modules) {
      const closure = importClosure(file)
      for (const reached of closure) {
        if (!reached.startsWith(SRC)) continue
        for (const drawn of tagsWrittenIn(reached)) {
          if (!closure.has(moduleOf(drawn))) missing.push(`${tag} draws ${drawn}`)
        }
      }
    }
    expect(missing).toEqual([])
  })
})

describe('the categories', () => {
  for (const category of CATEGORIES) {
    it(`${category.name} imports exactly its tags`, () => {
      expect(tagsOf(category).sort()).toEqual(tagsIn(importsOf(entry(category.name))).sort())
    })
  }

  it('bring the inputs along with the forms', () => {
    const inputs = CATEGORIES.find((category) => category.name === 'inputs')!
    const reached = tagsIn(importClosure(entry('forms')))
    expect(tagsOf(inputs).filter((tag) => !reached.includes(tag))).toEqual([])
  })

  it('keep each tag in the folder of its category', () => {
    const astray = CATEGORIES.flatMap((category) =>
      tagsOf(category).filter((tag) => {
        const file = moduleOf(tag)
        return (
          file.startsWith(resolve(SRC, 'components')) &&
          !file.startsWith(resolve(SRC, 'components', category.name) + sep)
        )
      }),
    )
    expect(astray).toEqual([])
  })
})

describe('what stays out', () => {
  it('keeps the map out of everything but the map category and the map tile', () => {
    const names = [
      'core',
      ...CATEGORIES.map((category) => category.name).filter((name) => name !== 'map'),
    ]
    for (const name of names) {
      expect([...importClosure(entry(name))].filter(isMap), name).toEqual([])
    }
    const withMap = [...modules]
      .filter(([, file]) => [...importClosure(file)].some(isMap))
      .map(([tag]) => tag)
    expect(withMap).toEqual(['lintje-map-tile'])
  })

  it('reaches the map from the map category', () => {
    expect([...importClosure(entry('map'))].some(isMap)).toBe(true)
  })

  it('keeps charts, tables and the chat out of the frame, the inputs, the forms and the filters', () => {
    for (const name of ['frame', 'inputs', 'forms', 'filters']) {
      const reached = tagsIn(importClosure(entry(name)))
      for (const tag of [
        'lintje-chart-tile',
        'lintje-data-table',
        'lintje-map-tile',
        'lintje-chat',
      ])
        expect(reached, name).not.toContain(tag)
    }
  })

  it('keeps the charts out of a table', () => {
    expect(tagsIn(importClosure(entry('tables')))).not.toContain('lintje-chart-tile')
  })

  it('defines no tag in the host API', () => {
    expect(tagsIn(importClosure(entry('core')))).toEqual([])
    expect(readFileSync(entry('core'), 'utf8')).not.toMatch(/^import '/m)
  })

  it('keeps the shell and the page header free of filters, charts and tables', () => {
    for (const tag of ['lintje-page-header', 'lintje-shell']) {
      const reached = tagsIn(importClosure(moduleOf(tag)))
      for (const heavy of ['lintje-filter-bar', 'lintje-chart-tile', 'lintje-data-table'])
        expect(reached, tag).not.toContain(heavy)
    }
  })
})
