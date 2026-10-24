/** What every element that can stand in a `<lintje-grid>` shares: `span` and `span.css`. */
import { type PropertyDeclarations, type PropertyValues } from 'lit'
import { LintjeElement } from '../../core/element'
import { shadowCss } from '../../core/styles'
import spanCss from './span.css?inline'

export const spanStyles = shadowCss(spanCss)

/** The phone's columns in the new house style. */
const MOBILE_COLUMNS = 4

/**
 * Where an item stands in `<lintje-grid>`: `span`, and on a phone `span-mobile`, `order-mobile`
 * and whether it shows (`hide-mobile`, `hide-desktop`), reflected, with `--lintje-span`,
 * `--lintje-span-mobile` and `--lintje-order-mobile` written inline for `span.css`.
 */
export class LintjeGridItemElement extends LintjeElement {
  static override properties: PropertyDeclarations = {
    span: { type: Number, reflect: true },
    spanMobile: { type: Number, attribute: 'span-mobile', reflect: true },
    orderMobile: { type: Number, attribute: 'order-mobile', reflect: true },
    hideMobile: { type: Boolean, attribute: 'hide-mobile', reflect: true },
    hideDesktop: { type: Boolean, attribute: 'hide-desktop', reflect: true },
  }

  /** Columns of the 12-column grid; default one. */
  declare span?: number
  /**
   * Columns of the phone's four in the new house style, below 768 px; default all four. The
   * earlier style has one column on a phone, so there it changes nothing.
   */
  declare spanMobile?: number
  /**
   * The place on a phone, below 768 px, in both house styles: items without it are 0, a higher
   * number stands lower (`1` after them, `-1` before). Only the drawing moves: the reading and
   * focus order stay that of the markup, so move a whole block (a map to the end), never one
   * field among others.
   */
  declare orderMobile?: number
  /**
   * Left out on a phone, below 768 px; a desktop reader zoomed to 400 % sees that view too. Only
   * for what the page also says another way, such as a map whose figures stand in a table.
   */
  hideMobile: boolean = false
  /** Left out from 768 px, and on paper; shown on a phone only. */
  hideDesktop: boolean = false

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (this.span) this.style.setProperty('--lintje-span', String(this.span))
    else this.style.removeProperty('--lintje-span')
    if (this.spanMobile) {
      const columns = Math.min(Math.max(Math.round(this.spanMobile), 1), MOBILE_COLUMNS)
      this.style.setProperty('--lintje-span-mobile', String(columns))
    } else this.style.removeProperty('--lintje-span-mobile')
    if (this.orderMobile)
      this.style.setProperty('--lintje-order-mobile', String(Math.round(this.orderMobile)))
    else this.style.removeProperty('--lintje-order-mobile')
  }
}
