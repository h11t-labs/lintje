/**
 * `<lintje-data-table>` — the data table, inside a tile; below 768 px a two-column list.
 *
 * A missing value is a muted dash, never 0. The table never filters, saves or confirms: it shows a
 * change at once, and the host confirms it in the next `data`. Open rows and collapsed groups are
 * the table's own: it sends nothing for them.
 *
 * Events: `lintje-sort-change` `{ key, direction } | null`, `lintje-row-click`
 * `{ id, label, href? }`, `lintje-row-open` `{ id, label, href? }`, `lintje-checked-change`
 * `string[]`, `lintje-cell-edit` `{ id, column, value }`, `lintje-row-action` `{ id, action }`,
 * `lintje-bulk-action` `{ ids, action }`, `lintje-filter-change` `{ column, value }`,
 * `lintje-columns-change` `{ order, hidden }`.
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { ref } from 'lit/directives/ref.js'
import { define, type FrameSettings } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { spanStyles } from '../../shared/grid-item-element'
import { LintjeContentTileElement } from '../../shared/content-tile'
import { formatNumber, formatPercent } from '../../../core/format'
import { renderChartSkeleton } from '../../shared/charts/shared/chart-states'
import { chartFrameStyles } from '../../shared/charts/shared/chart-styles'
import { downloadCsv } from '../../shared/download'
import { MediaController } from '../../../core/media'
import tileHostCss from '../../shared/view-tile.css?inline'
import inputCss from '../../inputs/shared/input.css?inline'
import dataTableCss from './data-table.css?inline'
import skeletonCss from '../../feedback/skeleton/skeleton.css?inline'
import buttonCss from '../../actions/button/button.css?inline'
import { badgeStyles, renderBadge } from '../../feedback/badge/badge'
import '../../feedback/announcement/announcement'
import '../../feedback/empty-state/empty-state'
import '../description-list/description-list'
import '../../actions/menu-button/menu-button'
import '../pagination/pagination'
import { iconStyles, renderIcon } from '../../../icons/render'
import '../../feedback/status-dot/status-dot'
import '../../feedback/skeleton/skeleton'
import '../../layout/tile/tile'
import type { SortableItem } from '../sortable-list/sortable-list'
import type {
  CellValue,
  DataTableData,
  SortState,
  StatusTone,
  TableColumnData,
  TableDetailField,
  TableTotal,
} from '../../../types'
import { CellEditing, cellKey, type EditGrid } from './editing'
import { parseDate } from '../../shared/date-format'
import { focusTarget, tabbables } from '../../shared/focus-trap'
import { deepActiveElement, holdsFocus } from '../../../core/focus'
import type { DescriptionItem } from '../description-list/description-list'
import type { MenuEntry } from '../../actions/menu-button/menu-button'
import { titleWhenCut } from '../../shared/cut-text'
import { rangeIds, renderRowActions, renderSelectionBar, withRange } from './actions'
import {
  columnsChange,
  filterOut,
  isFilterActive,
  renderChooserButton,
  renderColumnChooser,
  renderFilterPopover,
  renderFiltersSheet,
  renderFunnel,
  renderToolbar,
  shownColumns,
  type FilterValue,
  type PanelLeave,
} from './filters'

type Row = Record<string, CellValue>

type Panel =
  | { kind: 'filter'; column: string; edges: ScrollEdges }
  | { kind: 'columns'; edges: ScrollEdges }
  | { kind: 'sheet'; edges: ScrollEdges }

const MOBILE_PAGE_SIZE = 5
const GROUPS_PER_PAGE = 5

/** One group of `groupBy`: its raw value as a key, and its rows in the sorted order. */
type Group = { key: string; value: CellValue; rows: Row[] }

const BODY_ROWS =
  ':scope > tbody > .lintje-data-table__row:not(.lintje-data-table__row--filler), :scope > tbody > .lintje-data-table__mobile-row:not(.lintje-data-table__mobile-row--filler)'

/** Where the focus stood before an update: in the selection bar, or at a stop in a body row. */
type FocusSeen = { scope: Element; table: Element | null; row: number; stop: number }

/** The box that scrolls `element`'s sticky children: the nearest scroller up the flat tree. */
function scrollerAround(element: Element): Element | null {
  for (let at: Node | null = element; at;) {
    const up: Node | null =
      (at instanceof Element ? at.assignedSlot : null) ??
      at.parentNode ??
      (at instanceof ShadowRoot ? at.host : null)
    if (up instanceof Element && up !== document.documentElement && up !== document.body) {
      if (/auto|scroll|hidden/.test(getComputedStyle(up).overflowY)) return up
    }
    at = up
  }
  return document.scrollingElement
}

const NUMERIC_FORMATS = new Set(['number', 'percent', 'decimal', 'change', 'change-compact'])
const STATUS_TONES = new Set<string>(['complete', 'delayed', 'outage', 'no-data'])

function isNumeric(column: TableColumnData, rows: Row[]): boolean {
  if (column.format) return NUMERIC_FORMATS.has(column.format)
  return typeof rows.find((row) => row[column.key] != null)?.[column.key] === 'number'
}

function formatText(column: TableColumnData, value: CellValue): string | null {
  if (value == null) return null
  if (column.format === 'label') return column.labels?.[String(value)]?.label ?? String(value)
  let text: string
  if (typeof value === 'string' || column.format === 'text') text = String(value)
  else if (column.format === 'change' || column.format === 'change-compact') {
    // Both read the same words; `change-compact` only draws less of them.
    const glyph = value > 0 ? '▲' : value < 0 ? '▼' : '●'
    text = `${glyph} ${value > 0 ? '+' : ''}${formatNumber(value, column.decimals ?? 0)}%`
  } else if (column.format === 'percent') text = formatPercent(value, column.decimals ?? 0)
  else if (column.format === 'decimal') text = formatNumber(value, column.decimals ?? 1)
  else text = formatNumber(value, column.decimals ?? 0)
  return column.unit ? `${text} ${column.unit}` : text
}

function thresholdStatus(column: TableColumnData, value: CellValue) {
  const threshold = column.threshold
  if (!threshold || typeof value !== 'number') return null
  const belowIsBad = threshold.direction === 'below-is-bad'
  const outside = belowIsBad ? value < threshold.value : value > threshold.value
  const caution =
    !outside &&
    threshold.caution != null &&
    (belowIsBad ? value <= threshold.caution : value >= threshold.caution)
  return {
    outside,
    tone: outside
      ? ('above-threshold' as const)
      : caution
        ? ('caution' as const)
        : ('good' as const),
    label: outside
      ? belowIsBad
        ? 'onder norm'
        : 'boven norm'
      : caution
        ? 'dicht bij norm'
        : 'binnen norm',
  }
}

/** A cell as words, for the phone's list of the other columns; `null` is missing. */
function cellText(column: TableColumnData, value: CellValue): string | null {
  if (value === 0 && column.zeroText != null) return column.zeroText
  if (column.format === 'status' && value != null) {
    return column.status?.labels?.[String(value)] ?? String(value)
  }
  const text = formatText(column, value)
  const status = text == null ? null : thresholdStatus(column, value)
  return status ? `${text} · ${status.label}` : text
}

function statusTone(column: TableColumnData, value: string): StatusTone | null {
  const tone = column.status?.tones?.[value] ?? value
  return STATUS_TONES.has(tone) ? (tone as StatusTone) : null
}

/**
 * The sort arrows, one above the other in a box of their own: sorted, the other arrow is hidden
 * but keeps its place, so a column never changes width when it is sorted.
 */
function sortIcon(direction: SortState['direction'] | null): TemplateResult {
  return html`<span class="lintje-data-table__sort-icon" aria-hidden="true"
    ><span class=${classMap({ 'lintje-data-table__sort-up': true, 'is-on': direction === 'asc', 'is-off': direction === 'desc' })}>▲</span
    ><span class=${classMap({ 'lintje-data-table__sort-down': true, 'is-on': direction === 'desc', 'is-off': direction === 'asc' })}>▼</span
  ></span>`
}

const rowCount = (count: number): string => `${count} ${count === 1 ? 'rij' : 'rijen'}`

/** A total as its value and the word that says how it was made. */
function totalParts(total: TableTotal | undefined): { value: CellValue; how?: string } {
  if (total != null && typeof total === 'object') return total
  return { value: total ?? null }
}

/** A detail field drawn as a column, so it formats like one. */
function fieldColumn(field: TableDetailField): TableColumnData {
  return {
    key: field.key,
    header: field.label,
    format: field.format,
    decimals: field.decimals,
    unit: field.unit,
  }
}

const missing = html`<span aria-hidden="true" class="lintje-data-table__muted">—</span
  ><span class="visually-hidden">geen gegevens</span>`

/**
 * Which sides of a horizontal scroller hide columns. One per table on screen (tile and modal): a
 * single `ref` would flip between the two elements and watch neither.
 */
class ScrollEdges {
  start = false
  end = false

  #element: HTMLElement | null = null
  #resize: ResizeObserver | null = null
  readonly #notify: () => void

  constructor(notify: () => void) {
    this.#notify = notify
  }

  readonly measure = (): void => {
    const element = this.#element
    if (!element) return
    const start = element.scrollLeft > 0
    const end = element.scrollLeft + element.clientWidth < element.scrollWidth - 1
    if (this.start === start && this.end === end) return
    this.start = start
    this.end = end
    this.#notify()
  }

  /** A bound property, so lit keeps the `ref` callback. */
  readonly watch = (element: Element | undefined): void => {
    if (element === this.#element) return
    this.disconnect()
    if (!(element instanceof HTMLElement)) return
    this.#element = element
    this.measure()
    element.addEventListener('scroll', this.measure, { passive: true })
    this.#resize = new ResizeObserver(this.measure)
    this.#resize.observe(element)
    if (element.firstElementChild) this.#resize.observe(element.firstElementChild)
  }

  disconnect(): void {
    this.#element?.removeEventListener('scroll', this.measure)
    this.#resize?.disconnect()
    this.#element = null
    this.#resize = null
  }
}

export class LintjeDataTable extends LintjeContentTileElement {
  static override styles = [
    iconStyles,
    badgeStyles,
    spanStyles,
    shadowCss(buttonCss),
    shadowCss(tileHostCss),
    shadowCss(skeletonCss),
    shadowCss(inputCss),
    // The states are the charts' states: they need its shimmer keyframes and `visually-hidden`.
    chartFrameStyles,
    shadowCss(dataTableCss),
  ]

  static override properties: PropertyDeclarations = {
    data: { attribute: false },
    bare: { type: Boolean },
    plain: { type: Boolean, reflect: true },
    sort: { state: true },
    checkedIds: { state: true },
    page: { state: true },
    mobilePage: { state: true },
    filterValues: { state: true },
    filterDraft: { state: true },
    columnOrder: { state: true },
    hiddenKeys: { state: true },
    panel: { state: true },
    openRows: { state: true },
    collapsedGroups: { state: true },
    liveMessage: { state: true },
  }

  declare data?: DataTableData | null

  /** The table alone, for a component that already stands in a tile. */
  bare: boolean = false
  /**
   * On an application page: no tile, so no title or tile buttons, but with its states; the page's
   * heading names it.
   */
  plain: boolean = false

  /** The sort and checked rows are shown before the host confirms them. */
  sort: SortState | null = null
  checkedIds: string[] = []
  page: number = 0
  /** Each representation pages on its own. */
  mobilePage: number = 0

  readonly #mobile = new MediaController(this)
  readonly #edges = new ScrollEdges(() => this.requestUpdate())
  readonly #modalEdges = new ScrollEdges(() => this.requestUpdate())
  #sortSeen = JSON.stringify(null)
  #checkedSeen = JSON.stringify([])

  filterValues: Record<string, FilterValue> = {}
  /** What the open filter holds before "Toepassen". */
  filterDraft: Record<string, FilterValue> = {}
  columnOrder: string[] | null = null
  hiddenKeys: string[] = []
  panel: Panel | null = null
  /** The rows whose detail is open: on the phone the same list, so turning the screen keeps them. */
  openRows: string[] = []
  /** The groups of `groupBy` that stand collapsed, by their value. */
  collapsedGroups: string[] = []
  /** What the table's status region says: a sort, a page, a selection, a filter's result. */
  liveMessage: string = ''
  #liveFrame = 0
  /** A filter went to the host; its answer's row count is read out. */
  #filterAsked = false

  readonly #editing = new CellEditing({
    requestUpdate: () => this.requestUpdate(),
    editCell: (detail) => this.emit('lintje-cell-edit', detail),
  })
  #filtersSeen = JSON.stringify({})
  #columnsSeen = ''
  #anchor: HTMLElement | null = null
  /** Where a Shift+click range starts. */
  #rangeAnchor: string | null = null
  #shift = false
  /** Rebuilt only when the columns change: a new array resets the list. */
  #chooserItems: { seen: string; items: SortableItem[] } = { seen: '', items: [] }
  #focusSeen: FocusSeen | null = null
  /** The sizer row's values, for the data they were found in. */
  #widest: { data: unknown; key: string; row: Row } | null = null
  #barFrame = 0

  // On the shadow root: a move between two of its controls reaches the host as no `focusin`.
  protected override createRenderRoot(): HTMLElement | DocumentFragment {
    const root = super.createRenderRoot()
    root.addEventListener('focusin', this.#onFocusIn)
    return root
  }

  protected override get dataSettings(): FrameSettings | undefined {
    return this.data ?? undefined
  }

  override disconnectedCallback(): void {
    cancelAnimationFrame(this.#liveFrame)
    this.#liveFrame = 0
    cancelAnimationFrame(this.#barFrame)
    this.#barFrame = 0
    this.#edges.disconnect()
    this.#modalEdges.disconnect()
    super.disconnectedCallback()
  }

  protected override expandChanged(open: boolean): void {
    if (!open) this.#modalEdges.disconnect()
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (changed.has('data') || changed.has('checkedIds')) this.#noteFocus()
    if (!changed.has('data')) return
    // The host wins only where it says something new: a `data` that changed for another reason
    // must not wipe the reader's sort, so compare values, not objects.
    const sort = JSON.stringify(this.data?.sort ?? null)
    if (sort !== this.#sortSeen) {
      this.#sortSeen = sort
      this.sort = this.data?.sort ?? null
    }
    const checked = JSON.stringify(this.data?.checkedIds ?? [])
    if (checked !== this.#checkedSeen) {
      this.#checkedSeen = checked
      this.checkedIds = this.data?.checkedIds ?? []
    }
    const filters = JSON.stringify(this.data?.filters ?? {})
    if (filters !== this.#filtersSeen) {
      this.#filtersSeen = filters
      this.filterValues = { ...this.data?.filters }
    }
    const columns = JSON.stringify([
      this.data?.columns.map((column) => column.key) ?? [],
      this.data?.hiddenColumns ?? [],
    ])
    if (columns !== this.#columnsSeen) {
      this.#columnsSeen = columns
      this.columnOrder = null
      this.hiddenKeys = this.data?.hiddenColumns ?? []
    }
    this.#editing.sync(this.data)
    if (this.#filterAsked) {
      this.#filterAsked = false
      const total = this.data?.totalRows
      this.announce(
        total == null ? rowCount(this.rows.length) : `${this.rows.length} van ${rowCount(total)}`,
      )
    }
    // Fewer rows than before: a page past the last would show nothing.
    const grouped = this.grouped
    const count = grouped ? this.groupsOf(this.rows).length : this.rows.length
    const last = (size: number): number => Math.max(0, Math.ceil(count / size) - 1)
    this.page = Math.min(
      this.page,
      last(grouped ? this.groupsPerPage : (this.data?.pageSize ?? 25)),
    )
    this.mobilePage = Math.min(
      this.mobilePage,
      last(grouped ? this.groupsPerPage : MOBILE_PAGE_SIZE),
    )
    // A row that left the data is no longer open.
    const keys = new Set(this.rows.map((row) => this.rowKey(row)))
    if (this.openRows.some((id) => !keys.has(id))) {
      this.openRows = this.openRows.filter((id) => keys.has(id))
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    this.#editing.restoreFocus(this.renderRoot)
    this.#keepFocus()
  }

  /** Before the host's answer redraws the table: where the focus stands, if in a bar or a row. */
  #noteFocus(): void {
    this.#focusSeen = null
    if (!holdsFocus(this)) return
    const scope = [...this.renderRoot.querySelectorAll('.lintje-data-table')].find(holdsFocus)
    if (!scope) return
    const bar = scope.querySelector(':scope > .lintje-data-table__selection')
    if (bar && holdsFocus(bar)) {
      this.#focusSeen = { scope, table: null, row: -1, stop: 0 }
      return
    }
    const table = [...scope.querySelectorAll('table')].find(holdsFocus)
    const rows = table ? [...table.querySelectorAll(BODY_ROWS)] : []
    const row = rows.findIndex(holdsFocus)
    if (!table || row === -1) return
    const stop = tabbables(rows[row] as Element).findIndex(holdsFocus)
    this.#focusSeen = { scope, table, row, stop: Math.max(0, stop) }
  }

  /**
   * The host's answer took the focused control away: a cleared selection its bar, a row action
   * its row. The focus goes to "Alles selecteren", or to the same control in the row now at that
   * place, else in the row before.
   */
  #keepFocus(): void {
    const seen = this.#focusSeen
    this.#focusSeen = null
    if (!seen?.scope.isConnected) return
    const now = deepActiveElement()
    if (now && now !== document.body) return
    const table = this.#mobile.matches ? '.lintje-data-table__mobile' : '.lintje-data-table__full'
    const all = seen.scope.querySelector<HTMLElement>(`${table} thead .lintje-choice__input`)
    let target: HTMLElement | undefined
    if (seen.table?.isConnected) {
      const rows = [...seen.table.querySelectorAll(BODY_ROWS)]
      const row = rows[Math.min(seen.row, rows.length - 1)]
      const stops = row ? tabbables(row) : []
      target = stops[Math.min(seen.stop, stops.length - 1)]
    }
    ;(target ?? all ?? tabbables(seen.scope)[0])?.focus()
  }

  /**
   * The sticky selection bar is not in the scroller's `scroll-padding`: a control the focus
   * scrolls to under it is scrolled clear of it, before the frame is drawn (WCAG 2.4.11).
   */
  readonly #onFocusIn = (): void => {
    cancelAnimationFrame(this.#barFrame)
    this.#barFrame = requestAnimationFrame(() => {
      this.#barFrame = 0
      this.#clearOfBar()
    })
  }

  #clearOfBar(): void {
    // The focused element as this root sees it: a nested control's host.
    let focused: Element | null = deepActiveElement()
    while (focused && focused.getRootNode() !== this.renderRoot) {
      focused = (focused.getRootNode() as Partial<ShadowRoot>).host ?? null
    }
    if (!focused) return
    for (const bar of this.renderRoot.querySelectorAll('.lintje-data-table__selection')) {
      if (!bar.parentElement?.contains(focused) || bar.contains(focused)) continue
      // The whole cell, not only its control: a checkbox's own box is the size of nothing.
      const room = bar.getBoundingClientRect()
      const box = (focused.closest('td, th') ?? focused).getBoundingClientRect()
      if (box.bottom <= room.top || box.top >= room.bottom) return
      const below = bar.classList.contains('lintje-data-table__selection--mobile')
      scrollerAround(bar)?.scrollBy({
        top: below ? box.bottom - room.top : box.top - room.bottom,
        behavior: 'instant',
      })
      return
    }
  }

  /* The data --------------------------------------------------------------- */

  private get columns(): TableColumnData[] {
    const columns = this.data?.columns ?? []
    const [name, ...rest] = columns
    // A name that opens its row is not also edited in its cell.
    if (!this.data?.openable || !name?.editor) return columns
    return [{ ...name, editor: undefined }, ...rest]
  }

  private get rows(): Row[] {
    return this.data?.rows ?? []
  }

  /* Groups ------------------------------------------------------------------ */

  /** The column `groupBy` names; it heads its groups and is not a column of its own. */
  private get groupColumn(): TableColumnData | undefined {
    const key = this.data?.groupBy
    return key ? this.columns.find((column) => column.key === key) : undefined
  }

  private get grouped(): boolean {
    return Boolean(this.groupColumn)
  }

  private get groupsPerPage(): number {
    return this.data?.groupsPerPage ?? GROUPS_PER_PAGE
  }

  /**
   * `rows` in groups: the groups in the order they first occur in the host's rows, each group's
   * rows in the order of `rows` as given (already sorted).
   */
  private groupsOf(rows: Row[]): Group[] {
    const column = this.groupColumn
    if (!column) return []
    const groups = new Map<string, Group>()
    for (const row of this.rows) {
      const value = row[column.key] ?? null
      const key = String(value)
      if (!groups.has(key)) groups.set(key, { key, value, rows: [] })
    }
    for (const row of rows) groups.get(String(row[column.key] ?? null))?.rows.push(row)
    return [...groups.values()]
  }

  private toggleGroup(key: string): void {
    this.collapsedGroups = this.collapsedGroups.includes(key)
      ? this.collapsedGroups.filter((entry) => entry !== key)
      : [...this.collapsedGroups, key]
  }

  /* A row's detail --------------------------------------------------------- */

  /**
   * What a row's detail lists: the columns the chooser hides, then `detailFields`. Empty: rows
   * have no detail on desktop.
   */
  private get detailColumns(): TableColumnData[] {
    const shown = new Set(this.shown)
    const group = this.groupColumn
    const hidden = this.columns.filter((column) => !shown.has(column) && column !== group)
    return [...hidden, ...(this.data?.detailFields ?? []).map(fieldColumn)]
  }

  private toggleRow(id: string): void {
    this.openRows = this.openRows.includes(id)
      ? this.openRows.filter((entry) => entry !== id)
      : [...this.openRows, id]
  }

  private rowKey(row: Row): string {
    return String(row[this.data?.rowKey ?? 'id'])
  }

  /** The row's key, the name in its first column and the `href` the host minted on the row. */
  private rowDetail(row: Row): { id: string; label: string; href?: string } {
    const id = this.rowKey(row)
    const nameColumn = this.columns[0]
    const name = nameColumn ? row[nameColumn.key] : null
    const href = row.href
    return {
      id,
      label: name == null ? id : String(name),
      href: typeof href === 'string' && href !== '' ? href : undefined,
    }
  }

  private get initialSort(): SortState {
    return this.data?.defaultSort ?? { key: this.columns[0]?.key ?? '', direction: 'asc' }
  }

  private get activeSort(): SortState {
    return this.sort ?? this.initialSort
  }

  /** Missing sorts lowest. */
  private sortValue(column: TableColumnData, row: Row): number | string {
    const value = row[column.key]
    // A label sorts by the word a reader sees, not by the host's code.
    if (column.format === 'label' && value != null) return formatText(column, value) ?? ''
    // A date column holds `dd-mm-jjjj`, which sorts by day as text; its ISO form sorts by date.
    if (column.editor?.kind === 'date') {
      const parsed = parseDate(String(value ?? ''))
      return parsed.kind === 'ok' ? parsed.iso : ''
    }
    return value ?? (isNumeric(column, this.rows) ? Number.NEGATIVE_INFINITY : '')
  }

  private get sortedRows(): Row[] {
    const sort = this.activeSort
    const column = this.columns.find((candidate) => candidate.key === sort.key)
    if (!column) return this.rows
    const copy = [...this.rows]
    copy.sort((a, b) => {
      const valueA = this.sortValue(column, a)
      const valueB = this.sortValue(column, b)
      const order =
        typeof valueA === 'number' && typeof valueB === 'number'
          ? valueA - valueB
          : String(valueA).localeCompare(String(valueB), 'nl')
      return sort.direction === 'asc' ? order : -order
    })
    return copy
  }

  private toggleSort(column: TableColumnData): void {
    if (column.sortable === false) return
    const sort = this.activeSort
    let next: SortState
    if (sort.key !== column.key) {
      // First click: descending for numbers, ascending for text.
      const first = this.rows[0]
      const numeric = first != null && typeof this.sortValue(column, first) === 'number'
      next = { key: column.key, direction: numeric ? 'desc' : 'asc' }
    } else {
      next = { key: column.key, direction: sort.direction === 'asc' ? 'desc' : 'asc' }
    }
    this.setSort(next)
  }

  private setSort(next: SortState): void {
    // The default order stays out of the URL.
    const initial = this.initialSort
    const isDefault = next.key === initial.key && next.direction === initial.direction
    this.sort = isDefault ? null : next
    this.page = 0
    this.mobilePage = 0
    this.emit('lintje-sort-change', this.sort)
    const column = this.columns.find((candidate) => candidate.key === next.key)
    if (column) {
      const order = next.direction === 'asc' ? 'oplopend' : 'aflopend'
      this.announce(`Gesorteerd op ${column.header.toLocaleLowerCase('nl')}, ${order}.`)
    }
  }

  /** Empties the region and fills it a frame later, so the same words are read again. */
  private announce(message: string): void {
    this.liveMessage = ''
    cancelAnimationFrame(this.#liveFrame)
    this.#liveFrame = requestAnimationFrame(() => {
      this.#liveFrame = 0
      this.liveMessage = message
    })
  }

  private setChecked(ids: string[]): void {
    this.checkedIds = ids
    this.emit('lintje-checked-change', ids)
    if (this.data?.bulkActions) {
      this.announce(ids.length > 0 ? `${ids.length} geselecteerd` : 'Selectie opgeheven')
    }
  }

  /* The extensions' state ----------------------------------------------------- */

  private get shown(): TableColumnData[] {
    const group = this.groupColumn
    const columns =
      !this.data?.columnChooser && this.hiddenKeys.length === 0
        ? this.columns
        : shownColumns(this.columns, this.columnOrder, this.hiddenKeys)
    return group ? columns.filter((column) => column !== group) : columns
  }

  private get filterColumns(): TableColumnData[] {
    return this.columns.filter((column) => column.filter)
  }

  private get uncheckable(): Set<string> {
    return new Set(this.data?.uncheckableIds ?? [])
  }

  private openPanel(panel: Panel, anchor: HTMLElement | null): void {
    this.#anchor = anchor
    this.filterDraft =
      panel.kind === 'filter'
        ? { [panel.column]: this.filterValues[panel.column] ?? [] }
        : { ...this.filterValues }
    this.panel = panel
    if (panel.kind !== 'sheet') void this.focusPanel(panel)
  }

  /** A column panel is a dialog: the focus goes to its first field, else its first control. */
  private async focusPanel(panel: Panel): Promise<void> {
    await this.updateComplete
    const popover = this.#anchor?.closest('.lintje-data-table')?.querySelector('lintje-popover')
    if (this.panel !== panel || !popover) return
    const parts = [popover, ...popover.querySelectorAll('*')] as { updateComplete?: unknown }[]
    await Promise.all(parts.map((part) => part.updateComplete))
    if (this.panel === panel) tabbables(popover)[0]?.focus()
  }

  /** With `which`, only when that panel is still the open one; `refocus` false leaves the focus. */
  private closePanel(which?: Panel, refocus: boolean = true): void {
    if (which && this.panel !== which) return
    const anchor = this.#anchor
    this.panel = null
    this.#anchor = null
    if (anchor && refocus) focusTarget(anchor).focus()
  }

  /**
   * Tab past the panel's first stop is its anchor, past its last the stop after the anchor. False
   * when nothing in the table follows the anchor: the browser's Tab goes on past the table, and
   * the focus leaving closes the panel.
   */
  private leavePanel(panel: Panel, how: PanelLeave): boolean {
    if (this.panel !== panel) return true
    const anchor = this.#anchor
    const scope = anchor?.closest('.lintje-data-table')
    if (how !== 'forward' || !anchor || !scope) {
      this.closePanel(panel, how === 'back')
      return true
    }
    const popover = scope.querySelector('lintje-popover')
    const inside = new Set(popover ? tabbables(popover) : [])
    const stops = tabbables(scope).filter((stop) => !inside.has(stop))
    const next = stops[stops.indexOf(focusTarget(anchor)) + 1]
    if (!next) return false
    this.closePanel(panel, false)
    next.focus()
    return true
  }

  private applyFilters(keys: string[], cleared: boolean): void {
    this.#filterAsked = true
    const values = { ...this.filterValues }
    for (const key of keys) {
      const before = filterOut(values[key])
      const after = cleared ? null : filterOut(this.filterDraft[key])
      if (after) values[key] = after
      else delete values[key]
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        this.emit('lintje-filter-change', { column: key, value: after })
      }
    }
    this.filterValues = values
    this.page = 0
    this.mobilePage = 0
    this.closePanel()
  }

  private async clearFilter(key: string, button: HTMLElement): Promise<void> {
    const had = holdsFocus(button)
    const scope = button.closest('.lintje-data-table')
    const values = { ...this.filterValues }
    delete values[key]
    this.filterValues = values
    this.page = 0
    this.mobilePage = 0
    this.#filterAsked = true
    this.emit('lintje-filter-change', { column: key, value: null })
    if (!had || !scope) return
    // The chip is gone: the next chip, else this column's funnel, else the phone's Filters.
    await this.updateComplete
    const next =
      scope.querySelector<HTMLElement>('.lintje-data-table__chip-clear') ??
      (this.#mobile.matches
        ? scope.querySelector<HTMLElement>('.lintje-data-table__sheet-button')
        : scope.querySelector<HTMLElement>(`.lintje-data-table__funnel[data-column="${key}"]`))
    if (next) focusTarget(next).focus()
  }

  private chooserItems(): SortableItem[] {
    const group = this.groupColumn
    const [, ...rest] = shownColumns(this.columns, this.columnOrder, []).filter(
      (column) => column !== group,
    )
    const seen = JSON.stringify([rest.map((column) => column.key), this.hiddenKeys])
    if (seen !== this.#chooserItems.seen) {
      const hidden = new Set(this.hiddenKeys)
      this.#chooserItems = {
        seen,
        items: rest.map((column) => ({
          id: column.key,
          label: column.header,
          checked: !hidden.has(column.key),
        })),
      }
    }
    return this.#chooserItems.items
  }

  private changeColumns(order: string[], checked: string[]): void {
    const first = this.columns[0]
    if (!first) return
    const change = columnsChange(first.key, order, checked)
    this.columnOrder = order
    this.hiddenKeys = change.hidden
    this.emit('lintje-columns-change', change)
  }

  /** Every column shown, in the order the host declared them. */
  private get columnsAreDefault(): boolean {
    const [, ...rest] = this.columns
    const order = this.columnOrder ?? rest.map((column) => column.key)
    return this.hiddenKeys.length === 0 && order.every((key, index) => key === rest[index]?.key)
  }

  private resetColumns(): void {
    const [, ...rest] = this.columns
    const keys = rest.map((column) => column.key)
    this.changeColumns(keys, keys)
    // The list is rebuilt from the new order, so it says the same as the table.
    this.#chooserItems = { seen: '', items: [] }
  }

  /** "Filters wissen": one `lintje-filter-change` per active column, as a chip would send. */
  private async clearAllFilters(button: HTMLElement): Promise<void> {
    const had = holdsFocus(button)
    const scope = button.closest('.lintje-data-table')
    const keys = Object.keys(this.filterValues).filter((key) =>
      isFilterActive(this.filterValues[key]),
    )
    this.filterValues = {}
    this.page = 0
    this.mobilePage = 0
    this.#filterAsked = true
    for (const key of keys) this.emit('lintje-filter-change', { column: key, value: null })
    if (!had || !scope) return
    // The chips are gone: the first funnel, or the phone's Filters.
    await this.updateComplete
    const next = this.#mobile.matches
      ? scope.querySelector<HTMLElement>('.lintje-data-table__sheet-button')
      : scope.querySelector<HTMLElement>('.lintje-data-table__funnel')
    if (next) focusTarget(next).focus()
  }

  /* Rendering -------------------------------------------------------------- */

  protected override render(): TemplateResult | typeof nothing {
    const data = this.data
    if (!data) return nothing
    if (this.bare) return this.table(this.#edges)
    if (this.plain) return this.content()
    const ready = (data.state ?? 'ready') === 'ready'
    const subtitle =
      this.#mobile.matches && data.mobileSubtitle ? data.mobileSubtitle : data.subtitle

    return html`<lintje-tile
      class="lintje-data-table__tile"
      breakable
      id=${this.id ? `${this.id}-tile` : nothing}
      span=${data.span ?? nothing}
      heading=${data.title ?? nothing}
      icon=${data.icon ?? nothing}
      subtitle=${subtitle ?? nothing}
      intro=${data.intro ?? nothing}
      footnote=${data.footnote ?? nothing}
      ?expandable=${Boolean(data.expandable) && ready}
      ?download=${Boolean(data.download) && ready}
      state=${data.state ?? 'ready'}
      message=${data.message ?? nothing}
      last-known=${data.lastKnown ?? nothing}
      @lintje-tile-expand=${(event: Event) => {
        event.stopPropagation()
        this.expand(true)
      }}
      @lintje-tile-download=${(event: Event) => {
        event.stopPropagation()
        this.csv()
      }}
    >
      ${
        data.notice
          ? html`<lintje-announcement slot="notice" .data=${data.notice}></lintje-announcement>`
          : nothing
      }
      ${this.content(true)}
    </lintje-tile>

    ${this.renderExpandModal(
      // Sort, page and checked rows live on the element, so the modal shows the same state.
      this.expanded && ready ? this.table(this.#modalEdges) : nothing,
      {
        heading: data.title,
        subtitle,
        footnote: data.footnote,
        csv: data.download ? () => this.csv() : undefined,
      },
    )}`
  }

  private csv(): void {
    const data = this.data
    if (!data?.download) return
    // A label is the word a reader sees; a total is its value, with its own label first.
    const value = (column: TableColumnData, cell: CellValue): CellValue =>
      column.format === 'label' && cell != null ? formatText(column, cell) : cell
    const totals = data.totals
    downloadCsv(data.download.filename, [
      data.columns.map((column) => column.header),
      ...data.rows.map((row) => data.columns.map((column) => value(column, row[column.key]))),
      ...(totals
        ? [
            data.columns.map((column, index) =>
              index === 0
                ? (data.totalsLabel ?? 'Totaal')
                : value(column, totalParts(totals[column.key]).value),
            ),
          ]
        : []),
    ])
  }

  /**
   * The table, or its state. In a tile the skeleton goes in the tile's `loading` slot and empty
   * and error are the tile's; `plain`, without a tile, composes the elements itself.
   */
  private content(inTile = false): TemplateResult | typeof nothing {
    const data = this.data as DataTableData
    switch (data.state ?? 'ready') {
      case 'loading':
        return inTile
          ? html`<div slot="loading">${renderChartSkeleton({ kind: 'table', status: false })}</div>`
          : renderChartSkeleton({ kind: 'table' })
      case 'empty':
        return inTile
          ? nothing
          : html`<lintje-empty-state compact status text=${data.message ?? nothing}></lintje-empty-state>`
      case 'error':
        return inTile
          ? nothing
          : html`<lintje-announcement
              compact
              .data=${{ kind: 'error', text: data.message ?? '', live: true }}
            ></lintje-announcement>`
      default:
        return this.table(this.#edges)
    }
  }

  private table(edges: ScrollEdges): TemplateResult {
    const data = this.data as DataTableData
    const rows = this.sortedRows
    const mobile = this.#mobile.matches
    const grouped = this.grouped
    const groups = grouped ? this.groupsOf(rows) : []
    // With groups a page holds whole groups: the pager counts groups, not rows.
    const units = grouped ? groups.length : rows.length
    const pageSize = grouped ? this.groupsPerPage : (data.pageSize ?? 25)
    const mobileSize = grouped ? this.groupsPerPage : MOBILE_PAGE_SIZE
    const pageCount = Math.ceil(units / pageSize)
    const mobilePageCount = Math.ceil(units / mobileSize)
    const pageGroups = groups.slice(this.page * pageSize, (this.page + 1) * pageSize)
    const mobileGroups = groups.slice(
      this.mobilePage * mobileSize,
      (this.mobilePage + 1) * mobileSize,
    )
    // Only the rows that are drawn: Tab between editable cells must not land in a collapsed group.
    const collapsed = new Set(this.collapsedGroups)
    const visible = grouped
      ? pageGroups.filter((group) => !collapsed.has(group.key)).flatMap((group) => group.rows)
      : rows.slice(this.page * pageSize, (this.page + 1) * pageSize)
    const mobileStart = this.mobilePage * MOBILE_PAGE_SIZE
    const mobileRows = grouped ? [] : rows.slice(mobileStart, mobileStart + MOBILE_PAGE_SIZE)
    // The count stands once: in a pager of rows when there is one, else in the toolbar.
    const paged = !grouped && (mobile ? mobilePageCount : pageCount) > 1
    const unit = grouped ? { many: 'groepen', one: 'groep' } : { many: 'rijen', one: 'rij' }

    // The copy the reader is in: the modal while it is open, else the tile. The other one's cells
    // point at the hint in this one, which stands once in the shared shadow root.
    const active = (edges === this.#modalEdges) === this.expanded
    const copy = edges === this.#modalEdges ? 'modal' : 'tile'
    // A table wider than its tile scrolls; a keyboard reaches that scroll only when the scroller
    // takes focus, as lintje-code's block does (WCAG 2.1.1).
    const scrolls = edges.start || edges.end
    return html`<div class=${classMap({ 'lintje-data-table': true, 'is-phone': mobile })}>
      ${this.toolbar(edges, paged)} ${mobile ? nothing : this.selectionBar(false)}
      <!-- Desktop table: scrolls sideways when it is wider than the tile -->
      <div
        class=${classMap({
          'lintje-data-table__frame': true,
          'is-scrollable-start': edges.start,
          'is-scrollable-end': edges.end,
        })}
      >
        <div
          class="lintje-data-table__scroller"
          ${ref(edges.watch)}
          tabindex=${scrolls ? 0 : nothing}
          role=${scrolls ? 'region' : nothing}
          aria-label=${scrolls ? (this.data?.caption ?? nothing) : nothing}
        >
          ${this.fullTable(visible, pageCount, pageSize, edges, grouped ? pageGroups : null)}
        </div>
      </div>

      <!-- Mobile representation: two columns (C8) -->
      ${this.mobileTable(mobileRows, mobilePageCount, copy, grouped ? mobileGroups : null)}
      ${
        pageCount > 1
          ? this.pager('full', this.page, pageCount, pageSize, units, unit, (page) => {
              this.page = page
            })
          : nothing
      }
      ${
        mobilePageCount > 1
          ? this.pager(
              'mobile',
              this.mobilePage,
              mobilePageCount,
              mobileSize,
              units,
              unit,
              (page) => {
                this.mobilePage = page
              },
            )
          : nothing
      }
      ${mobile ? this.selectionBar(true) : nothing} ${this.panels(edges)}
      ${active && this.columns.some((column) => column.editor) ? this.#editing.renderStatus() : nothing}
      <span class="visually-hidden" role="status">${active ? this.liveMessage : ''}</span>
    </div>`
  }

  /* The extensions around the table ---------------------------------------- */

  /** "6 van 131 rijen" while a filter narrows the rows and the host gave the total. */
  private get filteredCount(): string {
    const total = this.data?.totalRows
    const active = this.filterColumns.some((column) =>
      isFilterActive(this.filterValues[column.key]),
    )
    return active && total != null ? `${this.rows.length} van ${rowCount(total)}` : ''
  }

  private toolbar(edges: ScrollEdges, paged: boolean): TemplateResult | typeof nothing {
    const sortMenu = this.sortMenu()
    const groups = this.groupToggle()
    const tools =
      groups === nothing ? undefined : html`<div class="lintje-data-table__tools">${groups}</div>`
    if (this.filterColumns.length === 0 && sortMenu === nothing && !tools) return nothing
    return renderToolbar({
      columns: this.filterColumns,
      values: this.filterValues,
      count: paged ? '' : this.filteredCount,
      sortMenu,
      chooser: tools,
      onClearFilter: (key, button) => void this.clearFilter(key, button),
      onClearAll: (button) => void this.clearAllFilters(button),
      onOpenSheet: () => this.openPanel({ kind: 'sheet', edges }, null),
    })
  }

  /** "Alles inklappen" while any group is open, else "Alles uitklappen". */
  private groupToggle(): TemplateResult | typeof nothing {
    if (!this.grouped) return nothing
    const keys = this.groupsOf(this.rows).map((group) => group.key)
    const collapsed = new Set(this.collapsedGroups)
    const anyOpen = keys.some((key) => !collapsed.has(key))
    return html`<button
      type="button"
      class="lintje-button lintje-button--tertiary lintje-button--compact lintje-data-table__group-all"
      @click=${() => {
        this.collapsedGroups = anyOpen ? keys : []
        this.announce(anyOpen ? 'Alle groepen ingeklapt' : 'Alle groepen uitgeklapt')
      }}
    >
      <span class="lintje-button__label" @pointerenter=${titleWhenCut}>${anyOpen ? 'Alles inklappen' : 'Alles uitklappen'}</span>
    </button>`
  }

  /**
   * Below 768 px only one measure has a header: "Sorteren" reaches every sortable column. Hidden
   * from 768 px, where every column's header sorts.
   */
  private sortMenu(): TemplateResult | typeof nothing {
    const sortable = this.shown.filter((column) => column.sortable !== false)
    const [name] = this.shown
    const measure = this.mobileMeasure
    if (!sortable.some((column) => column !== name && column !== measure)) return nothing
    const sort = this.activeSort
    const items: MenuEntry[] = [
      { heading: 'Sorteren op' },
      ...sortable.map((column) => ({
        value: `column:${column.key}`,
        label: column.header,
        radio: true,
        checked: column.key === sort.key,
      })),
      { heading: 'Volgorde' },
      { value: 'direction:asc', label: 'Oplopend', radio: true, checked: sort.direction === 'asc' },
      {
        value: 'direction:desc',
        label: 'Aflopend',
        radio: true,
        checked: sort.direction === 'desc',
      },
    ]
    return html`<lintje-menu-button
      class="lintje-data-table__sort-menu"
      label="Sorteren"
      .items=${items}
      @lintje-action=${(event: CustomEvent<string>) => {
        event.stopPropagation()
        const [kind, value] = event.detail.split(/:(.*)/s) as [string, string]
        const current = this.activeSort
        if (kind === 'direction') {
          this.setSort({ key: current.key, direction: value as SortState['direction'] })
          return
        }
        const column = sortable.find((candidate) => candidate.key === value)
        if (column && column.key !== current.key) this.toggleSort(column)
      }}
    ></lintje-menu-button>`
  }

  private get mobileMeasure(): TableColumnData | undefined {
    const columns = this.shown
    return columns.find((column) => column.mobileMeasure) ?? columns[1] ?? columns[0]
  }

  private selectionBar(mobile: boolean): TemplateResult | typeof nothing {
    const data = this.data as DataTableData
    if (!data.selectable || !data.bulkActions || this.checkedIds.length === 0) return nothing
    return renderSelectionBar(
      data.bulkActions,
      this.checkedIds.length,
      mobile,
      (action) => this.emit('lintje-bulk-action', { ids: [...this.checkedIds], action }),
      // It leaves with its bar: `#keepFocus` takes the focus to "Alles selecteren".
      () => this.setChecked([]),
    )
  }

  private panels(edges: ScrollEdges): TemplateResult | typeof nothing {
    const panel = this.panel
    if (!panel || panel.edges !== edges) return nothing
    if (panel.kind === 'columns') {
      const first = this.columns[0]
      if (!first) return nothing
      return renderColumnChooser({
        first,
        items: this.chooserItems(),
        anchor: this.#anchor,
        onOrder: (order) =>
          this.changeColumns(
            order,
            order.filter((key) => !this.hiddenKeys.includes(key)),
          ),
        onChecked: (checked) =>
          this.changeColumns(
            this.chooserItems().map((item) => item.id),
            checked,
          ),
        onReset: () => this.resetColumns(),
        isDefault: this.columnsAreDefault,
        onClose: () => this.closePanel(panel),
        onLeave: (how) => this.leavePanel(panel, how),
      })
    }
    if (panel.kind === 'sheet') {
      const columns = this.filterColumns
      return renderFiltersSheet({
        columns,
        draft: this.filterDraft,
        onDraft: (key, value) => {
          this.filterDraft = { ...this.filterDraft, [key]: value }
        },
        onApply: () =>
          this.applyFilters(
            columns.map((column) => column.key),
            false,
          ),
        onClear: () =>
          this.applyFilters(
            columns.map((column) => column.key),
            true,
          ),
        onClose: () => this.closePanel(panel),
      })
    }
    const column = this.columns.find((candidate) => candidate.key === panel.column)
    if (!column) return nothing
    return renderFilterPopover({
      column,
      anchor: this.#anchor,
      draft: this.filterDraft[column.key],
      onDraft: (value) => {
        this.filterDraft = { ...this.filterDraft, [column.key]: value }
      },
      onApply: () => this.applyFilters([column.key], false),
      onClear: () => this.applyFilters([column.key], true),
      onClose: () => this.closePanel(panel),
      onLeave: (how) => this.leavePanel(panel, how),
    })
  }

  private fullTable(
    visible: Row[],
    pageCount: number,
    pageSize: number,
    edges: ScrollEdges,
    groups: Group[] | null,
  ): TemplateResult {
    const data = this.data as DataTableData
    const columns = this.shown
    const selectable = Boolean(data.selectable)
    const sort = this.activeSort
    const rowActions = data.rowActions?.length ? data.rowActions : null
    const details = this.detailColumns.length > 0
    const copy = edges === this.#modalEdges ? 'modal' : 'tile'
    // The rows before this page, so an editor's name says the row's place in the whole table.
    const before = groups
      ? this.groupsOf(this.sortedRows)
          .slice(0, this.page * pageSize)
          .reduce((count, group) => count + group.rows.length, 0)
      : this.page * pageSize
    const grid: EditGrid = {
      ids: visible.map((row) => this.rowKey(row)),
      columns,
      offset: before,
      copy,
    }
    const span =
      columns.length + (selectable ? 1 : 0) + (details ? 1 : 0) + (this.actionColumn ? 1 : 0)
    const rowsOf = (list: Row[], first: number, inGroup: boolean): unknown =>
      list.map((row, index) => this.fullRow(row, first + index, grid, copy, inGroup))

    return html`<table class="lintje-data-table__full">
      <caption class="visually-hidden">${data.caption}</caption>
      <thead>
        <tr>
          ${
            selectable
              ? html`<th
                scope="col"
                class="lintje-data-table__header-cell lintje-data-table__check-cell"
              >
                ${this.headerCheck()}
              </th>`
              : nothing
          }
          ${
            details
              ? html`<th scope="col" class="lintje-data-table__header-cell lintje-data-table__detail-cell">
                  <span class="visually-hidden">Details</span>
                </th>`
              : nothing
          }
          ${columns.map((column) => this.headerCell(column, sort, edges))}
          ${
            this.actionColumn
              ? html`<th scope="col" class="lintje-data-table__header-cell lintje-data-table__action-cell">
                  ${rowActions ? html`<span class="visually-hidden">Acties</span>` : nothing}
                  ${
                    data.columnChooser
                      ? renderChooserButton(this.panel?.kind === 'columns', (anchor) =>
                          this.panel?.kind === 'columns'
                            ? this.closePanel()
                            : this.openPanel({ kind: 'columns', edges }, anchor),
                        )
                      : nothing
                  }
                </th>`
              : nothing
          }
        </tr>
      </thead>
      ${
        groups
          ? (() => {
              let first = 0
              return groups.map((group) => {
                const open = !this.collapsedGroups.includes(group.key)
                const start = first
                first += open ? group.rows.length : 0
                return html`<tbody class="lintje-data-table__group">
                  ${this.groupRow(group, open)}
                  ${open ? rowsOf(group.rows, start, true) : nothing}
                  ${open ? this.subtotalRow(group, columns) : nothing}
                </tbody>`
              })
            })()
          : html`<tbody>
              ${rowsOf(visible, 0, false)}
              <!-- A short last page keeps the height of a full one, so the page below doesn't jump. -->
              ${
                pageCount > 1
                  ? Array.from(
                      { length: pageSize - visible.length },
                      () => html`<tr
                        class="lintje-data-table__row lintje-data-table__row--filler"
                        aria-hidden="true"
                      >
                        <td class="lintje-data-table__cell" colspan=${span}></td>
                      </tr>`,
                    )
                  : nothing
              }
            </tbody>`
      }
      ${this.sizerRow(columns)}
      ${this.totalsRow(columns, data.totals, data.totalsLabel ?? 'Totaal')}
    </table>`
  }

  /**
   * A row of no height with each column's widest value over every row, not only this page's: a
   * sort or another page shows other rows, and the columns keep their width.
   */
  private sizerRow(columns: TableColumnData[]): TemplateResult {
    const data = this.data as DataTableData
    const widest = this.widestRow(columns)
    return html`<tbody class="lintje-data-table__sizer" aria-hidden="true">
      <tr class=${classMap({ 'lintje-data-table__row--in-group': this.grouped })}>
        ${
          data.selectable
            ? html`<td class="lintje-data-table__cell lintje-data-table__check-cell"></td>`
            : nothing
        }
        ${
          this.detailColumns.length > 0
            ? html`<td class="lintje-data-table__cell lintje-data-table__detail-cell"></td>`
            : nothing
        }
        ${columns.map((column, index) => {
          const value = widest[column.key] ?? null
          return html`<td
            class=${classMap({
              'lintje-data-table__cell': true,
              'lintje-data-table__name': index === 0,
              'lintje-data-table__cell--align-right': this.alignsRight(column),
              'lintje-data-table__cell--truncate': column.truncate === true,
            })}
          >
            <div class="lintje-data-table__sizer-box">
              ${column.truncate ? this.truncatedCell(column, value) : this.cell(column, value)}
            </div>
          </td>`
        })}
        ${
          this.actionColumn
            ? html`<td class="lintje-data-table__cell lintje-data-table__action-cell"></td>`
            : nothing
        }
      </tr>
    </tbody>`
  }

  /** Per column the value whose words are longest, over every row; kept while the data stands. */
  private widestRow(columns: TableColumnData[]): Row {
    const key = columns.map((column) => column.key).join(' ')
    const seen = this.#widest
    if (seen && seen.data === this.data && seen.key === key) return seen.row
    const row: Row = {}
    for (const column of columns) {
      let longest = -1
      for (const candidate of this.rows) {
        const value = candidate[column.key] ?? null
        const length = (cellText(column, value) ?? '').length
        if (length > longest) {
          longest = length
          row[column.key] = value
        }
      }
    }
    this.#widest = { data: this.data, key, row }
    return row
  }

  /** A column's head: the sort button and, for a filterable column, its funnel. */
  private headerCell(column: TableColumnData, sort: SortState, edges: ScrollEdges): TemplateResult {
    const active = sort.key === column.key
    const alignRight = this.alignsRight(column)
    const filtered = Boolean(column.filter) && isFilterActive(this.filterValues[column.key])
    const label =
      column.sortable === false
        ? column.header
        : html`<button
            type="button"
            class="lintje-data-table__sort-button"
            @click=${() => this.toggleSort(column)}
          >
            <span class="lintje-data-table__sort-label">${column.header}</span>
            ${sortIcon(active ? sort.direction : null)}
          </button>`
    return html`<th
      scope="col"
      class=${classMap({
        'lintje-data-table__header-cell': true,
        'lintje-data-table__header-cell--align-right': alignRight,
        'lintje-data-table__header-cell--sortable': column.sortable !== false,
        'lintje-data-table__header-cell--filterable': Boolean(column.filter),
        'is-active': active,
        'is-filtered': filtered,
      })}
      aria-sort=${active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      ${
        column.filter
          ? html`<span class="lintje-data-table__header-inner"
              >${label}${renderFunnel(
                column,
                this.filterValues[column.key],
                this.panel?.kind === 'filter' && this.panel.column === column.key,
                (anchor) =>
                  this.panel?.kind === 'filter' && this.panel.column === column.key
                    ? this.closePanel()
                    : this.openPanel({ kind: 'filter', column: column.key, edges }, anchor),
              )}</span
            >`
          : label
      }
    </th>`
  }

  /** The desktop's last column: the rows' menus, and in its head the column chooser. */
  private get actionColumn(): boolean {
    return Boolean(this.data?.rowActions?.length) || Boolean(this.data?.columnChooser)
  }

  private alignsRight(column: TableColumnData): boolean {
    return (column.align ?? (isNumeric(column, this.rows) ? 'right' : 'left')) === 'right'
  }

  /** One body row and, while it is open, its detail under it. */
  private fullRow(
    row: Row,
    rowIndex: number,
    grid: EditGrid,
    copy: string,
    inGroup: boolean,
  ): TemplateResult {
    const data = this.data as DataTableData
    const columns = this.shown
    const selectable = Boolean(data.selectable)
    const clickable = Boolean(data.clickable) && !selectable
    const rowActions = data.rowActions?.length ? data.rowActions : null
    const detailColumns = this.detailColumns
    const id = this.rowKey(row)
    const selected = id === data.selectedId
    const isChecked = this.checkedIds.includes(id)
    const isOpen = detailColumns.length > 0 && this.openRows.includes(id)
    const detailId = `lintje-data-table-${copy}-row-${id}`
    const span =
      columns.length +
      (selectable ? 1 : 0) +
      (detailColumns.length > 0 ? 1 : 0) +
      (this.actionColumn ? 1 : 0)
    return html`<tr
        class=${classMap({
          'lintje-data-table__row': true,
          'lintje-data-table__row--in-group': inGroup,
          'is-clickable': clickable,
          'is-selected': selected,
          'is-checked': isChecked,
          'is-open': isOpen,
        })}
        tabindex=${clickable ? 0 : nothing}
        aria-selected=${clickable ? selected : nothing}
        @click=${clickable ? () => this.emit('lintje-row-click', this.rowDetail(row)) : nothing}
        @keydown=${clickable ? (event: KeyboardEvent) => this.rowKeydown(event, row) : nothing}
      >
        ${
          selectable
            ? html`<td class="lintje-data-table__cell lintje-data-table__check-cell">
              ${this.rowCheck(row, id, isChecked)}
            </td>`
            : nothing
        }
        ${
          detailColumns.length > 0
            ? html`<td
                class="lintje-data-table__cell lintje-data-table__detail-cell"
                @click=${(event: Event) => event.stopPropagation()}
                @keydown=${(event: Event) => event.stopPropagation()}
              >
                ${this.rowToggle(row, isOpen, detailId, 'lintje-data-table__detail-toggle')}
              </td>`
            : nothing
        }
        ${columns.map((column, index) => {
          const truncate = column.truncate === true
          const content = truncate
            ? this.truncatedCell(column, row[column.key])
            : this.cell(column, row[column.key])
          const alignRight = this.alignsRight(column)
          if (column.editor)
            return this.editableCell(row, rowIndex, column, index === 0, alignRight, content, grid)
          return index === 0
            ? html`<th
                scope="row"
                class=${classMap({
                  'lintje-data-table__cell': true,
                  'lintje-data-table__name': true,
                  'lintje-data-table__cell--truncate': truncate,
                })}
              >
                ${this.opener(row, content)}
              </th>`
            : html`<td
                class=${classMap({
                  'lintje-data-table__cell': true,
                  'lintje-data-table__cell--align-right': alignRight,
                  'lintje-data-table__cell--truncate': truncate,
                })}
              >
                ${content}
              </td>`
        })}
        ${
          rowActions
            ? html`<td
                class="lintje-data-table__cell lintje-data-table__action-cell"
                @click=${(event: Event) => event.stopPropagation()}
                @keydown=${(event: Event) => event.stopPropagation()}
              >
                ${renderRowActions(rowActions, this.rowDetail(row).label, (action) =>
                  this.emit('lintje-row-action', { id, action }),
                )}
              </td>`
            : this.actionColumn
              ? html`<td class="lintje-data-table__cell lintje-data-table__action-cell"></td>`
              : nothing
        }
      </tr>
      ${
        detailColumns.length > 0
          ? html`<tr class="lintje-data-table__detail" id=${detailId} ?hidden=${!isOpen}>
              <td class="lintje-data-table__detail-body" colspan=${span}>
                ${isOpen ? this.detailList(row, detailColumns, 'grid') : nothing}
              </td>
            </tr>`
          : nothing
      }`
  }

  /** The button that opens a row's detail; the phone's row and the desktop's share it. */
  private rowToggle(
    row: Row,
    isOpen: boolean,
    detailId: string,
    className: string,
  ): TemplateResult {
    const { id, label } = this.rowDetail(row)
    return html`<button
      type="button"
      class=${className}
      aria-label=${`Alle gegevens van ${label}`}
      aria-expanded=${isOpen ? 'true' : 'false'}
      aria-controls=${detailId}
      @click=${() => this.toggleRow(id)}
    >
      ${renderIcon('functioneel-delta-omlaag', { size: 16, rotate: isOpen ? 180 : undefined })}
    </button>`
  }

  /** What a row's columns leave out, as label and value. */
  private detailList(row: Row, columns: TableColumnData[], layout: 'row' | 'grid'): TemplateResult {
    // As many cells to a line as fill the lines evenly: a gap at the end reads as a missing value.
    const lines = Math.ceil(columns.length / 4)
    return html`<lintje-description-list
      layout=${layout}
      .columns=${Math.ceil(columns.length / lines)}
      .items=${columns.map((column): DescriptionItem => ({
        label: column.header,
        value: cellText(column, row[column.key]),
      }))}
    ></lintje-description-list>`
  }

  /**
   * A group's heading: a button with the group's word and its count. Collapsed, the row carries
   * the group's subtotals, so a collapsed table still reads.
   */
  private groupRow(group: Group, open: boolean): TemplateResult {
    const data = this.data as DataTableData
    const column = this.groupColumn as TableColumnData
    const columns = this.shown
    const lead = (data.selectable ? 1 : 0) + (this.detailColumns.length > 0 ? 1 : 0)
    const subtotals = data.groupTotals?.[group.key]
    const count = group.rows.length
    const heading = html`<button
      type="button"
      class="lintje-data-table__group-toggle"
      aria-expanded=${open ? 'true' : 'false'}
      @click=${() => this.toggleGroup(group.key)}
    >
      ${renderIcon('functioneel-delta-omlaag', { size: 16, rotate: open ? undefined : 270 })}
      <span class="lintje-data-table__group-name">${this.cell(column, group.value)}</span>
      <span class="lintje-data-table__group-count">${count} ${count === 1 ? 'rij' : 'rijen'}</span>
    </button>`
    return html`<tr class="lintje-data-table__group-row">
      ${lead > 0 ? html`<td class="lintje-data-table__cell" colspan=${lead}></td>` : nothing}
      <th scope="rowgroup" class="lintje-data-table__cell lintje-data-table__group-head">${heading}</th>
      ${columns
        .slice(1)
        .map((entry) => this.totalCell(entry, open ? undefined : subtotals?.[entry.key]))}
      ${this.actionColumn ? html`<td class="lintje-data-table__cell"></td>` : nothing}
    </tr>`
  }

  private subtotalRow(group: Group, columns: TableColumnData[]): TemplateResult | typeof nothing {
    const subtotals = this.data?.groupTotals?.[group.key]
    if (!subtotals) return nothing
    const column = this.groupColumn as TableColumnData
    const word = formatText(column, group.value) ?? 'Zonder waarde'
    return this.sumRow('lintje-data-table__subtotal', `Subtotaal ${word}`, columns, subtotals)
  }

  private totalsRow(
    columns: TableColumnData[],
    totals: Record<string, TableTotal> | undefined,
    label: string,
  ): TemplateResult | typeof nothing {
    if (!totals) return nothing
    return html`<tfoot>${this.sumRow('lintje-data-table__total', label, columns, totals)}</tfoot>`
  }

  /** A totals or subtotal row: its label in the name's place, the host's values under their columns. */
  private sumRow(
    className: string,
    label: string,
    columns: TableColumnData[],
    totals: Record<string, TableTotal>,
  ): TemplateResult {
    const data = this.data as DataTableData
    const lead = (data.selectable ? 1 : 0) + (this.detailColumns.length > 0 ? 1 : 0)
    return html`<tr class=${className}>
      ${lead > 0 ? html`<td class="lintje-data-table__cell" colspan=${lead}></td>` : nothing}
      <th scope="row" class="lintje-data-table__cell lintje-data-table__sum-label">${label}</th>
      ${columns.slice(1).map((column) => this.totalCell(column, totals[column.key]))}
      ${this.actionColumn ? html`<td class="lintje-data-table__cell"></td>` : nothing}
    </tr>`
  }

  private totalCell(column: TableColumnData, total: TableTotal | undefined): TemplateResult {
    const empty = total === undefined
    return html`<td
      class=${classMap({
        'lintje-data-table__cell': true,
        'lintje-data-table__cell--align-right': this.alignsRight(column),
      })}
    >
      ${empty ? nothing : this.totalContent(column, total)}
    </td>`
  }

  private editableCell(
    row: Row,
    rowIndex: number,
    column: TableColumnData,
    isName: boolean,
    alignRight: boolean,
    content: unknown,
    grid: EditGrid,
  ): TemplateResult {
    const editing = this.#editing
    const cell = { id: this.rowKey(row), column: column.key }
    const value = row[column.key] ?? null
    const mode = editing.mode(cell, value).kind
    const classes = classMap({
      'lintje-data-table__cell': true,
      'lintje-data-table__name': isName,
      'lintje-data-table__cell--align-right': alignRight,
      'lintje-data-table__cell--truncate': column.truncate === true,
      'focus-inset': true,
      ...editing.cellClasses(cell, value),
    })
    const inner = editing.content(
      cell,
      column,
      value,
      content,
      `${column.header} van rij ${grid.offset + rowIndex + 1}`,
      grid,
    )
    const onKeydown = (event: KeyboardEvent): void => {
      if (editing.editable(cell, column)) editing.cellKeydown(cell, event)
    }
    const onDblclick = (event: Event): void => {
      if (mode === 'rest' && editing.editable(cell, column))
        editing.open(cell, event.currentTarget as Element)
    }
    // A click in the cell is not the row's drilldown.
    const stop = (event: Event): void => event.stopPropagation()
    const tabindex = mode === 'editor' ? -1 : 0
    const key = cellKey(cell)
    return isName
      ? html`<th
          scope="row"
          class=${classes}
          tabindex=${tabindex}
          data-cell=${key}
          aria-describedby=${mode === 'rest' ? editing.hintId : nothing}
          @keydown=${onKeydown}
          @dblclick=${onDblclick}
          @click=${stop}
        >
          ${inner}
        </th>`
      : html`<td
          class=${classes}
          tabindex=${tabindex}
          data-cell=${key}
          aria-describedby=${mode === 'rest' ? editing.hintId : nothing}
          @keydown=${onKeydown}
          @dblclick=${onDblclick}
          @click=${stop}
        >
          ${inner}
        </td>`
  }

  private mobileTable(
    rows: Row[],
    pageCount: number,
    copy: 'tile' | 'modal',
    groups: Group[] | null,
  ): TemplateResult {
    const data = this.data as DataTableData
    const columns = this.shown
    const selectable = Boolean(data.selectable)
    const nameColumn = columns[0]
    const measureColumn = this.mobileMeasure
    const sort = this.activeSort
    if (!nameColumn || !measureColumn)
      return html`<table class="lintje-data-table__mobile"></table>`
    const rowActions = data.rowActions?.length ? data.rowActions : null
    // The columns the two cells leave out stand in a list under the row (WCAG 1.4.10), with what
    // the desktop's detail lists.
    const others = [
      ...columns.filter((column) => column !== nameColumn && column !== measureColumn),
      ...this.detailColumns,
    ]
    const actionColumn = Boolean(rowActions) || others.length > 0
    const span = actionColumn ? 3 : 2
    const active = sort.key === measureColumn.key

    return html`<table class="lintje-data-table__mobile">
      <caption class="visually-hidden">${data.caption}</caption>
      <thead>
        <tr>
          <th
            scope="col"
            class="lintje-data-table__header-cell lintje-data-table__header-cell--mobile"
          >
            ${
              selectable
                ? html`<span class="lintje-data-table__mobile-check"
                  >${this.headerCheck()}${nameColumn.header}</span
                >`
                : nameColumn.header
            }
          </th>
          <th
            scope="col"
            class=${classMap({
              'lintje-data-table__header-cell': true,
              'lintje-data-table__header-cell--mobile': true,
              'lintje-data-table__header-cell--align-right': true,
              'lintje-data-table__header-cell--sortable': measureColumn.sortable !== false,
              'is-active': active,
            })}
            aria-sort=${
              measureColumn.sortable === false
                ? nothing
                : active
                  ? sort.direction === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'
            }
          >
            ${
              measureColumn.sortable === false
                ? measureColumn.header
                : html`<button
                  type="button"
                  class="lintje-data-table__sort-button"
                  @click=${() => this.toggleSort(measureColumn)}
                >
                  <span class="lintje-data-table__sort-label">${measureColumn.header}</span>
                  ${sortIcon(active ? sort.direction : null)}
                </button>`
            }
          </th>
          ${
            actionColumn
              ? html`<th
                  scope="col"
                  class="lintje-data-table__header-cell lintje-data-table__header-cell--mobile lintje-data-table__mobile-cell--actions"
                >
                  <span class="visually-hidden">${rowActions ? 'Acties' : 'Meer gegevens'}</span>
                </th>`
              : nothing
          }
        </tr>
      </thead>
      ${
        groups
          ? groups.map((group) => {
              const open = !this.collapsedGroups.includes(group.key)
              return html`<tbody class="lintje-data-table__group">
                ${this.mobileGroupRow(group, open, measureColumn, span)}
                ${
                  open
                    ? group.rows.map((row) =>
                        this.mobileRow(row, copy, others, actionColumn, span, measureColumn),
                      )
                    : nothing
                }
                ${
                  open && data.groupTotals?.[group.key]
                    ? this.mobileSumRow(
                        'lintje-data-table__subtotal',
                        `Subtotaal ${formatText(this.groupColumn as TableColumnData, group.value) ?? 'Zonder waarde'}`,
                        data.groupTotals[group.key]?.[measureColumn.key],
                        measureColumn,
                        span,
                      )
                    : nothing
                }
              </tbody>`
            })
          : html`<tbody>
              ${rows.map((row) => this.mobileRow(row, copy, others, actionColumn, span, measureColumn))}
              <!-- Empty rows with the same two lines per cell keep a short last page as tall as a full one. -->
              ${
                pageCount > 1
                  ? Array.from(
                      { length: MOBILE_PAGE_SIZE - rows.length },
                      () => html`<tr
                        class="lintje-data-table__mobile-row lintje-data-table__mobile-row--filler"
                        aria-hidden="true"
                      >
                        <td class="lintje-data-table__mobile-cell">
                          <span class="lintje-data-table__mobile-name">&nbsp;</span>
                          ${
                            this.hasSubline
                              ? html`<span class="lintje-data-table__mobile-sub">&nbsp;</span>`
                              : nothing
                          }
                        </td>
                        <td class="lintje-data-table__mobile-cell" colspan=${span - 1}>
                          <span class="lintje-data-table__mobile-measure">&nbsp;</span>
                          ${
                            measureColumn.threshold
                              ? html`<span class="lintje-data-table__mobile-status">&nbsp;</span>`
                              : nothing
                          }
                        </td>
                      </tr>`,
                    )
                  : nothing
              }
            </tbody>`
      }
      ${
        data.totals
          ? html`<tfoot>
              ${this.mobileSumRow(
                'lintje-data-table__total',
                data.totalsLabel ?? 'Totaal',
                data.totals[measureColumn.key],
                measureColumn,
                span,
              )}
            </tfoot>`
          : nothing
      }
    </table>`
  }

  /** A phone row: the name and its line, one measure, the toggle and the menu; its list under it. */
  private mobileRow(
    row: Row,
    copy: 'tile' | 'modal',
    others: TableColumnData[],
    actionColumn: boolean,
    span: number,
    measureColumn: TableColumnData,
  ): TemplateResult {
    const data = this.data as DataTableData
    const columns = this.shown
    const nameColumn = columns[0] as TableColumnData
    const selectable = Boolean(data.selectable)
    const clickable = Boolean(data.clickable) && !selectable
    const rowActions = data.rowActions?.length ? data.rowActions : null
    // The phone's one measure has the room a compact change saves: it shows the change whole.
    const measureDrawn: TableColumnData =
      measureColumn.format === 'change-compact'
        ? { ...measureColumn, format: 'change' }
        : measureColumn
    const id = this.rowKey(row)
    const detail = this.rowDetail(row)
    const status = this.mobileStatus(measureColumn, row)
    const isOpen = others.length > 0 && this.openRows.includes(id)
    const detailId = `lintje-data-table-${copy}-detail-${id}`
    const identity = html`<span class="lintje-data-table__mobile-name"
        >${this.opener(row, this.cell(nameColumn, row[nameColumn.key]))}</span
      >${this.subline(row)}`
    const selected = id === data.selectedId
    const isChecked = this.checkedIds.includes(id)
    return html`<tr
        class=${classMap({
          'lintje-data-table__mobile-row': true,
          'is-clickable': clickable,
          'is-selected': selected,
          'is-checked': isChecked,
          'is-open': isOpen,
        })}
        tabindex=${clickable ? 0 : nothing}
        aria-selected=${clickable ? selected : nothing}
        @click=${clickable ? () => this.emit('lintje-row-click', detail) : nothing}
        @keydown=${clickable ? (event: KeyboardEvent) => this.rowKeydown(event, row) : nothing}
      >
        <th scope="row" class="lintje-data-table__mobile-cell">
          ${
            selectable
              ? html`<span class="lintje-data-table__mobile-check">
                ${this.rowCheck(row, id, isChecked)}
                <span class="lintje-data-table__mobile-identity">${identity}</span>
              </span>`
              : identity
          }
        </th>
        <td class="lintje-data-table__mobile-cell lintje-data-table__mobile-cell--align-right">
          <span class="lintje-data-table__mobile-measure"
            >${this.cell(measureDrawn, row[measureColumn.key])}</span
          >
          ${
            status
              ? html`<span
                class="lintje-data-table__mobile-status lintje-data-table__mobile-status--${status.tone}"
                >${status.label}</span
              >`
              : nothing
          }
        </td>
        ${
          actionColumn
            ? html`<td
                class="lintje-data-table__mobile-cell lintje-data-table__mobile-cell--actions"
                @click=${(event: Event) => event.stopPropagation()}
                @keydown=${(event: Event) => event.stopPropagation()}
              >
                <span class="lintje-data-table__mobile-actions">
                  ${
                    others.length > 0
                      ? this.rowToggle(row, isOpen, detailId, 'lintje-data-table__mobile-toggle')
                      : nothing
                  }
                  ${
                    rowActions
                      ? renderRowActions(rowActions, detail.label, (action) =>
                          this.emit('lintje-row-action', { id, action }),
                        )
                      : nothing
                  }
                </span>
              </td>`
            : nothing
        }
      </tr>
      ${
        others.length > 0
          ? html`<tr class="lintje-data-table__mobile-detail" id=${detailId} ?hidden=${!isOpen}>
              <td class="lintje-data-table__mobile-cell" colspan=${span}>
                ${isOpen ? this.detailList(row, others, 'row') : nothing}
              </td>
            </tr>`
          : nothing
      }`
  }

  private mobileGroupRow(
    group: Group,
    open: boolean,
    measureColumn: TableColumnData,
    span: number,
  ): TemplateResult {
    const column = this.groupColumn as TableColumnData
    const subtotal = this.data?.groupTotals?.[group.key]?.[measureColumn.key]
    const count = group.rows.length
    return html`<tr class="lintje-data-table__group-row">
      <th scope="rowgroup" class="lintje-data-table__mobile-cell lintje-data-table__group-head">
        <button
          type="button"
          class="lintje-data-table__group-toggle"
          aria-expanded=${open ? 'true' : 'false'}
          @click=${() => this.toggleGroup(group.key)}
        >
          ${renderIcon('functioneel-delta-omlaag', { size: 16, rotate: open ? undefined : 270 })}
          <span class="lintje-data-table__group-name">${this.cell(column, group.value)}</span>
          <span class="lintje-data-table__group-count">${count} ${count === 1 ? 'rij' : 'rijen'}</span>
        </button>
      </th>
      <td class="lintje-data-table__mobile-cell lintje-data-table__mobile-cell--align-right">
        ${
          !open && subtotal !== undefined
            ? html`<span class="lintje-data-table__mobile-measure">${this.totalContent(measureColumn, subtotal)}</span>`
            : nothing
        }
      </td>
      ${span > 2 ? html`<td class="lintje-data-table__mobile-cell"></td>` : nothing}
    </tr>`
  }

  private mobileSumRow(
    className: string,
    label: string,
    total: TableTotal | undefined,
    measureColumn: TableColumnData,
    span: number,
  ): TemplateResult {
    return html`<tr class=${className}>
      <th scope="row" class="lintje-data-table__mobile-cell lintje-data-table__sum-label">${label}</th>
      <td class="lintje-data-table__mobile-cell lintje-data-table__mobile-cell--align-right">
        ${
          total === undefined
            ? nothing
            : html`<span class="lintje-data-table__mobile-measure">${this.totalContent(measureColumn, total)}</span>`
        }
      </td>
      ${span > 2 ? html`<td class="lintje-data-table__mobile-cell"></td>` : nothing}
    </tr>`
  }

  /**
   * A total's value with the word before it that says how it was made. A threshold judges one
   * row, not a sum: a total shows its figure plain.
   */
  private totalContent(column: TableColumnData, total: TableTotal): TemplateResult {
    const { value, how } = totalParts(total)
    const plain: TableColumnData = { ...column, threshold: undefined }
    return html`${how ? html`<span class="lintje-data-table__how">${how} </span>` : nothing}${this.cell(plain, value)}`
  }

  /** Enter or Space on the row itself; a key meant for a control inside it stays that control's. */
  private rowKeydown(event: KeyboardEvent, row: Row): void {
    if (event.target !== event.currentTarget) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    this.emit('lintje-row-click', this.rowDetail(row))
  }

  /** The page is view state, not a number: it stays out of the URL. The table counts from 0. */
  private pager(
    variant: 'full' | 'mobile',
    page: number,
    pageCount: number,
    pageSize: number,
    total: number,
    unit: { many: string; one: string },
    go: (page: number) => void,
  ): TemplateResult {
    const caption = this.data?.caption
    // While a filter narrows the rows the pager says from how many: the table's one count.
    const from = this.filteredCount ? this.data?.totalRows : undefined
    return html`<lintje-pagination
      class="lintje-data-table__pagination lintje-data-table__pagination--${variant}"
      label=${caption ? `Paginering ${caption}` : 'Paginering'}
      .page=${page + 1}
      .pageCount=${pageCount}
      .pageSize=${pageSize}
      .total=${total}
      .filteredFrom=${this.grouped ? undefined : from}
      unit=${unit.many}
      unit-one=${unit.one}
      @lintje-page-change=${(event: CustomEvent<{ page: number }>) => {
        event.stopPropagation()
        go(event.detail.page - 1)
        this.announce(`Pagina ${event.detail.page} van ${pageCount}`)
      }}
    ></lintje-pagination>`
  }

  /* Cells ------------------------------------------------------------------ */

  /** The name of an `openable` row: a button in the shape of a link, since it opens, not goes. */
  private opener(row: Row, content: unknown): unknown {
    if (!this.data?.openable) return content
    return html`<button
      type="button"
      class="lintje-data-table__open"
      @click=${(event: Event) => {
        event.stopPropagation()
        this.emit('lintje-row-open', this.rowDetail(row))
      }}
    >
      ${content}
    </button>`
  }

  private cell(column: TableColumnData, value: CellValue): unknown {
    if (value === 0 && column.zeroText != null) {
      return html`<span class="lintje-data-table__muted">${column.zeroText}</span>`
    }
    if (column.format === 'label' && value != null) {
      // The word carries the meaning; the tone and the icon confirm it (rule 13).
      const label = column.labels?.[String(value)]
      if (label) {
        return renderBadge({
          value: label.label,
          tone: label.tone,
          icon: label.icon,
          className: 'lintje-data-table__label',
        })
      }
      return String(value)
    }
    if (column.format === 'status' && value != null) {
      const tone = statusTone(column, String(value))
      if (tone) {
        return html`<lintje-status-dot
          tone=${tone}
          label=${column.status?.labels?.[String(value)] ?? nothing}
        ></lintje-status-dot>`
      }
    }
    const text = formatText(column, value)
    if (text == null) return missing
    if (
      (column.format === 'change' || column.format === 'change-compact') &&
      typeof value === 'number'
    ) {
      // Colour and glyph together (rule 13).
      const tone = value === 0 ? 'flat' : value > 0 ? 'up' : 'down'
      if (column.format === 'change-compact') {
        // The glyph alone is seen; a reader hears the whole change.
        return html`<span
            class="lintje-data-table__change lintje-data-table__change--${tone}"
            aria-hidden="true"
            >${value > 0 ? '▲' : value < 0 ? '▼' : '●'}</span
          ><span class="visually-hidden">${text}</span>`
      }
      return html`<span class="lintje-data-table__change lintje-data-table__change--${tone}">${text}</span>`
    }
    const status = thresholdStatus(column, value)
    if (!status) return text
    // The fill and a glyph together (rule 13); the words are for a screen reader.
    const glyph =
      status.tone === 'good'
        ? nothing
        : renderIcon(
            status.tone === 'caution' ? 'functioneel-waarschuwing' : 'functioneel-foutmelding',
            { size: 14, className: 'lintje-threshold-cell__icon' },
          )
    return html`<span class="lintje-threshold-cell lintje-threshold-cell--${status.tone}"
      >${glyph}${text}<span class="visually-hidden"> · ${status.label}</span></span
    >`
  }

  /**
   * A `truncate` column's cell: the drawn value on one line, cut with an ellipsis, its words in
   * the `title` for a pointer; a reader hears them whole from the hidden copy.
   */
  private truncatedCell(column: TableColumnData, value: CellValue): unknown {
    const words = cellText(column, value)
    if (words == null) return missing
    return html`<span class="lintje-data-table__cell-text" aria-hidden="true" title=${words}
        >${this.cell(column, value)}</span
      ><span class="visually-hidden">${words}</span>`
  }

  private get sublineColumns(): TableColumnData[] {
    return this.columns.filter((column) => column.mobileSubline)
  }

  private get hasSubline(): boolean {
    return Boolean(this.data?.mobileSublineTemplate) || this.sublineColumns.length > 0
  }

  private subline(row: Row): TemplateResult | typeof nothing {
    const template = this.data?.mobileSublineTemplate
    let text: string | null = null
    if (template) {
      text = template.replace(/\{(\w+)\}/g, (_, key: string) => {
        const column = this.columns.find((candidate) => candidate.key === key)
        const value = row[key]
        return (column ? formatText(column, value) : value == null ? null : String(value)) ?? '—'
      })
    } else if (this.sublineColumns.length > 0) {
      text = this.sublineColumns
        .map((column) => formatText(column, row[column.key]) ?? '—')
        .join(' · ')
    }
    if (text == null) return nothing
    return html`<span class="lintje-data-table__mobile-sub">${text}</span>`
  }

  private mobileStatus(
    column: TableColumnData,
    row: Row,
  ): { label: string; tone: 'within' | 'outside' } | null {
    if (!column.threshold) return null
    const status = thresholdStatus(column, row[column.key])
    return status && { label: status.label, tone: status.outside ? 'outside' : 'within' }
  }

  /* The check column ------------------------------------------------------- */

  /** The header box covers all rows, not only this page. */
  private headerCheck(): TemplateResult {
    const uncheckable = this.uncheckable
    const rows = this.rows.filter((row) => !uncheckable.has(this.rowKey(row)))
    const checked = new Set(this.checkedIds)
    const count = rows.filter((row) => checked.has(this.rowKey(row))).length
    return this.checkbox(
      html`<span class="visually-hidden">Alles selecteren</span>`,
      rows.length > 0 && count === rows.length,
      count > 0,
      (on) => this.setChecked(on ? rows.map((row) => this.rowKey(row)) : []),
    )
  }

  private rowCheck(row: Row, id: string, isChecked: boolean): TemplateResult {
    const nameColumn = this.columns[0]
    const name = nameColumn ? this.sortValue(nameColumn, row) : id
    return this.checkbox(
      html`<span class="visually-hidden">${`${name} selecteren`}</span>`,
      isChecked,
      false,
      (on) => {
        const others = this.checkedIds.filter((key) => key !== id)
        if (on && this.#shift && this.data?.bulkActions) {
          const uncheckable = this.uncheckable
          const order = this.sortedRows
            .map((candidate) => this.rowKey(candidate))
            .filter((key) => !uncheckable.has(key))
          this.setChecked(withRange(this.checkedIds, rangeIds(order, this.#rangeAnchor, id)))
        } else this.setChecked(on ? [...others, id] : others)
        this.#rangeAnchor = id
      },
      this.uncheckable.has(id),
    )
  }

  /** The checkbox markup of `inputs/shared/input.css`, without an element of its own. */
  private checkbox(
    label: unknown,
    checked: boolean,
    indeterminate: boolean,
    onChange: (checked: boolean) => void,
    disabled: boolean = false,
  ): TemplateResult {
    return html`<label class="lintje-choice${disabled ? ' is-disabled' : ''}">
      <input
        type="checkbox"
        class="lintje-choice__input"
        ?disabled=${disabled}
        .checked=${checked}
        .indeterminate=${indeterminate && !checked}
        @change=${(event: Event) => onChange((event.target as HTMLInputElement).checked)}
        @click=${(event: MouseEvent) => {
          event.stopPropagation()
          this.#shift = event.shiftKey
        }}
      />
      <span class="lintje-choice__box" aria-hidden="true"
        ><span class="lintje-choice__mark">${indeterminate && !checked ? '–' : '✓'}</span></span
      >
      <span class="lintje-choice__label">${label}</span>
    </label>`
  }
}

define('lintje-data-table', LintjeDataTable)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-data-table': LintjeDataTable
  }
}
