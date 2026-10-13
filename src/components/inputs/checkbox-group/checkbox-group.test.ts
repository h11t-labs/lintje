/**
 * The checkbox group: one value list in the order of its options, told once by the group and
 * never by its rows, posted under its name, and a group as a reader hears it.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import './checkbox-group'
import '../../forms/form/form'
import type { LintjeCheckboxGroup } from './checkbox-group'
import type { LintjeCheckbox } from '../checkbox/checkbox'
import { formEntries, readControl, writeControl } from '../../shared/controls'

const OPTIONS = [
  { value: 'id', label: 'Kopie van een identiteitsbewijs' },
  { value: 'loon', label: 'Loonstrook', description: 'Van de laatste maand' },
  { value: 'huur', label: 'Huurcontract' },
]

async function mount(props: Partial<LintjeCheckboxGroup> = {}): Promise<LintjeCheckboxGroup> {
  const element = document.createElement('lintje-checkbox-group') as LintjeCheckboxGroup
  Object.assign(element, { label: 'Bijlagen', options: OPTIONS }, props)
  document.body.append(element)
  await element.updateComplete
  return element
}

const rows = (element: LintjeCheckboxGroup): LintjeCheckbox[] => [
  ...element.renderRoot.querySelectorAll<LintjeCheckbox>('lintje-checkbox'),
]

async function press(element: LintjeCheckboxGroup, index: number): Promise<void> {
  const row = rows(element)[index]
  await row.updateComplete
  row.renderRoot.querySelector<HTMLInputElement>('input')!.click()
  await element.updateComplete
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('lintje-checkbox-group', () => {
  it('draws a row per option, checked as `selected` says, with its description under it', async () => {
    const element = await mount({ selected: ['loon'] })
    expect(rows(element).map((row) => [row.label, row.checked, row.hint ?? null])).toEqual([
      ['Kopie van een identiteitsbewijs', false, null],
      ['Loonstrook', true, 'Van de laatste maand'],
      ['Huurcontract', false, null],
    ])
    expect(rows(element).every((row) => row.name === '')).toBe(true)
  })

  it('commits the checked values in the order of the options, once, from the group', async () => {
    const element = await mount({ name: 'bijlagen', selected: ['huur'] })
    const changes: unknown[] = []
    const values: unknown[] = []
    document.body.addEventListener('lintje-change', (event) =>
      changes.push((event as CustomEvent).detail),
    )
    document.body.addEventListener('lintje-values-change', (event) =>
      values.push((event as CustomEvent).detail),
    )
    await press(element, 0)
    expect(element.selected).toEqual(['id', 'huur'])
    expect(changes).toEqual([['id', 'huur']])
    expect(values).toEqual([{ bijlagen: ['id', 'huur'] }])
    await press(element, 2)
    expect(changes.at(-1)).toEqual(['id'])
  })

  it('keeps a value the options do not hold, after them', async () => {
    const element = await mount({ selected: ['ouder'] })
    await press(element, 1)
    expect(element.selected).toEqual(['loon', 'ouder'])
  })

  it('is a group named by its label, described and marked by its message', async () => {
    const element = await mount({ error: 'Kies minstens één bijlage.' })
    const group = element.renderRoot.querySelector('[role="group"]')!
    const label = element.renderRoot.querySelector('.lintje-label')!
    expect(group.getAttribute('aria-labelledby')).toBe(label.id)
    expect(group.getAttribute('aria-describedby')).toBe('lintje-input-error')
    expect(group.getAttribute('aria-invalid')).toBe('true')
  })

  it('says nothing for required: a group cannot carry aria-required', async () => {
    const element = await mount({ required: true })
    expect(element.hasAttribute('required')).toBe(true)
    expect(element.renderRoot.querySelector('[aria-required]')).toBeNull()
  })

  it('disables every row, and its label then focuses nothing', async () => {
    const element = await mount({ disabled: true })
    await Promise.all(rows(element).map((row) => row.updateComplete))
    const natives = rows(element).map((row) => row.renderRoot.querySelector('input')!)
    expect(natives.every((input) => input.disabled)).toBe(true)
    element.focus()
    expect(element.shadowRoot?.activeElement ?? null).toBeNull()
  })

  it('focuses its first row when its label is clicked', async () => {
    const element = await mount()
    await Promise.all(rows(element).map((row) => row.updateComplete))
    element.renderRoot
      .querySelector<HTMLElement>('.lintje-label')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    const first = rows(element)[0]
    expect(element.shadowRoot?.activeElement).toBe(first)
    expect(first.shadowRoot?.activeElement?.localName).toBe('input')
  })

  it('is read, written and posted as a list by a form', async () => {
    const element = await mount({ selected: ['id'] })
    expect(readControl(element)).toEqual(['id'])
    writeControl(element, ['loon', 'huur'])
    expect(element.selected).toEqual(['loon', 'huur'])
    writeControl(element, 'kapot')
    expect(element.selected).toEqual([])
    expect(formEntries('bijlagen', ['id', 'huur'])).toEqual([
      ['bijlagen', 'id'],
      ['bijlagen', 'huur'],
    ])
  })

  it('hands its values to lintje-form', async () => {
    const form = document.createElement('lintje-form')
    const element = document.createElement('lintje-checkbox-group') as LintjeCheckboxGroup
    Object.assign(element, { name: 'bijlagen', label: 'Bijlagen', options: OPTIONS })
    form.append(element)
    document.body.append(form)
    await form.updateComplete
    await element.updateComplete
    await press(element, 1)
    expect(form.collect().bijlagen).toEqual(['loon'])
  })
})
