/** The filter field's label: a changed filter says so in words, not in an attribute ARIA forbids. */
import { describe, expect, it } from 'vitest'
import './field'
import type { LintjeField } from './field'

describe('lintje-field', () => {
  it('marks a changed filter with a hidden dot and words a screen reader reads', async () => {
    const element = Object.assign(document.createElement('lintje-field'), {
      label: 'Periode',
      modified: true,
    }) as LintjeField
    document.body.append(element)
    await element.updateComplete
    const dot = element.shadowRoot!.querySelector('.lintje-filter-field__dot')!
    expect(dot.getAttribute('aria-hidden')).toBe('true')
    expect(dot.hasAttribute('aria-label')).toBe(false)
    expect(element.shadowRoot!.querySelector('.visually-hidden')?.textContent).toBe(
      'afwijkend van standaard',
    )
  })
})
