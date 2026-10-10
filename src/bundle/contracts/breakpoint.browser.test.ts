/** Rule 9: what switches view at 768 px, each element by a marker of either view. */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import '../../components/frame/app-search/app-search'
import '../../components/content/audio-player/audio-player'
import '../../components/frame/breadcrumbs/breadcrumbs'
import '../../components/tables/card-list/card-list'
import '../../components/tables/card/card'
import '../../components/charts/chart-tile/chart-tile'
import '../../components/chat/chat-answer/chat-answer'
import '../../components/chat/chat-composer/chat-composer'
import '../../components/chat/chat-message/chat-message'
import '../../components/chat/chat-strip/chat-strip'
import '../../components/chat/chat/chat'
import '../../components/overlays/confirm-dialog/confirm-dialog'
import '../../components/feedback/conflict-alert/conflict-alert'
import '../../components/tables/data-table/data-table'
import '../../components/tables/description-list/description-list'
import '../../components/content/document-viewer/document-viewer'
import '../../components/overlays/drawer/drawer'
import '../../components/feedback/empty-state/empty-state'
import '../../components/charts/explainer/explainer'
import '../../components/filters/filter-zone/filter-zone'
import '../../components/frame/footer/footer'
import '../../components/forms/form-actions/form-actions'
import '../../components/forms/form/form'
import '../../components/inputs/file-upload/file-upload'
import '../../components/inputs/select/select'
import '../../components/inputs/slot-picker/slot-picker'
import '../../components/inputs/text-editor/text-editor'
import '../../components/inputs/text-input/text-input'
import '../../components/charts/kpi-row/kpi-row'
import '../../components/tables/list/list'
import '../../components/map/map-tile/map-tile'
import '../../components/overlays/modal/modal'
import '../../components/frame/notifications/notifications'
import '../../components/tables/pagination/pagination'
import '../../components/forms/repeater/repeater'
import '../../components/frame/session-expiry/session-expiry'
import '../../components/layout/split-pane/split-pane'
import '../../components/forms/stepper/stepper'
import '../../components/frame/sub-nav/sub-nav'
import '../../components/layout/tabs/tabs'
import '../../components/feedback/toast/toast'
import '../../components/content/translator/translator'
import '../../components/filters/filter-bar/filter-bar'
import '../../components/frame/page-header/page-header'
import '../../components/frame/shell/shell'
import '../../primitives/button/button'
import '../../primitives/grid/grid'
import '../../primitives/tile/tile'
import type { LintjeFilterZone } from '../../components/filters/filter-zone/filter-zone'
import type { ListItem } from '../../components/tables/list/list'
import type { Step } from '../../components/forms/stepper/stepper'
import type { TabItem } from '../../components/layout/tabs/tabs'
import type {
  ChartTileData,
  ChatData,
  DataTableData,
  FilterBarData,
  KpiRowData,
  MapTileViewData,
  ShellData,
} from '../../types'

interface Row {
  tag: string
  /** What the reader sees of the other view. */
  marker: string
  mount: () => Promise<HTMLElement>
  wide: (element: HTMLElement) => boolean
  phone: (element: HTMLElement) => boolean
}

/**
 * The rows that fail today, by `<tag> :: <marker>`; each is a line in `docs/OPEN_ISSUES.md`. A
 * row that passes while it matches an entry fails, so the fix takes its entry out.
 */
const KNOWN: RegExp[] = []

/* Helpers ----------------------------------------------------------------- */

/** Every match under a root, through each open shadow root. */
function all(root: ParentNode, selector: string, found: Element[] = []): Element[] {
  for (const element of root.querySelectorAll('*')) {
    if (element.matches(selector)) found.push(element)
    if (element.shadowRoot) all(element.shadowRoot, selector, found)
  }
  return found
}

/** The first match in the element's shadow root, else among its children. */
const find = (root: Element, selector: string): HTMLElement | null =>
  (all(root.shadowRoot ?? root, selector)[0] as HTMLElement | undefined) ??
  (all(root, selector)[0] as HTMLElement | undefined) ??
  null

/** Drawn and larger than the 1 px of a visually hidden text. */
function seen(element: Element | null | undefined): element is HTMLElement {
  if (!element) return false
  const box = element.getBoundingClientRect()
  return box.width > 1 && box.height > 1 && getComputedStyle(element).visibility !== 'hidden'
}

const shown = (root: Element, selector: string): boolean => seen(find(root, selector))

const box = (element: Element | null): DOMRect =>
  element?.getBoundingClientRect() ?? new DOMRect(NaN, NaN, NaN, NaN)

/** Whether `lower` starts at or under the bottom of `upper` (1 px for rounding). */
const below = (upper: Element | null, lower: Element | null): boolean =>
  box(lower).top >= box(upper).bottom - 1

/** Whether `left` stands beside `right` on the same line, whatever their heights. */
const beside = (left: Element | null, right: Element | null): boolean =>
  box(left).right <= box(right).left + 1 &&
  box(left).top < box(right).bottom &&
  box(right).top < box(left).bottom

/** Whether both start on one line. */
const level = (a: Element | null, b: Element | null): boolean =>
  Math.abs(box(a).top - box(b).top) < 2

/** Puts the element on the page, drawn. */
async function append<T extends HTMLElement>(element: T): Promise<T> {
  document.body.append(element)
  await (element as T & { updateComplete?: Promise<unknown> }).updateComplete
  return element
}

function create<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & Record<string, unknown> = {},
): HTMLElementTagNameMap[K] {
  return Object.assign(document.createElement(tag), props)
}

/** A screen's height of page, to scroll an element by. */
function spacer(): HTMLElement {
  const block = document.createElement('div')
  block.style.height = '100vh'
  return block
}

/** Scrolls the page until the element starts two thirds down the screen. */
function lowerThird(element: Element): void {
  window.scrollBy(0, box(element).top - (window.innerHeight * 2) / 3)
}

async function viewport(width: number, height: number): Promise<void> {
  await page.viewport(width, height)
  // WebKit resizes the frame after `viewport()` resolves.
  await expect.poll(() => window.innerWidth).toBe(width)
}

/* Sample data ------------------------------------------------------------- */

const NAVIGATION: ShellData['navigation'] = [
  { label: 'Overzicht', href: '#overzicht', active: true },
  { label: 'Aanvragen', href: '#aanvragen' },
  { label: 'Rapportages', href: '#rapportages' },
]

const OFFICES = ['Utrecht', 'Zwolle', 'Arnhem', 'Leeuwarden', 'Middelburg', 'Maastricht']

function tableRows(count: number): DataTableData['rows'] {
  return Array.from({ length: count }, (_, index) => ({
    name: `${OFFICES[index % OFFICES.length]} ${index + 1}`,
    region: index % 2 ? 'Noord' : 'Zuid',
    requests: 100 + index,
  }))
}

const TABLE: DataTableData = {
  caption: 'Loketten',
  rowKey: 'name',
  selectable: true,
  checkedIds: ['Utrecht 1'],
  bulkActions: [{ value: 'toewijzen', label: 'Toewijzen' }],
  pageSize: 20,
  columns: [
    { key: 'name', header: 'Loket' },
    { key: 'region', header: 'Regio' },
    { key: 'requests', header: 'Aanvragen' },
  ],
  rows: tableRows(20),
}

const HOURS = ['8:00', '9:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00']
const DAYS = ['ma', 'di', 'wo', 'do', 'vr']

const HEATMAP: ChartTileData = {
  title: 'Drukte aan het loket',
  description: 'Bezoekers per uur en per werkdag.',
  state: 'ready',
  chart: {
    kind: 'heatmap',
    columnLabels: HOURS,
    rowLabels: DAYS,
    values: DAYS.map((_, day) => HOURS.map((__, hour) => 10 + day * 3 + hour)),
    unit: 'bezoekers',
  },
}

const TABS: TabItem[] = [
  { value: 'overzicht', label: 'Overzicht' },
  { value: 'aanvragen', label: 'Aanvragen', count: 12 },
  { value: 'documenten', label: 'Documenten' },
  { value: 'berichten', label: 'Berichten' },
  { value: 'instellingen', label: 'Instellingen' },
  { value: 'geschiedenis', label: 'Geschiedenis' },
]

const PANEL_TABS: TabItem[] = [
  {
    value: 'gegevens',
    label: 'Gegevens',
    icon: 'op-kantoor-document-blanco',
    hint: 'Naam en adres',
  },
  { value: 'betaling', label: 'Betaling', icon: 'functioneel-mail', hint: 'Rekening en termijn' },
]

const STEPS: Step[] = [
  { label: 'Gegevens', state: 'done', href: '#gegevens' },
  { label: 'Adres', state: 'done', href: '#adres' },
  { label: 'Inkomen', state: 'current' },
  { label: 'Bijlagen', state: 'next' },
  { label: 'Versturen', state: 'next' },
]

const LONG_TITLE: ListItem = {
  id: 'l',
  title:
    'Uw aanvraag is ontvangen. Binnen acht weken krijgt u een besluit, en bij vragen kunt u ons op werkdagen bellen.',
  meta: '10:12',
}

const FILTERS: FilterBarData = {
  open: true,
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
    {
      key: 'regio',
      label: 'Regio',
      kind: 'select',
      options: [
        { value: 'Alle regio’s', label: 'Alle regio’s' },
        { value: 'Noord', label: 'Noord' },
      ],
      value: 'Alle regio’s',
      default: 'Alle regio’s',
    },
  ],
}

const KPIS: KpiRowData = {
  columns: 4,
  kpis: [
    { label: 'Aanvragen', value: 1284 },
    { label: 'Afgehandeld', value: 1102 },
    { label: 'Openstaand', value: 182 },
    { label: 'Doorlooptijd', value: 12, suffix: 'dagen' },
  ],
}

/** A grey square, so the picture has a size without a request. */
const PICTURE =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="160" height="90" fill="#ccc"/></svg>',
  )

const MAP: MapTileViewData = {
  title: 'Loketten',
  variant: 'points',
  geo: 'netherlands',
  unit: 'aanvragen',
  description: 'Loketten in Nederland; de grootte van de stip is het aantal aanvragen.',
  values: [
    { id: 'utrecht', label: 'Utrecht', value: 120, lon: 5.12, lat: 52.09 },
    { id: 'zwolle', label: 'Zwolle', value: 80, lon: 6.09, lat: 52.51 },
    { id: 'arnhem', label: 'Arnhem', value: 95, lon: 5.9, lat: 51.98 },
  ],
}

const ANSWER = Array.from(
  { length: 12 },
  () =>
    'In maart kwamen 1.284 aanvragen binnen, 8 procent meer dan in februari. De meeste kwamen uit de regio Noord; het aandeel van de regio Zuid bleef gelijk.',
).join(' ')

const CHAT: ChatData = {
  turns: [
    {
      id: '1',
      message: { text: 'Hoeveel aanvragen kwamen er in maart binnen?' },
      answer: { state: 'ready', text: ANSWER },
    },
  ],
}

/* The rows ---------------------------------------------------------------- */

/** The lines a text takes. */
const lines = (title: HTMLElement | null): number =>
  title
    ? Math.round(box(title).height / parseFloat(getComputedStyle(title).lineHeight))
    : Number.NaN

/** Whether the first and the last tab stand on one line. */
function oneLine(element: HTMLElement): boolean {
  const tabs = all(element.shadowRoot!, '.lintje-tabs__tab')
  return level(tabs[0]!, tabs.at(-1)!)
}

/** The header's "Filters" button, which opens the filters as a sheet. */
const filtersButton = (shell: HTMLElement): HTMLElement | undefined =>
  all(shell.shadowRoot!, '.lintje-mobile-header__button').find((button) =>
    button.textContent?.includes('Filters'),
  ) as HTMLElement | undefined

/** The question, with the page scrolled well into its answer. */
function scrolledPast(chat: HTMLElement): HTMLElement | null {
  window.scrollTo(0, 0)
  const question = find(chat, 'lintje-chat-message')
  window.scrollBy(0, box(question).bottom + 100)
  return question
}

const SUBTITLES = { subtitle: 'Per uur, per werkdag, dit kwartaal', mobileSubtitle: 'Dit kwartaal' }

/** A tile's row for the shorter subtitle its host gives for a phone. */
function subtitleRow(
  tag: 'lintje-chart-tile' | 'lintje-map-tile' | 'lintje-data-table',
  data: ChartTileData | MapTileViewData | DataTableData,
): Row {
  const subtitle = (element: HTMLElement): string | undefined =>
    find(element, '.lintje-tile__sub')?.textContent ?? undefined
  return {
    tag,
    marker: 'the shorter subtitle replaces the subtitle',
    mount: () =>
      append(Object.assign(document.createElement(tag), { data: { ...data, ...SUBTITLES } })),
    wide: (element) => subtitle(element) === SUBTITLES.subtitle,
    phone: (element) => subtitle(element) === SUBTITLES.mobileSubtitle,
  }
}

const ROWS: Row[] = [
  {
    tag: 'lintje-shell',
    marker: 'the top bar’s menu gives way to a header with a Menu button',
    mount: () =>
      append(create('lintje-shell', { data: { name: 'Vergunningen', navigation: NAVIGATION } })),
    wide: (element) => shown(element, '.lintje-shell__nav a[href="#aanvragen"]'),
    phone: (element) => shown(element, '[aria-controls="lintje-mobile-menu-panel"]'),
  },
  {
    tag: 'lintje-shell',
    marker: 'the side menu gives way to a header with a Menu button',
    mount: () =>
      append(
        create('lintje-shell', {
          data: { name: 'Vergunningen', layout: 'side', navigation: NAVIGATION },
        }),
      ),
    wide: (element) => shown(element, '.lintje-nav a[href="#aanvragen"]'),
    phone: (element) => shown(element, '[aria-controls="lintje-mobile-menu-panel"]'),
  },
  {
    tag: 'lintje-shell',
    marker: 'the environment reads its first three letters',
    mount: () =>
      append(
        create('lintje-shell', {
          data: { name: 'Vergunningen', environment: 'Acceptatie', navigation: NAVIGATION },
        }),
      ),
    wide: (element) =>
      shown(element, '.lintje-logobar__environment-label') &&
      !shown(element, '.lintje-logobar__environment-short'),
    phone: (element) =>
      shown(element, '.lintje-logobar__environment-short') &&
      !shown(element, '.lintje-logobar__environment-label'),
  },
  {
    tag: 'lintje-filter-zone',
    marker: 'the sentence alone stands in place of the controls',
    mount: async () => {
      const element = create('lintje-filter-zone', {
        total: 1,
        open: true,
        sentence: [{ text: 'Je ziet: deze week', emphasis: false }],
      }) as LintjeFilterZone
      element.innerHTML = '<input aria-label="Periode" />'
      return append(element)
    },
    wide: (element) =>
      seen(element.querySelector('input')) && shown(element, '.lintje-filter-toggle'),
    phone: (element) =>
      shown(element, '.lintje-filter-bar__mobile-summary') && !seen(element.querySelector('input')),
  },
  {
    tag: 'lintje-filter-bar',
    marker: 'the sentence alone stands in place of the fields',
    mount: () => append(create('lintje-filter-bar', { data: FILTERS })),
    wide: (element) =>
      shown(element, 'lintje-field') && !shown(element, '.lintje-filter-bar__mobile-summary'),
    phone: (element) =>
      shown(element, '.lintje-filter-bar__mobile-summary') && !shown(element, 'lintje-field'),
  },
  {
    tag: 'lintje-kpi-row',
    marker: 'two KPIs side by side, the third under the first',
    mount: () => append(create('lintje-kpi-row', { data: KPIS })),
    wide: (element) => {
      const kpis = all(element.shadowRoot!, 'lintje-kpi')
      return kpis.every((kpi) => level(kpis[0]!, kpi))
    },
    phone: (element) => {
      const [first, second, third] = all(element.shadowRoot!, 'lintje-kpi')
      return level(first!, second!) && below(first!, third!)
    },
  },
  {
    tag: 'lintje-data-table',
    marker: 'the rows become a list of names with their measure',
    mount: () => append(create('lintje-data-table', { data: TABLE })),
    wide: (element) =>
      shown(element, '.lintje-data-table__full') && !shown(element, '.lintje-data-table__mobile'),
    phone: (element) =>
      shown(element, '.lintje-data-table__mobile .lintje-data-table__mobile-name') &&
      !shown(element, '.lintje-data-table__full'),
  },
  {
    tag: 'lintje-data-table',
    marker: 'the selection bar sticks to the bottom of the screen',
    mount: async () => {
      document.body.append(spacer())
      const element = await append(create('lintje-data-table', { data: TABLE }))
      document.body.append(spacer())
      return element
    },
    wide: (element) => {
      lowerThird(element)
      const bar = find(element, '.lintje-data-table__selection')
      // At the head of the table, over its first row.
      return (
        seen(bar) && box(bar).top < box(find(element, '.lintje-data-table__full tbody tr')).bottom
      )
    },
    phone: (element) => {
      lowerThird(element)
      const bar = find(element, '.lintje-data-table__selection')
      // The rows run past the screen; the bar after them stands on its bottom edge.
      return (
        seen(bar) &&
        box(find(element, '.lintje-data-table__mobile')).bottom > window.innerHeight &&
        Math.abs(box(bar).bottom - window.innerHeight) < 1
      )
    },
  },
  {
    tag: 'lintje-chart-tile',
    marker: 'the heatmap turns on its side: the days become columns',
    mount: () => append(create('lintje-chart-tile', { data: HEATMAP })),
    wide: (element) => find(element, '.lintje-heatmap__column-label')?.textContent === HOURS[0],
    phone: (element) => find(element, '.lintje-heatmap__column-label')?.textContent === DAYS[0],
  },
  {
    tag: 'lintje-chart-tile',
    marker: 'the view switch takes a row of its own under the title',
    mount: () => append(create('lintje-chart-tile', { data: { ...HEATMAP, tableSwitch: true } })),
    wide: (element) => {
      const view = find(element, '.lintje-chart-tile__view')
      return seen(view) && !below(find(element, '.lintje-tile__title'), view)
    },
    phone: (element) => {
      const view = find(element, '.lintje-chart-tile__view')
      return seen(view) && below(find(element, '.lintje-tile__title'), view)
    },
  },
  {
    tag: 'lintje-tabs',
    marker: 'the tabs keep one line that scrolls instead of wrapping',
    mount: async () => {
      const element = create('lintje-tabs', { tabs: TABS, label: 'Onderdelen' })
      element.style.width = '320px'
      return append(element)
    },
    wide: (element) => !oneLine(element),
    phone: (element) => {
      const row = find(element, '.lintje-tabs__list')!
      return oneLine(element) && row.scrollWidth > row.clientWidth
    },
  },
  {
    tag: 'lintje-tabs',
    marker: 'a panel tab stands its icon above the label and drops the hint',
    mount: () =>
      append(create('lintje-tabs', { tabs: PANEL_TABS, variant: 'panel', label: 'Onderdelen' })),
    wide: (element) =>
      shown(element, '.lintje-tabs__hint') &&
      level(find(element, '.lintje-tabs__icon'), find(element, '.lintje-tabs__label')),
    phone: (element) =>
      !shown(element, '.lintje-tabs__hint') &&
      below(find(element, '.lintje-tabs__icon'), find(element, '.lintje-tabs__label')),
  },
  {
    tag: 'lintje-stepper',
    marker: 'one line "Stap 3 van 5" with a bar',
    mount: () =>
      append(create('lintje-stepper', { steps: STEPS, label: 'Stappen van de aanvraag' })),
    wide: (element) => {
      const steps = all(element.shadowRoot!, '.lintje-stepper__step')
      return steps.length === STEPS.length && level(steps[0]!, steps.at(-1)!)
    },
    phone: (element) =>
      Boolean(find(element, '.lintje-stepper__summary')?.textContent?.includes('Stap 3 van 5')) &&
      shown(element, 'lintje-progress-bar') &&
      !shown(element, '.lintje-stepper__step'),
  },
  {
    tag: 'lintje-split-pane',
    marker: 'a switch shows one panel in place of the separator',
    mount: async () => {
      const element = create('lintje-split-pane', { startLabel: 'Lijst', endLabel: 'Details' })
      element.innerHTML = '<p slot="start">Aanvragen</p><p slot="end">Aanvraag 12</p>'
      return append(element)
    },
    wide: (element) =>
      shown(element, '[role="separator"]') &&
      shown(element, '.lintje-split-pane__pane--start') &&
      shown(element, '.lintje-split-pane__pane--end') &&
      !shown(element, 'lintje-segmented'),
    phone: (element) =>
      shown(element, 'lintje-segmented') &&
      shown(element, '.lintje-split-pane__pane--start') &&
      !shown(element, '.lintje-split-pane__pane--end') &&
      !shown(element, '[role="separator"]'),
  },
  {
    tag: 'lintje-list',
    marker: 'a long title wraps instead of being cut to one line',
    mount: async () => {
      const element = create('lintje-list', { items: [LONG_TITLE] })
      element.style.width = '320px'
      return append(element)
    },
    wide: (element) => lines(find(element, '.lintje-list__title')) === 1,
    phone: (element) => lines(find(element, '.lintje-list__title')) > 1,
  },
  {
    tag: 'lintje-page-header',
    marker: 'the dashboard’s name stands above the title, the description is left out',
    mount: () =>
      append(
        create('lintje-page-header', {
          data: {
            kicker: 'Dienstverlening',
            title: 'Aanvragen',
            description: 'Alle aanvragen van dit jaar.',
          },
        }),
      ),
    wide: (element) =>
      shown(element, '.lintje-page-header__description') &&
      !shown(element, '.lintje-page-header__kicker'),
    phone: (element) =>
      below(
        find(element, '.lintje-page-header__kicker'),
        find(element, '.lintje-page-header__title'),
      ) && !shown(element, '.lintje-page-header__description'),
  },
  {
    tag: 'lintje-breadcrumbs',
    marker: 'one link back to the level above replaces the trail',
    mount: () =>
      append(
        create('lintje-breadcrumbs', {
          items: [
            { label: 'Home', href: '#home' },
            { label: 'Aanvragen', href: '#aanvragen' },
            { label: 'Aanvraag 12' },
          ],
        }),
      ),
    wide: (element) =>
      all(element.shadowRoot!, '.lintje-breadcrumbs__item').filter(seen).length === 3 &&
      !shown(element, '.lintje-breadcrumbs__back'),
    phone: (element) =>
      find(element, '.lintje-breadcrumbs__back')?.textContent?.trim() === 'Aanvragen' &&
      shown(element, '.lintje-breadcrumbs__back') &&
      !shown(element, '.lintje-breadcrumbs__item'),
  },
  {
    tag: 'lintje-sub-nav',
    marker: 'a button with the current page folds the list away',
    mount: () =>
      append(
        create('lintje-sub-nav', {
          label: 'Onderdelen',
          groups: [
            {
              items: [
                { label: 'Gegevens', href: '#gegevens', active: true },
                { label: 'Documenten', href: '#documenten' },
              ],
            },
          ],
        }),
      ),
    wide: (element) =>
      shown(element, 'a[href="#documenten"]') && !shown(element, '.lintje-sub-nav__toggle'),
    phone: (element) =>
      find(element, '.lintje-sub-nav__toggle-current')?.textContent === 'Gegevens' &&
      shown(element, '.lintje-sub-nav__toggle') &&
      !shown(element, 'a[href="#documenten"]'),
  },
  {
    tag: 'lintje-notifications',
    marker: 'the open list is a sheet with its own close button',
    mount: () =>
      append(
        create('lintje-notifications', {
          open: true,
          items: [{ id: 'a', title: 'Export klaar', when: '2 minuten geleden', unread: true }],
        }),
      ),
    wide: (element) =>
      shown(element, '.lintje-notifications__panel') &&
      !shown(element, '[aria-label="Meldingen sluiten"]'),
    phone: (element) =>
      shown(element, '[role="dialog"][aria-modal="true"] .lintje-notifications__panel') &&
      shown(element, '[aria-label="Meldingen sluiten"]'),
  },
  {
    tag: 'lintje-app-search',
    marker: 'a close button beside the title replaces the key hints',
    mount: () => append(create('lintje-app-search', { open: true })),
    wide: (element) =>
      shown(element, '.lintje-app-search__keys') &&
      !shown(element, '[aria-label="Zoeken sluiten"]'),
    phone: (element) =>
      shown(element, '[aria-label="Zoeken sluiten"]') &&
      !shown(element, '.lintje-app-search__keys'),
  },
  {
    tag: 'lintje-card',
    marker: 'a card across stands upright: the picture above the text',
    mount: () =>
      append(
        create('lintje-card', {
          layout: 'horizontal',
          data: {
            id: 'k',
            title: 'Vergunningen',
            description: 'Aanvragen en besluiten per maand.',
            media: { src: PICTURE, alt: '' },
          },
        }),
      ),
    wide: (element) => {
      const media = find(element, '.lintje-card__media')
      const main = find(element, '.lintje-card__main')
      return seen(media) && level(media, main) && box(media).right <= box(main).left + 1
    },
    phone: (element) =>
      below(find(element, '.lintje-card__media'), find(element, '.lintje-card__main')),
  },
  {
    tag: 'lintje-audio-player',
    marker: 'a mute button replaces the volume slider',
    mount: () => append(create('lintje-audio-player', { name: 'Teamoverleg' })),
    wide: (element) => shown(element, '[role="slider"][aria-label="Volume"]'),
    phone: (element) =>
      shown(element, '.lintje-audio-player__start [aria-pressed]') &&
      !shown(element, '[role="slider"][aria-label="Volume"]'),
  },
  {
    tag: 'lintje-confirm-dialog',
    marker: 'the buttons stand under each other, the confirmation on top',
    mount: async () => {
      const element = create('lintje-confirm-dialog', {
        open: true,
        heading: 'Aanvraag verwijderen?',
        confirmLabel: 'Verwijderen',
      })
      element.textContent = 'De aanvraag en haar bijlagen worden verwijderd.'
      return append(element)
    },
    wide: (element) => {
      const confirm = find(element, '.lintje-confirm-dialog__confirm')
      const cancel = find(element, '.lintje-confirm-dialog__cancel')
      return seen(confirm) && level(confirm, cancel) && box(cancel).right <= box(confirm).left
    },
    phone: (element) =>
      below(
        find(element, '.lintje-confirm-dialog__confirm'),
        find(element, '.lintje-confirm-dialog__cancel'),
      ),
  },
  {
    tag: 'lintje-session-expiry',
    marker: 'the buttons stand under each other, "Aangemeld blijven" on top',
    mount: () =>
      append(
        create('lintje-session-expiry', {
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }),
      ),
    wide: (element) => {
      const stay = find(element, '.lintje-session-expiry__primary')
      const leave = find(element, '.lintje-session-expiry__logout')
      return seen(stay) && level(stay, leave) && box(leave).right <= box(stay).left
    },
    phone: (element) =>
      below(
        find(element, '.lintje-session-expiry__primary'),
        find(element, '.lintje-session-expiry__logout'),
      ),
  },
  {
    tag: 'lintje-conflict-alert',
    marker: 'the three actions stand under each other',
    mount: () => append(create('lintje-conflict-alert', { who: 'Sanne', when: '10:42' })),
    wide: (element) => {
      const [first, second] = all(
        element.shadowRoot!,
        '.lintje-conflict-alert__actions lintje-button',
      )
      return seen(first) && level(first!, second!)
    },
    phone: (element) => {
      const [first, second, third] = all(
        element.shadowRoot!,
        '.lintje-conflict-alert__actions lintje-button',
      )
      return below(first!, second!) && below(second!, third!)
    },
  },
  {
    tag: 'lintje-form-actions',
    marker: 'the buttons stand under each other, the primary one on top',
    mount: async () => {
      const element = create('lintje-form-actions')
      element.innerHTML =
        '<lintje-button variant="secondary">Annuleren</lintje-button>' +
        '<lintje-button variant="primary">Opslaan</lintje-button>'
      return append(element)
    },
    wide: (element) => {
      const [cancel, save] = element.querySelectorAll('lintje-button')
      return seen(save) && level(cancel!, save!) && box(cancel!).right <= box(save!).left
    },
    phone: (element) => {
      const [cancel, save] = element.querySelectorAll('lintje-button')
      return below(save!, cancel!)
    },
  },
  {
    tag: 'lintje-file-upload',
    marker: 'the button alone, without "of sleep ze hierheen"',
    mount: () => append(create('lintje-file-upload', { label: 'Bijlagen' })),
    wide: (element) =>
      shown(element, '.lintje-file-upload__button') && shown(element, '.lintje-file-upload__text'),
    phone: (element) =>
      shown(element, '.lintje-file-upload__button') && !shown(element, '.lintje-file-upload__text'),
  },
  {
    tag: 'lintje-form',
    marker: 'a field takes the form’s full width',
    mount: async () => {
      const element = create('lintje-form')
      element.innerHTML = '<lintje-select name="regio" label="Regio"></lintje-select>'
      element.querySelector('lintje-select')!.options = [
        { value: 'Noord', label: 'Noord' },
        { value: 'Zuid', label: 'Zuid' },
      ]
      return append(element)
    },
    wide: (element) => box(element.querySelector('lintje-select')).width < box(element).width / 2,
    phone: (element) =>
      Math.abs(box(element.querySelector('lintje-select')).width - box(element).width) < 1,
  },
  {
    tag: 'lintje-slot-picker',
    marker: 'the days stand under each other',
    mount: () =>
      append(
        create('lintje-slot-picker', {
          label: 'Kies een tijd',
          days: [
            { date: '2026-10-12', slots: [{ value: 'ma-9', label: '09:00' }] },
            { date: '2026-10-13', slots: [{ value: 'di-9', label: '09:00' }] },
          ],
        }),
      ),
    wide: (element) => {
      const [monday, tuesday] = all(element.shadowRoot!, '.lintje-slot-picker__day')
      return level(monday!, tuesday!) && beside(monday!, tuesday!)
    },
    phone: (element) => {
      const [monday, tuesday] = all(element.shadowRoot!, '.lintje-slot-picker__day')
      return below(monday!, tuesday!)
    },
  },
  {
    tag: 'lintje-translator',
    marker: 'the translation stands under the source',
    mount: () => append(create('lintje-translator', { value: 'Goedemorgen' })),
    wide: (element) => {
      const [source, target] = all(element.shadowRoot!, '.lintje-translator__half')
      return level(source!, target!) && box(source!).right <= box(target!).left + 1
    },
    phone: (element) => {
      const [source, target] = all(element.shadowRoot!, '.lintje-translator__half')
      return below(source!, target!)
    },
  },
  {
    tag: 'lintje-chat-composer',
    marker: 'an icon button sends in place of "Versturen" in words',
    mount: () => append(create('lintje-chat-composer', { text: 'Hoeveel aanvragen?' })),
    wide: (element) =>
      shown(element, '.lintje-chat-composer__send lintje-button') &&
      !shown(element, 'lintje-icon-button[label="Versturen"]'),
    phone: (element) =>
      shown(element, 'lintje-icon-button[label="Versturen"]') &&
      !shown(element, '.lintje-chat-composer__send lintje-button'),
  },
  {
    tag: 'lintje-map-tile',
    marker: 'the legend folds behind a "Legenda" button',
    mount: () => append(create('lintje-map-tile', { data: MAP })),
    wide: (element) =>
      shown(element, '.lintje-map-chart__legend-content') &&
      !shown(element, '.lintje-map-chart__legend-toggle'),
    phone: (element) =>
      shown(element, '.lintje-map-chart__legend-toggle') &&
      !shown(element, '.lintje-map-chart__legend-content'),
  },
  {
    tag: 'lintje-shell',
    marker: '"Delen" opens as a sheet along the bottom of the screen',
    mount: async () => {
      const element = await append(
        create('lintje-shell', {
          data: { name: 'Vergunningen', share: true, navigation: NAVIGATION },
        }),
      )
      find(element, '.lintje-share__button')!.click()
      return element
    },
    wide: (element) => {
      const popover = find(element, '.lintje-share__popover')
      return (
        seen(popover) &&
        below(find(element, '.lintje-share__button'), popover) &&
        box(popover).width < window.innerWidth / 2
      )
    },
    phone: (element) => {
      const sheet = box(find(element, '.lintje-share__popover'))
      return (
        Math.abs(sheet.bottom - window.innerHeight) < 1 &&
        sheet.left < 1 &&
        Math.abs(sheet.width - window.innerWidth) < 1
      )
    },
  },
  {
    tag: 'lintje-filter-bar',
    marker: 'in the shell a "Filters" button in the header takes the fields’ place',
    mount: async () => {
      const element = create('lintje-shell', {
        data: { name: 'Vergunningen', navigation: NAVIGATION },
      })
      element.append(create('lintje-filter-bar', { data: FILTERS }))
      return append(element)
    },
    wide: (element) => shown(element, 'lintje-field') && !seen(filtersButton(element)),
    phone: (element) => seen(filtersButton(element)) && !shown(element, 'lintje-field'),
  },
  {
    tag: 'lintje-grid',
    marker: 'the tiles stand under each other',
    mount: async () => {
      const element = create('lintje-grid')
      element.innerHTML = '<p span="6">Aanvragen</p><p span="6">Besluiten</p>'
      return append(element)
    },
    wide: (element) => level(element.children[0]!, element.children[1]!),
    phone: (element) => below(element.children[0]!, element.children[1]!),
  },
  {
    tag: 'lintje-tile',
    marker: 'the key figure stands above the content, not beside it',
    mount: async () => {
      const element = create('lintje-tile', { heading: 'Aanvragen' })
      element.innerHTML = '<p slot="aside">1.284</p><p>Per maand, dit jaar.</p>'
      return append(element)
    },
    wide: (element) => level(element.children[0]!, element.children[1]!),
    phone: (element) => below(element.children[0]!, element.children[1]!),
  },
  {
    tag: 'lintje-card-list',
    marker: 'the cards stand in one column',
    mount: () =>
      append(
        create('lintje-card-list', {
          label: 'Producten',
          items: ['Vergunningen', 'Subsidies', 'Toeslagen'].map((title) => ({ id: title, title })),
        }),
      ),
    wide: (element) => {
      const [first, second] = all(element.shadowRoot!, 'lintje-card')
      return seen(first) && level(first!, second!)
    },
    phone: (element) => {
      const [first, second] = all(element.shadowRoot!, 'lintje-card')
      return below(first!, second!)
    },
  },
  {
    tag: 'lintje-footer',
    marker: 'the link columns stand under each other',
    mount: () =>
      append(
        create('lintje-footer', {
          data: {
            columns: [
              { heading: 'Over ons', links: [{ label: 'Organisatie', href: '#organisatie' }] },
              { heading: 'Contact', links: [{ label: 'Bel ons', href: '#bellen' }] },
            ],
          },
        }),
      ),
    wide: (element) => {
      const [first, second] = all(element.shadowRoot!, '.lintje-footer__column')
      return seen(first) && level(first!, second!)
    },
    phone: (element) => {
      const [first, second] = all(element.shadowRoot!, '.lintje-footer__column')
      return below(first!, second!)
    },
  },
  {
    tag: 'lintje-description-list',
    marker: 'the label stands above its value',
    mount: () =>
      append(
        create('lintje-description-list', {
          items: [{ label: 'Aanvrager', value: 'J. de Vries' }],
        }),
      ),
    wide: (element) =>
      level(
        find(element, '.lintje-description-list__label'),
        find(element, '.lintje-description-list__value'),
      ),
    phone: (element) =>
      below(
        find(element, '.lintje-description-list__label'),
        find(element, '.lintje-description-list__value'),
      ),
  },
  {
    tag: 'lintje-explainer',
    marker: 'the term stands above its description',
    mount: () =>
      append(
        create('lintje-explainer', {
          data: {
            title: 'Hoe deze cijfers worden berekend',
            items: [{ term: 'Doorlooptijd', description: 'Dagen van ontvangst tot besluit.' }],
          },
        }),
      ),
    wide: (element) =>
      level(
        find(element, '.lintje-explainer__term'),
        find(element, '.lintje-explainer__description'),
      ),
    phone: (element) =>
      below(
        find(element, '.lintje-explainer__term'),
        find(element, '.lintje-explainer__description'),
      ),
  },
  {
    tag: 'lintje-pagination',
    marker: '"Pagina 3 van 10" in place of the page numbers',
    mount: () => append(create('lintje-pagination', { page: 3, pageCount: 10 })),
    wide: (element) =>
      shown(element, '[aria-current="page"]') && !shown(element, '.lintje-pagination__where'),
    phone: (element) =>
      find(element, '.lintje-pagination__where')?.textContent === 'Pagina 3 van 10' &&
      shown(element, '.lintje-pagination__where') &&
      !shown(element, '[aria-current="page"]'),
  },
  {
    tag: 'lintje-drawer',
    marker: 'the panel covers the whole screen',
    mount: async () => {
      const element = create('lintje-drawer', { open: true, heading: 'Aanvraag' })
      element.innerHTML = '<p>Aanvraag 12, ontvangen op 3 maart.</p>'
      return append(element)
    },
    wide: (element) => {
      const panel = box(find(element, '.lintje-drawer'))
      return panel.width < window.innerWidth / 2 && Math.abs(panel.right - window.innerWidth) < 1
    },
    phone: (element) => {
      const panel = box(find(element, '.lintje-drawer'))
      return panel.left < 1 && Math.abs(panel.width - window.innerWidth) < 1
    },
  },
  {
    tag: 'lintje-modal',
    marker: 'the dialog fills the screen',
    mount: async () => {
      const element = create('lintje-modal', { open: true, heading: 'Aanvragen per maand' })
      element.innerHTML = '<p>De grafiek, vergroot.</p>'
      return append(element)
    },
    wide: (element) => box(find(element, '.lintje-modal')).height < window.innerHeight - 1,
    phone: (element) => {
      const dialog = box(find(element, '.lintje-modal'))
      return (
        Math.abs(dialog.height - window.innerHeight) < 1 &&
        Math.abs(dialog.width - window.innerWidth) < 1
      )
    },
  },
  {
    tag: 'lintje-toast',
    marker: 'the toast spans the screen’s width',
    mount: async () => {
      const element = create('lintje-toast', { kind: 'error' })
      element.textContent = 'Opslaan is mislukt.'
      return append(element)
    },
    wide: (element) => box(find(element, '.lintje-toast')).width < window.innerWidth / 2,
    phone: (element) => box(find(element, '.lintje-toast')).width > window.innerWidth * 0.9,
  },
  {
    tag: 'lintje-empty-state',
    marker: 'the action takes the full width',
    mount: async () => {
      const element = create('lintje-empty-state', {
        heading: 'Nog geen aanvragen',
        text: 'Een nieuwe aanvraag verschijnt hier.',
      })
      element.innerHTML = '<lintje-button variant="primary" block>Aanvraag starten</lintje-button>'
      return append(element)
    },
    // A `block` button is as wide as the action lets it be.
    wide: (element) => box(element.querySelector('lintje-button')).width < box(element).width / 2,
    phone: (element) =>
      box(element.querySelector('lintje-button')).width > box(element).width * 0.8,
  },
  {
    tag: 'lintje-document-viewer',
    marker: 'the name takes a line of its own above the controls',
    mount: () =>
      append(create('lintje-document-viewer', { name: 'Besluit.pdf', pages: [PICTURE, PICTURE] })),
    wide: (element) => {
      const name = find(element, '.lintje-document-viewer__name')
      return seen(name) && beside(name, name!.nextElementSibling)
    },
    phone: (element) => {
      const name = find(element, '.lintje-document-viewer__name')
      return below(name, name!.nextElementSibling)
    },
  },
  {
    tag: 'lintje-text-editor',
    marker: 'the toolbar keeps one line that scrolls instead of wrapping',
    mount: async () => {
      const element = create('lintje-text-editor', { label: 'Toelichting' })
      element.style.width = '200px'
      return append(element)
    },
    wide: (element) => {
      const tools = all(element.shadowRoot!, '.lintje-text-editor__tool')
      return !level(tools[0]!, tools.at(-1)!)
    },
    phone: (element) => {
      const tools = all(element.shadowRoot!, '.lintje-text-editor__tool')
      const bar = find(element, '.lintje-text-editor__toolbar')!
      return level(tools[0]!, tools.at(-1)!) && bar.scrollWidth > bar.clientWidth
    },
  },
  {
    tag: 'lintje-repeater',
    marker: 'the fields of a row stand under each other',
    mount: async () => {
      const element = create('lintje-repeater', { label: 'Contactpersoon' })
      element.innerHTML =
        '<lintje-repeater-row><lintje-text-input name="naam" label="Naam"></lintje-text-input>' +
        '<lintje-text-input name="telefoon" label="Telefoon"></lintje-text-input></lintje-repeater-row>'
      return append(element)
    },
    wide: (element) => {
      const [name, phone] = element.querySelectorAll('lintje-text-input')
      return seen(name) && level(name!, phone!)
    },
    phone: (element) => {
      const [name, phone] = element.querySelectorAll('lintje-text-input')
      return below(name!, phone!)
    },
  },
  {
    tag: 'lintje-chat-message',
    marker: 'the time stands under the question',
    mount: () =>
      append(
        create('lintje-chat-message', { text: 'Hoeveel aanvragen kwamen binnen?', time: '08:20' }),
      ),
    // The time stands left of the bar: the order is reversed, so the question is read first.
    wide: (element) =>
      beside(
        find(element, '.lintje-chat-message__meta'),
        find(element, '.lintje-chat-message__text'),
      ),
    phone: (element) =>
      below(
        find(element, '.lintje-chat-message__text'),
        find(element, '.lintje-chat-message__meta'),
      ),
  },
  {
    tag: 'lintje-chat-strip',
    marker: 'the "Berekening" toggle takes a row of its own under the values',
    mount: () =>
      append(
        create('lintje-chat-strip', {
          items: [
            { key: 'periode', label: 'Periode', value: 'Deze maand' },
            { key: 'regio', label: 'Regio', value: 'Noord' },
          ],
          details: [{ term: 'Aanvragen', description: 'Ontvangen, niet ingetrokken.' }],
        }),
      ),
    wide: (element) =>
      beside(
        find(element, '.lintje-chat-strip__items'),
        find(element, '.lintje-chat-strip__toggle'),
      ),
    phone: (element) =>
      below(
        find(element, '.lintje-chat-strip__items'),
        find(element, '.lintje-chat-strip__toggle'),
      ),
  },
  {
    tag: 'lintje-chat-answer',
    marker: 'two half-width blocks stand under each other',
    mount: () =>
      append(
        create('lintje-chat-answer', {
          state: 'ready',
          blocks: [
            { kind: 'chart-tile', data: { ...HEATMAP, span: 6 } },
            { kind: 'chart-tile', data: { ...HEATMAP, title: 'Drukte vorige week', span: 6 } },
          ],
        }),
      ),
    wide: (element) => {
      const [first, second] = all(element.shadowRoot!, 'lintje-chart-tile')
      return seen(first) && level(first!, second!)
    },
    phone: (element) => {
      const [first, second] = all(element.shadowRoot!, 'lintje-chart-tile')
      return below(first!, second!)
    },
  },
  {
    tag: 'lintje-chat',
    marker: 'the question scrolls away with its answer instead of sticking',
    mount: async () => {
      const element = await append(create('lintje-chat', { data: CHAT }))
      document.body.append(spacer())
      return element
    },
    wide: (element) => {
      const question = scrolledPast(element)
      return box(question).top >= 0 && box(question).bottom > 0
    },
    phone: (element) => box(scrolledPast(element)).bottom <= 0,
  },
  subtitleRow('lintje-chart-tile', HEATMAP),
  subtitleRow('lintje-map-tile', MAP),
  subtitleRow('lintje-data-table', TABLE),
]

/* The contract ------------------------------------------------------------ */

const nameOf = (row: Row): string => `${row.tag} :: ${row.marker}`

beforeAll(() => {
  document.documentElement.lang = 'nl'
  document.body.style.margin = '0'
})

// WebKit keeps the media queries of a sheet that no connected element adopts as they were, so
// every resize happens with the element in place.
afterEach(async () => {
  await viewport(1440, 900)
  document.body.replaceChildren()
  document.body.removeAttribute('style')
  document.body.style.margin = '0'
  document.documentElement.removeAttribute('style')
  window.scrollTo(0, 0)
})

describe('the view below 768 px', () => {
  for (const row of ROWS) {
    const name = nameOf(row)
    it(name, async () => {
      const known = KNOWN.find((entry) => entry.test(name))
      try {
        const element = await row.mount()
        await expect
          .poll(() => row.wide(element), { message: 'the wide view at 1440 px' })
          .toBe(true)
        expect(row.phone(element), 'no phone view at 1440 px').toBe(false)

        await viewport(390, 844)
        await expect
          .poll(() => row.phone(element), { message: 'the phone view at 390 px' })
          .toBe(true)
        await expect
          .poll(() => row.wide(element), { message: 'no wide view at 390 px' })
          .toBe(false)

        await viewport(1440, 900)
        await expect
          .poll(() => row.wide(element), { message: 'the wide view again at 1440 px' })
          .toBe(true)
        await expect
          .poll(() => row.phone(element), { message: 'no phone view again at 1440 px' })
          .toBe(false)
      } catch (error) {
        if (known) return
        throw error
      }
      if (known) expect.fail(`passes: take ${known} out of KNOWN and docs/OPEN_ISSUES.md`)
    })
  }

  it('has no KNOWN entry that matches no row', () => {
    const names = ROWS.map(nameOf)
    const stale = KNOWN.filter((entry) => !names.some((name) => entry.test(name))).map(String)
    expect(stale, `matches no row, so take out of KNOWN:\n${stale.join('\n')}`).toHaveLength(0)
  })
})
