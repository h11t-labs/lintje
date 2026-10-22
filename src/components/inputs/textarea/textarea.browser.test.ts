/**
 * The textarea in a real engine: it grows with its text, through `field-sizing` or its own
 * fallback, and stands its counter right on the line of the hint or the error.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
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

const OVER = 'Een tekst die langer is dan de limiet toelaat.'

function foot(element: LintjeTextarea) {
  const root = element.shadowRoot!
  return {
    control: root.querySelector('.lintje-textarea__control')!.getBoundingClientRect(),
    line: root.querySelector('.lintje-field__error, .lintje-field__hint')!.getBoundingClientRect(),
    counter: root.querySelector('[part="counter"]')!.getBoundingClientRect(),
  }
}

describe('lintje-textarea stands its line above the field and its counter under it', () => {
  afterEach(async () => {
    await page.viewport(1440, 900)
  })

  const cases: [string, Partial<LintjeTextarea>][] = [
    ['the error over the limit', { maxlength: 40, value: OVER }],
    ['a hint', { maxlength: 2000, hint: 'Wat er is gebeurd, in een paar zinnen.' }],
    ['the error of plain', { variant: 'plain', maxlength: 40, value: OVER }],
  ]
  for (const width of [1440, 390]) {
    for (const [name, props] of cases) {
      it(`puts ${name} above the field and the counter under it, right, at ${width} px`, async () => {
        await page.viewport(width, 900)
        const element = await mount(props)
        // Below 768 px the field takes the full width, as on a phone.
        if (width < 768) element.style.width = ''
        await element.updateComplete
        const { control, line, counter } = foot(element)
        expect(line.bottom).toBeLessThanOrEqual(control.top)
        expect(line.left).toBeCloseTo(control.left, 0)
        expect(counter.top).toBeGreaterThanOrEqual(control.bottom)
        expect(counter.right).toBeCloseTo(control.right, 0)
      })
    }
  }

  it('keeps the counter under the field, right, beside a long message in a narrow field', async () => {
    const element = await mount({ maxlength: 40, value: OVER })
    element.style.width = '240px'
    element.error = 'Schrijf de omschrijving zonder namen of adressen van andere mensen.'
    await element.updateComplete
    const { control, line, counter } = foot(element)
    expect(line.bottom).toBeLessThanOrEqual(control.top)
    expect(counter.top).toBeGreaterThanOrEqual(control.bottom)
    expect(counter.right).toBeCloseTo(control.right, 0)
    expect(counter.right).toBeLessThanOrEqual(element.getBoundingClientRect().right)
  })

  it('keeps the hint under the name and the counter under the field in a row', async () => {
    const element = await mount({ layout: 'row', maxlength: 2000, hint: 'Een paar zinnen.' })
    element.style.width = '800px'
    await element.updateComplete
    const { control, line, counter } = foot(element)
    expect(line.right).toBeLessThan(control.left)
    expect(counter.top).toBeGreaterThanOrEqual(control.bottom)
    expect(counter.right).toBeCloseTo(control.right, 0)
  })

  it('keeps a counter alone at the right', async () => {
    const element = await mount({ maxlength: 2000 })
    const counter = element.shadowRoot!.querySelector('[part="counter"]')!.getBoundingClientRect()
    expect(counter.right).toBeCloseTo(element.getBoundingClientRect().right, 0)
  })
})
