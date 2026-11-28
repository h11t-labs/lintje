/**
 * Escape: one press answers one thing. Every element that closes or undoes something on Escape
 * leaves a press alone that a layer above it answered, as a tooltip does; and of two floating
 * layers open at once the one opened last closes first.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import '../../components/overlays/tooltip/tooltip'
import '../../components/overlays/popover/popover'
import '../../components/overlays/toggletip/toggletip'
import '../../components/overlays/modal/modal'
import '../../components/actions/menu-button/menu-button'
import '../../components/inputs/date-input/date-input'
import '../../components/inputs/time-input/time-input'
import '../../components/inputs/combobox/combobox'
import '../../components/inputs/find/find'
import '../../components/inputs/text-input/text-input'
import '../../components/inputs/multiselect/multiselect'
import '../../components/inputs/date-range/date-range'
import '../../components/frame/user-menu/user-menu'
import '../../components/frame/sub-nav/sub-nav'
import '../../components/frame/shell/shell'
import '../../components/tables/sortable-list/sortable-list'
import '../../components/tables/list/list'
import '../../components/tables/data-table/data-table'
import '../../components/chat/chat-composer/chat-composer'
import '../../components/layout/split-pane/split-pane'
import '../../components/graph/graph/graph'
import '../../components/content/audio-player/audio-player'
import '../../components/content/transcript/transcript'
import '../../components/charts/chart/chart'
import '../../components/map/map/map'
import type { ListItem } from '../../components/tables/list/list'
import type { DataTableData, GraphData } from '../../types'

type Updating = HTMLElement & { updateComplete: Promise<unknown> }

interface Row {
  name: string
  /**
   * Builds the element and puts it in a state an Escape closes or undoes, with the focus where
   * that Escape is heard; returns a reading of that state.
   */
  build: () => Promise<() => unknown>
}

/** The focused element through every shadow root. */
function active(): Element | null {
  let element = document.activeElement
  while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement
  return element
}

async function mount<T extends HTMLElement>(tag: string, props: object = {}): Promise<T> {
  const element = Object.assign(document.createElement(tag), props) as unknown as T
  document.body.append(element)
  await (element as unknown as Updating).updateComplete
  return element
}

/** Into a shadow root, step by step: `inside(host, 'lintje-button', 'button')`. */
function inside(root: Element | null | undefined, ...selectors: string[]): HTMLElement | null {
  let at: Element | null | undefined = root
  for (const selector of selectors) at = (at?.shadowRoot ?? at)?.querySelector(selector)
  return (at as HTMLElement | null) ?? null
}

const button = (host: Element | null | undefined): HTMLElement | null =>
  host?.shadowRoot?.querySelector<HTMLElement>('button, a') ?? null

async function drawn(control: () => Element | null): Promise<void> {
  await expect.poll(() => (control()?.getClientRects().length ?? 0) > 0).toBe(true)
}

async function phone(): Promise<void> {
  await page.viewport(390, 844)
  await expect.poll(() => window.innerWidth).toBe(390)
  await new Promise(requestAnimationFrame)
  await new Promise(requestAnimationFrame)
}

/** Time for a close that would come: a popover's close waits for its host. */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 150))

/** A tooltip the pointer opened elsewhere on the page: Escape dismisses it wherever the focus is. */
async function openTooltip(): Promise<() => boolean> {
  const tip = document.createElement('lintje-tooltip') as Updating & { text: string; open: boolean }
  tip.text = 'Meer over dit cijfer'
  tip.innerHTML = '<button type="button">Uitleg</button>'
  tip.style.cssText = 'position: fixed; right: 16px; bottom: 16px'
  document.body.append(tip)
  await tip.updateComplete
  tip.open = true
  const showing = (): boolean => tip.shadowRoot!.querySelector('.lintje-tooltip') !== null
  await expect.poll(showing).toBe(true)
  return showing
}

/* --- Fields ------------------------------------------------------------------ */

const FIELD_ROWS: Row[] = [
  {
    name: 'lintje-combobox :: the typed text, restored on Escape',
    build: async () => {
      const element = await mount<HTMLElement>('lintje-combobox', {
        label: 'Plaats',
        options: [
          { value: 'ut', label: 'Utrecht' },
          { value: 'zw', label: 'Zwolle' },
        ],
      })
      const input = inside(element, 'input') as HTMLInputElement
      input.focus()
      await userEvent.keyboard('Ut')
      await expect.poll(() => input.value).toBe('Ut')
      return () => input.value
    },
  },
  {
    name: 'lintje-find :: the term, cleared on Escape',
    build: async () => {
      const element = await mount<HTMLElement>('lintje-find', { label: 'Zoek', value: 'plan' })
      const input = inside(element, 'input') as HTMLInputElement
      input.focus()
      return () => input.value
    },
  },
  {
    name: 'lintje-text-input :: a search field’s text, cleared on Escape',
    build: async () => {
      const element = await mount<HTMLElement>('lintje-text-input', {
        label: 'Zoek',
        type: 'search',
        value: 'plan',
      })
      const input = inside(element, 'input') as HTMLInputElement
      input.focus()
      return () => input.value
    },
  },
]

/* --- The frame --------------------------------------------------------------- */

const NAVIGATION = [
  { label: 'Overzicht', href: '#overzicht', active: true },
  { label: 'Archief', href: '#archief' },
]

async function shell(data: Record<string, unknown>): Promise<HTMLElement> {
  const element = await mount<HTMLElement>('lintje-shell', {
    data: { name: 'Aanvragen', navigation: NAVIGATION, ...data },
  })
  element.innerHTML = '<p>Inhoud</p>'
  element.addEventListener('lintje-navigate', (event) => event.preventDefault())
  return element
}

/** The shown one of the elements that match: each bar draws its own tools, one is hidden. */
function shown(element: Element, selector: string): HTMLElement | null {
  return (
    [...element.shadowRoot!.querySelectorAll<HTMLElement>(selector)].find(
      (candidate) => candidate.getClientRects().length > 0,
    ) ?? null
  )
}

const FRAME_ROWS: Row[] = [
  {
    name: 'lintje-user-menu :: the sheet on a phone, closed on Escape',
    build: async () => {
      await phone()
      const element = await mount<HTMLElement & { open: boolean }>('lintje-user-menu', {
        user: { name: 'J. de Vries', role: 'Teamleider', initials: 'JV' },
        items: [
          { value: 'weergave', label: 'Weergave' },
          { value: 'sneltoetsen', label: 'Sneltoetsen' },
        ],
      })
      const trigger = (): HTMLElement | null => inside(element, '.lintje-user-menu__trigger')
      await drawn(trigger)
      trigger()!.focus()
      await userEvent.keyboard('{ArrowDown}')
      const row = (): HTMLElement | null => inside(element, '.lintje-menu__row')
      await drawn(row)
      await expect.poll(active).toBe(row())
      return () => element.open
    },
  },
  {
    name: 'lintje-sub-nav :: the phone’s list, closed on Escape',
    build: async () => {
      await phone()
      const element = await mount<HTMLElement & { open: boolean }>('lintje-sub-nav', {
        label: 'Instellingen',
        groups: [
          {
            label: 'Soorten gesprek',
            items: [
              { label: 'Vergadering', href: '#vergadering', active: true },
              { label: 'Hoorzitting', href: '#hoorzitting' },
            ],
          },
        ],
      })
      const toggle = (): HTMLElement | null => inside(element, '.lintje-sub-nav__toggle')
      await drawn(toggle)
      toggle()!.focus()
      await userEvent.keyboard('{Enter}')
      const link = (): HTMLElement | null => inside(element, 'a[href="#hoorzitting"]')
      await drawn(link)
      link()!.focus()
      return () => element.open
    },
  },
  {
    name: 'lintje-shell :: the rail, expanded around the focus, folded on Escape',
    build: async () => {
      const element = await shell({ layout: 'side', menu: 'unpinned' })
      const first = (): HTMLElement | null => inside(element, '.lintje-nav__list a')
      await drawn(first)
      first()!.focus()
      const state = element as HTMLElement & { railExpanded: boolean }
      await expect.poll(() => state.railExpanded).toBe(true)
      return () => state.railExpanded
    },
  },
  {
    name: 'lintje-shell :: a submenu of the bar, closed on Escape',
    build: async () => {
      const element = await shell({
        navigation: [
          { label: 'Overzicht', href: '#overzicht', active: true },
          {
            label: 'Archief',
            links: [
              { label: 'Besluiten', href: '#besluiten' },
              { label: 'Bezwaren', href: '#bezwaren' },
            ],
          },
        ],
      })
      const entry = (): HTMLElement | null =>
        inside(element, '.lintje-navbar__entry--group:not(.lintje-navbar__entry--menu)')
      await drawn(entry)
      entry()!.focus()
      await userEvent.keyboard('{Enter}')
      const link = (): HTMLElement | null => inside(element, '.lintje-navbar__submenu a')
      await drawn(link)
      link()!.focus()
      return () => inside(element, '.lintje-navbar__submenu') !== null
    },
  },
  {
    name: 'lintje-shell :: the panel "Delen", closed on Escape',
    build: async () => {
      const element = await shell({ share: true })
      const tool = (): HTMLElement | null => {
        const found = shown(element, '.lintje-share__button')
        return button(found) ?? found
      }
      await drawn(tool)
      tool()!.focus()
      await userEvent.keyboard('{Enter}')
      const state = element as HTMLElement & { shareOpen: boolean }
      await expect.poll(() => state.shareOpen).toBe(true)
      return () => state.shareOpen
    },
  },
]

/* --- Lists and tables -------------------------------------------------------- */

const LIST: ListItem[] = [
  { id: 'a', title: 'Eerste' },
  { id: 'b', title: 'Tweede', rename: { save: 'Opslaan' } },
]

const EDITABLE: DataTableData = {
  caption: 'Loketten',
  rowKey: 'name',
  columns: [
    { key: 'name', header: 'Loket' },
    { key: 'requests', header: 'Aanvragen', editor: { kind: 'number' } },
  ],
  rows: [
    { name: 'Utrecht', requests: 12 },
    { name: 'Zwolle', requests: 8 },
  ],
}

const LIST_ROWS: Row[] = [
  {
    name: 'lintje-sortable-list :: a lifted row, put back on Escape',
    build: async () => {
      const element = await mount<HTMLElement>('lintje-sortable-list', {
        label: 'Volgorde',
        items: [
          { id: 'a', label: 'Aanvragen' },
          { id: 'b', label: 'Besluiten' },
        ],
      })
      const order = (): string =>
        [...element.shadowRoot!.querySelectorAll<HTMLElement>('.lintje-sortable-list__grip')]
          .map((grip) => grip.dataset.id)
          .join()
      element
        .shadowRoot!.querySelector<HTMLElement>('.lintje-sortable-list__grip[data-id="a"]')!
        .focus()
      await userEvent.keyboard(' {ArrowDown}')
      await expect.poll(order).toBe('b,a')
      return order
    },
  },
  {
    name: 'lintje-list :: a rename, cancelled on Escape',
    build: async () => {
      const element = await mount<HTMLElement>('lintje-list', { items: LIST })
      let cancelled = 0
      element.addEventListener('lintje-row-rename-cancel', () => cancelled++)
      const field = (): HTMLElement | null =>
        inside(element, '.lintje-list__rename lintje-text-input', 'input')
      await expect.poll(() => field() !== null && active() === field()).toBe(true)
      return () => cancelled
    },
  },
  {
    name: 'lintje-data-table :: a cell’s field, closed on Escape',
    build: async () => {
      const table = await mount<HTMLElement>('lintje-data-table', { data: EDITABLE })
      const cell = (): HTMLElement | null =>
        [
          ...table.shadowRoot!.querySelectorAll<HTMLElement>(
            '.lintje-data-table__full [data-cell]',
          ),
        ].find((candidate) => candidate.dataset.cell === 'Zwolle\u001frequests') ?? null
      await drawn(cell)
      cell()!.focus()
      await userEvent.keyboard('{Enter}')
      const editing = (): boolean =>
        active()?.classList.contains('lintje-data-table__editor') ?? false
      await expect.poll(editing).toBe(true)
      return editing
    },
  },
]

/* --- Content ----------------------------------------------------------------- */

/** A silent 8-bit mono WAV: real media that loads without the network. */
function silence(seconds = 10): string {
  const rate = 8000
  const samples = rate * seconds
  const view = new DataView(new ArrayBuffer(44 + samples))
  const text = (at: number, value: string): void =>
    [...value].forEach((char, index) => view.setUint8(at + index, char.charCodeAt(0)))
  text(0, 'RIFF')
  view.setUint32(4, 36 + samples, true)
  text(8, 'WAVEfmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, rate, true)
  view.setUint32(28, rate, true)
  view.setUint16(32, 1, true)
  view.setUint16(34, 8, true)
  text(36, 'data')
  view.setUint32(40, samples, true)
  new Uint8Array(view.buffer, 44).fill(128)
  return URL.createObjectURL(new Blob([view.buffer], { type: 'audio/wav' }))
}

function graphData(): GraphData {
  return {
    description: 'Een ministerie met een dienst.',
    types: [{ key: 'org', label: 'Organisatie', icon: 'gebouwen-basis-kantoorgebouw' }],
    nodes: [
      { id: 'min', label: 'Ministerie van Wonen', type: 'org' },
      { id: 'a', label: 'Dienst Subsidies', type: 'org' },
    ],
    edges: [{ from: 'min', to: 'a' }],
  }
}

const CONTENT_ROWS: Row[] = [
  {
    name: 'lintje-chat-composer :: a running answer, stopped on Escape',
    build: async () => {
      const element = await mount<Updating & { busy: boolean }>('lintje-chat-composer', {
        busy: false,
        text: 'Hoeveel aanvragen?',
      })
      let stopped = 0
      element.addEventListener('lintje-answer-stop', () => stopped++)
      element.busy = true
      await element.updateComplete
      const field = (): HTMLElement | null => inside(element, '.lintje-chat-composer__input')
      await drawn(field)
      field()!.focus()
      return () => stopped
    },
  },
  {
    name: 'lintje-split-pane :: a lifted split, put back on Escape',
    build: async () => {
      const element = await mount<Updating & { value: number }>('lintje-split-pane')
      element.style.cssText = 'display: block; width: 800px; height: 300px'
      element.innerHTML = '<div slot="start">Links</div><div slot="end">Rechts</div>'
      await element.updateComplete
      const strip = (): HTMLElement | null => inside(element, '.lintje-split-pane__strip')
      await drawn(strip)
      // A real click on the strip lifts the split: the strip captures that pointer, and Firefox
      // refuses to capture a made-up one. The lifted split then follows a move over the block,
      // sent as an event, since the panes moving under the pointer never stand still for a hover.
      await userEvent.click(strip()!)
      const block = inside(element, '.lintje-split-pane')!
      const box = block.getBoundingClientRect()
      block.dispatchEvent(
        new PointerEvent('pointermove', {
          clientX: box.left + box.width * 0.3,
          clientY: box.top + box.height / 2,
          bubbles: true,
          composed: true,
        }),
      )
      await expect.poll(() => Math.round(element.value)).toBe(30)
      await expect.poll(() => active()?.classList.contains('lintje-split-pane__handle')).toBe(true)
      return () => Math.round(element.value)
    },
  },
  {
    name: 'lintje-graph :: a chosen node, undone on Escape',
    build: async () => {
      const element = await mount<HTMLElement>('lintje-graph', { data: graphData() })
      const node = (): HTMLElement | null =>
        element.shadowRoot!.querySelector<HTMLElement>('[data-node="a"]')
      await drawn(node)
      node()!.focus()
      await userEvent.keyboard('{Enter}')
      await expect.poll(() => node()?.getAttribute('aria-pressed')).toBe('true')
      return () => node()?.getAttribute('aria-pressed')
    },
  },
  {
    name: 'lintje-audio-player :: the time under the pointer, gone on Escape',
    build: async () => {
      const element = await mount<HTMLElement & { src: string }>('lintje-audio-player', {
        name: 'Hoorzitting',
        src: silence(),
      })
      element.style.width = '640px'
      const play = (): HTMLElement | null => inside(element, '.lintje-player__play')
      await expect.poll(() => play()?.getAttribute('aria-disabled'), { timeout: 5000 }).toBe(null)
      const wave = inside(element, '.lintje-audio-player__wave, .lintje-audio-player__bar')!
      await userEvent.hover(wave, { position: { x: 120, y: 4 } })
      const time = (): unknown => (element as unknown as { hoverTime: unknown }).hoverTime
      await expect.poll(time).not.toBeNull()
      return time
    },
  },
  {
    name: 'lintje-transcript :: a fragment’s edit, cancelled on Escape',
    build: async () => {
      const element = await mount<HTMLElement & { editingId: string | null }>('lintje-transcript', {
        segments: [
          { id: 's1', start: 702, speaker: 'Spreker 1', text: 'Dan de planning.' },
          { id: 's2', start: 724, speaker: 'Spreker 2', text: 'Is dat afgestemd?' },
        ],
      })
      element.addEventListener('lintje-segment-edit', (event) => {
        element.editingId = (event as CustomEvent<string>).detail
      })
      element.addEventListener('lintje-segment-cancel', () => (element.editingId = null))
      const segment = (): Element | null =>
        element.shadowRoot!.querySelector('.lintje-transcript__segment[data-id="s2"]')
      button(segment()!.querySelector('.lintje-transcript__edit'))!.focus()
      await userEvent.keyboard('{Enter}')
      const field = (): HTMLElement | null =>
        inside(segment()?.querySelector('lintje-textarea'), 'textarea')
      await expect.poll(() => field() !== null && active() === field()).toBe(true)
      return () => element.editingId
    },
  },
]

/* --- Charts and the map ------------------------------------------------------ */

type ChartElement = HTMLElement & { data: Record<string, unknown> }

/** A tile whose host keeps the choice as a page does: it answers a choice and a clear itself. */
async function hostedChart(
  chart: Record<string, unknown>,
  selectedId: string | null,
): Promise<ChartElement> {
  const tile = await mount<ChartElement>('lintje-chart', {
    data: { title: 'Aanvragen', description: 'Een grafiek.', chart, selectedId, clearHref: '/p' },
  })
  tile.addEventListener('lintje-mark-select', (event) => {
    event.preventDefault()
    tile.data = {
      ...tile.data,
      selectedId: (event as CustomEvent<{ id: string | null }>).detail.id,
    }
  })
  return tile
}

const SLICES = {
  kind: 'pie',
  segments: [
    { label: 'Noord', value: 12, id: 'noord', href: '/p?r=noord' },
    { label: 'Zuid', value: 8, id: 'zuid', href: '/p?r=zuid' },
  ],
}

const PARTS = {
  kind: 'treemap',
  parts: [
    { label: 'Noord', value: 12, id: 'noord', href: '/p?r=noord' },
    { label: 'Zuid', value: 8, id: 'zuid', href: '/p?r=zuid' },
  ],
}

const POINTS = [
  { id: 'utr', label: 'Loket Utrecht', value: 12, lon: 5.12, lat: 52.09, href: '/m?loket=utr' },
  { id: 'zwo', label: 'Loket Zwolle', value: 8, lon: 6.09, lat: 52.51, href: '/m?loket=zwo' },
]

async function map(data: Record<string, unknown>): Promise<HTMLElement> {
  const tile = await mount<HTMLElement>('lintje-map', {
    data: {
      variant: 'points',
      geo: 'netherlands',
      values: POINTS,
      unit: 'aanvragen',
      description: 'Loketten in Nederland.',
      ...data,
    },
  })
  await drawn(() => tile.shadowRoot!.querySelector('[data-mark-id="zwo"]'))
  return tile
}

const CHART_ROWS: Row[] = [
  {
    name: 'lintje-chart :: the tooltip of a mark with the focus, gone on Escape',
    build: async () => {
      const tile = await hostedChart(SLICES, null)
      const drawing = (): HTMLElement | null =>
        tile.shadowRoot!.querySelector<HTMLElement>('.lintje-pie-chart__svg')
      await drawn(drawing)
      drawing()!.focus()
      await userEvent.keyboard('{ArrowRight}')
      const tip = (): boolean => tile.shadowRoot!.querySelector('.lintje-chart-tooltip') !== null
      await expect.poll(tip).toBe(true)
      return tip
    },
  },
  {
    name: 'lintje-chart :: the chosen mark, cleared on Escape',
    build: async () => {
      const tile = await hostedChart(SLICES, 'noord')
      const mark = (): HTMLElement | null =>
        tile.shadowRoot!.querySelector<HTMLElement>('[data-mark-id="noord"]')
      await drawn(mark)
      mark()!.focus()
      return () => tile.data.selectedId
    },
  },
  {
    name: 'lintje-chart :: a treemap’s chosen part, cleared on Escape',
    build: async () => {
      const tile = await hostedChart(PARTS, 'noord')
      const drawing = (): HTMLElement | null =>
        tile.shadowRoot!.querySelector<HTMLElement>('.lintje-treemap__svg')
      await drawn(drawing)
      drawing()!.focus()
      // What it says counts too: a clear it only announces is no clear.
      const status = (): string =>
        tile.shadowRoot!.querySelector('.lintje-treemap [role="status"]')?.textContent?.trim() ?? ''
      await settle()
      return () => `${tile.data.selectedId} ${status()}`
    },
  },
  {
    name: 'lintje-map :: a drawn area, cleared on Escape',
    build: async () => {
      const tile = await map({
        controls: { circle: true },
        selectedArea: { kind: 'circle', centre: [5.12, 52.09], radiusKm: 40 },
      })
      const panel = (): boolean =>
        tile.shadowRoot!.querySelector('.lintje-map-chart__selection') !== null
      await expect.poll(panel).toBe(true)
      const close = tile.shadowRoot!.querySelector<HTMLElement>(
        '.lintje-map-chart__selection-close',
      )!
      ;(button(close) ?? close).focus()
      return panel
    },
  },
  {
    name: 'lintje-map :: a tool in hand, put down on Escape',
    build: async () => {
      const tile = await map({ controls: { rect: true } })
      const tool = tile.shadowRoot!.querySelector<HTMLElement>('.lintje-map-chart__tool')!
      tool.click()
      const on = (): boolean => tool.classList.contains('is-active')
      await expect.poll(on).toBe(true)
      return on
    },
  },
]

const ROWS: Row[] = [...FIELD_ROWS, ...FRAME_ROWS, ...LIST_ROWS, ...CONTENT_ROWS, ...CHART_ROWS]

afterEach(async () => {
  await page.viewport(1440, 900)
  document.body.replaceChildren()
})

describe('an Escape a tooltip answered', () => {
  it.each(ROWS.map((row) => [row.name, row] as const))('%s', async (_, row) => {
    const read = await row.build()
    const before = read()
    const tip = await openTooltip()
    await userEvent.keyboard('{Escape}')
    await expect.poll(tip).toBe(false)
    await settle()
    expect(read(), 'the first Escape is the tooltip’s alone').toEqual(before)
    // The element still answers an Escape of its own, a layer at a time.
    for (let press = 0; press < 3 && read() === before; press++) {
      await userEvent.keyboard('{Escape}')
      await settle()
    }
    expect(read(), 'a later Escape is the element’s').not.toEqual(before)
  })
})

/* --- Two floating layers ----------------------------------------------------- */

type Layer = Updating & { open: boolean }

/**
 * A multiselect's list opened by the reader, then a popover the host opens beside it, without
 * the focus: the popover is the top layer. `first` is the one that connects first, and so hears
 * a key first unless the rule decides.
 */
async function fieldThenPopover(first: 'field' | 'popover'): Promise<() => string[]> {
  const field = Object.assign(document.createElement('lintje-multiselect'), {
    label: 'Bronnen',
    options: [
      { value: 'web', label: 'Website' },
      { value: 'mail', label: 'E-mail' },
    ],
    selected: [],
  }) as unknown as Layer
  const popover = Object.assign(document.createElement('lintje-popover'), {
    label: 'Uitleg',
  }) as unknown as Layer
  popover.textContent = 'De doorlooptijd telt in werkdagen.'
  const anchor = document.createElement('button')
  anchor.textContent = 'Uitleg'
  popover.addEventListener('lintje-close', (event) => {
    if ((event as CustomEvent<{ reason: string }>).detail.reason === 'escape') popover.open = false
  })
  if (first === 'field') document.body.append(field, anchor, popover)
  else {
    document.body.append(anchor, popover)
    document.body.prepend(field)
  }
  await field.updateComplete
  const trigger = (): HTMLElement | null => inside(field, '.lintje-multiselect__field')
  await drawn(trigger)
  trigger()!.click()
  await expect.poll(() => field.open).toBe(true)
  popover.open = true
  await popover.updateComplete
  await expect.poll(() => popover.shadowRoot!.querySelector('.lintje-popover')).not.toBeNull()
  return () => [field.open && 'field', popover.open && 'popover'].filter(Boolean) as string[]
}

describe('two floating layers open at once', () => {
  it.each(['field', 'popover'] as const)(
    'the one opened last closes first, the %s connected first',
    async (first) => {
      const open = await fieldThenPopover(first)
      expect(open()).toEqual(['field', 'popover'])
      await userEvent.keyboard('{Escape}')
      await settle()
      expect(open(), 'after Escape 1').toEqual(['field'])
      await userEvent.keyboard('{Escape}')
      await settle()
      expect(open(), 'after Escape 2').toEqual([])
    },
  )
})

/* --- A floating layer's close ------------------------------------------------ */

interface Floating {
  name: string
  /** Builds the element in `stage` and opens its layer as a reader does; returns it. */
  open: (stage: HTMLElement) => Promise<Layer>
}

/** Its button, inside its own root: the first that matches. */
const part = (host: Element, selector: string): HTMLElement =>
  host.shadowRoot!.querySelector<HTMLElement>(selector)!

async function opened<T extends Layer>(
  stage: HTMLElement,
  tag: string,
  props: object,
  trigger: string,
): Promise<T> {
  const element = Object.assign(document.createElement(tag), props) as unknown as T
  stage.append(element)
  await element.updateComplete
  await drawn(() => part(element, trigger))
  part(element, trigger).click()
  await expect.poll(() => element.open).toBe(true)
  return element
}

const OPTIONS = [
  { value: 'web', label: 'Website' },
  { value: 'mail', label: 'E-mail' },
]

const FLOATING: Floating[] = [
  {
    name: 'lintje-popover, slotted in the modal',
    open: async (stage) => {
      const button = document.createElement('button')
      button.textContent = 'Uitleg'
      const popover = Object.assign(document.createElement('lintje-popover'), {
        label: 'Uitleg',
      }) as unknown as Layer
      popover.textContent = 'De doorlooptijd telt in werkdagen.'
      button.addEventListener('click', () => (popover.open = true))
      popover.addEventListener('lintje-close', () => (popover.open = false))
      stage.append(button, popover)
      await popover.updateComplete
      button.focus()
      await userEvent.keyboard('{Enter}')
      await expect.poll(() => popover.open).toBe(true)
      return popover
    },
  },
  {
    name: 'lintje-toggletip',
    open: async (stage) => {
      const text = { textContent: 'De doorlooptijd telt in werkdagen.' }
      return opened<Layer>(stage, 'lintje-toggletip', text, '.lintje-toggletip__trigger')
    },
  },
  {
    name: 'lintje-date-input',
    open: (stage) =>
      opened(stage, 'lintje-date-input', { label: 'Datum' }, '.lintje-date-input__toggle'),
  },
  {
    name: 'lintje-time-input',
    open: (stage) =>
      opened(stage, 'lintje-time-input', { label: 'Tijdstip' }, '.lintje-time-input__toggle'),
  },
  {
    name: 'lintje-multiselect',
    open: (stage) =>
      opened(
        stage,
        'lintje-multiselect',
        { label: 'Bronnen', options: OPTIONS, selected: [] },
        '.lintje-multiselect__field',
      ),
  },
  {
    name: 'lintje-date-range',
    open: (stage) =>
      opened(stage, 'lintje-date-range', { label: 'Periode' }, '.lintje-date-range-picker__field'),
  },
  {
    name: 'lintje-menu-button',
    open: (stage) =>
      opened(
        stage,
        'lintje-menu-button',
        { label: 'Acties', items: [{ value: 'weg', label: 'Verwijderen' }] },
        '.lintje-menu-button__trigger',
      ),
  },
  {
    name: 'lintje-combobox',
    open: async (stage) => {
      const element = Object.assign(document.createElement('lintje-combobox'), {
        label: 'Plaats',
        options: OPTIONS,
      }) as unknown as Layer
      stage.append(element)
      await element.updateComplete
      ;(inside(element, 'input') as HTMLInputElement).focus()
      await userEvent.keyboard('{ArrowDown}')
      await expect.poll(() => element.open).toBe(true)
      return element
    },
  },
]

describe('a floating layer’s close stays with it', () => {
  it.each(FLOATING.map((row) => [row.name, row] as const))(
    '%s: a modal around it hears no lintje-close',
    async (_, row) => {
      const modal = Object.assign(document.createElement('lintje-modal'), {
        heading: 'Details',
      }) as unknown as Layer
      // A host that answers every lintje-close it hears on the modal, as a page does.
      const heard: EventTarget[] = []
      modal.addEventListener('lintje-close', (event) => {
        heard.push(event.target!)
        modal.open = false
      })
      document.body.append(modal)
      modal.open = true
      await modal.updateComplete
      const layer = await row.open(modal)
      await userEvent.keyboard('{Escape}')
      await expect.poll(() => layer.open).toBe(false)
      await settle()
      expect(heard, 'what the modal heard').toEqual([])
      expect(modal.open).toBe(true)
      await userEvent.keyboard('{Escape}')
      await expect.poll(() => modal.open).toBe(false)
      expect(heard).toEqual([modal])
    },
  )
})
