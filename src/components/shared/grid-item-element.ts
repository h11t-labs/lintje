/** What every element that can stand in a `<lintje-grid>` shares: `span` and `span.css`. */
import { type PropertyDeclarations, type PropertyValues } from 'lit'
import { LintjeElement } from '../../core/element'
import { shadowCss } from '../../core/styles'
import spanCss from './span.css?inline'

export const spanStyles = shadowCss(spanCss)

/** The `span` attribute, reflected, and `--lintje-span` written inline for `span.css`. */
export class LintjeGridItemElement extends LintjeElement {
  static override properties: PropertyDeclarations = {
    span: { type: Number, reflect: true },
  }

  /** Columns of the 12-column grid; default one. */
  declare span?: number

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (this.span) this.style.setProperty('--lintje-span', String(this.span))
    else this.style.removeProperty('--lintje-span')
  }
}
