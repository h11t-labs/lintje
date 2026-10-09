/**
 * `<lintje-checkbox>` — a checkbox; `indeterminate` shows a dash. The value is `checked`, a
 * boolean, not `value` (the string a native checkbox submits). `lintje-values-change` goes out
 * only with a `name`, so `lintje-multiselect`'s unnamed rows leak nothing to the host.
 *
 * Events: `lintje-change` with the boolean; with a `name` also `lintje-values-change`.
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { iconStyles } from '../../../icons/render'
import { LintjeInputElement } from '../shared/input'
import inputCss from '../shared/input.css?inline'

export class LintjeCheckbox extends LintjeInputElement {
  static override styles = [iconStyles, shadowCss(inputCss)]

  static override properties: PropertyDeclarations = {
    checked: { type: Boolean, reflect: true },
    indeterminate: { type: Boolean, reflect: true },
  }

  checked: boolean = false
  indeterminate: boolean = false

  private change(event: Event): void {
    this.checked = (event.target as HTMLInputElement).checked
    this.indeterminate = false
    this.commit(this.checked)
  }

  protected override render(): TemplateResult {
    const dash = this.indeterminate && !this.checked
    return html`<div class="lintje-field">
      <label class=${classMap({ 'lintje-choice': true, 'is-disabled': this.disabled })}>
        <input
          type="checkbox"
          class="lintje-choice__input"
          .checked=${this.checked}
          .indeterminate=${dash}
          aria-describedby=${this.describedBy}
          aria-invalid=${this.error ? 'true' : nothing}
          aria-required=${this.required ? 'true' : nothing}
          ?disabled=${this.disabled}
          @change=${this.change}
        />
        <span class="lintje-choice__box" aria-hidden="true"
          ><span class="lintje-choice__mark">${dash ? '–' : '✓'}</span></span
        >
        <span class=${classMap({ 'lintje-choice__label': true, 'is-modified': this.modified })}
          >${this.label} ${this.renderLabelSuffix()}</span
        >
        ${
          this.modified
            ? html`<span class="lintje-label__dot"><span class="visually-hidden">afwijkend van standaard</span></span>`
            : nothing
        }
      </label>
      ${this.renderFoot()}
    </div>`
  }
}

define('lintje-checkbox', LintjeCheckbox)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-checkbox': LintjeCheckbox
  }
}
