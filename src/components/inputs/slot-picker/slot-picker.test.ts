/**
 * The slot picker's markup: which time is checked, what a choice tells, that a full time is
 * disabled with its word, and that a time's name carries its day.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import './slot-picker'
import type { LintjeSlotPicker, SlotDay } from './slot-picker'

const DAYS: SlotDay[] = [
  {
    date: '2026-10-12',
    slots: [
      { value: '2026-10-12T09:00', label: '09:00' },
      { value: '2026-10-12T09:30', label: '09:30', full: true },
    ],
  },
  { date: '2026-10-13', slots: [] },
]

async function mount(props: Partial<LintjeSlotPicker> = {}): Promise<LintjeSlotPicker> {
  const element = document.createElement('lintje-slot-picker') as LintjeSlotPicker
  Object.assign(element, { label: 'Tijd', days: DAYS, value: '2026-10-12T09:00' }, props)
  document.body.append(element)
  await element.updateComplete
  return element
}

const radios = (element: LintjeSlotPicker): HTMLInputElement[] => [
  ...element.renderRoot.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
]

const group = (element: LintjeSlotPicker): HTMLElement =>
  element.renderRoot.querySelector<HTMLElement>('[role="radiogroup"]')!

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('lintje-slot-picker', () => {
  it('checks the chosen time and commits a change to another', async () => {
    const element = await mount({ name: 'afspraak', value: '' })
    const changes: unknown[] = []
    const values: unknown[] = []
    element.addEventListener('lintje-change', (event) =>
      changes.push((event as CustomEvent).detail),
    )
    element.addEventListener('lintje-values-change', (event) =>
      values.push((event as CustomEvent).detail),
    )
    const [first] = radios(element)
    expect(first!.checked).toBe(false)
    first!.checked = true
    first!.dispatchEvent(new Event('change', { bubbles: true }))
    await element.updateComplete
    expect(changes).toEqual(['2026-10-12T09:00'])
    expect(values).toEqual([{ afspraak: '2026-10-12T09:00' }])
    expect(element.value).toBe('2026-10-12T09:00')
    expect(first!.closest('.lintje-slot-picker__slot')!.classList.contains('is-chosen')).toBe(true)
  })

  it('draws a full time disabled, with the word beside it', async () => {
    const element = await mount()
    const [, full] = radios(element)
    expect(full!.disabled).toBe(true)
    const chip = full!.closest<HTMLElement>('.lintje-slot-picker__slot')!
    expect(chip.classList.contains('is-disabled')).toBe(true)
    expect(chip.querySelector('.lintje-slot-picker__full')!.textContent).toBe('Vol')
  })

  it('names a time after its day, and says when a day has none', async () => {
    const element = await mount()
    const [first] = radios(element)
    const label = first!.closest<HTMLElement>('.lintje-slot-picker__slot')!
    expect(label.textContent!.replace(/\s+/g, ' ').trim()).toBe('maandag 12 oktober 2026, 09:00')
    const none = element.renderRoot.querySelectorAll('.lintje-slot-picker__none')
    expect(none).toHaveLength(1)
    expect(none[0]!.textContent!.replace(/\s+/g, ' ').trim()).toBe(
      'dinsdag 13 oktober 2026: Geen tijden',
    )
  })

  it('disables every time with the control, and marks an error on the group', async () => {
    const element = await mount({ disabled: true, error: 'Kies een tijd.' })
    expect(radios(element).every((radio) => radio.disabled)).toBe(true)
    expect(group(element).getAttribute('aria-invalid')).toBe('true')
    element.error = undefined
    element.disabled = false
    await element.updateComplete
    expect(group(element).getAttribute('aria-invalid')).toBeNull()
    expect(radios(element)[0]!.disabled).toBe(false)
  })

  it('says so without any day', async () => {
    const element = await mount({ days: [] })
    expect(element.renderRoot.querySelector('.lintje-slot-picker')).toBeNull()
    expect(element.renderRoot.querySelector('.lintje-slot-picker__none')!.textContent).toBe(
      'Geen tijden beschikbaar',
    )
  })
})
