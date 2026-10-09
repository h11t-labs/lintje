/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { tagModules } from '../scripts/entries.mjs'
import { CATEGORIES, SECTIONS, tagsOf } from './categories'

const tags = [...tagModules(resolve('src')).keys()].map((tag) => tag.replace(/^lintje-/, ''))
const elements = CATEGORIES.flatMap((category) => category.elements)

describe('the categories', () => {
  it('place every tag in exactly one category', () => {
    expect([...elements].filter((name) => tags.includes(name)).sort()).toEqual([...tags].sort())
  })

  it('name nothing but tags and the sections without one', () => {
    expect(elements.filter((name) => !tags.includes(name))).toEqual(SECTIONS)
  })

  it('give their tags with the prefix', () => {
    expect(CATEGORIES.flatMap(tagsOf).sort()).toEqual(tags.map((tag) => `lintje-${tag}`).sort())
  })

  it('have names fit for a folder and an address', () => {
    for (const { name } of CATEGORIES) expect(name).toMatch(/^[a-z]+$/)
    expect(new Set(CATEGORIES.map((category) => category.name)).size).toBe(CATEGORIES.length)
  })
  it('stand in the guide on loading as the list has them', () => {
    const guide = readFileSync('docs/guides/loading.md', 'utf8')
    const rows = [...guide.matchAll(/^\| `([a-z]+)\.js` — (.+?) \| (.+) \|$/gm)].map((row) => [
      row[1],
      row[2],
      row[3],
    ])
    expect(rows).toEqual(
      CATEGORIES.map((category) => [
        category.name,
        category.label,
        tagsOf(category)
          .map((tag) => `\`${tag.replace('lintje-', '')}\``)
          .join(', '),
      ]),
    )
  })
  it('each have an export in the package', () => {
    const { exports } = JSON.parse(readFileSync('package.json', 'utf8'))
    for (const { name } of CATEGORIES) {
      expect(exports[`./${name}`], name).toEqual({
        types: `./dist-elements/${name}.d.ts`,
        default: `./dist-elements/${name}.js`,
      })
    }
  })
})
