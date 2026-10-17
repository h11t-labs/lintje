/**
 * The one month grid, as the date input and the date range draw it: the same rows, the same
 * today, and the CSS of a day in one place.
 */
import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import '../inputs/date-input/date-input'
import '../inputs/date-range/date-range'

// Read from disk, not imported: vitest does not run the CSS pipeline.
const css = (path: string): string =>
  readFileSync(resolvePath(`src/components/${path}`), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

beforeEach(() => {
  document.body.innerHTML = ''
})

/** Both calendars open on February 2027: it starts on a Monday and has 28 days. */
async function calendars(): Promise<ShadowRoot[]> {
  const input = Object.assign(document.createElement('lintje-date-input'), {
    label: 'Datum',
    today: '2027-02-10',
  })
  const range = Object.assign(document.createElement('lintje-date-range'), {
    label: 'Periode',
    today: new Date(2027, 1, 10),
  })
  document.body.append(input, range)
  await Promise.all([input.updateComplete, range.updateComplete])
  input.shadowRoot!.querySelector<HTMLButtonElement>('.lintje-date-input__toggle')!.click()
  range.shadowRoot!.querySelector<HTMLButtonElement>('.lintje-date-range-picker__field')!.click()
  await Promise.all([input.updateComplete, range.updateComplete])
  return [input.shadowRoot!, range.shadowRoot!]
}

describe('the month grid', () => {
  it('has as many rows as the month has weeks, in both calendars', async () => {
    for (const root of await calendars()) {
      const grid = root.querySelector('.lintje-month-grid')!
      expect(grid.getAttribute('aria-label')).toBe('februari 2027')
      // The weekdays, then four weeks.
      expect(grid.querySelectorAll(':scope > [role="row"]')).toHaveLength(5)
      expect(grid.querySelectorAll('.lintje-month-grid__blank')).toHaveLength(0)
    }
  })

  it('marks today the same way in both calendars, with a ring in the accent line', async () => {
    for (const root of await calendars()) {
      const today = root.querySelector('.lintje-month-grid__day.is-today')!
      expect(today.textContent!.trim()).toBe('10')
      expect(today.getAttribute('aria-current')).toBe('date')
    }
    expect(css('shared/month-grid.css')).toMatch(
      /\.lintje-month-grid__day\.is-today\s*\{\s*box-shadow: inset 0 0 0 1px var\(--color-accent-line\);/,
    )
  })

  it('is drawn by neither element itself', () => {
    for (const path of ['inputs/date-input/date-input.css', 'inputs/date-range/date-range.css'])
      expect(css(path)).not.toMatch(/__(day|weekday|grid)\b|is-today|is-in-range/)
  })
})
