/** `<lintje-code>`: the line numbers are drawn for the eye and left out for a screen reader. */
import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { describe, expect, it } from 'vitest'

// Read from disk, not imported: vitest does not run the CSS pipeline, so an
// `?inline` import comes back empty.
const codeCss = readFileSync(resolvePath('src/components/content/code/code.css'), 'utf8')

describe('lintje-code', () => {
  it('gives the line number an empty alternative text', () => {
    const rule = codeCss.slice(codeCss.indexOf('.lintje-code--numbered .lintje-code__line::before'))
    expect(rule).toMatch(/content: counter\(lintje-code-line\) \/ '';/)
  })
})
