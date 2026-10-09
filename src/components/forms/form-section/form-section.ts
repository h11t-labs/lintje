/**
 * `<lintje-form-section>` — a group of fields with a heading and an explanation: a `<fieldset>`
 * with its `<legend>`, which holds an `<h3>` so the heading is in the page's outline. Bare inside
 * a tile, or a tile itself (`variant="tile"`).
 *
 * `disabled` sets `disabled` on every slotted control itself and hands back what each had: a
 * `<fieldset disabled>` in a shadow root disables nothing slotted.
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { LintjeElement, define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { PropertyHold, disableableControls } from '../form/controls'
import formSectionCss from './form-section.css?inline'

export type FormSectionVariant = 'plain' | 'tile'

export class LintjeFormSection extends LintjeElement {
  static override styles = shadowCss(formSectionCss)

  static override properties: PropertyDeclarations = {
    heading: { type: String },
    description: { type: String },
    variant: { type: String, reflect: true },
    disabled: { type: Boolean, reflect: true },
  }

  /** The legend; as a tile, the tile title. */
  heading: string = ''
  declare description?: string
  variant: FormSectionVariant = 'plain'
  disabled: boolean = false

  readonly #disabled = new PropertyHold('disabled')

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    if (changed.has('disabled')) this.#hold()
  }

  override disconnectedCallback(): void {
    this.#disabled.release()
    super.disconnectedCallback()
  }

  #hold(): void {
    if (this.disabled) this.#disabled.apply(disableableControls(this), true)
    else this.#disabled.release()
  }

  protected override render(): TemplateResult {
    return html`<fieldset
      class=${classMap({
        'lintje-form-section': true,
        'lintje-form-section--tile': this.variant === 'tile',
      })}
      aria-describedby=${this.description ? 'lintje-form-section-description' : nothing}
      ?disabled=${this.disabled}
    >
      <legend class="lintje-form-section__legend">
        <h3 class="lintje-form-section__heading">${this.heading}</h3>
      </legend>
      <p
        id="lintje-form-section-description"
        class="lintje-form-section__description"
        ?hidden=${!this.description}
      >
        ${this.description ?? ''}
      </p>
      <div class="lintje-form-section__fields">
        <slot @slotchange=${() => this.disabled && this.#hold()}></slot>
      </div>
    </fieldset>`
  }
}

define('lintje-form-section', LintjeFormSection)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-form-section': LintjeFormSection
  }
}
