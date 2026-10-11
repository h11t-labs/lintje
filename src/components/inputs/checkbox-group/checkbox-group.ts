/**
 * `<lintje-checkbox-group>` — several options under one label, a checkbox per line, with one
 * hint and one message for the group. Options are `FilterOption[]`; a `description` stands
 * under its option. Each row is a `<lintje-checkbox>` without a `name`, so only the group tells
 * the host.
 *
 * `selected` lists the checked values in the order of `options`; a value the options do not
 * hold is kept after them. `required` draws nothing and sets no ARIA: `role="group"` cannot
 * carry `aria-required`, so the host's message says what is missing.
 *
 * Events: `lintje-change` with the values; with a `name` also `lintje-values-change`.
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { iconStyles } from '../../../icons/render'
import { LintjeInputElement } from '../shared/input'
import '../checkbox/checkbox'
import inputCss from '../shared/input.css?inline'
import checkboxGroupCss from './checkbox-group.css?inline'
import type { FilterOption } from '../../../types'

export class LintjeCheckboxGroup extends LintjeInputElement {
  static override styles = [iconStyles, shadowCss(inputCss), shadowCss(checkboxGroupCss)]

  static override properties: PropertyDeclarations = {
    options: { attribute: false },
    selected: { attribute: false },
  }

  declare options?: FilterOption[]
  /** The checked values. A property, not an attribute: a server-rendered page sets it as data. */
  selected: string[] = []

  private toggle(value: string, checked: boolean): void {
    const chosen = new Set(this.selected)
    if (checked) chosen.add(value)
    else chosen.delete(value)
    const known = (this.options ?? []).map((option) => option.value)
    const next = [
      ...known.filter((item) => chosen.has(item)),
      ...[...chosen].filter((item) => !known.includes(item)),
    ]
    this.selected = next
    this.announce(next)
  }

  // The natives sit in the rows' own roots, out of reach of the base's query.
  protected override focusControl(options?: FocusOptions): void {
    if (this.disabled) return
    this.renderRoot.querySelector<HTMLElement>('lintje-checkbox')?.focus(options)
  }

  protected override render(): TemplateResult {
    const selected = this.selected ?? []
    return html`<div
      class="lintje-field"
      role="group"
      aria-labelledby=${this.labelId}
      aria-describedby=${this.describedBy}
      aria-invalid=${this.error ? 'true' : nothing}
    >
      ${this.renderLabel()}
      <div class="lintje-checkbox-group">
        ${(this.options ?? []).map(
          (option) => html`<lintje-checkbox
            class="lintje-checkbox-group__option"
            label=${option.label}
            hint=${option.description ?? nothing}
            .checked=${selected.includes(option.value)}
            ?disabled=${this.disabled}
            @lintje-change=${(event: CustomEvent<boolean>) => {
              event.stopPropagation()
              this.toggle(option.value, event.detail)
            }}
          ></lintje-checkbox>`,
        )}
      </div>
      ${this.renderFoot()}
    </div>`
  }
}

define('lintje-checkbox-group', LintjeCheckboxGroup)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-checkbox-group': LintjeCheckboxGroup
  }
}
