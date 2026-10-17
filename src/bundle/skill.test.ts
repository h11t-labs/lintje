/**
 * The skill for a host (`skills/lintje/`) runs as plain Node in the host's project: its scripts
 * are tested as a host runs them, on a `tokens.json` as the build writes it.
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { tokensOf } from '../../scripts/tokens.mjs'

const dir = mkdtempSync(join(tmpdir(), 'lintje-skill-'))
const reference = join(dir, 'tokens.json')
writeFileSync(
  reference,
  JSON.stringify({ tokens: tokensOf(readFileSync('src/tokens/tokens.css', 'utf8')) }),
)

const run = (script: string, ...args: string[]) => {
  const result = spawnSync(process.execPath, [`skills/lintje/${script}`, ...args], {
    encoding: 'utf8',
  })
  return { status: result.status, out: result.stdout, lines: result.stdout.trim().split('\n') }
}

describe('reference.mjs on tokens.json', () => {
  it('lists every token under its group, and no primitive', () => {
    const { status, out } = run('reference.mjs', reference)
    expect(status).toBe(0)
    expect(out).toMatch(/^Typography\n {2}--font-ui/)
    expect(out).toMatch(/\nSemantic: surfaces\n {2}--color-bg-page\n/)
    expect(out).not.toMatch(/^ {2}--(neutral|data|status|primary)-/m)
  })

  it('keeps the tokens or groups with the word', () => {
    const { lines } = run('reference.mjs', reference, 'bg')
    expect(lines[0]).toBe('Semantic: surfaces')
    expect(lines.filter((line) => line.startsWith('  ')).every((line) => line.includes('bg'))).toBe(
      true,
    )
    expect(run('reference.mjs', reference, 'motion').out).toContain('--dur-base')
    expect(run('reference.mjs', reference, 'nothing-like-this').status).toBe(1)
  })
})

describe('check.mjs', () => {
  const page = join(dir, 'page.html')
  writeFileSync(
    page,
    `<html data-theme="own">
<style>
  [data-theme='own'] { --primary: #603a96; --accent: #e17000; }
  .own { --own-width: 10rem; width: var(--own-width); }
  #app, .x:not(#abc) { gap: var(--space-4); }
  .a { color: #ff0000; }
  .b { background: var(--neutral-0); }
  .c { border-color: var(--color-bg-nothing); }
  .d { padding: var(--space-2) 13px; }
</style>
<a href="#abc" style="margin: 0 var(--space-4)">Terug</a>
<button>Opslaan</button>
<lintje-form-actions><button>Annuleren</button></lintje-form-actions>
<input type="hidden" name="id">
</html>
`,
  )

  it('reports each kind of finding with its line, and a covered element as a hint', () => {
    const { status, lines } = run('check.mjs', reference, page)
    expect(status).toBe(1)
    expect(lines).toEqual([
      `${page}:6  fout  color: #ff0000  een literal kleur → --color-text-*`,
      `${page}:7  fout  var(--neutral-0)  een primitief → --color-bg-*`,
      `${page}:8  fout  var(--color-bg-nothing)  bestaat niet in tokens.json`,
      `${page}:9  fout  padding: 13px  buiten de 4 px-schaal → var(--space-3)`,
      `${page}:12  hint  <button>  daarvoor is lintje-button of lintje-icon-button`,
      '4 fout(en), 1 hint(s)',
    ])
  })

  it('names the semantic token a primitive stands for, and passes a clean stylesheet', () => {
    const sheet = join(dir, 'page.css')
    writeFileSync(sheet, '.e {\n  color: var(--status-error);\n}\n')
    expect(run('check.mjs', reference, sheet).lines[0]).toBe(
      `${sheet}:2  fout  var(--status-error)  een primitief → --color-error`,
    )
    writeFileSync(sheet, '.e { color: var(--color-text-primary); padding: var(--space-4) 0; }\n')
    expect(run('check.mjs', reference, sheet)).toMatchObject({
      status: 0,
      lines: ['Geen vondsten.'],
    })
  })
})
