/** The list in a browser: the focus ring of its row. The title that wraps is in the truncate contract. */
import { afterEach, describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { deepActiveElement } from '../../../core/focus'
import './list'
import type { LintjeList, ListItem } from './list'
import { TAB } from '../../../core/test-keys'

const ROWS: ListItem[] = [
  { id: 'a', title: 'Eerste', actions: [{ value: 'weg', label: 'Verwijderen' }] },
  { id: 'b', title: 'Tweede', actions: [{ value: 'weg', label: 'Verwijderen' }] },
  { id: 'c', title: 'Derde', actions: [{ value: 'weg', label: 'Verwijderen' }] },
]

async function mount(items: ListItem[]): Promise<LintjeList> {
  const element = Object.assign(document.createElement('lintje-list'), { items })
  document.body.append(element)
  await settle(element)
  return element
}

// The landing control may be new: its own first update comes after the list's.
async function settle(element: LintjeList): Promise<void> {
  await element.updateComplete
  for (let round = 0; round < 3; round += 1) await new Promise((done) => setTimeout(done))
}

const rows = (element: LintjeList): HTMLElement[] => [
  ...element.shadowRoot!.querySelectorAll<HTMLElement>('.lintje-list__row'),
]
const title = (row: HTMLElement): HTMLElement => row.querySelector('.lintje-list__title')!

/** One Tab from a field just before the list: WebKit sends the key only to a document that holds the focus. */
async function tabInto(element: LintjeList): Promise<void> {
  const start = Object.assign(document.createElement('input'), { ariaLabel: 'Zoeken' })
  element.before(start)
  start.focus()
  await userEvent.keyboard(TAB)
}

/** A token as the browser resolves it, in the notation `getComputedStyle` reports a colour. */
function resolvedColour(token: string): string {
  const probe = document.createElement('span')
  probe.style.color = `var(${token})`
  document.body.append(probe)
  const colour = getComputedStyle(probe).color
  probe.remove()
  return colour
}

afterEach(async () => {
  document.body.replaceChildren()
  await page.viewport(1440, 900)
})

describe('lintje-list rings the row whose title has the keyboard’s focus', () => {
  it('draws the focus outline on the row, inside it, and none on the title', async () => {
    const element = await mount(ROWS)
    const row = rows(element)[0]!
    expect(getComputedStyle(row).outlineStyle).toBe('none')
    await tabInto(element)
    expect(deepActiveElement()).toBe(title(row))
    expect(title(row).matches(':focus-visible')).toBe(true)
    const ring = getComputedStyle(row)
    expect(ring.outlineColor).toBe(resolvedColour('--color-focus'))
    expect(ring.outlineStyle).toBe('solid')
    expect(ring.outlineWidth).toBe('3px')
    expect(ring.outlineOffset).toBe('-3px')
    expect(getComputedStyle(title(row)).outlineStyle).toBe('none')
  })

  it('draws no ring when a pointer gave the title its focus', async () => {
    const element = await mount(ROWS)
    const row = rows(element)[0]!
    await userEvent.click(title(row))
    expect(getComputedStyle(row).outlineStyle).toBe('none')
  })
})
