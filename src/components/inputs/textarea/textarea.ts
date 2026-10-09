/**
 * `<lintje-textarea>` — the multi-line text field: three to twelve lines (`rows` sets the least),
 * with a counter when there is a `maxlength`. `variant="plain"` drops the field's box and its
 * focus ring, takes the type of where it stands and fills its height, for a surface that frames
 * the text and draws the ring itself (`lintje-translator`). Typing past the limit is allowed (a paste lands whole); the field
 * shows the error, alerted once as the text crosses the limit. The counter is read out from 90 %
 * of the limit on.
 *
 * The counter is `part="counter"`, so a surface can stand it on its own line.
 *
 * Commits like `lintje-text-input`; Ctrl+Enter commits and submits a host's form.
 * Events: `lintje-change`, and `lintje-values-change` with a `name`.
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
import { styleProps } from '../../../core/style-props'
import { iconStyles } from '../../../icons/render'
import { footDescribedBy, renderFieldFoot } from '../shared/field-foot'
import { LintjeFormInputElement } from '../shared/input'
import inputCss from '../shared/input.css?inline'
import { Debounce } from '../../shared/debounce'
import type { CommitOn } from '../text-input/text-input'
import textareaCss from './textarea.css?inline'

const COUNT = new Intl.NumberFormat('nl-NL')

export function counterText(length: number, limit: number): string {
  return `${COUNT.format(length)} / ${COUNT.format(limit)} tekens`
}

export function limitMessage(length: number, limit: number | undefined): string {
  if (!limit || length <= limit) return ''
  const over = length - limit
  return `Maak de tekst ${COUNT.format(over)} ${over === 1 ? 'teken' : 'tekens'} korter`
}

export function counterSpeaks(length: number, limit: number): boolean {
  return length >= limit * 0.9
}

export type TextareaVariant = 'field' | 'plain'

const growsItself =
  typeof CSS !== 'undefined' && typeof CSS.supports === 'function'
    ? CSS.supports('field-sizing', 'content')
    : false

export class LintjeTextarea extends LintjeFormInputElement {
  static override styles = [iconStyles, shadowCss(inputCss), shadowCss(textareaCss)]

  static override properties: PropertyDeclarations = {
    value: { type: String },
    placeholder: { type: String },
    maxlength: { type: Number },
    commitOn: { type: String, attribute: 'commit' },
    stacked: { type: Boolean, reflect: true },
    rows: { type: Number },
    variant: { type: String, reflect: true },
  }

  value: string = ''
  placeholder: string = ''
  /** The limit the counter counts to. */
  declare maxlength?: number
  /** The attribute `commit`; `commit()` is the method every input commits through. */
  commitOn: CommitOn = 'change'
  stacked: boolean = false
  /** The least number of lines the field shows. */
  rows: number = 3
  /** `field` (default): the bordered field; `plain`: no box, the type of where it stands. */
  variant: TextareaVariant = 'field'

  private readonly typing = new Debounce(this)

  #committed: string = ''
  #typed: boolean = false
  // The limit message is alerted once, as the text crosses the limit; after that the counter
  // speaks, so a key does not interrupt the reader with a new sentence.
  #over: boolean = false
  #alertLimit: boolean = false

  private get counterId(): string {
    return 'lintje-textarea-counter'
  }

  private get control(): HTMLTextAreaElement | null {
    return this.renderRoot.querySelector<HTMLTextAreaElement>('.lintje-textarea__control')
  }

  protected get formValue(): string {
    return this.value
  }

  private get message(): string {
    return this.error || limitMessage(this.value.length, this.maxlength)
  }

  protected override get footMessage(): string {
    return this.message
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (changed.has('value') && !this.#typed) this.#committed = this.value
    this.#typed = false
    const over = !this.error && limitMessage(this.value.length, this.maxlength) !== ''
    this.#alertLimit = over && !this.#over
    this.#over = over
  }

  private send(next: string): void {
    if (next === this.#committed) return
    this.#committed = next
    this.commit(next)
  }

  private take(event: Event): void {
    this.#typed = true
    this.value = (event.target as HTMLTextAreaElement).value
  }

  private onInput(event: Event): void {
    if (this.readonly) return
    this.take(event)
    if (this.commitOn === 'input') this.typing.schedule(() => this.send(this.value))
  }

  private onChange(event: Event): void {
    if (this.readonly) return
    this.take(event)
    if (this.commitOn === 'input') {
      this.typing.flush()
      return
    }
    this.send(this.value)
  }

  private onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey) || this.readonly) return
    // The value is in before a form that hears the same key reads it.
    this.submitOnEnter(event, () => {
      this.take(event)
      if (this.commitOn === 'input') this.typing.flush()
      else this.send(this.value)
    })
  }

  // Without `field-sizing: content` the height is set here; the stylesheet caps it.
  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    if (growsItself || !changed.has('value')) return
    const area = this.control
    if (!area || !area.isConnected) return
    area.style.height = 'auto'
    area.style.height = `${area.scrollHeight + area.offsetHeight - area.clientHeight}px`
  }

  protected override get describedBy(): string | typeof nothing {
    const own = footDescribedBy(this.hint, this.footMessage, {
      hintId: this.hintId,
      errorId: this.errorId,
    })
    const ids = [own === nothing ? '' : own, this.counterShown ? this.counterId : '']
    const joined = ids.filter(Boolean).join(' ')
    return joined || nothing
  }

  private get counterShown(): boolean {
    return Boolean(this.maxlength) && !this.disabled
  }

  protected override renderFoot(): TemplateResult | typeof nothing {
    const foot = renderFieldFoot(
      this.hint,
      this.footMessage,
      { hintId: this.hintId, errorId: this.errorId },
      !this.#over || this.#alertLimit,
    )
    if (!this.counterShown) return foot
    const limit = this.maxlength!
    const length = this.value.length
    return html`${foot}<span
        id=${this.counterId}
        part="counter"
        class=${classMap({ 'lintje-textarea__counter': true, 'is-over': length > limit })}
        aria-live=${counterSpeaks(length, limit) ? 'polite' : 'off'}
        >${counterText(length, limit)}</span
      >`
  }

  protected override render(): TemplateResult {
    const message = this.message
    return html`<div class="lintje-field">
      ${this.renderLabel(this.controlId)}
      <textarea
        id=${this.controlId}
        class=${classMap({
          'lintje-textarea__control': true,
          'lintje-textarea__control--plain': this.variant === 'plain',
          'is-error': Boolean(message),
          'is-readonly': this.readonly,
        })}
        rows=${this.rows}
        ${styleProps({ '--lintje-rows': this.rows })}
        .value=${this.value}
        placeholder=${this.placeholder || nothing}
        aria-labelledby=${this.labelId}
        aria-describedby=${this.describedBy}
        aria-invalid=${message ? 'true' : nothing}
        aria-required=${this.required ? 'true' : nothing}
        ?required=${this.required}
        ?readonly=${this.readonly}
        ?disabled=${this.disabled}
        @input=${this.onInput}
        @change=${this.onChange}
        @keydown=${this.onKeydown}
      ></textarea>
      ${this.renderFoot()}
    </div>`
  }
}

define('lintje-textarea', LintjeTextarea)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-textarea': LintjeTextarea
  }
}
