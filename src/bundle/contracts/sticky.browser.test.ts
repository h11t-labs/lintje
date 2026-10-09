/** What sticks keeps the focus clear of itself (WCAG 2.4.11), each element at each width. */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { page, server, userEvent } from 'vitest/browser'
import { deepActiveElement, standsIn } from '../../core/focus'
import { SHIFT_TAB, TAB } from '../../core/test-keys'
import '../../components/chat/chat/chat'
import '../../components/tables/data-table/data-table'
import '../../components/forms/form-actions/form-actions'
import { tabbables } from '../../components/shared/focus-trap'
import '../../components/filters/filter-bar/filter-bar'
import '../../components/frame/shell/shell'
import type { ChatData, DataTableData, FilterBarData, ShellData } from '../../types'

interface Scene {
  /** The element that scrolls under it: the page's, or the box the host gave it. */
  scroller: HTMLElement
  /** What sticks, measured where it stands now. */
  cover: () => HTMLElement | null
  /** The bar it sticks under, if any. */
  above?: () => HTMLElement | null
  /** The control the keyboard reaches. */
  target: HTMLElement
  /** What the reader sees of the control, where its own box is the size of nothing. */
  box?: HTMLElement
  /** Takes the element off the page. */
  remove: () => void
}

interface Row {
  tag: string
  marker: string
  width: number
  height?: number
  side: 'top' | 'bottom'
  /** Keeps its height as scroll padding; else it scrolls the focus clear itself. */
  reserves: boolean
  mount: () => Promise<Scene>
}

/**
 * The checks that fail today, by `<tag> :: <marker> :: <check> @ <engine>`; each is a line in
 * `docs/OPEN_ISSUES.md`. A check that passes while it matches an entry fails, so the fix takes
 * its entry out.
 */
const KNOWN: RegExp[] = [
  // The phone's sentence does not stick: its sticky box stays inside the zone's host.
  /^lintje-filter-bar :: stuck under the (top|side) layout's bar at 390 px :: /,
  // WebKit scrolls a text field's text into view, not its border and padding.
  /^lintje-form-actions :: the action bar at \d+ px :: scrolls .* @ webkit$/,
]

const ENGINES = ['chromium', 'firefox', 'webkit']

/* Helpers ----------------------------------------------------------------- */

const frame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()))

async function settle(): Promise<void> {
  await frame()
  await frame()
}

async function viewport(width: number, height: number): Promise<void> {
  await page.viewport(width, height)
  // WebKit resizes the frame after `viewport()` resolves.
  await expect.poll(() => window.innerWidth).toBe(width)
  await settle()
}

/** Every match under a root, through each open shadow root. */
function all(root: ParentNode, selector: string, found: Element[] = []): Element[] {
  for (const element of root.querySelectorAll('*')) {
    if (element.matches(selector)) found.push(element)
    if (element.shadowRoot) all(element.shadowRoot, selector, found)
  }
  return found
}

/** Drawn and larger than the 1 px of a visually hidden text. */
function seen(element: Element): boolean {
  const box = element.getBoundingClientRect()
  return box.width > 1 && box.height > 1 && getComputedStyle(element).visibility !== 'hidden'
}

/** The first drawn match under the element, through its shadow roots. */
const find = (root: Element, selector: string): HTMLElement | null =>
  (all(root.shadowRoot ?? root, selector).find(seen) as HTMLElement | undefined) ?? null

/** The element on top at a point, through every shadow root. */
function hitAt(x: number, y: number): Element | null {
  let hit = document.elementFromPoint(x, y)
  while (hit?.shadowRoot) {
    const inner = hit.shadowRoot.elementFromPoint(x, y)
    if (!inner || inner === hit) break
    hit = inner
  }
  return hit
}

const overlap = (a: Element, b: Element): boolean => {
  const one = a.getBoundingClientRect()
  const two = b.getBoundingClientRect()
  return one.top < two.bottom - 1 && two.top < one.bottom - 1
}

const centre = (element: Element): number => {
  const box = element.getBoundingClientRect()
  return (box.top + box.bottom) / 2
}

/** The part of the scroller the reader sees, in viewport coordinates. */
function view(scroller: HTMLElement): { top: number; bottom: number } {
  if (scroller === document.documentElement) return { top: 0, bottom: scroller.clientHeight }
  const top = scroller.getBoundingClientRect().top + scroller.clientTop
  return { top, bottom: top + scroller.clientHeight }
}

function scrollBy(scroller: HTMLElement, top: number): void {
  const target = scroller === document.documentElement ? window : scroller
  target.scrollBy({ top, behavior: 'instant' })
}

const padding = (scroller: HTMLElement, side: Row['side']): number =>
  parseFloat(
    getComputedStyle(scroller)[side === 'top' ? 'scrollPaddingTop' : 'scrollPaddingBottom'],
  ) || 0

/** Scrolls until the control stands under what sticks, which then sticks. */
async function bury(scene: Scene): Promise<HTMLElement> {
  const box = scene.box ?? scene.target
  for (let round = 0; round < 5; round += 1) {
    const cover = scene.cover()
    if (cover && overlap(box, cover)) return cover
    // Into sight first: what sticks stays inside its own box, which may lie elsewhere.
    const sight = view(scene.scroller)
    const rect = box.getBoundingClientRect()
    const inSight = rect.top >= sight.top && rect.bottom <= sight.bottom
    scrollBy(
      scene.scroller,
      centre(box) - (cover && inSight ? centre(cover) : (sight.top + sight.bottom) / 2),
    )
    await settle()
  }
  const cover = scene.cover()
  expect(cover && overlap(box, cover), 'the control stands under what sticks').toBe(true)
  return cover!
}

/** Puts the element on the page, drawn. */
async function append<T extends HTMLElement>(element: T): Promise<T> {
  document.body.append(element)
  await (element as T & { updateComplete?: Promise<unknown> }).updateComplete
  await settle()
  return element
}

function create<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & Record<string, unknown> = {},
): HTMLElementTagNameMap[K] {
  return Object.assign(document.createElement(tag), props)
}

function spacer(height: number): HTMLElement {
  const block = document.createElement('div')
  block.style.height = `${height}px`
  return block
}

/* Sample data ------------------------------------------------------------- */

const NAVIGATION: ShellData['navigation'] = [
  { label: 'Overzicht', href: '#overzicht', active: true },
  { label: 'Aanvragen', href: '#aanvragen' },
  { label: 'Rapportages', href: '#rapportages' },
]

const FILTERS: FilterBarData = {
  open: false,
  filters: [
    {
      key: 'periode',
      label: 'Periode',
      kind: 'select',
      options: [
        { value: 'Deze week', label: 'Deze week' },
        { value: 'Deze maand', label: 'Deze maand' },
      ],
      value: 'Deze week',
      default: 'Deze week',
    },
  ],
}

/** A page of links to requests, each on its own line. */
function requests(count: number): HTMLElement {
  const list = document.createElement('div')
  for (let index = 1; index <= count; index += 1) {
    const line = document.createElement('p')
    line.innerHTML = `<a href="#aanvraag-${index}">Aanvraag ${index}</a>`
    list.append(line)
  }
  return list
}

const OFFICES = ['Utrecht', 'Zwolle', 'Arnhem', 'Leeuwarden', 'Middelburg', 'Maastricht']

const TABLE: DataTableData = {
  caption: 'Loketten',
  rowKey: 'name',
  selectable: true,
  checkedIds: ['Utrecht 1'],
  bulkActions: [{ value: 'toewijzen', label: 'Toewijzen' }],
  pageSize: 40,
  columns: [
    { key: 'name', header: 'Loket' },
    { key: 'region', header: 'Regio' },
    { key: 'requests', header: 'Aanvragen' },
  ],
  rows: Array.from({ length: 40 }, (_, index) => ({
    name: `${OFFICES[index % OFFICES.length]} ${index + 1}`,
    region: index % 2 ? 'Noord' : 'Zuid',
    requests: 100 + index,
  })),
}

const TURNS: ChatData['turns'] = ['t1', 't2', 't3'].map((id) => ({
  id,
  message: { text: 'Hoeveel aanvragen kwamen er binnen?' },
  answer: { lead: 'Het zijn er 148.230.', text: 'Het zijn er 148.230. '.repeat(40) },
}))

/* Rows -------------------------------------------------------------------- */

const SHELL_BAR: Record<string, string> = {
  'top 1440': '.lintje-navbar',
  'top 390': '.lintje-shell__mobile-pin',
  'side 1440': '.lintje-top-bar',
  'side 390': '.lintje-mobile-header',
}

async function shell(layout: 'top' | 'side', content: HTMLElement[]): Promise<HTMLElement> {
  const element = create('lintje-shell', {
    data: { name: 'Vergunningen', layout, navigation: NAVIGATION },
  })
  element.append(...content)
  return append(element)
}

const shellBar = (element: HTMLElement, layout: string): (() => HTMLElement | null) => {
  const selector = SHELL_BAR[`${layout} ${window.innerWidth >= 768 ? 1440 : 390}`]!
  return () => find(element, selector)
}

function shellRow(layout: 'top' | 'side', width: number): Row {
  return {
    tag: 'lintje-shell',
    marker: `the ${layout} layout's bar at ${width} px`,
    width,
    side: 'top',
    reserves: true,
    mount: async () => {
      const content = requests(60)
      const element = await shell(layout, [content])
      return {
        scroller: document.documentElement,
        cover: shellBar(element, layout),
        target: content.querySelectorAll('a')[30]!,
        remove: () => element.remove(),
      }
    },
  }
}

function filterRow(layout: 'top' | 'side', width: number): Row {
  return {
    tag: 'lintje-filter-bar',
    marker: `stuck under the ${layout} layout's bar at ${width} px`,
    width,
    side: 'top',
    reserves: true,
    mount: async () => {
      const bar = create('lintje-filter-bar', { data: FILTERS })
      const content = requests(60)
      const element = await shell(layout, [bar, content])
      return {
        scroller: document.documentElement,
        cover: () => find(bar, '.lintje-filter-bar.is-sticky, .lintje-filter-bar--mobile'),
        above: shellBar(element, layout),
        target: content.querySelectorAll('a')[30]!,
        remove: () => bar.remove(),
      }
    },
  }
}

async function chatInBox(): Promise<{ box: HTMLElement; chat: HTMLElement; target: HTMLElement }> {
  const box = document.createElement('div')
  box.style.cssText = 'height: 480px; overflow: auto'
  const chat = create('lintje-chat', { data: { turns: TURNS } })
  box.append(chat)
  await append(box)
  await chat.updateComplete
  await settle()
  const answer = all(chat.shadowRoot!, 'lintje-chat-answer')[1]!
  const copy = all(answer.shadowRoot!, '[label="Antwoord kopiëren"]')[0]!
  return { box, chat, target: copy.shadowRoot!.querySelector('button')! }
}

/** The question that sticks at the top of the box, the lowest if several touch it. */
function stuckQuestion(chat: HTMLElement, box: HTMLElement): HTMLElement | null {
  const top = view(box).top
  let found: HTMLElement | null = null
  for (const message of all(chat.shadowRoot!, '.lintje-chat__message') as HTMLElement[]) {
    const rect = message.getBoundingClientRect()
    if (rect.top > top + 1 || rect.bottom <= top + 1) continue
    if (!found || rect.bottom > found.getBoundingClientRect().bottom) found = message
  }
  return found
}

async function formPage(): Promise<{ bar: HTMLElement; target: HTMLElement }> {
  const form = document.createElement('div')
  form.append(spacer(900))
  for (let index = 1; index <= 30; index += 1) {
    const line = document.createElement('p')
    line.innerHTML = `<label>Opmerking ${index} <input type="text" /></label>`
    form.append(line)
  }
  document.body.append(form)
  const bar = create('lintje-form-actions')
  bar.innerHTML = '<lintje-button variant="primary">Versturen</lintje-button>'
  await append(bar)
  return { bar, target: form.querySelectorAll('input')[15]! }
}

function formRow(width: number): Row {
  return {
    tag: 'lintje-form-actions',
    marker: `the action bar at ${width} px`,
    width,
    side: 'bottom',
    reserves: true,
    mount: async () => {
      const { bar, target } = await formPage()
      return {
        scroller: document.documentElement,
        cover: () => bar,
        target,
        remove: () => bar.remove(),
      }
    },
  }
}

const ROWS: Row[] = [
  shellRow('top', 1440),
  shellRow('top', 390),
  shellRow('side', 1440),
  shellRow('side', 390),
  filterRow('top', 1440),
  filterRow('top', 390),
  filterRow('side', 1440),
  filterRow('side', 390),
  {
    tag: 'lintje-chat',
    marker: 'the question box',
    width: 1440,
    side: 'bottom',
    reserves: true,
    mount: async () => {
      const { box, chat, target } = await chatInBox()
      return {
        scroller: box,
        cover: () => find(chat, '.lintje-chat__footer'),
        target,
        remove: () => chat.remove(),
      }
    },
  },
  {
    tag: 'lintje-chat',
    marker: 'the question above its answer',
    width: 1440,
    side: 'top',
    reserves: true,
    mount: async () => {
      const { box, chat, target } = await chatInBox()
      return {
        scroller: box,
        cover: () => stuckQuestion(chat, box),
        target,
        remove: () => chat.remove(),
      }
    },
  },
  formRow(1440),
  formRow(390),
  {
    tag: 'lintje-data-table',
    marker: 'the selection bar at the top at 1440 px',
    width: 1440,
    side: 'top',
    reserves: false,
    mount: async () => {
      const table = create('lintje-data-table', { data: TABLE })
      const element = await shell('top', [table, spacer(1200)])
      await table.updateComplete
      const target = all(
        table.shadowRoot!,
        '.lintje-data-table__full tbody .lintje-choice__input',
      )[20] as HTMLElement
      return {
        scroller: document.documentElement,
        cover: () => find(table, '.lintje-data-table__selection'),
        above: shellBar(element, 'top'),
        target,
        // The checkbox's own box is the size of nothing: the reader sees its cell.
        box: target.closest('td, th') as HTMLElement,
        remove: () => table.remove(),
      }
    },
  },
  {
    tag: 'lintje-data-table',
    marker: 'the selection bar at the bottom at 390 px',
    width: 390,
    height: 500,
    side: 'bottom',
    reserves: false,
    mount: async () => {
      document.body.append(spacer(1500))
      const table = await append(create('lintje-data-table', { data: TABLE }))
      const target = all(
        table.shadowRoot!,
        '.lintje-data-table__mobile tbody .lintje-choice__input',
      )[2] as HTMLElement
      return {
        scroller: document.documentElement,
        cover: () => find(table, '.lintje-data-table__selection--mobile'),
        target,
        box: target.closest('td, th') as HTMLElement,
        remove: () => table.remove(),
      }
    },
  },
]

/* The contract ------------------------------------------------------------ */

const RESERVES = 'keeps its height as scroll padding, and gives it back'
const CLEARS = 'scrolls a control the keyboard reaches under it clear'

/** The keyboard's way to the control: from below it for a bar on top, from above for one below. */
async function tabTo(scene: Scene, side: Row['side']): Promise<void> {
  const stops = tabbables(document.body)
  const at = stops.indexOf(scene.target)
  expect(at, 'the control is a Tab stop').toBeGreaterThan(-1)
  const start = stops[side === 'top' ? at + 1 : at - 1]!
  start.focus({ preventScroll: true })
  await settle()
  await bury(scene)
  await userEvent.keyboard(side === 'top' ? SHIFT_TAB : TAB)
  await expect
    .poll(() => deepActiveElement(), { message: 'the focus is on the control' })
    .toBe(scene.target)
}

const checks: Record<string, (row: Row) => Promise<void>> = {
  [RESERVES]: async (row) => {
    const scene = await row.mount()
    const cover = await bury(scene)
    const reach = (): number => {
      const box = cover.getBoundingClientRect()
      const sight = view(scene.scroller)
      return row.side === 'top' ? box.bottom - sight.top : sight.bottom - box.top
    }
    await expect
      .poll(() => padding(scene.scroller, row.side) >= reach() - 1, {
        message: 'the scroll padding reaches past it',
      })
      .toBe(true)
    const during = padding(scene.scroller, row.side)
    const height = cover.getBoundingClientRect().height
    scene.remove()
    await expect
      .poll(() => padding(scene.scroller, row.side) <= during - height + 1, {
        message: 'its height is given back',
      })
      .toBe(true)
  },
  [CLEARS]: async (row) => {
    const scene = await row.mount()
    const box = scene.box ?? scene.target
    await tabTo(scene, row.side)
    const clear = (): boolean => {
      const cover = scene.cover()
      if (cover && overlap(box, cover)) return false
      const rect = box.getBoundingClientRect()
      const hit = hitAt((rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2)
      return hit !== null && standsIn(hit, box)
    }
    await expect.poll(clear, { message: 'the control is in sight, nothing over it' }).toBe(true)
    const above = scene.above?.()
    const cover = scene.cover()
    if (above && cover) {
      expect(overlap(cover, above), 'it sticks under the bar above it').toBe(false)
    }
  },
}

const nameOf = (row: Row, check: string): string => `${row.tag} :: ${row.marker} :: ${check}`

const cases = ROWS.flatMap((row) =>
  (row.reserves ? [RESERVES, CLEARS] : [CLEARS]).map((check) => ({ row, check })),
)

beforeAll(() => {
  document.documentElement.lang = 'nl'
  document.body.style.margin = '0'
})

// The viewport goes back with the elements in place: WebKit keeps the media queries of a sheet
// that no connected element adopts as they were.
afterEach(async () => {
  await viewport(1440, 900)
  window.scrollTo(0, 0)
  document.documentElement.style.scrollPaddingTop = ''
  document.documentElement.style.scrollPaddingBottom = ''
  document.body.replaceChildren()
})

describe('what sticks keeps the focus clear of itself', () => {
  for (const { row, check } of cases) {
    const name = nameOf(row, check)
    it(name, async () => {
      const known = KNOWN.find((entry) => entry.test(`${name} @ ${server.browser}`))
      try {
        await viewport(row.width, row.height ?? (row.width < 768 ? 844 : 900))
        await checks[check]!(row)
      } catch (error) {
        if (known) return
        throw error
      }
      if (known) expect.fail(`passes: take ${known} out of KNOWN and docs/OPEN_ISSUES.md`)
    })
  }

  it('has no KNOWN entry that matches no check', () => {
    const names = cases.flatMap(({ row, check }) =>
      ENGINES.map((engine) => `${nameOf(row, check)} @ ${engine}`),
    )
    const stale = KNOWN.filter((entry) => !names.some((name) => entry.test(name))).map(String)
    expect(stale, `matches no check, so take out of KNOWN:\n${stale.join('\n')}`).toHaveLength(0)
  })
})
