/**
 * `<lintje-combobox>` — search while typing and choose one value. Typing narrows `.options`
 * itself; with `remote` it sends `lintje-search` after typing stops and shows a busy row until
 * the host sets new `.options` (it never fetches). Text that matches no option is never a value;
 * emptying the field commits `null`. Escape closes and restores the previous value.
 *
 * Events: `lintje-change`; with a `name` also the composed `lintje-values-change`. With
 * `remote`: composed `lintje-search` `{ query }`.
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { live } from 'lit/directives/live.js'
import { define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import '../../../primitives/popover/popover'
import '../../../primitives/spinner/spinner'
import { LintjeInputElement } from '../shared/input'
import inputCss from '../shared/input.css?inline'
import { Debounce } from '../../shared/debounce'
import type { FilterOption } from '../../../types'
import comboboxCss from './combobox.css?inline'

export function filterOptions(options: FilterOption[], query: string): FilterOption[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return options
  return options.filter((option) => option.label.toLowerCase().includes(needle))
}

export function splitMatch(label: string, query: string): [string, string, string] {
  const needle = query.trim().toLowerCase()
  const at = needle ? label.toLowerCase().indexOf(needle) : -1
  if (at < 0) return [label, '', '']
  return [label.slice(0, at), label.slice(at, at + needle.length), label.slice(at + needle.length)]
}

export function resultsText(count: number): string {
  return count === 1 ? '1 resultaat' : `${count} resultaten`
}

const LIST_ID = 'lintje-combobox-list'
const optionId = (index: number): string => `lintje-combobox-option-${index}`

export class LintjeCombobox extends LintjeInputElement {
  static override styles = [iconStyles, shadowCss(inputCss), shadowCss(comboboxCss)]

  static override properties: PropertyDeclarations = {
    value: { type: String },
    options: { attribute: false },
    placeholder: { type: String },
    remote: { type: Boolean },
    loadingLabel: { type: String, attribute: 'loading-label' },
    emptyLabel: { type: String, attribute: 'empty-label' },
    stacked: { type: Boolean, reflect: true },
    open: { type: Boolean, reflect: true },
    text: { state: true },
    active: { state: true },
    loading: { state: true },
  }

  value: string | null = null
  declare options?: FilterOption[]
  placeholder: string = ''
  remote: boolean = false
  loadingLabel: string = 'Opties ophalen'
  emptyLabel: string = 'Niets gevonden voor'
  stacked: boolean = false
  open: boolean = false
  protected text: string | null = null
  protected active: number = -1
  protected loading: boolean = false

  private chosenLabel: string = ''
  private readonly typing = new Debounce(this)

  private get visible(): FilterOption[] {
    const options = this.options ?? []
    return this.remote ? options : filterOptions(options, this.text ?? '')
  }

  private get chosenText(): string {
    if (this.value === null || this.value === undefined) return ''
    const option = (this.options ?? []).find((item) => item.value === this.value)
    return option?.label ?? (this.chosenLabel || this.value)
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (changed.has('options') && this.remote) this.loading = false
    if (this.disabled) this.open = false
    const count = this.visible.length
    if (this.active >= count) this.active = count - 1
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    if (!(changed as Map<string, unknown>).has('active') || this.active < 0) return
    const row = this.renderRoot.querySelector<HTMLElement>(`#${optionId(this.active)}`)
    row?.scrollIntoView?.({ block: 'nearest' })
  }

  private choose(option: FilterOption): void {
    this.typing.cancel()
    this.value = option.value
    this.chosenLabel = option.label
    this.text = null
    this.open = false
    this.active = -1
    this.loading = false
    this.commit(option.value)
  }

  private restore(): void {
    this.typing.cancel()
    this.text = null
    this.open = false
    this.active = -1
    this.loading = false
  }

  private onInput(event: Event): void {
    this.text = (event.target as HTMLInputElement).value
    this.open = true
    if (this.remote) {
      const query = this.text
      this.loading = true
      this.typing.schedule(() => this.emit('lintje-search', { query }))
    }
    this.active = this.visible.length ? 0 : -1
  }

  private onKeydown(event: KeyboardEvent): void {
    const count = this.visible.length
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        if (!this.open) {
          this.open = true
          const chosen = this.visible.findIndex((option) => option.value === this.value)
          this.active = chosen >= 0 ? chosen : count ? 0 : -1
        } else {
          this.active = Math.min(this.active + 1, count - 1)
        }
        return
      case 'ArrowUp':
        if (!this.open) return
        event.preventDefault()
        this.active = Math.max(this.active - 1, 0)
        return
      case 'Home':
      case 'End':
        if (!this.open || !count) return
        event.preventDefault()
        this.active = event.key === 'Home' ? 0 : count - 1
        return
      case 'Enter':
      case 'Tab':
        if (!this.open || this.loading || this.active < 0) return
        if (event.key === 'Enter') event.preventDefault()
        this.choose(this.visible[this.active])
        return
      case 'Escape':
        if (this.text !== null) this.restore()
        return
    }
  }

  private onBlur(): void {
    if (this.text !== null && this.text.trim() === '' && this.value !== null) {
      this.typing.cancel()
      this.value = null
      this.chosenLabel = ''
      this.commit(null)
    }
    this.restore()
  }

  private onPopoverClose(event: CustomEvent<{ reason: string }>): void {
    event.stopPropagation()
    this.restore()
  }

  private renderOption(option: FilterOption, index: number): TemplateResult {
    const [before, match, after] = splitMatch(option.label, this.text ?? '')
    const chosen = option.value === this.value
    return html`<li
      id=${optionId(index)}
      class=${classMap({
        'lintje-combobox__option': true,
        'is-active': index === this.active,
        'is-selected': chosen,
      })}
      role="option"
      aria-selected=${chosen ? 'true' : 'false'}
      @click=${() => this.choose(option)}
    >
      ${before}${match ? html`<strong class="lintje-combobox__match">${match}</strong>` : nothing}${after}
    </li>`
  }

  private renderList(): TemplateResult | typeof nothing {
    if (!this.open) return nothing
    if (this.loading) {
      return html`<div class="lintje-combobox__status">
        <lintje-spinner label=${this.loadingLabel}></lintje-spinner>
      </div>`
    }
    const visible = this.visible
    if (!visible.length) {
      return html`<p class="lintje-combobox__empty">${this.emptyLabel} “${this.text ?? ''}”</p>`
    }
    return html`<ul
      id=${LIST_ID}
      class="lintje-combobox__list"
      role="listbox"
      tabindex="-1"
      aria-labelledby=${this.labelId}
    >
      ${visible.map((option, index) => this.renderOption(option, index))}
    </ul>`
  }

  protected override render(): TemplateResult {
    const open = this.open && !this.disabled
    const listed = open && !this.loading && this.visible.length > 0
    const count = open && !this.loading ? resultsText(this.visible.length) : ''
    return html`<div class="lintje-field">
      ${this.renderLabel(this.controlId)}
      <div class="lintje-combobox">
        <input
          type="text"
          id=${this.controlId}
          class=${classMap({ 'lintje-combobox__control': true, 'is-error': Boolean(this.error) })}
          .value=${live(this.text ?? this.chosenText)}
          placeholder=${this.placeholder || nothing}
          autocomplete="off"
          role="combobox"
          aria-expanded=${open ? 'true' : 'false'}
          aria-controls=${listed ? LIST_ID : nothing}
          aria-autocomplete="list"
          aria-activedescendant=${listed && this.active >= 0 ? optionId(this.active) : nothing}
          aria-labelledby=${this.labelId}
          aria-describedby=${this.describedBy}
          aria-invalid=${this.error ? 'true' : nothing}
          aria-required=${this.required ? 'true' : nothing}
          ?disabled=${this.disabled}
          @input=${this.onInput}
          @keydown=${this.onKeydown}
          @blur=${this.onBlur}
          @click=${() => {
            if (!this.disabled) this.open = true
          }}
        />
        ${renderIcon('functioneel-delta-omlaag', { size: 16, className: 'lintje-combobox__chevron' })}
      </div>
      <!-- A press in the list, on an option or beside one, keeps the focus in the field. -->
      <lintje-popover
        match-width
        ?open=${open}
        @lintje-close=${this.onPopoverClose}
        @mousedown=${(event: MouseEvent) => event.preventDefault()}
      >
        ${this.renderList()}
      </lintje-popover>
      <span class="visually-hidden" role="status">${count}</span>
      ${this.renderFoot()}
    </div>`
  }
}

define('lintje-combobox', LintjeCombobox)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-combobox': LintjeCombobox
  }
}
