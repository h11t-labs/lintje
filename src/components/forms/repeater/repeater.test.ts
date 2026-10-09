/**
 * The repeater: it asks and the host answers. It numbers and names the rows, holds `min` and
 * `max`, and lets the focus and the live region follow the host's answer.
 */
import { describe, expect, it } from 'vitest'
import './repeater'
import { firstFocusable, type LintjeRepeater, type LintjeRepeaterRow } from './repeater'

function row(name: string): LintjeRepeaterRow {
  const element = document.createElement('lintje-repeater-row')
  element.innerHTML = `<input aria-label="Naam" value="${name}"><select aria-label="Rol"></select>`
  return element
}

async function mount(
  names: string[],
  props: Partial<LintjeRepeater> = {},
): Promise<LintjeRepeater> {
  const element = Object.assign(document.createElement('lintje-repeater'), {
    legend: 'Betrokkenen',
    itemLabel: 'Betrokkene',
    ...props,
  })
  element.append(...names.map(row))
  document.body.append(element)
  await settle(element)
  return element
}

/** The slot reports its rows after the first render; then the rows draw. */
async function settle(element: LintjeRepeater): Promise<void> {
  await element.updateComplete
  await new Promise((resolve) => setTimeout(resolve, 0))
  await element.updateComplete
  for (const child of element.children) await (child as LintjeRepeaterRow).updateComplete
}

const rows = (element: LintjeRepeater): LintjeRepeaterRow[] =>
  [...element.children] as LintjeRepeaterRow[]
const removeButton = (item: LintjeRepeaterRow) =>
  item.shadowRoot!.querySelector('lintje-icon-button')!
const addButton = (element: LintjeRepeater) => element.shadowRoot!.querySelector('lintje-button')!

describe('lintje-repeater', () => {
  it('is a fieldset with its legend, the add button and the count', async () => {
    const element = await mount(['J. de Vries', 'A. Jansen'], { max: 10 })
    const root = element.shadowRoot!
    expect(root.querySelector('fieldset legend')!.textContent).toBe('Betrokkenen')
    expect(addButton(element).textContent!.trim()).toBe('Betrokkene toevoegen')
    expect(addButton(element).getAttribute('icon')).toBe('functioneel-plus')
    expect(root.querySelector('.lintje-repeater__count')!.textContent).toBe('2 van hoogstens 10')
  })

  it('numbers its rows and names their remove buttons', async () => {
    const element = await mount(['J. de Vries', 'A. Jansen'])
    expect(rows(element).map((item) => item.index)).toEqual([0, 1])
    expect(removeButton(rows(element)[1]).getAttribute('label')).toBe('Betrokkene 2 verwijderen')
    expect(removeButton(rows(element)[1]).getAttribute('icon')).toBe('functioneel-verwijderen')
    // Each row is a group named after it, so its fields are heard as that row's.
    await rows(element)[1]!.updateComplete
    const group = rows(element)[1]!.shadowRoot!.querySelector('.lintje-repeater-row')!
    expect(group.getAttribute('role')).toBe('group')
    expect(group.getAttribute('aria-label')).toBe('Betrokkene 2')
  })

  it('disables the remove buttons at min rows and the add button at max', async () => {
    const atMin = await mount(['J. de Vries'], { min: 1 })
    expect(removeButton(rows(atMin)[0]).hasAttribute('disabled')).toBe(true)

    const atMax = await mount(['J. de Vries', 'A. Jansen'], { max: 2 })
    expect(addButton(atMax).hasAttribute('disabled')).toBe(true)
    let asked = 0
    atMax.addEventListener('lintje-row-add', () => asked++)
    addButton(atMax).click()
    expect(asked).toBe(0)
  })

  it('asks to add a row with the index it will get, and announces it when the host adds it', async () => {
    const element = await mount(['J. de Vries'])
    const asked: unknown[] = []
    element.addEventListener('lintje-row-add', (event) => {
      asked.push((event as CustomEvent).detail)
      element.append(row(''))
    })
    addButton(element).click()
    await settle(element)
    expect(asked).toEqual([1])
    expect(element.shadowRoot!.querySelector('[aria-live]')!.textContent).toBe(
      'Betrokkene 2 toegevoegd',
    )
  })

  it('asks to remove a row with its index, composed, and announces it when the host does', async () => {
    const element = await mount(['J. de Vries', 'A. Jansen', 'K. Bakker'])
    const asked: unknown[] = []
    document.addEventListener(
      'lintje-row-remove',
      (event) => {
        asked.push((event as CustomEvent).detail)
        rows(element)[(event as CustomEvent<number>).detail].remove()
      },
      { once: true },
    )
    removeButton(rows(element)[1]).click()
    await settle(element)
    expect(asked).toEqual([1])
    expect(rows(element).map((item) => item.index)).toEqual([0, 1])
    expect(element.shadowRoot!.querySelector('[aria-live]')!.textContent).toBe(
      'Betrokkene 2 verwijderd',
    )
    // The focus goes to the remove button of the row above the one that went.
    let active: Element | null = document.activeElement
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement
    const above = removeButton(rows(element)[0]) as unknown as HTMLElement
    expect(above.shadowRoot?.contains(active) || above === active).toBe(true)
  })
})

describe('firstFocusable()', () => {
  it('finds the first field of a row before its remove button, through shadow roots', async () => {
    const element = await mount(['J. de Vries'])
    expect(firstFocusable(rows(element)[0])).toBe(rows(element)[0].querySelector('input'))

    const empty = document.createElement('lintje-repeater-row')
    document.body.append(empty)
    await empty.updateComplete
    await (removeButton(empty) as unknown as { updateComplete: Promise<unknown> }).updateComplete
    expect(firstFocusable(empty)!.tagName).toBe('BUTTON')
  })
})
