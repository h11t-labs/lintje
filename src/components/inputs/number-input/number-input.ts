/**
 * `<lintje-number-input>` — a −/+ stepper around a centred value, or a unit on the right
 * without the stepper. Commits on `change`; a press on − or + commits at once.
 *
 * `stepper` defaults to `true`, so it can only be turned off as a property: `?stepper=${false}`
 * removes an attribute that was never there. A shown unit describes the field. At `min` or `max`
 * the step is `aria-disabled`, not disabled, so the focus on it stays. Events: `lintje-change`,
 * and `lintje-values-change` with a `name`.
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import { LintjeFormInputElement } from '../shared/input'
import inputCss from '../shared/input.css?inline'
import numberInputCss from './number-input.css?inline'

const UNIT_ID = 'lintje-number-input-unit'

export class LintjeNumberInput extends LintjeFormInputElement {
  static override styles = [iconStyles, shadowCss(inputCss), shadowCss(numberInputCss)]

  static override properties: PropertyDeclarations = {
    value: { type: Number },
    min: { type: Number },
    max: { type: Number },
    step: { type: Number },
    unit: { type: String },
    stepper: { type: Boolean },
    stacked: { type: Boolean, reflect: true },
  }

  /** `null` is an empty field; a host writes no parameter for it. */
  value: number | null = null
  declare min?: number
  declare max?: number
  step: number = 1
  /** The unit on the right, e.g. "min"; shown only without the stepper. */
  declare unit?: string
  /** The −/+ buttons. Bind as `.stepper=${false}`, never `?stepper=`. */
  stepper: boolean = true
  stacked: boolean = false

  protected get formValue(): string {
    return this.value === null ? '' : String(this.value)
  }

  private get atMin(): boolean {
    return this.min !== undefined && this.value !== null && this.value <= this.min
  }

  private get atMax(): boolean {
    return this.max !== undefined && this.value !== null && this.value >= this.max
  }

  private nudge(by: number): void {
    if (this.readonly || this.disabled) return
    const from = this.value ?? this.min ?? 0
    let next = this.value === null ? from : from + by
    if (this.min !== undefined) next = Math.max(this.min, next)
    if (this.max !== undefined) next = Math.min(this.max, next)
    // Steps of .1 would otherwise commit 0.30000000000000004.
    next = Math.round(next * 1e6) / 1e6
    if (next === this.value) return
    this.value = next
    this.commit(next)
  }

  private change(event: Event): void {
    if (this.readonly) return
    const raw = (event.target as HTMLInputElement).value
    const next = raw === '' ? null : Number(raw)
    if (next === this.value) return
    this.value = next
    this.commit(this.value)
  }

  private stepButton(direction: -1 | 1): TemplateResult {
    const down = direction === -1
    const limit = !this.disabled && (down ? this.atMin : this.atMax)
    return html`<button
      type="button"
      class=${classMap({
        'lintje-number-input__step': true,
        [`lintje-number-input__step--${down ? 'down' : 'up'}`]: true,
        'is-limit': limit,
      })}
      aria-label=${down ? 'Verlagen' : 'Verhogen'}
      ?disabled=${this.disabled}
      aria-disabled=${(this.readonly && !this.disabled) || limit ? 'true' : nothing}
      @click=${() => this.nudge(direction * this.step)}
    >
      ${renderIcon(down ? 'functioneel-minus' : 'functioneel-plus', { size: 16 })}
    </button>`
  }

  protected override render(): TemplateResult {
    const unit = Boolean(this.unit) && !this.stepper
    const described = [unit ? UNIT_ID : '', this.describedBy === nothing ? '' : this.describedBy]
      .filter(Boolean)
      .join(' ')
    return html`<div class="lintje-field">
      ${this.renderLabel(this.controlId)}
      <div
        class=${classMap({
          'lintje-number-input': true,
          'lintje-number-input--unit': unit,
          'is-error': Boolean(this.error),
          'is-readonly': this.readonly,
          'is-disabled': this.disabled,
        })}
      >
        ${this.stepper ? this.stepButton(-1) : nothing}
        <input
          type="number"
          id=${this.controlId}
          class="lintje-number-input__control focus-inset"
          .value=${this.value === null ? '' : String(this.value)}
          min=${this.min ?? nothing}
          max=${this.max ?? nothing}
          step=${this.step}
          aria-labelledby=${this.labelId}
          aria-describedby=${described || nothing}
          aria-invalid=${this.error ? 'true' : nothing}
          aria-required=${this.required ? 'true' : nothing}
          ?required=${this.required}
          ?readonly=${this.readonly}
          ?disabled=${this.disabled}
          @change=${this.change}
          @keydown=${(event: KeyboardEvent) => this.submitOnEnter(event, () => this.change(event))}
        />
        ${
          unit
            ? html`<span id=${UNIT_ID} class="lintje-number-input__unit">${this.unit}</span>`
            : nothing
        }
        ${this.stepper ? this.stepButton(1) : nothing}
      </div>
      ${this.renderFoot()}
    </div>`
  }
}

define('lintje-number-input', LintjeNumberInput)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-number-input': LintjeNumberInput
  }
}
