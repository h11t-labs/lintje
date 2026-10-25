/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { dirname, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { importClosure, importsOf, sourceFiles, tagModules } from '../scripts/entries.mjs'
import { CATEGORIES, COMPOSITE, SECTIONS, tagsOf } from './categories'

const modules = tagModules(resolve('src'))
const tags = [...modules.keys()].map((tag) => tag.replace(/^lintje-/, ''))
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
  it('stand in the README as the list has them', () => {
    const readme = readFileSync('README.md', 'utf8')
    const section = readme.split('\n## ').find((part) => part.startsWith('Wat erin zit')) ?? ''
    const labels = [...section.matchAll(/^\| ([^|]+?) \| .+ \|$/gm)].map((row) => row[1])
    expect(labels.slice(1)).toEqual(CATEGORIES.map((category) => category.label))
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

describe('the layers', () => {
  it('mark only tags of the category as composite', () => {
    for (const { name, elements, composite = [] } of CATEGORIES) {
      expect(
        composite.filter((tag) => !elements.includes(tag)),
        name,
      ).toEqual([])
    }
  })

  it('keep every building block clear of a composite tag and its folder', () => {
    const compositeDirs = COMPOSITE.map((tag) => dirname(modules.get(tag)!) + sep)
    for (const [tag, file] of modules) {
      if (COMPOSITE.includes(tag)) continue
      const reached = [...importClosure(file)].filter((path) =>
        compositeDirs.some((dir) => path.startsWith(dir)),
      )
      expect(reached, tag).toEqual([])
    }
  })

  it('reach into a folder of a tag only for its module or its stylesheet', () => {
    const open = new Set(
      [...modules.values()].flatMap((file) => [file, file.replace(/\.ts$/, '.css')]),
    )
    const tagDirs = new Set([...modules.values()].map((file) => dirname(file)))
    const borrowed = sourceFiles(resolve('src')).flatMap((file) =>
      [...importsOf(file)]
        .filter((path) => tagDirs.has(dirname(path)) && dirname(path) !== dirname(file))
        .filter((path) => !open.has(path))
        .map((path) => `${file} -> ${path}`),
    )
    expect(borrowed).toEqual([])
  })
})
