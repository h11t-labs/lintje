/**
 * `<lintje-grid>` — the 12-column grid. Its items are its own children; a tile carries `span`
 * itself and needs no wrapper.
 * Events: none.
 */
import { html, type PropertyValues, type TemplateResult } from 'lit'
import { LintjeElement, define } from '../../core/element'
import { shadowCss } from '../../core/styles'
import gridCss from './grid.css?inline'

export class LintjeGrid extends LintjeElement {
  static override styles = shadowCss(gridCss)

  static override properties = {
    columns: { type: Number },
    variant: { type: String, reflect: true },
  }

  /** Columns at desktop width. */
  columns: number = 12
  /** `kpi-row` switches to 3 columns at 768-1023 and 2 below that. */
  declare variant?: 'kpi-row'

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    this.style.setProperty('--lintje-grid-columns', String(this.columns))
  }

  protected override render(): TemplateResult {
    return html`<slot></slot>`
  }
}

define('lintje-grid', LintjeGrid)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-grid': LintjeGrid
  }
}
