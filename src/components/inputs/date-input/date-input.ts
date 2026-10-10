/**
 * `<lintje-date-input>` — one day, typed or picked in a calendar popover.
 *
 * The field shows `dd-mm-jjjj`; what crosses is ISO, or `null` when empty. Typed text is read on
 * leaving the field or Enter (`date-format.ts`). The element checks its own text and shows a
 * message in place of the hint; a host's `error` wins. A calendar day is no time zone. Tab out of
 * the element closes the calendar, so it does not cover the next field.
 *
 * Events: `lintje-change` with the ISO day or `null`; with a `name` also `lintje-values-change`.
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
import dateInputCss from './date-input.css?inline'
import {
  addDays,
  addMonths,
  clampDay,
  DAY_MOVES,
  dayLabel,
  formatDate,
  isIso,
  monthLabel,
  monthWeeks,
  parseDate,
  partsOf,
  startOfMonth,
  todayIso,
  WEEKDAYS,
} from './date-format'

export class LintjeDateInput extends LintjeInputElement {
  static override styles = [iconStyles, shadowCss(inputCss), shadowCss(dateInputCss)]

  static override properties: PropertyDeclarations = {
    value: { type: String },
    min: { type: String },
    max: { type: String },
    today: { type: String },
    placeholder: { type: String },
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

  protected override get footMessage(): string {
    return this.message
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
    this.read((event.target as HTMLInputElement).value)
  }

  private onFieldKeydown(event: KeyboardEvent): void {
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
    if (this.disabled) return
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
    this.renderRoot.querySelector<HTMLElement>('.lintje-date-input__day[tabindex="0"]')?.focus()
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

  private onGridKeydown(event: KeyboardEvent): void {
    const move = DAY_MOVES[event.key]
    if (!move) return
    event.preventDefault()
    this.focusDay = move(this.focusDay)
    void this.focusCell()
  }

  private shiftMonth(count: number): void {
    this.focusDay = addMonths(this.focusDay, count)
  }

  private renderCalendar(): TemplateResult {
    const focus = this.focusDay || this.todayDay
    const month = startOfMonth(focus).slice(0, 7)
    const today = this.todayDay
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
      <div
        class="lintje-date-input__grid"
        role="grid"
        aria-label=${monthLabel(focus)}
        @keydown=${this.onGridKeydown}
      >
        <div class="lintje-date-input__row" role="row">
          ${WEEKDAYS.map(
            (name) =>
              html`<span class="lintje-date-input__weekday" role="columnheader">${name}</span>`,
          )}
        </div>
        ${monthWeeks(focus).map(
          (week) => html`<div class="lintje-date-input__row" role="row">
            ${week.map((day) => {
              // The weeks around the month stay empty: arrows that leave the month turn it.
              if (!day.startsWith(month)) {
                return html`<span class="lintje-date-input__blank" role="gridcell"></span>`
              }
              const blocked = Boolean(this.outOfBounds(day))
              return html`<button
                type="button"
                role="gridcell"
                class=${classMap({
                  'lintje-date-input__day': true,
                  'is-blocked': blocked,
                  'is-today': day === today,
                  'is-selected': day === this.value,
                })}
                tabindex=${day === focus ? '0' : '-1'}
                aria-label=${dayLabel(day)}
                aria-selected=${day === this.value ? 'true' : 'false'}
                aria-current=${day === today ? 'date' : nothing}
                aria-disabled=${blocked ? 'true' : nothing}
                @click=${() => this.pick(day)}
              >
                ${Number(day.slice(8))}
              </button>`
            })}
          </div>`,
        )}
      </div>
    </div>`
  }

  protected override render(): TemplateResult {
    const message = this.message
    return html`<div class="lintje-field" @focusout=${this.onFocusOut}>
      ${this.renderLabel(this.controlId)}
      <div class="lintje-date-input">
        <input
          type="text"
          id=${this.controlId}
          inputmode="numeric"
          autocomplete="off"
          class=${classMap({ 'lintje-date-input__control': true, 'is-error': Boolean(message) })}
          .value=${live(this.text)}
          placeholder=${this.placeholder || nothing}
          aria-labelledby=${this.labelId}
          aria-describedby=${this.describedBy}
          aria-invalid=${message ? 'true' : nothing}
          aria-required=${this.required ? 'true' : nothing}
          ?disabled=${this.disabled}
          @change=${this.onChange}
          @keydown=${this.onFieldKeydown}
        />
        <button
          type="button"
          class="lintje-date-input__toggle"
          aria-label="Kalender openen"
          aria-haspopup="dialog"
          aria-expanded=${this.open ? 'true' : 'false'}
          ?disabled=${this.disabled}
          @click=${this.toggle}
        >
          ${renderIcon('functioneel-kalender', { size: 18 })}
        </button>
      </div>
      <lintje-popover
        ?open=${this.open && !this.disabled}
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
