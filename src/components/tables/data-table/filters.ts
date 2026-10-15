/**
 * Column filters and the column chooser in `<lintje-data-table>`.
 *
 * Applying a filter is `lintje-filter-change` `{ column, value }`; the table does not filter, the
 * host does. The chooser sends `lintje-columns-change` `{ order, hidden }`; the first column
 * stays first and shown. Range and period filters are not here.
 */
import { html, nothing, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { renderIcon } from '../../../icons/render'
import '../../overlays/popover/popover'
import '../../actions/button/button'
import '../../overlays/tooltip/tooltip'
import '../../overlays/drawer/drawer'
import '../sortable-list/sortable-list'
import type { SortableItem } from '../sortable-list/sortable-list'
import type { TableColumnData } from '../../../types'
import { deepActiveElement, tabbables } from '../../shared/focus-trap'
import { standsIn } from '../../../core/focus'

export type FilterValue = string[] | string

export function isFilterActive(value: FilterValue | null | undefined): value is FilterValue {
  return Array.isArray(value) ? value.length > 0 : typeof value === 'string' && value.trim() !== ''
}

/** A filter's value as reported: `null` when it filters nothing. */
export function filterOut(value: FilterValue | null | undefined): FilterValue | null {
  if (!isFilterActive(value)) return null
  return Array.isArray(value) ? value : value.trim()
}

function optionLabel(column: TableColumnData, value: string): string {
  return column.filter?.options?.find((option) => option.value === value)?.label ?? value
}

export function chipText(column: TableColumnData, value: FilterValue): string {
  const said = Array.isArray(value)
    ? value.map((entry) => optionLabel(column, entry)).join(', ')
    : `‘${value}’`
  return `${column.header}: ${said}`
}

export function funnelLabel(
  column: TableColumnData,
  value: FilterValue | null | undefined,
): string {
  const name = `Filter op ${column.header.toLocaleLowerCase('nl')}`
  if (!isFilterActive(value)) return name
  return Array.isArray(value) ? `${name}, ${value.length} gekozen` : `${name}, ‘${value}’`
}

/** The first column always first and shown; the rest in `order` (unnamed keys last) minus `hidden`. */
export function shownColumns(
  columns: readonly TableColumnData[],
  order: readonly string[] | null,
  hidden: readonly string[],
): TableColumnData[] {
  const [first, ...rest] = columns
  if (!first) return []
  const hide = new Set(hidden)
  const rank = new Map((order ?? []).map((key, index) => [key, index]))
  const ordered = rest
    .map((column, index) => ({ column, index }))
    .sort(
      (a, b) =>
        (rank.get(a.column.key) ?? rank.size + a.index) -
        (rank.get(b.column.key) ?? rank.size + b.index),
    )
    .map((entry) => entry.column)
  return [first, ...ordered.filter((column) => !hide.has(column.key))]
}

/** The `lintje-columns-change` payload. */
export function columnsChange(
  first: string,
  order: readonly string[],
  checked: readonly string[],
): { order: string[]; hidden: string[] } {
  const shown = new Set(checked)
  return { order: [first, ...order], hidden: order.filter((key) => !shown.has(key)) }
}

/* --- Drawing --------------------------------------------------------------- */

/** How the focus left a column panel: Tab past its first or last stop, or anywhere else. */
export type PanelLeave = 'back' | 'forward' | 'away'

/**
 * The panel stands after the table in the tab order, so Tab out of it would walk the whole table
 * with the panel still open: it closes instead, and the focus continues from its anchor.
 */
function panelLeave(anchor: Element | null, onLeave: (how: PanelLeave) => boolean) {
  return {
    // A press on the panel's text moves the focus to a focusable box around the table: not away.
    focusout: (event: FocusEvent): void => {
      const next = event.relatedTarget as Node | null
      const panel = event.currentTarget as Element
      const table = (panel.getRootNode() as ShadowRoot).host
      if (!next || next === anchor || panel.contains(next) || standsIn(table, next)) return
      onLeave('away')
    },
    keydown: (event: KeyboardEvent): void => {
      if (event.key !== 'Tab' || event.defaultPrevented) return
      const stops = tabbables(event.currentTarget as Element)
      const at = stops.indexOf(deepActiveElement() as HTMLElement)
      if (event.shiftKey ? at > 0 : at !== stops.length - 1) return
      if (onLeave(event.shiftKey ? 'back' : 'forward')) event.preventDefault()
    },
  }
}

export function renderFunnel(
  column: TableColumnData,
  value: FilterValue | null | undefined,
  expanded: boolean,
  onOpen: (anchor: HTMLElement) => void,
): TemplateResult {
  const active = isFilterActive(value)
  return html`<button
      type="button"
      class=${classMap({ 'lintje-data-table__funnel': true, 'is-filtered': active })}
      data-column=${column.key}
      aria-label=${funnelLabel(column, value)}
      aria-haspopup="dialog"
      aria-expanded=${expanded ? 'true' : 'false'}
      @click=${(event: Event) => onOpen(event.currentTarget as HTMLElement)}
    >
      ${renderIcon('functioneel-trechter', { size: 14 })}
    </button>`
}

export function renderFilterField(
  column: TableColumnData,
  value: FilterValue | undefined,
  onChange: (value: FilterValue) => void,
): TemplateResult {
  if (column.filter?.kind === 'text') {
    return html`<input
      type="search"
      class="lintje-data-table__filter-search"
      aria-label=${`Zoek in ${column.header.toLocaleLowerCase('nl')}`}
      .value=${typeof value === 'string' ? value : ''}
      @input=${(event: Event) => onChange((event.target as HTMLInputElement).value)}
    />`
  }
  const checked = new Set(Array.isArray(value) ? value : [])
  return html`<div class="lintje-data-table__filter-options">
    ${(column.filter?.options ?? []).map(
      (option) => html`<label class="lintje-choice lintje-data-table__filter-option">
        <input
          type="checkbox"
          class="lintje-choice__input"
          .checked=${checked.has(option.value)}
          @change=${(event: Event) => {
            const on = (event.target as HTMLInputElement).checked
            const rest = [...checked].filter((entry) => entry !== option.value)
            onChange(on ? [...rest, option.value] : rest)
          }}
        />
        <span class="lintje-choice__box" aria-hidden="true"
          ><span class="lintje-choice__mark">✓</span></span
        >
        <span class="lintje-choice__label">${option.label ?? option.value}</span>
        ${
          option.count == null
            ? nothing
            : html`<span class="lintje-data-table__filter-count">${option.count}</span>`
        }
      </label>`,
    )}
  </div>`
}

export function renderFilterPopover(options: {
  column: TableColumnData
  anchor: Element | null
  draft: FilterValue | undefined
  onDraft: (value: FilterValue) => void
  onApply: () => void
  onClear: () => void
  onClose: () => void
  onLeave: (how: PanelLeave) => boolean
}): TemplateResult {
  const { column } = options
  const leave = panelLeave(options.anchor, options.onLeave)
  return html`<lintje-popover
    open
    panel-role="dialog"
    label=${funnelLabel(column, null)}
    .anchor=${options.anchor}
    @focusout=${leave.focusout}
    @keydown=${leave.keydown}
    @lintje-close=${(event: Event) => {
      event.stopPropagation()
      options.onClose()
    }}
  >
    <div class="lintje-data-table__filter-panel">
      <div class="lintje-data-table__filter-name">${column.header}</div>
      ${renderFilterField(column, options.draft, options.onDraft)}
      <div class="lintje-data-table__filter-actions">
        <lintje-button variant="tertiary" size="compact" @click=${options.onClear}>Wissen</lintje-button>
        <lintje-button variant="primary" size="compact" @click=${options.onApply}>Toepassen</lintje-button>
      </div>
    </div>
  </lintje-popover>`
}

/** Below 768 px every column's filter is in one drawer. */
export function renderFiltersSheet(options: {
  columns: TableColumnData[]
  draft: Record<string, FilterValue>
  onDraft: (column: string, value: FilterValue) => void
  onApply: () => void
  onClear: () => void
  onClose: () => void
}): TemplateResult {
  return html`<lintje-drawer
    open
    heading="Filters"
    @lintje-close=${(event: Event) => {
      event.stopPropagation()
      options.onClose()
    }}
  >
    ${options.columns.map(
      (column) => html`<section class="lintje-data-table__filter-section">
        <div class="lintje-data-table__filter-name">${column.header}</div>
        ${renderFilterField(column, options.draft[column.key], (value) =>
          options.onDraft(column.key, value),
        )}
      </section>`,
    )}
    <lintje-button slot="footer" variant="tertiary" @click=${options.onClear}>Wissen</lintje-button>
    <lintje-button slot="footer" variant="primary" @click=${options.onApply}>Toepassen</lintje-button>
  </lintje-drawer>`
}

export function renderToolbar(options: {
  columns: TableColumnData[]
  values: Record<string, FilterValue>
  /** "6 van 131 rijen" while a filter is active and no pager below says it; else empty. */
  count: string
  /** Below 768 px, beside "Filters": the sort on any column. */
  sortMenu?: unknown
  /** The table's own controls at the toolbar's end ("Alles inklappen"). */
  chooser?: unknown
  onClearFilter: (column: string, button: HTMLElement) => void
  onClearAll: (button: HTMLElement) => void
  /** Whether the sheet of filters is open, for the "Filters" button's `aria-expanded`. */
  sheetOpen: boolean
  onOpenSheet: () => void
}): TemplateResult {
  const active = options.columns.filter((column) => isFilterActive(options.values[column.key]))
  // With neither a chip nor a tool, the row only holds the phone's "Filters" and "Sorteren".
  const quiet = active.length === 0 && !options.chooser
  return html`<div
    class="lintje-data-table__toolbar ${quiet ? 'lintje-data-table__toolbar--quiet' : ''}"
  >
    <div class="lintje-data-table__chips">
      ${
        options.columns.length > 0
          ? html`<lintje-button
              class="lintje-data-table__sheet-button"
              variant="secondary"
              size="compact"
              icon="functioneel-filters"
              haspopup="dialog"
              .expanded=${options.sheetOpen}
              @click=${options.onOpenSheet}
              >Filters</lintje-button
            >`
          : nothing
      }
      ${options.sortMenu ?? nothing}
      ${active.map((column) => {
        const value = options.values[column.key] as FilterValue
        return html`<span class="lintje-data-table__chip"
          >${chipText(column, value)}<button
            type="button"
            class="lintje-data-table__chip-clear"
            aria-label=${`${funnelLabel(column, null)} wissen`}
            @click=${(event: Event) =>
              options.onClearFilter(column.key, event.currentTarget as HTMLElement)}
          >
            ${renderIcon('functioneel-kruis', { size: 12 })}
          </button></span
        >`
      })}
      ${
        active.length > 1
          ? html`<button
              type="button"
              class="lintje-button lintje-button--tertiary lintje-button--compact lintje-data-table__clear-all"
              @click=${(event: Event) => options.onClearAll(event.currentTarget as HTMLElement)}
            >
              <span class="lintje-button__label">Filters wissen</span>
            </button>`
          : nothing
      }
      ${options.count ? html`<span class="lintje-data-table__filter-total">${options.count}</span>` : nothing}
    </div>
    ${options.chooser ?? nothing}
  </div>`
}

/**
 * "Kolommen kiezen": a quiet icon at the end of the head, above the rows' menus, where the columns
 * are. The tooltip says its name, which is already the button's own.
 */
export function renderChooserButton(
  expanded: boolean,
  onOpen: (anchor: HTMLElement) => void,
): TemplateResult {
  return html`<lintje-tooltip text="Kolommen kiezen" no-describe
    ><button
      type="button"
      class="lintje-data-table__chooser-button"
      aria-label="Kolommen kiezen"
      aria-haspopup="dialog"
      aria-expanded=${expanded ? 'true' : 'false'}
      @click=${(event: Event) => onOpen(event.currentTarget as HTMLElement)}
    >
      ${renderIcon('functioneel-kolommen', { size: 18 })}
    </button></lintje-tooltip
  >`
}

export function renderColumnChooser(options: {
  first: TableColumnData
  items: SortableItem[]
  anchor: Element | null
  onOrder: (order: string[]) => void
  onChecked: (checked: string[]) => void
  /** Every column shown, in the host's order; disabled while that is what stands. */
  onReset: () => void
  isDefault: boolean
  onClose: () => void
  onLeave: (how: PanelLeave) => boolean
}): TemplateResult {
  const leave = panelLeave(options.anchor, options.onLeave)
  return html`<lintje-popover
    open
    panel-role="dialog"
    label="Kolommen kiezen"
    placement="bottom-end"
    .anchor=${options.anchor}
    @focusout=${leave.focusout}
    @keydown=${leave.keydown}
    @lintje-close=${(event: Event) => {
      event.stopPropagation()
      options.onClose()
    }}
  >
    <div class="lintje-data-table__filter-panel">
      <div class="lintje-data-table__filter-name">Kolommen</div>
      <p class="lintje-data-table__chooser-note">${options.first.header} staat altijd vooraan.</p>
      <lintje-sortable-list
        checkable
        label="Volgorde en zichtbaarheid van de kolommen"
        .items=${options.items}
        @lintje-change=${(event: CustomEvent<string[]>) => {
          event.stopPropagation()
          options.onOrder(event.detail)
        }}
        @lintje-checked-change=${(event: CustomEvent<string[]>) => {
          // These boxes are column visibility; the table's own checked-change is its rows.
          event.stopPropagation()
          options.onChecked(event.detail)
        }}
      ></lintje-sortable-list>
      <lintje-button
        class="lintje-data-table__chooser-reset"
        variant="tertiary"
        size="compact"
        ?disabled=${options.isDefault}
        reason="Elke kolom staat al, in de standaardvolgorde."
        @click=${() => {
          if (!options.isDefault) options.onReset()
        }}
        >Terugzetten naar standaard</lintje-button
      >
    </div>
  </lintje-popover>`
}
