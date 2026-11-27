/**
 * A state class (`is-*`, `has-*`) that an element draws has a rule in the CSS the element
 * itself imports; one without a rule and without a use leaves the template.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/** Drawn without a rule, each for its reason. */
const KNOWN: Record<string, string[]> = {
  // The contrast contract and the chat test find the replaced answer by it.
  'src/components/chat/chat/chat.ts': ['is-replaced'],
  // The card test finds the loading card by it.
  'src/components/tables/card/card.ts': ['is-loading'],
  // No rule and no use yet; outside #376, for their own issue.
  'src/components/chat/chat-composer/chat-composer.ts': ['is-dragging'],
  'src/components/content/log-viewer/log-viewer.ts': ['is-open'],
  'src/components/tables/person-group/person-group.ts': ['is-empty'],
}

const STATE = /(?<![\w-])((?:is|has)-[a-z][a-z0-9-]*)(?![\w-])/g
const SHEET = /from '(\.[^']+\.css)\?inline'/g

function unstyled(): string[] {
  const files = readdirSync('src/components', { recursive: true })
    .map(String)
    .filter((file) => file.endsWith('.ts') && !file.includes('.test.'))
    .map((file) => join('src/components', file))
  const found: string[] = []
  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    const sheets = [...source.matchAll(SHEET)].map((match) => resolve(dirname(file), match[1]))
    // A module without a sheet of its own is a helper: the element that imports it styles it.
    if (!sheets.length) continue
    const css = sheets.map((sheet) => readFileSync(sheet, 'utf8')).join('\n')
    const drawn = new Set([...source.matchAll(STATE)].map((match) => match[1]))
    for (const name of drawn) {
      if (KNOWN[file]?.includes(name)) continue
      if (!new RegExp(`\\.${name}(?![\\w-])`).test(css)) found.push(`${file}: ${name}`)
    }
  }
  return found
}

describe('state classes', () => {
  it('have a rule in the CSS of the element that draws them', () => {
    expect(unstyled()).toEqual([])
  })
})
