/** The textarea's own growth, for an engine without `field-sizing`; forced, as Chromium and WebKit both have it. */
import { css } from 'lit'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { LintjeTextarea } from './textarea'

// The module reads `CSS.supports` once, so it is told "no" before it loads; this file runs in
// its own frame, apart from `textarea.browser.test.ts`.
beforeAll(async () => {
  const supports = CSS.supports.bind(CSS) as (...args: string[]) => boolean
  CSS.supports = ((...args: string[]) =>
    args[0].startsWith('field-sizing') ? false : supports(...args)) as typeof CSS.supports
  await import('./textarea')
  // The stylesheet still asks for `field-sizing`, and the engine would honour it.
  const element = customElements.get('lintje-textarea') as typeof LintjeTextarea
  element.elementStyles.push(css`
    .lintje-textarea__control {
      field-sizing: fixed;
    }
  `)
})

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

const height = (element: LintjeTextarea): number => control(element).getBoundingClientRect().height

async function heightWith(element: LintjeTextarea, lines: number): Promise<number> {
  element.value = text(lines)
  await element.updateComplete
  return height(element)
}

const lineHeight = (element: LintjeTextarea): number =>
  parseFloat(getComputedStyle(control(element)).lineHeight)

afterEach(() => {
  document.body.replaceChildren()
})

describe('lintje-textarea without `field-sizing`', () => {
  it('sets the height itself, as the box the engine draws', async () => {
    const element = await mount()
    const area = control(element)
    expect(getComputedStyle(area).getPropertyValue('field-sizing')).toBe('fixed')
    await heightWith(element, 8)
    expect(area.style.height).toMatch(/px$/)
    expect(parseFloat(area.style.height)).toBeCloseTo(height(element), 0)
  })

  it('shows three lines at least and grows a line at a time', async () => {
    const element = await mount()
    const empty = await heightWith(element, 0)
    expect(await heightWith(element, 2)).toBeCloseTo(empty, 0)
    expect(await heightWith(element, 5)).toBeCloseTo(empty + 2 * lineHeight(element), 0)
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
    const empty = await heightWith(element, 0)
    expect(await heightWith(element, 6)).toBeCloseTo(empty, 0)
    expect(await heightWith(element, 7)).toBeCloseTo(empty + lineHeight(element), 0)
  })

  it('fits a text it is given before it is drawn', async () => {
    const empty = height(await mount())
    const element = await mount({ value: text(6) })
    expect(height(element)).toBeCloseTo(empty + 3 * lineHeight(element), 0)
  })
})
