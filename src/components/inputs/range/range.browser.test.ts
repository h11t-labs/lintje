/**
 * The two handles in a real layout: how big a handle is to the pointer, and that a press on the
 * track lands on the element, since the inputs let it through.
 */
import { afterEach, describe, expect, it } from 'vitest'
import './range'
import type { LintjeRange } from './range'

async function mountPair(): Promise<LintjeRange> {
  const element = document.createElement('lintje-range')
  Object.assign(element, { label: 'Openingstijd', steps: [6, 8, 10, 12, 14, 16], from: 1, to: 4 })
  element.style.width = '500px'
  document.body.append(element)
  await element.updateComplete
  await element.updateComplete
  return element
}

const handles = (element: LintjeRange): HTMLInputElement[] => [
  ...element.renderRoot.querySelectorAll<HTMLInputElement>('.lintje-range__input'),
]

afterEach(() => {
  document.body.replaceChildren()
})

describe('lintje-range with two handles', () => {
  it('gives a handle a 24 px target and draws it 20 px', async () => {
    const element = await mountPair()
    const [lower] = handles(element)
    const box = lower.getBoundingClientRect()
    expect(box.height).toBe(24)
    // The lower handle stands at a fifth of the way its 24 px thumb can travel.
    const centre = box.left + 0.2 * (box.width - 24) + 12
    const y = box.top + box.height / 2
    const at = (dx: number): Element | null => element.shadowRoot!.elementFromPoint(centre + dx, y)
    expect(at(-11)).toBe(lower)
    expect(at(11)).toBe(lower)
    expect(at(14)).not.toBe(lower)
  })

  it('takes a press on the track itself, beside the handles', async () => {
    const element = await mountPair()
    const box = element.renderRoot.querySelector('.lintje-range')!.getBoundingClientRect()
    const hit = element.shadowRoot!.elementFromPoint(box.left + 2, box.top + box.height / 2)
    expect(hit?.closest('.lintje-range')).not.toBeNull()
    expect(hit).not.toBeInstanceOf(HTMLInputElement)
  })
})
