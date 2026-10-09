/**
 * `<lintje-spinner>` — the loading ring for content whose shape is not known; for a known shape
 * use `<lintje-skeleton>`. The label is what a screen reader hears (`role="status"`).
 * Events: none.
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { LintjeElement, define } from '../../core/element'
import { shadowCss } from '../../core/styles'
import spinnerCss from './spinner.css?inline'

export type SpinnerSize = 16 | 24 | 40

export class LintjeSpinner extends LintjeElement {
  static override styles = shadowCss(spinnerCss)

  static override properties: PropertyDeclarations = {
    size: { type: Number, reflect: true },
    label: { type: String },
    stacked: { type: Boolean, reflect: true },
    current: { type: Boolean, reflect: true },
    filled: { state: true },
  }

  size: SpinnerSize = 16
  /** What is loading, in Dutch. Without it the ring says nothing. */
  declare label?: string
  stacked: boolean = false
  /** Draws in `currentColor`, for a ring on a fill. */
  current: boolean = false
  /** The label in the status region, a frame after the region: one inserted together with its
   * words is not announced. */
  protected filled: string | null = null

  #fillFrame = 0

  override connectedCallback(): void {
    super.connectedCallback()
    if (this.label && this.filled !== this.label) this.requestUpdate()
  }

  override disconnectedCallback(): void {
    if (this.#fillFrame) cancelAnimationFrame(this.#fillFrame)
    this.#fillFrame = 0
    super.disconnectedCallback()
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    if (!this.label || this.filled === this.label || this.#fillFrame) return
    this.#fillFrame = requestAnimationFrame(() => {
      this.#fillFrame = 0
      this.filled = this.label ?? null
    })
  }

  protected override render(): TemplateResult {
    return html`<span
      class=${classMap({
        'lintje-spinner': true,
        [`lintje-spinner--${this.size}`]: true,
        'lintje-spinner--stacked': this.stacked,
        'lintje-spinner--current': this.current,
      })}
      role=${this.label ? 'status' : nothing}
    >
      <span class="lintje-spinner__ring" aria-hidden="true"></span>
      ${
        this.label
          ? html`<span class="lintje-spinner__label"
              >${this.filled === this.label ? this.label : nothing}</span
            >`
          : nothing
      }
    </span>`
  }
}

define('lintje-spinner', LintjeSpinner)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-spinner': LintjeSpinner
  }
}
