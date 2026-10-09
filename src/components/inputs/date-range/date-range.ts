/**
 * `<lintje-date-range>` — the date range picker: a field and a popover with a calendar, presets
 * and "Wissen"/"Toepassen". Dates cross as `dd-mm-yyyy`; a change carries `{from, to}`.
 *
 * `accessible-name` names the field inside, which `aria-label` on the host would not; the field's
 * name ends in the chosen range. The calendar is one tab stop, walked with the date input's keys.
 * Escape closes only the popover (`ownsEscape`); it and "Toepassen" give the focus back to the
 * field. Tab out of the element closes the popover. Events: `lintje-change`; with a `name` also
 * `lintje-values-change` (`shared/input.ts`).
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { define } from '../../../core/element'
import { holdsFocus, standsIn } from '../../../core/focus'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import { LintjeInputElement } from '../shared/input'
import { ownsEscape } from '../../shared/focus-trap'
import '../../../primitives/button/button'
import '../../../primitives/icon-button/icon-button'
import inputCss from '../shared/input.css?inline'
import {
  addDays as addIsoDays,
  addMonths,
  DAY_MOVES,
  dayLabel,
  monthLabel,
  startOfMonth,
  startOfWeek,
  todayIso,
} from '../date-input/date-format'
import pickerCss from './date-range.css?inline'

const WEEKDAY_LABELS = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo']

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function monday(date: Date): Date {
  return addDays(date, -((date.getDay() + 6) % 7))
}

/**
 * Each preset as its first and last day. "Afgelopen n dagen" runs back from today; the calendar
 * periods run past today while they last, and `presetRange` cuts them at the data's last day.
 */
export const PRESETS: readonly (readonly [string, (today: Date) => readonly [Date, Date]])[] = [
  ['Vandaag', (today) => [today, today]],
  ['Gisteren', (today) => [addDays(today, -1), addDays(today, -1)]],
  ['Afgelopen 7 dagen', (today) => [addDays(today, -6), today]],
  ['Afgelopen 30 dagen', (today) => [addDays(today, -29), today]],
  ['Deze week', (today) => [monday(today), addDays(monday(today), 6)]],
  ['Vorige week', (today) => [addDays(monday(today), -7), addDays(monday(today), -1)]],
  [
    'Deze maand',
    (today) => [
      new Date(today.getFullYear(), today.getMonth(), 1),
      new Date(today.getFullYear(), today.getMonth() + 1, 0),
    ],
  ],
  ['Kwartaal', (today) => [addDays(today, -89), today]],
]

/** The range a preset stands for; it ends at `maxDate` at the latest. */
export function presetRange(name: string, today: Date, maxDate?: Date): DateRange | null {
  const preset = PRESETS.find(([label]) => label === name)
  if (!preset) return null
  const [start, end] = preset[1](today)
  const last = maxDate && end > maxDate ? maxDate : end
  return { from: formatDate(start), to: formatDate(last < start ? start : last) }
}

export interface DateRange {
  from: string | null
  to: string | null
}

/** dd-mm-yyyy */
export function formatDate(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`
}

/** dd-mm-yyyy to yyyy-mm-dd. */
const iso = (value: string | null): string | null =>
  value ? value.split('-').reverse().join('-') : null

function parseDate(value: string | null): Date | null {
  if (!value) return null
  const [day, month, year] = value.split('-').map(Number)
  if (!day || !month || !year) return null
  return new Date(year, month - 1, day)
}

/** yyyy-mm-dd to a local `Date`, as the presets count. */
function dateOf(day: string): Date {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(year, month - 1, date)
}

/** What a day cell adds to its name: its part in the range. */
function rangePart(start: boolean, end: boolean, inside: boolean): string {
  if (start && end) return ', begin- en einddatum'
  if (start) return ', begindatum'
  if (end) return ', einddatum'
  return inside ? ', in periode' : ''
}

export class LintjeDateRange extends LintjeInputElement {
  static override styles = [iconStyles, shadowCss(pickerCss), shadowCss(inputCss)]

  static override properties: PropertyDeclarations = {
    accessibleName: { type: String, attribute: 'accessible-name' },
    stacked: { type: Boolean, reflect: true },
    open: { type: Boolean, reflect: true },
    range: { attribute: false },
    today: { attribute: false },
    maxDate: { attribute: false },
    draft: { state: true },
    month: { state: true },
    focusDay: { state: true },
  }

  accessibleName: string = ''
  stacked: boolean = false
  open: boolean = false
  range: DateRange = { from: null, to: null }

  /** A form gets the days as the URL does: ISO. */
  protected override get postedValue(): unknown {
    return { from: iso(this.range.from), to: iso(this.range.to) }
  }
  /** The day marked as today; defaults to the real one. */
  declare today?: Date
  /** Later days are grayed out. */
  declare maxDate?: Date

  draft: DateRange = { from: null, to: null }
  declare month?: Date
  /** The day cell that holds the grid's one tab stop, yyyy-mm-dd; `''` until a key or a click. */
  protected focusDay: string = ''

  private readonly onOutsideClick = (event: MouseEvent): void => {
    if (!this.open) return
    if (!event.composedPath().includes(this)) this.open = false
  }

  private readonly onEscape = (event: KeyboardEvent): void => {
    if (!this.open || event.key !== 'Escape' || !ownsEscape(this)) return
    event.stopPropagation()
    void this.close()
  }

  /** Closes the popover; the focus it held goes back to the field instead of to the page. */
  private async close(): Promise<void> {
    const popover = this.renderRoot.querySelector('.lintje-date-range-picker__popover')
    const had = popover !== null && holdsFocus(popover)
    this.open = false
    await this.updateComplete
    if (had) this.renderRoot.querySelector<HTMLElement>('.lintje-date-range-picker__field')?.focus()
  }

  // Only a focus that lands elsewhere closes. A press on the popover that takes no focus (its
  // padding, the month heading) blurs to nothing, or to a focusable box around the element, such
  // as the shell's main region: neither is elsewhere. A press outside closes in `onOutsideClick`.
  private onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null
    if (!this.open || !next || this.renderRoot.contains(next) || standsIn(this, next)) return
    this.open = false
  }

  override connectedCallback(): void {
    super.connectedCallback()
    document.addEventListener('mousedown', this.onOutsideClick)
    document.addEventListener('keydown', this.onEscape, true)
  }

  override disconnectedCallback(): void {
    document.removeEventListener('mousedown', this.onOutsideClick)
    document.removeEventListener('keydown', this.onEscape, true)
    super.disconnectedCallback()
  }

  private get day(): Date {
    return this.today ?? new Date()
  }

  private toggle(): void {
    this.open = !this.open
    if (this.open) {
      this.draft = { ...this.range }
      this.month = parseDate(this.range.from) ?? this.day
      this.focusDay = ''
    }
  }

  private select(date: Date): void {
    const from = parseDate(this.draft.from)
    const to = parseDate(this.draft.to)
    if (!from || (from && to)) this.draft = { from: formatDate(date), to: null }
    else if (date < from) this.draft = { from: formatDate(date), to: formatDate(from) }
    else this.draft = { from: this.draft.from, to: formatDate(date) }
  }

  private applyPreset(name: string): void {
    const range = presetRange(name, this.day, this.maxDate)
    if (!range) return
    this.draft = range
    this.month = parseDate(range.from) ?? this.day
    this.focusDay = ''
  }

  private pick(day: string, blocked: boolean): void {
    if (blocked) return
    this.focusDay = day
    this.select(dateOf(day))
  }

  /** Moves the tab stop; the month turns when the day is not in view, or on PageUp/PageDown. */
  private onGridKeydown(event: KeyboardEvent, focus: string, cells: string[]): void {
    const move = DAY_MOVES[event.key]
    if (!move) return
    event.preventDefault()
    const next = move(focus)
    this.focusDay = next
    if (event.key.startsWith('Page') || !cells.includes(next))
      this.month = dateOf(startOfMonth(next))
    void this.focusCell()
  }

  private shiftMonth(month: Date, count: number, focus: string): void {
    this.month = new Date(month.getFullYear(), month.getMonth() + count, 1)
    this.focusDay = addMonths(focus, count)
  }

  private async focusCell(): Promise<void> {
    await this.updateComplete
    this.renderRoot
      .querySelector<HTMLElement>('.lintje-date-range-picker__day[tabindex="0"]')
      ?.focus()
  }

  private apply(): void {
    // `lintje-change` speaks dd-mm-yyyy; `lintje-values-change` (the URL) ISO.
    this.announce({ ...this.draft }, { from: iso(this.draft.from), to: iso(this.draft.to) })
    void this.close()
  }

  protected override render(): TemplateResult {
    const today = todayIso(this.day)
    const month = this.month ?? parseDate(this.range.from) ?? this.day
    const shown = todayIso(month).slice(0, 7)
    const from = iso(this.draft.from)
    const to = iso(this.draft.to)
    const last = this.maxDate ? todayIso(this.maxDate) : null

    const first = startOfWeek(`${shown}-01`)
    const cells = Array.from({ length: 42 }, (_, index) => addIsoDays(first, index))
    const weeks = Array.from({ length: 6 }, (_, week) => cells.slice(week * 7, week * 7 + 7))
    const focus =
      [this.focusDay, from, today].find((day) => day && cells.includes(day)) ?? `${shown}-01`

    const fieldName = this.accessibleName || this.labelText
    const chosen = Boolean(this.range.from && this.range.to)
    const rangeLabel = chosen ? `${this.range.from} – ${this.range.to}` : 'dd-mm-jjjj – dd-mm-jjjj'
    const fromDate = parseDate(this.draft.from)
    const toDate = parseDate(this.draft.to)
    const days =
      fromDate && toDate ? Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1 : 0
    // "Wissen" empties the draft: over a chosen range that is a change to apply.
    const applicable = days > 0 || (chosen && !this.draft.from && !this.draft.to)

    return html`<div class="lintje-date-range-picker" @focusout=${this.onFocusOut}>
      ${this.label ? this.renderLabel() : nothing}
      <button
        type="button"
        aria-label=${fieldName ? `${fieldName}, ${chosen ? rangeLabel : 'geen periode gekozen'}` : nothing}
        class=${classMap({
          'lintje-date-range-picker__field': true,
          'is-filled': Boolean(this.range.from),
          'is-error': Boolean(this.error),
        })}
        aria-expanded=${this.open}
        aria-haspopup="dialog"
        aria-describedby=${this.describedBy}
        aria-invalid=${this.error ? 'true' : nothing}
        ?disabled=${this.disabled}
        @click=${this.toggle}
      >
        <span>${rangeLabel}</span>
        ${renderIcon('functioneel-kalender', { size: 16, className: 'lintje-date-range-picker__icon' })}
      </button>

      ${
        this.open
          ? html`<div
            class="lintje-date-range-picker__popover"
            role="dialog"
            aria-label=${fieldName || 'Periode'}
          >
            <div class="lintje-date-range-picker__month">
              <button
                type="button"
                class="lintje-date-range-picker__nav"
                aria-label="Vorige maand"
                @click=${() => this.shiftMonth(month, -1, focus)}
              >
                ${renderIcon('functioneel-delta-rechts', { size: 16, flip: 'horizontal' })}
              </button>
              <span aria-live="polite">${monthLabel(`${shown}-01`)}</span>
              <button
                type="button"
                class="lintje-date-range-picker__nav"
                aria-label="Volgende maand"
                @click=${() => this.shiftMonth(month, 1, focus)}
              >
                ${renderIcon('functioneel-delta-rechts', { size: 16 })}
              </button>
            </div>

            <div
              class="lintje-date-range-picker__grid"
              role="grid"
              aria-label=${monthLabel(`${shown}-01`)}
              @keydown=${(event: KeyboardEvent) => this.onGridKeydown(event, focus, cells)}
            >
              <div class="lintje-date-range-picker__row" role="row">
                ${WEEKDAY_LABELS.map(
                  (day) =>
                    html`<span class="lintje-date-range-picker__weekday" role="columnheader"
                      >${day}</span
                    >`,
                )}
              </div>
              ${weeks.map(
                (week) => html`<div class="lintje-date-range-picker__row" role="row">
                  ${week.map((day) => {
                    const blocked = last !== null && day > last
                    const isStart = day === from
                    const isEnd = day === to
                    const inRange = from !== null && to !== null && day > from && day < to
                    return html`<button
                      type="button"
                      role="gridcell"
                      tabindex=${day === focus ? '0' : '-1'}
                      aria-label=${dayLabel(day) + rangePart(isStart, isEnd, inRange)}
                      aria-selected=${isStart || isEnd || inRange ? 'true' : 'false'}
                      aria-current=${day === today ? 'date' : nothing}
                      aria-disabled=${blocked ? 'true' : nothing}
                      class=${classMap({
                        'lintje-date-range-picker__day': true,
                        'is-outside': !day.startsWith(shown),
                        'is-blocked': blocked,
                        'is-today': day === today,
                        'is-endpoint': isStart || isEnd,
                        'is-in-range': inRange,
                      })}
                      @click=${() => this.pick(day, blocked)}
                    >
                      ${Number(day.slice(8))}
                    </button>`
                  })}
                </div>`,
              )}
            </div>

            <div class="lintje-date-range-picker__presets">
              ${PRESETS.map(
                ([name]) => html`<button
                  type="button"
                  class="lintje-date-range-picker__preset"
                  @click=${() => this.applyPreset(name)}
                >
                  ${name}
                </button>`,
              )}
            </div>

            <div class="lintje-date-range-picker__footer">
              <span aria-live="polite"
                >${
                  days > 0
                    ? `${this.draft.from} – ${this.draft.to} · ${days} dagen`
                    : 'Kies een begin- en einddatum'
                }</span
              >
              <div class="lintje-date-range-picker__actions">
                <lintje-button
                  variant="tertiary"
                  size="compact"
                  @click=${() => {
                    this.draft = { from: null, to: null }
                  }}
                  >Wissen</lintje-button
                >
                <lintje-button
                  variant="primary"
                  size="compact"
                  ?disabled=${!applicable}
                  @click=${this.apply}
                  >Toepassen</lintje-button
                >
              </div>
            </div>
          </div>`
          : nothing
      }
      ${this.renderFoot()}
    </div>`
  }
}

define('lintje-date-range', LintjeDateRange)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-date-range': LintjeDateRange
  }
}
