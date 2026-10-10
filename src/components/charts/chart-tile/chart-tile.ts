/**
 * `<lintje-chart-tile>` — a chart in its tile, with loading, empty and error states.
 *
 * Events: `lintje-mark-select` `{id, label, href}` when a mark with a `href` is clicked, and
 * `{id: null, label: null, href: clearHref}` when it is deselected. Expand and download stay here.
 *
 * Two controllers: the tile and the modal draw the same chart and must not share hover or width.
 * The table view is built from the CSV rows; it is element state, not URL state (rule 14).
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { define, type FrameSettings } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { spanStyles } from '../../../primitives/shared/grid-item-element'
import { LintjeContentTileElement } from '../../shared/content-tile'
import { ChartController, type ChartOptions } from '../../shared/charts/shared/controller'
import { renderChart } from '../../shared/charts/shared/render-chart'
import { rowsHeight } from '../../shared/charts/horizontal-bar-chart/horizontal-bar-chart'
import { binLabel } from '../../shared/charts/histogram-chart/histogram-chart'
import {
  renderChartEmpty,
  liveAnnouncement,
  renderChartError,
  renderChartSkeleton,
  type ChartSkeletonKind,
} from '../../shared/charts/shared/chart-states'
import { chartStyles } from '../../shared/charts/shared/chart-styles'
import type { ChartSpec } from '../../shared/charts/shared/types'
import { downloadCsv, downloadPng, type CsvCell } from '../../shared/download'
import { MediaController } from '../../../core/media'
import announcementCss from '../../feedback/announcement/announcement.css?inline'
import skeletonCss from '../../../primitives/skeleton/skeleton.css?inline'
import tileHostCss from '../../shared/view-tile.css?inline'
import chartTileCss from './chart-tile.css?inline'
import '../../feedback/announcement/announcement'
import '../../tables/data-table/data-table'
import '../../inputs/segmented/segmented'
import '../../../primitives/tile/tile'
import type { CellValue, ChartTileData, DataTableData, FilterOption } from '../../../types'

type ChartTileView = 'chart' | 'table'

/** The chart's own drawing; a legend marker or an icon is an `<svg>` too. */
const DRAWING = '.lintje-chart__svg, .lintje-pie-chart__svg'

const VIEW_OPTIONS: FilterOption[] = [
  { value: 'chart', label: 'Grafiek' },
  { value: 'table', label: 'Tabel' },
]

/** A file name from the title ("Aanvragen per uur" → "aanvragen-per-uur"). */
function fileNameOf(title: string | undefined): string {
  const slug = (title ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'grafiek'
}

function skeletonKind(chart: ChartSpec): ChartSkeletonKind {
  switch (chart.kind) {
    case 'line':
    case 'dual-axis':
      return 'line'
    case 'pie':
      return chart.donut ? 'donut' : 'pie'
    case 'heatmap':
      return 'heatmap'
    default:
      return 'bar'
  }
}

function stateHeight(chart: ChartSpec): string | undefined {
  switch (chart.kind) {
    case 'horizontal-bar':
    case 'target-progress':
      // Without rows the stand-in is as tall as any chart.
      return chart.rows.length ? `${rowsHeight(chart.rows.length)}px` : undefined
    case 'pie':
    case 'heatmap':
      return undefined
    default:
      return chart.small ? 'var(--chart-h-small)' : undefined
  }
}

/** The rows of the CSV download, header first; the table view shows the same rows. */
function csvRows(chart: ChartSpec): CsvCell[][] {
  switch (chart.kind) {
    case 'line':
      return [
        ['', ...chart.series.map((series) => series.label)],
        ...chart.labels.map((label, i) => [
          label,
          ...chart.series.map((series) => series.values[i]),
        ]),
      ]
    case 'bar':
      return [
        ['', chart.axisTitle ?? 'Waarde', ...(chart.trend ? ['Trend'] : [])],
        ...chart.labels.map((label, i) => [
          label,
          chart.values[i],
          ...(chart.trend ? [chart.trend[i]] : []),
        ]),
      ]
    case 'horizontal-bar':
      return [
        ['', chart.unit ? `Waarde (${chart.unit})` : 'Waarde'],
        ...chart.rows.map((row) => [row.label, row.value]),
      ]
    case 'target-progress':
      return [
        ['', 'Voortgang (%)', 'Doel (%)'],
        ...chart.rows.map((row) => [row.label, row.value, chart.target ?? 100]),
      ]
    case 'grouped-bar':
    case 'stacked-bar':
      return [
        ['', ...chart.series.map((series) => series.label)],
        ...chart.labels.map((label, i) => [
          label,
          ...chart.series.map((series) => series.values[i]),
        ]),
      ]
    case 'pie':
      return [['', 'Aantal'], ...chart.segments.map((segment) => [segment.label, segment.value])]
    case 'dual-axis': {
      const header = (axis: { label: string; unit?: string }) =>
        axis.unit ? `${axis.label} (${axis.unit})` : axis.label
      return [
        ['', header(chart.left), header(chart.right)],
        ...chart.labels.map((label, i) => [label, chart.left.values[i], chart.right.values[i]]),
      ]
    }
    case 'heatmap':
      return [
        ['', ...chart.columnLabels],
        ...chart.rowLabels.map((label, row) => [label, ...(chart.values[row] ?? [])]),
      ]
    case 'histogram': {
      const bound = (name: string) => (chart.unit ? `${name} (${chart.unit})` : name)
      // An open class has no upper bound: an empty cell, never a missing value (rule 15).
      return [
        ['Klasse', bound('Van'), bound('Tot'), 'Aantal'],
        ...chart.bins.map((bin) => [binLabel(bin, chart.unit), bin.from, bin.to ?? '', bin.count]),
      ]
    }
  }
}

function decimalsOf(values: CellValue[]): number {
  return values.reduce<number>((most, value) => {
    if (typeof value !== 'number' || Number.isInteger(value)) return most
    const fraction = String(value).split('.')[1] ?? ''
    return Math.max(most, fraction.length)
  }, 0)
}

/** The CSV rows as a table. A missing value stays `null` (rule 15); rows keep the chart's order. */
function chartTable(chart: ChartSpec, caption: string): DataTableData {
  const [header = [], ...body] = csvRows(chart)
  const columns = header.map((cell, index) => {
    const values = body.map((row) => (row[index] ?? null) as CellValue)
    return index === 0
      ? { key: `c${index}`, header: String(cell ?? ''), format: 'text' as const, sortable: false }
      : {
          key: `c${index}`,
          header: String(cell ?? ''),
          format: 'decimal' as const,
          decimals: decimalsOf(values),
          align: 'right' as const,
          sortable: false,
        }
  })
  return {
    caption,
    columns,
    rows: body.map((row, i) => ({
      row: String(i),
      ...Object.fromEntries(columns.map((column, index) => [column.key, row[index] ?? null])),
    })),
    rowKey: 'row',
    defaultSort: { key: 'row', direction: 'asc' },
    pageSize: Math.max(body.length, 1),
  }
}

export class LintjeChartTile extends LintjeContentTileElement {
  // The chart-state skeleton is `.lintje-skeleton` markup; a shadow root needs the sheet.
  static override styles = [
    spanStyles,
    shadowCss(tileHostCss),
    shadowCss(skeletonCss),
    shadowCss(announcementCss),
    ...chartStyles,
    shadowCss(chartTileCss),
  ]

  static override properties: PropertyDeclarations = {
    data: { attribute: false },
    view: { state: true },
  }

  declare data?: ChartTileData | null

  view: ChartTileView = 'chart'

  readonly #chart = new ChartController(() => this.requestUpdate())
  #modalChart: ChartController | null = null
  readonly #mobile = new MediaController(this)

  protected override get dataSettings(): FrameSettings | undefined {
    return this.data ?? undefined
  }

  override disconnectedCallback(): void {
    this.#chart.detach()
    this.#modalChart?.detach()
    this.#modalChart = null
    super.disconnectedCallback()
  }

  private get ready(): boolean {
    return (this.data?.state ?? 'ready') === 'ready'
  }

  private get showsTable(): boolean {
    return Boolean(this.data?.tableSwitch) && this.ready && this.view === 'table'
  }

  private get expandable(): boolean {
    return this.data?.expandable !== false
  }

  private get downloadName(): string | null {
    const download = this.data?.download
    if (download === false) return null
    return download?.filename ?? fileNameOf(this.data?.title)
  }

  private csv(): void {
    const data = this.data
    const filename = this.downloadName
    if (!data || filename === null) return
    downloadCsv(filename, csvRows(data.chart))
  }

  private png(): void {
    const data = this.data
    if (!data) return
    // Both charts are light children; the tag says which one the reader sees.
    const scope = this.renderRoot.querySelector(this.expanded ? 'lintje-modal' : 'lintje-tile')
    const svg = scope?.querySelector<SVGSVGElement>(DRAWING)
    if (svg) void downloadPng(this.downloadName ?? fileNameOf(data.title), svg)
  }

  protected override expandChanged(open: boolean): void {
    if (open) {
      this.#modalChart ??= new ChartController(() => this.requestUpdate())
    } else {
      this.#modalChart?.detach()
      this.#modalChart = null
    }
  }

  protected override render(): TemplateResult | typeof nothing {
    const data = this.data
    if (!data) return nothing
    const ready = this.ready
    const subtitle =
      this.#mobile.matches && data.mobileSubtitle ? data.mobileSubtitle : data.subtitle
    const titleId = this.id ? `${this.id}-tile` : undefined
    const viewSwitch = data.tableSwitch && ready ? this.viewSwitch() : nothing
    const table = this.showsTable

    return html`<lintje-tile
        id=${titleId ?? nothing}
        span=${data.span ?? nothing}
        heading=${data.title ?? nothing}
        icon=${data.icon ?? nothing}
        subtitle=${subtitle ?? nothing}
        intro=${data.intro ?? nothing}
        footnote=${data.footnote ?? nothing}
        ?legend-below=${Boolean(data.legendBelow)}
        ?expandable=${this.expandable && ready}
        ?download=${this.downloadName !== null && ready}
        @lintje-tile-expand=${(event: Event) => {
          event.stopPropagation()
          this.expand(true)
        }}
        @lintje-tile-download=${(event: Event) => {
          event.stopPropagation()
          this.csv()
        }}
      >
        ${viewSwitch}
        ${
          data.notice
            ? html`<lintje-announcement
              slot="notice"
              compact
              .data=${data.notice}
            ></lintje-announcement>`
            : nothing
        }
        ${this.content()}
      </lintje-tile>

      ${this.renderExpandModal(
        !this.expanded
          ? nothing
          : table
            ? this.table()
            : this.#modalChart
              ? renderChart(data.chart, {
                  ...this.chartOptions(this.#modalChart),
                  expanded: true,
                })
              : nothing,
        {
          heading: data.title,
          subtitle,
          footnote: data.footnote,
          csv: () => this.csv(),
          // A table is no drawing: no PNG.
          png: table ? undefined : () => this.png(),
        },
      )}`
  }

  private content(): TemplateResult {
    const data = this.data as ChartTileData
    const height = stateHeight(data.chart)
    switch (data.state ?? 'ready') {
      case 'loading':
        return renderChartSkeleton({ kind: skeletonKind(data.chart), height })
      case 'empty':
        return renderChartEmpty(data.message, height)
      case 'error':
        return renderChartError({
          message: data.message,
          lastKnown: data.lastKnown,
          height,
          announcement: liveAnnouncement,
        })
      default:
        return this.showsTable
          ? this.table()
          : renderChart(data.chart, this.chartOptions(this.#chart))
    }
  }

  /** Header actions from 768 px; below that a row of its own in the `notice` slot. */
  private viewSwitch(): TemplateResult {
    const mobile = this.#mobile.matches
    return html`<lintje-segmented
      class="lintje-chart-tile__view"
      slot=${mobile ? 'notice' : 'actions'}
      label="Weergave"
      hide-label
      ?stacked=${mobile}
      .value=${this.view}
      .options=${VIEW_OPTIONS}
      @lintje-change=${(event: CustomEvent<string>) => {
        event.stopPropagation()
        this.view = event.detail === 'table' ? 'table' : 'chart'
      }}
    ></lintje-segmented>`
  }

  private table(): TemplateResult {
    const data = this.data as ChartTileData
    const caption = data.title ? `${data.title}, als tabel` : 'Grafiek als tabel'
    return html`<lintje-data-table
      class="lintje-chart-tile__table"
      bare
      .data=${chartTable(data.chart, caption)}
    ></lintje-data-table>`
  }

  /** Returns focus to the cleared mark, or to the drawing when the mark is gone. */
  private async focusMark(id: string): Promise<void> {
    await this.updateComplete
    const scope = this.renderRoot.querySelector(this.expanded ? 'lintje-modal' : 'lintje-tile')
    const mark = scope?.querySelector<SVGElement>(`[data-mark-id="${CSS.escape(id)}"]`)
    const target =
      mark ?? scope?.querySelector<HTMLElement | SVGElement>(`${DRAWING}, .lintje-heatmap`)
    // The drawing takes the focus from a script only; it does not join the tab order for it.
    if (target && !target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
    target?.focus()
  }

  /** Clearing sends the same event with `id: null` and `clearHref`. */
  private chartOptions(controller: ChartController): ChartOptions {
    return {
      controller,
      description: this.data?.description ?? '',
      mobile: this.#mobile.matches,
      selectedId: this.data?.selectedId ?? null,
      onSelect: ({ id, label, href }) => this.emit('lintje-mark-select', { id, label, href }),
      onClear: (previousId) => {
        this.emit('lintje-mark-select', { id: null, label: null, href: this.data?.clearHref })
        void this.focusMark(previousId)
      },
    }
  }
}

define('lintje-chart-tile', LintjeChartTile)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-chart-tile': LintjeChartTile
  }
}
