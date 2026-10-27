/**
 * Text cut with an ellipsis: with a pointer it stands on one line and its whole words in the
 * `title`; under the keyboard's focus, on a phone and without hover it wraps whole and stays
 * inside its parent. Text that never has a pointer to show a `title` is never cut.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { deepActiveElement } from '../../core/focus'
import { TAB } from '../../core/test-keys'
import '../../components/actions/button/button'
import '../../components/actions/menu-button/menu-button'
import '../../components/charts/chart/chart'
import '../../components/chat/chat-composer/chat-composer'
import '../../components/chat/chat-steps/chat-steps'
import '../../components/content/attachment/attachment'
import '../../components/content/document-viewer/document-viewer'
import '../../components/content/log-viewer/log-viewer'
import '../../components/content/transcript/transcript'
import '../../components/filters/filter-zone/filter-zone'
import '../../components/forms/stepper/stepper'
import '../../components/frame/app-search/app-search'
import '../../components/frame/shell/shell'
import '../../components/frame/user-menu/user-menu'
import '../../components/inputs/multiselect/multiselect'
import '../../components/map/map/map'
import '../../components/tables/data-table/data-table'
import '../../components/tables/list/list'
import '../../components/tables/tree-view/tree-view'
import type { ChartData, DataTableData } from '../../types'

/**
 * How the whole text reaches a pointer: `measured` sets the `title` when the pointer finds the
 * text cut and none when it fits; `always` has it whatever the width; `never` is never cut;
 * `focus` has none, and the text stands whole, on its line, where the focus is.
 */
type Title = 'measured' | 'always' | 'never' | 'focus'

interface Row {
  name: string
  title: Title
  /** Puts the element on the page, holding `words` in a room too narrow for a long text. */
  mount: (words: string) => Promise<HTMLElement>
  /** The text that is cut. */
  text: (element: HTMLElement) => HTMLElement
  /** Where the `title` stands, when not on the text itself. */
  titleOn?: (element: HTMLElement) => HTMLElement
  /**
   * Puts the keyboard's focus where the text shows whole. A `never` row needs none; a `measured`
   * row without it keeps one line under the focus, and says why.
   */
  focus?: (element: HTMLElement) => unknown
  /** Shows the text again below 768 px, where the element draws another form of it. */
  phone?: (element: HTMLElement) => Promise<unknown>
  /** The text exists only below 768 px. */
  phoneOnly?: boolean
  /** A text longer than `LONG`, for an element only the screen's width cuts; or a short one. */
  long?: string
  /** Without hover, on a tablet, the text wraps as on a phone: its `(hover: none)` rule. */
  touch?: boolean
  /** What the text stays inside at 390 and 320 px. */
  room: (element: HTMLElement) => HTMLElement
}

/**
 * The rows that fail today, by name; each has its GitHub issue above it. A row that passes while
 * it matches an entry fails, so the fix takes its entry out.
 */
const KNOWN: RegExp[] = []

const LONG = 'Wijzigingen in de aanvraag opslaan en doorsturen naar de behandelaar van het loket'
const SHORT = 'Opslaan'
/** A menu is as wide as its longest row, up to the screen. */
const SCREEN_WIDE = `${LONG}, ${LONG} en ${LONG}`

/* Helpers ----------------------------------------------------------------- */

const frame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()))

async function append<T extends HTMLElement>(
  element: T,
  parent: HTMLElement = document.body,
): Promise<T> {
  parent.append(element)
  await (element as T & { updateComplete?: Promise<unknown> }).updateComplete
  await frame()
  return element
}

/** A block on the page for an element to sit in: `width` wide, or the screen where that is less. */
function room(width: number): HTMLElement {
  const block = document.createElement('div')
  block.style.width = `${width}px`
  block.style.maxWidth = '100%'
  document.body.append(block)
  return block
}

const inShadow = (element: Element, selector: string): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>(selector)!

/** Every match under a root, through each open shadow root. */
function all(root: ParentNode, selector: string, found: HTMLElement[] = []): HTMLElement[] {
  for (const element of root.querySelectorAll<HTMLElement>('*')) {
    if (element.matches(selector)) found.push(element)
    if (element.shadowRoot) all(element.shadowRoot, selector, found)
  }
  return found
}

const drawn = (element: Element | undefined): boolean =>
  Boolean(element && element.getBoundingClientRect().width > 1)

/** The first drawn match in the element's shadow roots: a table has a wide and a phone form. */
function shown(element: Element, selector: string): HTMLElement {
  const matches = all(element.shadowRoot!, selector)
  return matches.find(drawn) ?? matches[0]!
}

/** Overflow does not apply to an inline box, whose `scrollWidth` Firefox still reports. */
const cut = (text: HTMLElement): boolean =>
  getComputedStyle(text).display !== 'inline' && text.scrollWidth > text.clientWidth

function lines(text: HTMLElement): number {
  const height = parseFloat(getComputedStyle(text).lineHeight)
  return Math.round(text.getBoundingClientRect().height / height)
}

function inside(element: Element, parent: Element): boolean {
  const box = element.getBoundingClientRect()
  const outer = parent.getBoundingClientRect()
  return box.left >= outer.left - 1 && box.right <= outer.right + 1
}

async function viewport(width: number, height: number): Promise<void> {
  await page.viewport(width, height)
  // WebKit resizes the frame after `viewport()` resolves.
  await expect.poll(() => window.innerWidth).toBe(width)
}

/** A focus from the keyboard: after a key press a focus moved by script is one. */
async function keyboardFocus(row: Row, element: HTMLElement): Promise<void> {
  if (!deepActiveElement() || deepActiveElement() === document.body) {
    const start = Object.assign(document.createElement('input'), { ariaLabel: 'Zoeken' })
    document.body.prepend(start)
    start.focus()
  }
  await userEvent.keyboard('{Shift}')
  await row.focus!(element)
  await expect
    .poll(() => deepActiveElement()?.matches(':focus-visible') ?? false, {
      message: 'a keyboard focus',
    })
    .toBe(true)
}

/**
 * Tab from a field just before the element. WebKit takes a key only in a document that holds the
 * focus, and gives a focus moved by script the keyboard's ring only after one that had it.
 */
async function tabInto(element: HTMLElement): Promise<void> {
  const start = Object.assign(document.createElement('input'), { ariaLabel: 'Zoeken' })
  element.before(start)
  start.focus()
  await userEvent.keyboard(TAB)
}

/** The arrow keys onto the second row of an open menu: the first takes the focus as it opens. */
async function arrowToSecond(element: HTMLElement): Promise<void> {
  const target = all(element.shadowRoot!, '.lintje-menu__row')[1]!
  for (let step = 0; step < 4 && deepActiveElement() !== target; step++) {
    await userEvent.keyboard('{ArrowDown}')
  }
}

/* Rows -------------------------------------------------------------------- */

const PICTURE =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="160" height="90" fill="#ccc"/></svg>',
  )

/**
 * The element's rules for a screen without hover, switched on in this frame: emulating the
 * media feature is page-wide and Chromium's alone.
 */
function withoutHover(element: HTMLElement): () => void {
  const rules = element
    .shadowRoot!.adoptedStyleSheets.flatMap((sheet) => [...sheet.cssRules])
    .filter(
      (rule): rule is CSSMediaRule =>
        rule instanceof CSSMediaRule && rule.conditionText.includes('(hover: none)'),
    )
  expect(rules.length, 'a rule for a screen without hover').toBeGreaterThan(0)
  const texts = rules.map((rule) => rule.media.mediaText)
  for (const rule of rules) rule.media.mediaText = 'all'
  return () => rules.forEach((rule, i) => (rule.media.mediaText = texts[i]!))
}

/** Puts the caret at the start of the question box, in its first word. */
async function caretInFirstWord(element: HTMLElement): Promise<void> {
  inShadow(element, '.lintje-chat-composer__input').focus()
  await userEvent.keyboard('{Home}')
  await (element as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete
}

/** Opens a menu with the pointer, unless it is open: a resize may close it. */
async function reopen(element: HTMLElement, trigger: string): Promise<void> {
  const host = element as HTMLElement & { open: boolean; updateComplete: Promise<unknown> }
  // A click from script would give the first row a keyboard's focus.
  if (!host.open) await userEvent.click(inShadow(element, trigger))
  await host.updateComplete
  await frame()
}

function table(data: Partial<DataTableData>, width: number) {
  return async (words: string): Promise<HTMLElement> => {
    const element = document.createElement('lintje-data-table') as HTMLElement & {
      data: DataTableData
    }
    element.data = {
      caption: 'Loketten met een toelichting',
      rowKey: 'requests',
      columns: [],
      rows: [],
      ...data,
    }
    element.data = JSON.parse(JSON.stringify(element.data).replaceAll('{words}', words))
    return append(element, room(width))
  }
}

const ROWS: Row[] = [
  {
    name: 'lintje-button',
    title: 'measured',
    mount: (words) =>
      append(
        Object.assign(document.createElement('lintje-button'), { textContent: words }),
        room(240),
      ),
    text: (element) => inShadow(element, '.lintje-button__label'),
    focus: (element) => element.focus(),
    room: (element) => element.parentElement!,
  },
  {
    name: 'lintje-menu-button :: trigger',
    title: 'measured',
    mount: (words) =>
      append(
        Object.assign(document.createElement('lintje-menu-button'), {
          label: words,
          items: [{ label: 'Bewaren', value: 'bewaren' }],
        }),
        room(240),
      ),
    text: (element) => inShadow(element, '.lintje-menu-button__trigger .lintje-button__label'),
    focus: (element) => inShadow(element, '.lintje-menu-button__trigger').focus(),
    room: (element) => element.parentElement!,
  },
  {
    name: 'lintje-data-table :: truncate column',
    title: 'always',
    mount: table(
      {
        clickable: true,
        columns: [
          { key: 'note', header: 'Toelichting', truncate: true },
          { key: 'requests', header: 'Aanvragen' },
        ],
        rows: [{ note: '{words}', requests: 12 }],
      },
      900,
    ),
    // Below 768 px the identity stands whole in the phone form's first cell.
    text: (element) =>
      shown(element, '.lintje-data-table__cell-text, .lintje-data-table__mobile-cell'),
    focus: (element) => shown(element, '.lintje-data-table__cell-text').closest('tr')!.focus(),
    room: (element) => element,
  },
  {
    name: 'lintje-data-table :: filter chip',
    title: 'never',
    mount: table(
      {
        columns: [
          { key: 'name', header: 'Loket', filter: { kind: 'text' } },
          { key: 'requests', header: 'Aanvragen' },
        ],
        rows: [{ name: 'Utrecht', requests: 12 }],
        filters: { name: '{words}' },
      },
      900,
    ),
    text: (element) => inShadow(element, '.lintje-data-table__chip'),
    room: (element) => element,
  },
  {
    name: 'lintje-list :: title',
    title: 'always',
    mount: (words) =>
      append(
        Object.assign(document.createElement('lintje-list'), {
          items: [{ id: 'l', title: words, meta: '10:12' }],
        }),
        room(320),
      ),
    text: (element) => inShadow(element, '.lintje-list__title'),
    focus: (element) => inShadow(element, '.lintje-list__title').focus(),
    room: (element) => element.parentElement!,
  },
  {
    name: 'lintje-list :: title of a row that opens nothing, its action focused',
    title: 'always',
    mount: (words) =>
      append(
        Object.assign(document.createElement('lintje-list'), {
          items: [
            {
              id: 'l',
              title: words,
              clickable: false,
              action: { label: 'Annuleren', value: 'annuleren' },
            },
          ],
        }),
        room(480),
      ),
    text: (element) => inShadow(element, '.lintje-list__title'),
    focus: (element) => inShadow(element, 'lintje-button').focus(),
    room: (element) => element.parentElement!,
  },
  {
    name: 'lintje-shell :: label in the open side menu',
    title: 'measured',
    mount: (words) =>
      append(
        Object.assign(document.createElement('lintje-shell'), {
          data: {
            name: 'Vergunningen',
            layout: 'side',
            navigation: [
              { label: words, href: '#aanvragen', icon: 'functioneel-document' },
              { label: 'Overzicht', href: '#overzicht', icon: 'functioneel-home' },
            ],
          },
        }),
      ),
    text: (element) => shown(element, '.lintje-nav__label, .lintje-mobile-menu__label'),
    focus: (element) => shown(element, '.lintje-nav__label').closest('a')!.focus(),
    // Below 768 px the menu is a panel behind the header's Menu button.
    phone: async (element) => {
      const shell = element as HTMLElement & { menuOpen: boolean; updateComplete: Promise<unknown> }
      shell.menuOpen = true
      await shell.updateComplete
    },
    room: (element) => element,
  },
  {
    name: 'lintje-app-search :: result',
    title: 'measured',
    mount: async (words) => {
      const search = Object.assign(document.createElement('lintje-app-search'), {
        open: true,
        query: 'aanvraag',
        groups: [
          {
            label: 'Pagina’s',
            items: [
              { id: 'a', label: 'Aanvragen', meta: 'Pagina' },
              { id: 'b', label: words, meta: 'Pagina' },
            ],
          },
        ],
      })
      return append(search)
    },
    // The first result is chosen when the results come; the second one is the one at rest.
    text: (element) => all(element.shadowRoot!, '.lintje-app-search__label')[1]!,
    // The focus is virtual: the field keeps it and ↓ chooses the row (`aria-activedescendant`).
    focus: async (element) => {
      inShadow(element, '.lintje-app-search__input').focus()
      await userEvent.keyboard('{ArrowDown}')
    },
    room: (element) => all(element.shadowRoot!, '.lintje-app-search__option')[1]!,
  },
  {
    name: 'lintje-menu-button :: menu row',
    title: 'measured',
    long: SCREEN_WIDE,
    mount: async (words) => {
      const button = await append(
        Object.assign(document.createElement('lintje-menu-button'), {
          label: 'Acties',
          // The first row takes the focus as the menu opens; WebKit may ring it.
          items: [
            { label: 'Bewaren', value: 'bewaren' },
            { label: words, value: 'lang', hint: 'Ctrl+S' },
          ],
        }),
      )
      await reopen(button, '.lintje-menu-button__trigger')
      return button
    },
    text: (element) => all(element.shadowRoot!, '.lintje-menu__label')[1]!,
    focus: arrowToSecond,
    phone: (element) => reopen(element, '.lintje-menu-button__trigger'),
    room: (element) => all(element.shadowRoot!, '.lintje-menu__row')[1]!,
  },
  {
    name: 'lintje-user-menu :: menu row',
    title: 'measured',
    long: SCREEN_WIDE,
    mount: async (words) => {
      const menu = await append(
        Object.assign(document.createElement('lintje-user-menu'), {
          user: { name: 'Sanne de Vries', role: 'Beleidsmedewerker', initials: 'SV' },
          items: [
            { value: 'profiel', label: 'Profiel' },
            { value: 'lang', label: words },
          ],
        }),
      )
      await reopen(menu, '.lintje-user-menu__trigger')
      return menu
    },
    text: (element) => all(element.shadowRoot!, '.lintje-menu__label')[1]!,
    focus: arrowToSecond,
    phone: (element) => reopen(element, '.lintje-user-menu__trigger'),
    room: (element) => all(element.shadowRoot!, '.lintje-menu__row')[1]!,
  },
  {
    name: 'lintje-tree-view :: label',
    title: 'measured',
    mount: (words) =>
      append(
        Object.assign(document.createElement('lintje-tree-view'), {
          label: 'Mappen',
          nodes: [
            { id: 'a', label: words, count: 3 },
            { id: 'b', label: 'Archief' },
          ],
        }),
        room(240),
      ),
    text: (element) => inShadow(element, '.lintje-tree__label'),
    focus: tabInto,
    room: (element) => element.parentElement!,
  },
  {
    name: 'lintje-stepper :: name of the current step on a phone',
    title: 'never',
    phoneOnly: true,
    mount: (words) =>
      append(
        Object.assign(document.createElement('lintje-stepper'), {
          label: 'Stappen van de aanvraag',
          steps: [
            { label: 'Gegevens', state: 'done' },
            { label: words, state: 'current' },
            { label: 'Versturen', state: 'todo' },
          ],
        }),
      ),
    text: (element) => inShadow(element, '.lintje-stepper__current'),
    room: (element) => element,
  },
  {
    name: 'lintje-transcript :: speaker, read-only',
    title: 'never',
    mount: (words) =>
      append(
        Object.assign(document.createElement('lintje-transcript'), {
          readonly: true,
          segments: [
            { id: 's1', start: 0, speaker: words, text: 'Goedemorgen, welkom bij het overleg.' },
          ],
        }),
        room(480),
      ),
    text: (element) => inShadow(element, '.lintje-transcript__speaker'),
    room: (element) => element,
  },
  {
    name: 'lintje-filter-zone :: sentence in the collapsed bar',
    title: 'measured',
    mount: (words) =>
      append(
        Object.assign(document.createElement('lintje-filter-zone'), {
          open: false,
          total: 2,
          sentence: [{ text: words, emphasis: false }],
        }),
        room(480),
      ),
    text: (element) => shown(element, '.lintje-filter-summary__text'),
    // Under the focus the bar keeps one line: its height is what the sticky offsets reckon with.
    room: (element) => element,
  },
  {
    name: 'lintje-document-viewer :: name',
    title: 'never',
    mount: (words) =>
      append(
        Object.assign(document.createElement('lintje-document-viewer'), {
          name: words,
          pages: [PICTURE],
        }),
        room(480),
      ),
    text: (element) => inShadow(element, '.lintje-document-viewer__name'),
    room: (element) => element,
  },
  {
    name: 'lintje-chart :: row label of a heatmap',
    title: 'always',
    mount: (words) => {
      const data: ChartData = {
        title: 'Drukte aan het loket',
        description: 'Bezoekers per uur en per loket.',
        state: 'ready',
        chart: {
          kind: 'heatmap',
          columnLabels: ['9:00', '10:00'],
          rowLabels: [words, 'Utrecht', 'Zwolle'],
          values: [
            [10, 12],
            [14, 9],
            [7, 11],
          ],
          unit: 'bezoekers',
        },
      }
      return append(Object.assign(document.createElement('lintje-chart'), { data }), room(480))
    },
    text: (element) => shown(element, '.lintje-heatmap__row-label-text'),
    titleOn: (element) => shown(element, '.lintje-heatmap__row-label'),
    room: (element) => element,
  },
  {
    name: 'lintje-multiselect :: chip',
    title: 'always',
    mount: (words) =>
      append(
        Object.assign(document.createElement('lintje-multiselect'), {
          label: 'Loketten',
          options: [
            { value: 'a', label: words },
            { value: 'b', label: 'Utrecht' },
          ],
          selected: ['a'],
        }),
        room(320),
      ),
    text: (element) => inShadow(element, '.lintje-multiselect__chip-label'),
    titleOn: (element) => inShadow(element, '.lintje-multiselect__field'),
    focus: tabInto,
    room: (element) => inShadow(element, '.lintje-multiselect__field'),
  },
  {
    name: 'lintje-log-viewer :: source of a line',
    title: 'never',
    mount: (words) =>
      append(
        Object.assign(document.createElement('lintje-log-viewer'), {
          data: {
            title: 'Importlog',
            entries: [
              { id: 'a', time: '14:03:27.118', level: 'info', source: words, message: 'Gestart' },
            ],
          },
        }),
        room(900),
      ),
    text: (element) => inShadow(element, '.lintje-log-viewer__source'),
    room: (element) => inShadow(element, '.lintje-log-viewer__row'),
  },
  {
    // The hint is the map's own words: the map is narrower than they are.
    name: 'lintje-map :: how to draw',
    title: 'never',
    mount: async () => {
      const map = await append(
        Object.assign(document.createElement('lintje-map'), {
          data: {
            variant: 'points',
            geo: 'netherlands',
            values: [{ id: 'utr', label: 'Utrecht', value: 12, lon: 5.12, lat: 52.09 }],
            unit: 'aantal',
            description: 'Loketten in Nederland.',
            controls: { circle: true },
          },
        }),
        room(320),
      )
      await expect.poll(() => map.shadowRoot!.querySelector('.lintje-map-chart__tool')).toBeTruthy()
      inShadow(map, '.lintje-map-chart__tool').click()
      await expect.poll(() => map.shadowRoot!.querySelector('.lintje-map-chart__hint')).toBeTruthy()
      return map
    },
    text: (element) => inShadow(element, '.lintje-map-chart__hint'),
    room: (element) => inShadow(element, '.lintje-map-chart__area'),
  },
  {
    // A screen reader hears the kind in the field's live region; the eye reads it over the word.
    name: 'lintje-chat-composer :: caption over a recognised word',
    title: 'focus',
    long: 'Regio of loket?',
    mount: (words) =>
      append(
        Object.assign(document.createElement('lintje-chat-composer'), {
          vocabulary: [
            { label: 'Zuid', kind: words },
            { label: 'Utrecht', kind: 'Loket' },
          ],
          text: 'Zuid Utrecht',
        }),
        room(480),
      ),
    text: (element) => inShadow(element, '.lintje-chat-composer__caption'),
    focus: caretInFirstWord,
    phone: caretInFirstWord,
    room: (element) => inShadow(element, '.lintje-chat-composer__field'),
  },
  {
    name: 'lintje-chat-steps :: step in the open list',
    title: 'always',
    touch: true,
    mount: (words) =>
      append(
        Object.assign(document.createElement('lintje-chat-steps'), {
          open: true,
          items: [
            { label: 'Vraag gelezen', state: 'done' },
            { label: words, state: 'done' },
          ],
        }),
        room(480),
      ),
    text: (element) => all(element.shadowRoot!, '.lintje-chat-steps__text')[1]!,
    focus: (element) => inShadow(element, '.lintje-chat-steps__toggle').focus(),
    room: (element) => all(element.shadowRoot!, '.lintje-chat-steps__step')[1]!,
  },
  {
    name: 'lintje-attachment :: name',
    title: 'always',
    touch: true,
    mount: (words) =>
      append(
        Object.assign(document.createElement('lintje-attachment'), {
          removable: true,
          data: { id: 'a', name: words, size: 860 * 1024, state: 'done' },
        }),
        room(480),
      ),
    text: (element) => inShadow(element, '.lintje-attachment__stem'),
    titleOn: (element) => inShadow(element, '.lintje-attachment__name'),
    focus: (element) => inShadow(element, '.lintje-attachment__action').focus(),
    room: (element) => element.parentElement!,
  },
]

/* The contract ------------------------------------------------------------ */

// WebKit keeps the media queries of a sheet that no connected element adopts as they were: after
// a row resized to 320 px without a menu, the next menu would still read as a phone's. One hidden
// element of each tag, outside the body the rows clear, keeps every sheet adopted.
beforeAll(async () => {
  document.documentElement.lang = 'nl'
  document.body.style.margin = '0'
  const keep = document.createElement('div')
  keep.hidden = true
  const tags = [...new Set(ROWS.map((row) => row.name.split(' ')[0]!))].map((tag) =>
    document.createElement(tag),
  )
  keep.append(...tags)
  document.documentElement.append(keep)
  await Promise.all(
    tags.map((tag) => (tag as HTMLElement & { updateComplete?: unknown }).updateComplete),
  )
})

afterEach(async () => {
  await viewport(1440, 900)
  document.body.replaceChildren()
})

async function onPhones(row: Row, element: HTMLElement): Promise<void> {
  for (const [width, height] of [
    [390, 844],
    [320, 640],
  ] as const) {
    await viewport(width, height)
    await row.phone?.(element)
    await expect
      .poll(() => drawn(row.text(element)), { message: `drawn at ${width} px` })
      .toBe(true)
    await expect
      .poll(() => cut(row.text(element)), { message: `not cut at ${width} px` })
      .toBe(false)
    expect(inside(row.text(element), row.room(element)), `inside its parent at ${width} px`).toBe(
      true,
    )
  }
}

async function check(row: Row): Promise<void> {
  if (row.title === 'never') {
    const element = await row.mount(LONG)
    if (!row.phoneOnly) {
      expect(cut(row.text(element)), 'not cut at 1440 px').toBe(false)
      expect(inside(row.text(element), row.room(element)), 'inside its parent at 1440 px').toBe(
        true,
      )
      // A text the pointer passes through cannot be hovered: it has no title either way.
      if (getComputedStyle(row.text(element)).pointerEvents !== 'none') {
        await userEvent.hover(row.text(element))
      }
      expect(row.text(element).hasAttribute('title'), 'no title').toBe(false)
    }
    await onPhones(row, element)
    return
  }

  if (row.title === 'focus') {
    const element = await row.mount(row.long ?? LONG)
    await expect.poll(() => cut(row.text(element)), { message: 'cut at rest' }).toBe(true)
    expect(row.text(element).hasAttribute('title'), 'no title').toBe(false)
    await keyboardFocus(row, element)
    await expect
      .poll(() => cut(row.text(element)), { message: 'whole under the focus' })
      .toBe(false)
    expect(inside(row.text(element), row.room(element)), 'inside its parent').toBe(true)
    ;(deepActiveElement() as HTMLElement | null)?.blur()
    for (const start of document.querySelectorAll('input[aria-label="Zoeken"]')) start.remove()
    await expect.poll(() => cut(row.text(element)), { message: 'cut again' }).toBe(true)
    await onPhones(row, element)
    return
  }

  const long = row.long ?? LONG
  const element = await row.mount(long)
  const text = row.text(element)
  const titled = row.titleOn?.(element) ?? text
  // A popover may take a frame more to be laid out at its width.
  await expect.poll(() => cut(text), { message: 'cut at 1440 px' }).toBe(true)
  expect(lines(text), 'one line at 1440 px').toBe(1)
  await userEvent.hover(text)
  await expect.poll(() => titled.title, { message: 'the whole text as title' }).toBe(long)

  if (row.focus) {
    await keyboardFocus(row, element)
    await expect.poll(() => cut(text), { message: 'not cut under the focus' }).toBe(false)
    expect(lines(text), 'more than one line under the focus').toBeGreaterThan(1)
    ;(deepActiveElement() as HTMLElement | null)?.blur()
    for (const start of document.querySelectorAll('input[aria-label="Zoeken"]')) start.remove()
  }

  if (row.touch) {
    await expect.poll(() => cut(text), { message: 'cut again' }).toBe(true)
    const restore = withoutHover(element)
    try {
      await expect.poll(() => cut(text), { message: 'not cut without hover' }).toBe(false)
      expect(lines(text), 'more than one line without hover').toBeGreaterThan(1)
    } finally {
      restore()
    }
  }

  await onPhones(row, element)

  if (row.title === 'measured') {
    document.body.replaceChildren()
    await viewport(1440, 900)
    const fits = await row.mount(SHORT)
    await userEvent.hover(row.text(fits))
    expect(
      (row.titleOn?.(fits) ?? row.text(fits)).hasAttribute('title'),
      'no title on a text that fits',
    ).toBe(false)
  }
}

describe('text cut with an ellipsis', () => {
  for (const row of ROWS) {
    it(row.name, async () => {
      const known = KNOWN.find((entry) => entry.test(row.name))
      try {
        await check(row)
      } catch (error) {
        if (known) return
        throw error
      }
      if (known) expect.fail(`passes: take ${known} out of KNOWN`)
    })
  }

  it('has no KNOWN entry that matches no row', () => {
    const names = ROWS.map((row) => row.name)
    const stale = KNOWN.filter((entry) => !names.some((name) => entry.test(name))).map(String)
    expect(stale, `matches no row, so take out of KNOWN:\n${stale.join('\n')}`).toHaveLength(0)
  })
})
