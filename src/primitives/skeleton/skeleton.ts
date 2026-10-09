/** `<lintje-skeleton>` — the shimmer that holds a box while its content loads. Events: none. */
import { html, type PropertyValues, type TemplateResult } from 'lit'
import { LintjeElement, define } from '../../core/element'
import { shadowCss } from '../../core/styles'
import { length } from '../shared/length'
import skeletonCss from './skeleton.css?inline'

export class LintjeSkeleton extends LintjeElement {
  static override styles = shadowCss(skeletonCss)

  static override properties = {
    width: { type: String },
    height: { type: String },
  }

  /** A number is pixels; the default is the full width of its box. */
  width: number | string = '100%'
  height: number | string = 12

  /** The size goes on the host: a percentage on the inner span would resolve against height 0. */
  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    this.style.width = length(this.width) ?? ''
    this.style.height = length(this.height) ?? ''
  }

  protected override render(): TemplateResult {
    return html`<span class="lintje-skeleton" aria-hidden="true"></span>`
  }
}

define('lintje-skeleton', LintjeSkeleton)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-skeleton': LintjeSkeleton
  }
}
