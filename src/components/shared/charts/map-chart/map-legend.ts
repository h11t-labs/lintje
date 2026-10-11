/**
 * The legend above the map: a line per layer — its name, which switches the layer; its key,
 * what its figures mean; its series, each a switch; and the hatch where it has gaps. The key is
 * the same drawing as the map's: the classes, the sizes or the widths of its marks.
 */
import { html, svg, nothing, type TemplateResult } from 'lit'
import { formatCompactNumber, formatNumber } from '../../../../core/format'
import { styleProps } from '../../../../core/style-props'
import { renderIcon } from '../../../../icons/render'
import { renderLegend, type LegendItem } from '../shared/axes'
import { seriesColor } from '../shared/colors'
import { CLASSES, pointRadius, seriesKey } from './marks'
import { withUnit, type MapDrawing } from './drawings'
import type { MapSeriesKey } from '../shared/types'

/** The lines a tile shows before the rest folds under "Nog n lagen". */
export const LEGEND_ROWS = 3

export interface MapLegendOptions {
  drawings: MapDrawing[]
  /** The layers switched off, by their place in the stack. */
  hiddenLayers: number[]
  /** The series switched off, as `seriesKey()` names them. */
  hiddenSeries: string[]
  /** The modal: every layer, the classes with their bounds, the sizes nested at true size. */
  expanded: boolean
  /** Below 768 px: one column, the series of a layer on their own line. */
  mobile: boolean
  /** A tile's legend of more than `LEGEND_ROWS` layers is unfolded. */
  open: boolean
  onLayer: (index: number) => void
  onSeries: (key: string) => void
  onOpen: (open: boolean) => void
}

/** The bounds of the five classes, as `classFor` divides the figures: equal steps to the max. */
function classBounds(max: number): number[] {
  return [0, 1, 2, 3, 4, 5].map((n) => (max * n) / 5)
}

/** A bound between two classes: exact, with a decimal where the fifth of the max has one. */
function formatBound(bound: number): string {
  if (Math.abs(bound) >= 10_000) return formatCompactNumber(bound)
  return formatNumber(bound, Number.isInteger(bound) ? 0 : 1)
}

/** The classes on a tile: the ramp between 0 and the max; in the modal each class by its range. */
function renderClasses(drawing: MapDrawing, expanded: boolean): TemplateResult {
  const { max, unit } = drawing
  if (!expanded)
    return html`<span class="lintje-map-legend__key">
      <span class="lintje-map-legend__figure">0</span>
      <span class="lintje-map-legend__ramp">${CLASSES.map((klass) => html`<i ${styleProps({ background: klass })}></i>`)}</span>
      <span class="lintje-map-legend__figure">${withUnit(formatCompactNumber(max), unit)}</span>
    </span>`
  const bounds = classBounds(max)
  const items: LegendItem[] = CLASSES.map((klass, n) => ({
    label: withUnit(
      `${formatBound(bounds[n])} – ${formatBound(bounds[n + 1])}`,
      n === 4 ? unit : '',
    ),
    color: klass,
    fixed: true,
  }))
  return html`<span class="lintje-map-legend__key lintje-map-legend__classes">${renderLegend({ items })}</span>`
}

/** The figure a round number lands on between `min` and `max`, nearest their geometric middle. */
function middle(min: number, max: number): number {
  const centre = Math.sqrt(Math.max(min, 1) * max)
  let best = max / 4
  for (let power = 10 ** Math.floor(Math.log10(Math.max(min, 1))); power <= max; power *= 10)
    for (const lead of [1, 2, 5]) {
      const figure = lead * power
      if (figure <= min || figure >= max) continue
      if (Math.abs(Math.log(figure / centre)) < Math.abs(Math.log(best / centre))) best = figure
    }
  return best
}

/**
 * The sizes on a tile: three circles from small to large in one line, with the range. In the
 * modal three nested circles at the size the points draw, each with its figure.
 */
function renderSizes(drawing: MapDrawing, expanded: boolean): TemplateResult {
  const { min, max, unit } = drawing
  const range = withUnit(`${formatCompactNumber(min)} – ${formatCompactNumber(max)}`, unit)
  if (!expanded || min >= max)
    return html`<span class="lintje-map-legend__key">
      <svg class="lintje-map-legend__sizes" width="49" height="22" aria-hidden="true">
        <circle cx="4" cy="11" r="3" /><circle cx="17.5" cy="11" r="6.5" /><circle cx="38" cy="11" r="10" />
      </svg>
      <span class="lintje-map-legend__figure">${range}</span>
    </span>`
  const mid = middle(min, max)
  const bottom = 46
  // The circles stand on one base; each figure has its own line, so two small circles whose
  // tops nearly touch still read apart, with a guide from the circle's top to its figure.
  const lines = [14, 31, 46]
  const rows = [max, mid, min].map((figure, n) => {
    const r = pointRadius(figure, max)
    return {
      r,
      top: bottom - 2 * r,
      line: lines[n],
      label: withUnit(formatCompactNumber(figure), n === 0 ? unit : ''),
    }
  })
  return html`<span class="lintje-map-legend__key">
    <svg class="lintje-map-legend__sizes lintje-map-legend__sizes--nested" width="150" height="48" aria-hidden="true">
      ${rows.map(
        ({ r, top, line, label }) => svg`
        <circle cx="19" cy=${bottom - r} r=${r} />
        <line x1="19" y1=${top} x2="48" y2=${line - 4} />
        <text x="52" y=${line}>${label}</text>`,
      )}
    </svg>
  </span>`
}

/** The widths: one wedge from thin to thick, with the range. */
function renderWidths(drawing: MapDrawing): TemplateResult {
  const { min, max, unit } = drawing
  return html`<span class="lintje-map-legend__key">
    <svg class="lintje-map-legend__wedge" width="58" height="12" aria-hidden="true"><path d="M0 5.5 L58 2 L58 10 L0 6.5 Z" /></svg>
    <span class="lintje-map-legend__figure">${withUnit(`${formatCompactNumber(min)} – ${formatCompactNumber(max)}`, unit)}</span>
  </span>`
}

function renderKey(drawing: MapDrawing, expanded: boolean): TemplateResult {
  const { variant } = drawing
  if (variant === 'choropleth' || variant === 'polygons') return renderClasses(drawing, expanded)
  if (variant === 'flows') return renderWidths(drawing)
  return renderSizes(drawing, expanded)
}

/**
 * The series of a layer, in its own `seriesLabels` order, each used by some mark; and the
 * hatch when a mark of the layer has no figure (rule 15). A colour may serve several layers:
 * each layer switches its own.
 */
function seriesItems(drawing: MapDrawing, hiddenSeries: string[]): LegendItem[] {
  const items: LegendItem[] = []
  for (const [key, label] of Object.entries(drawing.seriesLabels ?? {}) as [
    MapSeriesKey,
    string,
  ][]) {
    if (!label || !drawing.values.some((value) => value.series === key)) continue
    const id = seriesKey(drawing, key)
    items.push({
      key: id,
      label,
      color: seriesColor(key),
      symbol: key,
      shape: 'point',
      hidden: hiddenSeries.includes(id),
    })
  }
  if (drawing.values.some((value) => value.value == null))
    items.push({ label: 'geen gegevens', shape: 'hatch', fixed: true })
  return items
}

export function renderMapLegend(options: MapLegendOptions): TemplateResult {
  const { drawings, hiddenLayers, hiddenSeries, expanded, mobile, open } = options
  const folded = !expanded && !open && drawings.length > LEGEND_ROWS
  const shown = folded ? drawings.slice(0, LEGEND_ROWS) : drawings
  const classes = ['lintje-map-legend', mobile ? 'lintje-map-legend--narrow' : ''].join(' ')
  return html`
    <div class=${classes} role="group" aria-label="Legenda">
      ${shown.map((drawing) => {
        const off = hiddenLayers.includes(drawing.index)
        // A layer off takes its series with it: they read as off, and are no switch until the
        // layer is back.
        const items = seriesItems(drawing, hiddenSeries).map((item) =>
          off ? { ...item, hidden: true, fixed: true } : item,
        )
        // Every layer has its name, which switches it: a box as a checkbox has says so.
        return html`
          <button type="button" class="lintje-map-legend__layer ${off ? 'is-off' : ''}"
                  aria-pressed=${!off} @click=${() => options.onLayer(drawing.index)}>
            <span class="lintje-map-legend__box" aria-hidden="true">${renderIcon('functioneel-vinkje', { size: 10 })}</span>
            <span class="lintje-map-legend__name">${drawing.name}</span>
          </button>
          <div class="lintje-map-legend__keys ${off ? 'is-off' : ''}">
            ${renderKey(drawing, expanded)}
            ${
              items.length > 0
                ? html`<span class="lintje-map-legend__rule" aria-hidden="true"></span>${renderLegend({ items, onToggle: options.onSeries })}`
                : nothing
            }
          </div>
        `
      })}
      ${
        !expanded && drawings.length > LEGEND_ROWS
          ? html`<button type="button" class="lintje-map-legend__more" aria-expanded=${!folded}
                   @click=${() => options.onOpen(folded)}>
              ${folded ? `Nog ${drawings.length - LEGEND_ROWS} ${drawings.length - LEGEND_ROWS === 1 ? 'laag' : 'lagen'}` : 'Minder lagen'}
              ${renderIcon('functioneel-delta-omlaag', { size: 12, rotate: folded ? undefined : 180 })}
            </button>`
          : nothing
      }
    </div>
  `
}
