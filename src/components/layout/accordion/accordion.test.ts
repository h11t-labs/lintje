import { afterEach, describe, expect, it, vi } from 'vitest'
import { LintjeAccordion } from './accordion'
import type { LintjeExpander } from '../expander/expander'

afterEach(() => {
  document.body.replaceChildren()
})

const settled = async (element: { updateComplete: Promise<boolean> }): Promise<void> => {
  while (!(await element.updateComplete));
}

/** A slotchange and an observed mutation arrive after a turn of the event loop. */
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve))

async function accordion(attributes = '', rows = 3): Promise<LintjeAccordion> {
  const wrap = document.createElement('div')
  wrap.innerHTML = `<lintje-accordion ${attributes}>${Array.from(
    { length: rows },
    (_, index) => `<lintje-expander heading="Vraag ${index + 1}"><p>Antwoord</p></lintje-expander>`,
  ).join('')}</lintje-accordion>`
  const element = wrap.firstElementChild as LintjeAccordion
  document.body.append(element)
  await settled(element)
  await tick()
  for (const row of rowsOf(element)) await settled(row)
  return element
}

const rowsOf = (element: LintjeAccordion): LintjeExpander[] => [
  ...element.querySelectorAll<LintjeExpander>(':scope > lintje-expander'),
]

const press = async (row: LintjeExpander): Promise<void> => {
  row.shadowRoot!.querySelector<HTMLButtonElement>('.lintje-disclosure__header')!.click()
  await settled(row)
}

const link = (element: LintjeAccordion): HTMLElement | null =>
  element.shadowRoot!.querySelector('lintje-button')

describe('lintje-accordion at load', () => {
  it('draws once when every row starts open, and the link says "Alles sluiten"', async () => {
    const render = vi.spyOn(LintjeAccordion.prototype as unknown as { render(): unknown }, 'render')
    try {
      const wrap = document.createElement('div')
      wrap.innerHTML = `<lintje-accordion toggle-all>${[1, 2]
        .map((n) => `<lintje-expander heading="Vraag ${n}" open><p>Antwoord</p></lintje-expander>`)
        .join('')}</lintje-accordion>`
      const element = wrap.firstElementChild as LintjeAccordion
      document.body.append(element)
      await settled(element)
      await tick()
      await settled(element)
      expect(render).toHaveBeenCalledTimes(1)
      expect(link(element)!.textContent!.trim()).toBe('Alles sluiten')
    } finally {
      render.mockRestore()
    }
  })
})

describe('lintje-accordion', () => {
  it('draws each expander as a row: flat, the chevron first', async () => {
    const element = await accordion()
    for (const row of rowsOf(element)) {
      expect(row.flat).toBe(true)
      expect(row.leading).toBe(true)
      expect(row.hasAttribute('row')).toBe(true)
    }
  })

  it('gives a row back what it had once it leaves', async () => {
    const element = await accordion()
    const [row] = rowsOf(element)
    document.body.append(row!)
    await tick()
    expect(row!.flat).toBe(false)
    expect(row!.leading).toBe(false)
    expect(row!.hasAttribute('row')).toBe(false)
    expect(rowsOf(element).every((other) => other.flat)).toBe(true)
  })

  it('lets more rows stand open at once', async () => {
    const element = await accordion()
    const [first, second] = rowsOf(element)
    await press(first!)
    await press(second!)
    expect(first!.open).toBe(true)
    expect(second!.open).toBe(true)
  })

  it('with exclusive closes the others, and each closed row says so', async () => {
    const element = await accordion('exclusive')
    const [first, second] = rowsOf(element)
    await press(first!)
    const toggles: [string, boolean][] = []
    element.addEventListener('lintje-toggle', (event) =>
      toggles.push([
        (event.target as LintjeExpander).heading,
        (event as CustomEvent<boolean>).detail,
      ]),
    )
    await press(second!)
    expect(first!.open).toBe(false)
    expect(second!.open).toBe(true)
    expect(toggles).toEqual([
      ['Vraag 1', false],
      ['Vraag 2', true],
    ])
  })

  it('leaves a toggle from deeper inside a row alone', async () => {
    const element = await accordion('exclusive')
    const [first, second] = rowsOf(element)
    await press(first!)
    const nested = document.createElement('lintje-expander') as LintjeExpander
    nested.heading = 'Dieper'
    second!.append(nested)
    await settled(nested)
    await press(nested)
    expect(first!.open).toBe(true)
  })

  it('draws no link unless asked', async () => {
    expect(link(await accordion())).toBeNull()
    expect(link(await accordion('toggle-all exclusive'))).toBeNull()
  })

  it('with toggle-all opens every row, and then offers to close them', async () => {
    const element = await accordion('toggle-all')
    expect(link(element)!.textContent!.trim()).toBe('Alles openen')
    const toggles: boolean[] = []
    element.addEventListener('lintje-toggle', (event) =>
      toggles.push((event as CustomEvent<boolean>).detail),
    )
    link(element)!.click()
    for (const row of rowsOf(element)) await settled(row)
    await tick()
    await settled(element)
    expect(rowsOf(element).every((row) => row.open)).toBe(true)
    expect(toggles).toEqual([true, true, true])
    expect(link(element)!.textContent!.trim()).toBe('Alles sluiten')
    link(element)!.click()
    for (const row of rowsOf(element)) await settled(row)
    await tick()
    await settled(element)
    expect(rowsOf(element).some((row) => row.open)).toBe(false)
    expect(link(element)!.textContent!.trim()).toBe('Alles openen')
  })

  it('reads a row the host opened itself', async () => {
    const element = await accordion('toggle-all', 1)
    rowsOf(element)[0]!.open = true
    await settled(rowsOf(element)[0]!)
    await tick()
    await settled(element)
    expect(link(element)!.textContent!.trim()).toBe('Alles sluiten')
  })

  it('passes its level on to every row; without one each keeps h3', async () => {
    const plain = await accordion()
    const levelOf = (row: LintjeExpander) =>
      row.shadowRoot!.querySelector('.lintje-disclosure__heading')!.localName
    expect(rowsOf(plain).map(levelOf)).toEqual(['h3', 'h3', 'h3'])
    const nested = await accordion('level="4"')
    for (const row of rowsOf(nested)) await settled(row)
    expect(rowsOf(nested).map(levelOf)).toEqual(['h4', 'h4', 'h4'])
  })
})
