/** The split pane in a browser: the split dragged within its bounds, and one panel at a time on a phone. */
import { afterEach, describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import './split-pane'
import type { LintjeSplitPane } from './split-pane'

async function mount(): Promise<LintjeSplitPane> {
  const element = Object.assign(document.createElement('lintje-split-pane'), {
    startLabel: 'Lijst',
    endLabel: 'Details',
  })
  element.innerHTML = '<p slot="start">Aanvragen</p><p slot="end">Aanvraag 12</p>'
  element.style.width = '800px'
  document.body.append(element)
  await element.updateComplete
  return element
}

const part = (element: LintjeSplitPane, selector: string): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>(selector)!
const block = (element: LintjeSplitPane): HTMLElement => part(element, '.lintje-split-pane')
const strip = (element: LintjeSplitPane): HTMLElement => part(element, '.lintje-split-pane__strip')
const start = (element: LintjeSplitPane): HTMLElement =>
  part(element, '.lintje-split-pane__pane--start')
const end = (element: LintjeSplitPane): HTMLElement =>
  part(element, '.lintje-split-pane__pane--end')

function collect(element: LintjeSplitPane, name: string): unknown[] {
  const details: unknown[] = []
  element.addEventListener(name, (event) => details.push((event as CustomEvent).detail))
  return details
}

async function dragTo(element: LintjeSplitPane, x: number): Promise<void> {
  const box = block(element)
  await userEvent.dragAndDrop(strip(element), box, {
    targetPosition: { x, y: box.offsetHeight / 2 },
  })
  await element.updateComplete
}

// WebKit keeps the media queries of a sheet that no connected element adopts as they were, so
// the viewport is reset with the element in place.
afterEach(async () => {
  await page.viewport(1440, 900)
  await expect.poll(() => window.innerWidth).toBe(1440)
  document.body.replaceChildren()
})

describe('lintje-split-pane dragged', () => {
  it('moves the split to where the strip is let go, and tells it once', async () => {
    const element = await mount()
    const changes = collect(element, 'lintje-split-change')
    const width = block(element).offsetWidth
    await dragTo(element, width * 0.3)
    expect(element.value).toBe(30)
    expect(changes).toEqual([30])
    expect(part(element, '[role="separator"]').getAttribute('aria-valuenow')).toBe('30')
    expect(block(element).classList.contains('is-dragging')).toBe(false)
    // The strip is 9 px; the first panel takes its share of the rest. Reduced motion still
    // eases every property for 80 ms (`tokens/base.css`), so the width is polled.
    await expect
      .poll(() => start(element).getBoundingClientRect().width)
      .toBeCloseTo((width - 2 - 9) * 0.3, 0)
  })

  it('stops at min and max', async () => {
    const element = await mount()
    Object.assign(element, { min: 25, max: 70 })
    await element.updateComplete
    const width = block(element).offsetWidth
    await dragTo(element, 4)
    expect(element.value).toBe(25)
    await dragTo(element, width - 4)
    expect(element.value).toBe(70)
  })
})

describe('lintje-split-pane on a phone', () => {
  it('shows the panel its switch chooses', async () => {
    const element = await mount()
    element.style.width = ''
    await page.viewport(390, 844)
    await expect.poll(() => window.innerWidth).toBe(390)
    await expect.poll(() => end(element).offsetWidth).toBe(0)
    expect(start(element).offsetWidth).toBeGreaterThan(0)
    element.pane = 'end'
    await element.updateComplete
    expect(start(element).offsetWidth).toBe(0)
    expect(end(element).offsetWidth).toBeGreaterThan(0)
  })
})
