/** What sticks keeps the focus clear of itself (WCAG 2.4.11), each element at each width. */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { page, server, userEvent } from 'vitest/browser'
import { deepActiveElement, holdsFocus, standsIn } from '../../core/focus'
import { SHIFT_TAB, TAB } from '../../core/test-keys'
import '../../components/chat/chat/chat'
import '../../components/tables/data-table/data-table'
import '../../components/forms/form-actions/form-actions'
import { tabbables } from '../../components/shared/focus-trap'
import '../../components/filters/filter-bar/filter-bar'
import '../../components/frame/shell/shell'
import '../../components/feedback/toast/toast'
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

/** What a walk starts from: the open panel, whose first or last stop has the focus. */
type Opens = (scene: Scene) => Promise<HTMLElement>

interface Row {
  tag: string
  marker: string
  width: number
  height?: number
  side: 'top' | 'bottom'
  /** Keeps its height as scroll padding; else it scrolls the focus clear itself. */
  reserves: boolean
  /** Stands right against the bar above it, not merely clear of it. */
  flush?: boolean
  /** Walks Tab and Shift+Tab along the stops under it, not only to the one control. */
  walks?: boolean
  /**
   * A panel that lies over the page while it is open and closes as the focus leaves it: only the
   * walks, which start on its last stop for Tab and on its first for Shift+Tab.
   */
  opens?: Opens
  mount: () => Promise<Scene>
}

/**
 * The checks that fail today, by `<tag> :: <marker> :: <check> @ <engine>`; each has its GitHub
 * issue above it. A check that passes while it matches an entry fails, so the fix takes
 * its entry out.
 */
const KNOWN: RegExp[] = []

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

/** One step up the flat tree: into the slot, out of a shadow root. */
const up = (node: Element): Element | null =>
  node.assignedSlot ?? node.parentElement ?? ((node.getRootNode() as ShadowRoot).host || null)

/** The part of the scroller the reader sees, in viewport coordinates. */
function view(scroller: HTMLElement): { top: number; bottom: number } {
  if (scroller === document.documentElement) return { top: 0, bottom: scroller.clientHeight }
  const top = scroller.getBoundingClientRect().top + scroller.clientTop
  return { top, bottom: top + scroller.clientHeight }
}

/**
 * Some of the control shows: in the scroller's sight and on top at one point at least, so
 * nothing covers it entirely. A box the size of nothing (a radio) shows as what holds it.
 */
function inSight(control: Element, scroller: HTMLElement): boolean {
  let box: Element | null = control
  while (box && !seen(box)) box = up(box)
  if (!box) return false
  const rect = box.getBoundingClientRect()
  // A stop past the scroller's own box shows in the page.
  const sight = view(standsIn(box, scroller) ? scroller : document.documentElement)
  const top = Math.max(rect.top, sight.top, 0)
  const bottom = Math.min(rect.bottom, sight.bottom, window.innerHeight)
  const left = Math.max(rect.left, 0)
  const right = Math.min(rect.right, window.innerWidth)
  if (bottom - top < 2 || right - left < 2) return false
  const xs = [left + 1, (left + right) / 2, right - 1]
  const ys = [top + 1, (top + bottom) / 2, bottom - 1]
  return xs.some((x) =>
    ys.some((y) => {
      const hit = hitAt(x, y)
      return hit !== null && standsIn(hit, box)
    }),
  )
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
    // Two more, so the sentence takes more than one line at 390 px.
    ...['Afdeling', 'Regio'].map((label) => ({
      key: label.toLowerCase(),
      label,
      kind: 'text' as const,
      value: `Alle ${label.toLowerCase()}en van het land`,
      default: '',
    })),
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
    flush: true,
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

/** A last turn whose answer asks: its questions stand in the footer, above the question box. */
const ASKING = {
  id: 't9',
  message: { text: 'Hoeveel aanvragen per provincie?' },
  answer: {
    state: 'needs-clarification' as const,
    text: 'Dat kan ik op meer manieren tellen.',
    questions: {
      questions: [
        {
          id: 'periode',
          label: 'Periode',
          text: 'Welke periode bedoel je?',
          kind: 'one' as const,
          options: [
            { value: '2025', label: 'Heel 2025' },
            { value: '12m', label: 'Afgelopen 12 maanden' },
          ],
        },
      ],
    },
  },
}

async function chatInBox(
  asking = false,
): Promise<{ box: HTMLElement; chat: HTMLElement; target: HTMLElement }> {
  const box = document.createElement('div')
  box.style.cssText = `height: ${asking ? 720 : 480}px; overflow: auto`
  const chat = create('lintje-chat', { data: { turns: asking ? [...TURNS, ASKING] : TURNS } })
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

/** A bar of the host's own, marked for the shell, at one edge. */
function hostBar(side: Row['side']): HTMLElement {
  const bar = document.createElement('div')
  bar.dataset.sticky = side
  bar.textContent = side === 'top' ? 'Zoeken in de aanvragen' : 'Speler'
  bar.style.cssText = `position: sticky; ${side}: ${side === 'top' ? 'var(--h-topbar)' : '0'};
    z-index: 2; height: 64px; background: var(--color-bg-surface)`
  return bar
}

function hostBarRow(side: Row['side'], width: number): Row {
  return {
    tag: 'lintje-shell',
    marker: `a bar of the host’s own at the ${side} at ${width} px`,
    width,
    side,
    reserves: true,
    walks: true,
    mount: async () => {
      const bar = hostBar(side)
      const content = requests(60)
      await shell('top', side === 'top' ? [bar, content] : [content, bar])
      return {
        scroller: document.documentElement,
        cover: () => (bar.isConnected ? bar : null),
        target: content.querySelectorAll('a')[30]!,
        remove: () => bar.remove(),
      }
    },
  }
}

function toastRow(width: number): Row {
  return {
    tag: 'lintje-toast',
    marker: `a toast that stays, above the action bar at ${width} px`,
    width,
    side: 'bottom',
    reserves: true,
    walks: true,
    mount: async () => {
      const { target } = await formPage()
      // The width of the page, so the toast in its corner stands over the fields at 1440 px too.
      for (const field of document.querySelectorAll('input')) field.style.width = '100%'
      const toast = create('lintje-toast', { kind: 'error' })
      toast.textContent = 'Opslaan is niet gelukt. Probeer het zo nog eens.'
      await append(toast)
      const cover = (): HTMLElement | null =>
        toast.isConnected ? find(toast, '.lintje-toast') : null
      await expect.poll(() => cover()?.querySelector('.lintje-toast__close')).toBeTruthy()
      return { scroller: document.documentElement, cover, target, remove: () => toast.remove() }
    },
  }
}

const ZONE_ROW: Row = {
  tag: 'lintje-filter-bar',
  marker: 'stuck open under the top layout’s bar at 1440 px',
  width: 1440,
  side: 'top',
  reserves: false,
  walks: true,
  mount: async () => {
    const bar = create('lintje-filter-bar', { data: FILTERS })
    const content = requests(60)
    // Links above the zone too, for the way out with Shift+Tab.
    await shell('top', [requests(10), bar, content])
    return {
      scroller: document.documentElement,
      cover: () => find(bar, '.lintje-filter-bar.is-stuck-open'),
      target: content.querySelector('a')!,
      remove: () => bar.remove(),
    }
  },
  opens: async (scene) => {
    const bar = document.querySelector('lintje-filter-bar')!
    // Only just past the top bar: the links after the zone stand under the panel it opens.
    const sentinel = all(bar.shadowRoot!, '.lintje-filter-bar__sentinel')[0]!
    scrollBy(scene.scroller, sentinel.getBoundingClientRect().top - 40)
    await expect
      .poll(() => find(bar, '.lintje-filter-bar.is-sticky'), { message: 'it sticks' })
      .toBeTruthy()
    find(bar, '.lintje-filter-toggle')!.click()
    await expect
      .poll(() => find(bar, '.lintje-filter-bar.is-settled'), { message: 'it opens' })
      .toBeTruthy()
    expect(scene.cover(), 'it stays stuck, open').toBeTruthy()
    return scene.cover()!
  },
}

const FOLLOWING: ChatData['turns'] = TURNS.map((turn, index) =>
  index < TURNS.length - 1
    ? turn
    : {
        ...turn,
        answer: {
          ...turn.answer,
          followUps: [
            { label: 'En per provincie?' },
            { label: 'En vorig jaar?' },
            { label: 'Hoe lang duurde het gemiddeld?' },
          ],
        },
      },
)

function composerRow(width: number): Row {
  return {
    tag: 'lintje-chat-composer',
    marker: `the send options over the follow-up questions at ${width} px`,
    width,
    side: 'bottom',
    reserves: false,
    walks: true,
    mount: async () => {
      const box = document.createElement('div')
      box.style.cssText = 'height: 560px; overflow: auto'
      const chat = create('lintje-chat', { data: { turns: FOLLOWING } })
      box.append(chat)
      await append(box)
      // Somewhere for Tab to go after the question box.
      document.body.append(requests(WALK + 3))
      await expect.poll(() => find(chat, 'lintje-chat-suggestions')).toBeTruthy()
      await settle()
      const suggestions = find(chat, 'lintje-chat-suggestions')!
      return {
        scroller: box,
        cover: () => find(chat, '.lintje-chat-composer__options'),
        target: all(suggestions.shadowRoot!, 'button').at(-1) as HTMLElement,
        remove: () => chat.remove(),
      }
    },
    opens: async (scene) => {
      const chat = scene.scroller.querySelector('lintje-chat')!
      const toggle = find(chat, '.lintje-chat-composer__options-toggle')!
      ;(toggle.shadowRoot?.querySelector('button') ?? toggle).click()
      await expect.poll(() => scene.cover(), { message: 'it opens' }).toBeTruthy()
      return scene.cover()!
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
    marker: 'the question box with the assistant’s questions above it',
    width: 1440,
    side: 'bottom',
    reserves: true,
    mount: async () => {
      const { box, chat, target } = await chatInBox(true)
      await expect.poll(() => find(chat, 'lintje-chat-questions')).toBeTruthy()
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
  toastRow(1440),
  toastRow(390),
  hostBarRow('top', 1440),
  hostBarRow('top', 390),
  hostBarRow('bottom', 1440),
  hostBarRow('bottom', 390),
  ZONE_ROW,
  composerRow(1440),
  composerRow(390),
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
const WALKS_ON = 'leaves no stop Tab reaches under it'
const WALKS_BACK = 'leaves no stop Shift+Tab reaches under it'

/** How many stops a walk looks at. */
const WALK = 5

/** The focus on the stop the key leaves for the control, with the control under what sticks. */
async function beside(scene: Scene, key: string): Promise<void> {
  const stops = tabbables(document.body)
  const at = stops.indexOf(scene.target)
  expect(at, 'the control is a Tab stop').toBeGreaterThan(-1)
  const start = stops[key === SHIFT_TAB ? at + 1 : at - 1]!
  start.focus({ preventScroll: true })
  await settle()
  await bury(scene)
}

/** The keyboard's way to the control: from below it for a bar on top, from above for one below. */
async function tabTo(scene: Scene, side: Row['side']): Promise<void> {
  const key = side === 'top' ? SHIFT_TAB : TAB
  await beside(scene, key)
  await userEvent.keyboard(key)
  await expect
    .poll(() => deepActiveElement(), { message: 'the focus is on the control' })
    .toBe(scene.target)
}

/** From under what sticks, or from the open panel's edge, stop after stop: each one shows. */
async function walk(row: Row, key: string): Promise<void> {
  const scene = await row.mount()
  if (row.opens) {
    const stops = tabbables(await row.opens(scene))
    stops[key === SHIFT_TAB ? 0 : stops.length - 1]!.focus({ preventScroll: true })
    await settle()
  } else {
    await beside(scene, key)
  }
  // What the poll sees: `shows`, or the stop that does not, so a failure names it.
  const shows = (): string => {
    const focused = deepActiveElement()
    if (focused && focused !== document.body && inSight(focused, scene.scroller)) return 'shows'
    const name = focused?.getAttribute('aria-label') ?? focused?.textContent?.trim().slice(0, 40)
    return `${focused?.localName ?? 'nothing'} "${name ?? ''}"`
  }
  for (let step = 1; step <= WALK; step += 1) {
    await userEvent.keyboard(key)
    await expect
      .poll(shows, { message: `stop ${step} is in sight, not covered entirely` })
      .toBe('shows')
  }
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
      if (row.flush) {
        const gap = cover.getBoundingClientRect().top - above.getBoundingClientRect().bottom
        expect(Math.abs(gap), 'it stands right under the bar').toBeLessThan(1)
      }
    }
  },
  [WALKS_ON]: (row) => walk(row, TAB),
  [WALKS_BACK]: (row) => walk(row, SHIFT_TAB),
}

const nameOf = (row: Row, check: string): string => `${row.tag} :: ${row.marker} :: ${check}`

const cases = ROWS.flatMap((row) =>
  [
    ...(row.reserves ? [RESERVES] : []),
    ...(row.opens ? [] : [CLEARS]),
    ...(row.walks ? [WALKS_ON, WALKS_BACK] : []),
  ].map((check) => ({ row, check })),
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
      if (known) expect.fail(`passes: take ${known} out of KNOWN`)
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

/* The action bar shows it sticks -------------------------------------------- */

/** Whether the bar's box carries `is-stuck`, and whether it casts a shadow. */
function shows(bar: HTMLElement): { stuck: boolean; shadow: boolean } {
  const box = bar.shadowRoot!.querySelector('.lintje-form-actions')!
  return {
    stuck: box.classList.contains('is-stuck'),
    shadow: getComputedStyle(box).boxShadow !== 'none',
  }
}

const STUCK = { stuck: true, shadow: true }
const AT_ITS_PLACE = { stuck: false, shadow: false }

describe('the action bar casts its shadow only while the form scrolls behind it', () => {
  for (const width of [1440, 390]) {
    it(`over a long form at ${width} px, and not at its own place below it`, async () => {
      await viewport(width, width < 768 ? 844 : 900)
      const { bar } = await formPage()
      await expect.poll(() => shows(bar), { message: 'at the top' }).toEqual(STUCK)
      scrollBy(document.documentElement, document.documentElement.scrollHeight)
      await expect.poll(() => shows(bar), { message: 'at the bottom' }).toEqual(AT_ITS_PLACE)
      window.scrollTo({ top: 0, behavior: 'instant' })
      await expect.poll(() => shows(bar), { message: 'back at the top' }).toEqual(STUCK)
    })
  }

  it('under a short form that fits the screen', async () => {
    const form = document.createElement('div')
    form.innerHTML = '<p><label>Opmerking <input type="text" /></label></p>'
    document.body.append(form)
    const bar = create('lintje-form-actions')
    bar.innerHTML = '<lintje-button variant="primary">Versturen</lintje-button>'
    await append(bar)
    await settle()
    expect(shows(bar)).toEqual(AT_ITS_PLACE)
  })
})

describe('the action bar scrolls nothing for the focus in itself', () => {
  for (const width of [1440, 390]) {
    it(`at ${width} px`, async () => {
      await viewport(width, width < 768 ? 844 : 900)
      const { bar } = await formPage()
      await expect.poll(() => shows(bar).stuck, { message: 'it sticks' }).toBe(true)
      const before = document.documentElement.scrollTop
      // Without the browser's own scroll into view, which brings a sticky box to its own place.
      bar.querySelector('lintje-button')!.shadowRoot!.querySelector('button')!.focus({
        preventScroll: true,
      })
      await expect.poll(() => holdsFocus(bar), { message: 'the focus is in the bar' }).toBe(true)
      await settle()
      expect(document.documentElement.scrollTop).toBe(before)
    })
  }
})

describe('the action bar does not stick on a low screen', () => {
  /** Whether it sticks at the bottom over the form, and what it reserves. */
  async function state(bar: HTMLElement): Promise<{ sticks: boolean; reserves: boolean }> {
    await settle()
    const fields = document.querySelectorAll('input')
    const last = fields[fields.length - 1]!.getBoundingClientRect()
    const box = bar.getBoundingClientRect()
    const reserved = padding(document.documentElement, 'bottom')
    return {
      sticks: getComputedStyle(bar).position === 'sticky' && box.top < last.bottom,
      reserves: reserved > 0 && reserved >= box.height - 1,
    }
  }

  const STICKS = { sticks: true, reserves: true }
  const AFTER_THE_FORM = { sticks: false, reserves: false }

  // Mounted first, then resized: WebKit keeps the media queries of a sheet no connected element
  // adopts as they were.
  it('at 320 × 256 px it stands after the last field and reserves nothing', async () => {
    const { bar } = await formPage()
    await viewport(320, 256)
    await expect.poll(() => state(bar)).toEqual(AFTER_THE_FORM)
    await expect
      .poll(() => shows(bar), { message: 'no shadow of a stuck bar' })
      .toEqual(AT_ITS_PLACE)
  })

  it('at 390 × 844 px it sticks and reserves its height', async () => {
    const { bar } = await formPage()
    await viewport(390, 844)
    await expect.poll(() => state(bar)).toEqual(STICKS)
  })

  it('sticks and reserves again as the screen grows, and stops as it shrinks', async () => {
    const { bar } = await formPage()
    await viewport(390, 256)
    await expect.poll(() => state(bar), { message: 'low' }).toEqual(AFTER_THE_FORM)
    await viewport(390, 844)
    await expect.poll(() => state(bar), { message: 'high' }).toEqual(STICKS)
    await viewport(390, 256)
    await expect.poll(() => state(bar), { message: 'low again' }).toEqual(AFTER_THE_FORM)
  })
})

/* A toast stands above the action bar ----------------------------------------- */

describe('a toast stands above the action bar, and back at its own place without it', () => {
  for (const width of [1440, 390]) {
    it(`at ${width} px, also one that goes by itself`, async () => {
      await viewport(width, width < 768 ? 844 : 900)
      const { bar } = await formPage()
      const toast = create('lintje-toast', { kind: 'ok' })
      toast.textContent = 'Opgeslagen'
      await append(toast)
      const box = (): DOMRect => find(toast, '.lintje-toast')!.getBoundingClientRect()
      await expect
        .poll(() => box().bottom <= bar.getBoundingClientRect().top + 1, {
          message: 'above the bar',
        })
        .toBe(true)
      const gap = parseFloat(getComputedStyle(document.documentElement).fontSize) * 1.5
      bar.remove()
      await expect
        .poll(() => window.innerHeight - box().bottom <= gap + 1, { message: 'at its own place' })
        .toBe(true)
    })
  }
})
