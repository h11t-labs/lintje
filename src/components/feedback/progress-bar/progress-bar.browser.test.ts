/** The bar without a label keeps one height: a glyph for done, error or paused moves no row. */
import { afterEach, expect, it } from 'vitest'
import './progress-bar'

afterEach(() => document.body.replaceChildren())

it('has the same height in every state without a label', async () => {
  const heights: number[] = []
  for (const props of [
    { value: 40 },
    { value: 100 },
    { value: 40, state: 'error' },
    { value: 40, state: 'paused' },
  ]) {
    const element = Object.assign(document.createElement('lintje-progress-bar'), {
      label: 'Uploaden',
      hideLabel: true,
      ...props,
    })
    document.body.append(element)
    await element.updateComplete
    heights.push(element.getBoundingClientRect().height)
  }
  expect(new Set(heights).size).toBe(1)
})
