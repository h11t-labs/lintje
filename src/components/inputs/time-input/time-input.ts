/**
 * `<lintje-time-input>` — a time of day, `HH:MM` on a 24-hour clock, or `null` when empty, typed
 * or picked from a list. Typed text is read on leaving the field or Enter (`time-format.ts`).
 * The list holds the times from `min` to `max`, `step` minutes apart; a typed value between two
 * of them stays as typed, and the list opens on the first time at or after it without selecting
 * one. The element checks its own text and shows a message in place of the hint; a host's
 * `error` wins. It knows no day or time zone. Tab out of the element closes the list, so it does
 * not cover the next field.
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
import { standsIn } from '../../../core/focus'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import { LintjeInputElement } from '../shared/input'
import '../../../primitives/popover/popover'
import inputCss from '../shared/input.css?inline'
import timeInputCss from './time-input.css?inline'
import {
  addMinutes,
  clampTime,
  isTime,
  nowRounded,
  parseTime,
  timeAtOrAfter,
  timesBetween,
} from './time-format'

export class LintjeTimeInput extends LintjeInputElement {
  static override styles = [iconStyles, shadowCss(inputCss), shadowCss(timeInputCss)]

  static override properties: PropertyDeclarations = {
    value: { type: String },
    min: { type: String },
    max: { type: String },
    step: { type: Number },
    placeholder: { type: String },
    stacked: { type: Boolean, reflect: true },
    open: { type: Boolean, reflect: true },
    text: { state: true },
    problem: { state: true },
    focusTime: { state: true },
  }

  value: string | null = null
  /** The earliest time, `HH:MM`; the list starts here, else at 00:00. */
  declare min?: string
  /** The latest time, `HH:MM`; the list ends at the last time at or before it, else 23:59. */
  declare max?: string
  /** The minutes between the times in the list, and that PageUp and PageDown move in the field. */
  step: number = 15
  placeholder: string = ''
  stacked: boolean = false
  /** Whether the list is open. Reflected, so a sheet can leave Escape to it. */
  open: boolean = false

  override hint: string | undefined = 'uu:mm'

  protected text: string = ''
  protected problem: string = ''
  /** The time the keys stand on in the list. */
  protected focusTime: string = ''

  private get message(): string {
    return this.error || this.problem
  }

  protected override get footMessage(): string {
    return this.message
  }

  private get times(): string[] {
    return timesBetween(this.min, this.max, this.step)
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
    if (event.altKey && event.key === 'ArrowDown') {
      event.preventDefault()
      this.openList()
      return
    }
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

  /* --- The list ----------------------------------------------------------- */

  private openList(): void {
    if (this.disabled) return
    const times = this.times
    if (!times.length) return
    this.focusTime = timeAtOrAfter(times, this.value ?? nowRounded(this.step))
    this.open = true
    void this.focusOption('center')
  }

  private toggle(): void {
    if (this.open) this.open = false
    else this.openList()
  }

  /** On opening the time stands mid-list, so earlier and later are both in view. */
  private async focusOption(block: ScrollLogicalPosition = 'nearest'): Promise<void> {
    await this.updateComplete
    const option = this.renderRoot.querySelector<HTMLElement>(
      '.lintje-time-input__option[tabindex="0"]',
    )
    option?.focus({ preventScroll: true })
    option?.scrollIntoView?.({ block })
  }

  private onPopoverClose(event: CustomEvent<{ reason: string }>): void {
    event.stopPropagation()
    this.open = false
    if (event.detail?.reason === 'escape') {
      this.renderRoot.querySelector<HTMLElement>('.lintje-time-input__toggle')?.focus()
    }
  }

  // Only a focus that lands elsewhere closes. A press on the list that takes no focus (its
  // padding) blurs to nothing, or to a focusable box around the element.
  private onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null
    if (!this.open || !next || this.renderRoot.contains(next) || standsIn(this, next)) return
    this.open = false
  }

  private pick(time: string): void {
    this.choose(time)
    this.open = false
    this.renderRoot.querySelector<HTMLInputElement>('.lintje-time-input__control')?.focus()
  }

  private onListKeydown(event: KeyboardEvent): void {
    const times = this.times
    // PageUp and PageDown move an hour, whatever the step.
    const hour = Math.max(1, Math.round(60 / this.step))
    const moves: Record<string, number> = {
      ArrowDown: 1,
      ArrowUp: -1,
      PageDown: hour,
      PageUp: -hour,
      Home: -times.length,
      End: times.length,
    }
    const move = moves[event.key]
    if (move === undefined) return
    event.preventDefault()
    const index = times.indexOf(this.focusTime)
    const next = Math.min(times.length - 1, Math.max(0, index + move))
    this.focusTime = times[next]!
    void this.focusOption()
  }

  // The edge around the list stands outside the scroller, so it stays where a press lands on
  // nothing once the list has scrolled to the chosen time.
  private renderList(): TemplateResult {
    return html`<div class="lintje-time-input__panel"><div
      class="lintje-time-input__list"
      role="listbox"
      aria-label="Tijden"
      @keydown=${this.onListKeydown}
    >
      ${this.times.map(
        (time) => html`<button
          type="button"
          role="option"
          class=${classMap({ 'lintje-time-input__option': true, 'is-selected': time === this.value })}
          tabindex=${time === this.focusTime ? '0' : '-1'}
          aria-selected=${time === this.value ? 'true' : 'false'}
          @click=${() => this.pick(time)}
        >
          ${time}
        </button>`,
      )}
    </div></div>`
  }

  protected override render(): TemplateResult {
    const message = this.message
    return html`<div class="lintje-field" @focusout=${this.onFocusOut}>
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
        <button
          type="button"
          class="lintje-time-input__toggle"
          aria-label="Tijden openen"
          aria-haspopup="listbox"
          aria-expanded=${this.open ? 'true' : 'false'}
          ?disabled=${this.disabled}
          @click=${this.toggle}
        >
          ${renderIcon('functioneel-klok', { size: 18 })}
        </button>
      </div>
      <lintje-popover
        ?open=${this.open && !this.disabled}
        match-width
        @lintje-close=${this.onPopoverClose}
      >
        ${this.open ? this.renderList() : nothing}
      </lintje-popover>
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
