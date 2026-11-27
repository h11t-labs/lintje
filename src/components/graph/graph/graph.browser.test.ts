/** The counter on a mark in a browser: its drawing is concentric with its target, in both house styles. */
import { afterEach, expect, it } from 'vitest'
import type { GraphData } from '../../../types'
import './graph'

type GraphElement = HTMLElement & { data: GraphData; updateComplete: Promise<unknown> }

afterEach(() => {
  document.body.replaceChildren()
  delete document.documentElement.dataset.styleVersion
})

async function smallCounter(style: 'classic' | 'new'): Promise<HTMLElement> {
  if (style === 'new') document.documentElement.dataset.styleVersion = 'new'
  const element = document.createElement('lintje-graph') as GraphElement
  element.data = {
    description: 'Drie personen.',
    types: [{ key: 'p', label: 'Persoon', icon: 'functioneel-persoon' }],
    nodes: [
      { id: 'a', label: 'Een', type: 'p', more: 3 },
      { id: 'b', label: 'Twee', type: 'p', more: 42 },
      { id: 'c', label: 'Drie', type: 'p', more: 128 },
    ],
    edges: [
      { from: 'a', to: 'b' },
      { from: 'a', to: 'c' },
    ],
  }
  document.body.append(element)
  await element.updateComplete
  const root = element.shadowRoot!
  const zoomOut = (): HTMLElement | null =>
    root.querySelector<HTMLElement>('.lintje-graph__zoom-button[aria-label="Uitzoomen"]')
  await expect.poll(() => zoomOut()).not.toBeNull()
  // Zoomed out, a card becomes a mark and its counter the small one.
  for (let step = 0; step < 12 && !root.querySelector('.lintje-graph__counter--small'); step++) {
    zoomOut()!.click()
    await new Promise((resolve) => setTimeout(resolve, 120))
  }
  const counter = root.querySelector<HTMLElement>('.lintje-graph__counter--small')
  expect(counter).not.toBeNull()
  return counter!
}

it('draws the small counter with the corner less its inset in the new style', async () => {
  const counter = await smallCounter('new')
  const outer = parseFloat(getComputedStyle(counter).borderTopLeftRadius)
  const drawing = getComputedStyle(counter, '::before')
  expect(outer).toBe(4)
  expect(parseFloat(drawing.borderTopLeftRadius)).toBe(outer - parseFloat(drawing.top))
})

it('keeps the small counter square in the classic style', async () => {
  const counter = await smallCounter('classic')
  expect(getComputedStyle(counter).borderTopLeftRadius).toBe('0px')
  expect(getComputedStyle(counter, '::before').borderTopLeftRadius).toBe('0px')
})
