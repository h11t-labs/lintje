/**
 * `<lintje-number-input>` — a −/+ stepper around a centred value, or without the stepper a fixed
 * text before the value (`prefix`) and a unit after it.
 *
 * It commits on `change`; a press on − or + commits at once and says the new value, since the
 * focus stays on the step. At `min` or `max` the step stays focusable but does nothing. A typed
 * number outside them is refused with a message in place of the hint; a host's `error` wins.
 *
 * Events: `lintje-change` `number | null`, `lintje-values-change` `{ [name]: value }` (with a
 * `name`), `lintje-reset` (the reset link was pressed).
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { define } from '../../../core/element'
import { formatNumber } from '../../../core/format'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import { addonDescribedBy, renderAddon } from '../shared/addon'
import { LiveMessage } from '../../shared/live-message'
import { LintjeFormInputElement } from '../shared/input'
import inputCss from '../shared/input.css?inline'
import numberInputCss from './number-input.css?inline'

export class LintjeNumberInput extends LintjeFormInputElement {
  static override styles = [iconStyles, shadowCss(inputCss), shadowCss(numberInputCss)]

  static override properties: PropertyDeclarations = {
    value: { type: Number },
    min: { type: Number },
    max: { type: Number },
    step: { type: Number },
    prefix: { type: String },
    unit: { type: String },
    stepper: { type: Boolean },
    stacked: { type: Boolean, reflect: true },
    problem: { state: true },
  }

  /** `null` is an empty field; a host writes no parameter for it. */
  value: number | null = null
  declare min?: number
  declare max?: number
  step: number = 1
  /** The fixed text before the value, e.g. "€", which describes the field; only without the stepper. */
  override prefix: string | null = null
  /** The unit on the right, e.g. "min", which describes the field; only without the stepper. */
  declare unit?: string
  /** The −/+ buttons. Bind as `.stepper=${false}`, never `?stepper=`. */
  stepper: boolean = true
  stacked: boolean = false
  /** The element's own message about a typed number it refused. */
  protected problem: string = ''
  readonly #live = new LiveMessage(this)

  protected get formValue(): string {
    return this.value === null ? '' : String(this.value)
  }

  private get message(): string {
    return this.error || this.problem
  }

  protected override get footMessage(): string {
    return this.message
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (changed.has('value')) this.problem = ''
  }

  private outOfBounds(next: number): string {
    if (this.min !== undefined && next < this.min)
      return `Vul een getal in van ${decimal(this.min)} of meer`
    if (this.max !== undefined && next > this.max)
      return `Vul een getal in van ${decimal(this.max)} of minder`
    return ''
  }

  private get atMin(): boolean {
    return this.min !== undefined && this.value !== null && this.value <= this.min
  }

  private get atMax(): boolean {
    return this.max !== undefined && this.value !== null && this.value >= this.max
  }

  private nudge(by: number): void {
    if (this.readonly || this.isDisabled) return
    const from = this.value ?? this.min ?? 0
    let next = this.value === null ? from : from + by
    if (this.min !== undefined) next = Math.max(this.min, next)
    if (this.max !== undefined) next = Math.min(this.max, next)
    // Steps of .1 would otherwise commit 0.30000000000000004.
    next = Math.round(next * 1e6) / 1e6
    if (next === this.value) return
    this.value = next
    this.commit(next)
    this.#live.say(String(next))
  }

  /** `false` when it refused the typed number. */
  private change(event: Event): boolean {
    if (this.readonly) return false
    const raw = (event.target as HTMLInputElement).value
    const next = raw === '' ? null : Number(raw)
    this.problem = next === null ? '' : this.outOfBounds(next)
    if (this.problem) return false
    if (next === this.value) return true
    this.value = next
    this.commit(this.value)
    return true
  }

  private stepButton(direction: -1 | 1): TemplateResult {
    const down = direction === -1
    const limit = !this.isDisabled && (down ? this.atMin : this.atMax)
    return html`<button
      type="button"
      class=${classMap({
        'lintje-number-input__step': true,
        [`lintje-number-input__step--${down ? 'down' : 'up'}`]: true,
        'is-limit': limit,
      })}
      aria-label=${down ? 'Verlagen' : 'Verhogen'}
      ?disabled=${this.isDisabled}
      aria-disabled=${(this.readonly && !this.isDisabled) || limit ? 'true' : nothing}
      @click=${() => this.nudge(direction * this.step)}
    >
      ${renderIcon(down ? 'functioneel-minus' : 'functioneel-plus', { size: 16 })}
    </button>`
  }

  protected override render(): TemplateResult {
    const prefix = this.stepper ? undefined : this.prefix
    const unit = this.stepper ? undefined : this.unit
    const addon = { readonly: this.readonly, disabled: this.isDisabled }
    return html`<div class="lintje-field">
      ${this.renderLabel(this.controlId)}
      ${this.renderMessages()}
      <div
        class=${classMap({
          'lintje-number-input': true,
          'lintje-number-input--addon': Boolean(prefix || unit),
          'is-error': Boolean(this.message),
          'is-readonly': this.readonly,
          'is-disabled': this.isDisabled,
        })}
      >
        ${this.stepper ? this.stepButton(-1) : nothing}
        ${renderAddon('prefix', prefix, addon)}
        <input
          type="number"
          id=${this.controlId}
          class="lintje-number-input__control focus-inset"
          .value=${this.value === null ? '' : String(this.value)}
          min=${this.min ?? nothing}
          max=${this.max ?? nothing}
          step=${this.step}
          autocomplete=${this.autocomplete || nothing}
          aria-labelledby=${this.labelId}
          aria-describedby=${addonDescribedBy(Boolean(prefix), Boolean(unit), this.describedBy)}
          aria-invalid=${this.message ? 'true' : nothing}
          aria-required=${this.required ? 'true' : nothing}
          ?required=${this.required}
          ?readonly=${this.readonly}
          ?disabled=${this.isDisabled}
          @change=${this.change}
          @keydown=${(event: KeyboardEvent) => this.submitOnEnter(event, () => this.change(event))}
        />
        ${renderAddon('suffix', unit, addon)}
        ${this.stepper ? this.stepButton(1) : nothing}
      </div>
      ${this.renderFoot()}
      <span class="visually-hidden" role="status">${this.#live.text}</span>
    </div>`
  }
}

/** A bound as a reader writes it: a decimal comma, and as many decimals as it has. */
function decimal(value: number): string {
  return formatNumber(value, String(value).split('.')[1]?.length ?? 0)
}

define('lintje-number-input', LintjeNumberInput)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-number-input': LintjeNumberInput
  }
}
