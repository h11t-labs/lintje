/** The stepper in a browser: the row that stands up when it no longer fits its container. */
import { afterEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import './stepper'
import type { LintjeStepper, Step } from './stepper'

const STEPS: Step[] = [
  { label: 'Gegevens', state: 'done', href: '#gegevens' },
  { label: 'Adres', state: 'done', href: '#adres' },
  { label: 'Inkomen', state: 'current', description: 'Uw inkomen van dit jaar.' },
  { label: 'Bijlagen', state: 'next' },
  { label: 'Versturen', state: 'next' },
]

async function mount(width: string, orientation: 'horizontal' | 'vertical' = 'horizontal') {
  const element = Object.assign(document.createElement('lintje-stepper'), {
    steps: STEPS,
    orientation,
    label: 'Stappen van de aanvraag',
  })
  element.style.width = width
  document.body.append(element)
  await element.updateComplete
  return element
}

const layout = (element: LintjeStepper): string => {
  const root = element.shadowRoot!
  if (root.querySelector('.lintje-stepper--phone')) return 'phone'
  return root.querySelector('.lintje-stepper__list--column') ? 'column' : 'row'
}
const description = (element: LintjeStepper): Element | null =>
  element.shadowRoot!.querySelector('.lintje-stepper__description')

// WebKit keeps the media queries of a sheet that no connected element adopts as they were, so
// every resize happens with the element in place.
afterEach(async () => {
  await page.viewport(1440, 900)
  await expect.poll(() => window.innerWidth).toBe(1440)
  document.body.replaceChildren()
})

describe('lintje-stepper between row and column', () => {
  it('stands the steps up when the row no longer fits, and lays them down again', async () => {
    const element = await mount('1200px')
    await expect.poll(() => layout(element)).toBe('row')
    expect(description(element)).toBeNull()

    element.style.width = '480px'
    await expect.poll(() => layout(element)).toBe('column')
    expect(description(element)?.textContent).toBe('Uw inkomen van dit jaar.')
    const list = element.shadowRoot!.querySelector<HTMLElement>('.lintje-stepper__list')!
    expect(list.scrollWidth).toBe(list.clientWidth)

    element.style.width = '1200px'
    await expect.poll(() => layout(element)).toBe('row')
  })

  it('never cuts off a step in the row', async () => {
    const element = await mount('1200px')
    const seen = new Set<string>()
    for (const width of [1000, 900, 800, 700, 600]) {
      element.style.width = `${width}px`
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
      await element.updateComplete
      const list = element.shadowRoot!.querySelector<HTMLElement>('.lintje-stepper__list')!
      seen.add(layout(element))
      if (layout(element) === 'row') expect(list.scrollWidth).toBe(list.clientWidth)
    }
    expect([...seen].sort()).toEqual(['column', 'row'])
  })

  it('keeps a vertical stepper in a column on a phone', async () => {
    const element = await mount('', 'vertical')
    await page.viewport(390, 844)
    await expect.poll(() => window.innerWidth).toBe(390)
    await element.updateComplete
    expect(layout(element)).toBe('column')
    expect(description(element)).not.toBeNull()
  })
})
