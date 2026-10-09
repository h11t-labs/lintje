/** The list in a browser: the focus ring of its row, and the title that wraps under the keyboard's focus. */
import { afterEach, describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { deepActiveElement, holdsFocus } from '../../../core/focus'
import './list'
import type { LintjeList, ListItem } from './list'
import { TAB } from '../../../core/test-keys'

const ROWS: ListItem[] = [
  { id: 'a', title: 'Eerste', actions: [{ value: 'weg', label: 'Verwijderen' }] },
  { id: 'b', title: 'Tweede', actions: [{ value: 'weg', label: 'Verwijderen' }] },
  { id: 'c', title: 'Derde', actions: [{ value: 'weg', label: 'Verwijderen' }] },
]

const LONG: ListItem[] = [
  {
    id: 'l',
    title:
      'Uw aanvraag is ontvangen. Binnen acht weken krijgt u een besluit, en bij vragen kunt u ons op werkdagen bellen.',
    meta: '10:12',
  },
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

function lines(element: LintjeList): number {
  const node = title(rows(element)[0]!)
  const height = parseFloat(getComputedStyle(node).lineHeight)
  return Math.round(node.getBoundingClientRect().height / height)
}

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
    // Under reduced motion `base.css` still gives every property 80 ms: wait for the end.
    await expect.poll(() => ring.outlineColor).toBe(resolvedColour('--color-focus'))
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

describe('lintje-list shows the whole title without a pointer', () => {
  it('cuts the title to one line on a wide screen, and wraps it with the keyboard’s focus', async () => {
    const element = await mount(LONG)
    element.style.width = '320px'
    await settle(element)
    expect(lines(element)).toBe(1)
    await tabInto(element)
    expect(deepActiveElement()).toBe(title(rows(element)[0]!))
    expect(title(rows(element)[0]!).matches(':focus-visible')).toBe(true)
    expect(lines(element)).toBeGreaterThan(1)
  })

  it('wraps the title of a row that opens nothing when its action has the focus', async () => {
    const [item] = LONG
    const element = await mount([
      { ...item!, clickable: false, action: { label: 'Annuleren', value: 'annuleren' } },
    ])
    element.style.width = '480px'
    await settle(element)
    expect(lines(element)).toBe(1)
    await tabInto(element)
    expect(holdsFocus(rows(element)[0]!.querySelector('lintje-button')!)).toBe(true)
    expect(lines(element)).toBeGreaterThan(1)
  })
})
