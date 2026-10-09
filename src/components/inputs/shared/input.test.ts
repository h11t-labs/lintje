/**
 * `disabled` and `error` on every control a page can mount for an input.
 *
 * `ui.input` can say `disabled`,
 * it can say `error`, and it can ask for `kind="segmented"`. Half of the
 * controls already knew the two states (`lintje-text-input` drew them); the
 * select, the segmented control, the multi-select, the date range picker and
 * the slider did not, and a state that only some controls honour is not a
 * state. So this is one table over all of them: the same border, the same
 * message with its glyph, the same way out of the tab order and the same
 * silence on the URL.
 */
import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import '../text-input/text-input'
import '../number-input/number-input'
import '../textarea/textarea'
import '../select/select'
import '../segmented/segmented'
import '../multiselect/multiselect'
import '../date-range/date-range'
import '../checkbox/checkbox'
import '../toggle/toggle'
import '../radio-group/radio-group'
import '../range/range'
import '../combobox/combobox'
import '../tag-input/tag-input'
import '../date-input/date-input'
import '../time-input/time-input'
import '../text-editor/text-editor'
import '../file-upload/file-upload'
import '../field/field'
import type { LintjeInputElement } from './input'
import { deepActiveElement } from '../../../core/focus'

const OPTIONS = [
  { value: 'dag', label: 'Dag' },
  { value: 'week', label: 'Week' },
]

/** Every input tag a host can mount, and what it needs to draw. */
const CONTROLS: [string, (element: LintjeInputElement) => void][] = [
  ['lintje-text-input', () => {}],
  ['lintje-number-input', () => {}],
  ['lintje-select', (element) => Object.assign(element, { options: OPTIONS })],
  ['lintje-segmented', (element) => Object.assign(element, { options: OPTIONS })],
  ['lintje-multiselect', (element) => Object.assign(element, { options: OPTIONS })],
  ['lintje-date-range', () => {}],
  ['lintje-checkbox', () => {}],
  ['lintje-toggle', () => {}],
  ['lintje-radio-group', (element) => Object.assign(element, { options: OPTIONS })],
  [
    'lintje-range',
    (element) => Object.assign(element, { single: true, steps: [1, 2, 3], value: 2 }),
  ],
]

async function mount(
  tag: string,
  fill: (element: LintjeInputElement) => void,
  props: Record<string, unknown> = {},
): Promise<LintjeInputElement> {
  const element = document.createElement(tag) as LintjeInputElement
  element.label = 'Wachttijd'
  fill(element)
  Object.assign(element, props)
  document.body.append(element)
  await element.updateComplete
  return element
}

/** The natives a reader can reach with the keyboard. */
const focusable = (element: LintjeInputElement): HTMLElement[] =>
  [...element.renderRoot.querySelectorAll<HTMLElement>('input, select, button, textarea')].filter(
    (node) => !node.classList.contains('lintje-multiselect__chip-remove'),
  )

beforeEach(() => {
  document.body.innerHTML = ''
})

describe.each(CONTROLS)('%s', (tag, fill) => {
  it('draws the error message with its glyph, and points at it', async () => {
    const element = await mount(tag, fill, { error: 'Buiten de norm.' })
    const message = element.renderRoot.querySelector('.lintje-field__error')
    expect(message?.textContent).toContain('Buiten de norm.')
    expect(message?.getAttribute('role')).toBe('alert')
    // Never colour alone (rule 13): the glyph stands beside the words.
    expect(message?.querySelector('svg, use, .lintje-icon')).not.toBeNull()
    const described = [...element.renderRoot.querySelectorAll('[aria-describedby]')]
    expect(described.length, `${tag} points nothing at its message`).toBeGreaterThan(0)
    const id = message?.getAttribute('id')
    expect(
      described.some((node) => node.getAttribute('aria-describedby')?.includes(id ?? '')),
    ).toBe(true)
    expect(element.renderRoot.querySelector('[aria-invalid="true"]')).not.toBeNull()
  })

  it('marks a value that differs from its default on its label: the colour and the dot', async () => {
    const element = await mount(tag, fill, { modified: true })
    expect(
      element.renderRoot.querySelector('.is-modified'),
      `${tag} colours nothing`,
    ).not.toBeNull()
    // Never colour alone (rule 13): the dot stands by the coloured label.
    const dot = element.renderRoot.querySelector('.lintje-label__dot')
    expect(dot?.textContent?.trim(), `${tag} draws no dot`).toBe('afwijkend van standaard')
    expect(dot?.hasAttribute('aria-label')).toBe(false)
  })

  it('takes itself out of the tab order when it is disabled', async () => {
    const element = await mount(tag, fill, { disabled: true })
    const reachable = focusable(element).filter((node) => !(node as HTMLInputElement).disabled)
    expect(
      reachable.map((node) => node.className),
      `${tag} keeps a focusable control`,
    ).toEqual([])
  })

  it('writes nothing to the URL while it is disabled', async () => {
    const element = await mount(tag, fill, { disabled: true, name: 'p.iets' })
    const seen: unknown[] = []
    element.addEventListener('lintje-values-change', (event) =>
      seen.push((event as CustomEvent).detail),
    )
    // Straight at the commit: a disabled control that is moved anyway — by a
    // script, by a restored form — still says nothing.
    ;(element as unknown as { commit(value: unknown): void }).commit('iets')
    expect(seen).toEqual([])
  })

  it('commits to the host as soon as it carries a name', async () => {
    const element = await mount(tag, fill, { name: 'p.iets' })
    const seen: unknown[] = []
    element.addEventListener('lintje-values-change', (event) =>
      seen.push((event as CustomEvent).detail),
    )
    ;(element as unknown as { commit(value: unknown): void }).commit('iets')
    expect(seen).toEqual([{ 'p.iets': 'iets' }])
  })

  it('says nothing to the host without a name — the filter bar case', async () => {
    const element = await mount(tag, fill)
    const seen: unknown[] = []
    element.addEventListener('lintje-values-change', (event) =>
      seen.push((event as CustomEvent).detail),
    )
    ;(element as unknown as { commit(value: unknown): void }).commit('iets')
    expect(seen).toEqual([])
  })
})

/** The further inputs, beside the controls above. */
const FURTHER: [string, (element: LintjeInputElement) => void][] = [
  ['lintje-textarea', () => {}],
  ['lintje-combobox', (element) => Object.assign(element, { options: OPTIONS })],
  ['lintje-tag-input', () => {}],
  ['lintje-date-input', () => {}],
  ['lintje-time-input', () => {}],
  ['lintje-text-editor', () => {}],
  ['lintje-file-upload', () => {}],
]

describe.each([...CONTROLS, ...FURTHER])('%s, its label and its foot', (tag, fill) => {
  const suffix = (element: LintjeInputElement): Element | null =>
    element.renderRoot.querySelector('.lintje-label__optional')

  it('says "(niet verplicht)" in its label when it is optional, not when also required', async () => {
    const element = await mount(tag, fill, { optional: true })
    expect(suffix(element)?.textContent, `${tag} draws no suffix`).toBe('(niet verplicht)')
    // Inside the element that names the control, so it is part of the accessible name.
    expect(suffix(element)?.closest('label, .lintje-label, .lintje-choice__label')).not.toBeNull()
    const both = await mount(tag, fill, { optional: true, required: true })
    expect(suffix(both)).toBeNull()
  })

  it('shows the message instead of the hint, and points at the message only', async () => {
    const element = await mount(tag, fill, { hint: 'Zoals op het formulier', error: 'Fout.' })
    expect(element.renderRoot.querySelector('.lintje-field__hint:not([hidden])')).toBeNull()
    const message = element.renderRoot.querySelector('.lintje-field__error')
    expect(message?.textContent).toContain('Fout.')
    if (tag === 'lintje-file-upload') {
      // Its one control is the button inside a `lintje-button`: the message goes in as text.
      const description = element.renderRoot
        .querySelector('lintje-button')
        ?.getAttribute('description')
      expect(description).toContain('Fout.')
      expect(description).not.toContain('Zoals op het formulier')
      return
    }
    const described = [...element.renderRoot.querySelectorAll('[aria-describedby]')].map(
      (node) => node.getAttribute('aria-describedby') ?? '',
    )
    expect(described.some((ids) => ids.split(' ').includes(message?.id ?? ''))).toBe(true)
    expect(described.some((ids) => ids.split(' ').includes('lintje-input-hint'))).toBe(false)
  })

  it('shows the hint when there is no message', async () => {
    const element = await mount(tag, fill, { hint: 'Zoals op het formulier' })
    expect(element.renderRoot.querySelector('.lintje-field__hint')?.textContent).toContain(
      'Zoals op het formulier',
    )
    expect(element.renderRoot.querySelector('.lintje-field__error')).toBeNull()
  })
})

describe('required on a control without form participation', () => {
  it.each([
    ['lintje-select', '[aria-required]'],
    ['lintje-checkbox', 'input'],
    ['lintje-radio-group', '[role="radiogroup"]'],
    ['lintje-combobox', 'input'],
    ['lintje-tag-input', 'input'],
    ['lintje-date-input', 'input'],
    ['lintje-time-input', 'input'],
    ['lintje-text-editor', '[role="textbox"]'],
  ])('%s says aria-required on its control', async (tag, selector) => {
    const element = await mount(tag, (e) => Object.assign(e, { options: OPTIONS }), {
      required: true,
    })
    expect(element.renderRoot.querySelector(selector)?.getAttribute('aria-required')).toBe('true')
    expect(element.hasAttribute('required')).toBe(true)
  })
})

describe('a setting row', () => {
  it.each(['lintje-toggle', 'lintje-select', 'lintje-segmented'])(
    "%s keeps its label, control and hint as the field's own children, which the row places",
    async (tag) => {
      const element = await mount(tag, (e) => Object.assign(e, { options: OPTIONS }), {
        label: 'Zachte spraak versterken',
        hint: 'Voor iemand die zacht praat.',
        layout: 'row',
      })
      expect(element.getAttribute('layout')).toBe('row')
      const field = element.renderRoot.querySelector('.lintje-field')!
      expect(field.querySelector(':scope > .lintje-field__hint')?.textContent).toBe(
        'Voor iemand die zacht praat.',
      )
    },
  )
})

describe('a name built as a string', () => {
  const marked = { optional: true, modified: true }

  it('carries what the label says beyond its name', async () => {
    const range = await mount(
      'lintje-range',
      (e) => Object.assign(e, { steps: [1, 2, 3], from: 1, to: 2 }),
      marked,
    )
    const handles = [...range.renderRoot.querySelectorAll('input[type="range"]')]
    expect(handles.map((handle) => handle.getAttribute('aria-label'))).toEqual([
      'Wachttijd van (niet verplicht) afwijkend van standaard',
      'Wachttijd tot en met (niet verplicht) afwijkend van standaard',
    ])

    const period = await mount('lintje-date-range', () => {}, marked)
    const field = period.renderRoot.querySelector('.lintje-date-range-picker__field')
    expect(field?.getAttribute('aria-label')).toBe(
      'Wachttijd (niet verplicht) afwijkend van standaard, geen periode gekozen',
    )

    const upload = await mount('lintje-file-upload', () => {}, marked)
    expect(upload.renderRoot.querySelector('lintje-button')?.getAttribute('accessible-name')).toBe(
      'Bestanden kiezen, Wachttijd (niet verplicht) afwijkend van standaard',
    )
  })

  it('stays the bare name on a required field', async () => {
    const period = await mount('lintje-date-range', () => {}, { optional: true, required: true })
    const field = period.renderRoot.querySelector('.lintje-date-range-picker__field')
    expect(field?.getAttribute('aria-label')).toBe('Wachttijd, geen periode gekozen')
  })
})

describe('back to the default', () => {
  it.each(['lintje-select', 'lintje-segmented', 'lintje-toggle'])(
    '%s offers its reset link only while modified, and only asks',
    async (tag) => {
      const element = await mount(tag, (e) => Object.assign(e, { options: OPTIONS }), {
        label: 'Sprekers',
        resetLabel: 'Terugzetten naar 2 tot 12',
      })
      expect(element.renderRoot.querySelector('.lintje-field__reset')).toBeNull()
      Object.assign(element, { modified: true })
      await (element as unknown as { updateComplete: Promise<unknown> }).updateComplete
      const reset = element.renderRoot.querySelector<HTMLButtonElement>('.lintje-field__reset')!
      expect(reset.textContent!.trim()).toBe('Terugzetten naar 2 tot 12')
      let asked = 0
      element.addEventListener('lintje-reset', () => (asked += 1))
      reset.click()
      expect(asked).toBe(1)
    },
  )

  it.each(['lintje-select', 'lintje-segmented', 'lintje-toggle'])(
    '%s hands the focus to its control before the reset removes the link',
    async (tag) => {
      const element = await mount(tag, (e) => Object.assign(e, { options: OPTIONS }), {
        label: 'Sprekers',
        resetLabel: 'Terugzetten naar 2 tot 12',
        modified: true,
      })
      element.addEventListener('lintje-reset', () => Object.assign(element, { modified: false }))
      const reset = element.renderRoot.querySelector<HTMLButtonElement>('.lintje-field__reset')!
      reset.focus()
      reset.click()
      await (element as unknown as { updateComplete: Promise<unknown> }).updateComplete
      expect(element.renderRoot.querySelector('.lintje-field__reset')).toBeNull()
      const focused = deepActiveElement()
      expect(focused).not.toBeNull()
      expect(element.renderRoot.contains(focused)).toBe(true)
    },
  )
})

describe('the segmented control as an input', () => {
  it('commits the option that was pressed', async () => {
    const element = await mount('lintje-segmented', (e) => Object.assign(e, { options: OPTIONS }), {
      name: 'p.weergave',
      value: 'dag',
    })
    const seen: unknown[] = []
    element.addEventListener('lintje-values-change', (event) =>
      seen.push((event as CustomEvent).detail),
    )
    element.renderRoot.querySelectorAll<HTMLButtonElement>('button')[1].click()
    expect(seen).toEqual([{ 'p.weergave': 'week' }])
  })

  it("shows the chosen option's description under the options and describes the group by it", async () => {
    const options = [
      { value: 'vergadering', label: 'Vergadering', description: 'Sprekers herkennen' },
      { value: 'dictaat', label: 'Dictaat', description: 'Eén spreker' },
    ]
    const element = await mount('lintje-segmented', (e) => Object.assign(e, { options }), {
      value: 'dictaat',
    })
    const box = element.renderRoot.querySelector('.lintje-segmented__description')
    expect(box?.textContent).toBe('Eén spreker')
    expect(
      element.renderRoot.querySelector('[role="group"]')?.getAttribute('aria-describedby'),
    ).toBe(box?.id)
  })

  it('presses nothing while it is disabled', async () => {
    const element = await mount('lintje-segmented', (e) => Object.assign(e, { options: OPTIONS }), {
      name: 'p.weergave',
      value: 'dag',
      disabled: true,
    })
    const seen: unknown[] = []
    element.addEventListener('lintje-values-change', (event) =>
      seen.push((event as CustomEvent).detail),
    )
    element.renderRoot.querySelectorAll<HTMLButtonElement>('button')[1].click()
    expect(seen).toEqual([])
  })
})

describe('the label focuses its control', () => {
  it.each([
    'lintje-text-input',
    'lintje-number-input',
    'lintje-select',
    'lintje-textarea',
    'lintje-combobox',
    'lintje-tag-input',
    'lintje-date-input',
    'lintje-time-input',
  ])('%s binds a real <label for> to its native control', async (tag) => {
    const element = await mount(tag, (e) => Object.assign(e, { options: OPTIONS }), {
      stepper: true,
    })
    const label = element.renderRoot.querySelector('label')
    const control = element.renderRoot.querySelector(
      'input[type="text"], input[type="number"], select, textarea',
    )
    expect(label?.htmlFor).toBe(control?.id)
    expect((label as HTMLLabelElement | null)?.control).toBe(control)
    // The name stays where it was: the same label, through aria-labelledby.
    expect(control?.getAttribute('aria-labelledby')).toBe(label?.id)
  })

  it('focuses the first part of a composite control on a click', async () => {
    const element = await mount('lintje-segmented', (e) => Object.assign(e, { options: OPTIONS }))
    const label = element.renderRoot.querySelector<HTMLElement>('.lintje-label')
    label?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    const first = element.renderRoot.querySelector('button')
    expect(element.shadowRoot?.activeElement).toBe(first)
    // Only focus moves: the group keeps its name from the label.
    expect(
      element.renderRoot.querySelector('[role="group"]')?.getAttribute('aria-labelledby'),
    ).toBe(label?.id)
  })

  it("focuses the text editor's surface, not its toolbar, on a click", async () => {
    const element = await mount('lintje-text-editor', () => {})
    element.renderRoot
      .querySelector<HTMLElement>('.lintje-label')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(element.shadowRoot?.activeElement?.getAttribute('role')).toBe('textbox')
  })

  it('focuses the checked radio of a radio group', async () => {
    const element = await mount(
      'lintje-radio-group',
      (e) => Object.assign(e, { options: OPTIONS }),
      {
        value: 'week',
      },
    )
    element.renderRoot
      .querySelector<HTMLElement>('.lintje-label')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect((element.shadowRoot?.activeElement as HTMLInputElement | null)?.value).toBe('week')
  })

  it('lintje-field focuses the first slotted control on a click', async () => {
    const field = document.createElement('lintje-field')
    field.label = 'Vergelijk met'
    const select = document.createElement('lintje-select')
    Object.assign(select, { label: 'Vergelijk met', hideLabel: true, options: OPTIONS })
    field.append(select)
    document.body.append(field)
    await field.updateComplete
    await select.updateComplete
    field.renderRoot
      .querySelector<HTMLElement>('label')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(select.shadowRoot?.activeElement).toBe(select.renderRoot.querySelector('select'))
  })
})

/**
 * `required`, `optional`, `readonly` and form participation: the text field, the
 * number field and the textarea ("Form participation").
 *
 * happy-dom has no `attachInternals`, so the element runs without its form part
 * there; the form tests install a recording stand-in for `ElementInternals`
 * before the element is created, and check what the element tells it.
 */
const FORM_FIELDS: [string, Record<string, unknown>, string][] = [
  ['lintje-text-input', { value: 'Utrecht' }, 'Utrecht'],
  ['lintje-number-input', { value: 5 }, '5'],
  ['lintje-textarea', { value: 'Utrecht' }, 'Utrecht'],
]

/** The native control of a form field. */
const native = (element: LintjeInputElement): HTMLInputElement =>
  element.renderRoot.querySelector<HTMLInputElement>('input, textarea')!

/** What the reader types into a form field. */
const typedInto = (tag: string): string => (tag === 'lintje-number-input' ? '9' : 'Zwolle')

describe.each(FORM_FIELDS)('%s as a form field', (tag, filled) => {
  const none = (): void => {}

  it('marks a required field on the native control, and draws nothing for it', async () => {
    const element = await mount(tag, none, { required: true })
    expect(native(element).required).toBe(true)
    expect(native(element).getAttribute('aria-required')).toBe('true')
    expect(element.hasAttribute('required')).toBe(true)
    expect(element.renderRoot.querySelector('.lintje-label')?.textContent?.trim()).toBe('Wachttijd')
  })

  it('puts "(niet verplicht)" in the label, and so in the accessible name', async () => {
    const element = await mount(tag, none, { optional: true })
    const control = native(element)
    const label = element.renderRoot.querySelector(`#${control.getAttribute('aria-labelledby')}`)
    const suffix = label?.querySelector('.lintje-label__optional')
    expect(suffix?.textContent).toBe('(niet verplicht)')
    expect(label?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Wachttijd (niet verplicht)')
    expect(control.required).toBe(false)
  })

  it('keeps the suffix in a hidden label', async () => {
    const element = await mount(tag, none, { optional: true, hideLabel: true })
    expect(element.renderRoot.querySelector('label.visually-hidden')?.textContent).toContain(
      '(niet verplicht)',
    )
  })

  it('draws no suffix on a field that is both required and optional', async () => {
    const element = await mount(tag, none, { optional: true, required: true })
    expect(element.renderRoot.querySelector('.lintje-label__optional')).toBeNull()
  })

  it('stays focusable when read-only, and refuses a change', async () => {
    const element = await mount(tag, none, { ...filled, readonly: true, name: 'p.iets' })
    const control = native(element)
    expect(control.readOnly).toBe(true)
    expect(control.disabled).toBe(false)
    expect(element.hasAttribute('readonly')).toBe(true)
    const seen: unknown[] = []
    element.addEventListener('lintje-change', (event) => seen.push((event as CustomEvent).detail))
    element.addEventListener('lintje-values-change', (event) =>
      seen.push((event as CustomEvent).detail),
    )
    control.value = typedInto(tag)
    control.dispatchEvent(new Event('change'))
    ;(element as unknown as { commit(value: unknown): void }).commit('iets')
    await element.updateComplete
    expect((element as unknown as { value: unknown }).value).toBe(filled.value)
    expect(seen).toEqual([])
  })

  it("draws today's markup without the new attributes", async () => {
    const element = await mount(tag, none)
    const control = native(element)
    for (const attribute of ['required', 'aria-required', 'readonly', 'autocomplete']) {
      expect(control.hasAttribute(attribute), attribute).toBe(false)
    }
    expect(element.renderRoot.querySelector('.lintje-label__optional')).toBeNull()
  })
})

describe('read-only, per control', () => {
  it('lintje-text-input draws no clear button and takes the read-only state', async () => {
    const element = await mount('lintje-text-input', () => {}, {
      value: 'Utrecht',
      clearable: true,
      readonly: true,
    })
    expect(element.renderRoot.querySelector('.lintje-text-input__clear')).toBeNull()
    expect(native(element).classList.contains('is-readonly')).toBe(true)
  })

  it('lintje-number-input makes −/+ aria-disabled and lets them do nothing', async () => {
    const element = await mount('lintje-number-input', () => {}, {
      value: 5,
      readonly: true,
      name: 'p.drempel',
    })
    const seen: unknown[] = []
    element.addEventListener('lintje-values-change', (event) =>
      seen.push((event as CustomEvent).detail),
    )
    const steps = [...element.renderRoot.querySelectorAll<HTMLButtonElement>('button')]
    expect(steps.map((step) => step.getAttribute('aria-disabled'))).toEqual(['true', 'true'])
    for (const step of steps) step.click()
    await element.updateComplete
    expect((element as unknown as { value: number }).value).toBe(5)
    expect(seen).toEqual([])
    expect(
      element.renderRoot.querySelector('.lintje-number-input')?.classList.contains('is-readonly'),
    ).toBe(true)
  })
})

describe('autocomplete on the text field', () => {
  it('passes the value through to the native input', async () => {
    const element = await mount('lintje-text-input', () => {}, { autocomplete: 'email' })
    expect(native(element).getAttribute('autocomplete')).toBe('email')
  })
})

/** A stand-in for `ElementInternals` that records what the element tells it. */
interface Recorder {
  value?: string | null
  flags?: ValidityStateFlags
  message?: string
  anchor?: HTMLElement
  /** How often the form the element stands in was asked to submit. */
  submits: number
}

describe.each(FORM_FIELDS)('%s in a form', (tag, filled, submitted) => {
  const none = (): void => {}
  let recorder: Recorder
  const prototype = HTMLElement.prototype as unknown as { attachInternals?: () => unknown }
  const original = prototype.attachInternals

  beforeEach(() => {
    recorder = { submits: 0 }
    prototype.attachInternals = () => ({
      form: { requestSubmit: () => recorder.submits++ },
      setFormValue: (value: string | null) => (recorder.value = value),
      setValidity: (flags: ValidityStateFlags, message?: string, anchor?: HTMLElement) =>
        Object.assign(recorder, { flags, message, anchor }),
    })
  })

  afterEach(() => {
    prototype.attachInternals = original
  })

  it('is form-associated and reflects its name for the submission', async () => {
    const element = await mount(tag, none, { ...filled, name: 'p.iets' })
    expect((customElements.get(tag) as unknown as { formAssociated: boolean }).formAssociated).toBe(
      true,
    )
    expect(element.getAttribute('name')).toBe('p.iets')
    expect(recorder.value).toBe(submitted)
  })

  it('submits nothing while disabled', async () => {
    const element = await mount(tag, none, { ...filled, disabled: true })
    expect(element.hasAttribute('disabled')).toBe(true)
    expect(recorder.value).toBeNull()
  })

  it('is invalid when required and empty, with the message on the native control', async () => {
    const element = await mount(tag, none, { required: true })
    expect(recorder.value).toBe('')
    expect(recorder.flags).toEqual({ valueMissing: true })
    expect(recorder.message).toBeTruthy()
    expect(recorder.anchor).toBe(native(element))
    Object.assign(element, filled)
    await element.updateComplete
    expect(recorder.flags).toEqual({})
  })

  it('is valid when required but read-only: the browser skips it too', async () => {
    await mount(tag, none, { required: true, readonly: true })
    expect(recorder.flags).toEqual({})
  })

  it('goes back to its first value on form.reset(), without an event', async () => {
    const element = await mount(tag, none, { ...filled, name: 'p.iets' })
    const seen: unknown[] = []
    element.addEventListener('lintje-change', (event) => seen.push((event as CustomEvent).detail))
    element.addEventListener('lintje-values-change', (event) =>
      seen.push((event as CustomEvent).detail),
    )
    const control = native(element)
    control.value = typedInto(tag)
    control.dispatchEvent(new Event('change'))
    await element.updateComplete
    expect(seen).toHaveLength(2)
    ;(element as unknown as { formResetCallback(): void }).formResetCallback()
    await element.updateComplete
    expect((element as unknown as { value: unknown }).value).toBe(filled.value)
    expect(recorder.value).toBe(submitted)
    expect(seen).toHaveLength(2)
  })

  it('puts the first value back in the native control on form.reset(), also over uncommitted text', async () => {
    const element = await mount(tag, none, { ...filled, required: true })
    const control = native(element)
    // Typed, never committed: no `change`, so the property still holds the first value.
    control.value = typedInto(tag)
    ;(element as unknown as { formResetCallback(): void }).formResetCallback()
    await element.updateComplete
    expect(control.value).toBe(submitted)
    expect(recorder.flags).toEqual({})
  })

  /** Enter in a one-line field; Ctrl+Enter in the textarea, where Enter is a new line. */
  const enter = (control: HTMLInputElement): void => {
    control.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        ctrlKey: tag === 'lintje-textarea',
        bubbles: true,
        composed: true,
      }),
    )
  }

  it('commits what was typed and submits the form on Enter, once', async () => {
    const element = await mount(tag, none, { ...filled, name: 'p.iets' })
    const seen: unknown[] = []
    element.addEventListener('lintje-change', (event) => seen.push((event as CustomEvent).detail))
    const control = native(element)
    const typed = typedInto(tag)
    control.value = typed
    enter(control)
    // The browser may follow Enter with a `change`: the same value is not committed again.
    if (tag !== 'lintje-textarea') control.dispatchEvent(new Event('change'))
    await element.updateComplete
    expect(seen).toEqual([tag === 'lintje-number-input' ? Number(typed) : typed])
    // The submit waits a task, for a listener above the field that takes the key.
    expect(recorder.submits).toBe(0)
    await new Promise((resolve) => setTimeout(resolve))
    expect(recorder.submits).toBe(1)
    expect(recorder.value).toBe(typed)
  })

  it('leaves the submit to a listener above the field that prevented the key', async () => {
    const element = await mount(tag, none, filled)
    element.addEventListener('keydown', (event) => event.preventDefault())
    native(element).dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        ctrlKey: tag === 'lintje-textarea',
        bubbles: true,
        composed: true,
        cancelable: true,
      }),
    )
    await new Promise((resolve) => setTimeout(resolve))
    expect(recorder.submits).toBe(0)
  })

  it('submits nothing on Enter while read-only or disabled, or on another key', async () => {
    for (const state of [{ readonly: true }, { disabled: true }]) {
      const element = await mount(tag, none, { ...filled, ...state })
      enter(native(element))
    }
    const element = await mount(tag, none, filled)
    native(element).dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve))
    expect(recorder.submits).toBe(0)
  })
})

/**
 * Two drawings checked on the stylesheet itself — vitest does not run the CSS
 * pipeline, so an `?inline` import comes back empty and the files are read from disk.
 */
const css = (path: string): string =>
  readFileSync(resolvePath(`src/components/inputs/${path}`), 'utf8').replace(
    /\/\*[\s\S]*?\*\//g,
    '',
  )

describe('the stylesheets', () => {
  it('reaches the clear button target above and below only, never over the text', () => {
    expect(css('text-input/text-input.css')).toMatch(
      /\.lintje-text-input__clear::after\s*\{[^}]*inset: min\(0px, calc\(\(100% - var\(--h-target\)\) \/ 2\)\) 0;/,
    )
  })

  it("fills the toggle's off track with the field edge, inside its 40 × 22 box", () => {
    const shared = css('shared/input.css')
    const track = shared.match(/^\.lintje-choice__switch\s*\{([^}]*)\}/m)?.[1] ?? ''
    expect(track).toContain('width: 40px; height: 22px;')
    expect(track).toContain('background: var(--color-border-field);')
    expect(track).not.toContain('box-shadow')
    expect(track).not.toMatch(/(^|[^-])border:/)
  })
})
