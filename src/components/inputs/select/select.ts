/**
 * `<lintje-select>` — a select, bold once the value differs from the default.
 * The filter bar passes no `name` and sets `hide-label`. The width is the host's, not inline,
 * so `filter-layout.css` can narrow it from outside.
 *
 * Events: `lintje-change`; with a `name` also the composed `lintje-values-change`.
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import { LintjeInputElement } from '../shared/input'
import inputCss from '../shared/input.css?inline'
import selectCss from './select.css?inline'
import type { FilterOption } from '../../../types'

export class LintjeSelect extends LintjeInputElement {
  static override styles = [iconStyles, shadowCss(selectCss), shadowCss(inputCss)]

  static override properties: PropertyDeclarations = {
    value: { type: String },
    bold: { type: Boolean },
    stacked: { type: Boolean, reflect: true },
    options: { attribute: false },
  }

  value: string = ''
  bold: boolean = false
  stacked: boolean = false
  declare options?: FilterOption[]

  private choose(event: Event): void {
    this.value = (event.target as HTMLSelectElement).value
    this.commit(this.value)
  }

  protected override render(): TemplateResult {
    return html`<div class="lintje-field">
      ${this.renderLabel(this.controlId)}
      <div class="lintje-select">
        <select
          id=${this.controlId}
          class=${classMap({
            'lintje-select__control': true,
            'is-bold': this.bold,
            'is-error': Boolean(this.error),
          })}
          aria-labelledby=${this.labelId}
          aria-describedby=${this.describedBy}
          aria-invalid=${this.error ? 'true' : nothing}
          aria-required=${this.required ? 'true' : nothing}
          ?disabled=${this.disabled}
          .value=${this.value}
          @change=${this.choose}
        >
          ${(this.options ?? []).map(
            (option) =>
              html`<option value=${option.value} ?selected=${option.value === this.value}>
                ${option.label}
              </option>`,
          )}
        </select>
        ${renderIcon('functioneel-delta-omlaag', { size: 16, className: 'lintje-select__icon' })}
      </div>
      ${this.renderFoot()}
    </div>`
  }
}

define('lintje-select', LintjeSelect)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-select': LintjeSelect
  }
}
