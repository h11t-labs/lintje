/**
 * The one month grid of the date input and the date range: the weekday heads, the weeks as day
 * cells, their states and their keys. Its owner draws it in its own root, with `monthGridCss`,
 * and says per day what it means there.
 */
import { html, nothing, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { DAY_MOVES, dayLabel, monthLabel, monthWeeks, startOfMonth, WEEKDAYS } from './date-format'

/** What one day is to the grid's owner. */
export interface GridDay {
  /** Filled in the primary: the chosen day, or the start or end of a period. */
  selected?: boolean
  /** Between the start and the end of a period. */
  inRange?: boolean
  /** Outside what may be chosen: a press picks nothing, a click makes it the tab stop. */
  blocked?: boolean
  /** What the day's name adds, after a comma. */
  note?: string
}

export interface MonthGrid {
  /** The day that holds the grid's one tab stop, ISO; the grid shows its month. */
  focus: string
  /** The day marked as today, ISO. */
  today: string
  /** More than one day is selected at once: a period and the days in it. */
  multiselectable?: boolean
  day: (iso: string) => GridDay
  /** A click, Enter or Space on a day that is not blocked. */
  onPick: (iso: string) => void
  /**
   * An arrow, Home, End or PageUp/PageDown, or a click on a blocked day: the day the tab stop
   * goes to, in any month.
   */
  onMove: (iso: string) => void
}

export function renderMonthGrid(grid: MonthGrid): TemplateResult {
  const month = startOfMonth(grid.focus).slice(0, 7)
  const onKeydown = (event: KeyboardEvent): void => {
    const move = DAY_MOVES[event.key]
    if (!move) return
    event.preventDefault()
    grid.onMove(move(grid.focus))
  }
  return html`<div
    class="lintje-month-grid"
    role="grid"
    aria-multiselectable=${grid.multiselectable ? 'true' : nothing}
    aria-label=${monthLabel(grid.focus)}
    @keydown=${onKeydown}
  >
    <div class="lintje-month-grid__row" role="row">
      ${WEEKDAYS.map(
        (name) => html`<span class="lintje-month-grid__weekday" role="columnheader">${name}</span>`,
      )}
    </div>
    ${monthWeeks(grid.focus).map(
      (week) => html`<div class="lintje-month-grid__row" role="row">
        ${week.map((iso) => {
          // The weeks around the month stay empty: arrows that leave the month turn it.
          if (!iso.startsWith(month)) {
            return html`<span class="lintje-month-grid__blank" role="gridcell"></span>`
          }
          const day = grid.day(iso)
          const today = iso === grid.today
          // The cell itself takes the focus, as in the WAI-ARIA date picker: a button may not
          // carry the role of a cell.
          return html`<span
            role="gridcell"
            class=${classMap({
              'lintje-month-grid__day': true,
              'is-blocked': Boolean(day.blocked),
              'is-today': today,
              'is-selected': Boolean(day.selected),
              'is-in-range': Boolean(day.inRange),
            })}
            tabindex=${iso === grid.focus ? '0' : '-1'}
            aria-label=${dayLabel(iso) + (day.note ? `, ${day.note}` : '')}
            aria-selected=${day.selected || day.inRange ? 'true' : 'false'}
            aria-current=${today ? 'date' : nothing}
            aria-disabled=${day.blocked ? 'true' : nothing}
            @click=${() => {
              // A blocked day the click focused picks nothing, but holds the tab stop: the
              // arrows go on from the day that has the focus (WCAG 2.4.3).
              if (day.blocked) grid.onMove(iso)
              else grid.onPick(iso)
            }}
            @keydown=${(event: KeyboardEvent) => {
              // What a button did itself.
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
              if (!day.blocked) grid.onPick(iso)
            }}
          >
            ${Number(iso.slice(8))}
          </span>`
        })}
      </div>`,
    )}
  </div>`
}

/** Focuses the day that holds the tab stop, once the owner has drawn it. */
export function focusGridDay(root: ParentNode): void {
  root.querySelector<HTMLElement>('.lintje-month-grid__day[tabindex="0"]')?.focus()
}
