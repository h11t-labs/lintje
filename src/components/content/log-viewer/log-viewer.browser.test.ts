/**
 * The log viewer in a browser: its filter row fits the tile's width, not the screen's,
 * following, "Naar nieuwste" and a step to a hit scroll its log, never the page, and the
 * expanded log has the keys of the tile.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { SHIFT_TAB, TAB } from '../../../core/test-keys'
import './log-viewer'
import type { LintjeLogViewer } from './log-viewer'
import type { LintjeFind } from '../../inputs/find/find'
import type { LogEntry, LogViewerData } from '../../../types'

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

const lines = (from: number, count: number, hits: number[] = []): LogEntry[] =>
  Array.from({ length: count }, (_, index) => {
    const n = from + index
    return {
      id: `r${n}`,
      time: `14:03:${String(n % 60).padStart(2, '0')}.000`,
      level: 'info',
      source: 'import',
      message: hits.includes(n) ? `Batch ${n}: timeout na 3000 ms` : `Batch ${n} gelezen`,
    }
  })

/** A viewer between two tall blocks, so the page itself can scroll, and stands scrolled to it. */
async function onPage(data: Partial<LogViewerData>): Promise<LintjeLogViewer> {
  const block = (): HTMLElement => {
    const div = document.createElement('div')
    div.style.height = '1500px'
    return div
  }
  document.body.append(block())
  const element = document.body.appendChild(document.createElement('lintje-log-viewer'))
  element.style.display = 'block'
  element.style.width = '1300px'
  document.body.append(block())
  element.data = { title: 'Importlog', live: true, entries: lines(1, 60), ...data }
  await element.updateComplete
  window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 40)
  return element
}

const logOf = (element: LintjeLogViewer): HTMLElement => part(element, '.lintje-log-viewer__log')!
const beyond = (log: HTMLElement): number => log.scrollHeight - log.scrollTop - log.clientHeight
const foot = (element: LintjeLogViewer): string =>
  part(element, '.lintje-log-viewer__foot')?.textContent?.replace(/\s+/g, ' ') ?? ''

describe('lintje-log-viewer follows in its own log', () => {
  it('stands still when scrolled up, and goes to the newest without moving the page', async () => {
    const element = await onPage({})
    const log = logOf(element)
    await expect.poll(() => beyond(log)).toBeLessThanOrEqual(8)
    const page = window.scrollY
    expect(page).toBeGreaterThan(0)

    log.scrollTop = 0
    await expect.poll(() => foot(element)).toContain('Staat stil')
    element.data = { ...element.data!, entries: lines(1, 65) }
    await element.updateComplete
    await expect.poll(() => foot(element)).toContain('5 nieuwe regels onder')
    expect(log.scrollTop).toBe(0)
    expect(window.scrollY).toBe(page)

    part(element, '.lintje-log-viewer__latest lintje-button')!.click()
    await expect.poll(() => beyond(log)).toBeLessThanOrEqual(8)
    await expect.poll(() => foot(element)).toContain('Volgt de nieuwste regel')
    expect(window.scrollY).toBe(page)
  })

  it('brings a hit into the log with a step, and leaves the page where it was', async () => {
    const element = await onPage({ entries: lines(1, 60, [3, 55]), filter: { search: 'timeout' } })
    const log = logOf(element)
    const current = (): HTMLElement | null =>
      element.shadowRoot!.querySelector<HTMLElement>('lintje-highlight[current]')
    const inLog = (): boolean => {
      const box = log.getBoundingClientRect()
      const at = current()!.getBoundingClientRect()
      return at.top >= box.top && at.bottom <= box.bottom
    }
    await expect.poll(inLog).toBe(true)
    const page = window.scrollY
    const before = log.scrollTop

    part(element, 'lintje-find')!.dispatchEvent(new CustomEvent('lintje-find-step', { detail: 1 }))
    await expect.poll(() => current()?.closest('[data-id]')?.getAttribute('data-id')).toBe('r55')
    await expect.poll(inLog).toBe(true)
    expect(log.scrollTop).toBeGreaterThan(before)
    expect(window.scrollY).toBe(page)
    expect((part(element, 'lintje-find') as LintjeFind).current).toBe(2)
  })
})

describe('lintje-log-viewer in its modal', () => {
  const longMessage = Array.from({ length: 8 }, (_, n) => `Stap ${n + 1}`).join('\n')

  async function expanded(): Promise<LintjeLogViewer> {
    const element = document.body.appendChild(document.createElement('lintje-log-viewer'))
    element.style.display = 'block'
    element.style.width = '900px'
    element.data = {
      title: 'Importlog',
      expandable: true,
      entries: [
        ...lines(1, 3),
        {
          id: 'last',
          time: '14:03:27.000',
          level: 'error',
          message: longMessage,
          details: '{ "batch": 4 }',
        },
      ],
    }
    await element.updateComplete
    const tile = part(element, 'lintje-tile')!
    await expect
      .poll(() => tile.shadowRoot?.querySelector('lintje-icon-button[label="Vergroot"]'))
      .toBeTruthy()
    tile.shadowRoot!.querySelector<HTMLElement>('lintje-icon-button[label="Vergroot"]')!.click()
    await expect.poll(() => part(element, '.lintje-log-viewer__log--expanded')).not.toBeNull()
    return element
  }

  const modalRows = (element: LintjeLogViewer): HTMLElement[] => [
    ...part(element, '.lintje-log-viewer__log--expanded')!.querySelectorAll<HTMLElement>(
      '.lintje-log-viewer__row',
    ),
  ]
  const focused = (element: LintjeLogViewer): Element | null => element.shadowRoot!.activeElement

  it('reaches the active line and its buttons with Tab, walks with the arrows, opens with Enter', async () => {
    const element = await expanded()
    const last = modalRows(element).at(-1)!
    expect(last.getAttribute('role')).toBe('row')
    expect(last.getAttribute('aria-selected')).toBe('false')
    expect(last.closest('[role="grid"]')?.getAttribute('aria-label')).toBe('Importlog')

    // From the dialog, Tab comes to the newest line, the one tab stop of the rows.
    for (let n = 0; n < 8 && focused(element) !== last; n++) await userEvent.keyboard(TAB)
    expect(focused(element)).toBe(last)
    await userEvent.keyboard(TAB)
    const open = last.querySelector<HTMLElement>('.lintje-log-viewer__open')!
    expect(focused(element)).toBe(open)
    await userEvent.keyboard(TAB)
    expect(focused(element)).toBe(last.querySelector('.lintje-log-viewer__more'))

    await userEvent.keyboard(SHIFT_TAB)
    expect(focused(element)).toBe(open)
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => last.querySelector('lintje-code')).not.toBeNull()

    await userEvent.keyboard(SHIFT_TAB)
    expect(focused(element)).toBe(last)
    await userEvent.keyboard('{ArrowUp}')
    await expect.poll(() => focused(element)).toBe(modalRows(element).at(-2))
    expect(modalRows(element).at(-2)!.tabIndex).toBe(0)
    expect(last.tabIndex).toBe(-1)
  })

  it('says the chosen line in a region of its own', async () => {
    const element = await expanded()
    element.addEventListener('lintje-log-select', (event) => {
      element.data = { ...element.data!, selected: (event as CustomEvent<string | null>).detail }
    })
    const last = modalRows(element).at(-1)!
    for (let n = 0; n < 8 && focused(element) !== last; n++) await userEvent.keyboard(TAB)
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => last.getAttribute('aria-selected')).toBe('true')
    const region = part(element, 'lintje-modal [role="status"]')!
    await expect.poll(() => region.textContent?.trim()).toBe('Regel van 14:03:27.000 gekozen')
  })
})
