/**
 * The data contract. Everything here crosses from a host as JSON: no functions, components or
 * dates. The field names are the contract; renaming one is a breaking change.
 * Chart, map and element shapes are re-exported from where they are drawn; the data colours'
 * names come from their one list, `tokens/colors.ts`.
 */
import type { DataColor } from './tokens/colors'
import type { ContentStateKind, Tone, WorkState } from './components/shared/tone'
import type { StatusTone } from './components/feedback/status-dot/status-dot'
import type { AnnouncementKind } from './components/shared/announcement-block'
import type { ChartSpec, MapSpec } from './components/shared/charts/shared/types'
import type { MenuEntry } from './components/actions/menu-button/menu-button'
import type { NotificationItem } from './components/frame/notifications/notifications'
import type { UploadFile } from './components/shared/files'

export type {
  BarSeriesData,
  ChartColor,
  ChartEvent,
  ChartForecast,
  ChartKind,
  ChartSpec,
  LineSeriesData,
  MapSpec,
  MapValue,
  MapSeriesKey,
  MapSeriesColor,
  MapSeriesStyle,
  MapPlotData,
  MapPlotVariant,
  MapVariant,
  ScatterPoint,
  SankeyFlow,
  SankeyNode,
  SankeyStep,
  ScatterSeriesData,
  DumbbellRow,
  WmsBasemap,
  MapArea,
  MapControls,
  RadarSeriesData,
  TreemapPart,
  TreemapSubPart,
} from './components/shared/charts/shared/types'
export type { SeriesShape } from './components/shared/charts/shared/series-shapes'
export type { DataColor } from './tokens/colors'
export type { Tone, WorkState, ContentStateKind } from './components/shared/tone'

/** Settings every view receives, taken from the URL by the host. */
export interface FrameSettings {
  mode?: 'light' | 'dark'
}

export interface ContentState {
  state?: ContentStateKind
  /** Empty: why there is nothing, and the way out. Error: what failed. */
  message?: string
  /** Error: the last known value, shown in the warning. */
  lastKnown?: string
}

/** A source's delivery status: the status column's and `lintje-status-dot`'s own words, each a `Tone`. */
export type { StatusTone } from './components/feedback/status-dot/status-dot'

export type TrendDirection = 'up' | 'down' | 'flat'

/* KPI row ------------------------------------------------------------------ */

/**
 * One colour per variable, named after the Rijkshuisstijl colour it is: a `DataColor`, the
 * names of `tokens/colors.ts`. `coverage` is a role, not a variable: gray.
 */
export type KpiVariable = DataColor | 'coverage'

/** The same four as every tile's `ContentState`. */
export type KpiState = ContentStateKind

export interface KpiItem {
  /** A string or number with one number in it; counts up like `value`. */
  value: string | number
  /** Smaller suffix within the value, e.g. "min" or "van 29". */
  suffix?: string
  /** The period of the figure, e.g. "Huidige maand". */
  period?: string
}

export interface KpiTrend {
  direction: TrendDirection
  sentence: string
  /** For variables where rising is bad (wait time, refusals). */
  inverted?: boolean
}

/**
 * The figure's own recent values as a small line with the area under it: no axes, scaled from
 * the lowest to the highest value, in the variable's colour. A `null` breaks the line (rule 15).
 */
export interface KpiSparkline {
  /** The values in order, the current one last; at least two numbers draw a line. */
  values: (number | null)[]
  /** A readable summary with the unit, the line's `<desc>`: the accessible alternative. */
  description: string
}

/** Where the figure stands on a scale, drawn under or around the value. */
export interface KpiGauge {
  /** `arc`: a half circle with the value in its mouth. `linear`: a bar under the value. */
  shape?: 'arc' | 'linear'
  /** Where the scale starts; default 0. */
  min?: number
  max: number
  /** The figure on the scale; default the number in the KPI's `value`. `null` draws no fill. */
  value?: number | null
  /** A dashed mark on the scale, in the emphasis colour. */
  target?: number
  /** The word before the target's number: "doel" (default) or "norm". */
  targetLabel?: string
}

/** `message` is the empty or error line under the figure, `lastKnown` the figure it had. */
export interface KpiData extends ContentState {
  label: string
  /** An icon file name (`dist-icons/`, without `.svg`). Decorative. */
  icon?: string
  value?: string | number
  suffix?: string
  items?: KpiItem[]
  layout?: 'row' | 'column'
  emphasis?: 'equal' | 'primary'
  dividers?: boolean
  trend?: KpiTrend
  sparkline?: KpiSparkline
  note?: string
  detail?: string
  /** A single figure on its scale; ignored with `items`. */
  gauge?: KpiGauge
  variable?: KpiVariable
}

/** Events: none. */
export interface KpiRowData extends FrameSettings {
  kpis: KpiData[]
  columns?: number
}

export interface TileData {
  title?: string
  /** An icon file name (`dist-icons/`, without `.svg`). Decorative. */
  icon?: string
  subtitle?: string
  intro?: string
  footnote?: string
  /** An announcement inside the tile, e.g. a source running behind. */
  notice?: AnnouncementData
  /** Shows the expand button. A chart tile has it unless `false`; others only when set. */
  expandable?: boolean
  /**
   * Shows the download button (CSV built from the view's data). A chart tile has it unless
   * `false`; a map tile and a table only when given a file name.
   */
  download?: { filename: string } | false
  legendBelow?: boolean
  /** Columns of the 12-column grid when several tiles share one mount. */
  span?: number
  /** The subtitle below 768 px, where it says something else (e.g. "tik op een cel"). */
  mobileSubtitle?: string
  /**
   * On a phone, below 768 px, the tile shows only its head with a button that unfolds the rest
   * (`collapsed-mobile` on `lintje-tile`): for a view that matters less there than its neighbours.
   */
  collapsedMobile?: boolean
}

/* Chart tile --------------------------------------------------------------- */

/**
 * Events: `lintje-mark-select` `{id, label, href}` when a mark with a `href` is clicked,
 * `{id: null, href: clearHref}` when the selection is undone; uncancelled, the page goes to
 * that `href`.
 */
export interface ChartData extends FrameSettings, TileData, ContentState {
  chart: ChartSpec
  /** The chart's `<desc>`: a readable summary, the accessible alternative. Required. */
  description: string
  /** The chosen mark, by the id its link carries: it is outlined, the rest step back. */
  selectedId?: string | null
  /** The URL that undoes the selection; clicking the chosen mark again and Escape follow it. */
  clearHref?: string
}

/* Map tile ----------------------------------------------------------------- */

/**
 * Events: `lintje-mark-select` `{id, label, href?}` on a click on an area or point,
 * `{id: null, href: clearHref}` when undone; `lintje-layer-change` with the chosen layer;
 * with `controls.lasso` or `controls.circle`, `lintje-area-select` `{area, ids}` for a drawn area and
 * `{area: null, ids: []}` when it is undone. An uncancelled `lintje-mark-select` goes to its
 * `href`.
 */
export interface MapData extends FrameSettings, TileData, ContentState, MapSpec {}

/* Graph tile --------------------------------------------------------------- */

/** A kind of node: its words, its icon and its data colour. */
export interface GraphNodeType {
  /** What a node's `type` names. */
  key: string
  /** The kind in words, singular: "Persoon". */
  label: string
  /** The kind in words, plural, which names a group of them: "Personen". Without it `label`. */
  plural?: string
  /** An icon file name (`dist-icons/`, without `.svg`). */
  icon: string
  /** The kind's data colour; without it the colour of its place in `types`. */
  color?: DataColor
}

/** A state of a node in words, with the tone its dot takes: "geldend", "vervallen". */
export interface GraphNodeStatus {
  label: string
  /** Default `neutral`. */
  tone?: Tone
}

export interface GraphNode {
  id: string
  label: string
  /** The `key` of its type. */
  type: string
  status?: GraphNodeStatus
  /** Drawn in a circle instead of the type's icon, for a person. */
  initials?: string
  /** How many relations the host has not loaded yet; its counter asks for them. */
  more?: number
}

/** `to`: an arrowhead at `to`; `both`: at both ends; `none`: a relation without direction. */
export type GraphDirection = 'to' | 'both' | 'none'

export interface GraphEdge {
  from: string
  to: string
  /** The relation's word, on the line: "aanvrager", "werkt bij". */
  label?: string
  /** Default `to`. */
  direction?: GraphDirection
  /** A number the line's thickness shows, from 1.5 to 4 px over the largest of the graph. */
  value?: number
  /** The number's unit, after it in the tooltip: "records per dag". */
  unit?: string
}

/** Layered to the right or downwards, by force, or in rings round the centre. */
export type GraphLayout = 'layered-right' | 'layered-down' | 'force' | 'radial'

/** `orthogonal` draws a layered graph in right angles; elsewhere it is straight. */
export type GraphLines = 'straight' | 'curved' | 'orthogonal'

/**
 * Events: `lintje-node-select` `{id, label}` for a chosen node, `{id: null, label: null}` when
 * undone; `lintje-node-toggle` `{id, open}` when a branch or a group is opened or folded, one per
 * node when the reset button sets it all back; `lintje-node-expand` `{id}` when a node with `more`
 * is opened. With `download` the tile offers the drawing as a PNG.
 */
export interface GraphData extends FrameSettings, TileData, ContentState {
  /** The kinds in the order the legend and the colours take them. */
  types: GraphNodeType[]
  nodes: GraphNode[]
  edges: GraphEdge[]
  /** The drawing's `<desc>`: what the graph shows, the accessible alternative. Required. */
  description: string
  /** Without it the element chooses by the graph's shape. */
  layout?: GraphLayout
  /** Without it straight, and curved round the centre in `radial`. */
  lines?: GraphLines
  /** The chosen node: outlined, its relations and neighbours lit, the rest stepped back. */
  selected?: string | null
  /** Nodes whose branch is folded. */
  collapsed?: string[]
  /** Groups the reader opened, by the id `lintje-node-toggle` gave them. */
  opened?: string[]
  /** Draws each kind's icon and mark in its data colour; default true. */
  typeColors?: boolean
  /** The drawing's height in px; without it 480, and 360 on a phone. */
  height?: number
}

/* Data table --------------------------------------------------------------- */

export type CellValue = string | number | null

export interface TableColumnData {
  key: string
  header: string
  align?: 'left' | 'right'
  sortable?: boolean
  /**
   * The value stays on one line and a long one ends in an ellipsis: the column is as wide as its
   * longest value, up to a cap. The whole value stays in the `title` and for a screen reader, and
   * wraps under the keyboard's focus and without hover. Not below 768 px, where values wrap.
   */
  truncate?: boolean
  /**
   * How a value shows; default `number` for numbers. `change`: a signed percentage with ▲ ▼ ●.
   * `change-compact`: only the ▲ ▼ ● of `change`, its words in a tooltip (`tooltip`); a screen
   * reader hears them, and below 768 px the row's measure shows the change whole.
   * `status`: a `StatusTone` (or mapped through `status.tones`) as the status dot with its label.
   * `label`: the value as a badge with the word, tone and icon from `labels`.
   * `person`: the value is an id in `people`, drawn as `lintje-person`.
   */
  format?:
    | 'text'
    | 'number'
    | 'percent'
    | 'decimal'
    | 'change'
    | 'change-compact'
    | 'status'
    | 'label'
    | 'person'
  /**
   * `change-compact`: the words the glyph stands for, as a template with `{key}` placeholders
   * filled from the row, each value read the way its column reads it (`{change}` gives
   * "▲ +4,2%"). They are the glyph's tooltip, a screen reader hears them, and under the keyboard's
   * focus or without hover they stand whole. Without it, the whole change. Other formats ignore it.
   */
  tooltip?: string
  decimals?: number
  /** Suffix after the value, e.g. "min". */
  unit?: string
  /** Threshold status next to the value (color plus glyph and text, rule 13). */
  threshold?: {
    value: number
    /** From here on the bad side of `value` shows the orange caution tone. */
    caution?: number
    direction?: 'above-is-bad' | 'below-is-bad'
  }
  /** `status` format: value → tone, and value → label (default the tone's own label). */
  status?: { tones?: Record<string, StatusTone>; labels?: Record<string, string> }
  /**
   * `label` format: value → the word, the badge's tone and an icon file name before the word. A
   * value without an entry stands as plain text. Sorting and the CSV use the word.
   */
  labels?: Record<string, TableLabel>
  /**
   * `person` format: value → the person it stands for, as `labels` does for a label. An id without
   * an entry stands as plain text. Sorting, filtering and the CSV use the name.
   */
  people?: Record<string, Person>
  /** `person` format: the word for `null`; default "Niet toegewezen". */
  empty?: string
  /** Shown muted instead of an exact 0, where 0 means "none" (e.g. "—"). Missing stays `null`. */
  zeroText?: string
  mobileSubline?: boolean
  mobileMeasure?: boolean
  /** Cells are editable in the table (desktop only); `lintje-cell-edit` carries the new value. */
  editor?: TableCellEditor
  /** A filter in the column's header; its value comes back in `DataTableData.filters`. */
  filter?: TableColumnFilter
}

export interface TableOption {
  value: string
  /** What the reader sees; default the value. */
  label?: string
  /** An options filter: the number of rows with this value, shown after the label. */
  count?: number
}

/** The field an editable cell becomes. `date` is a `dd-mm-jjjj` text field the host validates; its column sorts by date. */
export interface TableCellEditor {
  kind: 'text' | 'number' | 'select' | 'date'
  options?: TableOption[]
}

/** A column filter: checkboxes over `options`, or one search field (`text`). */
export interface TableColumnFilter {
  kind: 'options' | 'text'
  options?: TableOption[]
}

export interface TableCellRef {
  id: string
  column: string
}

/** A cell whose save the host refused; the cell stays open with the message under it. */
export interface TableCellError extends TableCellRef {
  message: string
  /** The value that was refused; default the value the reader typed. */
  value?: string
}

export interface TableAction {
  /** What `lintje-row-action` / `lintje-bulk-action` carries as `action`. */
  value: string
  label: string
  /** A file name, 16 px before the label in a row's menu. */
  icon?: string
  /** Cannot be undone: drawn in the error colour. The host confirms before it acts. */
  danger?: boolean
  disabled?: boolean
}

/** What `lintje-row-click` and `lintje-row-open` carry, in `lintje-list` and `lintje-data-table`. */
export interface RowClickDetail {
  id: string
  /** The row's name: a list row's title, a table row's first column. */
  label: string
  /** The address the host gave the row, if any. */
  href?: string
}

/** What `lintje-row-action` carries, in `lintje-list` and `lintje-data-table`. */
export interface RowActionDetail {
  id: string
  /** The row's name: a list row's title, a table row's first column. */
  label: string
  /** The `value` of the chosen action. */
  action: string
}

export interface SortState {
  key: string
  direction: 'asc' | 'desc'
}

/**
 * Events: `lintje-row-click` with `{id, label, href?}` in a clickable table;
 * `lintje-row-open` with `{id, label, href?}` from the name of an `openable` one; uncancelled,
 * either goes to the row's `href`;
 * `lintje-checked-change` with the checked keys in a selectable one;
 * `lintje-sort-change` with `{key, direction}` or `null`;
 * `lintje-cell-edit` `{id, column, value}` from an `editor` column;
 * `lintje-row-action` `{id, label, action}` from `rowActions`;
 * `lintje-bulk-action` `{ids, action}` from `bulkActions`;
 * `lintje-filter-change` `{column, value}` (`string[] | string | null`) from a column `filter`;
 * `lintje-columns-change` `{order, hidden}` from the `columnChooser`.
 */
export interface DataTableData extends FrameSettings, TileData, ContentState {
  /** The table's `<caption>`. Required; visually hidden when the tile has a title. */
  caption: string
  columns: TableColumnData[]
  /** One object per row. A key that is not a column is carried, not drawn (e.g. `href`). */
  rows: Record<string, CellValue>[]
  rowKey: string
  pageSize?: number
  sort?: SortState | null
  /** The order without a sort choice; choosing it again clears `sort`. Default: first column. */
  defaultSort?: SortState
  /** The line under a row's name below 768 px, as a template with `{key}` placeholders. */
  mobileSublineTemplate?: string
  /** Rows are clickable (drilldown) … */
  clickable?: boolean
  selectedId?: string | null
  /** … or selectable (compare), never both. */
  selectable?: boolean
  /**
   * The name (the first column) is a link that opens the row (`lintje-row-open`), also in a
   * selectable table. The name is then not edited in its cell, even with an `editor`.
   */
  openable?: boolean
  checkedIds?: string[]
  /** Rows whose box cannot be checked: drawn disabled, and left out of "Alles selecteren". */
  uncheckableIds?: string[]
  /** The cells the host is saving: the new value muted behind a spinner, not editable. */
  busyCells?: TableCellRef[]
  /** The cells whose save failed: open, with the message under the field. */
  cellErrors?: TableCellError[]
  /** A menu at the end of every row (`lintje-row-action`); `'separator'` draws a line. */
  rowActions?: (TableAction | 'separator')[]
  /** Actions on the checked rows (`lintje-bulk-action`); `[]` shows only the count. */
  bulkActions?: TableAction[]
  /** The current column filters by column key. The host filters the rows. */
  filters?: Record<string, string[] | string>
  /** The number of rows before filtering: "14 van 131 rijen" while a filter is active. */
  totalRows?: number
  /**
   * "Kolommen kiezen", a quiet icon in the head of the last column, to order and hide columns
   * (`lintje-columns-change`). Without row actions it adds that column.
   */
  columnChooser?: boolean
  /** The keys of the columns not shown. The first column is always shown. */
  hiddenColumns?: string[]
  /**
   * The totals row under the rows, as the host computed it over every filtered row: the table
   * never computes. A column without an entry stays empty.
   */
  totals?: Record<string, TableTotal>
  /** The first cell of the totals row; default "Totaal". */
  totalsLabel?: string
  /**
   * Fields shown under a row that opens, after the columns the chooser hides. With them, or with a
   * hidden column, every row gets a button that opens its detail.
   */
  detailFields?: TableDetailField[]
  /**
   * Groups the rows on this column's value, in the order the groups first occur in `rows`. Rows
   * sort within their group, a page holds whole groups, and the column itself is not shown.
   */
  groupBy?: string
  /** Per group value: its subtotal row, as the host computed it. */
  groupTotals?: Record<string, Record<string, TableTotal>>
  /** With `groupBy`: groups per page, default 5; `pageSize` does not apply. */
  groupsPerPage?: number
}

/** A badge in a `label` column. */
export interface TableLabel {
  label: string
  /** One of the shared tones, as `lintje-badge` draws it; default `neutral`. */
  tone?: Tone
  /** An icon file name, drawn before the word. */
  icon?: string
}

/** A total: a value, or a value with the word that says how it was made ("gem."). */
export type TableTotal = CellValue | { value: CellValue; how?: string }

/** A field in a row's detail: a key of the row, with its label and how its value shows. */
export interface TableDetailField {
  key: string
  label: string
  format?: TableColumnData['format']
  decimals?: number
  unit?: string
}

/* Announcement ------------------------------------------------------------- */

/** `outage` interrupts and cannot be closed; `error` is a failure the reader may put away. */
export type { AnnouncementKind } from './components/shared/announcement-block'

export interface AnnouncementData {
  kind?: AnnouncementKind
  title?: string
  text: string
  meta?: string
  link?: { label: string; href: string }
  /** Remembers a dismissal under this id. An outage can't be dismissed. */
  announcementId?: string
  dismissible?: boolean
  /** A live region (`role="alert"`/`"status"`): set it when the message answers an action. */
  live?: boolean
}

/** Events: none. */
export interface AnnouncementViewData extends FrameSettings, AnnouncementData {
  tile?: TileData
}

/* Explainer and note ------------------------------------------------------- */

/** Events: none. */
export interface ExplainerData extends FrameSettings {
  title: string
  items: { term: string; description: string }[]
  defaultOpen?: boolean
}

/** Events: none. */
export interface NoteData extends FrameSettings {
  title?: string
  date: string
  text: string
  author: string
}

/* Page header -------------------------------------------------------------- */

/** The title zone of a page, with an announcement above it. Events: none. */
export interface PageHeaderData extends FrameSettings {
  /** A short line above the title below 768 px, such as the name of the application. */
  kicker?: string
  title: string
  /** A line under the title. */
  description?: string
  asOf?: string
  source?: string
  more?: { label?: string; href: string }
  announcement?: AnnouncementData
}

/* Filter bar --------------------------------------------------------------- */

/**
 * A filter value as it crosses: the canonical strings a host writes to the URL.
 * `range` holds indexes into `steps`; a date range holds ISO dates.
 */
export type FilterValue =
  | string
  | string[]
  | { from: string | null; to: string | null }
  | [number, number]
  | boolean
  | number
  | null

export interface FilterOption {
  value: string
  label: string
  /**
   * A second, gray line under the label where the control draws one (`lintje-multiselect`); in
   * `lintje-segmented` the chosen option's, in a box under the options.
   */
  description?: string
  /** The number of items with this value, as a count badge after the label where the control draws one (`lintje-segmented`). */
  count?: number
}

/** The control a declaration draws in. `range` has two handles, `slider` one. */
export type FilterKind =
  | 'select'
  | 'segmented'
  | 'multiselect'
  | 'date-range'
  | 'range'
  | 'slider'
  | 'toggle'
  | 'text'
  | 'number'

export interface FilterDefinition {
  key: string
  label: string
  kind: FilterKind
  options?: FilterOption[]
  steps?: (string | number)[]
  /**
   * `select`/`segmented`: the chosen option; `multiselect`: the options; `date-range`: two ISO
   * dates; `range`: two indexes into `steps`; `slider`: the chosen step itself, not its index;
   * `number`: the number, `null` when empty.
   */
  value: FilterValue
  default: FilterValue
  /** `date-range`: the latest date that can be chosen (ISO). `number`: the highest value. */
  max?: string | number
  min?: number
  /** number: what one press of − or + changes. Default 1. */
  step?: number
  /** `number`: the unit right of the field, replacing the stepper. `slider`: behind the value. */
  unit?: string
  placeholder?: string
  /** The control stands inside a tile: the bar does not draw, count or reset it. */
  hidden?: boolean
}

/**
 * Events: `lintje-values-change` with `{key: value, …}` when filters commit (at once in the bar,
 * on "Toepassen" in the sheet); `lintje-filters-open-change` with a boolean.
 */
export interface FilterBarData extends FrameSettings {
  filters: FilterDefinition[]
  /** The URL's `filters` param: false when the user collapsed the bar. */
  open?: boolean
  /** A bar in the page's content: its own sentence and sheet, never the shell's state. */
  standalone?: boolean
}

/* Shell -------------------------------------------------------------------- */

/** One page in the navigation. */
export interface ShellLink {
  label: string
  /** Without it the entry has no page and is drawn muted. */
  href?: string
  /** The page the reader is on; the host decides. */
  active?: boolean
  /** An icon file name: the side menu's rail and a submenu draw it. */
  icon?: string
  /** The SVG file the host resolved for `icon`, as a data URI; drawn in the text color. */
  iconSrc?: string
  /** A figure after the name: "12 open". */
  metric?: { value: string; label: string }
  /**
   * `label` is what a screen reader hears instead of the bare value, e.g.
   * "3 nieuwe meldingen"; without it the value is read as it stands.
   */
  badge?: { value: string | number; tone: 'action' | 'count' | 'new'; label?: string }
  /** The page exists but the reader may not open it: struck through, with a lock. */
  noAccess?: boolean
}

/** Pages under one heading: a submenu in the navigation bar, a section in the side menu. */
export interface ShellGroup {
  label: string
  links: ShellLink[]
}

/** A person as an element shows them. */
export interface Person {
  name: string
  /** Written by the host ("JV"): initials are not derived, "J. de Vries" has no rule. */
  initials?: string
  /** The second line: function or department ("Senior behandelaar"). */
  role?: string
  /** A photo, cropped to the circle; when it does not load, the initials. */
  photo?: string
  /** Makes the name a link to a profile. */
  href?: string
}

/** The person in the user menu: unchanged for every host that sets it. */
export type UserMenuUser = Person

/** The light/dark setting as the reader chose it; `system` follows `prefers-color-scheme`. */
export type ModeSetting = 'system' | 'light' | 'dark'

/** The reader's display settings, as the host holds them; with them the bar has "Weergave". */
export interface ShellView {
  mode: ModeSetting
  /** Lets the reader put the navigation beside or above the page. */
  layoutChoice?: boolean
  /** The themes the reader may choose. */
  themes?: { value: string; label: string }[]
  /** The theme that stands now: one of `themes`. Without it the first is marked. */
  theme?: string
  /** The house style the page follows, when the host lets the reader choose: `classic` is the
   * menu filled in the theme's colour with square corners, `new` the light menu with the
   * rounded corners. The host draws it: `data-style-version` on `<html>`. */
  style?: 'classic' | 'new'
  /** The corner of the band at the page's head in the new style, when the host lets the reader
   * choose: `round` is the house style's one rounded corner, `square` none. The host draws it:
   * `data-style-new-corner` on `<html>`. */
  corner?: 'square' | 'round'
}

/** What the reader changed in "Weergave" or with the pin: one key per `lintje-view-change`. */
export interface ShellViewChange {
  mode?: ModeSetting
  layout?: 'side' | 'top'
  theme?: string
  style?: 'classic' | 'new'
  corner?: 'square' | 'round'
  menu?: 'pinned' | 'unpinned'
}

/**
 * Events: `lintje-navigate` `{ href }`, `lintje-view-change` (`ShellViewChange`),
 * `lintje-search-open`; from its parts `lintje-action`, `lintje-logout`,
 * `lintje-notification-open`, `lintje-notifications-read`.
 */
export interface ShellData extends FrameSettings {
  /** The application's or dashboard's name: the page's one `h1`. */
  name?: string
  /** URL or data URI of an emblem the host resolved itself. Wins over `emblem`. */
  logo?: string
  /** The theme's emblem by file name (`embleem-*`); `label` and `byline` are drawn as text. */
  emblem?: { name: string; label: string; byline?: string }
  /** Where the logo leads; without it the logo is no link. */
  home?: string
  /** The entries, in order: a page, or a group of pages under a heading. */
  navigation: (ShellLink | ShellGroup)[]
  /** Where the navigation stands: above the page (`top`, default) or beside it (`side`). */
  layout?: 'side' | 'top'
  /** Side layout from 1440 px: the menu pinned open (default) or a rail. */
  menu?: 'pinned' | 'unpinned'
  view?: ShellView
  /** "Delen": the link to this view, by e-mail, on paper. */
  share?: boolean
  /** "Open op mijn telefoon" in "Delen" shows a QR code of this view's link, made by the
   *  shell. A host that makes its own sets its URL or data URI here, dark modules only and
   *  without a margin, for the current URL. */
  qrCode?: string
  /** The scheme of the QR code's link in place of `https`, so a phone opens it in that app:
   *  `mibrowsers` for Ivanti Web@Work. Copying the link and e-mail keep `https`. */
  qrScheme?: string
  /** The page's name, beside `name` in the side layout's top bar once the title has scrolled away. */
  pageName?: string
  /** The environment outside production ("Acceptatie"). Leave it out in production. */
  environment?: string
  /** Who is signed in: the avatar and the user menu. Without it there is no user menu. */
  user?: UserMenuUser
  userMenu?: MenuEntry[]
  /** "Afmelden" as a POST form to `href` with the CSRF `token`; without it, `lintje-logout`. */
  logout?: { href: string; token: string }
  version?: string
  feedback?: { href: string; label?: string }
  search?: boolean
  notifications?: NotificationItem[]
}

/* Log viewer ---------------------------------------------------------------- */

export type LogLevel = 'error' | 'warning' | 'info' | 'debug'

/** One line of a log. Everything but `id` and `message` may be missing: it is then left out, never guessed. */
export interface LogEntry {
  id: string
  /** The text, over more lines where the source wrote them (a stack trace). */
  message: string
  /** The moment as ISO 8601. */
  at?: string
  /** The moment as the host writes it: `14:03:27.118`. */
  time?: string
  level?: LogLevel
  /** Where it came from: `import`, `api`. */
  source?: string
  /** The line number in the source, for output without time or level. */
  line?: number
  /** A longer text or JSON the host has laid out, shown when the line opens. */
  details?: string
}

/** What the reader filters on; the host keeps it in the URL and sends only matching lines. */
export interface LogFilter {
  level?: LogLevel | 'all'
  /** The term `lintje-find` looks for. Finding marks; it filters only with `onlyHits`. */
  search?: string
  onlyHits?: boolean
}

/**
 * Events: `lintje-log-filter-change` `LogFilter`, `lintje-log-select` `string | null` (the chosen
 * line), `lintje-log-action` `string` (one of `actions`), `lintje-log-retry`.
 */
export interface LogViewerData extends FrameSettings, TileData, ContentState {
  /** Oldest first. */
  entries: LogEntry[]
  /** The source still writes: the live badge, and the view follows the newest line. */
  live?: boolean
  filter?: LogFilter
  /** Lines per level in the whole log, for the counts in the level filter. */
  counts?: Partial<Record<LogLevel | 'all', number>>
  /** How many older lines the host no longer sends. */
  truncated?: number
  /** The chosen line's `id`. */
  selected?: string | null
  /** The host's own actions, in the "Meer" menu after the view's own. */
  actions?: MenuEntry[]
}

/* Chat with data ----------------------------------------------------------- */

/**
 * A stretch of a message read as a term: character offsets, end exclusive. `kind` is the Dutch
 * caption ("Periode"). `certain: false`: ambiguous or outside the chosen sources, drawn dashed.
 */
export interface ChatTermRange {
  start: number
  end: number
  kind?: string
  certain?: boolean
}

export interface ChatMessageData {
  /** `''` for a message that is only its attachments. */
  text: string
  terms?: ChatTermRange[]
  /** When it was sent, as the host formats it ("08:20"). */
  time?: string
  /** What was sent along with the question; always `state: 'done'`. */
  attachments?: UploadFile[]
}

export interface ChatSuggestion {
  label: string
  /** What is sent when it differs from the label; a host's own id for a choice. */
  value?: string
}

/**
 * One pair of the strip under an answer: a fixed value, a changeable one (`options`, `value` the
 * chosen option) or a suggestion to switch on (`pressed`).
 */
export interface ChatStripItem {
  key: string
  label: string
  value: string
  options?: FilterOption[]
  pressed?: boolean
}

export interface ChatStripData {
  items: ChatStripItem[]
  details?: { term: string; description: string }[]
  /** The toggle's word; "Berekening" without it. */
  detailsLabel?: string
}

/** One block of an answer: an existing tag with its data. Still to come: `state: 'loading'`. */
export type ChatBlock =
  | { kind: 'prose'; text?: string; html?: string }
  | { kind: 'kpi-row'; data: KpiRowData }
  | { kind: 'chart'; data: ChartData }
  | { kind: 'data-table'; data: DataTableData }
  /** Files the answer gives back or cites, beside the sentence that names them. */
  | { kind: 'attachments'; items: UploadFile[] }

/** One thing the assistant did for an answer. The host writes the label in its own tense and
 *  with its outcome: "3 bronnen doorzoeken" while busy, "3 bronnen doorzocht" when done,
 *  "Tabel ophalen mislukt" or "Tabel ophalen gestopt". */
export interface ChatStep {
  /** What the step does or did. A screen reader hears its state after it ("bezig", "mislukt",
   *  "gestopt") unless the label already holds that word. */
  label: string
  /** `done` without it. */
  state?: Extract<WorkState, 'busy' | 'done' | 'error' | 'cancelled'>
  /** Short, after the label on the same line: the sources, the table, or why it failed. */
  detail?: string
  /** Makes `linkText` in the detail a link: the source's page. */
  href?: string
  /** Without it, or when the detail does not hold it, the whole detail is the link. */
  linkText?: string
}

/** What the assistant did for one answer, oldest first; steps are only ever added at the end. */
export interface ChatStepsData {
  items: ChatStep[]
  /** How long it took, as the host formats it ("12 s"). Only once nothing is busy: while a step
   *  runs, it is not drawn. */
  duration?: string
}

/** A line between turns, above the question of its turn. */
export interface ChatDivider {
  /** `time` ("Gisteren") and `topic` ("Nieuw onderwerp") are quiet; `context`: the conversation
   *  was trimmed, and what stands above is no longer used. `time` without it. */
  kind?: 'time' | 'topic' | 'context'
  label: string
  /** One sentence under the label. A `context` divider without it says "De assistent neemt de
   *  vragen hierboven niet meer mee." */
  note?: string
}

export type ChatQuestionKind = 'one' | 'many' | 'text'

/** One question the assistant asks before it answers. */
export interface ChatQuestion {
  id: string
  /** The short name in the progress line and the reader's message: "Periode". */
  label: string
  /** The question itself: "Welke periode bedoel je?" */
  text: string
  kind: ChatQuestionKind
  /** `one` and `many`; a `description` stands under its label. "Iets anders…" always follows. */
  options?: FilterOption[]
  /** The placeholder of the "Iets anders…" field. */
  otherPlaceholder?: string
  /** Marks "(niet verplicht)" and offers Overslaan; a question is required without it. */
  optional?: boolean
  hint?: string
  /** `text`: the field's placeholder. */
  placeholder?: string
  /** The message when a required question has no answer; "Kies een antwoord." without it
   *  ("Vul een antwoord in." for `text`). */
  error?: string
}

/** What the assistant asks before it answers: `lintje-chat-questions`. */
export interface ChatQuestionsData {
  /** 1 to 5. One `one` question without descriptions is drawn in the short form. */
  questions: ChatQuestion[]
  /** `sending`: the answers are on their way. */
  state?: 'open' | 'sending'
}

/** Where an answer stands. `out-of-scope` needs a source on; `needs-clarification` asks back. */
export type ChatAnswerState =
  | 'ready'
  | 'streaming'
  | 'stopped'
  | 'error'
  | 'out-of-scope'
  | 'needs-clarification'

/** What the assistant answered: `lintje-chat-answer`. */
export interface ChatAnswerData {
  state?: ChatAnswerState
  lead?: string
  text?: string
  blocks?: ChatBlock[]
  strip?: ChatStripData
  /** `streaming`: the step that is running ("Cijfers berekenen · stap 2 van 3"). With `steps`,
   *  the running step says it and `status` is not drawn. */
  status?: string
  /** What the assistant did for this answer, above its text in every state. */
  steps?: ChatStepsData
  /** `error`: what went wrong, and the way out in words. */
  error?: { title?: string; text: string }
  /**
   * `needs-clarification` and `out-of-scope`: what the assistant asks before it answers, in a box
   * above the question box. Counts on the last answer only; a new turn ends it.
   */
  questions?: ChatQuestionsData
  /** Suggested next questions, dashed. Drawn under the last answer only. */
  followUps?: ChatSuggestion[]
}

export interface ChatTurnData {
  id: string
  /** The line above this turn's question: "Gisteren", "Nieuw onderwerp", "Gesprek ingekort". */
  divider?: ChatDivider
  message: ChatMessageData
  answer?: ChatAnswerData
}

/** A term the question box recognises while typing. Switched-off or `ambiguous`: dashed. */
export interface ChatTermData {
  label: string
  kind: string
  aliases?: string[]
  source?: string
  ambiguous?: boolean
}

/** What the host recognised in the typed text; holds only while the box's text is `text`. */
export interface ChatDraftTerms {
  text: string
  ranges: ChatTermRange[]
}

export type ChatAnswerForm = 'auto' | 'text' | 'chart' | 'table'

export interface ChatSourceData {
  id: string
  label: string
  description?: string
  /** How far its figures run ("tot 8 sep, 08:15"). */
  asOf?: string
  selected?: boolean
}

export interface ChatStartData {
  /** "Waar wil je meer over weten?" without it. */
  title?: string
  intro?: string
  /** The small print under the sources: the defaults, and that nothing is kept. */
  note?: string
  starters?: ChatSuggestion[]
}

/**
 * The host owns the conversation and sets `data` again on change.
 * Events: `lintje-message-send`, `lintje-questions-answer`, `lintje-answer-stop`,
 * `lintje-sources-change`, `lintje-draft-change`, `lintje-suggestion-select`, `lintje-message-edit`,
 * `lintje-answer-retry`, `lintje-answer-rate`, `lintje-strip-change`, the attachments'
 * `lintje-files-add`, `lintje-file-remove`, `lintje-file-cancel`, `lintje-file-retry` and
 * `lintje-file-open`, `lintje-navigate` from a link in a step, and the blocks' own
 * `lintje-mark-select`, `lintje-row-click` and `lintje-sort-change`.
 */
export interface ChatData extends FrameSettings {
  turns: ChatTurnData[]
  start?: ChatStartData
  sources?: ChatSourceData[]
  vocabulary?: ChatTermData[]
  /** The host's own reading of the text being typed; it wins over the vocabulary. */
  draftTerms?: ChatDraftTerms
  /** The question box's placeholder; "Stel een vraag over de gegevens" without it. */
  placeholder?: string
  /**
   * Files sent along with a question: the paperclip, dragging and pasting. Without it the box
   * takes no files. `files` are those of the question still being typed; the host keeps them.
   */
  upload?: { accept?: string; maxSize?: number; files?: UploadFile[] }
}

export type { FormValues, FormErrors, StoredDraft } from './components/forms/form/form'
export type { ErrorSummaryItem } from './components/forms/error-summary/error-summary'
export type { ChatQuestionAnswer } from './components/chat/chat-questions/chat-questions'
export type { ErrorPageLink } from './components/feedback/error-page/error-page'
export type { UploadFile } from './components/shared/files'
export type { DateRange } from './components/inputs/date-range/date-range'
export type { SlotDay, TimeSlot } from './components/inputs/slot-picker/slot-picker'
export type { TabItem } from './components/layout/tabs/tabs'
export type { Step, StepState, StepperOrientation } from './components/forms/stepper/stepper'
export type { MenuEntry, MenuHeading, MenuItem } from './components/actions/menu-button/menu-button'
export type { Crumb } from './components/frame/breadcrumbs/breadcrumbs'
export type { SubNavAction, SubNavGroup, SubNavItem } from './components/frame/sub-nav/sub-nav'
export type { ListItem } from './components/tables/list/list'
export type {
  CardAction,
  CardData,
  CardFact,
  CardLayout,
  CardMedia,
  CardStatus,
  CardStatusTone,
} from './components/tables/card/card'
export type { GalleryItem } from './components/content/gallery/gallery'
export type { FooterColumn, FooterData, FooterLink } from './components/frame/footer/footer'
export type { TreeNode } from './components/tables/tree-view/tree-view'
export type { SortableItem } from './components/tables/sortable-list/sortable-list'
export type {
  DescriptionItem,
  DescriptionAction,
} from './components/tables/description-list/description-list'
export type {
  TimelineActor,
  TimelineLink,
  TimelineMoment,
  TimelinePlacement,
  TimelineSide,
} from './components/tables/timeline/timeline'
export type { Job, JobState } from './components/feedback/job-list/job-list'
export type {
  ConflictChange,
  ConflictChoice,
} from './components/feedback/conflict-alert/conflict-alert'
export type { TimedText } from './components/content/video-player/video-player'
export type {
  TranscriptSegment,
  TranscriptMatches,
  TranscriptMatch,
} from './components/content/transcript/transcript'
export type { SearchGroup, SearchResult } from './components/frame/app-search/app-search'
export type { NotificationItem } from './components/frame/notifications/notifications'
