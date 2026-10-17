/** The translator in a browser: the source's counter stands on the foot line, right, level with its tools. */
import { afterEach, describe, expect, it } from 'vitest'
import './translator'
import type { LintjeTranslator } from './translator'

async function mount(value: string): Promise<LintjeTranslator> {
  const element = Object.assign(document.createElement('lintje-translator'), {
    maxlength: 40,
    value,
  })
  element.innerHTML =
    '<lintje-icon-button slot="source-actions" icon="beeld-en-geluid-microfoon" label="Inspreken" variant="flat"></lintje-icon-button>'
  element.style.width = '960px'
  document.body.append(element)
  await element.updateComplete
  const field = element.shadowRoot!.querySelector('lintje-textarea')!
  await field.updateComplete
  return element
}

const box = (node: Element): DOMRect => node.getBoundingClientRect()

function parts(element: LintjeTranslator) {
  const root = element.shadowRoot!
  const field = root.querySelector('lintje-textarea')!
  return {
    body: root.querySelector('.lintje-translator__body--source')!,
    tool: element.querySelector('lintje-icon-button')!,
    field: field.shadowRoot!.querySelector('.lintje-field')!,
    control: field.shadowRoot!.querySelector('.lintje-textarea__control')!,
    counter: field.shadowRoot!.querySelector('[part="counter"]')!,
  }
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('lintje-translator keeps its counter on the source foot', () => {
  for (const [state, value] of [
    ['under the limit', 'Uw aanvraag is ontvangen.'],
    ['over the limit', 'Uw aanvraag is ontvangen. Binnen acht weken krijgt u een besluit.'],
  ] as const) {
    it(`stands it right, level with the tools, ${state}`, async () => {
      const { body, tool, counter } = parts(await mount(value))
      const middle = (rect: DOMRect): number => rect.top + rect.height / 2
      expect(middle(box(counter))).toBeCloseTo(middle(box(tool)), 0)
      const inset = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--space-4'),
      )
      expect(box(counter).right).toBeCloseTo(box(body).right - inset, 0)
    })
  }

  it('adds no line under the text for the counter alone', async () => {
    const { field, control } = parts(await mount('Uw aanvraag is ontvangen.'))
    expect(box(field).bottom).toBeCloseTo(box(control).bottom, 0)
  })
})
