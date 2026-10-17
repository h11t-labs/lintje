/**
 * `<lintje-chart>` — a chart in its tile, with loading, empty and error states.
 *
 * Expand and download are handled here. A mark with an `href` goes there after its
 * `lintje-mark-select`, and undoing goes to `data.clearHref`: the event is cancelable, and a host
 * that routes itself cancels it. A modifier or middle click on a mark opens its `href` in a new
 * tab, without that event.
 *
 * Events: `lintje-mark-select` `{ id, label, href }` (a mark with an `href` was clicked;
 * deselected, `{ id: null, label: null, href: data.clearHref }`).
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { define, type FrameSettings } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { spanStyles } from '../../shared/grid-item-element'
import { LintjeContentTileElement } from '../../shared/content-tile'
import { ChartController, type ChartOptions } from '../../shared/charts/shared/controller'
import { renderChart } from '../../shared/charts/shared/render-chart'
import { rowsHeight } from '../../shared/charts/horizontal-bar-chart/horizontal-bar-chart'
import {
  dumbbellDecimals,
  dumbbellDifference,
  dumbbellHeight,
} from '../../shared/charts/dumbbell-chart/dumbbell-chart'
import { binLabel } from '../../shared/charts/histogram-chart/histogram-chart'
import { treemapRows } from '../../shared/charts/treemap-chart/treemap-parts'
import { sankeyHeight, sankeyModel } from '../../shared/charts/sankey-chart/sankey-chart'
import { FORECAST_LABEL, boundsAt, forecastStart } from '../../shared/charts/shared/forecast'
import {
  renderChartSkeleton,
  type ChartSkeletonKind,
} from '../../shared/charts/shared/chart-states'
import { chartStyles } from '../../shared/charts/shared/chart-styles'
import type { ChartSpec } from '../../shared/charts/shared/types'
import { chartImage, downloadCsv, downloadPng, type CsvCell } from '../../shared/download'
import { MediaController } from '../../../core/media'
import skeletonCss from '../../feedback/skeleton/skeleton.css?inline'
import tileHostCss from '../../shared/view-tile.css?inline'
import '../../feedback/announcement/announcement'
import '../../layout/tile/tile'
import type { CellValue, ChartData } from '../../../types'

/** The chart's own drawing; a legend marker or an icon is an `<svg>` too. */
const DRAWING = '.lintje-chart__svg, .lintje-pie-chart__svg'

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
    case 'stacked-area':
    case 'dual-axis':
    case 'scatter':
      return 'line'
    case 'pie':
      return chart.donut ? 'donut' : 'pie'
    case 'radar':
      return 'pie'
    case 'heatmap':
      return 'heatmap'
    case 'treemap':
      return 'treemap'
    default:
      return 'bar'
  }
}

function stateHeight(chart: ChartSpec, mobile: boolean): string | undefined {
  switch (chart.kind) {
    case 'horizontal-bar':
    case 'target-progress':
      // Without rows the stand-in is as tall as any chart.
      return chart.rows.length ? `${rowsHeight(chart.rows.length)}px` : undefined
    case 'dumbbell':
      return chart.rows.length ? `${dumbbellHeight(chart.rows.length, mobile)}px` : undefined
    case 'pie':
    case 'heatmap':
      return undefined
    case 'sankey':
      // The busiest step makes the drawing taller than the token, never lower.
      return `max(${sankeyHeight(chart)}px, var(${chart.small ? '--chart-h-small' : '--chart-h-main'}))`
    default:
      return chart.small ? 'var(--chart-h-small)' : undefined
  }
}

/**
 * A forecast's columns: its bounds after the value, and what each row is at the end, so a
 * forecast never stands unmarked among measured figures. Before the forecast a bound is an
 * empty cell, not a missing value: there is no bound there.
 */
function forecastColumns(chart: Extract<ChartSpec, { kind: 'line' | 'bar' }>) {
  // As the drawing: a forecast continues a measured series, so with only comparisons there is none.
  const measured = chart.kind === 'bar' || chart.series.some((series) => !series.comparison)
  const from = measured ? forecastStart(chart.forecastFrom, chart.labels.length) : null
  const word = (chart.forecastLabel ?? FORECAST_LABEL).toLowerCase()
  return {
    from,
    bounds: (forecast: Parameters<typeof boundsAt>[0], i: number): CsvCell[] => {
      if (from == null || i < from) return ['', '']
      const { low, high } = boundsAt(forecast, i)
      return [low, high]
    },
    kind: (i: number): CsvCell[] => (from == null ? [] : [i < from ? 'gemeten' : word]),
    kindHeader: from == null ? [] : ['Soort'],
  }
}

/** The rows of the CSV download, header first. */
function csvRows(chart: ChartSpec): CsvCell[][] {
  switch (chart.kind) {
    case 'line': {
      const events = chart.events ?? []
      // A category without an event is empty, not missing (rule 15 is about values).
      const eventAt = (i: number) =>
        events
          .filter((event) => event.index === i)
          .map((event) => event.label)
          .join('; ')
      const forecast = forecastColumns(chart)
      // A comparison has no forecast, so no bounds.
      const bounded = (series: (typeof chart.series)[number]) =>
        forecast.from != null && !series.comparison && series.forecast != null
      return [
        [
          '',
          ...chart.series.flatMap((series) => [
            series.label,
            ...(bounded(series)
              ? [`${series.label} ondergrens`, `${series.label} bovengrens`]
              : []),
          ]),
          ...(events.length ? ['Gebeurtenis'] : []),
          ...forecast.kindHeader,
        ],
        ...chart.labels.map((label, i) => [
          label,
          ...chart.series.flatMap((series) => [
            series.values[i],
            ...(bounded(series) ? forecast.bounds(series.forecast, i) : []),
          ]),
          ...(events.length ? [eventAt(i)] : []),
          ...forecast.kind(i),
        ]),
      ]
    }
    case 'bar': {
      const forecast = forecastColumns(chart)
      const bounded = forecast.from != null && chart.forecast != null
      return [
        [
          '',
          chart.axisTitle ?? 'Waarde',
          ...(bounded ? ['Ondergrens', 'Bovengrens'] : []),
          ...(chart.trend ? ['Trend'] : []),
          ...forecast.kindHeader,
        ],
        ...chart.labels.map((label, i) => [
          label,
          chart.values[i],
          ...(bounded ? forecast.bounds(chart.forecast, i) : []),
          ...(chart.trend ? [chart.trend[i]] : []),
          ...forecast.kind(i),
        ]),
      ]
    }
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
    case 'stacked-area':
      // A total over a missing part is missing too, never the sum of the rest. It is rounded to
      // its parts' decimals: a float sum would carry noise into the CSV and the column format.
      return [
        ['', ...chart.series.map((series) => series.label), 'Totaal'],
        ...chart.labels.map((label, i) => {
          const values = chart.series.map((series) => series.values[i])
          const total = values.some((value) => value == null)
            ? null
            : Number(
                values.reduce<number>((sum, value) => sum + value!, 0).toFixed(decimalsOf(values)),
              )
          return [label, ...values, total]
        }),
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
    case 'scatter': {
      const header = (title: string, unit?: string) => {
        const name = title.charAt(0).toUpperCase() + title.slice(1)
        return unit ? `${name} (${unit})` : name
      }
      return [
        ['Reeks', 'Naam', header(chart.xTitle, chart.xUnit), header(chart.axisTitle, chart.unit)],
        ...chart.series.flatMap((series) =>
          series.points.map((point) => [series.label, point.label, point.x, point.y]),
        ),
      ]
    }
    case 'heatmap':
      return [
        ['', ...chart.columnLabels],
        ...chart.rowLabels.map((label, row) => [label, ...(chart.values[row] ?? [])]),
      ]
    case 'radar': {
      // A row per axis, a column per layer and the norm; a missing value stays missing.
      const norm = chart.threshold != null ? [chart.thresholdLabel ?? 'Norm'] : []
      return [
        ['', ...chart.series.map((series) => series.label), ...norm],
        ...chart.axes.map((axis, i) => [
          axis,
          ...chart.series.map((series) => series.values[i] ?? null),
          ...(chart.threshold != null ? [chart.threshold] : []),
        ]),
      ]
    }
    case 'dumbbell': {
      // The real values, also beyond the axis; the difference is missing when an end is.
      const decimals = dumbbellDecimals(chart.rows)
      const norm = chart.threshold != null ? [chart.thresholdLabel ?? 'Norm'] : []
      return [
        ['', chart.fromLabel, chart.toLabel, 'Verschil', ...norm],
        ...chart.rows.map((row) => [
          row.label,
          row.from,
          row.to,
          dumbbellDifference(row, decimals),
          ...(chart.threshold != null ? [chart.threshold] : []),
        ]),
      ]
    }
    case 'histogram': {
      const bound = (name: string) => (chart.unit ? `${name} (${chart.unit})` : name)
      // An open class has no upper bound: an empty cell, never a missing value (rule 15).
      return [
        ['Klasse', bound('Van'), bound('Tot'), 'Aantal'],
        ...chart.bins.map((bin) => [binLabel(bin, chart.unit), bin.from, bin.to ?? '', bin.count]),
      ]
    }
    case 'treemap':
      // A row per sub-part; what the drawing folds into "Overig" stands apart.
      return treemapRows(chart)
    case 'sankey': {
      // A row per flow the chart draws; a missing one keeps its count and its share missing.
      const { flows } = sankeyModel(chart)
      return [
        [
          'Van',
          'Naar',
          chart.unit ? `Aantal (${chart.unit})` : 'Aantal',
          'Aandeel van de bron (%)',
        ],
        ...flows.map((flow) => [
          flow.from.label,
          flow.to.label,
          flow.value,
          flow.value == null || flow.from.size <= 0
            ? null
            : Math.round((flow.value / flow.from.size) * 100),
        ]),
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

/**
 * The labels of the series that are separate variables but name no colour. A comparison is grey
 * by design and does not count; a figure with one variable may leave its colour to sky blue.
 */
function uncolouredSeries(chart: ChartSpec): string[] {
  let series: { label: string; color?: string; comparison?: boolean }[]
  switch (chart.kind) {
    case 'line':
    case 'grouped-bar':
    case 'scatter':
    case 'radar':
      series = chart.series
      break
    case 'dual-axis':
      series = [chart.left, chart.right]
      break
    default:
      return []
  }
  const variables = series.filter((row) => !row.comparison)
  return variables.length > 1 ? variables.filter((row) => !row.color).map((row) => row.label) : []
}

export class LintjeChart extends LintjeContentTileElement {
  // The chart-state skeleton is `.lintje-skeleton` markup; a shadow root needs the sheet.
  static override styles = [
    spanStyles,
    shadowCss(tileHostCss),
    shadowCss(skeletonCss),
    ...chartStyles,
  ]

  static override properties: PropertyDeclarations = {
    data: { attribute: false },
  }

  declare data?: ChartData | null

  readonly #chart = new ChartController(() => this.requestUpdate())
  // The modal draws the same chart with its own controller: the two never share hover or width.
  #modalChart: ChartController | null = null
  readonly #mobile = new MediaController(this)
  // Each warning once per element; another spec may name other series.
  readonly #warned = new Set<string>()

  protected override get dataSettings(): FrameSettings | undefined {
    return this.data ?? undefined
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (import.meta.env?.DEV && changed.has('data') && this.data?.chart) this.#warnUncoloured()
  }

  /** A variable without a colour gets one by its place, which a filter shifts. */
  #warnUncoloured(): void {
    const labels = uncolouredSeries(this.data!.chart)
    if (!labels.length) return
    const count = labels.length === 1 ? '1 reeks' : `${labels.length} reeksen`
    const message = `<lintje-chart>: ${count} zonder kleur (${labels.map((label) => `"${label}"`).join(', ')}). Geef elke reeks de kleur van haar variabele.`
    if (this.#warned.has(message)) return
    this.#warned.add(message)
    console.warn(message)
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
    let chart: Element | null | undefined = scope?.querySelector(DRAWING)
    // The image is the whole chart, legend and events with it: what renderChart drew in the scope.
    while (chart && chart.parentElement !== scope) chart = chart.parentElement
    if (!chart) return
    const subtitle =
      this.#mobile.matches && data.mobileSubtitle ? data.mobileSubtitle : data.subtitle
    const image = chartImage(chart, { title: data.title, subtitle, footnote: data.footnote })
    void downloadPng(this.downloadName ?? fileNameOf(data.title), image)
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
        state=${data.state ?? 'ready'}
        message=${data.message ?? nothing}
        last-known=${data.lastKnown ?? nothing}
        content-height=${stateHeight(data.chart, this.#mobile.matches) ?? nothing}
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
        this.expanded && this.#modalChart
          ? renderChart(data.chart, { ...this.chartOptions(this.#modalChart), expanded: true })
          : nothing,
        {
          heading: data.title,
          subtitle,
          footnote: data.footnote,
          csv: () => this.csv(),
          png: () => this.png(),
        },
      )}`
  }

  /** The drawing, or the skeleton in its shape for the tile's `loading` slot; empty and error are the tile's. */
  private content(): TemplateResult | typeof nothing {
    const data = this.data as ChartData
    switch (data.state ?? 'ready') {
      case 'loading':
        return html`<div slot="loading">
          ${renderChartSkeleton({
            kind: skeletonKind(data.chart),
            height: stateHeight(data.chart, this.#mobile.matches),
            status: false,
          })}
        </div>`
      case 'empty':
      case 'error':
        return nothing
      default:
        return renderChart(data.chart, this.chartOptions(this.#chart))
    }
  }

  /**
   * The host may take the choice over by cancelling the event; else the page goes to its `href`.
   * A modifier or middle click opens the `href` in a new tab, without the event.
   */
  private select(
    detail: { id: string | null; label: string | null; href?: string },
    newTab = false,
  ): void {
    if (newTab) {
      if (detail.href) this.followLink(detail.href, undefined, undefined, { newTab: true })
    } else if (this.emit('lintje-mark-select', detail) && detail.href) this.followLink(detail.href)
  }

  /** Returns focus to the cleared mark, or to the drawing when the mark is gone. */
  private async focusMark(id: string): Promise<void> {
    await this.updateComplete
    const scope = this.renderRoot.querySelector(this.expanded ? 'lintje-modal' : 'lintje-tile')
    const mark = scope?.querySelector<SVGElement>(`[data-mark-id="${CSS.escape(id)}"]`)
    const target =
      mark ??
      scope?.querySelector<HTMLElement | SVGElement>(
        `${DRAWING}, .lintje-heatmap, .lintje-sankey--rows`,
      )
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
      choosing: this.data?.selectedId !== undefined || this.data?.clearHref !== undefined,
      onSelect: ({ id, label, href }, newTab) => this.select({ id, label, href }, newTab),
      onClear: (previousId) => {
        this.select({ id: null, label: null, href: this.data?.clearHref })
        void this.focusMark(previousId)
      },
    }
  }
}

define('lintje-chart', LintjeChart)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-chart': LintjeChart
  }
}
