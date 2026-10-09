/**
 * The date input: what it shows, what it sends, what it refuses, and the calendar's keys.
 * The arithmetic itself is `date-format.test.ts`.
 */
import { describe, expect, it } from 'vitest'
import './date-input'
import type { LintjeDateInput } from './date-input'

async function mount(props: Partial<LintjeDateInput> = {}): Promise<LintjeDateInput> {
  const element = Object.assign(document.createElement('lintje-date-input'), {
    label: 'Datum',
    today: '2026-10-04',
    ...props,
  })
  document.body.append(element)
  await element.updateComplete
  return element
}

const control = (element: LintjeDateInput): HTMLInputElement =>
  element.shadowRoot!.querySelector('.lintje-date-input__control')!
const toggle = (element: LintjeDateInput): HTMLButtonElement =>
  element.shadowRoot!.querySelector('.lintje-date-input__toggle')!
const cell = (element: LintjeDateInput, day: number): HTMLButtonElement =>
  [...element.shadowRoot!.querySelectorAll<HTMLButtonElement>('.lintje-date-input__day')].find(
    (button) => button.textContent!.trim() === String(day),
  )!

async function type(element: LintjeDateInput, text: string): Promise<void> {
  control(element).value = text
  control(element).dispatchEvent(new Event('change'))
  await element.updateComplete
}

function listen(element: LintjeDateInput): { local: unknown[]; values: unknown[] } {
  const seen = { local: [] as unknown[], values: [] as unknown[] }
  element.addEventListener('lintje-change', (event) =>
    seen.local.push((event as CustomEvent).detail),
  )
  element.addEventListener('lintje-values-change', (event) =>
    seen.values.push((event as CustomEvent).detail),
  )
  return seen
}

describe('lintje-date-input', () => {
  it('shows the ISO value as dd-mm-jjjj, with the hint tied to the field', async () => {
    const element = await mount({ value: '2026-10-03' })
    expect(control(element).value).toBe('03-10-2026')
    expect(control(element).getAttribute('inputmode')).toBe('numeric')
    const hint = element.shadowRoot!.querySelector('.lintje-field__hint')!
    expect(hint.textContent).toBe('dd-mm-jjjj')
    expect(control(element).getAttribute('aria-describedby')).toBe(hint.id)
    expect(toggle(element).getAttribute('aria-label')).toBe('Kalender openen')
    expect(toggle(element).getAttribute('aria-expanded')).toBe('false')
  })

  it('reads a short form, writes it back and sends ISO, to the host only with a name', async () => {
    const element = await mount({ name: 'p.datum' })
    const seen = listen(element)
    await type(element, '3.10.26')
    expect(control(element).value).toBe('03-10-2026')
    expect(element.value).toBe('2026-10-03')
    expect(seen.local).toEqual(['2026-10-03'])
    expect(seen.values).toEqual([{ 'p.datum': '2026-10-03' }])

    const loose = await mount()
    const looseSeen = listen(loose)
    await type(loose, '03-10-2026')
    expect(looseSeen.local).toEqual(['2026-10-03'])
    expect(looseSeen.values).toEqual([])
  })

  it('sends null for an emptied field', async () => {
    const element = await mount({ value: '2026-10-03' })
    const seen = listen(element)
    await type(element, '')
    expect(seen.local).toEqual([null])
  })

  it('refuses a day that does not exist: the message replaces the hint, nothing is sent', async () => {
    const element = await mount({ value: '2026-10-03' })
    const seen = listen(element)
    await type(element, '31-02-2026')
    const error = element.shadowRoot!.querySelector('.lintje-field__error')!
    expect(error.textContent).toContain('Deze datum bestaat niet')
    expect(element.shadowRoot!.querySelector('.lintje-field__hint')).toBeNull()
    expect(control(element).getAttribute('aria-invalid')).toBe('true')
    expect(control(element).getAttribute('aria-describedby')).toBe(error.id)
    expect(control(element).value).toBe('31-02-2026')
    expect(element.value).toBe('2026-10-03')
    expect(seen.local).toEqual([])
  })

  it('names the bound a day falls outside of', async () => {
    const element = await mount({ min: '2026-10-01', max: '2026-10-31' })
    await type(element, '30-09-2026')
    expect(element.shadowRoot!.textContent).toContain('Kies een datum op of na 01-10-2026')
    await type(element, '01-11-2026')
    expect(element.shadowRoot!.textContent).toContain('Kies een datum op of voor 31-10-2026')
  })

  it('lets the host error win over its own message', async () => {
    const element = await mount({ error: 'Vul de datum van de melding in' })
    await type(element, 'morgen')
    expect(element.shadowRoot!.querySelector('.lintje-field__error')!.textContent).toContain(
      'Vul de datum van de melding in',
    )
  })

  it('moves the day with the arrow keys in the field, held to the bounds', async () => {
    const element = await mount({ value: '2026-10-03', max: '2026-10-04' })
    const seen = listen(element)
    const press = (key: string) =>
      control(element).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
    press('ArrowUp')
    await element.updateComplete
    press('ArrowUp')
    await element.updateComplete
    press('ArrowDown')
    await element.updateComplete
    expect(seen.local).toEqual(['2026-10-04', '2026-10-03'])
  })

  it('picks today with the first arrow in an empty field', async () => {
    const element = await mount()
    const seen = listen(element)
    control(element).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
    await element.updateComplete
    expect(seen.local).toEqual(['2026-10-04'])
  })

  it('commits nothing while disabled', async () => {
    const element = await mount({ disabled: true })
    const seen = listen(element)
    expect(control(element).disabled).toBe(true)
    expect(toggle(element).disabled).toBe(true)
    await type(element, '03-10-2026')
    expect(seen.local).toEqual([])
  })
})

describe('the calendar', () => {
  it('opens as a dialog with a grid: the chosen day selected, today current', async () => {
    const element = await mount({ value: '2026-10-03' })
    toggle(element).click()
    await element.updateComplete
    expect(element.open).toBe(true)
    expect(toggle(element).getAttribute('aria-expanded')).toBe('true')
    const popover = element.shadowRoot!.querySelector('lintje-popover')!
    expect(popover.getAttribute('panel-role')).toBe('dialog')
    expect(element.shadowRoot!.querySelector('[role="grid"]')!.getAttribute('aria-label')).toBe(
      'oktober 2026',
    )
    expect(cell(element, 3).getAttribute('aria-selected')).toBe('true')
    expect(cell(element, 3).getAttribute('tabindex')).toBe('0')
    expect(cell(element, 4).getAttribute('aria-current')).toBe('date')
    // October 2026 starts on a Thursday: three empty cells before the first.
    const first = element.shadowRoot!.querySelectorAll('.lintje-date-input__row')[1]
    expect(first.querySelectorAll('.lintje-date-input__blank')).toHaveLength(3)
  })

  it('moves the focus with the keys and turns the month', async () => {
    const element = await mount({ value: '2026-10-03' })
    toggle(element).click()
    await element.updateComplete
    const grid = element.shadowRoot!.querySelector('[role="grid"]')!
    const press = async (key: string) => {
      grid.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
      await element.updateComplete
    }
    await press('ArrowDown')
    expect(cell(element, 10).getAttribute('tabindex')).toBe('0')
    await press('End')
    expect(cell(element, 11).getAttribute('tabindex')).toBe('0')
    await press('PageDown')
    expect(grid.getAttribute('aria-label')).toBe('november 2026')
    expect(cell(element, 11).getAttribute('tabindex')).toBe('0')
  })

  it('picks a day with a click and closes, without a Toepassen', async () => {
    const element = await mount({ value: '2026-10-03' })
    const seen = listen(element)
    toggle(element).click()
    await element.updateComplete
    cell(element, 15).click()
    await element.updateComplete
    expect(seen.local).toEqual(['2026-10-15'])
    expect(element.open).toBe(false)
    expect(control(element).value).toBe('15-10-2026')
  })

  it('refuses a day outside the bounds', async () => {
    const element = await mount({ value: '2026-10-03', max: '2026-10-10' })
    const seen = listen(element)
    toggle(element).click()
    await element.updateComplete
    expect(cell(element, 20).getAttribute('aria-disabled')).toBe('true')
    cell(element, 20).click()
    expect(seen.local).toEqual([])
    expect(element.open).toBe(true)
  })

  it('closes when its popover asks, and stops that request', async () => {
    const element = await mount()
    toggle(element).click()
    await element.updateComplete
    let escaped = 0
    document.addEventListener('lintje-close', () => escaped++, { once: true })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await element.updateComplete
    expect(element.open).toBe(false)
    expect(escaped).toBe(0)
  })

  it('closes when the focus leaves the element, so it does not cover the next field', async () => {
    const element = await mount({ value: '2026-10-03' })
    toggle(element).click()
    await element.updateComplete
    const outside = document.body.appendChild(document.createElement('button'))
    const leave = (to: Node | null): void => {
      cell(element, 3).dispatchEvent(
        new FocusEvent('focusout', { relatedTarget: to, bubbles: true, composed: true }),
      )
    }
    leave(toggle(element))
    leave(null)
    await element.updateComplete
    expect(element.open).toBe(true)
    leave(outside)
    await element.updateComplete
    expect(element.open).toBe(false)
  })
})
