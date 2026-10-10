/**
 * `<lintje-slot-picker>` — a time for an appointment: days side by side, each with its times as
 * options. One radio group over every day, so the arrow keys walk the times and Tab stops once;
 * a time's name carries its day. A full time stays, disabled, with the word "Vol" beside it
 * (rule 13), and a day without times says so. The days are the host's: it sends the ones it
 * offers, and pages them itself.
 *
 * Events: `lintje-change` with the chosen time's `value`; with a `name` also `lintje-values-change`.
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { iconStyles } from '../../../icons/render'
import { LintjeInputElement } from '../shared/input'
import { dayLabel, shortDayLabel } from '../date-input/date-format'
import inputCss from '../shared/input.css?inline'
import slotPickerCss from './slot-picker.css?inline'

export interface TimeSlot {
  /** What crosses in `lintje-change`: an id, or an ISO date-time. */
  value: string
  /** The time as the reader sees it: "09:30". */
  label: string
  /** Taken: drawn disabled, with "Vol" beside the time. */
  full?: boolean
}

export interface SlotDay {
  /** The day as ISO (`2026-10-12`); the heading and each time's name come from it. */
  date: string
  /** In the order they are drawn; `[]` says "Geen tijden". */
  slots: TimeSlot[]
}

export class LintjeSlotPicker extends LintjeInputElement {
  static override styles = [iconStyles, shadowCss(inputCss), shadowCss(slotPickerCss)]

  static override properties: PropertyDeclarations = {
    value: { type: String },
    days: { attribute: false },
  }

  /** The chosen time's `value`; `''` while nothing is chosen. */
  value: string = ''
  declare days?: SlotDay[]

  private choose(value: string): void {
    this.value = value
    this.commit(value)
  }

  protected override render(): TemplateResult {
    const days = this.days ?? []
    return html`<div
      class="lintje-field"
      role="radiogroup"
      aria-labelledby=${this.labelId}
      aria-describedby=${this.describedBy}
      aria-invalid=${this.error ? 'true' : nothing}
      aria-required=${this.required ? 'true' : nothing}
    >
      ${this.renderLabel()}
      ${
        days.length
          ? html`<div class="lintje-slot-picker">${days.map((day) => this.renderDay(day))}</div>`
          : html`<p class="lintje-slot-picker__none">Geen tijden beschikbaar</p>`
      }
      ${this.renderFoot()}
    </div>`
  }

  // The heading is hidden from a screen reader: every time's name already says its day.
  private renderDay(day: SlotDay): TemplateResult {
    return html`<div class="lintje-slot-picker__day">
      <p class="lintje-slot-picker__heading" aria-hidden="true">${shortDayLabel(day.date)}</p>
      ${
        day.slots.length
          ? day.slots.map((slot) => this.renderSlot(day, slot))
          : html`<p class="lintje-slot-picker__none">
              <span class="visually-hidden">${dayLabel(day.date)}: </span>Geen tijden
            </p>`
      }
    </div>`
  }

  private renderSlot(day: SlotDay, slot: TimeSlot): TemplateResult {
    const chosen = slot.value === this.value
    const disabled = this.disabled || Boolean(slot.full)
    return html`<label
      class=${classMap({
        'lintje-slot-picker__slot': true,
        'is-chosen': chosen,
        'is-disabled': disabled,
      })}
    >
      <input
        type="radio"
        class="lintje-choice__input"
        name=${this.name || 'lintje-slot-picker'}
        value=${slot.value}
        .checked=${chosen}
        ?disabled=${disabled}
        @change=${() => this.choose(slot.value)}
      />
      <span class="visually-hidden">${dayLabel(day.date)}, </span>
      <span class="lintje-slot-picker__time">${slot.label}</span>
      ${slot.full ? html`<span class="lintje-slot-picker__full">Vol</span>` : nothing}
    </label>`
  }
}

define('lintje-slot-picker', LintjeSlotPicker)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-slot-picker': LintjeSlotPicker
  }
}
