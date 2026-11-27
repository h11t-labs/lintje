/**
 * Every `var(--name)` under `src/` names a custom property that is declared somewhere, or gives
 * a fallback: an undeclared name makes the whole declaration invalid, so it drops without a word.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/** Declared in a stylesheet or an inline style: `--name: …`. */
const DECLARATION = /(?<![\w-])(--[a-z][\w-]*)\s*:/gi
/** Declared from script: `style.setProperty('--name', …)` or a key of `styleProps({ '--name': … })`. */
const SCRIPTED = /setProperty\(\s*['"`](--[a-z][\w-]*)['"`]|['"`](--[a-z][\w-]*)['"`]\s*:/gi
/** A use without a fallback; a name built in a template literal (`--x-${…}`) is left alone. */
const USE = /var\(\s*(--[a-z][\w-]*)\s*\)/gi

const SOURCE = /\.(?:css|ts|js|mjs|html)$/

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : files(path)
    // A test sets and reads properties of its own; it declares nothing for the library.
    return SOURCE.test(entry.name) && !entry.name.includes('.test.') ? [path] : []
  })

// Blank out comments but keep their newlines, so the line numbers stay right.
const withoutComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))

const declaredIn = (source: string): string[] => {
  const text = withoutComments(source)
  return [
    ...[...text.matchAll(DECLARATION)].map((match) => match[1]!),
    ...[...text.matchAll(SCRIPTED)].map((match) => (match[1] ?? match[2])!),
  ]
}

/** Every use in one file of a name that is not in `declared`, as `file:line  name`. */
const undeclared = (file: string, source: string, declared: Set<string>): string[] => {
  const text = withoutComments(source)
  return [...text.matchAll(USE)]
    .filter((match) => !declared.has(match[1]!))
    .map((match) => `${file}:${text.slice(0, match.index).split('\n').length}  ${match[1]}`)
}

describe('custom properties', () => {
  it('flags a use without a declaration or a fallback, and nothing else', () => {
    const css = `
      .a { --gap: 4px; padding: var(--gap); }
      .b { margin: var(--missing); top: var(--missing, 0); }
      /* var(--in-a-comment) */
    `
    const script = `
      el.style.setProperty('--set', '1')
      styleProps({ '--keyed': 2, color: 'var(--keyed)' })
      const name = \`var(--built-\${x})\`
    `
    const declared = new Set([...declaredIn(css), ...declaredIn(script)])
    expect(undeclared('x.css', css, declared)).toEqual(['x.css:3  --missing'])
    expect(undeclared('x.ts', `${script} var(--set)`, declared)).toEqual([])
  })

  it('holds for every use under src/, with what src/ and examples/ declare', () => {
    const sources = files('src')
    const declared = new Set(
      [...sources, ...files('examples')].flatMap((file) => declaredIn(readFileSync(file, 'utf8'))),
    )
    const offences = sources.flatMap((file) =>
      undeclared(file, readFileSync(file, 'utf8'), declared),
    )
    expect(offences).toEqual([])
  })
})
