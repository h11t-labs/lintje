/**
 * `<lintje-date-range>` — the date range picker: a field and a popover with a calendar, presets
 * and "Wissen"/"Toepassen".
 *
 * The popover is fixed to the viewport, so a scrolling filter bar or tile around it does not cut it
 * off. Escape closes only the popover; it and "Toepassen" give the focus back to the field. Tab out
 * of the element closes the popover.
 *
 * Events: `lintje-change` `{ from, to }`, `lintje-values-change` `{ [name]: value }` (with a
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
import { holdsFocus, standsIn } from '../../../core/focus'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import { LintjeInputElement } from '../shared/input'
import { ownsEscape } from '../../shared/focus-trap'
import { place, samePlace, stand, viewport, type Place } from '../../shared/place'
import '../../actions/button/button'
import '../../actions/icon-button/icon-button'
import inputCss from '../shared/input.css?inline'
import monthGridCss from '../../shared/month-grid.css?inline'
import {
  addMonths,
  formatDate as formatIso,
  monthLabel,
  parseDate,
  startOfMonth,
  todayIso,
} from '../../shared/date-format'
import { focusGridDay, renderMonthGrid } from '../../shared/month-grid'
import pickerCss from './date-range.css?inline'

/** The popover's distance from the field. */
const GAP = 4

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

/** dd-mm-yyyy, the local day of `date`. */
export function formatDate(date: Date): string {
  return formatIso(todayIso(date))
}

/** dd-mm-yyyy to yyyy-mm-dd; `null` for none or for what is no day. */
function iso(value: string | null): string | null {
  const parsed = value ? parseDate(value) : null
  return parsed?.kind === 'ok' ? parsed.iso : null
}

/** yyyy-mm-dd to a local `Date`, as the presets count. */
function dateOf(day: string): Date {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(year, month - 1, date)
}

/** The local `Date` of a dd-mm-yyyy day. */
function dayOf(value: string | null): Date | null {
  const day = iso(value)
  return day ? dateOf(day) : null
}

/** What a day cell adds to its name: its part in the range. */
function rangePart(start: boolean, end: boolean, inside: boolean): string {
  if (start && end) return 'begin- en einddatum'
  if (start) return 'begindatum'
  if (end) return 'einddatum'
  return inside ? 'in periode' : ''
}

export class LintjeDateRange extends LintjeInputElement {
  static override styles = [
    iconStyles,
    shadowCss(monthGridCss),
    shadowCss(pickerCss),
    shadowCss(inputCss),
  ]

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

  /**
   * Names the field inside, which `aria-label` on the host would not; the name ends in the
   * chosen range.
   */
  accessibleName: string = ''
  stacked: boolean = false
  open: boolean = false
  /** The chosen days, as `dd-mm-yyyy`. */
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

  /** Where the popover stands; not reactive, as it is measured after a render. */
  private spot: Place | null = null
  private reflowFrame: number = 0

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

  // Scroll is captured so a scrolling box around the element counts; one measurement per frame.
  private readonly onReflow = (): void => {
    if (!this.open || this.reflowFrame) return
    this.reflowFrame = requestAnimationFrame(() => {
      this.reflowFrame = 0
      this.measure()
    })
  }

  override connectedCallback(): void {
    super.connectedCallback()
    document.addEventListener('mousedown', this.onOutsideClick)
    document.addEventListener('keydown', this.onEscape, true)
    window.addEventListener('scroll', this.onReflow, { capture: true, passive: true })
    window.addEventListener('resize', this.onReflow)
  }

  override disconnectedCallback(): void {
    document.removeEventListener('mousedown', this.onOutsideClick)
    document.removeEventListener('keydown', this.onEscape, true)
    window.removeEventListener('scroll', this.onReflow, { capture: true })
    window.removeEventListener('resize', this.onReflow)
    if (this.reflowFrame) cancelAnimationFrame(this.reflowFrame)
    this.reflowFrame = 0
    super.disconnectedCallback()
  }

  /**
   * Places the popover at the field. Written straight onto the panel, through the CSSOM as a
   * strict `style-src` allows: a reactive property set after a render would draw it twice.
   */
  private measure(): void {
    const field = this.renderRoot.querySelector('.lintje-date-range-picker__field')
    const panel = this.renderRoot.querySelector<HTMLElement>('.lintje-date-range-picker__popover')
    if (!field || !panel) {
      this.spot = null
      return
    }
    const box = { width: panel.offsetWidth, height: panel.offsetHeight }
    const next = place(field.getBoundingClientRect(), box, viewport(), 'bottom-start', GAP)
    if (samePlace(this.spot, next)) return
    this.spot = next
    stand(panel, next)
    panel.style.setProperty('--lintje-date-range-space', `${next.space}px`)
  }

  // The panel exists only now, so its size is known; a closed one forgets its place.
  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    this.measure()
  }

  private get day(): Date {
    return this.today ?? new Date()
  }

  private toggle(): void {
    this.open = !this.open
    if (this.open) {
      this.draft = { ...this.range }
      this.month = dayOf(this.range.from) ?? this.day
      this.focusDay = ''
    }
  }

  private select(day: string): void {
    const from = iso(this.draft.from)
    const text = formatIso(day)
    if (!from || iso(this.draft.to)) this.draft = { from: text, to: null }
    else if (day < from) this.draft = { from: text, to: formatIso(from) }
    else this.draft = { from: this.draft.from, to: text }
  }

  private applyPreset(name: string): void {
    const range = presetRange(name, this.day, this.maxDate)
    if (!range) return
    this.draft = range
    this.month = dayOf(range.from) ?? this.day
    this.focusDay = ''
  }

  private pick(day: string): void {
    this.focusDay = day
    this.select(day)
  }

  /** Moves the tab stop; the month follows it. */
  private moveTo(day: string): void {
    this.focusDay = day
    this.month = dateOf(startOfMonth(day))
    void this.focusCell()
  }

  private shiftMonth(month: Date, count: number, focus: string): void {
    this.month = new Date(month.getFullYear(), month.getMonth() + count, 1)
    this.focusDay = addMonths(focus, count)
  }

  private async focusCell(): Promise<void> {
    await this.updateComplete
    focusGridDay(this.renderRoot)
  }

  private apply(): void {
    // `lintje-change` speaks dd-mm-yyyy; `lintje-values-change` (the URL) ISO.
    this.announce({ ...this.draft }, { from: iso(this.draft.from), to: iso(this.draft.to) })
    void this.close()
  }

  protected override render(): TemplateResult {
    const today = todayIso(this.day)
    const month = this.month ?? dayOf(this.range.from) ?? this.day
    const shown = todayIso(month).slice(0, 7)
    const from = iso(this.draft.from)
    const to = iso(this.draft.to)
    const last = this.maxDate ? todayIso(this.maxDate) : null
    const focus =
      [this.focusDay, from, today].find((day) => day && day.startsWith(shown)) ?? `${shown}-01`

    const fieldName = this.accessibleName || this.labelText
    const chosen = Boolean(this.range.from && this.range.to)
    const rangeLabel = chosen ? `${this.range.from} – ${this.range.to}` : 'dd-mm-jjjj – dd-mm-jjjj'
    const days =
      from && to ? Math.round((dateOf(to).getTime() - dateOf(from).getTime()) / 86_400_000) + 1 : 0
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
        ?disabled=${this.isDisabled}
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

            <div class="lintje-date-range-picker__calendar">
              ${renderMonthGrid({
                focus,
                today,
                multiselectable: true,
                day: (day) => {
                  const start = day === from
                  const end = day === to
                  const inRange = from !== null && to !== null && day > from && day < to
                  return {
                    selected: start || end,
                    inRange,
                    blocked: last !== null && day > last,
                    note: rangePart(start, end, inRange),
                  }
                },
                onPick: (day) => this.pick(day),
                onMove: (day) => this.moveTo(day),
              })}
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
