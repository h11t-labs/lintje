/** What every element that can stand in a `<lintje-grid>` shares: `span` and `span.css`. */
import { type PropertyDeclarations, type PropertyValues } from 'lit'
import { LintjeElement } from '../../core/element'
import { shadowCss } from '../../core/styles'
import spanCss from './span.css?inline'

export const spanStyles = shadowCss(spanCss)

/** The phone's columns in the new house style. */
const MOBILE_COLUMNS = 4

/**
 * The `span` and `span-mobile` attributes, reflected, and `--lintje-span` and
 * `--lintje-span-mobile` written inline for `span.css`.
 */
export class LintjeGridItemElement extends LintjeElement {
  static override properties: PropertyDeclarations = {
    span: { type: Number, reflect: true },
    spanMobile: { type: Number, attribute: 'span-mobile', reflect: true },
  }

  /** Columns of the 12-column grid; default one. */
  declare span?: number
  /**
   * Columns of the phone's four in the new house style, below 768 px; default all four. The
   * earlier style has one column on a phone, so there it changes nothing.
   */
  declare spanMobile?: number

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (this.span) this.style.setProperty('--lintje-span', String(this.span))
    else this.style.removeProperty('--lintje-span')
    if (this.spanMobile) {
      const columns = Math.min(Math.max(Math.round(this.spanMobile), 1), MOBILE_COLUMNS)
      this.style.setProperty('--lintje-span-mobile', String(columns))
    } else this.style.removeProperty('--lintje-span-mobile')
  }
}
