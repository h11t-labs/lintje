/**
 * The token reference is read from `tokens.css` (`scripts/tokens.mjs`) and shown on the style
 * guide's Fundament pages (`examples/styleguide/foundation.js`): every token a component may
 * name, with its comment, on one page and in a group of its own.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { tokensOf } from '../../scripts/tokens.mjs'

interface Foundation {
  pageOf: (name: string) => string | undefined
  groupsOf: (
    page: string,
    tokens: { name: string }[],
  ) => { id: string; tokens: { name: string }[] }[]
}

const [foundation] = Object.values(
  import.meta.glob<Foundation>('../../examples/styleguide/foundation.js', { eager: true }),
) as Foundation[]

// Read from disk: vitest runs no CSS pipeline, so a `?raw` import comes back empty.
const tokens = tokensOf(readFileSync('src/tokens/tokens.css', 'utf8'))
const names = tokens.map((token) => token.name)
const comment = (name: string) => tokens.find((token) => token.name === name)?.comment

const sample = `
/* ==========
   Layers 2 and 3 — semantic and component tokens (light)
   ========== */
:root {
  /* --- Section ---------- */
  /* Above the first, over
     two lines. */
  --one: 1px;
  --two: 2px; /* behind the second */
  /* Parted by a blank line. */

  --three: 3px;
  --four: 4ms; /* @kind other */
}
`

describe('the token reference', () => {
  it('takes the comment above a token or behind it, and no heading or tooling note', () => {
    expect(tokensOf(sample)).toEqual([
      { name: '--one', comment: 'Above the first, over two lines.' },
      { name: '--two', comment: 'behind the second' },
      { name: '--three', comment: '' },
      { name: '--four', comment: '' },
    ])
  })

  it('holds the semantic and component tokens, and no primitive', () => {
    expect(names).toContain('--color-bg-surface')
    expect(names).toContain('--space-4')
    expect(names).toContain('--text-h1')
    expect(
      names.filter((name) => /^--(neutral|data|status|ink|primary|accent)(-|$)/.test(name)),
    ).toEqual([])
    expect(new Set(names).size).toBe(names.length)
    expect(comment('--color-text-placeholder')).toMatch(/4\.5:1/)
  })
})

describe('the Fundament pages', () => {
  const pages = ['colour', 'typography', 'size']
  const shown = pages.flatMap((page) =>
    foundation!.groupsOf(page, tokens).flatMap((group) => group.tokens.map((token) => token.name)),
  )

  it('show every token once', () => {
    expect([...shown].sort()).toEqual([...names].sort())
  })

  it('give every token a group of its own, so "Overige" stays empty', () => {
    const rest = pages.flatMap((page) =>
      foundation!
        .groupsOf(page, tokens)
        .filter((group) => group.id === 'other')
        .flatMap((group) => group.tokens.map((token) => token.name)),
    )
    expect(rest).toEqual([])
  })
})
