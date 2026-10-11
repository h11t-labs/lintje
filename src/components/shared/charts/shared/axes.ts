/** The chart frame: axes, grid, zero line, hatching, as-of line, description and legend. */
import { html, svg, nothing, type SVGTemplateResult, type TemplateResult } from 'lit'
import { styleProps } from '../../../../core/style-props'
import { AXIS_GAP, DEFAULT_PLOT_AREA, plotWidth, yPosition, type PlotArea } from './scale'
import { formatNumber, textWidth } from '../../../../core/format'
import type { PlotKeys } from './plot-keys'
import { markPath, type SeriesKey } from './series-shapes'
import { DEFAULT_SERIES_COLOR, lineCasing } from './colors'

/** Anything that may go inside the `<svg>`; built with lit's `svg`, since `html` draws nothing. */
export type SvgSlot =
  | SVGTemplateResult
  | typeof nothing
  | false
  | null
  | undefined
  | readonly SvgSlot[]

export interface LegendItem {
  label: string
  color?: string
  /** `point`: the series' symbol alone, as a scatter plot or a map draws it; `hatch` is "no data". */
  shape?: 'square' | 'line' | 'dashed' | 'point' | 'hatch'
  /** The shape the line carries at its end, drawn on its line marker (rule 13). */
  symbol?: SeriesKey
  hidden?: boolean
  /** Not a series but a reference, such as a norm: never a toggle. */
  fixed?: boolean
  /** What `onToggle` receives; without it the label. */
  key?: string
}

/**
 * A series' symbol as a scatter plot draws it, for a marker: its shape in `currentColor`, and a
 * dark-yellow one with the edge of its text colour (`lineCasing`).
 */
export function renderSymbol(
  symbol: SeriesKey,
  color: string | undefined,
  centre: number,
): SVGTemplateResult {
  const casing = lineCasing(color)
  return svg`<path d=${markPath(symbol, 4.5, centre, centre)} fill="currentColor"
                   stroke=${casing ?? nothing} stroke-width=${casing ? 1 : nothing} />`
}

export function renderLegend({
  items,
  onToggle,
  position = 'top',
}: {
  items: LegendItem[]
  onToggle?: (label: string) => void
  position?: 'top' | 'bottom' | 'right'
}): TemplateResult {
  const content = (item: LegendItem) => html`
    ${
      item.symbol && item.shape === 'point'
        ? html`<svg class="lintje-legend__marker lintje-legend__marker--symbol" viewBox="0 0 14 14"
                    ${styleProps({ color: item.color ?? DEFAULT_SERIES_COLOR })}
                    aria-hidden="true" focusable="false">
            ${renderSymbol(item.symbol, item.color, 7)}
          </svg>`
        : item.symbol
          ? html`<svg class="lintje-legend__marker lintje-legend__marker--symbol" viewBox="0 0 14 14"
                    ${styleProps({ color: item.color ?? DEFAULT_SERIES_COLOR })}
                    aria-hidden="true" focusable="false">
            <line x1="0" x2="14" y1="7" y2="7" stroke="currentColor" stroke-width="3" />
            <path d=${markPath(item.symbol, 4, 7, 7)} fill="currentColor" />
          </svg>`
          : html`<span class="lintje-legend__marker lintje-legend__marker--${item.shape ?? 'square'}"
                     ${styleProps({ color: item.color ?? DEFAULT_SERIES_COLOR })}
                     aria-hidden="true"></span>`
    }
    <span class="lintje-legend__label">${item.label}</span>
  `
  return html`
    <ul class="lintje-legend lintje-legend--${position}">
      ${items.map(
        (item) => html`
        <li class="lintje-legend__item ${item.hidden ? 'is-hidden' : ''}">
          ${
            onToggle && !item.fixed
              ? html`<button type="button" class="lintje-legend__button"
                           @click=${() => onToggle(item.key ?? item.label)}
                           aria-pressed=${!item.hidden}>${content(item)}</button>`
              : content(item)
          }
        </li>
      `,
      )}
    </ul>
  `
}

type XAnchor = 'start' | 'middle' | 'end'

export interface ChartFrameOptions {
  area?: PlotArea
  ticks: number[]
  max: number
  /** Unit above the axis, e.g. "Afgehandelde aanvragen". */
  axisTitle?: string
  /** `anchor` defaults to the middle; the last label of a value axis ends at the plot's edge. */
  xLabels?: { label: string; x: number; anchor?: XAnchor }[]
  /** The title of a value axis along the bottom, under its labels at the right. */
  xTitle?: string
  /** Description for screen readers; replaces the chart in the accessibility tree. */
  description: string
  height?: number
  /** Extra definitions (hatch patterns etc.). */
  defs?: SvgSlot
  zeroLine?: boolean
  /** How a tick is written; `axisColumn` decides between full and compact. Default full. */
  formatTick?: (tick: number) => string
  /** The resolved `--font-ui`, for measuring the x labels. */
  fontFamily?: string
  id: string
  /** Some mark is a button: the drawing is a group named by its description, not an image. */
  interactive?: boolean
  /** The arrow keys over the categories; the drawing then takes the focus. */
  keys?: PlotKeys
}

/** `role` and the focus of a chart's `<svg>`: an image, unless it holds buttons (WCAG 4.1.2). */
export function drawingRole(interactive: boolean | undefined): 'group' | 'img' {
  return interactive ? 'group' : 'img'
}

/**
 * The focus ring of a mark: 3 px of `--color-focus` outside a 1 px gap in the surface, so it
 * stands apart from an orange mark too. A filter, as an outline does not follow a slice; the
 * drawing hands its id to the CSS as `--lintje-focus-ring` (`focusRingStyle`). Any alpha
 * counts as the shape, so a muted mark's ring is as strong as any other.
 */
export function renderFocusRing(id: string): SVGTemplateResult {
  return svg`
    <filter id="focus-${id}" filterUnits="userSpaceOnUse" x="-10%" y="-10%" width="120%" height="120%"
            color-interpolation-filters="sRGB">
      <feComponentTransfer in="SourceAlpha" result="shape"><feFuncA type="linear" slope="100" /></feComponentTransfer>
      <feMorphology in="shape" operator="dilate" radius="4" result="outer" />
      <feFlood class="lintje-chart__focus-ring" />
      <feComposite in2="outer" operator="in" result="ring" />
      <feMorphology in="shape" operator="dilate" radius="1" result="inner" />
      <feFlood class="lintje-chart__focus-gap" />
      <feComposite in2="inner" operator="in" result="gap" />
      <feMerge><feMergeNode in="ring" /><feMergeNode in="gap" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
  `
}

/** The custom property that points a drawing's marks at its focus ring. */
export function focusRingStyle(id: string): Record<string, string> {
  return { '--lintje-focus-ring': `url(#focus-${id})` }
}

const X_LABEL_GAP = 8
/** From the zero line to the baseline of the x labels, and again to that of the x title. */
const X_LABEL_DROP = 20

/**
 * The x labels that fit: every one while no two neighbours touch, otherwise every second,
 * third, … from the first on. Neighbours are measured pair by pair, each where its anchor puts
 * it, so one long name beside a short one can fit where equal day labels do not.
 */
export function thinLabels<T extends { label: string; x: number; anchor?: XAnchor }>(
  labels: T[],
  fontFamily = '',
): T[] {
  if (labels.length < 2) return labels
  const spans = labels.map((label) => {
    const width = textWidth(label.label, fontFamily)
    const left =
      label.anchor === 'end'
        ? label.x - width
        : label.anchor === 'start'
          ? label.x
          : label.x - width / 2
    return { left, right: left + width }
  })
  const fits = (stride: number): boolean => {
    for (let i = 0; i + stride < labels.length; i += stride) {
      const a = spans[i]
      const b = spans[i + stride]
      if (Math.max(b.left - a.right, a.left - b.right) < X_LABEL_GAP) return false
    }
    return true
  }
  let stride = 1
  while (stride < labels.length && !fits(stride)) stride += 1
  return stride === 1 ? labels : labels.filter((_, index) => index % stride === 0)
}

export function renderChartFrame(
  {
    area = DEFAULT_PLOT_AREA,
    ticks,
    max,
    axisTitle,
    xLabels,
    xTitle,
    description,
    defs,
    zeroLine = true,
    formatTick = formatNumber,
    id,
    height,
    fontFamily,
    interactive,
    keys,
  }: ChartFrameOptions,
  children: SvgSlot,
): TemplateResult {
  return html`
    <figure class="lintje-chart">
      ${axisTitle ? html`<figcaption class="lintje-chart__axis-title">${axisTitle}</figcaption>` : nothing}
      <!-- The viewBox is set 1:1 to the measured pixels, so 12 px axis text really is
           12 px — however narrow the tile is. -->
      <svg
        viewBox="0 0 ${area.width} ${area.height}"
        class="lintje-chart__svg"
        width=${area.width}
        height=${area.height}
        ${styleProps({ height: `${height ?? area.height}px`, ...focusRingStyle(id) })}
        role=${drawingRole(interactive)}
        aria-labelledby="${id}-desc"
        tabindex=${keys ? 0 : nothing}
        @keydown=${keys?.keydown}
        @focus=${keys?.focus}
        @blur=${keys?.blur}
      >
        <desc id="${id}-desc">${description}</desc>
        <defs>
          <pattern id="hatch-${id}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-chart-hatch)" stroke-width="2" />
          </pattern>
          ${renderFocusRing(id)}
          ${defs}
        </defs>

        <!-- Grid + axis labels -->
        ${ticks.map((tick) => {
          const y = yPosition(tick, max, area)
          const isZero = tick === 0
          return svg`
            <g>
              <line
                x1=${area.left} x2=${area.width - area.right} y1=${y} y2=${y}
                stroke=${isZero && zeroLine ? 'var(--color-chart-zero)' : 'var(--color-chart-grid)'}
                stroke-width=${isZero && zeroLine ? 1.5 : 1} />
              <text x=${area.left - AXIS_GAP} y=${y + 4} text-anchor="end" class="lintje-chart__axis-label">
                ${formatTick(tick)}
              </text>
            </g>
          `
        })}

        ${children}

        <!-- x-axis labels -->
        ${thinLabels(xLabels ?? [], fontFamily).map(
          (label) => svg`
          <text x=${label.x} y=${area.height - area.bottom + X_LABEL_DROP} text-anchor=${label.anchor ?? 'middle'} class="lintje-chart__axis-label">
            ${label.label}
          </text>
        `,
        )}
        ${
          xTitle
            ? svg`<text x=${area.width - area.right} y=${area.height - area.bottom + 2 * X_LABEL_DROP} text-anchor="end"
                      class="lintje-chart__x-title">${xTitle}</text>`
            : nothing
        }
      </svg>
    </figure>
  `
}

/**
 * The as-of marker. Up to 6 pending hours (tail) it draws nothing and the missing hours are
 * hatched; beyond that (early) the series is cut off, with a line, a label and a note.
 */
export function renderAsOfMarker({
  area = DEFAULT_PLOT_AREA,
  index,
  count,
  label,
  lastValue,
  pendingHours,
}: {
  area?: PlotArea
  index: number
  count: number
  label: string
  lastValue?: string
  pendingHours: number
}): SvgSlot {
  const x = area.left + (plotWidth(area) * index) / (count - 1)
  const isEarly = pendingHours > 6
  const remainingWidth = area.width - area.right - x
  // A label that would fall outside the tile goes left of the line.
  const right = remainingWidth > 140

  if (!isEarly) return nothing

  return svg`
    <g>
      <line x1=${x} x2=${x} y1=${area.top} y2=${area.height - area.bottom}
            stroke="var(--color-text-primary)" stroke-width="1.5" stroke-dasharray="4 3" />
      <text x=${right ? x + 6 : x - 6} y=${area.top + 12}
            text-anchor=${right ? 'start' : 'end'} class="lintje-chart__as-of-label">
        ${label}
      </text>
      ${
        lastValue
          ? svg`<text x=${right ? x + 6 : x - 6} y=${area.top + 26}
                    text-anchor=${right ? 'start' : 'end'} class="lintje-chart__axis-label">${lastValue}</text>`
          : nothing
      }
      <text x=${x + remainingWidth / 2} y=${area.top + (area.height - area.top - area.bottom) / 2}
            text-anchor="middle" class="lintje-chart__as-of-note">
        nog geen gegevens · ${pendingHours} ${pendingHours === 1 ? 'uur' : 'uren'} volgen
      </text>
    </g>
  `
}
