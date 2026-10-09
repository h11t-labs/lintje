/**
 * `<lintje-tag-input>` — free keywords as chips in one field. Enter, a comma, a paste with commas
 * or leaving the field makes chips; a duplicate lights up its chip and is said instead of being
 * added. With `.options` it also suggests options, and still takes a word that is not among them.
 * A chip's cross is its one control: the arrows walk the crosses, Backspace and Delete remove.
 *
 * Events: `lintje-change`; with a `name` also the composed `lintje-values-change`.
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
import { filterOptions, splitMatch } from '../combobox/combobox'
import { LintjeInputElement } from '../shared/input'
import inputCss from '../shared/input.css?inline'
import type { FilterOption } from '../../../types'
import tagInputCss from './tag-input.css?inline'

export function splitWords(text: string): string[] {
  return text
    .split(/[,\n]/)
    .map((word) => word.trim())
    .filter(Boolean)
}

/** The list after adding `words`, and the existing word each duplicate hit. Case-insensitive. */
export function addWords(
  current: string[],
  words: string[],
): { next: string[]; added: string[]; duplicate: string | null } {
  const next = [...current]
  const added: string[] = []
  let duplicate: string | null = null
  for (const word of words) {
    const existing = next.find((item) => item.toLowerCase() === word.toLowerCase())
    if (existing !== undefined) {
      duplicate = existing
      continue
    }
    next.push(word)
    added.push(word)
  }
  return { next, added, duplicate }
}

const FLASH_MS = 1000
const LIST_ID = 'lintje-tag-input-list'
const KEYS_ID = 'lintje-tag-input-keys'
const optionId = (index: number): string => `lintje-tag-input-option-${index}`

export class LintjeTagInput extends LintjeInputElement {
  static override styles = [iconStyles, shadowCss(inputCss), shadowCss(tagInputCss)]

  static override properties: PropertyDeclarations = {
    value: { attribute: false },
    options: { attribute: false },
    placeholder: { type: String },
    stacked: { type: Boolean, reflect: true },
    text: { state: true },
    flash: { state: true },
    news: { state: true },
    active: { state: true },
    suggesting: { state: true },
  }

  value: string[] = []
  /** A chosen option enters `value` by its value and shows by its label. */
  declare options?: FilterOption[]
  placeholder: string = ''
  stacked: boolean = false
  protected text: string = ''
  protected flash: string | null = null
  protected news: string = ''
  protected active: number = -1
  /** Off after Escape, on again with the next keystroke. */
  protected suggesting: boolean = false

  #flashTimer: ReturnType<typeof setTimeout> | null = null

  override disconnectedCallback(): void {
    if (this.#flashTimer !== null) clearTimeout(this.#flashTimer)
    this.#flashTimer = null
    super.disconnectedCallback()
  }

  private get input(): HTMLInputElement | null {
    return this.renderRoot.querySelector<HTMLInputElement>('.lintje-tag-input__input')
  }

  private labelOf(word: string): string {
    return this.options?.find((option) => option.value === word)?.label ?? word
  }

  private get suggestions(): FilterOption[] {
    if (!this.options || !this.text.trim()) return []
    return filterOptions(this.options, this.text).filter(
      (option) => !this.value.includes(option.value),
    )
  }

  private get listOpen(): boolean {
    return this.suggesting && !this.disabled && this.suggestions.length > 0
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (this.active >= this.suggestions.length) this.active = this.suggestions.length - 1
  }

  private resolve(word: string): string {
    const option = this.options?.find((item) => item.label.toLowerCase() === word.toLowerCase())
    return option?.value ?? word
  }

  private add(words: string[]): void {
    const { next, added, duplicate } = addWords(
      this.value,
      words.map((word) => this.resolve(word)),
    )
    this.text = ''
    this.active = -1
    const news: string[] = []
    if (added.length) news.push(`${added.map((word) => this.labelOf(word)).join(', ')} toegevoegd`)
    if (duplicate !== null) {
      this.light(duplicate)
      news.push(`${this.labelOf(duplicate)} staat er al`)
    }
    if (news.length) this.news = news.join('. ')
    if (!added.length) return
    this.value = next
    this.announce(next)
  }

  private light(word: string): void {
    if (this.#flashTimer !== null) clearTimeout(this.#flashTimer)
    this.flash = word
    this.#flashTimer = setTimeout(() => {
      this.flash = null
      this.#flashTimer = null
    }, FLASH_MS)
  }

  private async removeChip(index: number, then: number | 'input'): Promise<void> {
    if (this.disabled) return
    const word = this.value[index]
    const next = this.value.filter((_, at) => at !== index)
    this.value = next
    this.news = `${this.labelOf(word)} verwijderd`
    this.announce(next)
    await this.updateComplete
    if (then === 'input' || then < 0 || then >= next.length) this.input?.focus()
    else this.focusChip(then)
  }

  private focusChip(index: number): void {
    this.renderRoot.querySelector<HTMLElement>(`[data-index="${index}"]`)?.focus()
  }

  private onInput(event: Event): void {
    this.text = (event.target as HTMLInputElement).value
    this.suggesting = true
    this.active = this.suggestions.length ? 0 : -1
  }

  private onPaste(event: ClipboardEvent): void {
    const pasted = event.clipboardData?.getData('text') ?? ''
    if (!/[,\n]/.test(pasted)) return
    event.preventDefault()
    const input = event.target as HTMLInputElement
    this.add(splitWords(input.value + pasted))
  }

  private onKeydown(event: KeyboardEvent): void {
    const input = event.target as HTMLInputElement
    const atStart = input.selectionStart === 0 && input.selectionEnd === 0
    const open = this.listOpen
    switch (event.key) {
      case 'Enter':
      case ',': {
        const chosen = open && this.active >= 0 ? this.suggestions[this.active] : null
        if (chosen && event.key === 'Enter') {
          event.preventDefault()
          this.add([chosen.label])
          return
        }
        if (event.key === ',' || input.value.trim()) event.preventDefault()
        this.add(splitWords(input.value))
        return
      }
      case 'Backspace':
        if (input.value === '' && this.value.length) {
          event.preventDefault()
          this.focusChip(this.value.length - 1)
        }
        return
      case 'ArrowLeft':
        if ((input.value === '' || atStart) && this.value.length) {
          event.preventDefault()
          this.focusChip(this.value.length - 1)
        }
        return
      case 'ArrowDown':
        if (!open) return
        event.preventDefault()
        this.active = Math.min(this.active + 1, this.suggestions.length - 1)
        return
      case 'ArrowUp':
        if (!open) return
        event.preventDefault()
        this.active = Math.max(this.active - 1, 0)
        return
    }
  }

  private onChipKeydown(event: KeyboardEvent, index: number): void {
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault()
        this.focusChip(Math.max(0, index - 1))
        return
      case 'ArrowRight':
        event.preventDefault()
        if (index + 1 < this.value.length) this.focusChip(index + 1)
        else this.input?.focus()
        return
      case 'Backspace':
        event.preventDefault()
        void this.removeChip(index, 'input')
        return
      case 'Delete':
        event.preventDefault()
        void this.removeChip(index, index)
        return
    }
  }

  /** Leaving the field makes the typed text a chip; moving to one of its own chips is not leaving. */
  private onBlur(event: FocusEvent): void {
    this.suggesting = false
    const next = event.relatedTarget as Node | null
    if (next && this.renderRoot.contains(next)) return
    const words = splitWords((event.target as HTMLInputElement).value)
    if (words.length) this.add(words)
  }

  private onPopoverClose(event: Event): void {
    event.stopPropagation()
    this.suggesting = false
    this.active = -1
  }

  private renderChip(word: string, index: number): TemplateResult {
    const label = this.labelOf(word)
    return html`<li class="lintje-tag-input__item">
      <span class=${classMap({ 'lintje-tag-input__chip': true, 'is-flash': this.flash === word })}
        >${label}${
          this.disabled
            ? nothing
            : html`<button
              type="button"
              class="lintje-tag-input__remove"
              tabindex="-1"
              data-index=${index}
              aria-label=${`${label} verwijderen`}
              @keydown=${(event: KeyboardEvent) => this.onChipKeydown(event, index)}
              @click=${() => this.removeChip(index, 'input')}
            >
              ${renderIcon('functioneel-kruis', { size: 12 })}
            </button>`
        }</span
      >
    </li>`
  }

  private renderSuggestions(): TemplateResult | typeof nothing {
    if (!this.listOpen) return nothing
    return html`<ul
      id=${LIST_ID}
      class="lintje-tag-input__list"
      role="listbox"
      tabindex="-1"
      aria-labelledby=${this.labelId}
    >
      ${this.suggestions.map((option, index) => {
        const [before, match, after] = splitMatch(option.label, this.text)
        return html`<li
          id=${optionId(index)}
          class=${classMap({ 'lintje-tag-input__option': true, 'is-active': index === this.active })}
          role="option"
          aria-selected="false"
          @click=${() => this.add([option.label])}
        >
          ${before}${match ? html`<strong>${match}</strong>` : nothing}${after}
        </li>`
      })}
    </ul>`
  }

  protected override render(): TemplateResult {
    const open = this.listOpen
    const combo = Boolean(this.options)
    return html`<div class="lintje-field">
      ${this.renderLabel(this.controlId)}
      <div
        class=${classMap({
          'lintje-tag-input': true,
          'is-error': Boolean(this.error),
          'is-disabled': this.disabled,
        })}
        role="group"
        aria-labelledby=${this.labelId}
      >
        <ul class="lintje-tag-input__chips">
          ${this.value.map((word, index) => this.renderChip(word, index))}
        </ul>
        <input
          type="text"
          id=${this.controlId}
          class="lintje-tag-input__input"
          .value=${live(this.text)}
          placeholder=${this.value.length ? nothing : this.placeholder || nothing}
          autocomplete="off"
          enterkeyhint="enter"
          role=${combo ? 'combobox' : nothing}
          aria-expanded=${combo ? (open ? 'true' : 'false') : nothing}
          aria-controls=${open ? LIST_ID : nothing}
          aria-autocomplete=${combo ? 'list' : nothing}
          aria-activedescendant=${open && this.active >= 0 ? optionId(this.active) : nothing}
          aria-labelledby=${this.labelId}
          aria-describedby=${this.describedBy === nothing ? KEYS_ID : `${this.describedBy} ${KEYS_ID}`}
          aria-invalid=${this.error ? 'true' : nothing}
          aria-required=${this.required ? 'true' : nothing}
          ?disabled=${this.disabled}
          @input=${this.onInput}
          @keydown=${this.onKeydown}
          @paste=${this.onPaste}
          @blur=${this.onBlur}
        />
      </div>
      <!-- A press in the list, on an option or beside one, keeps the focus in the field. -->
      <lintje-popover
        match-width
        ?open=${open}
        @lintje-close=${this.onPopoverClose}
        @mousedown=${(event: MouseEvent) => event.preventDefault()}
      >
        ${this.renderSuggestions()}
      </lintje-popover>
      <span class="visually-hidden" role="status">${this.news}</span>
      <span id=${KEYS_ID} hidden
        >Enter of een komma voegt een woord toe. Pijl links of Backspace gaat naar de woorden;
        daar verwijdert Backspace of Delete een woord.</span
      >
      ${this.renderFoot()}
    </div>`
  }
}

define('lintje-tag-input', LintjeTagInput)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-tag-input': LintjeTagInput
  }
}
