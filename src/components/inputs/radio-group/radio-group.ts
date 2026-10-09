/**
 * `<lintje-radio-group>` — one option per line, for options that do not fit `lintje-segmented`.
 * Options are `FilterOption[]`. Arrow keys are the browser's: the inputs share one `name` inside
 * this shadow root, so two groups never collide. `variant="cards"` draws each option as a card in
 * a grid, its `description` under the label, the chosen one quiet as in `lintje-segmented`.
 *
 * Events: `lintje-change`; with a `name` also `lintje-values-change` (`shared/input.ts`).
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { iconStyles } from '../../../icons/render'
import { LintjeInputElement } from '../shared/input'
import inputCss from '../shared/input.css?inline'
import radioGroupCss from './radio-group.css?inline'
import type { FilterOption } from '../../../types'

export class LintjeRadioGroup extends LintjeInputElement {
  static override styles = [iconStyles, shadowCss(inputCss), shadowCss(radioGroupCss)]

  static override properties: PropertyDeclarations = {
    value: { type: String },
    options: { attribute: false },
    variant: { type: String, reflect: true },
  }

  value: string = ''
  declare options?: FilterOption[]
  /** `cards`: the options side by side as cards, each with its description. */
  variant: 'lines' | 'cards' = 'lines'

  private choose(value: string): void {
    this.value = value
    this.commit(value)
  }

  protected override render(): TemplateResult {
    return html`<div
      class="lintje-field"
      role="radiogroup"
      aria-labelledby=${this.labelId}
      aria-describedby=${this.describedBy}
      aria-invalid=${this.error ? 'true' : nothing}
      aria-required=${this.required ? 'true' : nothing}
    >
      ${this.renderLabel()}
      <div class=${classMap({ 'lintje-radio-group': true, 'lintje-radio-group--cards': this.variant === 'cards' })}>
        ${(this.options ?? []).map(
          (option) => html`<label
            class=${classMap({
              'lintje-choice': true,
              'lintje-radio-group__card': this.variant === 'cards',
              'is-chosen': this.variant === 'cards' && option.value === this.value,
              'is-disabled': this.disabled,
            })}
          >
            <input
              type="radio"
              class="lintje-choice__input"
              name=${this.name || 'lintje-radio-group'}
              value=${option.value}
              .checked=${option.value === this.value}
              ?disabled=${this.disabled}
              @change=${() => this.choose(option.value)}
            />
            <span class="lintje-choice__radio" aria-hidden="true"></span>
            <span class="lintje-choice__label"
              >${option.label}${
                this.variant === 'cards' && option.description
                  ? html`<span class="lintje-radio-group__description">${option.description}</span>`
                  : nothing
              }</span
            >
          </label>`,
        )}
      </div>
      ${this.renderFoot()}
    </div>`
  }
}

define('lintje-radio-group', LintjeRadioGroup)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-radio-group': LintjeRadioGroup
  }
}
