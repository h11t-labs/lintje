/**
 * `<lintje-time-input>` — a time of day, `HH:MM` on a 24-hour clock, or `null` when empty.
 * Typed text is read on leaving the field or Enter (`time-format.ts`). It checks its own text
 * and shows a message in place of the hint; a host's `error` wins. It knows no day or time zone.
 *
 * Events: `lintje-change` with `HH:MM` or `null`; with a `name` also `lintje-values-change`.
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { live } from 'lit/directives/live.js'
import { define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import { LintjeInputElement } from '../shared/input'
import inputCss from '../shared/input.css?inline'
import timeInputCss from './time-input.css?inline'
import { addMinutes, clampTime, isTime, nowRounded, parseTime } from './time-format'

export class LintjeTimeInput extends LintjeInputElement {
  static override styles = [iconStyles, shadowCss(inputCss), shadowCss(timeInputCss)]

  static override properties: PropertyDeclarations = {
    value: { type: String },
    min: { type: String },
    max: { type: String },
    step: { type: Number },
    placeholder: { type: String },
    stacked: { type: Boolean, reflect: true },
    text: { state: true },
    problem: { state: true },
  }

  value: string | null = null
  /** The earliest time, `HH:MM`. */
  declare min?: string
  /** The latest time, `HH:MM`. */
  declare max?: string
  /** The minutes PageUp and PageDown move. */
  step: number = 15
  placeholder: string = ''
  stacked: boolean = false

  override hint: string | undefined = 'uu:mm'

  protected text: string = ''
  protected problem: string = ''

  private get message(): string {
    return this.error || this.problem
  }

  protected override get footMessage(): string {
    return this.message
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (changed.has('value')) {
      this.text = isTime(this.value) ? this.value : ''
      this.problem = ''
    }
  }

  private outOfBounds(time: string): string {
    if (isTime(this.min) && time < this.min) return `Kies een tijd op of na ${this.min}`
    if (isTime(this.max) && time > this.max) return `Kies een tijd op of voor ${this.max}`
    return ''
  }

  private choose(time: string | null): void {
    this.problem = ''
    this.text = time ?? ''
    if (time === this.value) return
    this.value = time
    this.commit(time)
  }

  private onChange(event: Event): void {
    const text = (event.target as HTMLInputElement).value
    const parsed = parseTime(text)
    if (parsed.kind === 'empty') return this.choose(null)
    this.text = text
    if (parsed.kind === 'invalid') {
      this.problem = 'Vul een tijd in als uu:mm'
      return
    }
    const bound = this.outOfBounds(parsed.time)
    if (bound) this.problem = bound
    else this.choose(parsed.time)
  }

  private onKeydown(event: KeyboardEvent): void {
    const steps: Record<string, number> = {
      ArrowUp: 1,
      ArrowDown: -1,
      PageUp: this.step,
      PageDown: -this.step,
    }
    const count = steps[event.key]
    if (count === undefined) return
    event.preventDefault()
    const typed = parseTime((event.target as HTMLInputElement).value)
    const base = typed.kind === 'ok' ? typed.time : this.value
    // From an empty field the first key picks the time it is now, rounded to `step`.
    const next = base === null ? nowRounded(this.step) : addMinutes(base, count)
    this.choose(clampTime(next, this.min, this.max))
  }

  protected override render(): TemplateResult {
    const message = this.message
    return html`<div class="lintje-field">
      ${this.renderLabel(this.controlId)}
      <div class="lintje-time-input">
        <input
          type="text"
          id=${this.controlId}
          inputmode="numeric"
          autocomplete="off"
          class=${classMap({ 'lintje-time-input__control': true, 'is-error': Boolean(message) })}
          .value=${live(this.text)}
          placeholder=${this.placeholder || nothing}
          aria-labelledby=${this.labelId}
          aria-describedby=${this.describedBy}
          aria-invalid=${message ? 'true' : nothing}
          aria-required=${this.required ? 'true' : nothing}
          ?disabled=${this.disabled}
          @change=${this.onChange}
          @keydown=${this.onKeydown}
        />
        ${renderIcon('functioneel-klok', { size: 18, className: 'lintje-time-input__icon' })}
      </div>
      ${this.renderFoot()}
    </div>`
  }
}

define('lintje-time-input', LintjeTimeInput)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-time-input': LintjeTimeInput
  }
}
