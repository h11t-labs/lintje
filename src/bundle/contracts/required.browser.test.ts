/** Required: an empty input with `required` holds back the native `<form>` around it. */
import { afterEach, describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
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
import '../../components/actions/button/button'
import '../../components/forms/form/form'
import type { LintjeInputElement } from '../../components/inputs/shared/input'

type Input = LintjeInputElement & Record<string, unknown>

/** One input: what it needs to draw, what fills it, and what it then posts (`start.md`). */
interface Row {
  tag: string
  props?: object
  fill: object
  posts: [string, string][]
}

const OPTIONS = [
  { value: 'a', label: 'Alfa' },
  { value: 'b', label: 'Bravo' },
]

const ROWS: Row[] = [
  { tag: 'lintje-text-input', fill: { value: 'Jansen' }, posts: [['veld', 'Jansen']] },
  { tag: 'lintje-number-input', fill: { value: 3 }, posts: [['veld', '3']] },
  { tag: 'lintje-textarea', fill: { value: 'Tekst' }, posts: [['veld', 'Tekst']] },
  { tag: 'lintje-find', fill: { value: 'zoek' }, posts: [['veld', 'zoek']] },
  {
    tag: 'lintje-select',
    props: { options: OPTIONS },
    fill: { value: 'a' },
    posts: [['veld', 'a']],
  },
  {
    tag: 'lintje-combobox',
    props: { options: OPTIONS },
    fill: { value: 'a' },
    posts: [['veld', 'a']],
  },
  {
    tag: 'lintje-radio-group',
    props: { options: OPTIONS },
    fill: { value: 'a' },
    posts: [['veld', 'a']],
  },
  {
    tag: 'lintje-segmented',
    props: { options: OPTIONS },
    fill: { value: 'a' },
    posts: [['veld', 'a']],
  },
  {
    tag: 'lintje-slot-picker',
    props: { days: [{ date: '2026-10-12', slots: [{ value: 's1', label: '09:30' }] }] },
    fill: { value: 's1' },
    posts: [['veld', 's1']],
  },
  { tag: 'lintje-date-input', fill: { value: '2026-10-04' }, posts: [['veld', '2026-10-04']] },
  { tag: 'lintje-time-input', fill: { value: '09:30' }, posts: [['veld', '09:30']] },
  { tag: 'lintje-text-editor', fill: { value: '<p>Tekst</p>' }, posts: [['veld', '<p>Tekst</p>']] },
  { tag: 'lintje-checkbox', fill: { checked: true }, posts: [['veld', 'on']] },
  { tag: 'lintje-toggle', fill: { checked: true }, posts: [['veld', 'on']] },
  {
    tag: 'lintje-checkbox-group',
    props: { options: OPTIONS },
    fill: { selected: ['a'] },
    posts: [['veld', 'a']],
  },
  {
    tag: 'lintje-multiselect',
    props: { options: OPTIONS },
    fill: { selected: ['a'] },
    posts: [['veld', 'a']],
  },
  { tag: 'lintje-tag-input', fill: { value: ['woord'] }, posts: [['veld', 'woord']] },
  {
    tag: 'lintje-date-range',
    fill: { range: { from: '01-10-2026', to: '04-10-2026' } },
    posts: [
      ['veld-from', '2026-10-01'],
      ['veld-to', '2026-10-04'],
    ],
  },
  {
    tag: 'lintje-file-upload',
    fill: { files: [{ id: 'f1', name: 'brief.pdf', size: 1200, state: 'done' }] },
    posts: [['veld', 'f1']],
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

  it('comes back on with its fieldset, and posts and holds again', async () => {
    const fieldset = document.createElement('fieldset')
    fieldset.disabled = true
    const { form, element } = await inForm(row, row.fill, fieldset)
    expect(element.matches(':disabled')).toBe(true)
    expect([...new FormData(form)]).toEqual([])

    fieldset.disabled = false
    await settled(element)
    expect(element.hasAttribute('disabled')).toBe(false)
    expect(element.matches(':disabled')).toBe(false)
    element.focus()
    expect(active()?.getRootNode()).toBeInstanceOf(ShadowRoot)
    expect([...new FormData(form)]).toEqual(row.posts)
    expect(form.checkValidity()).toBe(true)

    const empty = document.createElement('fieldset')
    empty.disabled = true
    const held = await inForm(row, {}, empty)
    empty.disabled = false
    await settled(held.element)
    expect(held.form.checkValidity()).toBe(false)
    held.form.requestSubmit()
    expect(held.submits()).toBe(0)
  })

  it('stays off by its own disabled through its fieldset, and comes on without it', async () => {
    const fieldset = document.createElement('fieldset')
    const { form, element } = await inForm(row, { ...row.fill, disabled: true }, fieldset)
    fieldset.disabled = true
    await settled(element)
    fieldset.disabled = false
    await settled(element)
    expect(element.disabled).toBe(true)
    expect(element.hasAttribute('disabled')).toBe(true)
    expect(element.matches(':disabled')).toBe(true)
    expect([...new FormData(form)]).toEqual([])

    // Its own `disabled` reaches the form while the element draws: it must draw again after.
    element.disabled = false
    await settled(element)
    expect(element.matches(':disabled')).toBe(false)
    element.focus()
    expect(active()?.getRootNode()).toBeInstanceOf(ShadowRoot)
    expect([...new FormData(form)]).toEqual(row.posts)
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

describe('Enter in a one-line field', () => {
  it.each([
    ['lintje-text-input', 'Jansen'],
    ['lintje-number-input', '3'],
    ['lintje-date-input', '03-10-2026'],
    ['lintje-time-input', '14:35'],
  ])('%s submits the native form around it', async (tag, text) => {
    const { element, submits } = await inForm({ tag, fill: {}, posts: [] }, { required: false })
    element.focus()
    await userEvent.keyboard(text)
    await userEvent.keyboard('{Enter}')
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(submits()).toBe(1)
  })
})

describe('read-only', () => {
  it.each(['lintje-text-input', 'lintje-date-input', 'lintje-time-input'])(
    '%s cannot be filled, so it never holds the form back',
    async (tag) => {
      const { form } = await inForm({ tag, fill: {}, posts: [] }, { readonly: true })
      expect(form.checkValidity()).toBe(true)
    },
  )
})

describe('the parts of a value', () => {
  it('a period with only a start is empty', async () => {
    const row = ROWS.find((item) => item.tag === 'lintje-date-range')!
    const { form } = await inForm(row, { range: { from: '01-10-2026', to: null } })
    expect(form.checkValidity()).toBe(false)
  })

  it('a range is never empty: it always posts a step', async () => {
    const pair = await inForm({ tag: 'lintje-range', fill: {}, posts: [] }, { steps: [1, 2, 3] })
    expect(pair.form.checkValidity()).toBe(true)
    const single = await inForm(
      { tag: 'lintje-range', fill: {}, posts: [] },
      { steps: [1, 2, 3], single: true },
    )
    expect(single.form.checkValidity()).toBe(true)
  })

  it('a range comes back on with its fieldset and posts its steps again', async () => {
    const fieldset = document.createElement('fieldset')
    fieldset.disabled = true
    const { form, element } = await inForm(
      { tag: 'lintje-range', fill: {}, posts: [] },
      { steps: [1, 2, 3], from: 0, to: 2 },
      fieldset,
    )
    expect([...new FormData(form)]).toEqual([])
    fieldset.disabled = false
    await settled(element)
    expect(element.matches(':disabled')).toBe(false)
    expect([...new FormData(form)]).toEqual([
      ['veld', '0'],
      ['veld', '2'],
    ])
  })
})

/** Typed text a field refused holds the form back, as an empty required field does. */
describe('refused typed text', () => {
  // Without a hint, so the message adds a line where there was none and moves what is below.
  const REFUSING: { tag: string; props: object; refused: string; value: unknown; old: string }[] = [
    {
      tag: 'lintje-number-input',
      props: { max: 10 },
      refused: '50',
      value: 3,
      old: '3',
    },
    {
      tag: 'lintje-date-input',
      props: { hint: '' },
      refused: '32-10-2026',
      value: '2026-10-04',
      old: '04-10-2026',
    },
    {
      tag: 'lintje-time-input',
      props: { max: '18:00', hint: '' },
      refused: '19:30',
      value: '09:30',
      old: '09:30',
    },
  ]

  /** Replaces the field's text, then leaves it with Tab. */
  async function typeAndLeave(element: Input, text: string): Promise<void> {
    const control = element.renderRoot.querySelector('input')!
    await userEvent.fill(control, text)
    await userEvent.keyboard('{Tab}')
    await settled(element)
  }

  function submitButton(): HTMLElement {
    return Object.assign(document.createElement('lintje-button'), {
      type: 'submit',
      textContent: 'Versturen',
    })
  }

  /** The element under a point, through every shadow root. */
  function deepAt(x: number, y: number): Element | null {
    let hit = document.elementFromPoint(x, y)
    while (hit?.shadowRoot) {
      const inner = hit.shadowRoot.elementFromPoint(x, y)
      if (!inner || inner === hit) break
      hit = inner
    }
    return hit
  }

  /**
   * Presses `target` with the pointer and says whether the press and the click reached it. It
   * waits until the point it presses resolves into the target: a press on a page that has not
   * laid it out yet reaches nothing, and a field that refuses would hold the form all the same.
   */
  async function press(target: HTMLElement): Promise<{ landed: boolean; facts: string }> {
    const centre = (): [number, number] => {
      const box = target.getBoundingClientRect()
      return [box.left + box.width / 2, box.top + box.height / 2]
    }
    const inside = (node: Node | null): boolean => {
      for (let at = node; at; at = (at.parentNode ?? (at as ShadowRoot).host) as Node | null)
        if (at === target) return true
      return false
    }
    await expect.poll(() => inside(deepAt(...centre()))).toBe(true)
    const got: string[] = []
    let windowTarget = ''
    const onWindow = (event: Event): void => {
      windowTarget = (event.composedPath()[0] as Element).outerHTML?.slice(0, 80) ?? ''
    }
    window.addEventListener('pointerdown', onWindow, true)
    const down = (): number => got.push('pointerdown')
    const click = (): number => got.push('click')
    target.addEventListener('pointerdown', down)
    target.addEventListener('click', click)
    await userEvent.click(target)
    window.removeEventListener('pointerdown', onWindow, true)
    const facts = JSON.stringify({
      got,
      at: deepAt(...centre())?.outerHTML.slice(0, 80),
      windowTarget,
      box: target.getBoundingClientRect(),
    })
    return { landed: got.includes('pointerdown') && got.includes('click'), facts }
  }

  /** A native form with the field and its submit button, both in it before it is mounted. */
  async function nativeForm(
    row: { tag: string; props: object },
    props: object = {},
  ): Promise<{
    form: HTMLFormElement
    element: Input
    button: HTMLElement
    invalid: () => number
    submits: () => number
  }> {
    const form = document.createElement('form')
    // Firefox opens its own list of earlier entries over a typed field in a form; a press then
    // lands on that list, outside the page.
    form.autocomplete = 'off'
    let submitted = 0
    let invalid = 0
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      submitted += 1
    })
    form.addEventListener('invalid', () => (invalid += 1), true)
    const element = Object.assign(document.createElement(row.tag), {
      name: 'veld',
      label: 'Veld',
      ...row.props,
      ...props,
    }) as unknown as Input
    const button = submitButton()
    form.append(element, button)
    document.body.append(form)
    await settled(element)
    await settled(button as unknown as Input)
    return { form, element, button, invalid: () => invalid, submits: () => submitted }
  }

  describe.each(REFUSING)('$tag in a native form', (row) => {
    it('holds the submit while it shows text it refused, also by its button', async () => {
      const fill = { tag: row.tag, fill: {}, posts: [] }
      const { form, element, submits } = await inForm(fill, {
        ...row.props,
        value: row.value,
        required: false,
      })
      const button = submitButton()
      form.append(button)
      await typeAndLeave(element, row.refused)
      expect(element.refusal).not.toBe('')
      expect(form.checkValidity()).toBe(false)
      await userEvent.click(button)
      form.requestSubmit()
      await new Promise((resolve) => setTimeout(resolve, 20))
      expect(submits()).toBe(0)
    })

    it('holds a press on the button straight after typing', async () => {
      const { element, button, invalid, submits } = await nativeForm(row, { value: row.value })
      await userEvent.fill(element.renderRoot.querySelector('input')!, row.refused)
      const { landed, facts } = await press(button)
      await new Promise((resolve) => setTimeout(resolve, 20))
      expect(landed, facts).toBe(true)
      expect(invalid()).toBeGreaterThan(0)
      expect(submits()).toBe(0)
      expect(element.refusal).not.toBe('')
    })

    it('draws its message once a press on the empty page is released', async () => {
      const { element } = await nativeForm(row)
      const empty = document.createElement('div')
      empty.style.height = '48px'
      document.body.append(empty)
      await userEvent.fill(element.renderRoot.querySelector('input')!, row.refused)
      await userEvent.click(empty)
      await new Promise((resolve) => setTimeout(resolve, 20))
      await settled(element)
      expect(element.renderRoot.querySelector('.lintje-field__error')?.textContent).toContain(
        element.refusal,
      )
    })

    it('takes the focus at its control when the form reports', async () => {
      const fill = { tag: row.tag, fill: {}, posts: [] }
      const { form, element } = await inForm(fill, { ...row.props, required: false })
      await typeAndLeave(element, row.refused)
      element.focus()
      const control = active()
      ;(document.activeElement as HTMLElement | null)?.blur()
      expect(form.reportValidity()).toBe(false)
      expect(active()).toBe(control)
    })

    it('lets it through once the text is erased or back at its value', async () => {
      const fill = { tag: row.tag, fill: {}, posts: [] }
      const { form, element, submits } = await inForm(fill, {
        ...row.props,
        value: row.value,
        required: false,
      })
      await typeAndLeave(element, row.refused)
      await typeAndLeave(element, row.old)
      expect(form.checkValidity()).toBe(true)
      await typeAndLeave(element, row.refused)
      await typeAndLeave(element, '')
      expect(form.checkValidity()).toBe(true)
      form.requestSubmit()
      expect(submits()).toBe(1)
    })
  })

  describe.each(REFUSING)('$tag in lintje-form', (row) => {
    async function inLintjeForm(): Promise<{
      form: HTMLElement & { errors?: unknown }
      element: Input
      button: HTMLElement
      submits: () => number
    }> {
      const form = document.createElement('lintje-form') as HTMLElement & { errors?: unknown }
      let count = 0
      form.addEventListener('lintje-submit', () => (count += 1))
      const element = Object.assign(document.createElement(row.tag), {
        name: 'veld',
        label: 'Veld',
        ...row.props,
      }) as unknown as Input
      const button = submitButton()
      form.append(element, button)
      document.body.append(form)
      await (form as unknown as Input).updateComplete
      await settled(element)
      return { form, element, button, submits: () => count }
    }

    function summaryItems(form: HTMLElement): { field?: string; message: string }[] {
      const summary = form.shadowRoot!.querySelector('lintje-error-summary') as unknown as {
        items: { field?: string; message: string }[]
      }
      return summary.items
    }

    it('holds the submit, names the field in the summary and focuses it', async () => {
      const { form, element, button, submits } = await inLintjeForm()
      await typeAndLeave(element, row.refused)
      await userEvent.click(button)
      await (form as unknown as Input).updateComplete
      expect(submits()).toBe(0)
      expect(summaryItems(form)).toEqual([
        { field: 'veld', label: 'Veld', message: element.refusal },
      ])
      expect(active()?.getRootNode()).toBe(element.shadowRoot)
    })

    it('holds a press on the button straight after typing', async () => {
      const { form, element, button, submits } = await inLintjeForm()
      await userEvent.fill(element.renderRoot.querySelector('input')!, row.refused)
      const { landed, facts } = await press(button)
      await (form as unknown as Input).updateComplete
      expect(landed, facts).toBe(true)
      expect(submits()).toBe(0)
      expect(summaryItems(form)).toEqual([
        { field: 'veld', label: 'Veld', message: element.refusal },
      ])
    })

    it('submits once the text is back at its value, and the line leaves the summary', async () => {
      const { form, element, button, submits } = await inLintjeForm()
      element.value = row.value
      await settled(element)
      await typeAndLeave(element, row.refused)
      await userEvent.click(button)
      expect(submits()).toBe(0)
      await typeAndLeave(element, row.old)
      // The line goes once the focus leaves the field, not when it moves between its parts.
      ;(active() as HTMLElement | null)?.blur()
      await (form as unknown as Input).updateComplete
      expect(summaryItems(form)).toEqual([])
      await userEvent.click(button)
      expect(submits()).toBe(1)
    })
  })

  // A one-line hint becomes three lines of message: more than half the button moves away.
  describe('a message that wraps in a narrow column', () => {
    const row = { tag: 'lintje-date-input', props: { min: '2026-10-01' } }

    it('holds a press on the button of a native form straight after typing', async () => {
      const { form, element, button, invalid, submits } = await nativeForm(row)
      form.style.width = '8rem'
      await userEvent.fill(element.renderRoot.querySelector('input')!, '01-01-2026')
      const { landed, facts } = await press(button)
      await new Promise((resolve) => setTimeout(resolve, 20))
      await settled(element)
      const message = element.renderRoot.querySelector<HTMLElement>('.lintje-field__error')!
      const line = parseFloat(getComputedStyle(message).lineHeight)
      expect(message.getBoundingClientRect().height).toBeGreaterThan(1.5 * line)
      expect(landed, facts).toBe(true)
      expect(invalid()).toBeGreaterThan(0)
      expect(submits()).toBe(0)
    })

    it('holds a press on the button of lintje-form straight after typing', async () => {
      const form = document.createElement('lintje-form')
      form.style.cssText = 'display: block; width: 8rem'
      let submits = 0
      form.addEventListener('lintje-submit', () => (submits += 1))
      const element = Object.assign(document.createElement(row.tag), {
        name: 'veld',
        label: 'Veld',
        ...row.props,
      }) as unknown as Input
      const button = submitButton()
      form.append(element, button)
      document.body.append(form)
      await settled(element)
      await userEvent.fill(element.renderRoot.querySelector('input')!, '01-01-2026')
      const { landed, facts } = await press(button)
      expect(landed, facts).toBe(true)
      expect(submits).toBe(0)
    })
  })
})
