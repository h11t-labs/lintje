/**
 * "Anders" in the choice groups: the last option, a field under it while chosen, its text a
 * value of its own under `<name>-other` that the group posts and tells, `lintje-form` keeps, and
 * the host's message lands on.
 */
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '../inputs/radio-group/radio-group'
import '../inputs/checkbox-group/checkbox-group'
import '../forms/form/form'
import { OTHER_MISSING_TEXT } from './other'
import { otherField } from './controls'
import type { LintjeRadioGroup } from '../inputs/radio-group/radio-group'
import type { LintjeCheckboxGroup } from '../inputs/checkbox-group/checkbox-group'
import type { LintjeCheckbox } from '../inputs/checkbox/checkbox'
import type { LintjeForm } from '../forms/form/form'
import type { LintjeTextInput } from '../inputs/text-input/text-input'
import type { LintjeErrorSummary } from '../forms/error-summary/error-summary'

type Group = LintjeRadioGroup | LintjeCheckboxGroup

const OPTIONS = [
  { value: 'gemeente', label: 'Via de gemeente' },
  { value: 'website', label: 'Op de website' },
]

/** One group's way of drawing and choosing; the cases below run for both. */
interface Kind {
  tag: 'lintje-radio-group' | 'lintje-checkbox-group'
  /** The value with "Anders" chosen. */
  chosen: unknown
  /** The value with only the first option. */
  first: unknown
  /** The value after `unchoose`. */
  after: unknown
  labels: (element: Group) => string[]
  /** The native control of "Anders". */
  otherInput: (element: Group) => Promise<HTMLInputElement>
  /** Takes "Anders" away again, as a reader does. */
  unchoose: (element: Group) => Promise<void>
}

async function rowInput(row: Element | null): Promise<HTMLInputElement> {
  await (row as LintjeCheckbox).updateComplete
  return (row as LintjeCheckbox).renderRoot.querySelector('input')!
}

const RADIO: Kind = {
  tag: 'lintje-radio-group',
  chosen: 'other',
  first: 'gemeente',
  after: 'gemeente',
  labels: (element) =>
    [...element.renderRoot.querySelectorAll('.lintje-choice__label')].map((label) =>
      label.textContent!.trim(),
    ),
  otherInput: async (element) =>
    element.renderRoot.querySelector<HTMLInputElement>('input[value="other"]')!,
  unchoose: async (element) => {
    element.renderRoot.querySelector<HTMLInputElement>('input[value="gemeente"]')!.click()
    await element.updateComplete
  },
}

const CHECKBOX: Kind = {
  tag: 'lintje-checkbox-group',
  chosen: ['other'],
  first: ['gemeente'],
  after: [],
  labels: (element) =>
    [...element.renderRoot.querySelectorAll<LintjeCheckbox>('lintje-checkbox')].map(
      (row) => row.label,
    ),
  otherInput: (element) =>
    rowInput(element.renderRoot.querySelector('.lintje-checkbox-group__other')),
  unchoose: async (element) => {
    ;(await CHECKBOX.otherInput(element)).click()
    await element.updateComplete
  },
}

async function mount<T extends Group>(tag: string, props: object = {}): Promise<T> {
  const element = document.createElement(tag) as T
  Object.assign(element, { label: 'Hoe hoorde u van de regeling?', options: OPTIONS, other: true })
  Object.assign(element, props)
  document.body.append(element)
  await element.updateComplete
  return element
}

async function choose(kind: Kind, element: Group): Promise<void> {
  ;(await kind.otherInput(element)).click()
  await element.updateComplete
  await new Promise((resolve) => setTimeout(resolve))
}

const field = (element: Group) => otherField<LintjeTextInput>(element.renderRoot)

/** The reader types in the field and leaves it (or presses Enter). */
async function typeOther(element: Group, text: string, how: 'leave' | 'enter' = 'leave') {
  const input = field(element)!.renderRoot.querySelector('input')!
  input.value = text
  input.dispatchEvent(new Event('input', { bubbles: true }))
  if (how === 'enter')
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  else input.dispatchEvent(new Event('change', { bubbles: true }))
  await element.updateComplete
}

function listen(target: EventTarget, name: string): unknown[] {
  const details: unknown[] = []
  target.addEventListener(name, (event) => details.push((event as CustomEvent).detail))
  return details
}

/** The deepest element with the focus. */
function active(): Element | null {
  let at = document.activeElement
  while (at?.shadowRoot?.activeElement) at = at.shadowRoot.activeElement
  return at
}

beforeEach(() => document.body.replaceChildren())
afterEach(() => vi.restoreAllMocks())

describe.each([RADIO, CHECKBOX])('$tag with other', (kind) => {
  it('ends in "Anders, namelijk", after the options, and changes nothing without `other`', async () => {
    const element = await mount(kind.tag)
    expect(kind.labels(element)).toEqual(['Via de gemeente', 'Op de website', 'Anders, namelijk'])
    expect(field(element)).toBeNull()
    const named = await mount(kind.tag, { otherLabel: 'Iets anders…' })
    expect(kind.labels(named).at(-1)).toBe('Iets anders…')
    const plain = await mount(kind.tag, { other: false })
    expect(kind.labels(plain)).toEqual(['Via de gemeente', 'Op de website'])
  })

  it('chosen, shows its field under the option, labelled by the option, with the focus kept on the option', async () => {
    const element = await mount(kind.tag, { otherPlaceholder: 'Bijvoorbeeld: via de buren' })
    const changes = listen(element, 'lintje-change')
    const option = await kind.otherInput(element)
    option.focus()
    await choose(kind, element)
    await field(element)!.updateComplete
    const input = field(element)!.renderRoot.querySelector('input')!
    expect(changes).toEqual([kind.chosen])
    expect(field(element)!.label).toBe('Anders, namelijk')
    expect(field(element)!.hideLabel).toBe(true)
    expect(input.placeholder).toBe('Bijvoorbeeld: via de buren')
    // The reader hears that the choice is on; the field is the next Tab stop.
    expect(active()).toBe(option)
  })

  it('says its field must be filled with aria-required alone, holding back no form', async () => {
    const element = await mount(kind.tag)
    await choose(kind, element)
    await field(element)!.updateComplete
    const input = field(element)!.renderRoot.querySelector('input')!
    expect(input.getAttribute('aria-required')).toBe('true')
    expect(input.hasAttribute('required')).toBe(false)
    expect(field(element)!.required).toBe(false)
  })

  it('commits its text on leaving and on Enter, once each, and not while typing', async () => {
    const element = await mount(kind.tag, { name: 'bron' })
    await choose(kind, element)
    const texts = listen(element, 'lintje-other-change')
    const values = listen(document, 'lintje-values-change')
    const input = field(element)!.renderRoot.querySelector('input')!
    input.value = 'Van een buurvrouw'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(element.otherText).toBe('')
    expect(texts).toEqual([])
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await typeOther(element, 'Op een beurs', 'enter')
    expect(texts).toEqual(['Van een buurvrouw', 'Op een beurs'])
    expect(element.otherText).toBe('Op een beurs')
    expect(values.at(-1)).toEqual({ bron: kind.chosen, 'bron-other': 'Op een beurs' })
  })

  it('tells both keys in lintje-values-change, the text null while "Anders" is not chosen', async () => {
    const element = await mount(kind.tag, { name: 'bron', otherText: 'Op een beurs' })
    const values = listen(document, 'lintje-values-change')
    await choose(kind, element)
    await kind.unchoose(element)
    expect(values).toEqual([
      { bron: kind.chosen, 'bron-other': 'Op een beurs' },
      { bron: kind.after, 'bron-other': null },
    ])
    const plain = await mount(kind.tag, { name: 'kanaal', other: false })
    const own = listen(document, 'lintje-values-change')
    ;(plain.renderRoot.querySelector<HTMLInputElement>('input[value="gemeente"]') ??
      (await rowInput(plain.renderRoot.querySelector('lintje-checkbox'))))!.click()
    expect(own).toEqual([{ kanaal: kind.first }])
  })

  it('keeps its text when "Anders" goes, and shows it again when it comes back', async () => {
    const element = await mount(kind.tag)
    await choose(kind, element)
    await typeOther(element, 'Op een beurs')
    await kind.unchoose(element)
    expect(field(element)).toBeNull()
    expect(element.otherText).toBe('Op een beurs')
    await choose(kind, element)
    expect(field(element)!.value).toBe('Op een beurs')
  })

  it("draws the host's other-error under the field, marks the group, and keeps error under the group", async () => {
    const element = await mount(kind.tag, {
      otherText: '',
      otherError: OTHER_MISSING_TEXT,
      error: 'Kies een antwoord.',
    })
    await choose(kind, element)
    await field(element)!.updateComplete
    const group = element.renderRoot.querySelector('[role="radiogroup"], [role="group"]')!
    expect(group.getAttribute('aria-invalid')).toBe('true')
    expect(field(element)!.renderRoot.querySelector('.lintje-field__error')?.textContent).toContain(
      'Vul in wat je bedoelt.',
    )
    expect(field(element)!.renderRoot.querySelector('input')!.getAttribute('aria-invalid')).toBe(
      'true',
    )
    const own = [...element.renderRoot.querySelectorAll('.lintje-field__error')]
    expect(own.map((line) => line.textContent!.trim())).toEqual(['Kies een antwoord.'])
  })

  it('disables its field with the group', async () => {
    const element = await mount(kind.tag, { name: 'bron' })
    await choose(kind, element)
    element.disabled = true
    await element.updateComplete
    await field(element)!.updateComplete
    expect(field(element)!.renderRoot.querySelector('input')!.disabled).toBe(true)
  })

  it('warns once and draws no option of its own when a host option has the value other', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const element = await mount(kind.tag, {
      options: [...OPTIONS, { value: 'other', label: 'Overig' }],
    })
    element.requestUpdate()
    await element.updateComplete
    expect(kind.labels(element)).toEqual(['Via de gemeente', 'Op de website', 'Overig'])
    expect(warn).toHaveBeenCalledOnce()
  })
})

describe('"Anders" in a native form', () => {
  interface Recorder {
    value?: FormData | string | null
    flags?: ValidityStateFlags
  }
  /** Per element: the rows and the field record their own. */
  const recorders = new Map<Element, Recorder>()
  const prototype = HTMLElement.prototype as unknown as { attachInternals?: () => unknown }
  const original = prototype.attachInternals

  beforeEach(() => {
    recorders.clear()
    prototype.attachInternals = function (this: Element) {
      const recorder: Recorder = {}
      recorders.set(this, recorder)
      return {
        form: null,
        setFormValue: (value: FormData | null) => (recorder.value = value),
        setValidity: (flags: ValidityStateFlags) => (recorder.flags = flags),
      }
    }
  })
  afterEach(() => {
    prototype.attachInternals = original
  })

  let element: Group
  const posted = (): [string, FormDataEntryValue][] => [
    ...(recorders.get(element)!.value as FormData).entries(),
  ]

  it.each([RADIO, CHECKBOX])(
    '$tag posts <name>-other only while "Anders" is chosen',
    async (kind) => {
      element = await mount(kind.tag, { name: 'bron', otherText: 'Op een beurs' })
      expect(posted().filter(([key]) => key === 'bron-other')).toEqual([])
      await choose(kind, element)
      expect(posted()).toEqual([
        ['bron', 'other'],
        ['bron-other', 'Op een beurs'],
      ])
      await kind.unchoose(element)
      expect(posted()).toEqual(kind.tag === 'lintje-radio-group' ? [['bron', 'gemeente']] : [])
    },
  )

  it.each([RADIO, CHECKBOX])(
    '$tag sets no validity for an empty "Anders", also when required',
    async (kind) => {
      element = await mount(kind.tag, { name: 'bron', required: true })
      await choose(kind, element)
      expect(element.otherText).toBe('')
      expect(recorders.get(element)!.flags).toEqual({})
    },
  )

  it.each([RADIO, CHECKBOX])('$tag puts its first text back on a reset', async (kind) => {
    element = await mount(kind.tag, { name: 'bron', otherText: 'Op een beurs' })
    await choose(kind, element)
    await typeOther(element, 'Van een buurvrouw')
    element.formResetCallback()
    await element.updateComplete
    expect(element.otherText).toBe('Op een beurs')
    expect(field(element)).toBeNull()
  })
})

describe('lintje-radio-group', () => {
  it('chosen with an arrow key, shows the field and leaves the focus in the group', async () => {
    const element = await mount<LintjeRadioGroup>('lintje-radio-group')
    const radio = await RADIO.otherInput(element)
    radio.focus()
    radio.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    radio.click()
    await element.updateComplete
    await new Promise((resolve) => setTimeout(resolve))
    expect(field(element)).not.toBeNull()
    expect(active()).toBe(radio)
  })

  it('draws a description under its label in the plain rows, tied to its own radio', async () => {
    const element = await mount<LintjeRadioGroup>('lintje-radio-group', {
      options: [OPTIONS[0], { ...OPTIONS[1], description: 'Rijksoverheid.nl of de gemeente' }],
    })
    const radios = [...element.renderRoot.querySelectorAll<HTMLInputElement>('input')]
    const hint = element.renderRoot.querySelector(
      '.lintje-radio-group__option .lintje-field__hint',
    )!
    expect(hint.textContent).toBe('Rijksoverheid.nl of de gemeente')
    expect(radios.map((radio) => radio.getAttribute('aria-describedby'))).toEqual([
      null,
      hint.id,
      null,
    ])
  })

  it('with cards draws no "Anders", and warns once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const element = await mount<LintjeRadioGroup>('lintje-radio-group', { variant: 'cards' })
    element.requestUpdate()
    await element.updateComplete
    expect(RADIO.labels(element)).toEqual(['Via de gemeente', 'Op de website'])
    expect(warn).toHaveBeenCalledOnce()
  })
})

describe('"Anders" in lintje-form', () => {
  async function form(values: Record<string, unknown> = {}, key?: string): Promise<LintjeForm> {
    const element = document.createElement('lintje-form')
    if (key) element.setAttribute('draft-key', key)
    element.innerHTML = `<lintje-radio-group name="bron" label="Hoe hoorde u van de regeling?" other></lintje-radio-group>`
    element.querySelector<LintjeRadioGroup>('lintje-radio-group')!.options = OPTIONS
    element.values = values
    document.body.append(element)
    await element.updateComplete
    await group(element).updateComplete
    return element
  }
  const group = (element: LintjeForm) =>
    element.querySelector<LintjeRadioGroup>('lintje-radio-group')!
  const summary = (element: LintjeForm) =>
    element.renderRoot.querySelector<LintjeErrorSummary>('lintje-error-summary')!

  beforeEach(() => localStorage.clear())

  it('sends <name>-other in lintje-submit: the text while chosen, else null', async () => {
    const element = await form({ bron: 'gemeente' })
    const submits = listen(element, 'lintje-submit')
    element.submit()
    await choose(RADIO, group(element))
    await typeOther(group(element), 'Op een beurs')
    element.submit()
    expect(submits).toEqual([
      { values: { bron: 'gemeente', 'bron-other': null } },
      { values: { bron: 'other', 'bron-other': 'Op een beurs' } },
    ])
  })

  it('keeps the text in its draft and puts a stored draft back into otherText', async () => {
    const element = await form({ bron: 'gemeente' }, 'aanvraag')
    await choose(RADIO, group(element))
    await typeOther(group(element), 'Op een beurs')
    expect(JSON.parse(localStorage.getItem('lintje-draft:aanvraag')!).values).toEqual({
      bron: 'other',
      'bron-other': 'Op een beurs',
    })
    document.body.replaceChildren()
    const again = await form({ bron: 'gemeente' }, 'aanvraag')
    expect(group(again).value).toBe('other')
    expect(group(again).otherText).toBe('Op een beurs')
  })

  it("puts errors.fields['<name>-other'] on the field, with a summary link that focuses it", async () => {
    const element = await form({ bron: 'other' })
    element.errors = { fields: { 'bron-other': OTHER_MISSING_TEXT } }
    await element.updateComplete
    expect(group(element).otherError).toBe(OTHER_MISSING_TEXT)
    expect(summary(element).items).toEqual([
      { field: 'bron-other', label: 'Hoe hoorde u van de regeling?', message: OTHER_MISSING_TEXT },
    ])
    await summary(element).updateComplete
    await group(element).updateComplete
    summary(element).renderRoot.querySelector<HTMLElement>('.lintje-error-summary__link')!.click()
    expect(active()).toBe(field(group(element))!.renderRoot.querySelector('input'))
  })

  it('takes the message away when the text changes', async () => {
    const element = await form({ bron: 'other' })
    element.errors = { fields: { 'bron-other': OTHER_MISSING_TEXT } }
    await element.updateComplete
    await group(element).updateComplete
    await typeOther(group(element), 'Op een beurs')
    await element.updateComplete
    expect(group(element).otherError).toBeUndefined()
    expect(element.errors?.fields).toEqual({})
  })

  it('takes the message away when "Anders" goes', async () => {
    const element = await form({ bron: 'other' })
    element.errors = { fields: { 'bron-other': OTHER_MISSING_TEXT } }
    await element.updateComplete
    await RADIO.unchoose(group(element))
    await element.updateComplete
    expect(group(element).otherError).toBeUndefined()
    expect(element.errors?.fields).toEqual({})
  })
})

it('exports OTHER_MISSING_TEXT from the barrel, the same words for every form', () => {
  expect(OTHER_MISSING_TEXT).toBe('Vul in wat je bedoelt.')
  const barrel = readFileSync('src/components/index.ts', 'utf8')
  expect(barrel).toContain("export { OTHER_MISSING_TEXT } from './shared/other'")
})
