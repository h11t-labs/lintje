/** Chart tooltip: a heading, then every series with a color swatch and value. */
import { html, nothing, type TemplateResult } from 'lit'
import { directive, Directive, PartType, type ElementPart, type PartInfo } from 'lit/directive.js'
import { styleProps } from '../../../../core/style-props'
import type { ChartController, TooltipState } from './controller'
import { renderSymbol } from './axes'

/**
 * Places the tooltip right of the pointer, flipping near the tile's edge. A directive, not a
 * `ref`: it runs on every move. Coordinates go through the CSSOM because `style-src 'self'`
 * drops style attributes.
 */
class PlaceTooltipDirective extends Directive {
  constructor(partInfo: PartInfo) {
    super(partInfo)
    if (partInfo.type !== PartType.ELEMENT) {
      throw new Error('placeTooltip only works on an element')
    }
  }

  render(_state: TooltipState): typeof nothing {
    return nothing
  }

  override update(part: ElementPart, [state]: [TooltipState]): typeof nothing {
    const element = part.element as HTMLElement
    element.style.top = `${Math.max(0, state.y - 12)}px`
    // The width follows from the content, which has committed by the next frame.
    requestAnimationFrame(() => {
      if (!element.isConnected) return
      const available = element.parentElement?.clientWidth ?? Infinity
      element.style.left = `${Math.max(0, Math.min(state.x + 12, available - element.offsetWidth - 8))}px`
    })
    return nothing
  }
}

const placeTooltip = directive(PlaceTooltipDirective)

export function renderTooltip(controller: ChartController): TemplateResult | typeof nothing {
  const state = controller.tooltip
  if (!state) return nothing
  const { content } = state
  return html`
    <div class="lintje-chart-tooltip" ${placeTooltip(state)}>
      <p class="lintje-chart-tooltip__title">${content.title}</p>
      ${content.rows.map(
        (row) => html`
        <p class="lintje-chart-tooltip__row ${row.divider ? 'lintje-chart-tooltip__row--divider' : ''}">
          <span class="lintje-chart-tooltip__label">
            ${
              row.symbol
                ? html`<svg class="lintje-chart-tooltip__marker lintje-chart-tooltip__marker--symbol"
                            viewBox="0 0 14 14" ${styleProps({ color: row.color })}
                            aria-hidden="true" focusable="false">${renderSymbol(row.symbol, row.color, 7)}</svg>`
                : row.color
                  ? html`<span class="lintje-chart-tooltip__marker" ${styleProps({ background: row.color })}></span>`
                  : nothing
            }
            ${row.label}
          </span>
          <span class="lintje-chart-tooltip__value">${row.value}</span>
        </p>
      `,
      )}
    </div>
  `
}
