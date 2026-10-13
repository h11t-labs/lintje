/**
 * `<lintje-find>` — a field that finds a word in content already shown, and steps through the hits.
 *
 * It searches nothing itself: the host, or the element around it, counts the hits, sets `total`
 * and `current`, and marks them in its content with `lintje-highlight`. Finding filters nothing.
 * The count and the buttons stand inside the field, so nothing around it moves while typing. A
 * host that counts asynchronously sets `busy` until it knows the total.
 *
 * Events: `lintje-change` `string` (the term, 300 ms after the last key; `''` when cleared),
 * `lintje-values-change` `{ [name]: term }` (with a `name`), `lintje-find-step` `1 | -1` (to the
 * next or the previous hit; the host answers with `current`).
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
import { formatNumber } from '../../../core/format'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import '../../../primitives/spinner/spinner'
import { Debounce } from '../../shared/debounce'
import { LintjeInputElement } from '../shared/input'
import findCss from './find.css?inline'

const COUNT_ID = 'lintje-find-count'

export class LintjeFind extends LintjeInputElement {
  static override styles = [iconStyles, shadowCss(findCss)]

  static override properties: PropertyDeclarations = {
    value: { type: String },
    placeholder: { type: String },
    total: { type: Number },
    current: { type: Number },
    busy: { type: Boolean, reflect: true },
    message: { state: true },
  }

  value: string = ''
  /** Without one, the field shows its label. */
  placeholder: string = ''
  /** The number of hits; `null` while there is no count. */
  total: number | null = null
  /** The current hit, from 1; `0` for none. */
  current: number = 0
  /** The host is still counting: the field says "Zoeken…" and cannot step. */
  busy: boolean = false
  protected message: string = ''

  private readonly typing = new Debounce(this)

  #committed: string = ''
  #typed: boolean = false
  /** A term went to the host: its next count is read out. */
  #asked: boolean = false
  /** The direction of a step the host has not answered yet. */
  #stepped: 1 | -1 | 0 = 0
  #sayFrame = 0

  constructor() {
    super()
    this.label = 'Zoeken in de tekst'
  }

  private get navigable(): boolean {
    return this.value !== '' && !this.busy && !this.disabled && (this.total ?? 0) > 0
  }

  private get countText(): string {
    if (this.busy) return 'Zoeken…'
    if (this.total === null) return ''
    if (this.total === 0) return 'Geen treffers'
    if (this.current > 0) return `${formatNumber(this.current)} van ${formatNumber(this.total)}`
    return this.total === 1 ? '1 treffer' : `${formatNumber(this.total)} treffers`
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (changed.has('value') && !this.#typed) this.#committed = this.value
    this.#typed = false
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    if (this.busy || this.value === '' || this.total === null) return
    if (this.#asked) {
      this.#asked = false
      this.#stepped = 0
      this.say(this.total === 0 ? 'Geen treffers' : this.countText)
      return
    }
    if (!this.#stepped || !changed.has('current') || this.current < 1) return
    const before = changed.get('current') as number | undefined
    const position = `${formatNumber(this.current)} van ${formatNumber(this.total)}`
    const wrapped =
      this.#stepped > 0
        ? before === this.total && this.current === 1
        : before === 1 && this.current === this.total
    this.#stepped = 0
    if (!wrapped) this.say(position)
    else this.say(`Terug bij de ${this.current === 1 ? 'eerste' : 'laatste'} treffer, ${position}`)
  }

  override disconnectedCallback(): void {
    cancelAnimationFrame(this.#sayFrame)
    super.disconnectedCallback()
  }

  // Emptied first: the same words again are no change to a live region.
  private say(text: string): void {
    cancelAnimationFrame(this.#sayFrame)
    this.message = ''
    this.#sayFrame = requestAnimationFrame(() => (this.message = text))
  }

  private send(next: string): void {
    if (next === this.#committed) return
    this.#committed = next
    this.#asked = next !== ''
    this.commit(next)
  }

  private onInput(event: Event): void {
    this.#typed = true
    this.value = (event.target as HTMLInputElement).value
    this.typing.schedule(() => this.send(this.value))
  }

  private onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault()
      // A term not sent yet is sent first: the host still has to count it.
      if (this.typing.pending) this.typing.flush()
      else this.step(event.shiftKey ? -1 : 1)
    }
    if (event.key === 'Escape' && this.value !== '') {
      event.preventDefault()
      event.stopPropagation()
      this.clear()
    }
  }

  private step(direction: 1 | -1): void {
    if (!this.navigable) return
    this.#stepped = direction
    this.emit('lintje-find-step', direction)
  }

  private clear(): void {
    if (this.disabled) return
    this.typing.cancel()
    this.value = ''
    this.message = ''
    this.send('')
    this.focusControl()
  }

  // A press while typing leaves the focus in the field, so Enter goes on; otherwise the button
  // takes it, never the page.
  private keepTyping = (event: MouseEvent): void => {
    const root = this.renderRoot as ShadowRoot
    if (root.activeElement?.id === this.controlId) event.preventDefault()
  }

  // Safari gives a pressed button no focus of its own.
  private holdFocus = (event: MouseEvent): void => {
    const root = this.renderRoot as ShadowRoot
    if (!root.activeElement) (event.currentTarget as HTMLElement).focus()
  }

  private renderButton(
    label: string,
    available: boolean,
    action: () => void,
    icon: TemplateResult | typeof nothing,
    modifier: string,
  ): TemplateResult {
    // `aria-disabled`: a button that stops working under the focus keeps it.
    return html`<button
      type="button"
      class="lintje-find__button lintje-find__button--${modifier}"
      title=${label}
      aria-label=${label}
      aria-disabled=${available ? nothing : 'true'}
      @mousedown=${this.keepTyping}
      @click=${(event: MouseEvent) => {
        this.holdFocus(event)
        if (available) action()
      }}
    >
      ${icon}
    </button>`
  }

  protected override render(): TemplateResult {
    const typed = this.value !== ''
    const navigable = this.navigable
    return html`<div
        class=${classMap({ 'lintje-find': true, 'is-disabled': this.disabled })}
        role="search"
      >
        <label id=${this.labelId} for=${this.controlId} class="visually-hidden">${this.label}</label>
        ${renderIcon('functioneel-zoek', { size: 18, className: 'lintje-find__icon' })}
        <input
          type="search"
          id=${this.controlId}
          class="lintje-find__control"
          .value=${this.value}
          placeholder=${this.placeholder || this.label}
          enterkeyhint="search"
          autocomplete="off"
          aria-describedby=${typed ? COUNT_ID : nothing}
          ?disabled=${this.disabled}
          @input=${this.onInput}
          @keydown=${this.onKeydown}
        />
        ${
          typed
            ? html`<span id=${COUNT_ID} class="lintje-find__count"
                >${this.busy ? html`<lintje-spinner size="16"></lintje-spinner>` : nothing}${this.countText}</span
              >
              <span class="lintje-find__divider" aria-hidden="true"></span>
              ${this.renderButton(
                'Vorige treffer',
                navigable,
                () => this.step(-1),
                renderIcon('functioneel-delta-omlaag', { size: 16, rotate: 180 }),
                'previous',
              )}
              ${this.renderButton(
                'Volgende treffer',
                navigable,
                () => this.step(1),
                renderIcon('functioneel-delta-omlaag', { size: 16 }),
                'next',
              )}
              ${this.renderButton(
                'Zoektekst wissen',
                !this.disabled,
                () => this.clear(),
                renderIcon('functioneel-kruis', { size: 16 }),
                'clear',
              )}`
            : nothing
        }
      </div>
      <p class="visually-hidden" role="status">${this.message}</p>`
  }
}

define('lintje-find', LintjeFind)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-find': LintjeFind
  }
}
