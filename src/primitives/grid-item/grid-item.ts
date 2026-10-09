/** `<lintje-grid-item>` — a grid cell for non-`lintje-` content. Events: none. */
import { html, type TemplateResult } from 'lit'
import { define } from '../../core/element'
import { LintjeGridItemElement, spanStyles } from '../shared/grid-item-element'

export class LintjeGridItem extends LintjeGridItemElement {
  static override styles = spanStyles

  protected override render(): TemplateResult {
    return html`<slot></slot>`
  }
}

define('lintje-grid-item', LintjeGridItem)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-grid-item': LintjeGridItem
  }
}
