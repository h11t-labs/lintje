/** Every floating panel at an anchor: where it stands, and how it lets the focus go. */
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { deepActiveElement } from '../../core/focus'
import { SHIFT_TAB, TAB } from '../../core/test-keys'
import { focusTarget, tabbables } from '../../components/shared/focus-trap'
import '../../primitives/popover/popover'
import '../../primitives/tooltip/tooltip'
import '../../components/overlays/toggletip/toggletip'
import '../../components/actions/menu-button/menu-button'
import '../../components/inputs/combobox/combobox'
import '../../components/inputs/multiselect/multiselect'
import '../../components/inputs/date-range/date-range'
import '../../components/inputs/date-input/date-input'
import '../../components/inputs/tag-input/tag-input'
import '../../components/inputs/text-editor/text-editor'
import '../../components/frame/notifications/notifications'
import '../../components/tables/data-table/data-table'
import '../../components/frame/user-menu/user-menu'
import '../../components/frame/shell/shell'
import type { DataTableData, FilterOption, ShellData } from '../../types'

type Lit = HTMLElement & { updateComplete: Promise<unknown> }

interface Opened {
  /** What the panel stands at. */
  anchor: Element
  /** The panel's surface while it is open; `null` once it is closed. */
  surface: () => Element | null
  /** Where Escape puts the focus; `null` when the element moves none (the tooltip). */
  returnsTo: Element | null
  /** The control the reader opened it with, where the focus stays if the panel takes none. */
  opener: HTMLElement
}

interface Row {
  name: string
  /** What the panel does when its scroll container scrolls, as the component intends. */
  onScroll: 'follows' | 'closes'
  /** Only on the page: the row says why no scrolling box can stand around it. */
  pageOnly?: true
  /**
   * Where opening puts the focus: on the panel's first stop (a dialog beside its button), in the
   * panel (a menu's first row, a calendar's day: no tab stops), or still on the opener.
   */
  opens: 'first stop' | 'in panel' | 'opener'
  /**
   * Shift+Tab from the panel's first stop puts the focus back on the anchor; a panel whose
   * anchor is part of the same widget (a field, a disclosure) stays open under it.
   */
  shiftTab: 'closes' | 'stays'
  /** A press inside closes it: a tooltip lives on its button's focus, which a press takes. */
  pressCloses?: true
  /** Builds the element in `stage` and opens it from its trigger, as a reader would. */
  open: (stage: HTMLElement) => Promise<Opened>
}

type Check =
  | 'at anchor'
  | 'in viewport'
  | 'on top'
  | 'follows scroll'
  | 'escape'
  | 'opens'
  | 'tab out'
  | 'shift tab'
  | 'focus away'
  | 'press inside'

/**
 * What fails today: each entry is a line in `docs/OPEN_ISSUES.md` and matches
 * `<row> [<context>] :: <check>`. A finding that matches none fails its row; an entry that
 * matches nothing in a whole run fails too, so the fix takes its entry out.
 */
const KNOWN: RegExp[] = [
  /^lintje-popover \[focus\] :: (tab out|focus away) — still open/,
  /^lintje-date-range \[scroller\] :: on top/,
]
const seen = new Set<RegExp>()
let ran = 0

/** At most this far from its anchor: `place()` keeps a gap of a few pixels. */
const GAP = 12

const frame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()))

/** Reads until `done` holds or the time is up, and returns the last reading. */
async function until<T>(read: () => T, done: (value: T) => boolean, ms = 1500): Promise<T> {
  const end = performance.now() + ms
  let value = read()
  while (!done(value) && performance.now() < end) {
    await frame()
    value = read()
  }
  return value
}

/** Every element matching `selector` under `root`, through every shadow root. */
function deepAll(root: ParentNode, selector: string, found: Element[] = []): Element[] {
  for (const element of root.querySelectorAll('*')) {
    if (element.matches(selector)) found.push(element)
    if (element.shadowRoot) deepAll(element.shadowRoot, selector, found)
  }
  return found
}

/** The surface of the open `<lintje-popover>` an element draws, wherever in its roots. */
function popoverSurface(host: Element): Element | null {
  const popovers = host.matches('lintje-popover')
    ? [host]
    : deepAll(host.shadowRoot!, 'lintje-popover')
  for (const popover of popovers) {
    const surface = popover.shadowRoot?.querySelector('.lintje-popover')
    if (surface) return surface
  }
  return null
}

const part = <T extends Element = HTMLElement>(host: Element, selector: string): T =>
  host.shadowRoot!.querySelector<T>(selector)!

function create<T extends HTMLElement>(tag: string, props: Partial<T> = {}): T {
  return Object.assign(document.createElement(tag), props) as T
}

/** Focuses without scrolling the box, then presses the keys. */
async function press(target: HTMLElement, keys: string): Promise<void> {
  target.focus({ preventScroll: true })
  await userEvent.keyboard(keys)
}

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

/** Whether `node` is `surface` or inside it in the flat tree: slotted content counts. */
function inside(surface: Element, node: Node | null): boolean {
  for (let at = node; at;) {
    if (at === surface) return true
    at =
      (at instanceof Element || at instanceof Text ? at.assignedSlot : null) ??
      at.parentNode ??
      (at instanceof ShadowRoot ? at.host : null)
  }
  return false
}

function describeNode(node: Element | null): string {
  if (!node) return 'nothing'
  const name = node.getAttribute('aria-label') ?? node.textContent?.trim().slice(0, 24)
  const kind = node.className ? `.${String(node.className).split(' ')[0]}` : ''
  return `${node.localName}${kind}${name ? ` "${name}"` : ''}`
}

const span = (rect: DOMRect, axis: 'x' | 'y'): string =>
  axis === 'x'
    ? `${Math.round(rect.left)}–${Math.round(rect.right)}`
    : `${Math.round(rect.top)}–${Math.round(rect.bottom)}`

function atAnchor(anchor: DOMRect, panel: DOMRect): string | null {
  const below = panel.top - anchor.bottom
  const above = anchor.top - panel.bottom
  const near = (gap: number): boolean => gap >= -0.5 && gap <= GAP
  if (!near(below) && !near(above))
    return `panel ${span(panel, 'y')}, anchor ${span(anchor, 'y')} (y)`
  if (panel.left >= anchor.right || panel.right <= anchor.left)
    return `panel ${span(panel, 'x')}, anchor ${span(anchor, 'x')} (x)`
  return null
}

function inViewport(panel: DOMRect): string | null {
  const fits =
    panel.left >= -0.5 &&
    panel.top >= -0.5 &&
    panel.right <= window.innerWidth + 0.5 &&
    panel.bottom <= window.innerHeight + 0.5
  return fits
    ? null
    : `panel ${span(panel, 'x')} × ${span(panel, 'y')} in ${window.innerWidth} × ${window.innerHeight}`
}

function onTop(surface: Element): string | null {
  const panel = surface.getBoundingClientRect()
  const corners = [
    [panel.left + 3, panel.top + 3],
    [panel.right - 3, panel.top + 3],
    [panel.left + 3, panel.bottom - 3],
    [panel.right - 3, panel.bottom - 3],
  ] as const
  const lost = corners
    .map(([x, y]) => [x, y, hitAt(x, y)] as const)
    .filter(([, , hit]) => !inside(surface, hit))
  return lost.length
    ? lost
        .map(([x, y, hit]) => `${Math.round(x)},${Math.round(y)} hits ${describeNode(hit)}`)
        .join('; ')
    : null
}

const offset = (anchor: Element, surface: Element): [number, number] => {
  const a = anchor.getBoundingClientRect()
  const s = surface.getBoundingClientRect()
  return [s.left - a.left, s.top - a.top]
}

// --- the rows ---------------------------------------------------------------------------

const PLACES: FilterOption[] = [
  'Amersfoort',
  'Apeldoorn',
  'Arnhem',
  'Assen',
  'Breda',
  'Delft',
  'Den Haag',
  'Deventer',
].map((label) => ({ value: label.toLowerCase(), label }))

/** Content high enough to reach past the scrolled box. */
function sentences(): HTMLElement {
  const block = create<HTMLDivElement>('div')
  block.style.cssText = 'padding: 12px; width: 240px'
  block.innerHTML =
    '<p>De cijfers worden elke nacht bijgewerkt.</p><p>Een aanvraag telt mee op de dag van ontvangst.</p><p>Openstaand is alles wat nog geen besluit heeft.</p>'
  return block
}

function table(extra: Partial<DataTableData>): Lit {
  const element = create<Lit & { data: DataTableData }>('lintje-data-table')
  element.data = {
    caption: 'Loketten',
    rowKey: 'name',
    columns: [
      { key: 'name', header: 'Loket' },
      { key: 'region', header: 'Regio' },
      { key: 'requests', header: 'Aanvragen' },
      { key: 'term', header: 'Gemiddelde doorlooptijd' },
      {
        key: 'status',
        header: 'Status van de verwerking',
        filter: {
          kind: 'options',
          options: [{ value: 'Op schema' }, { value: 'Achter op schema' }],
        },
      },
      // After the filtered column: Tab past its panel goes on to this column's header.
      { key: 'desk', header: 'Balie' },
    ],
    rows: ['Utrecht', 'Zwolle', 'Arnhem', 'Leeuwarden', 'Middelburg', 'Maastricht'].map(
      (name, index) => ({
        name,
        region: index % 2 ? 'Noord' : 'Zuid',
        requests: 100 + index,
        term: '12 dagen',
        status: index % 3 ? 'Op schema' : 'Achter op schema',
        desk: index + 1,
      }),
    ),
    ...extra,
  }
  return element
}

/** The table scrolled to its right end inside its own scroller: two scrolled containers. */
async function openInTable(
  stage: HTMLElement,
  extra: Partial<DataTableData>,
  trigger: string,
): Promise<Opened> {
  const element = table(extra)
  stage.append(element)
  await element.updateComplete
  const scroller = part(element, '.lintje-data-table__scroller')
  scroller.scrollLeft = scroller.scrollWidth
  const button = part(element, trigger)
  await press(button, '{Enter}')
  return {
    anchor: button,
    surface: () => popoverSurface(element),
    returnsTo: button,
    opener: button,
  }
}

const SHELL: ShellData = {
  name: 'Dashboard Vergunningen',
  navigation: [{ label: 'Overzicht', icon: 'functioneel-home', href: '/', active: true }],
  view: { mode: 'system' },
  share: true,
}

/** "Weergave" or "Delen" from 768 px up: in the side layout's top bar, or the top layout's bar. */
async function openShellTool(
  stage: HTMLElement,
  layout: 'side' | 'top',
  tool: 'view' | 'share',
): Promise<Opened> {
  // The shell is a page: its bar needs a page's width for the tools' words.
  stage.style.width = '1100px'
  const shell = create<Lit & { data: ShellData }>('lintje-shell')
  shell.data = { ...SHELL, layout }
  stage.append(shell)
  await shell.updateComplete
  const host = deepAll(shell.shadowRoot!, `.lintje-${tool}__button`)[0] as HTMLElement
  const button = focusTarget(host)
  await press(button, '{Enter}')
  return {
    anchor: button,
    surface: () => shell.shadowRoot!.querySelector(`.lintje-${tool}__popover`),
    returnsTo: button,
    opener: button,
  }
}

const ROWS: Row[] = [
  {
    name: 'lintje-popover',
    onScroll: 'follows',
    opens: 'opener',
    shiftTab: 'stays',
    // The popover only asks to be closed; this host closes it and gives its button the focus.
    async open(stage) {
      const button = create<HTMLButtonElement>('button', { type: 'button', textContent: 'Uitleg' })
      const popover = create<Lit & { open: boolean; label: string }>('lintje-popover')
      popover.label = 'Uitleg'
      popover.append(sentences())
      button.addEventListener('click', () => (popover.open = !popover.open))
      popover.addEventListener('lintje-close', (event) => {
        popover.open = false
        if ((event as CustomEvent<{ reason: string }>).detail.reason === 'escape') button.focus()
      })
      stage.append(button, popover)
      await press(button, '{Enter}')
      return {
        anchor: button,
        surface: () => popoverSurface(popover),
        returnsTo: button,
        opener: button,
      }
    },
  },
  {
    name: 'lintje-tooltip',
    onScroll: 'follows',
    // No stops: Tab goes on from its button.
    opens: 'opener',
    shiftTab: 'stays',
    pressCloses: true,
    async open(stage) {
      const tip = create<Lit & { text: string }>('lintje-tooltip')
      tip.text = 'Wordt elke nacht bijgewerkt'
      const button = create<HTMLButtonElement>('button', {
        type: 'button',
        textContent: 'Peilmoment',
      })
      tip.append(button)
      stage.append(tip)
      await tip.updateComplete
      button.focus({ preventScroll: true })
      return {
        anchor: button,
        surface: () => tip.shadowRoot!.querySelector('.lintje-tooltip'),
        returnsTo: null,
        opener: button,
      }
    },
  },
  {
    name: 'lintje-toggletip',
    onScroll: 'follows',
    opens: 'opener',
    shiftTab: 'stays',
    async open(stage) {
      const tip = create<Lit>('lintje-toggletip')
      tip.textContent =
        'De doorlooptijd telt in werkdagen, vanaf de dag van ontvangst tot de dag van het besluit. Een termijn die stilstaat, telt niet mee.'
      stage.append(tip)
      await tip.updateComplete
      const trigger = part(tip, '.lintje-toggletip__trigger')
      await press(trigger, '{Enter}')
      return {
        anchor: trigger,
        surface: () => tip.shadowRoot!.querySelector('.lintje-toggletip__popover.is-open'),
        returnsTo: trigger,
        opener: trigger,
      }
    },
  },
  {
    name: 'lintje-menu-button',
    onScroll: 'follows',
    opens: 'in panel',
    shiftTab: 'closes',
    async open(stage) {
      const menu = create<Lit & { label: string; items: unknown[] }>('lintje-menu-button')
      menu.label = 'Exporteren'
      menu.items = ['CSV', 'Excel', 'PDF', 'Afdrukken', 'Delen'].map((label) => ({
        value: label.toLowerCase(),
        label,
      }))
      stage.append(menu)
      await menu.updateComplete
      const trigger = part(menu, '.lintje-menu-button__trigger')
      await press(trigger, '{Enter}')
      return {
        anchor: trigger,
        surface: () => popoverSurface(menu),
        returnsTo: trigger,
        opener: trigger,
      }
    },
  },
  {
    name: 'lintje-combobox',
    onScroll: 'follows',
    // A listbox: the focus stays in the field all along, and Tab goes on from it.
    opens: 'opener',
    shiftTab: 'stays',
    async open(stage) {
      const box = create<Lit & { label: string; options: FilterOption[] }>('lintje-combobox')
      box.label = 'Gemeente'
      box.options = PLACES
      stage.append(box)
      await box.updateComplete
      const input = part(box, '.lintje-combobox__control')
      await press(input, '{ArrowDown}')
      return {
        anchor: part(box, '.lintje-combobox'),
        surface: () => popoverSurface(box),
        returnsTo: input,
        opener: input,
      }
    },
  },
  {
    name: 'lintje-date-input',
    onScroll: 'follows',
    // The calendar takes the focus to its day; its toggle is part of the field.
    opens: 'in panel',
    shiftTab: 'stays',
    async open(stage) {
      const field = create<Lit & { label: string; value: string }>('lintje-date-input')
      field.label = 'Peildatum'
      field.value = '2026-10-08'
      stage.append(field)
      await field.updateComplete
      const toggle = part(field, '.lintje-date-input__toggle')
      await press(toggle, '{Enter}')
      return {
        anchor: part(field, '.lintje-date-input'),
        surface: () => popoverSurface(field),
        returnsTo: toggle,
        opener: toggle,
      }
    },
  },
  {
    name: 'lintje-tag-input',
    onScroll: 'follows',
    // The suggestions come with typing; the focus stays in the field.
    opens: 'opener',
    shiftTab: 'stays',
    async open(stage) {
      const tags = create<Lit & { label: string; options: FilterOption[] }>('lintje-tag-input')
      tags.label = 'Trefwoorden'
      tags.options = PLACES
      stage.append(tags)
      await tags.updateComplete
      const input = part(tags, '.lintje-tag-input__input')
      await press(input, 'e')
      return {
        anchor: part(tags, '.lintje-tag-input'),
        surface: () => popoverSurface(tags),
        returnsTo: input,
        opener: input,
      }
    },
  },
  {
    name: 'lintje-text-editor',
    onScroll: 'follows',
    opens: 'first stop',
    shiftTab: 'closes',
    // The link popover stands under the toolbar; Escape gives the focus back to the text.
    async open(stage) {
      const editor = create<Lit & { label: string; value: string }>('lintje-text-editor')
      editor.label = 'Toelichting'
      editor.value = 'Lees meer op de website.'
      stage.append(editor)
      await editor.updateComplete
      const surface = part(editor, '.lintje-text-editor__surface')
      const text = surface.querySelector('p')?.firstChild ?? surface.firstChild!
      surface.focus({ preventScroll: true })
      document.getSelection()!.collapse(text, text.textContent!.indexOf('de website'))
      await userEvent.keyboard(`{Shift>}${'{ArrowRight}'.repeat('de website'.length)}{/Shift}`)
      // The element sees the selection a turn later.
      await new Promise((resolve) => setTimeout(resolve, 20))
      await userEvent.keyboard('{Control>}k{/Control}')
      return {
        anchor: part(editor, '.lintje-text-editor__toolbar'),
        surface: () => popoverSurface(editor),
        returnsTo: surface,
        opener: surface,
      }
    },
  },
  {
    name: 'lintje-notifications',
    onScroll: 'follows',
    opens: 'opener',
    shiftTab: 'stays',
    // Above 768 px: the popover. Below it the panel is a sheet that `place()` does not place.
    async open(stage) {
      const bell = create<Lit & { items: unknown[] }>('lintje-notifications')
      bell.items = [
        {
          id: '1',
          title: 'Aanvraag 2026-0412 is toegewezen',
          when: '2 minuten geleden',
          unread: true,
        },
        {
          id: '2',
          title: 'Besluit verstuurd',
          text: 'Vergunning Kerkstraat 12',
          when: '1 uur geleden',
        },
        { id: '3', title: 'Termijn verloopt over 3 dagen', when: 'gisteren' },
      ]
      stage.append(bell)
      await bell.updateComplete
      const button = part(bell, '.lintje-notifications__bell')
      await press(button, '{Enter}')
      return {
        anchor: button,
        surface: () => popoverSurface(bell),
        returnsTo: button,
        opener: button,
      }
    },
  },
  {
    name: 'lintje-data-table (column filter)',
    onScroll: 'follows',
    opens: 'first stop',
    shiftTab: 'closes',
    open: (stage) => openInTable(stage, {}, '.lintje-data-table__funnel[data-column="status"]'),
  },
  {
    name: 'lintje-data-table (column chooser)',
    onScroll: 'follows',
    opens: 'first stop',
    shiftTab: 'closes',
    open: (stage) =>
      openInTable(stage, { columnChooser: true }, '.lintje-data-table__chooser-button'),
  },
  {
    name: 'lintje-user-menu',
    onScroll: 'follows',
    opens: 'in panel',
    shiftTab: 'closes',
    async open(stage) {
      const menu = create<Lit & { user: unknown; items: unknown[] }>('lintje-user-menu')
      menu.user = { name: 'Sanne de Vries', role: 'Beleidsmedewerker', initials: 'SV' }
      menu.items = [
        { value: 'profiel', label: 'Profiel' },
        { value: 'instellingen', label: 'Instellingen' },
      ]
      stage.append(menu)
      await menu.updateComplete
      const trigger = part(menu, '.lintje-user-menu__trigger')
      await press(trigger, '{Enter}')
      return {
        anchor: trigger,
        surface: () => popoverSurface(menu),
        returnsTo: trigger,
        opener: trigger,
      }
    },
  },
  {
    name: 'lintje-multiselect',
    onScroll: 'follows',
    // A dialog that takes the focus to its search; its field is part of the element.
    opens: 'first stop',
    shiftTab: 'stays',
    async open(stage) {
      const field = create<Lit & { label: string; options: FilterOption[] }>('lintje-multiselect')
      field.label = 'Gemeenten'
      field.options = PLACES
      stage.append(field)
      await field.updateComplete
      const button = part(field, '.lintje-multiselect__field')
      await press(button, '{Enter}')
      return {
        anchor: button,
        surface: () => field.shadowRoot!.querySelector('.lintje-multiselect__popover'),
        returnsTo: button,
        opener: button,
      }
    },
  },
  {
    name: 'lintje-date-range',
    onScroll: 'follows',
    // The focus stays on the field; Tab walks into the calendar.
    opens: 'opener',
    shiftTab: 'stays',
    async open(stage) {
      const range = create<Lit & { label: string }>('lintje-date-range')
      range.label = 'Periode'
      stage.append(range)
      await range.updateComplete
      const button = part(range, '.lintje-date-range-picker__field')
      await press(button, '{Enter}')
      return {
        anchor: button,
        surface: () => range.shadowRoot!.querySelector('.lintje-date-range-picker__popover'),
        returnsTo: button,
        opener: button,
      }
    },
  },
  ...(['side', 'top'] as const).flatMap((layout) =>
    (['view', 'share'] as const).map((tool): Row => ({
      name: `lintje-shell (${tool === 'view' ? 'Weergave' : 'Delen'}, ${layout} layout)`,
      onScroll: 'follows',
      // The shell is the page: no box scrolls around its bar.
      pageOnly: true,
      // A disclosure: the focus stays on its tool, and Tab walks the panel.
      opens: 'opener',
      shiftTab: 'stays',
      open: (stage) => openShellTool(stage, layout, tool),
    })),
  ),
]

// --- the contexts -----------------------------------------------------------------------

interface Context {
  name: 'page' | 'scroller'
  /** The stage to build in, and how to scroll what holds it by `by` pixels. */
  make: () => { stage: HTMLElement; box: HTMLElement | null; scroll: (by: number) => void }
}

function spacer(height: number): HTMLElement {
  const block = create<HTMLDivElement>('div')
  block.style.height = `${height}px`
  return block
}

const CONTEXTS: Context[] = [
  {
    name: 'page',
    make() {
      const stage = create<HTMLDivElement>('div')
      stage.style.cssText = 'margin: 84px 0 0 120px; width: 480px'
      document.body.append(stage, spacer(2000))
      return { stage, box: null, scroll: (by) => window.scrollBy(0, by) }
    },
  },
  {
    name: 'scroller',
    // Small, so that every panel reaches past it, and scrolled, so the anchor stands inside it.
    make() {
      const box = create<HTMLDivElement>('div')
      box.style.cssText = 'margin: 60px 0 0 120px; width: 480px; height: 120px; overflow: auto'
      const stage = create<HTMLDivElement>('div')
      box.append(spacer(200), stage, spacer(600))
      document.body.append(box)
      box.scrollTop = 176
      return { stage, box, scroll: (by) => (box.scrollTop += by) }
    },
  },
]

beforeAll(() => {
  document.documentElement.lang = 'nl'
  Object.assign(document.body.style, {
    margin: '0',
    background: 'var(--color-bg-page)',
    color: 'var(--color-text-primary)',
    font: 'var(--text-ui)',
    fontFamily: 'var(--font-ui)',
  })
})

// The frame needs the focus for the keyboard to reach it.
beforeEach(async () => {
  const start = create<HTMLButtonElement>('button', { type: 'button', textContent: 'Begin' })
  document.body.append(start)
  await userEvent.click(start)
  start.remove()
})

afterEach(() => {
  document.body.replaceChildren()
  window.scrollTo(0, 0)
})

/** Fails on a finding that `KNOWN` does not hold. */
function report(findings: string[]): void {
  ran++
  const unknown = findings.filter((line) => {
    const known = KNOWN.find((entry) => entry.test(line))
    if (known) seen.add(known)
    return !known
  })
  expect(unknown, unknown.join('\n')).toHaveLength(0)
}

const placed = (context: Context): Row[] =>
  ROWS.filter((row) => context.name === 'page' || !row.pageOnly)

describe.each(CONTEXTS)('a placed panel, in the $name', (context) => {
  it.each(placed(context).map((row) => [row.name, row] as const))('%s', async (name, row) => {
    const findings: string[] = []
    const note = (check: Check, detail: string | null): void => {
      if (detail) findings.push(`${name} [${context.name}] :: ${check} — ${detail}`)
    }

    const { stage, box, scroll } = context.make()
    const { anchor, surface, returnsTo } = await row.open(stage)
    const opened = await until(surface, Boolean)
    expect(opened, 'the panel opens').toBeTruthy()
    const panel = opened!
    for (const animation of panel.getAnimations()) animation.finish()
    const rect = (): DOMRect => panel.getBoundingClientRect()

    if (box) {
      // Without these the scroller proves nothing.
      const edges = box.getBoundingClientRect()
      const at = anchor.getBoundingClientRect()
      expect(box.scrollTop, 'the box is scrolled').toBeGreaterThan(0)
      expect(at.top >= edges.top && at.bottom <= edges.bottom, 'the anchor is in the box').toBe(
        true,
      )
      await until(rect, (r) => r.top < edges.top || r.bottom > edges.bottom)
      const r = rect()
      expect(r.top < edges.top || r.bottom > edges.bottom, 'the panel reaches past the box').toBe(
        true,
      )
    }

    const holds = (read: () => string | null): Promise<string | null> => until(read, (d) => !d)
    note('at anchor', await holds(() => atAnchor(anchor.getBoundingClientRect(), rect())))
    note('in viewport', await holds(() => inViewport(rect())))
    note('on top', await holds(() => onTop(panel)))

    const [x, y] = offset(anchor, panel)
    const before = anchor.getBoundingClientRect().top
    scroll(box ? -30 : 30)
    const moved = await until(
      () => anchor.getBoundingClientRect().top,
      (top) => Math.abs(top - before) > 20,
    )
    expect(Math.abs(moved - before), 'the anchor moves with the scroll').toBeGreaterThan(20)
    if (row.onScroll === 'closes') {
      note(
        'follows scroll',
        (await until(surface, (s) => !s)) ? 'still open after the scroll' : null,
      )
    } else {
      const drift = await until(
        () => {
          const [nx, ny] = offset(anchor, panel)
          return Math.max(Math.abs(nx - x), Math.abs(ny - y))
        },
        (d) => d <= 1,
      )
      note(
        'follows scroll',
        drift > 1 ? `${Math.round(drift)} px off its anchor after the scroll` : null,
      )
    }

    if (surface()) {
      await userEvent.keyboard('{Escape}')
      const still = await until(surface, (s) => !s)
      if (still) note('escape', 'still open')
      else if (returnsTo) {
        const focus = await until(deepActiveElement, (element) => element === returnsTo, 500)
        note('escape', focus === returnsTo ? null : `focus on ${describeNode(focus)}`)
      }
    }

    report(findings)
  })
})

/** What a press can land on and act: a control, or what stands in one. */
const CONTROL = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  'label',
  '[contenteditable]',
  '[tabindex]:not([tabindex="-1"])',
  '[role="option"]',
  '[role^="menuitem"]',
  '[role="gridcell"]',
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="radio"]',
].join(',')

/** A point in the panel whose press lands on no control: its padding, a heading, a line of text. */
function quietSpot(surface: Element): { target: Element; x: number; y: number } | null {
  const panel = surface.getBoundingClientRect()
  for (let y = panel.top + 4; y < panel.bottom - 2; y += 4) {
    for (let x = panel.left + 4; x < panel.right - 2; x += 4) {
      const hit = hitAt(x, y)
      if (!hit || !inside(surface, hit)) continue
      let control = false
      for (let at: Node | null = hit; at && at !== surface;) {
        if (at instanceof Element && at.matches(CONTROL)) control = true
        at =
          (at instanceof Element ? at.assignedSlot : null) ??
          at.parentNode ??
          (at instanceof ShadowRoot ? at.host : null)
      }
      if (control) continue
      const box = hit.getBoundingClientRect()
      return { target: hit, x: x - box.left, y: y - box.top }
    }
  }
  return null
}

/** The last stop on or in the anchor: Tab past the panel goes on from it, Shift+Tab back to it. */
function lastIn(order: HTMLElement[], anchor: Element): number {
  let last = -1
  order.forEach((stop, index) => {
    if (inside(anchor, stop)) last = index
  })
  return last
}

describe('a popup and the focus', () => {
  it.each(ROWS.map((row) => [row.name, row] as const))('%s', async (name, row) => {
    const findings: string[] = []
    const note = (check: Check, detail: string | null): void => {
      if (detail) findings.push(`${name} [focus] :: ${check} — ${detail}`)
    }

    const elsewhere = create<HTMLButtonElement>('button', { type: 'button', textContent: 'Elders' })
    const after = create<HTMLButtonElement>('button', { type: 'button', textContent: 'Verder' })
    const stage = create<HTMLDivElement>('div')
    stage.style.cssText = 'margin: 84px 0 0 120px; width: 480px'
    // Focusable, as the shell's main region is: a press on what takes no focus lands on it.
    stage.tabIndex = -1
    document.body.append(elsewhere, stage, after, spacer(2000))

    const reopen = async (): Promise<Opened & { panel: Element }> => {
      stage.replaceChildren()
      window.scrollTo(0, 0)
      const opened = await row.open(stage)
      const panel = await until(opened.surface, Boolean)
      expect(panel, 'the panel opens').toBeTruthy()
      for (const animation of panel!.getAnimations()) animation.finish()
      return { ...opened, panel: panel! }
    }

    /** Whether the panel closed (or stayed open) as `closes` says, with the focus on `focus`. */
    const lands = async (
      opened: Opened,
      closes: boolean,
      focus: Element | undefined,
    ): Promise<string | null> => {
      // Staying open is only known once a close has had its time.
      const open = Boolean(await until(opened.surface, (s) => !s, 500))
      if (open === closes) return closes ? 'still open' : 'closed'
      const now = await until(deepActiveElement, (element) => element === focus, 500)
      return now === focus
        ? null
        : `focus on ${describeNode(now)}, not ${describeNode(focus ?? null)}`
    }

    // Opening, then Tab past the last stop (from where the focus is, where the panel has none).
    let opened = await reopen()
    const stops = tabbables(opened.panel)
    const first =
      row.opens === 'first stop'
        ? stops[0]
        : row.opens === 'opener'
          ? focusTarget(opened.opener)
          : null
    const panel = opened.panel
    const focus = await until(
      deepActiveElement,
      (element) => (first ? element === first : inside(panel, element)),
      1000,
    )
    if (first ? focus !== first : !inside(panel, focus))
      note('opens', `focus on ${describeNode(focus)}, not ${describeNode(first ?? panel)}`)
    const order = tabbables(document.body).filter((stop) => !inside(opened.panel, stop))
    const next = order[lastIn(order, opened.anchor) + 1]
    stops.at(-1)?.focus({ preventScroll: true })
    await userEvent.keyboard(TAB)
    note('tab out', await lands(opened, true, next))

    // Shift+Tab from the first stop, or a menu's first row, goes back to the anchor. A panel
    // that the focus never enters (a listbox, a tooltip) has nothing to go back from.
    opened = await reopen()
    const entered = await until(deepActiveElement, (element) => inside(opened.panel, element), 300)
    const head = tabbables(opened.panel)[0] ?? (inside(opened.panel, entered) ? entered : null)
    if (head) {
      const back = tabbables(document.body).filter((stop) => !inside(opened.panel, stop))
      head.focus({ preventScroll: true })
      await userEvent.keyboard(SHIFT_TAB)
      note(
        'shift tab',
        await lands(opened, row.shiftTab === 'closes', back[lastIn(back, opened.anchor)]),
      )
    }

    opened = await reopen()
    elsewhere.focus({ preventScroll: true })
    note('focus away', await lands(opened, true, elsewhere))

    opened = await reopen()
    const spot = quietSpot(opened.panel)
    if (!spot) note('press inside', 'no spot in the panel that is no control')
    else {
      await userEvent.click(spot.target, { position: { x: spot.x, y: spot.y } })
      const closed = !(await until(opened.surface, (s) => !s, 300))
      if (closed !== Boolean(row.pressCloses))
        note(
          'press inside',
          `${closed ? 'closed' : 'open'} after a press on ${describeNode(spot.target)}`,
        )
    }

    report(findings)
  })
})

describe('the known findings', () => {
  it('are all still found', ({ skip }) => {
    // A run of part of the table cannot say what is fixed.
    const all = CONTEXTS.reduce((sum, context) => sum + placed(context).length, ROWS.length)
    if (ran < all) skip()
    const fixed = KNOWN.filter((entry) => !seen.has(entry)).map(String)
    expect(
      fixed,
      `fixed, so take out of KNOWN and docs/OPEN_ISSUES.md:\n${fixed.join('\n')}`,
    ).toHaveLength(0)
  })
})
