/**
 * `<lintje-text-input>` — a text field: text, search, password or email.
 *
 * It checks nothing itself: the host sets `error`. It commits on `change` (leaving the field,
 * Enter), since every commit is a URL change and a tile reload, and never commits the same value
 * twice.
 *
 * A fixed text may stand before or after the input (`prefix`, `suffix`) and one button at the end
 * (`action`). A password ignores `action`: its end holds Tonen.
 *
 * Events: `lintje-change` `string`, `lintje-values-change` `{ [name]: value }` (with a `name`),
 * `lintje-reset` (the reset link was pressed), `lintje-action` `string` (the button was pressed,
 * after the typed text was committed).
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import '../../actions/button/button'
import { addonDescribedBy, renderAddon } from '../shared/addon'
import { renderFieldFoot } from '../shared/field-foot'
import { LintjeFormInputElement } from '../shared/input'
import inputCss from '../shared/input.css?inline'
import { Debounce } from '../../shared/debounce'
import textInputCss from './text-input.css?inline'

export type TextInputType = 'text' | 'search' | 'password' | 'email'
/** When a typed value is committed: on leaving the field, or 300 ms after the last key. */
export type CommitOn = 'change' | 'input'

export class LintjeTextInput extends LintjeFormInputElement {
  static override styles = [iconStyles, shadowCss(inputCss), shadowCss(textInputCss)]

  static override properties: PropertyDeclarations = {
    value: { type: String },
    placeholder: { type: String },
    clearable: { type: Boolean },
    stacked: { type: Boolean, reflect: true },
    type: { type: String },
    commitOn: { type: String, attribute: 'commit' },
    autocomplete: { type: String },
    prefix: { type: String },
    suffix: { type: String },
    action: { type: String },
    revealed: { state: true },
  }

  value: string = ''
  placeholder: string = ''
  /** Shows the clear button once there is text. A search always has it. */
  clearable: boolean = false
  stacked: boolean = false
  type: TextInputType = 'text'
  /**
   * The attribute `commit`; `commit()` is the method every input commits through. `input`
   * bundles keystrokes and commits 300 ms after the last.
   */
  commitOn: CommitOn = 'change'
  /** Passed to the native input as is. */
  autocomplete: string = ''
  /** The fixed text before the input, as written ("€", "www."); never part of `value`. */
  override prefix: string | null = null
  /** The fixed text after the input (".nl", "@rijksoverheid.nl"); never part of `value`. */
  declare suffix?: string
  /**
   * The word on the button at the end ("Zoek"). A press commits the typed text as Enter does,
   * then sends `lintje-action`; it works when `readonly`. Ignored for a password.
   */
  declare action?: string
  protected revealed: boolean = false

  private readonly typing = new Debounce(this)

  #committed: string = ''
  #typed: boolean = false

  protected get formValue(): string {
    return this.value
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (changed.has('value') && !this.#typed) this.#committed = this.value
    this.#typed = false
  }

  private send(next: string): void {
    if (next === this.#committed) return
    this.#committed = next
    this.commit(next)
  }

  private onInput(event: Event): void {
    if (this.readonly) return
    this.#typed = true
    this.value = (event.target as HTMLInputElement).value
    if (this.commitOn === 'input') this.typing.schedule(() => this.send(this.value))
  }

  private change(event: Event): void {
    if (this.readonly) return
    this.#typed = true
    this.value = (event.target as HTMLInputElement).value
    if (this.commitOn === 'input') {
      this.typing.flush()
      return
    }
    this.send(this.value)
  }

  private onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && this.commitOn === 'input' && !this.readonly) {
      this.#typed = true
      this.value = (event.target as HTMLInputElement).value
      this.typing.flush()
    }
    this.submitOnEnter(event, () => this.change(event))
    if (event.key === 'Escape' && this.type === 'search' && this.value !== '' && !this.readonly) {
      // Ours, not the browser's: its own clear would race the commit.
      event.preventDefault()
      event.stopPropagation()
      this.clear()
    }
  }

  // Sends nothing when the text was never committed: it was never the host's value.
  private clear(): void {
    if (this.readonly) return
    this.typing.cancel()
    this.value = ''
    this.send('')
    this.nativeControl?.focus()
  }

  private reveal(): void {
    this.revealed = !this.revealed
  }

  // The host acts on a value it was told, so the button commits what was typed first.
  private act(): void {
    this.typing.cancel()
    if (!this.readonly) this.send(this.value)
    this.emit('lintje-action', this.value)
  }

  // A search keeps its hint in the tree: a live region that appears with its text is not read out.
  protected override renderFoot(): TemplateResult | typeof nothing {
    const message = this.error ?? ''
    const ids = { hintId: this.hintId, errorId: this.errorId }
    if (this.type !== 'search') return renderFieldFoot(this.hint, message, ids)
    return html`${message ? renderFieldFoot(undefined, message, ids) : nothing}<span
        id=${this.hintId}
        class="lintje-field__hint"
        aria-live="polite"
        ?hidden=${!this.hint || Boolean(message)}
        >${this.hint ?? ''}</span
      >`
  }

  private get inputType(): string {
    if (this.type === 'password') return this.revealed ? 'text' : 'password'
    return this.type === 'search' || this.type === 'email' ? this.type : 'text'
  }

  protected override render(): TemplateResult {
    const search = this.type === 'search'
    const password = this.type === 'password'
    const action = !password && Boolean(this.action)
    const clearable =
      (this.clearable || search) &&
      !password &&
      this.value !== '' &&
      !this.disabled &&
      !this.readonly
    const addon = { readonly: this.readonly, disabled: this.disabled }
    return html`<div class="lintje-field">
      ${this.renderLabel(this.controlId)}
      <div
        class=${classMap({
          'lintje-text-input': true,
          'lintje-text-input--clearable': clearable,
          'lintje-text-input--search': search,
          'lintje-text-input--password': password,
          'lintje-text-input--button': password || action,
        })}
      >
        <div
          class=${classMap({
            'lintje-text-input__box': true,
            'is-error': Boolean(this.error),
            'is-readonly': this.readonly,
            'is-disabled': this.disabled,
          })}
        >
          ${renderAddon('prefix', this.prefix, addon)}
          <div class="lintje-text-input__entry">
            ${
              search
                ? renderIcon('functioneel-zoek', {
                    size: 18,
                    className: 'lintje-text-input__search',
                  })
                : nothing
            }
            <input
              type=${this.inputType}
              id=${this.controlId}
              class="lintje-text-input__control focus-inset"
              .value=${this.value}
              placeholder=${this.placeholder}
              role=${search ? 'searchbox' : nothing}
              inputmode=${this.type === 'email' ? 'email' : nothing}
              enterkeyhint=${search ? 'search' : nothing}
              autocomplete=${this.autocomplete || nothing}
              aria-labelledby=${this.labelId}
              aria-describedby=${addonDescribedBy(Boolean(this.prefix), Boolean(this.suffix), this.describedBy)}
              aria-invalid=${this.error ? 'true' : nothing}
              aria-required=${this.required ? 'true' : nothing}
              ?required=${this.required}
              ?readonly=${this.readonly}
              ?disabled=${this.disabled}
              @input=${this.onInput}
              @change=${this.change}
              @keydown=${this.onKeydown}
            />
            ${
              clearable
                ? html`<button
                  type="button"
                  class="lintje-text-input__clear"
                  aria-label="Wissen"
                  @mousedown=${(event: MouseEvent) => event.preventDefault()}
                  @click=${this.clear}
                >
                  ${renderIcon('functioneel-kruis', { size: 16 })}
                </button>`
                : nothing
            }
          </div>
          ${renderAddon('suffix', this.suffix, addon)}
        </div>
        ${
          password
            ? html`<lintje-button
              class="lintje-text-input__reveal"
              variant="secondary"
              ?disabled=${this.disabled}
              @click=${this.reveal}
              >${this.revealed ? 'Verbergen' : 'Tonen'}</lintje-button
            >`
            : nothing
        }
        ${
          action
            ? html`<lintje-button
              class="lintje-text-input__action"
              variant="secondary"
              ?disabled=${this.disabled}
              @click=${this.act}
              >${this.action}</lintje-button
            >`
            : nothing
        }
      </div>
      ${this.renderFoot()}
    </div>`
  }
}

define('lintje-text-input', LintjeTextInput)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-text-input': LintjeTextInput
  }
}
