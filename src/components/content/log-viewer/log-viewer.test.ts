import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import './log-viewer'
import type { LintjeLogViewer } from './log-viewer'
import type { LintjeFind } from '../../inputs/find/find'
import type { LogEntry, LogViewerData } from '../../../types'

const line = (n: number, extra: Partial<LogEntry> = {}): LogEntry => ({
  id: `r${n}`,
  at: `2026-10-12T14:03:${String(20 + n).padStart(2, '0')}.000`,
  time: `14:03:${String(20 + n).padStart(2, '0')}.000`,
  level: 'info',
  source: 'import',
  message: `Batch ${n} gelezen`,
  ...extra,
})

const LINES = [
  line(1),
  line(2, { level: 'error', message: 'Timeout na 3000 ms' }),
  line(3, { level: 'warning', message: 'Postcode ontbreekt' }),
  line(4, { message: 'Nieuwe poging na timeout' }),
]

async function mount(data: Partial<LogViewerData> = {}): Promise<LintjeLogViewer> {
  const element = document.createElement('lintje-log-viewer')
  element.data = { title: 'Importlog', live: true, entries: LINES, ...data }
  document.body.append(element)
  await element.updateComplete
  return element
}

const root = (element: LintjeLogViewer): ShadowRoot => element.shadowRoot!
const rows = (element: LintjeLogViewer): HTMLElement[] => [
  ...root(element).querySelectorAll<HTMLElement>('.lintje-log-viewer__row'),
]
const log = (element: LintjeLogViewer): HTMLElement =>
  root(element).querySelector<HTMLElement>('.lintje-log-viewer__log')!
const foot = (element: LintjeLogViewer): string =>
  root(element)
    .querySelector('.lintje-log-viewer__foot')
    ?.textContent?.replace(/\s+/g, ' ')
    .trim() ?? ''
const find = (element: LintjeLogViewer): LintjeFind =>
  root(element).querySelector<LintjeFind>('lintje-find')!

function listen(element: LintjeLogViewer, name: string): unknown[] {
  const seen: unknown[] = []
  element.addEventListener(name, (event) => seen.push((event as CustomEvent).detail))
  return seen
}

/** happy-dom lays nothing out: the log gets a height and a scroll position of its own. */
function scrollable(element: LintjeLogViewer, height = 1000, view = 400): HTMLElement {
  const box = log(element)
  Object.defineProperty(box, 'scrollHeight', { configurable: true, get: () => height })
  Object.defineProperty(box, 'clientHeight', { configurable: true, get: () => view })
  return box
}

function scrollTo(box: HTMLElement, top: number): void {
  box.scrollTop = top
  box.dispatchEvent(new Event('scroll'))
}

const status = (element: LintjeLogViewer): string =>
  root(element).querySelector('[role="status"]')?.textContent?.trim() ?? ''

/** Two frames: the status region is emptied, then filled a frame later. */
async function spoken(element: LintjeLogViewer): Promise<string> {
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
  await element.updateComplete
  return status(element)
}

async function add(element: LintjeLogViewer, ...lines: LogEntry[]): Promise<void> {
  element.data = { ...element.data!, entries: [...element.data!.entries, ...lines] }
  await element.updateComplete
}

beforeEach(() => {
  document.body.innerHTML = ''
})

afterEach(() => {
  vi.useRealTimers()
})

describe('lintje-log-viewer lines', () => {
  it('draws the lines oldest first, and keeps a drawn line when new ones arrive', async () => {
    const element = await mount()
    const first = rows(element)[0]
    await add(element, line(5))
    expect(rows(element).map((row) => row.dataset.id)).toEqual(['r1', 'r2', 'r3', 'r4', 'r5'])
    expect(rows(element)[0]).toBe(first)
  })

  it('gives a line its level as a word, and a line without one no badge', async () => {
    const element = await mount({
      entries: [line(1, { level: 'error' }), line(2, { level: undefined })],
    })
    const [error, bare] = rows(element)
    expect(error!.querySelector('.lintje-badge')?.textContent).toContain('Fout')
    expect(error!.classList.contains('lintje-log-viewer__row--error')).toBe(true)
    expect(bare!.querySelector('.lintje-badge')).toBeNull()
  })

  it('draws plain output with line numbers when no line has a time, level or source', async () => {
    const element = await mount({
      entries: [
        { id: 'a', line: 1241, message: '$ export-rapportage' },
        { id: 'b', line: 1242, message: '\u001b[32mok\u001b[0m' },
      ],
    })
    expect(root(element).querySelector('lintje-segmented')).toBeNull()
    expect(rows(element)[0]!.querySelector('.lintje-log-viewer__number')?.textContent).toBe('1241')
    expect(rows(element)[1]!.textContent).toContain('ok')
    expect(rows(element)[1]!.textContent).not.toContain('\u001b')
  })

  it('folds a long message to four lines and opens it on request', async () => {
    const trace = ['Fout', 'a', 'b', 'c', 'd', 'e', 'f'].join('\n')
    const element = await mount({ entries: [line(1, { message: trace })] })
    const more = rows(element)[0]!.querySelector<HTMLButtonElement>('.lintje-log-viewer__more')!
    expect(more.textContent?.trim()).toBe('3 regels meer')
    expect(rows(element)[0]!.querySelector('.lintje-log-viewer__body')?.textContent).toBe(
      'Fout\na\nb\nc',
    )
    more.click()
    await element.updateComplete
    expect(rows(element)[0]!.querySelector('.lintje-log-viewer__body')?.textContent).toBe(trace)
  })

  it('opens the details of a line under it', async () => {
    const element = await mount({ entries: [line(1, { details: '{ "poging": 1 }' })] })
    rows(element)[0]!.querySelector<HTMLButtonElement>('.lintje-log-viewer__open')!.click()
    await element.updateComplete
    expect(rows(element)[0]!.querySelector('lintje-code')).not.toBeNull()
  })
})

describe('lintje-log-viewer following', () => {
  it('stops after the reader scrolls up, counts what arrives, and follows again', async () => {
    const element = await mount()
    const box = scrollable(element)
    scrollTo(box, 600)
    scrollTo(box, 200)
    await element.updateComplete
    await add(element, line(5), line(6))
    expect(foot(element)).toContain('2 nieuwe regels onder')
    expect(root(element).querySelector('.lintje-log-viewer__divider')?.textContent).toContain(
      '2 nieuw',
    )
    root(element).querySelector<HTMLElement>('.lintje-log-viewer__latest lintje-button')!.click()
    await element.updateComplete
    expect(foot(element)).toContain('Volgt de nieuwste regel')
    expect(root(element).querySelector('.lintje-log-viewer__divider')).toBeNull()
  })

  it('follows again once the reader is back at the end', async () => {
    const element = await mount()
    const box = scrollable(element)
    scrollTo(box, 600)
    scrollTo(box, 100)
    await element.updateComplete
    expect(foot(element)).toContain('Staat stil')
    scrollTo(box, 600)
    await element.updateComplete
    expect(foot(element)).toContain('Volgt de nieuwste regel')
  })

  it('says no more lines come once the source stops', async () => {
    const element = await mount({ live: false })
    expect(foot(element)).toContain('Er komen geen regels meer bij')
  })

  it('reads out new lines at most once every five seconds, in one sentence', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const element = await mount()
    await add(element, line(5, { level: 'error' }))
    await add(element, line(6))
    vi.advanceTimersByTime(4999)
    expect(status(element)).toBe('')
    vi.advanceTimersByTime(1)
    expect(await spoken(element)).toBe('2 nieuwe regels, waarvan 1 fout')
  })

  it('says one new line twice when one line comes in twice in a row', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const element = await mount()
    for (const n of [5, 6]) {
      await add(element, line(n))
      vi.advanceTimersByTime(5000)
      await element.updateComplete
      expect(status(element)).toBe('')
      expect(await spoken(element)).toBe('1 nieuwe regel')
    }
  })
})

describe('lintje-log-viewer filter and find', () => {
  it('asks the host for a level', async () => {
    const element = await mount()
    const seen = listen(element, 'lintje-log-filter-change')
    root(element)
      .querySelector('lintje-segmented')!
      .dispatchEvent(new CustomEvent('lintje-change', { detail: 'error', bubbles: true }))
    expect(seen).toEqual([{ level: 'error', search: '', onlyHits: false }])
  })

  it('asks the host for a term and counts its hits in what it shows', async () => {
    const element = await mount({ filter: { search: 'timeout' } })
    const seen = listen(element, 'lintje-log-filter-change')
    expect(find(element).total).toBe(2)
    expect(find(element).current).toBe(1)
    find(element).dispatchEvent(
      new CustomEvent('lintje-change', { detail: 'batch', bubbles: true }),
    )
    expect(seen).toEqual([{ level: 'all', search: 'batch', onlyHits: false }])
  })

  it('moves the current hit with a step, and lets the step go no further', async () => {
    const element = await mount({ filter: { search: 'timeout' } })
    const steps = listen(element, 'lintje-find-step')
    find(element).dispatchEvent(
      new CustomEvent('lintje-find-step', { detail: 1, bubbles: true, composed: true }),
    )
    await element.updateComplete
    expect(find(element).current).toBe(2)
    expect(steps).toEqual([])
    const current = root(element).querySelector('lintje-highlight[current]')
    expect(current?.closest('.lintje-log-viewer__row')?.getAttribute('data-id')).toBe('r4')
  })

  it('opens a folded message whose hidden part holds the current hit', async () => {
    const trace = ['Fout', 'a', 'b', 'c', 'd', 'e', 'timeout'].join('\n')
    const element = await mount({
      entries: [line(1, { message: trace })],
      filter: { search: 'timeout' },
    })
    expect(rows(element)[0]!.querySelector('lintje-highlight[current]')).not.toBeNull()
    expect(rows(element)[0]!.querySelector('.lintje-log-viewer__more')).toBeNull()
  })

  it('says a filter leaves no lines, and offers to clear it', async () => {
    const element = await mount({ entries: [], live: false, filter: { level: 'debug' } })
    const seen = listen(element, 'lintje-log-filter-change')
    expect(root(element).textContent).toContain('Geen regels voor dit filter')
    const clear = [...root(element).querySelectorAll<HTMLElement>('lintje-button')].find((b) =>
      b.textContent?.includes('Filter wissen'),
    )!
    clear.click()
    expect(seen).toEqual([{ level: 'all', search: '', onlyHits: false }])
  })

  it('reads out how many lines a level leaves, once the host answers', async () => {
    const element = await mount()
    element.addEventListener('lintje-log-filter-change', () => {
      element.data = { ...element.data!, filter: { level: 'error' }, entries: [LINES[1]!] }
    })
    root(element)
      .querySelector('lintje-segmented')!
      .dispatchEvent(new CustomEvent('lintje-change', { detail: 'error', bubbles: true }))
    expect(await spoken(element)).toBe('1 regel')
  })
})

describe('lintje-log-viewer menus', () => {
  const menus = (element: LintjeLogViewer): HTMLElement[] => [
    ...root(element).querySelectorAll<HTMLElement>('lintje-menu-button'),
  ]
  const choose = (menu: HTMLElement, value: string): void => {
    menu.dispatchEvent(
      new CustomEvent('lintje-action', { detail: value, bubbles: true, composed: true }),
    )
  }

  it('clears only its own view, and shows the lines again on request', async () => {
    const element = await mount()
    const actions = listen(element, 'lintje-log-action')
    choose(menus(element)[2]!, 'log:clear')
    await element.updateComplete
    expect(rows(element)).toEqual([])
    expect(root(element).textContent).toContain('4 regels verborgen')
    expect(actions).toEqual([])
    await add(element, line(5))
    expect(rows(element).map((row) => row.dataset.id)).toEqual(['r5'])
    const again = [...root(element).querySelectorAll<HTMLElement>('lintje-button')].find((b) =>
      b.textContent?.includes('Weer tonen'),
    )!
    again.click()
    await element.updateComplete
    expect(rows(element)).toHaveLength(5)
  })

  it('passes the host its own actions', async () => {
    const element = await mount({
      actions: [{ value: 'retry-import', label: 'Import opnieuw starten' }],
    })
    const actions = listen(element, 'lintje-log-action')
    let leaked = false
    element.addEventListener('lintje-action', () => (leaked = true))
    choose(menus(element)[2]!, 'retry-import')
    expect(actions).toEqual(['retry-import'])
    expect(leaked).toBe(false)
  })

  it('switches the view without asking the host, except for "alleen treffers"', async () => {
    const element = await mount({ filter: { search: 'timeout' } })
    const seen = listen(element, 'lintje-log-filter-change')
    choose(menus(element)[0]!, 'view:source')
    await element.updateComplete
    expect(root(element).querySelector('.lintje-log-viewer__source')).toBeNull()
    choose(menus(element)[0]!, 'view:only-hits')
    expect(seen).toEqual([{ level: 'all', search: 'timeout', onlyHits: true }])
  })
})

describe('lintje-log-viewer choosing a line', () => {
  const press = (target: HTMLElement, key: string): void => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }))
  }

  it('walks the lines with the arrow keys and chooses one with Enter', async () => {
    const element = await mount()
    const seen = listen(element, 'lintje-log-select')
    const last = rows(element).at(-1)!
    expect(last.tabIndex).toBe(0)
    press(last, 'ArrowUp')
    await element.updateComplete
    const third = rows(element)[2]!
    expect(third.tabIndex).toBe(0)
    press(third, 'Enter')
    expect(seen).toEqual(['r3'])
    press(third, 'Home')
    await element.updateComplete
    expect(rows(element)[0]!.tabIndex).toBe(0)
  })

  it('shows the chosen line in the bar, and lets it go', async () => {
    const element = await mount({ selected: 'r2' })
    const seen = listen(element, 'lintje-log-select')
    expect(rows(element)[1]!.classList.contains('is-selected')).toBe(true)
    expect(foot(element)).toContain('Regel van 14:03:22.000 gekozen')
    root(element).querySelector<HTMLElement>('.lintje-log-viewer__foot lintje-icon-button')!.click()
    expect(seen).toEqual([null])
  })
})
