/**
 * The split pane in a browser: the split dragged within its bounds, by a finger beside the strip,
 * and one panel at a time on a phone.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cdp, page, server, userEvent } from 'vitest/browser'
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

/** The point `offset` px right of the strip's middle, halfway down. */
function beside(element: LintjeSplitPane, offset: number): { x: number; y: number } {
  const box = strip(element).getBoundingClientRect()
  return { x: box.left + box.width / 2 + offset, y: box.top + box.height / 2 }
}

/** Whether a press `offset` px right of the strip's middle lands on the strip or its grip. */
const hits = (element: LintjeSplitPane, offset: number): boolean => {
  const { x, y } = beside(element, offset)
  const target = element.shadowRoot!.elementFromPoint(x, y)
  return target !== null && strip(element).contains(target)
}

describe('lintje-split-pane with a mouse', () => {
  it('is hit on its 9 px only', async () => {
    const element = await mount()
    expect(matchMedia('(pointer: coarse)').matches).toBe(false)
    expect(strip(element).getBoundingClientRect().width).toBe(9)
    expect(hits(element, 3)).toBe(true)
    expect(hits(element, -3)).toBe(true)
    expect(hits(element, 6)).toBe(false)
    expect(hits(element, -6)).toBe(false)
  })
})

// Playwright drives no touch in WebKit; Chromium takes it through the DevTools protocol.
describe.skipIf(server.browser !== 'chromium')('lintje-split-pane with a finger', () => {
  async function touch(
    type: 'touchStart' | 'touchMove' | 'touchEnd',
    x: number,
    y: number,
  ): Promise<void> {
    // The test runs in a scaled frame; the protocol speaks in the page's coordinates.
    const frame = window.frameElement!.getBoundingClientRect()
    const scale = frame.width / window.innerWidth
    const touchPoints =
      type === 'touchEnd' ? [] : [{ x: frame.left + x * scale, y: frame.top + y * scale }]
    await cdp().send('Input.dispatchTouchEvent', { type, touchPoints })
  }

  // Touch emulation is page-wide and, switched off, leaves headless Chromium on Linux without
  // hover for the files after this one; the finger's rule is switched on in this frame instead.
  const FINGER = '(pointer: coarse)'
  let fingerRule: CSSMediaRule | undefined

  function coarse(element: LintjeSplitPane): void {
    fingerRule = element
      .shadowRoot!.adoptedStyleSheets.flatMap((sheet) => [...sheet.cssRules])
      .find(
        (rule): rule is CSSMediaRule =>
          rule instanceof CSSMediaRule && rule.conditionText === FINGER,
      )
    expect(fingerRule).toBeDefined()
    fingerRule!.media.mediaText = 'all'
  }

  afterEach(() => {
    if (fingerRule) fingerRule.media.mediaText = FINGER
    fingerRule = undefined
  })

  it('is hit 12 px either side of its middle', async () => {
    const element = await mount()
    coarse(element)
    expect(strip(element).getBoundingClientRect().width).toBe(9)
    expect(Number.parseFloat(getComputedStyle(strip(element), '::after').width)).toBe(24)
    expect(hits(element, 11)).toBe(true)
    expect(hits(element, -11)).toBe(true)
    expect(hits(element, 13)).toBe(false)
    expect(hits(element, -13)).toBe(false)
  })

  // Chromium's touch adjustment also moves a press this close onto the focusable grip; the hit
  // area is what the test above measures.
  it('moves the split when touched 10 px beside the strip', async () => {
    const element = await mount()
    coarse(element)
    const changes = collect(element, 'lintje-split-change')
    const kinds: string[] = []
    strip(element).addEventListener('pointerdown', (event) => kinds.push(event.pointerType))
    const width = block(element).offsetWidth
    const left = block(element).getBoundingClientRect().left
    const { x, y } = beside(element, 10)
    const to = left + width * 0.3
    for (const [type, at] of [
      ['touchStart', x],
      ['touchMove', x - 20],
      ['touchMove', (x + to) / 2],
      ['touchMove', to],
      ['touchEnd', to],
    ] as const) {
      await touch(type, at, y)
    }
    await element.updateComplete
    expect(kinds).toEqual(['touch'])
    expect(element.value).toBe(30)
    expect(changes).toEqual([30])
    expect(block(element).classList.contains('is-dragging')).toBe(false)
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
