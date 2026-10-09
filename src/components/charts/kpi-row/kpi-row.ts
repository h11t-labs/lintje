/**
 * `<lintje-kpi-row>` — the KPI row: one grid, the KPIs staggered in from left to right.
 *
 * The grid and the KPIs share one shadow root, so `kpi-row.css` reaches the `<lintje-kpi>` hosts.
 * `dividers` is set as a property: a boolean attribute can't turn off a `true` default.
 * Events: none.
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { styleProps } from '../../../core/style-props'
import { define, type FrameSettings } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { LintjeGridItemElement, spanStyles } from '../../../primitives/shared/grid-item-element'
import '../kpi/kpi'
import kpiRowCss from './kpi-row.css?inline'
import type { KpiRowData } from '../../../types'

export class LintjeKpiRow extends LintjeGridItemElement {
  static override styles = [spanStyles, shadowCss(kpiRowCss)]

  static override properties: PropertyDeclarations = {
    data: { attribute: false },
  }

  declare data?: KpiRowData | null

  protected override get dataSettings(): FrameSettings | undefined {
    return this.data ?? undefined
  }

  protected override render(): TemplateResult {
    const kpis = this.data?.kpis ?? []
    const columns = this.data?.columns ?? 5
    return html`<div
      class="lintje-grid lintje-grid--kpi-row"
      ${styleProps({ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` })}
    >
      ${kpis.map(
        (kpi, index) => html`<lintje-kpi
          index=${index}
          label=${kpi.label}
          icon=${kpi.icon ?? nothing}
          .value=${kpi.value}
          .suffix=${kpi.suffix}
          .items=${kpi.items}
          .trend=${kpi.trend}
          .note=${kpi.note}
          .detail=${kpi.detail}
          layout=${kpi.layout ?? 'row'}
          emphasis=${kpi.emphasis ?? 'equal'}
          .dividers=${kpi.dividers ?? true}
          variable=${kpi.variable ?? 'sky-blue'}
          state=${kpi.state ?? 'ready'}
        ></lintje-kpi>`,
      )}
    </div>`
  }
}

define('lintje-kpi-row', LintjeKpiRow)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-kpi-row': LintjeKpiRow
  }
}
