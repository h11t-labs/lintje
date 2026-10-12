/**
 * The code the style guide shows under a specimen (`examples/styleguide/code.js`): what a reader
 * copies has to parse, and what is cut for reading has to say so.
 */
import { describe, expect, it } from 'vitest'

interface Code {
  format: (value: unknown, options?: { short?: boolean; js?: boolean }) => string
  dedent: (text: string) => string
}

const [code] = Object.values(
  import.meta.glob<Code>('../../examples/styleguide/code.js', { eager: true }),
) as Code[]
const { format, dedent } = code!

const VALUE = {
  chart: {
    kind: 'pie',
    donut: true,
    segments: Array.from({ length: 9 }, (_, i) => ({ label: `Deel ${i}`, value: i })),
  },
  description: 'Een beschrijving die lang genoeg is om de regel niet op één regel te laten passen.',
  hidden: undefined,
  onClick: () => {},
}

describe('the code under a specimen', () => {
  it('copies JSON that parses, without what JSON cannot hold', () => {
    const parsed = JSON.parse(format(VALUE))
    expect(parsed).toEqual({ chart: VALUE.chart, description: VALUE.description })
  })

  it('cuts a long list for reading, and says how much it left out', () => {
    const text = format(VALUE, { short: true })
    expect(text).toContain('/* … 6 meer */')
    expect(text.match(/Deel \d/g)).toHaveLength(3)
  })

  it('writes a script with bare keys and a comma after each entry', () => {
    const text = format(VALUE, { js: true })
    expect(text).toMatch(/^ {2}chart: \{/m)
    expect(text).toMatch(/,\n\}$/)
  })

  it('keeps a short object on one line', () => {
    expect(format({ filename: 'demo' })).toBe('{ "filename": "demo" }')
  })

  it('takes the indentation of a template literal off markup', () => {
    expect(
      dedent(`<div>
            <span></span>
          </div>`),
    ).toBe('<div>\n  <span></span>\n</div>')
  })
})
