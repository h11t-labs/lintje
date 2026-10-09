/** The textarea in a real engine: it grows with its text, through `field-sizing` or its own fallback. */
import { afterEach, describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import './textarea'
import type { LintjeTextarea } from './textarea'

const text = (count: number): string =>
  Array.from({ length: count }, (_, index) => `Regel ${index + 1} van de toelichting`).join('\n')

async function mount(props: Partial<LintjeTextarea> = {}): Promise<LintjeTextarea> {
  const element = Object.assign(document.createElement('lintje-textarea'), {
    label: 'Toelichting',
    ...props,
  })
  element.style.width = '480px'
  document.body.append(element)
  await element.updateComplete
  return element
}

const control = (element: LintjeTextarea): HTMLTextAreaElement =>
  element.shadowRoot!.querySelector<HTMLTextAreaElement>('.lintje-textarea__control')!

async function heightWith(element: LintjeTextarea, lines: number): Promise<number> {
  element.value = text(lines)
  await element.updateComplete
  return control(element).getBoundingClientRect().height
}

const lineHeight = (area: HTMLTextAreaElement): number =>
  parseFloat(getComputedStyle(area).lineHeight)

afterEach(() => {
  document.body.replaceChildren()
})

describe('lintje-textarea grows with its text', () => {
  it('sets an inline height only in an engine without `field-sizing`', async () => {
    const element = await mount()
    await heightWith(element, 8)
    expect(control(element).style.height === '').toBe(CSS.supports('field-sizing', 'content'))
  })

  it('shows three lines at least and grows a line at a time', async () => {
    const element = await mount()
    const area = control(element)
    const empty = await heightWith(element, 0)
    expect(await heightWith(element, 2)).toBeCloseTo(empty, 0)
    expect(await heightWith(element, 5)).toBeCloseTo(empty + 2 * lineHeight(area), 0)
  })

  it('stops at twelve lines and scrolls', async () => {
    const element = await mount()
    const twelve = await heightWith(element, 12)
    expect(await heightWith(element, 15)).toBeCloseTo(twelve, 0)
    const area = control(element)
    expect(area.scrollHeight).toBeGreaterThan(area.clientHeight)
  })

  it('shrinks again when text goes', async () => {
    const element = await mount()
    const four = await heightWith(element, 4)
    await heightWith(element, 15)
    expect(await heightWith(element, 4)).toBeCloseTo(four, 0)
  })

  it('keeps `rows` as the least', async () => {
    const element = await mount({ rows: 6 })
    const area = control(element)
    const empty = await heightWith(element, 0)
    expect(await heightWith(element, 6)).toBeCloseTo(empty, 0)
    expect(await heightWith(element, 7)).toBeCloseTo(empty + lineHeight(area), 0)
  })

  it('grows while typing', async () => {
    const element = await mount()
    const area = control(element)
    const empty = area.getBoundingClientRect().height
    await userEvent.fill(area, text(5))
    await element.updateComplete
    expect(element.value).toBe(text(5))
    expect(area.getBoundingClientRect().height).toBeCloseTo(empty + 2 * lineHeight(area), 0)
  })
})
