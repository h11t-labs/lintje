/**
 * `<lintje-toggle>` — a switch for immediate effect: it commits when switched, never in a form.
 * A value that waits for a button is a checkbox.
 *
 * Events: `lintje-change`; with a `name` also the composed `lintje-values-change`.
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { iconStyles } from '../../../icons/render'
import { LintjeInputElement } from '../shared/input'
import inputCss from '../shared/input.css?inline'

export class LintjeToggle extends LintjeInputElement {
  static override styles = [iconStyles, shadowCss(inputCss)]

  static override properties: PropertyDeclarations = {
    checked: { type: Boolean, reflect: true },
  }

  checked: boolean = false

  private change(event: Event): void {
    this.checked = (event.target as HTMLInputElement).checked
    this.commit(this.checked)
  }

  protected override render(): TemplateResult {
    return html`<div class="lintje-field">
      <label class=${classMap({ 'lintje-choice': true, 'is-disabled': this.disabled })}>
        <input
          type="checkbox"
          role="switch"
          class="lintje-choice__input"
          .checked=${this.checked}
          aria-describedby=${this.describedBy}
          aria-invalid=${this.error ? 'true' : nothing}
          ?disabled=${this.disabled}
          @change=${this.change}
        />
        <span class="lintje-choice__switch" aria-hidden="true">
          <span class="lintje-choice__knob"></span>
        </span>
        <span
          class=${classMap({
            'lintje-choice__label': true,
            'is-modified': this.modified && !this.hideLabel,
            // The screen reader still needs the name on the switch itself.
            'visually-hidden': this.hideLabel,
          })}
          >${this.label} ${this.renderLabelSuffix()}</span
        >
        ${
          this.modified && !this.hideLabel
            ? html`<span class="lintje-label__dot"><span class="visually-hidden">afwijkend van standaard</span></span>`
            : nothing
        }
      </label>
      ${this.renderFoot()}
    </div>`
  }
}

define('lintje-toggle', LintjeToggle)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-toggle': LintjeToggle
  }
}
