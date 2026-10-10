/** The scale of a single KPI figure: a half circle around the value, or a bar under it. */
import { html, nothing, svg, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { styleProps } from '../../../core/style-props'
import { formatNumber } from '../../../core/format'
import type { KpiGauge } from '../../../types'

/** The arc's geometry in viewBox units, which are px at its full width. */
const RADIUS = 64
const BAND = 24
const TICK_INNER = RADIUS - BAND / 2 - 6
const TICK_OUTER = RADIUS + BAND / 2 + 6
const LABEL = TICK_OUTER + 4
const HALF = TICK_OUTER + 2

export interface GaugeView {
  gauge: KpiGauge
  /** The figure on the scale; `null` draws the track alone. */
  value: number | null
  /** Draws the fill; empty and error keep the scale and the target without it. */
  ready: boolean
  /** Draws the track alone. */
  loading: boolean
  /** Starts the fill's sweep. */
  drawn: boolean
  /** The accent of the variable. */
  color: string
}

interface Scale {
  min: number
  max: number
  share: (n: number) => number
}

function scaleOf(gauge: KpiGauge): Scale {
  const min = gauge.min ?? 0
  const max = gauge.max > min ? gauge.max : min + 1
  return { min, max, share: (n) => Math.max(0, Math.min(1, (n - min) / (max - min))) }
}

/** A point at `share` of the half circle, from the left end over the top. */
function point(radius: number, share: number): [number, number] {
  const angle = Math.PI * (1 - share)
  return [radius * Math.cos(angle), -radius * Math.sin(angle)]
}

function description(view: GaugeView, scale: Scale): string {
  const { gauge, value } = view
  const target =
    gauge.target == null ? '' : `, ${gauge.targetLabel ?? 'doel'} ${formatNumber(gauge.target)}`
  const figure = value == null || !view.ready ? '' : `${formatNumber(value)} `
  return `${figure}op een schaal van ${formatNumber(scale.min)} tot ${formatNumber(scale.max)}${target}`
}

function targetText(gauge: KpiGauge): string {
  return `${gauge.targetLabel ?? 'doel'} ${formatNumber(gauge.target!)}`
}

/** The number figure goes in as `figure`: in the arc's mouth, or above the bar. */
export function renderGauge(view: GaugeView, figure: TemplateResult): TemplateResult {
  return view.gauge.shape === 'linear' ? linear(view, figure) : arc(view, figure)
}

function arc(view: GaugeView, figure: TemplateResult): TemplateResult {
  const { gauge, value, ready } = view
  const scale = scaleOf(gauge)
  const fill = ready && value != null && scale.share(value) > 0 ? scale.share(value) : null
  const end = fill == null ? null : point(RADIUS, fill)
  const hasTarget = !view.loading && gauge.target != null
  const at = hasTarget ? scale.share(gauge.target!) : 0
  const [x1, y1] = point(TICK_INNER, at)
  const [x2, y2] = point(TICK_OUTER, at)
  const [lx, ly] = point(LABEL, at)
  const side = Math.cos(Math.PI * (1 - at))
  const anchor = side > 0.3 ? 'start' : side < -0.3 ? 'end' : 'middle'
  // Label positions as shares of the drawing's box, so they keep their size as it narrows.
  const left = (x: number) => `${((x + HALF) / (2 * HALF)) * 100}%`
  const top = (y: number) => `${((y + HALF) / HALF) * 100}%`
  return html`<div class="lintje-gauge__frame"><div
    class=${classMap({ 'lintje-gauge': true, 'lintje-gauge--arc': true, 'is-drawn': view.drawn })}>
    ${figure}
    <svg class="lintje-gauge__svg" viewBox="${-HALF} ${-HALF} ${2 * HALF} ${HALF}" role="img"
         aria-label=${description(view, scale)}>
      <desc>${description(view, scale)}</desc>
      <path class="lintje-gauge__track" d="M ${-RADIUS} 0 A ${RADIUS} ${RADIUS} 0 0 1 ${RADIUS} 0"
            stroke-width=${BAND} />
      ${
        end
          ? svg`<path class="lintje-gauge__arc-fill" pathLength="1"
                d="M ${-RADIUS} 0 A ${RADIUS} ${RADIUS} 0 0 1 ${end[0].toFixed(2)} ${end[1].toFixed(2)}"
                stroke-width=${BAND} ${styleProps({ stroke: view.color })} />`
          : nothing
      }
      ${
        hasTarget
          ? svg`<line class="lintje-gauge__tick" x1=${x1.toFixed(2)} y1=${y1.toFixed(2)}
                x2=${x2.toFixed(2)} y2=${y2.toFixed(2)} />`
          : nothing
      }
    </svg>
    <span class="lintje-gauge__label lintje-gauge__label--limit" aria-hidden="true"
          ${styleProps({ left: left(-RADIUS), top: '100%' })}>${formatNumber(scale.min)}</span>
    <span class="lintje-gauge__label lintje-gauge__label--limit" aria-hidden="true"
          ${styleProps({ left: left(RADIUS), top: '100%' })}>${formatNumber(scale.max)}</span>
    ${
      hasTarget
        ? html`<span class="lintje-gauge__label lintje-gauge__label--target lintje-gauge__label--${anchor}"
              aria-hidden="true" ${styleProps({ left: left(lx), top: top(ly) })}>${targetText(gauge)}</span>`
        : nothing
    }
  </div></div>`
}

function linear(view: GaugeView, figure: TemplateResult): TemplateResult {
  const { gauge, value, ready } = view
  const scale = scaleOf(gauge)
  const fill = ready && value != null ? scale.share(value) : null
  const hasTarget = !view.loading && gauge.target != null
  const at = hasTarget ? scale.share(gauge.target!) : 0
  // The target's label moves inward near an end, where the end's number stands.
  const anchor = at > 0.8 ? 'end' : at < 0.2 ? 'start' : 'middle'
  return html`${figure}
    <div class=${classMap({ 'lintje-gauge': true, 'lintje-gauge--linear': true, 'is-drawn': view.drawn })}
         role="img" aria-label=${description(view, scale)}>
      <div class="lintje-gauge__bar">
        ${
          fill == null
            ? nothing
            : html`<div class="lintje-gauge__bar-fill"
                ${styleProps({ width: `${fill * 100}%`, background: view.color })}></div>`
        }
        ${
          hasTarget
            ? html`<span class="lintje-gauge__mark" ${styleProps({ left: `${at * 100}%` })}></span>`
            : nothing
        }
      </div>
      <div class="lintje-gauge__scale">
        <span>${formatNumber(scale.min)}</span>
        ${
          hasTarget
            ? html`<span class="lintje-gauge__scale-target lintje-gauge__scale-target--${anchor}"
                ${styleProps({ left: `${at * 100}%` })}>${targetText(gauge)}</span>`
            : nothing
        }
        <span>${formatNumber(scale.max)}</span>
      </div>
    </div>`
}
