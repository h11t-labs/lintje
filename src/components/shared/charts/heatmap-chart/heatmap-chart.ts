/** Heatmap with class legend; below 768 px the days become columns, the hours rows. */
import { html, nothing, type TemplateResult } from 'lit'
import { ref } from 'lit/directives/ref.js'
import { styleProps } from '../../../../core/style-props'
import { formatNumber } from '../../../../core/format'
import { gridStaggerStyle } from '../shared/stagger'
import { renderTooltip } from '../shared/tooltip'
import { formatWithUnit, heatmapClassFor, heatmapClasses } from './heatmap-classes'
import type { ChartOptions } from '../shared/controller'
import { markSelection } from '../shared/mark-select'
import type { ChartSpec } from '../shared/types'

export type { HeatmapClass } from './heatmap-classes'
export { heatmapBounds, heatmapClasses } from './heatmap-classes'

type HeatmapSpec = Extract<ChartSpec, { kind: 'heatmap' }>
type HeatmapGrid = NonNullable<HeatmapSpec['mobile']>

/** Rows become columns and columns rows. */
function transpose<T>(
  grid: readonly (readonly T[])[] | undefined,
  rows: number,
  columns: number,
): T[][] {
  return Array.from({ length: columns }, (_, column) =>
    Array.from({ length: rows }, (__, row) => grid?.[row]?.[column] as T),
  )
}

/**
 * The phone's grid when the host sent none: a grid wider than it is tall turns on its side, so
 * the long axis runs down the page (rule 9). It is compact, as the host's own would be.
 */
export function phoneGrid(spec: HeatmapSpec): HeatmapGrid | undefined {
  if (spec.mobile) return spec.mobile
  const rows = spec.rowLabels.length
  const columns = spec.columnLabels.length
  if (columns <= rows) return undefined
  return {
    columnLabels: spec.rowLabels,
    rowLabels: spec.columnLabels,
    values: transpose(spec.values, rows, columns),
    links: spec.links ? transpose(spec.links, rows, columns) : undefined,
  }
}

export function renderHeatmap(spec: HeatmapSpec, options: ChartOptions): TemplateResult {
  const { controller, description, mobile = false } = options
  // Below 768 px the heatmap switches representation: the host's, or the grid on its side (rule 9).
  const swap = mobile ? phoneGrid(spec) : undefined
  const columnLabels = swap?.columnLabels ?? spec.columnLabels
  const rowLabels = swap?.rowLabels ?? spec.rowLabels
  const values = swap?.values ?? spec.values
  // The swap has its own cells, so it carries its own drilldowns.
  const links = swap ? swap.links : spec.links
  const compact = swap ? true : (spec.compact ?? false)
  const { unit } = spec
  const selection = markSelection(options, (links ?? []).flat())

  /* The classes follow the values drawn; a `bounds` from the spec keeps them fixed over time. */
  const classes = heatmapClasses(values, { bounds: spec.bounds, unit })
  const classFor = (value: number) => heatmapClassFor(classes, value)

  // Nothing to measure: the grid is a table. The draw-in waits for the heatmap to come into view.
  controller.measure({})

  const selected = controller.selectedCell
  const dimmed = controller.dimmedClass

  return html`
    <div class="lintje-heatmap" ${ref(controller.attach)} ?data-in-view=${controller.inView}
         data-tooltip-anchor @keydown=${selection.escape}>
      <table class="lintje-heatmap__grid ${compact ? 'is-compact' : ''}">
        <caption class="visually-hidden">${description}</caption>
        <thead>
          <tr>
            <td></td>
            ${columnLabels.map((label) => html`<th scope="col" class="lintje-heatmap__column-label">${label}</th>`)}
          </tr>
        </thead>
        <tbody>
          ${rowLabels.map(
            (rowLabel, row) => html`
            <tr>
              <th scope="row" class="lintje-heatmap__row-label" title=${rowLabel}>
                <span class="lintje-heatmap__row-label-text">${rowLabel}</span>
              </th>
              ${columnLabels.map((_, column) => {
                const value = values[row]?.[column]
                // An empty cell gets the slot/cell pair without the button: `display: flex` on
                // the `<td>` itself took it out of the table's layout (rule 15). Its words are
                // in the cell, for a reader that never sees a `title`.
                if (value == null) {
                  return html`
                    <td class="lintje-heatmap__slot">
                      <div class="lintje-heatmap__cell is-empty"
                           title="${rowLabel} · ${columnLabels[column]}: geen meting">
                        <span class="visually-hidden">geen meting</span>
                      </div>
                    </td>
                  `
                }
                const klass = classFor(value)
                /*
                 * A cell that drills is the host's: `aria-pressed` follows `selectedId`. The
                 * button activates on Enter and Space itself, so the mark's key handler stays
                 * off, or it would fire twice.
                 */
                const mark = selection.of(
                  links?.[row]?.[column],
                  `${rowLabel} · ${columnLabels[column]}`,
                )
                const isSelected =
                  !mark.clickable && selected?.row === row && selected?.column === column
                return html`
                  <td class="lintje-heatmap__slot">
                    <button
                      type="button"
                      class="lintje-heatmap__cell lintje-heatmap__cell--class-${classes[klass].ramp} ${isSelected ? 'is-selected' : ''} ${dimmed != null && dimmed !== klass ? 'is-dimmed' : ''} ${mark.state}"
                      data-mark-id=${mark.markId}
                      ${styleProps({
                        '--lintje-cell': classes[klass].color,
                        ...gridStaggerStyle(column, row, columnLabels.length, rowLabels.length),
                      })}
                      @click=${
                        mark.clickable
                          ? mark.click
                          : () => {
                              controller.selectedCell = isSelected ? null : { row, column }
                              controller.requestUpdate()
                            }
                      }
                      @mousemove=${
                        compact
                          ? undefined
                          : (event: MouseEvent) =>
                              controller.showTooltip(event, {
                                title: `${rowLabel} · ${columnLabels[column]}`,
                                rows: [
                                  {
                                    label: `klasse ${classes[klass].label}`,
                                    value: formatWithUnit(value, unit),
                                    color: classes[klass].color,
                                  },
                                ],
                              })
                      }
                      @mouseleave=${compact ? undefined : () => controller.hideTooltip()}
                      aria-pressed=${mark.clickable ? mark.pressed : isSelected}
                      aria-label="${rowLabel} ${columnLabels[column]}: ${formatWithUnit(value, unit)}, klasse ${classes[klass].label}"
                    >${formatNumber(value)}</button>
                  </td>
                `
              })}
            </tr>
          `,
          )}
        </tbody>
      </table>

      <!-- Selected cell: a 48 px line with day, block, value, class. -->
      ${
        selected && values[selected.row]?.[selected.column] != null
          ? html`
        <p class="lintje-heatmap__selection">
          <b>${rowLabels[selected.row]} ${columnLabels[selected.column]}</b> ·
          ${formatWithUnit(values[selected.row][selected.column]!, unit)} · klasse
          ${classes[classFor(values[selected.row][selected.column]!)].label}
        </p>
      `
          : nothing
      }

      <!-- Class legend: clickable, dims the other classes to .25. -->
      <ul class="lintje-heatmap__legend">
        ${classes.map(
          (klass, i) => html`
          <li>
            <button type="button" class="lintje-heatmap__legend-item ${dimmed != null && dimmed !== i ? 'is-dimmed' : ''}"
                    @click=${() => {
                      controller.dimmedClass = dimmed === i ? null : i
                      controller.requestUpdate()
                    }}
                    aria-pressed=${dimmed === i}>
              <span class="lintje-heatmap__swatch lintje-heatmap__swatch--class-${klass.ramp}" ${styleProps({ background: klass.color })}></span>
              <span>${klass.label}</span>
            </button>
          </li>
        `,
        )}
      </ul>
      ${renderTooltip(controller)}
    </div>
  `
}
