/**
 * The row and the column in a real layout: a row wider than its room stands as a column, and
 * the room is the frame's own cell — in a settings row the control's column, not the host.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import './segmented'
import type { LintjeSegmented } from './segmented'

const SHORT = ['Week', 'Maand', 'Jaar'].map((label) => ({ value: label, label }))
const LONG = ['Afgelopen zeven dagen', 'Afgelopen dertig dagen', 'Afgelopen kwartaal'].map(
  (label) => ({ value: label, label }),
)

async function mount(props: Partial<LintjeSegmented>, width: number): Promise<LintjeSegmented> {
  const element = document.createElement('lintje-segmented') as LintjeSegmented
  Object.assign(element, { label: 'Periode', value: 'Week', options: SHORT }, props)
  element.style.width = `${width}px`
  document.body.append(element)
  await element.updateComplete
  await element.updateComplete
  return element
}

const frame = (element: LintjeSegmented): HTMLElement =>
  element.renderRoot.querySelector<HTMLElement>('.lintje-segmented')!

afterEach(() => {
  document.body.replaceChildren()
})

describe('lintje-segmented and its room', () => {
  it('stays a row while the options fit the host, and stands as a column when they do not', async () => {
    const element = await mount({}, 800)
    expect(frame(element).classList.contains('is-column')).toBe(false)
    element.style.width = '120px'
    // The observer reports after the frame's layout, so the second frame sees its update.
    await new Promise(requestAnimationFrame)
    await new Promise(requestAnimationFrame)
    await element.updateComplete
    expect(frame(element).classList.contains('is-column')).toBe(true)
    expect(frame(element).getBoundingClientRect().right).toBeLessThanOrEqual(
      element.getBoundingClientRect().right,
    )
  })

  it('measures against the control cell of a settings row, not against the whole row', async () => {
    const element = await mount({ layout: 'row', options: LONG, value: LONG[0].value }, 800)
    expect(frame(element).classList.contains('is-column')).toBe(true)
    expect(frame(element).getBoundingClientRect().right).toBeLessThanOrEqual(
      element.getBoundingClientRect().right + 0.5,
    )
    // Options that fit the cell make a row again.
    element.options = SHORT
    element.value = 'Week'
    await element.updateComplete
    await element.updateComplete
    expect(frame(element).classList.contains('is-column')).toBe(false)
  })
})

describe('lintje-segmented and the focus ring', () => {
  const options = (element: LintjeSegmented): HTMLElement[] => [
    ...element.renderRoot.querySelectorAll<HTMLElement>('.lintje-segmented__option'),
  ]
  const layer = (option: HTMLElement): number => Number(getComputedStyle(option).zIndex) || 0

  /** Tabs onto "Week", beside the chosen "Maand": the ring is the keyboard's. */
  async function focusBesideChosen(element: LintjeSegmented): Promise<void> {
    await userEvent.tab()
    expect(element.shadowRoot!.activeElement).toBe(options(element)[0])
    expect(options(element)[0].matches(':focus-visible')).toBe(true)
  }

  it('lays the focused option over the chosen one in a row', async () => {
    const element = await mount({ value: 'Maand' }, 800)
    expect(frame(element).classList.contains('is-column')).toBe(false)
    await focusBesideChosen(element)
    const [focused, chosen] = options(element)
    expect(layer(focused)).toBeGreaterThan(layer(chosen))
  })

  it('lays the focused option over the chosen one in a column', async () => {
    const element = await mount({ value: 'Maand' }, 120)
    await new Promise(requestAnimationFrame)
    await new Promise(requestAnimationFrame)
    await element.updateComplete
    expect(frame(element).classList.contains('is-column')).toBe(true)
    await focusBesideChosen(element)
    const [focused, chosen] = options(element)
    expect(layer(focused)).toBeGreaterThan(layer(chosen))
  })
})
