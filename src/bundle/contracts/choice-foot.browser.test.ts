/** The hint and error under a lone choice start where its label text does. */
import { afterEach, describe, expect, it } from 'vitest'
import '../../components/inputs/checkbox/checkbox'
import '../../components/inputs/checkbox-group/checkbox-group'
import '../../components/inputs/multiselect/multiselect'
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

async function draw(tag: string, props: object): Promise<Input> {
  const element = Object.assign(document.createElement(tag), {
    label: 'Veld',
    ...props,
  }) as unknown as Input
  document.body.append(element)
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
      expect(left(root, foot)).toBeCloseTo(left(root, '.lintje-field'), 0)
      group.remove()
    }
  })

  it('a setting row, whose label text stands at the left edge', async () => {
    const toggle = await draw('lintje-toggle', { hint: 'Toelichting', layout: 'row' })
    toggle.style.width = '800px'
    await new Promise(requestAnimationFrame)
    const root = toggle.renderRoot
    expect(left(root, '.lintje-field__hint')).toBeCloseTo(left(root, '.lintje-choice__label'), 0)
    expect(left(root, '.lintje-field__hint')).toBeCloseTo(left(root, '.lintje-field'), 0)
  })
})
