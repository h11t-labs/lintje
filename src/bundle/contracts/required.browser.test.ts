/** Required: an empty input with `required` holds back the native `<form>` around it. */
import { afterEach, describe, expect, it } from 'vitest'
import '../../components/inputs/checkbox/checkbox'
import '../../components/inputs/checkbox-group/checkbox-group'
import '../../components/inputs/combobox/combobox'
import '../../components/inputs/date-input/date-input'
import '../../components/inputs/date-range/date-range'
import '../../components/inputs/file-upload/file-upload'
import '../../components/inputs/find/find'
import '../../components/inputs/multiselect/multiselect'
import '../../components/inputs/number-input/number-input'
import '../../components/inputs/radio-group/radio-group'
import '../../components/inputs/range/range'
import '../../components/inputs/segmented/segmented'
import '../../components/inputs/select/select'
import '../../components/inputs/slot-picker/slot-picker'
import '../../components/inputs/tag-input/tag-input'
import '../../components/inputs/text-editor/text-editor'
import '../../components/inputs/text-input/text-input'
import '../../components/inputs/textarea/textarea'
import '../../components/inputs/time-input/time-input'
import '../../components/inputs/toggle/toggle'
import type { LintjeInputElement } from '../../components/inputs/shared/input'

type Input = LintjeInputElement & Record<string, unknown>

/** One input: what it needs to draw, and what fills it. */
interface Row {
  tag: string
  props?: object
  fill: object
}

const OPTIONS = [
  { value: 'a', label: 'Alfa' },
  { value: 'b', label: 'Bravo' },
]

const ROWS: Row[] = [
  { tag: 'lintje-text-input', fill: { value: 'Jansen' } },
  { tag: 'lintje-number-input', fill: { value: 3 } },
  { tag: 'lintje-textarea', fill: { value: 'Tekst' } },
  { tag: 'lintje-find', fill: { value: 'zoek' } },
  { tag: 'lintje-select', props: { options: OPTIONS }, fill: { value: 'a' } },
  { tag: 'lintje-combobox', props: { options: OPTIONS }, fill: { value: 'a' } },
  { tag: 'lintje-radio-group', props: { options: OPTIONS }, fill: { value: 'a' } },
  { tag: 'lintje-segmented', props: { options: OPTIONS }, fill: { value: 'a' } },
  {
    tag: 'lintje-slot-picker',
    props: { days: [{ date: '2026-10-12', slots: [{ value: 's1', label: '09:30' }] }] },
    fill: { value: 's1' },
  },
  { tag: 'lintje-date-input', fill: { value: '2026-10-04' } },
  { tag: 'lintje-time-input', fill: { value: '09:30' } },
  { tag: 'lintje-text-editor', fill: { value: '<p>Tekst</p>' } },
  { tag: 'lintje-checkbox', fill: { checked: true } },
  { tag: 'lintje-toggle', fill: { checked: true } },
  { tag: 'lintje-checkbox-group', props: { options: OPTIONS }, fill: { selected: ['a'] } },
  { tag: 'lintje-multiselect', props: { options: OPTIONS }, fill: { selected: ['a'] } },
  { tag: 'lintje-tag-input', fill: { value: ['woord'] } },
  { tag: 'lintje-date-range', fill: { range: { from: '01-10-2026', to: '04-10-2026' } } },
  {
    tag: 'lintje-file-upload',
    fill: { files: [{ id: 'f1', name: 'brief.pdf', size: 1200, state: 'done' }] },
  },
]

/** The focused element through every shadow root. */
function active(): Element | null {
  let element = document.activeElement
  while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement
  return element
}

/** Waits until the element and the parts it draws with other elements have drawn. */
async function settled(element: Input): Promise<void> {
  await element.updateComplete
  const parts = [...element.renderRoot.querySelectorAll('*')].map(
    (node) => (node as Partial<Input>).updateComplete,
  )
  await Promise.all(parts)
  await new Promise(requestAnimationFrame)
}

/** A `<form>` with the input in it, required, inside `wrapper` when given. */
async function inForm(
  row: Row,
  props: object = {},
  wrapper?: HTMLElement,
): Promise<{ form: HTMLFormElement; element: Input; submits: () => number }> {
  const form = document.createElement('form')
  let count = 0
  // A submit that went through would leave the test page.
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    count += 1
  })
  const element = Object.assign(document.createElement(row.tag), {
    name: 'veld',
    label: 'Veld',
    required: true,
    ...row.props,
    ...props,
  }) as unknown as Input
  ;(wrapper ?? form).append(element)
  if (wrapper) form.append(wrapper)
  document.body.append(form)
  await settled(element)
  return { form, element, submits: () => count }
}

afterEach(() => {
  document.body.replaceChildren()
})

describe.each(ROWS)('$tag with required in a native form', (row) => {
  it('holds the submit while empty', async () => {
    const { form, submits } = await inForm(row)
    expect(form.checkValidity()).toBe(false)
    form.requestSubmit()
    expect(submits()).toBe(0)
  })

  it('lets it through once filled, or once required is gone', async () => {
    const { form, element, submits } = await inForm(row)
    Object.assign(element, row.fill)
    await settled(element)
    expect(form.checkValidity()).toBe(true)
    form.requestSubmit()
    expect(submits()).toBe(1)

    const empty = await inForm(row)
    empty.element.required = false
    await settled(empty.element)
    expect(empty.form.checkValidity()).toBe(true)
  })

  it('lets it through while disabled, also by a fieldset', async () => {
    const own = await inForm(row, { disabled: true })
    expect(own.form.checkValidity()).toBe(true)

    const fieldset = document.createElement('fieldset')
    fieldset.disabled = true
    const held = await inForm(row, {}, fieldset)
    expect(held.form.checkValidity()).toBe(true)
  })

  it('takes the focus at its control when the form reports', async () => {
    const { form, element } = await inForm(row)
    element.focus()
    const control = active()
    expect(control?.getRootNode()).toBeInstanceOf(ShadowRoot)
    ;(document.activeElement as HTMLElement | null)?.blur()
    expect(form.reportValidity()).toBe(false)
    expect(active()).toBe(control)
  })
})

describe('the parts of a value', () => {
  it('a period with only a start is empty', async () => {
    const row = ROWS.find((item) => item.tag === 'lintje-date-range')!
    const { form } = await inForm(row, { range: { from: '01-10-2026', to: null } })
    expect(form.checkValidity()).toBe(false)
  })

  it('a range is never empty: it always posts a step', async () => {
    const pair = await inForm({ tag: 'lintje-range', fill: {} }, { steps: [1, 2, 3] })
    expect(pair.form.checkValidity()).toBe(true)
    const single = await inForm(
      { tag: 'lintje-range', fill: {} },
      { steps: [1, 2, 3], single: true },
    )
    expect(single.form.checkValidity()).toBe(true)
  })
})
