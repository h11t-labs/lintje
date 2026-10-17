/**
 * The open month grid of both calendars, under the axe rules for roles and the structure of a
 * grid. The styleguide test runs only the WCAG-tagged rules, and these are best practices. axe
 * allows `gridcell` on a button, so the grid's own check is that it holds no button.
 */
import axe from 'axe-core'
import { afterEach, describe, expect, it } from 'vitest'
import '../inputs/date-input/date-input'
import '../inputs/date-range/date-range'

const RULES = ['aria-allowed-role', 'aria-required-children', 'aria-required-parent']

afterEach(() => {
  document.body.replaceChildren()
})

async function open(tag: 'lintje-date-input' | 'lintje-date-range'): Promise<void> {
  const element = Object.assign(document.createElement(tag), { label: 'Datum' })
  document.body.append(element)
  await element.updateComplete
  element
    .shadowRoot!.querySelector<HTMLButtonElement>(
      '.lintje-date-input__toggle, .lintje-date-range-picker__field',
    )!
    .click()
  await element.updateComplete
  await element.updateComplete
}

describe('the month grid under axe', () => {
  for (const tag of ['lintje-date-input', 'lintje-date-range'] as const) {
    it(`finds no role out of place in the open calendar of ${tag}`, async () => {
      await open(tag)
      const host = document.querySelector(tag)!
      expect(host.shadowRoot!.querySelectorAll('.lintje-month-grid__day').length).toBeGreaterThan(
        27,
      )
      expect(host.shadowRoot!.querySelectorAll('[role="grid"] button')).toHaveLength(0)
      const { violations, passes } = await axe.run(document.body, {
        runOnly: { type: 'rule', values: RULES },
      })
      const found = violations.flatMap((violation) =>
        violation.nodes.map((node) => `${violation.id} @ ${node.target.flat().join(' >> ')}`),
      )
      expect(found).toEqual([])
      // The rules looked at the grid: a run that saw nothing would pass as well.
      expect(passes.map((rule) => rule.id)).toEqual(expect.arrayContaining(RULES))
    })
  }
})
