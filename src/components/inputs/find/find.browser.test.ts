/** The find field in a browser: what appears while typing stays inside one box of fixed size. */
import { afterEach, describe, expect, it } from 'vitest'
import './find'
import type { LintjeFind } from './find'

async function mount(props: Partial<LintjeFind> = {}): Promise<LintjeFind> {
  const element = Object.assign(document.createElement('lintje-find'), props)
  document.body.append(element)
  await element.updateComplete
  return element
}

const box = (element: LintjeFind): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>('.lintje-find')!

afterEach(() => {
  document.body.replaceChildren()
})

describe('lintje-find keeps its size', () => {
  it('grows neither wider nor higher when the count and the buttons appear', async () => {
    const element = await mount()
    const before = element.getBoundingClientRect()
    element.value = 'handmatige controle'
    element.total = 1248
    element.current = 128
    await element.updateComplete
    const after = element.getBoundingClientRect()
    expect(after.width).toBe(before.width)
    expect(after.height).toBe(before.height)
    const field = box(element).getBoundingClientRect()
    for (const part of element.shadowRoot!.querySelectorAll('.lintje-find__count, button')) {
      const rect = part.getBoundingClientRect()
      expect(rect.left).toBeGreaterThanOrEqual(field.left)
      expect(rect.right).toBeLessThanOrEqual(field.right)
    }
  })

  it('draws the focus ring round the whole box, not round the input', async () => {
    const element = await mount({ value: 'aanvraag', total: 7, current: 2 })
    const input = element.shadowRoot!.querySelector<HTMLInputElement>('input')!
    input.focus()
    expect(getComputedStyle(box(element)).outlineStyle).toBe('solid')
    expect(getComputedStyle(input).outlineStyle).toBe('none')
  })

  it('keeps the focus on a step button that loses its hits', async () => {
    const element = await mount({ value: 'aanvraag', total: 7, current: 2 })
    const next = element.shadowRoot!.querySelector<HTMLButtonElement>('.lintje-find__button--next')!
    next.focus()
    element.total = 0
    await element.updateComplete
    expect(element.shadowRoot!.activeElement).toBe(next)
    expect(next.getAttribute('aria-disabled')).toBe('true')
  })
})
