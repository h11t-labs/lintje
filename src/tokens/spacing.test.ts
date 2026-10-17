/**
 * All space lies on the 4 px scale (`--space-*`): a spacing property in any stylesheet under
 * `src/` holds no px value that is not a multiple of 4, also not inside a `calc()`.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * What counts as space. Not checked, and free of the scale: `border-*` and `outline-*` (the
 * focus ring, the thickness of a line or bar), `font-*`, `width`/`height` and their limits (the
 * fixed sizes `--h-*`/`--w-*`), `transform` and svg geometry. Nor is a custom property: a space
 * that makes up for a line names that line once (`--lintje-tile-border`) and computes with it.
 */
const SPACING =
  /^(?:(?:padding|margin|scroll-padding|scroll-margin|inset)(?:-[a-z-]+)?|(?:row-|column-)?gap|border-spacing|top|right|bottom|left)$/

const PX = /(?<![\w.-])-?(\d*\.?\d+)px\b/g

interface Offence {
  file: string
  line: number
  declaration: string
}

const stylesheets = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return stylesheets(path)
    return entry.name.endsWith('.css') ? [path] : []
  })

const px = (value: string) => [...value.matchAll(PX)].map((match) => Number(match[1]))

/**
 * The 1 px sentinel (`height: 1px; margin-bottom: -1px`, in the shell and the filter bar): an
 * IntersectionObserver watches it, and the margin cancels its own height, so it takes no space.
 */
const sentinel = (property: string, value: string, block: Map<string, string>) =>
  property === 'margin-bottom' && value.trim() === '-1px' && block.get('height')?.trim() === '1px'

/** Every spacing declaration off the scale in one stylesheet. */
const offScale = (file: string, css: string): Offence[] => {
  // Blank out comments but keep their newlines, so the line numbers stay right.
  const source = css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
  const lineAt = (offset: number) => source.slice(0, offset).split('\n').length
  const offences: Offence[] = []
  for (const body of source.matchAll(/\{([^{}]*)\}/g)) {
    const start = body.index + 1
    const declarations = [...body[1]!.matchAll(/([a-z-]+)\s*:\s*([^;]+)/g)]
    const block = new Map(declarations.map(([, property, value]) => [property!, value!]))
    for (const declaration of declarations) {
      const [text, property, value] = declaration as unknown as [string, string, string]
      if (!SPACING.test(property) || sentinel(property, value, block)) continue
      if (px(value).every((n) => n % 4 === 0)) continue
      offences.push({
        file,
        line: lineAt(start + declaration.index),
        declaration: text.trim(),
      })
    }
  }
  return offences
}

describe('the 4 px scale', () => {
  it('flags space off the scale, also inside a calc(), and nothing else', () => {
    const css = `
      .a { padding: 10px var(--space-2); border-top: 1px solid; width: 14px; }
      @media (min-width: 768px) { .b { margin-top: calc(var(--h-row) - 2px); gap: 8px; } }
      .c { height: 1px; margin-bottom: -1px; }
      .d { width: 1px; height: 1px; margin: -1px; top: 0; --x: 3px; }
    `
    expect(offScale('x.css', css).map((o) => `${o.line} ${o.declaration}`)).toEqual([
      '2 padding: 10px var(--space-2)',
      '3 margin-top: calc(var(--h-row) - 2px)',
      '5 margin: -1px',
    ])
  })

  it('holds for every stylesheet under src/', () => {
    const offences = stylesheets('src').flatMap((file) =>
      offScale(file, readFileSync(file, 'utf8')),
    )
    expect(offences.map((o) => `${o.file}:${o.line}  ${o.declaration}`)).toEqual([])
  })
})
