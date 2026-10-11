/**
 * `<lintje-expander>` — a title you press; what is slotted under it shows or hides.
 *
 * Closed, the content stays in the DOM, out of the tab order and the accessibility tree. What is
 * slotted in `actions` stands beside the title, outside its button: a few icon buttons about the
 * content.
 *
 * Events: `lintje-toggle` `boolean` (open, after the reader pressed the title).
 */
import { html, type PropertyDeclarations, type PropertyValues, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { define } from '../../../core/element'
import { LintjeGridItemElement } from '../../../primitives/shared/grid-item-element'
import { shadowCss } from '../../../core/styles'
import { iconStyles } from '../../../icons/render'
import {
  DisclosureSettle,
  disclosureBody,
  disclosureHeader,
  nextDisclosureId,
} from '../../shared/disclosure'
import disclosureCss from '../../shared/disclosure.css?inline'

export class LintjeExpander extends LintjeGridItemElement {
  static override styles = [iconStyles, shadowCss(disclosureCss)]

  static override properties: PropertyDeclarations = {
    heading: { type: String },
    subtitle: { type: String },
    icon: { type: String },
    open: { type: Boolean, reflect: true },
    flat: { type: Boolean, reflect: true },
    leading: { type: Boolean, reflect: true },
    columns: { type: Boolean, reflect: true },
  }

  heading: string = ''
  declare subtitle?: string
  /** An icon file name. Decorative. */
  declare icon?: string
  open: boolean = false
  /** No surface of its own: an expander inside a tile is not a second card. */
  flat: boolean = false
  /** The chevron before the title, the content under the title's text: expanders read as rows. */
  leading: boolean = false
  /**
   * The title in a column of its own (`--lintje-expander-label`), the content beside it, as rows
   * of text beside their speaker; a narrow expander stacks them again.
   */
  columns: boolean = false

  readonly #bodyId = nextDisclosureId()
  readonly #settle = new DisclosureSettle(this)

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    this.#settle.observe(
      this.open,
      this.renderRoot.querySelector<HTMLElement>('.lintje-disclosure__body'),
    )
  }

  protected override render(): TemplateResult {
    return html`<section
      class=${classMap({
        'lintje-disclosure': true,
        'lintje-expander': true,
        'lintje-expander--flat': this.flat,
        'lintje-disclosure--leading': this.leading || this.columns,
        'lintje-expander--columns': this.columns,
        'is-open': this.open,
        'is-settled': this.#settle.settled,
      })}
    >
      <div class="lintje-expander__top">
        ${disclosureHeader({
          bodyId: this.#bodyId,
          open: this.open,
          title: this.heading,
          subtitle: this.subtitle,
          icon: this.icon,
          leading: this.leading || this.columns,
          toggle: () => {
            this.open = !this.open
            this.emit('lintje-toggle', this.open)
          },
        })}<slot name="actions" class="lintje-expander__actions"></slot>
      </div>
      ${disclosureBody(this.#bodyId, html`<slot></slot>`, 'lintje-expander__content')}
    </section>`
  }
}

define('lintje-expander', LintjeExpander)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-expander': LintjeExpander
  }
}
