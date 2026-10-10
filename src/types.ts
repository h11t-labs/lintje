/**
 * The data contract. Everything here crosses from a host as JSON: no functions, components or
 * dates. The field names are the contract; renaming one is a breaking change.
 * Chart, map and element shapes are re-exported from where they are drawn; the data colours'
 * names come from their one list, `tokens/colors.ts`.
 */
import type { DataColor } from './tokens/colors'
import type { ChartSpec, MapSpec } from './components/shared/charts/shared/types'
import type { MenuEntry } from './components/actions/menu-button/menu-button'
import type { NotificationItem } from './components/frame/notifications/notifications'

export type {
  BarSeriesData,
  ChartColor,
  ChartKind,
  ChartSpec,
  LineSeriesData,
  MapSpec,
  MapValue,
  MapPlotData,
  MapPlotVariant,
  MapVariant,
  ScatterPoint,
  ScatterSeriesData,
  WmsBasemap,
  MapArea,
  MapControls,
} from './components/shared/charts/shared/types'
export type { DataColor } from './tokens/colors'

/** Settings every view receives, taken from the URL by the host. */
export interface FrameSettings {
  mode?: 'light' | 'dark'
}

export interface ContentState {
  state?: 'ready' | 'loading' | 'empty' | 'error'
  /** Empty: why there is nothing, and the way out. Error: what failed. */
  message?: string
  /** Error: the last known value, shown in the warning. */
  lastKnown?: string
}

export type StatusTone = 'complete' | 'delayed' | 'outage' | 'no-data'

export type TrendDirection = 'up' | 'down' | 'flat'

/* KPI row ------------------------------------------------------------------ */

/**
 * One colour per variable, named after the Rijkshuisstijl colour it is: a `DataColor`, the
 * names of `tokens/colors.ts`. `coverage` is a role, not a variable: gray.
 */
export type KpiVariable = DataColor | 'coverage'

export type KpiState = 'ready' | 'loading' | 'empty' | 'error'

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

export interface KpiData {
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
  state?: KpiState
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
}

/* Chart tile --------------------------------------------------------------- */

/**
 * Events: `lintje-mark-select` `{id, label, href}` when a mark with a `href` is clicked,
 * `{id: null, href: clearHref}` when the selection is undone.
 */
export interface ChartData extends FrameSettings, TileData, ContentState {
  chart: ChartSpec
  /** The chart's `<desc>`: a readable summary, the accessible alternative. Required. */
  description: string
  /** The chosen mark, by the id its link carries: it is outlined, the rest step back. */
  selectedId?: string | null
  /** The URL that undoes the selection; clicking the chosen mark again and Escape follow it. */
  clearHref?: string
  /** Offers "Grafiek" / "Tabel" in the header while `ready`; the table shows the CSV's rows. */
  tableSwitch?: boolean
}

/* Map tile ----------------------------------------------------------------- */

/**
 * Events: `lintje-mark-select` `{id, label, href?}` on a click on an area or point,
 * `{id: null, href: clearHref}` when undone; `lintje-layer-change` with the chosen layer;
 * with `controls.lasso` or `controls.circle`, `lintje-area-select` `{area, ids}` for a drawn area and
 * `{area: null, ids: []}` when it is undone.
 */
export interface MapData extends FrameSettings, TileData, ContentState, MapSpec {}

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
   * `change-compact`: only the ▲ ▼ ● of `change`; a screen reader hears the whole change, and
   * below 768 px the row's measure shows it whole.
   * `status`: a `StatusTone` (or mapped through `status.tones`) as the status dot with its label.
   */
  format?: 'text' | 'number' | 'percent' | 'decimal' | 'change' | 'change-compact' | 'status'
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

export interface SortState {
  key: string
  direction: 'asc' | 'desc'
}

/**
 * Events: `lintje-row-click` with `{id, label, href?}` in a clickable table;
 * `lintje-row-open` with `{id, label, href?}` from the name of an `openable` one;
 * `lintje-checked-change` with the checked keys in a selectable one;
 * `lintje-sort-change` with `{key, direction}` or `null`;
 * `lintje-cell-edit` `{id, column, value}` from an `editor` column;
 * `lintje-row-action` `{id, action}` from `rowActions`;
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
  /** A "Kolommen kiezen" button in the head of the actions column, to order and hide columns
   *  (`lintje-columns-change`). Without row actions it adds that column. */
  columnChooser?: boolean
  /** The keys of the columns not shown. The first column is always shown. */
  hiddenColumns?: string[]
}

/* Announcement ------------------------------------------------------------- */

export type AnnouncementKind = 'warning' | 'outage' | 'info' | 'ok'

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
  /** A bar in the page's content: draws its own sentence, never writes the shell's state. */
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

export interface UserMenuUser {
  name: string
  /** The function: "Teamleider · Dienst Vergunningen". */
  role?: string
  initials: string
}

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
}

/** What the reader changed in "Weergave" or with the pin: one key per `lintje-view-change`. */
export interface ShellViewChange {
  mode?: ModeSetting
  layout?: 'side' | 'top'
  theme?: string
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
  text: string
  terms?: ChatTermRange[]
  /** When it was sent, as the host formats it ("08:20"). */
  time?: string
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
  /** `streaming`: the step that is running ("Cijfers berekenen · stap 2 van 3"). */
  status?: string
  /** `error`: what went wrong, and the way out in words. */
  error?: { title?: string; text: string }
  /** `out-of-scope` and `needs-clarification`: the real choices, solid. */
  choices?: ChatSuggestion[]
  /** Suggested next questions, dashed. Drawn under the last answer only. */
  followUps?: ChatSuggestion[]
}

export interface ChatTurnData {
  id: string
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
 * Events: `lintje-message-send`, `lintje-answer-stop`, `lintje-sources-change`,
 * `lintje-draft-change`, `lintje-suggestion-select`, `lintje-message-edit`,
 * `lintje-answer-retry`, `lintje-answer-rate`, `lintje-strip-change`, and the blocks' own
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
}

export type { FormValues, FormErrors, StoredDraft } from './components/forms/form/form'
export type { ErrorSummaryItem } from './components/forms/error-summary/error-summary'
export type { UploadFile } from './components/inputs/file-upload/file-upload'
export type { DateRange } from './components/inputs/date-range/date-range'
export type { SlotDay, TimeSlot } from './components/inputs/slot-picker/slot-picker'
export type { TabItem } from './components/layout/tabs/tabs'
export type { Step, StepState, StepperOrientation } from './components/forms/stepper/stepper'
export type { MenuEntry, MenuHeading, MenuItem } from './components/actions/menu-button/menu-button'
export type { Crumb } from './components/frame/breadcrumbs/breadcrumbs'
export type { SubNavAction, SubNavGroup, SubNavItem } from './components/frame/sub-nav/sub-nav'
export type { ListItem, RowClickDetail } from './components/tables/list/list'
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
export type { ActivityEntry } from './components/tables/activity-log/activity-log'
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
