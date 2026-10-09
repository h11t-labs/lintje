/**
 * `<lintje-field>` — the label above a filter control. No `for`: a `<label for>` cannot name a
 * control in another shadow root, so each control carries its own `aria-label`; a click on the
 * label focuses the first slotted control that takes focus.
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { LintjeElement, define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import fieldCss from './field.css?inline'

/** Tries the element, then its children: a host may slot a wrapper around its controls. */
function focusInto(element: Element): boolean {
  if (element instanceof HTMLElement) {
    element.focus()
    const active = (element.getRootNode() as Document | ShadowRoot).activeElement
    if (active && (active === element || element.contains(active))) return true
  }
  return [...element.children].some(focusInto)
}

export class LintjeField extends LintjeElement {
  static override styles = shadowCss(fieldCss)

  static override properties: PropertyDeclarations = {
    label: { type: String },
    modified: { type: Boolean, reflect: true },
    stacked: { type: Boolean, reflect: true },
  }

  label: string = ''
  modified: boolean = false
  stacked: boolean = false

  private focusControl(): void {
    const slot = this.renderRoot.querySelector('slot')
    slot?.assignedElements({ flatten: true }).some(focusInto)
  }

  protected override render(): TemplateResult {
    return html`<div class="lintje-filter-field">
      <label
        class=${classMap({ 'lintje-filter-field__label': true, 'is-modified': this.modified })}
        @click=${this.focusControl}
      >
        ${this.label}
        ${
          this.modified
            ? html`<span class="lintje-filter-field__dot" aria-hidden="true"></span
                ><span class="visually-hidden">afwijkend van standaard</span>`
            : nothing
        }
      </label>
      <slot></slot>
    </div>`
  }
}

define('lintje-field', LintjeField)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-field': LintjeField
  }
}
