/**
 * `<lintje-kpi-row>` — the KPI row: one grid, the KPIs staggered in from left to right. One live
 * region speaks for the row: five KPIs that load say "Laden" once.
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { styleProps } from '../../../core/style-props'
import { define, type FrameSettings } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { LintjeGridItemElement, spanStyles } from '../../shared/grid-item-element'
import '../kpi/kpi'
import { kpiStateWords } from '../kpi/kpi'
import { LiveMessage } from '../../shared/live-message'
import kpiRowCss from './kpi-row.css?inline'
import type { KpiRowData } from '../../../types'

export class LintjeKpiRow extends LintjeGridItemElement {
  // The KPIs are drawn in this root, so `kpi-row.css` reaches their hosts.
  static override styles = [spanStyles, shadowCss(kpiRowCss)]

  static override properties: PropertyDeclarations = {
    data: { attribute: false },
  }

  declare data?: KpiRowData | null
  readonly #live = new LiveMessage(this)
  #states: (string | undefined)[] | null = null

  protected override get dataSettings(): FrameSettings | undefined {
    return this.data ?? undefined
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (!changed.has('data')) return
    const kpis = this.data?.kpis ?? []
    const before = this.#states
    this.#states = kpis.map((kpi) => kpi.state ?? 'ready')
    // The first drawing is silent; after it, what changed is said in one sentence.
    if (!before) return
    const changedKpis = kpis.filter((kpi, i) => (kpi.state ?? 'ready') !== before[i])
    const loading = changedKpis.some((kpi) => kpi.state === 'loading')
    const lines = changedKpis
      .filter((kpi) => kpi.state === 'empty' || kpi.state === 'error')
      .map((kpi) => `${kpi.label}: ${kpiStateWords(kpi.state!, kpi.message)}`)
    const words = [...(loading ? ['Laden'] : []), ...lines].join('. ')
    if (words) this.#live.say(words)
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
          quiet
        ></lintje-kpi>`,
      )}
      <p class="visually-hidden" role="status" aria-atomic="false">${this.#live.text}</p>
    </div>`
  }
}

define('lintje-kpi-row', LintjeKpiRow)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-kpi-row': LintjeKpiRow
  }
}
