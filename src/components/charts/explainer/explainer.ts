/**
 * `<lintje-explainer>` — "Hoe deze cijfers worden berekend": a collapsible term/description list.
 *
 * Takes `ExplainerData`; starts open unless `defaultOpen` says otherwise. The header is the
 * shared disclosure of `lintje-expander`.
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { define, type FrameSettings } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { LintjeGridItemElement, spanStyles } from '../../../primitives/shared/grid-item-element'
import { iconStyles } from '../../../icons/render'
import {
  DisclosureSettle,
  disclosureBody,
  disclosureHeader,
  nextDisclosureId,
} from '../../shared/disclosure'
import disclosureCss from '../../shared/disclosure.css?inline'
import explainerCss from './explainer.css?inline'
import type { ExplainerData } from '../../../types'

export class LintjeExplainer extends LintjeGridItemElement {
  static override styles = [
    iconStyles,
    spanStyles,
    shadowCss(disclosureCss),
    shadowCss(explainerCss),
  ]

  static override properties: PropertyDeclarations = {
    data: { attribute: false },
    open: { state: true },
  }

  declare data?: ExplainerData | null
  span: number = 12

  open: boolean = true

  // A new `defaultOpen` re-opens or re-closes.
  #basis: boolean | undefined | null = null

  readonly #bodyId = nextDisclosureId()
  readonly #settle = new DisclosureSettle(this)

  protected override get dataSettings(): FrameSettings | undefined {
    return this.data ?? undefined
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    const basis = this.data?.defaultOpen
    if (basis === this.#basis) return
    this.#basis = basis
    this.open = basis ?? true
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    this.#settle.observe(
      this.open,
      this.renderRoot.querySelector<HTMLElement>('.lintje-disclosure__body'),
    )
  }

  protected override render(): TemplateResult | typeof nothing {
    const data = this.data
    if (!data) return nothing
    return html`<section
      class=${classMap({
        'lintje-disclosure': true,
        'lintje-explainer': true,
        'is-open': this.open,
        'is-settled': this.#settle.settled,
      })}
    >
      ${disclosureHeader({
        bodyId: this.#bodyId,
        open: this.open,
        title: data.title,
        toggle: () => {
          this.open = !this.open
        },
      })}
      ${disclosureBody(
        this.#bodyId,
        html`<dl class="lintje-explainer__list">
          ${data.items.map(
            (item) => html`<dt class="lintje-explainer__term">${item.term}</dt>
              <dd class="lintje-explainer__description">${item.description}</dd>`,
          )}
        </dl>`,
      )}
    </section>`
  }
}

define('lintje-explainer', LintjeExplainer)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-explainer': LintjeExplainer
  }
}
