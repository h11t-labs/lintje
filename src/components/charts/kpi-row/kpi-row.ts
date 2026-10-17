/** `<lintje-kpi-row>` — the KPI row: one grid, the KPIs staggered in from left to right. */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { styleProps } from '../../../core/style-props'
import { define, type FrameSettings } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { LintjeGridItemElement, spanStyles } from '../../shared/grid-item-element'
import '../kpi/kpi'
import type { HeadingLevel } from '../../shared/heading'
import kpiRowCss from './kpi-row.css?inline'
import type { KpiRowData } from '../../../types'

export class LintjeKpiRow extends LintjeGridItemElement {
  // The KPIs are drawn in this root, so `kpi-row.css` reaches their hosts.
  static override styles = [spanStyles, shadowCss(kpiRowCss)]

  static override properties: PropertyDeclarations = {
    data: { attribute: false },
    level: { type: Number },
  }

  declare data?: KpiRowData | null
  /** The heading level of every label, 2 to 6; `h3` when unset, for a row that stands deeper. */
  declare level?: HeadingLevel

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
          level=${this.level ?? nothing}
          icon=${kpi.icon ?? nothing}
          .value=${kpi.value}
          .suffix=${kpi.suffix}
          .items=${kpi.items}
          .trend=${kpi.trend}
          .sparkline=${kpi.sparkline}
          .gauge=${kpi.gauge}
          .note=${kpi.note}
          .detail=${kpi.detail}
          layout=${kpi.layout ?? 'row'}
          emphasis=${kpi.emphasis ?? 'equal'}
          .dividers=${kpi.dividers ?? true}
          variable=${kpi.variable ?? 'sky-blue'}
          state=${kpi.state ?? 'ready'}
          .message=${kpi.message}
          .lastKnown=${kpi.lastKnown}
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
