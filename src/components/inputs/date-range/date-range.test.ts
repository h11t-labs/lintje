/**
 * The period presets: which days each one stands for. Two kinds — the last so many days,
 * counted back from today, and the calendar's week and month — and a period that is still
 * running ends at the last day the data allows. Then the element: what its field and its
 * calendar say, the calendar's keys, and where the focus goes when the popover closes.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { PRESETS, presetRange, type DateRange, type LintjeDateRange } from './date-range'
import type { LintjeButton } from '../../actions/button/button'

beforeEach(() => {
  document.body.innerHTML = ''
})

// Wednesday 7 October 2026.
const TODAY = new Date(2026, 9, 7)

describe('the period presets', () => {
  it('offers the days, the last 7 and 30 days, and the calendar week and month', () => {
    expect(PRESETS.map(([name]) => name)).toEqual([
      'Vandaag',
      'Gisteren',
      'Afgelopen 7 dagen',
      'Afgelopen 30 dagen',
      'Deze week',
      'Vorige week',
      'Deze maand',
      'Kwartaal',
    ])
  })

  it('counts the last 7 and 30 days back from today, today included', () => {
    expect(presetRange('Afgelopen 7 dagen', TODAY)).toEqual({
      from: '01-10-2026',
      to: '07-10-2026',
    })
    expect(presetRange('Afgelopen 30 dagen', TODAY)).toEqual({
      from: '08-09-2026',
      to: '07-10-2026',
    })
  })

  it('takes this week and last week from Monday to Sunday', () => {
    expect(presetRange('Deze week', TODAY)).toEqual({ from: '05-10-2026', to: '11-10-2026' })
    expect(presetRange('Vorige week', TODAY)).toEqual({ from: '28-09-2026', to: '04-10-2026' })
    // A Sunday belongs to the week that started the Monday before it.
    expect(presetRange('Deze week', new Date(2026, 9, 11))).toEqual({
      from: '05-10-2026',
      to: '11-10-2026',
    })
  })

  it('takes this month from its first to its last day', () => {
    expect(presetRange('Deze maand', TODAY)).toEqual({ from: '01-10-2026', to: '31-10-2026' })
    expect(presetRange('Deze maand', new Date(2028, 1, 10))).toEqual({
      from: '01-02-2028',
      to: '29-02-2028',
    })
  })

  it('ends a period that is still running at the last day the data allows', () => {
    expect(presetRange('Deze week', TODAY, TODAY)).toEqual({ from: '05-10-2026', to: '07-10-2026' })
    expect(presetRange('Deze maand', TODAY, TODAY)).toEqual({
      from: '01-10-2026',
      to: '07-10-2026',
    })
    expect(presetRange('Vorige week', TODAY, TODAY)).toEqual({
      from: '28-09-2026',
      to: '04-10-2026',
    })
  })

  it('knows no other name', () => {
    expect(presetRange('Dit jaar', TODAY)).toBeNull()
  })
})

async function mount(props: Partial<LintjeDateRange> = {}): Promise<LintjeDateRange> {
  const element = Object.assign(document.createElement('lintje-date-range'), {
    label: 'Periode',
    today: TODAY,
    ...props,
  })
  document.body.append(element)
  await element.updateComplete
  return element
}

const field = (element: LintjeDateRange): HTMLButtonElement =>
  element.shadowRoot!.querySelector('.lintje-date-range-picker__field')!
const days = (element: LintjeDateRange): HTMLElement[] => [
  ...element.shadowRoot!.querySelectorAll<HTMLElement>('.lintje-month-grid__day'),
]
/** A day of the month in view; the weeks around it are blank. */
const cell = (element: LintjeDateRange, day: number): HTMLElement =>
  days(element).find((node) => node.textContent!.trim() === `${day}`)!
const grid = (element: LintjeDateRange): HTMLElement =>
  element.shadowRoot!.querySelector('[role="grid"]')!

async function openWith(
  range: DateRange,
  props: Partial<LintjeDateRange> = {},
): Promise<LintjeDateRange> {
  const element = await mount({ range, ...props })
  field(element).click()
  await element.updateComplete
  return element
}

describe('lintje-date-range', () => {
  it('names its field by the label and the chosen range, or says there is none', async () => {
    const element = await mount()
    expect(field(element).getAttribute('aria-label')).toBe('Periode, geen periode gekozen')
    element.range = { from: '01-10-2026', to: '07-10-2026' }
    await element.updateComplete
    expect(field(element).getAttribute('aria-label')).toBe('Periode, 01-10-2026 – 07-10-2026')
  })

  it('draws the calendar as a grid of weeks with one tab stop', async () => {
    const element = await openWith({ from: '05-10-2026', to: '07-10-2026' })
    // October 2026 spans five weeks, under the row of weekdays.
    const rows = grid(element).querySelectorAll(':scope > [role="row"]')
    expect(rows).toHaveLength(6)
    expect(rows[0].querySelectorAll('[role="columnheader"]')).toHaveLength(7)
    expect(rows[1].querySelectorAll('[role="gridcell"]')).toHaveLength(7)
    expect(grid(element).getAttribute('aria-label')).toBe('oktober 2026')
    // A range selects every day in it, so the grid takes more than one.
    expect(grid(element).getAttribute('aria-multiselectable')).toBe('true')
    const stops = days(element).filter((day) => day.getAttribute('tabindex') === '0')
    expect(stops).toEqual([cell(element, 5)])
  })

  it('says which day begins and ends the range and which lie in it, besides the fill', async () => {
    const element = await openWith({ from: '05-10-2026', to: '07-10-2026' })
    expect(cell(element, 5).getAttribute('aria-label')).toBe('maandag 5 oktober 2026, begindatum')
    expect(cell(element, 6).getAttribute('aria-label')).toBe('dinsdag 6 oktober 2026, in periode')
    expect(cell(element, 7).getAttribute('aria-label')).toBe('woensdag 7 oktober 2026, einddatum')
    for (const day of [5, 6, 7])
      expect(cell(element, day).getAttribute('aria-selected')).toBe('true')
    expect(cell(element, 8).getAttribute('aria-selected')).toBe('false')
    expect(cell(element, 7).getAttribute('aria-current')).toBe('date')
  })

  it('fills every day between start and end, across a week, and names it in the period', async () => {
    const element = await openWith({ from: '02-10-2026', to: '13-10-2026' })
    const inside = days(element).filter((day) => day.classList.contains('is-in-range'))
    expect(inside.map((day) => Number(day.textContent))).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    for (const day of inside) expect(day.getAttribute('aria-label')).toMatch(/, in periode$/)
    for (const day of [2, 13]) {
      expect(cell(element, day).classList.contains('is-in-range')).toBe(false)
      expect(cell(element, day).classList.contains('is-selected')).toBe(true)
    }
  })

  it('moves the tab stop with the keys and turns the month on PageDown', async () => {
    const element = await openWith({ from: '05-10-2026', to: '07-10-2026' })
    const press = async (key: string): Promise<void> => {
      grid(element).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
      await element.updateComplete
    }
    await press('ArrowDown')
    expect(cell(element, 12).getAttribute('tabindex')).toBe('0')
    await press('End')
    expect(cell(element, 18).getAttribute('tabindex')).toBe('0')
    expect(element.shadowRoot!.activeElement).toBe(cell(element, 18))
    await press('PageDown')
    expect(grid(element).getAttribute('aria-label')).toBe('november 2026')
    expect(cell(element, 18).getAttribute('tabindex')).toBe('0')
  })

  it('keeps a day after the last allowed one focusable, and refuses it', async () => {
    const element = await openWith({ from: null, to: null }, { maxDate: TODAY })
    expect(cell(element, 8).getAttribute('aria-disabled')).toBe('true')
    expect(cell(element, 8).getAttribute('tabindex')).toBe('-1')
    cell(element, 8).click()
    await element.updateComplete
    expect(element.draft).toEqual({ from: null, to: null })
  })

  it('gives the focus back to the field on Escape and after Toepassen', async () => {
    const element = await openWith({ from: '05-10-2026', to: '07-10-2026' })
    cell(element, 5).focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await element.updateComplete
    await element.updateComplete
    expect(element.open).toBe(false)
    expect(element.shadowRoot!.activeElement).toBe(field(element))

    const seen: unknown[] = []
    element.addEventListener('lintje-change', (event) => seen.push((event as CustomEvent).detail))
    field(element).click()
    await element.updateComplete
    const apply = [...element.shadowRoot!.querySelectorAll('lintje-button')].find(
      (button) => button.textContent!.trim() === 'Toepassen',
    )!
    // happy-dom has no `delegatesFocus`: the inner button, as a browser would focus it.
    apply.shadowRoot!.querySelector('button')!.focus()
    apply.click()
    await element.updateComplete
    await element.updateComplete
    expect(seen).toEqual([{ from: '05-10-2026', to: '07-10-2026' }])
    expect(element.open).toBe(false)
    expect(element.shadowRoot!.activeElement).toBe(field(element))
  })

  it('closes when the focus leaves the element, not when it moves inside or to nothing', async () => {
    const element = await openWith({ from: null, to: null })
    const outside = document.body.appendChild(document.createElement('button'))
    const leave = (to: Node | null): void => {
      cell(element, 7).dispatchEvent(
        new FocusEvent('focusout', { relatedTarget: to, bubbles: true, composed: true }),
      )
    }
    leave(cell(element, 8))
    leave(null)
    // A press on the popover's text, inside a focusable box such as the shell's main region.
    leave(document.body)
    await element.updateComplete
    expect(element.open).toBe(true)
    leave(outside)
    await element.updateComplete
    expect(element.open).toBe(false)
  })

  it('applies "Wissen" over a chosen range, and nothing over an empty one', async () => {
    const element = await openWith({ from: '05-10-2026', to: '07-10-2026' })
    const button = (name: string): LintjeButton =>
      [...element.shadowRoot!.querySelectorAll<LintjeButton>('lintje-button')].find(
        (candidate) => candidate.textContent!.trim() === name,
      )!
    const changes: unknown[] = []
    element.addEventListener('lintje-change', (event) =>
      changes.push((event as CustomEvent).detail),
    )
    button('Wissen').click()
    await element.updateComplete
    expect(button('Toepassen').disabled).toBe(false)
    button('Toepassen').click()
    await element.updateComplete
    expect(changes).toEqual([{ from: null, to: null }])
    expect(element.open).toBe(false)

    const empty = await openWith({ from: null, to: null })
    const apply = [...empty.shadowRoot!.querySelectorAll<LintjeButton>('lintje-button')].find(
      (candidate) => candidate.textContent!.trim() === 'Toepassen',
    )!
    expect(apply.disabled).toBe(true)
  })

  it('makes the month heading and the chosen range live', async () => {
    const element = await openWith({ from: null, to: null })
    const live = element.shadowRoot!.querySelectorAll('[aria-live="polite"]')
    expect([...live].map((node) => node.textContent!.trim())).toEqual([
      'oktober 2026',
      'Kies een begin- en einddatum',
    ])
  })

  it('draws each day as a cell of the grid, not as a button with the role of one', async () => {
    const element = await openWith({ from: '05-10-2026', to: '07-10-2026' })
    expect(grid(element).querySelectorAll('button[role]')).toHaveLength(0)
    expect(days(element)).toHaveLength(31)
    for (const day of days(element)) {
      expect(day.localName).not.toBe('button')
      expect(day.getAttribute('role')).toBe('gridcell')
      expect(day.getAttribute('tabindex')).toMatch(/^(0|-1)$/)
      expect(day.getAttribute('aria-label')).toBeTruthy()
      expect(day.getAttribute('aria-selected')).toMatch(/^(true|false)$/)
    }
    expect(days(element).filter((day) => day.getAttribute('tabindex') === '0')).toEqual([
      cell(element, 5),
    ])
  })

  for (const key of ['Enter', ' ']) {
    it(`picks the day with the focus on ${key === ' ' ? 'Space' : key}, as a click does`, async () => {
      const clicked = await openWith({ from: null, to: null }, { maxDate: TODAY })
      cell(clicked, 7).click()
      await clicked.updateComplete

      const element = await openWith({ from: null, to: null }, { maxDate: TODAY })
      const press = async (name: string): Promise<KeyboardEvent> => {
        const event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true })
        grid(element).querySelector('[tabindex="0"]')!.dispatchEvent(event)
        await element.updateComplete
        return event
      }
      // A click focuses a blocked day without moving the tab stop: the key acts on that day.
      cell(element, 8).click()
      cell(element, 8).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
      await element.updateComplete
      expect(element.draft).toEqual({ from: null, to: null })
      // The tab stop starts on today; the day after it is past `maxDate` and picks nothing.
      await press('ArrowRight')
      expect(cell(element, 8).getAttribute('tabindex')).toBe('0')
      expect((await press(key)).defaultPrevented).toBe(true)
      expect(element.draft).toEqual({ from: null, to: null })
      await press('ArrowLeft')
      await press(key)
      expect(element.draft).toEqual(clicked.draft)
      expect(element.draft.from).toBe('07-10-2026')
    })
  }
})
