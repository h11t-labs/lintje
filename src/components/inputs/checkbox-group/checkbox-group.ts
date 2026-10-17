/**
 * `<lintje-checkbox-group>` — several options under one label, a checkbox per line, with one hint
 * and one message for the group.
 *
 * Only the group tells the host: its rows carry no `name`. `required` draws nothing and sets no
 * ARIA, since a group cannot carry `aria-required`: the browser's message in a native form and
 * the host's message say what is missing. With `other` the last row is "Anders", value `other`,
 * with a text field under it while it is checked: the focus stays on the row, and the field is
 * the next Tab stop. The host sets `other-error` for an empty one.
 *
 * Events: `lintje-change` `string[]` (the checked values), `lintje-other-change` `string` (the
 * field's text, on leaving it or Enter), `lintje-values-change`
 * `{ [name]: value, [name-other]: text | null }` (with a `name`; the second key with `other`),
 * `lintje-reset` (the reset link was pressed).
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { iconStyles } from '../../../icons/render'
import { OTHER_VALUE } from '../../shared/controls'
import { renderOtherField } from '../../shared/other'
import { LintjeChoiceGroupElement } from '../shared/input'
import '../text-input/text-input'
import '../checkbox/checkbox'
import inputCss from '../shared/input.css?inline'
import checkboxGroupCss from './checkbox-group.css?inline'
import type { FilterOption } from '../../../types'

export class LintjeCheckboxGroup extends LintjeChoiceGroupElement {
  static override styles = [iconStyles, shadowCss(inputCss), shadowCss(checkboxGroupCss)]

  static override properties: PropertyDeclarations = {
    options: { attribute: false },
    selected: { attribute: false },
  }

  /** A `description` stands under its option. */
  declare options?: FilterOption[]
  /**
   * The checked values, in the order of `options`, `other` after them; a value the options do not
   * hold is kept at the end. A property, not an attribute: a server-rendered page sets it as data.
   */
  selected: string[] = []

  protected override get otherChosen(): boolean {
    return (this.selected ?? []).includes(OTHER_VALUE)
  }

  protected override get otherOption(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.lintje-checkbox-group__other')
  }

  private toggle(value: string, checked: boolean): void {
    const chosen = new Set(this.selected)
    if (checked) chosen.add(value)
    else chosen.delete(value)
    const known = [
      ...(this.options ?? []).map((option) => option.value),
      ...(this.drawsOther ? [OTHER_VALUE] : []),
    ]
    const next = [
      ...known.filter((item) => chosen.has(item)),
      ...[...chosen].filter((item) => !known.includes(item)),
    ]
    this.selected = next
    this.announce(next)
  }

  // The natives sit in the rows' own roots, out of reach of the base's query.
  protected override get focusTarget(): HTMLElement | null {
    const row = this.renderRoot.querySelector('lintje-checkbox')
    return row?.shadowRoot?.querySelector<HTMLElement>('input') ?? null
  }

  protected override render(): TemplateResult {
    const selected = this.selected ?? []
    return html`<div
      class="lintje-field"
      role="group"
      aria-labelledby=${this.labelId}
      aria-describedby=${this.describedBy}
      aria-invalid=${this.error || (this.otherOpen && this.otherError) ? 'true' : nothing}
    >
      ${this.renderLabel()}
      <div class="lintje-checkbox-group">
        ${(this.options ?? []).map(
          (option) => html`<lintje-checkbox
            class="lintje-checkbox-group__option"
            label=${option.label}
            hint=${option.description ?? nothing}
            .checked=${selected.includes(option.value)}
            ?disabled=${this.isDisabled}
            @lintje-change=${(event: CustomEvent<boolean>) => {
              event.stopPropagation()
              this.toggle(option.value, event.detail)
            }}
          ></lintje-checkbox>`,
        )}
        ${
          this.drawsOther
            ? html`<lintje-checkbox
              class="lintje-checkbox-group__option lintje-checkbox-group__other"
              label=${this.otherLabel}
              .checked=${this.otherChosen}
              ?disabled=${this.isDisabled}
              @lintje-change=${(event: CustomEvent<boolean>) => {
                event.stopPropagation()
                this.toggle(OTHER_VALUE, event.detail)
              }}
            ></lintje-checkbox>`
            : nothing
        }
        ${
          this.otherOpen
            ? renderOtherField({
                label: this.otherLabel,
                text: this.otherText,
                placeholder: this.otherPlaceholder,
                error: this.otherError,
                disabled: this.isDisabled,
                className: 'lintje-choice__other',
                onCommit: (text) => this.commitOther(text),
              })
            : nothing
        }
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
