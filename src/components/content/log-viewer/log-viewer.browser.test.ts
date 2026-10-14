/** The log viewer in a browser: its filter row fits the tile's width, not the screen's. */
import { afterEach, describe, expect, it } from 'vitest'
import './log-viewer'
import type { LintjeLogViewer } from './log-viewer'

async function mount(width: number, raw = false): Promise<LintjeLogViewer> {
  const box = document.body.appendChild(document.createElement('div'))
  box.style.width = `${width}px`
  const element = box.appendChild(document.createElement('lintje-log-viewer'))
  element.data = {
    title: 'Importlog',
    entries: raw
      ? [{ id: 'a', line: 1, message: '$ export' }]
      : [{ id: 'a', time: '14:03:21.004', level: 'info', message: 'Start import' }],
    counts: { all: 1204, error: 3, warning: 12, info: 846, debug: 343 },
  }
  await element.updateComplete
  return element
}

const part = (element: LintjeLogViewer, selector: string): HTMLElement | null =>
  element.shadowRoot!.querySelector<HTMLElement>(selector)
const top = (element: HTMLElement | null): number =>
  Math.round(element!.getBoundingClientRect().top)
const tools = (element: LintjeLogViewer): number =>
  element.shadowRoot!.querySelectorAll('.lintje-log-viewer__tools lintje-menu-button').length

afterEach(() => {
  document.body.replaceChildren()
})

describe('lintje-log-viewer fits its filter row', () => {
  it('keeps the segments, the search and three tools on one line where they fit', async () => {
    const element = await mount(1300)
    await expect.poll(() => part(element, 'lintje-segmented')).not.toBeNull()
    expect(top(part(element, 'lintje-find'))).toBe(top(part(element, '.lintje-log-viewer__tools')))
    expect(tools(element)).toBe(3)
  })

  it('folds the level into a select before anything wraps', async () => {
    const element = await mount(900)
    await expect.poll(() => part(element, 'lintje-select')).not.toBeNull()
    expect(part(element, 'lintje-segmented')).toBeNull()
    const line = top(part(element, 'lintje-select'))
    expect(top(part(element, 'lintje-find'))).toBe(line)
    expect(top(part(element, '.lintje-log-viewer__tools'))).toBe(line)
    expect(tools(element)).toBe(3)
    // The select keeps its own width: the room left over stays between it and the search.
    const select = part(element, 'lintje-select')!.getBoundingClientRect()
    expect(select.right).toBeLessThan(
      part(element, 'lintje-find')!.getBoundingClientRect().left - 12,
    )
  })

  it('stacks the search over the level and one menu where even that does not fit', async () => {
    const element = await mount(500)
    await expect.poll(() => tools(element)).toBe(1)
    const find = part(element, 'lintje-find')!.getBoundingClientRect()
    const select = part(element, 'lintje-select')!.getBoundingClientRect()
    expect(select.top).toBeGreaterThanOrEqual(find.bottom - 1)
  })

  it('turns back to segments when the tile grows', async () => {
    const element = await mount(500)
    await expect.poll(() => tools(element)).toBe(1)
    element.parentElement!.style.width = '1300px'
    await expect.poll(() => part(element, 'lintje-segmented')).not.toBeNull()
    expect(tools(element)).toBe(3)
  })

  it('puts the search and the one menu on a line in plain output', async () => {
    const element = await mount(500, true)
    await expect.poll(() => tools(element)).toBe(1)
    expect(top(part(element, 'lintje-find'))).toBe(top(part(element, '.lintje-log-viewer__tools')))
  })
})
