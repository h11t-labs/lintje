/**
 * `<lintje-date-input>` — one day, typed or picked in a calendar popover.
 *
 * The field shows `dd-mm-jjjj`; what crosses is ISO, or `null` when empty. The element reads typed
 * text on leaving the field or Enter, checks it and shows a message in place of the hint; a host's
 * `error` wins. Enter then submits the form around it; refused text holds the form back until it
 * is fixed or erased. A calendar day knows no time zone. Tab out of the element closes the calendar.
 *
 * Events: `lintje-change` `string | null` (the ISO day), `lintje-values-change`
 * `{ [name]: value }` (with a `name`), `lintje-reset` (the reset link was pressed).
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
import '../../overlays/popover/popover'
import inputCss from '../shared/input.css?inline'
import monthGridCss from '../../shared/month-grid.css?inline'
import dateInputCss from './date-input.css?inline'
import {
  addDays,
  addMonths,
  clampDay,
  formatDate,
  isIso,
  monthLabel,
  parseDate,
  partsOf,
  todayIso,
} from '../../shared/date-format'
import { focusGridDay, renderMonthGrid } from '../../shared/month-grid'

export class LintjeDateInput extends LintjeInputElement {
  static override styles = [
    iconStyles,
    shadowCss(inputCss),
    shadowCss(monthGridCss),
    shadowCss(dateInputCss),
  ]

  static override properties: PropertyDeclarations = {
    // Set again, even to the same day, a value drops a refusal: a reset, or the host's answer.
    value: { type: String, hasChanged: () => true },
    min: { type: String },
    max: { type: String },
    today: { type: String },
    placeholder: { type: String },
    autocomplete: { type: String },
    readonly: { type: Boolean, reflect: true },
    stacked: { type: Boolean, reflect: true },
    open: { type: Boolean, reflect: true },
    text: { state: true },
    problem: { state: true },
    focusDay: { state: true },
  }

  /** The day, ISO (`2026-10-03`), or `null` for none. */
  value: string | null = null
  /** The first day that may be chosen, ISO. */
  declare min?: string
  /** The last day that may be chosen, ISO. */
  declare max?: string
  /** The day the calendar marks as today, ISO. Defaults to the real one. */
  declare today?: string
  placeholder: string = ''
  /**
   * What the day is, passed to the native field as is (`bday`), so the browser and assistive
   * software can fill it in; without it the field says `off`.
   */
  autocomplete: string = ''
  /** Shown, focusable and posted, but not to be changed: the calendar does not open. */
  readonly: boolean = false
  stacked: boolean = false
  /** Whether the calendar is open. Reflected, so a sheet can leave Escape to it. */
  open: boolean = false

  override hint: string | undefined = 'dd-mm-jjjj'

  protected text: string = ''
  protected problem: string = ''
  protected focusDay: string = ''

  private get todayDay(): string {
    return isIso(this.today) ? this.today : todayIso()
  }

  private get message(): string {
    return this.error || this.problem
  }

  override get refusal(): string {
    return this.problem
  }

  protected override get footMessage(): string {
    return this.message
  }

  // A read-only field cannot be filled, so it never holds the form back, as natively.
  protected override get missing(): boolean {
    return super.missing && !this.readonly
  }

  protected override announce(value: unknown, url: unknown = value): void {
    if (this.readonly) return
    super.announce(value, url)
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (changed.has('value')) {
      this.text = formatDate(this.value)
      this.problem = ''
    }
  }

  private outOfBounds(day: string): string {
    if (isIso(this.min) && day < this.min) return `Kies een datum op of na ${formatDate(this.min)}`
    if (isIso(this.max) && day > this.max)
      return `Kies een datum op of voor ${formatDate(this.max)}`
    return ''
  }

  private choose(day: string | null): void {
    this.problem = ''
    this.text = formatDate(day)
    if (day === this.value) return
    this.value = day
    this.commit(day)
  }

  private read(text: string): void {
    const parsed = parseDate(text, partsOf(this.todayDay)![0])
    if (parsed.kind === 'empty') return this.choose(null)
    this.text = text
    if (parsed.kind === 'invalid') {
      this.problem =
        parsed.reason === 'day' ? 'Deze datum bestaat niet' : 'Vul een datum in als dd-mm-jjjj'
      return
    }
    const bound = this.outOfBounds(parsed.iso)
    if (bound) this.problem = bound
    else this.choose(parsed.iso)
  }

  private onChange(event: Event): void {
    if (this.readonly) return
    this.read((event.target as HTMLInputElement).value)
  }

  private onFieldKeydown(event: KeyboardEvent): void {
    if (this.readonly) return
    this.submitOnEnter(event, () => {
      this.read((event.target as HTMLInputElement).value)
      return !this.problem
    })
    if (event.altKey && event.key === 'ArrowDown') {
      event.preventDefault()
      this.openCalendar()
      return
    }
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    event.preventDefault()
    const typed = parseDate((event.target as HTMLInputElement).value)
    const base = typed.kind === 'ok' ? typed.iso : this.value
    const step = event.key === 'ArrowUp' ? 1 : -1
    // From an empty field the first arrow picks today.
    this.choose(clampDay(base ? addDays(base, step) : this.todayDay, this.min, this.max))
  }

  private openCalendar(): void {
    if (this.isDisabled || this.readonly) return
    this.focusDay = clampDay(this.value ?? this.todayDay, this.min, this.max)
    this.open = true
    void this.focusCell()
  }

  private toggle(): void {
    if (this.open) this.open = false
    else this.openCalendar()
  }

  private async focusCell(): Promise<void> {
    await this.updateComplete
    focusGridDay(this.renderRoot)
  }

  private onPopoverClose(event: CustomEvent<{ reason: string }>): void {
    event.stopPropagation()
    this.open = false
    if (event.detail?.reason === 'escape') {
      this.renderRoot.querySelector<HTMLElement>('.lintje-date-input__toggle')?.focus()
    }
  }

  // Only a focus that lands elsewhere closes. A press on the calendar that takes no focus (its
  // padding, the month heading) blurs to nothing, or to a focusable box around the element.
  private onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null
    if (!this.open || !next || this.renderRoot.contains(next) || standsIn(this, next)) return
    this.open = false
  }

  private pick(day: string): void {
    if (this.outOfBounds(day)) return
    this.choose(day)
    this.open = false
    this.renderRoot.querySelector<HTMLInputElement>('.lintje-date-input__control')?.focus()
  }

  private moveTo(day: string): void {
    this.focusDay = day
    void this.focusCell()
  }

  private shiftMonth(count: number): void {
    this.focusDay = addMonths(this.focusDay, count)
  }

  private renderCalendar(): TemplateResult {
    const focus = this.focusDay || this.todayDay
    return html`<div class="lintje-date-input__calendar">
      <div class="lintje-date-input__month">
        <button
          type="button"
          class="lintje-date-input__nav"
          aria-label="Vorige maand"
          @click=${() => this.shiftMonth(-1)}
        >
          ${renderIcon('functioneel-delta-rechts', { size: 16, flip: 'horizontal' })}
        </button>
        <strong class="lintje-date-input__month-label" aria-live="polite"
          >${monthLabel(focus)}</strong
        >
        <button
          type="button"
          class="lintje-date-input__nav"
          aria-label="Volgende maand"
          @click=${() => this.shiftMonth(1)}
        >
          ${renderIcon('functioneel-delta-rechts', { size: 16 })}
        </button>
      </div>
      ${renderMonthGrid({
        focus,
        today: this.todayDay,
        day: (day) => ({ selected: day === this.value, blocked: Boolean(this.outOfBounds(day)) }),
        onPick: (day) => this.pick(day),
        onMove: (day) => this.moveTo(day),
      })}
    </div>`
  }

  protected override render(): TemplateResult {
    const message = this.message
    return html`<div class="lintje-field" @focusout=${this.onFocusOut}>
      ${this.renderLabel(this.controlId)}
      ${this.renderMessages()}
      <div class="lintje-date-input">
        <input
          type="text"
          id=${this.controlId}
          inputmode="numeric"
          autocomplete=${this.autocomplete || 'off'}
          class=${classMap({
            'lintje-date-input__control': true,
            'lintje-field__box': true,
            'lintje-field__control': true,
            'is-error': Boolean(message),
            'is-readonly': this.readonly,
          })}
          .value=${live(this.text)}
          placeholder=${this.placeholder || nothing}
          aria-labelledby=${this.labelId}
          aria-describedby=${this.describedBy}
          aria-invalid=${message ? 'true' : nothing}
          aria-required=${this.required ? 'true' : nothing}
          ?readonly=${this.readonly}
          ?disabled=${this.isDisabled}
          @change=${this.onChange}
          @keydown=${this.onFieldKeydown}
        />
        <button
          type="button"
          class="lintje-date-input__toggle lintje-field__toggle"
          aria-label="Kalender openen"
          aria-haspopup="dialog"
          aria-expanded=${this.open ? 'true' : 'false'}
          ?disabled=${this.isDisabled || this.readonly}
          @click=${this.toggle}
        >
          ${renderIcon('functioneel-kalender', { size: 18 })}
        </button>
      </div>
      <lintje-popover
        ?open=${this.open && !this.isDisabled && !this.readonly}
        panel-role="dialog"
        label="Kalender"
        @lintje-close=${this.onPopoverClose}
      >
        ${this.open ? this.renderCalendar() : nothing}
      </lintje-popover>
      ${this.renderFoot()}
    </div>`
  }
}

define('lintje-date-input', LintjeDateInput)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-date-input': LintjeDateInput
  }
}
