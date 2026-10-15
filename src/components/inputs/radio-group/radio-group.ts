/**
 * `<lintje-radio-group>` — one option per line, for options that do not fit `lintje-segmented`.
 *
 * With `other` the last option is "Anders", value `other`, with a text field under it while it is
 * chosen; a click, a tap or Space puts the focus in it, an arrow key does not. The group checks
 * nothing: the host sets `error`, and `other-error` for an empty field. Cards draw no "Anders".
 *
 * Events: `lintje-change` `string`, `lintje-other-change` `string` (the field's text, on leaving
 * it or Enter), `lintje-values-change` `{ [name]: value, [name-other]: text | null }` (with a
 * `name`; the second key with `other`), `lintje-reset` (the reset link was pressed).
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { iconStyles } from '../../../icons/render'
import { OTHER_VALUE } from '../../shared/controls'
import { renderOtherField } from '../../shared/other'
import { LintjeChoiceGroupElement } from '../shared/input'
import '../text-input/text-input'
import inputCss from '../shared/input.css?inline'
import radioGroupCss from './radio-group.css?inline'
import type { FilterOption } from '../../../types'

export class LintjeRadioGroup extends LintjeChoiceGroupElement {
  static override styles = [iconStyles, shadowCss(inputCss), shadowCss(radioGroupCss)]

  static override properties: PropertyDeclarations = {
    value: { type: String },
    options: { attribute: false },
    variant: { type: String, reflect: true },
  }

  value: string = ''
  /** A `description` stands under its label, tied to its radio. */
  declare options?: FilterOption[]
  /** `cards`: the options side by side as cards, each with its description. */
  variant: 'lines' | 'cards' = 'lines'

  /** The last key was an arrow: the browser's arrows move the choice, and the focus stays. */
  #byArrow = false

  protected override get otherChosen(): boolean {
    return this.value === OTHER_VALUE
  }

  protected override get otherOption(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.lintje-radio-group__other input')
  }

  protected override get drawsOther(): boolean {
    if (!super.drawsOther) return false
    if (this.variant !== 'cards') return true
    this.warnOnce('cards', '"other" draws nothing with variant="cards"; use the plain rows.')
    return false
  }

  private choose(value: string): void {
    this.value = value
    this.commit(value)
    if (value === OTHER_VALUE && this.drawsOther && !this.#byArrow) void this.focusOther()
  }

  private renderOption(option: FilterOption, index: number, other = false): TemplateResult {
    const cards = this.variant === 'cards'
    const described = Boolean(option.description) && !cards
    const descriptionId = `lintje-radio-group-description-${index}`
    const row = html`<label
      class=${classMap({
        'lintje-choice': true,
        'lintje-radio-group__card': cards,
        'lintje-radio-group__other': other,
        'is-chosen': cards && option.value === this.value,
        'is-disabled': this.disabled,
      })}
    >
      <input
        type="radio"
        class="lintje-choice__input"
        name=${this.name || 'lintje-radio-group'}
        value=${option.value}
        .checked=${option.value === this.value}
        aria-describedby=${described ? descriptionId : nothing}
        ?disabled=${this.disabled}
        @change=${() => this.choose(option.value)}
      />
      <span class="lintje-choice__radio" aria-hidden="true"></span>
      <span class="lintje-choice__label"
        >${option.label}${
          cards && option.description
            ? html`<span class="lintje-radio-group__description">${option.description}</span>`
            : nothing
        }</span
      >
    </label>`
    if (!described) return row
    return html`<div class="lintje-radio-group__option">
      ${row}<span id=${descriptionId} class="lintje-field__hint">${option.description}</span>
    </div>`
  }

  protected override render(): TemplateResult {
    const other = this.drawsOther
    return html`<div
      class="lintje-field"
      role="radiogroup"
      aria-labelledby=${this.labelId}
      aria-describedby=${this.describedBy}
      aria-invalid=${this.error || (this.otherOpen && this.otherError) ? 'true' : nothing}
      aria-required=${this.required ? 'true' : nothing}
    >
      ${this.renderLabel()}
      <div
        class=${classMap({ 'lintje-radio-group': true, 'lintje-radio-group--cards': this.variant === 'cards' })}
        @keydown=${(event: KeyboardEvent) => (this.#byArrow = event.key.startsWith('Arrow'))}
        @pointerdown=${() => (this.#byArrow = false)}
      >
        ${(this.options ?? []).map((option, index) => this.renderOption(option, index))}
        ${other ? this.renderOption({ value: OTHER_VALUE, label: this.otherLabel }, -1, true) : nothing}
        ${
          this.otherOpen
            ? renderOtherField({
                label: this.otherLabel,
                text: this.otherText,
                placeholder: this.otherPlaceholder,
                error: this.otherError,
                disabled: this.disabled,
                className: 'lintje-choice__other',
                onCommit: (text) => this.commitOther(text),
              })
            : nothing
        }
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
