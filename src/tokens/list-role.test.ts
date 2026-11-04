/**
 * Every list a template draws keeps its role: `base.css` takes the bullets off each `ul` and
 * `ol`, and WebKit then no longer calls it a list, unless it stands in a `nav` or says
 * `role="list"`. A source check, since happy-dom computes no roles.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/** Lists that keep their role: in a `nav`, or with bullets of their own. */
const KEEP = [
  // In a nav.
  'lintje-breadcrumbs__list',
  'lintje-sub-nav__list',
  'lintje-navbar__pages',
  // With bullets.
  'lintje-error-summary__list',
  'lintje-graph__tip-list',
]

/** The editor's own markdown: written into the text, where `lintje-prose` draws the bullets. */
const PROSE = 'markdown.ts'

const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sources(path)
    const source = entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')
    return source && entry.name !== PROSE ? [path] : []
  })

describe('the lists of the templates', () => {
  it('say role="list" unless they stand in a nav or show bullets', () => {
    const offenders = sources('src').flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(/<(?:ul|ol)\b[^>]*>/g)]
        .map((match) => match[0].replace(/\s+/g, ' '))
        .filter((tag) => !/\brole=/.test(tag) && !KEEP.some((name) => tag.includes(name)))
        .map((tag) => `${file}: ${tag}`),
    )
    expect(offenders).toEqual([])
  })
})
