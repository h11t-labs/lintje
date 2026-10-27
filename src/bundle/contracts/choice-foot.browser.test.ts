/**
 * The hint and error under a lone choice start where its label text does, and its control stands
 * on the first line of a label that wraps, as the menu's icons do.
 */
import { afterEach, describe, expect, it } from 'vitest'
import '../../components/inputs/checkbox/checkbox'
import '../../components/inputs/checkbox-group/checkbox-group'
import '../../components/inputs/multiselect/multiselect'
import '../../components/inputs/radio-group/radio-group'
import '../../components/inputs/toggle/toggle'
import type { LintjeInputElement } from '../../components/inputs/shared/input'

type Input = LintjeInputElement & Record<string, unknown>

const OPTIONS = [
  { value: 'a', label: 'Alfa' },
  { value: 'b', label: 'Bravo', description: 'Elke ochtend één bericht.' },
]

/** One element, and the choice under it whose foot is measured. */
interface Row {
  name: string
  tag: string
  props: object
  foot: '.lintje-field__hint' | '.lintje-field__error'
  choice?: (element: Input) => Element | null | undefined
}

/** The option with a description, drawn as a `lintje-checkbox` in the element's own root. */
const described = (element: Input): Element | null | undefined =>
  [...element.renderRoot.querySelectorAll('lintje-checkbox')].find(
    (box) => (box as LintjeInputElement).hint === OPTIONS[1].description,
  )

const ROWS: Row[] = [
  {
    name: 'checkbox hint',
    tag: 'lintje-checkbox',
    props: { hint: 'Toelichting' },
    foot: '.lintje-field__hint',
  },
  {
    name: 'checkbox error',
    tag: 'lintje-checkbox',
    props: { error: 'Fout' },
    foot: '.lintje-field__error',
  },
  {
    name: 'toggle hint',
    tag: 'lintje-toggle',
    props: { hint: 'Toelichting' },
    foot: '.lintje-field__hint',
  },
  {
    name: 'toggle error',
    tag: 'lintje-toggle',
    props: { error: 'Fout' },
    foot: '.lintje-field__error',
  },
  {
    name: 'checkbox-group option',
    tag: 'lintje-checkbox-group',
    props: { options: OPTIONS },
    foot: '.lintje-field__hint',
    choice: described,
  },
  {
    name: 'multiselect option',
    tag: 'lintje-multiselect',
    props: { options: OPTIONS, open: true },
    foot: '.lintje-field__hint',
    choice: described,
  },
]

/** Waits until the element and the parts it draws with other elements have drawn. */
async function settled(element: Input): Promise<void> {
  await element.updateComplete
  const parts = [...element.renderRoot.querySelectorAll('*')].map(
    (node) => (node as Partial<Input>).updateComplete,
  )
  await Promise.all(parts)
  await new Promise(requestAnimationFrame)
}

async function draw(
  tag: string,
  props: object,
  parent: HTMLElement = document.body,
): Promise<Input> {
  const element = Object.assign(document.createElement(tag), {
    label: 'Veld',
    ...props,
  }) as unknown as Input
  parent.append(element)
  if (parent !== document.body) document.body.append(parent)
  await settled(element)
  return element
}

const left = (root: ParentNode, selector: string): number =>
  root.querySelector(selector)!.getBoundingClientRect().left

afterEach(() => {
  document.body.replaceChildren()
})

describe.each(ROWS)('$name', (row) => {
  it('starts its foot at the label text', async () => {
    const element = await draw(row.tag, row.props)
    const choice = (row.choice?.(element) ?? element) as Input
    const root = choice.renderRoot
    expect(left(root, row.foot)).toBeCloseTo(left(root, '.lintje-choice__label'), 0)
    expect(left(root, row.foot)).toBeGreaterThan(left(root, '.lintje-choice'))
  })
})

describe('where the foot stays at the edge', () => {
  it("a group's own hint and error, under its label", async () => {
    for (const props of [{ hint: 'Kies er een of meer.' }, { error: 'Kies er een.' }]) {
      const group = await draw('lintje-checkbox-group', { options: OPTIONS, ...props })
      const root = group.renderRoot
      const foot = 'hint' in props ? '.lintje-field__hint' : '.lintje-field__error'
      // At the label's edge: a field in error stands behind its bar, label and line alike.
      expect(left(root, foot)).toBeCloseTo(left(root, '.lintje-label'), 0)
      group.remove()
    }
  })

  it('a setting row, whose label text stands at the left edge', async () => {
    // Wide from the start: widening it later would let the reduced-motion transition (which the
    // tests run under) still be moving the hint when it is measured.
    const wide = Object.assign(document.createElement('div'), { style: 'width: 800px' })
    const toggle = await draw('lintje-toggle', { hint: 'Toelichting', layout: 'row' }, wide)
    const root = toggle.renderRoot
    expect(left(root, '.lintje-field__hint')).toBeCloseTo(left(root, '.lintje-choice__label'), 0)
    expect(left(root, '.lintje-field__hint')).toBeCloseTo(left(root, '.lintje-field'), 0)
  })
})

const CONTROL = '.lintje-choice__box, .lintje-choice__radio, .lintje-choice__switch'
/** Three lines and more at 220 px, and two in a radio group's option. */
const WRAPS = 'Elke ochtend één bericht met alle wijzigingen in de aanvragen van de afgelopen dag'
const TWO_LINES = 'Elke ochtend één bericht met de wijzigingen'

const middle = (box: DOMRect): number => box.top + box.height / 2

/** The box of the first line of a text. */
function firstLine(text: Element): DOMRect {
  const range = document.createRange()
  range.selectNodeContents(text)
  return range.getClientRects()[0]!
}

describe('the control of a choice', () => {
  const choices: [string, object, number][] = [
    ['lintje-checkbox', { label: WRAPS }, 3],
    ['lintje-toggle', { label: WRAPS }, 3],
    ['lintje-radio-group', { options: [{ value: 'a', label: TWO_LINES }] }, 2],
  ]
  for (const [tag, props, least] of choices) {
    it(`stands on the first line of a label that wraps, which grows it no more than its text: ${tag}`, async () => {
      const narrow = Object.assign(document.createElement('div'), { style: 'width: 220px' })
      const root = (await draw(tag, props, narrow)).renderRoot
      const choice = root.querySelector('.lintje-choice')!
      const label = root.querySelector('.lintje-choice__label')!
      const line = firstLine(label)
      const text = label.getBoundingClientRect()
      expect(Math.round(text.height / line.height), 'lines').toBeGreaterThanOrEqual(least)
      const control = root.querySelector(CONTROL)!.getBoundingClientRect()
      expect(Math.abs(middle(control) - middle(line))).toBeLessThan(2)
      // As tall as the label's text, or as the target where that is more: no air is added.
      const target = parseFloat(getComputedStyle(choice).minHeight)
      expect(choice.getBoundingClientRect().height).toBeCloseTo(Math.max(target, text.height), 0)
    })
  }

  it('stands in the middle of a choice of one line, which keeps its target height', async () => {
    const root = (await draw('lintje-checkbox', {})).renderRoot
    const choice = root.querySelector('.lintje-choice')!.getBoundingClientRect()
    const target = parseFloat(getComputedStyle(root.querySelector('.lintje-choice')!).minHeight)
    expect(target).toBe(48)
    expect(choice.height).toBeCloseTo(target, 1)
    const box = root.querySelector(CONTROL)!.getBoundingClientRect()
    const label = root.querySelector('.lintje-choice__label')!.getBoundingClientRect()
    expect(middle(box)).toBeCloseTo(middle(choice), 0)
    expect(middle(label)).toBeCloseTo(middle(choice), 0)
  })
})
