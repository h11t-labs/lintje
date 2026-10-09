/**
 * Inline styles under the host's `style-src 'self'` (`npm test`).
 *
 * Two halves. The directive itself is rendered here: it must write the
 * declarations through the CSSOM, because a browser under that policy throws
 * away what a `style` *attribute* carries — which is how the chart tooltip lost
 * its `top` and stood 250 px below the pointer, a pie segment lifted around
 * 0,0 and every swatch lost its colour.
 *
 * The other half is the rule that keeps it that way: no template in `src/` may
 * bind the `style` attribute, `styleMap` included — its first commit is that
 * same attribute. happy-dom applies no policy, so that half is a source check.
 */
import { html, render } from 'lit'
import { describe, expect, it } from 'vitest'
import { styleProps } from './style-props'

describe('styleProps', () => {
  it('sets the declarations through the CSSOM', () => {
    const host = document.createElement('div')
    render(
      html`<p ${styleProps({ top: '12px', minHeight: '40px', '--lintje-stagger': '0.5' })}></p>`,
      host,
    )
    const element = host.querySelector('p')!
    expect(element.style.top).toBe('12px')
    expect(element.style.getPropertyValue('min-height')).toBe('40px')
    expect(element.style.getPropertyValue('--lintje-stagger')).toBe('0.5')
  })

  it('removes a property that is gone on the next render', () => {
    const host = document.createElement('div')
    const paint = (color: string | null) =>
      render(html`<p ${styleProps({ background: color })}></p>`, host)
    paint('red')
    const element = host.querySelector('p')!
    expect(element.style.background).toBe('red')
    paint(null)
    expect(element.style.background).toBe('')
  })
})

describe('the templates', () => {
  it('bind no style attribute anywhere in src/', () => {
    const sources = import.meta.glob('../**/*.ts', {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>
    /** Without the comments: this file's own prose names both of them. */
    const code = (source: string) =>
      source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    const offenders = Object.entries(sources)
      .filter(
        ([path, source]) =>
          !path.endsWith('.test.ts') && /\bstyle=|\bstyleMap\(/.test(code(source)),
      )
      .map(([path]) => path)
    expect(offenders).toEqual([])
  })
})
