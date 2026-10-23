/**
 * `<lintje-toast>` — a short message about what just happened; a glyph carries its meaning.
 *
 * The host owns whether it exists. A toast that closes by itself is held while the pointer is on
 * it or the focus in it, and its six seconds start again when both have left. Closing with the
 * focus inside, it gives the focus back first.
 *
 * Events: `lintje-close` (timed out or closed), `lintje-action` (its action was pressed).
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { LintjeElement, define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { holdsFocus } from '../../../core/focus'
import { iconStyles, renderIcon } from '../../../icons/render'
import { deepActiveElement } from '../../shared/focus-trap'
import { TONE_ICON, TONE_ICON_COLOURED, type Tone } from '../../shared/tone'
import toastCss from './toast.css?inline'
import screenOnlyCss from '../../shared/screen-only.css?inline'

const LIFETIME = 6000

export type ToastKind = 'ok' | 'error' | 'info' | 'warning'

const KIND_TONE: Record<ToastKind, Tone> = {
  ok: 'success',
  error: 'error',
  info: 'info',
  warning: 'attention',
}

/** The nearest `<main>` from the toast outwards, through the shadow roots around it. */
function mainRegion(from: Node): HTMLElement | null {
  for (let root = from.getRootNode(); ;) {
    const main = (root as ParentNode).querySelector?.<HTMLElement>('main')
    if (main) return main
    if (!(root instanceof ShadowRoot)) return null
    root = root.host.getRootNode()
  }
}

export class LintjeToast extends LintjeElement {
  static override styles = [iconStyles, shadowCss(toastCss), shadowCss(screenOnlyCss)]

  static override properties: PropertyDeclarations = {
    kind: { type: String, reflect: true },
    action: { type: String },
    filled: { state: true },
  }

  /** `ok` and `info` close after six seconds unless they have an action; `error` and `warning` stay. */
  kind: ToastKind = 'ok'
  /** The label of the one action, e.g. "Ongedaan maken". Without it there is none. */
  declare action?: string

  filled: boolean = false

  #hovered = false
  #focused = false
  #timer = 0
  #fillFrame = 0
  /** The last element outside the toast that had the focus: where it goes back to. */
  #before: HTMLElement | null = null

  /** An Escape elsewhere is not the toast's; its own goes no further, so a window around stays. */
  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || event.defaultPrevented) return
    event.stopPropagation()
    this.#close()
  }

  readonly #onFocusIn = (): void => {
    const inside = holdsFocus(this)
    if (!inside) this.#before = deepActiveElement()
    this.#hold('focus', inside)
  }

  readonly #onFocusOut = (event: FocusEvent): void => {
    const next = event.relatedTarget as Node | null
    if (next && (next === this || this.contains(next))) return
    this.#hold('focus', false)
  }

  constructor() {
    super()
    this.addEventListener('focusout', this.#onFocusOut)
    this.addEventListener('keydown', this.#onKeyDown)
  }

  override connectedCallback(): void {
    super.connectedCallback()
    document.addEventListener('focusin', this.#onFocusIn)
    this.#before = deepActiveElement()
    this.#start()
    if (!this.filled && !this.#fillFrame) {
      this.#fillFrame = requestAnimationFrame(() => {
        this.#fillFrame = 0
        this.filled = true
      })
    }
  }

  override disconnectedCallback(): void {
    document.removeEventListener('focusin', this.#onFocusIn)
    clearTimeout(this.#timer)
    if (this.#fillFrame) cancelAnimationFrame(this.#fillFrame)
    this.#fillFrame = 0
    super.disconnectedCallback()
  }

  protected override updated(changed: Map<string, unknown>): void {
    if (changed.has('kind') || changed.has('action')) this.#start()
  }

  /** The six seconds, from the start; never for an error, a warning, an action or a held toast. */
  #start(): void {
    clearTimeout(this.#timer)
    if (
      this.kind === 'error' ||
      this.kind === 'warning' ||
      this.action ||
      this.#hovered ||
      this.#focused
    )
      return
    this.#timer = window.setTimeout(() => this.#close(), LIFETIME)
  }

  #hold(by: 'pointer' | 'focus', held: boolean): void {
    const was = this.#hovered || this.#focused
    if (by === 'pointer') this.#hovered = held
    else this.#focused = held
    const now = this.#hovered || this.#focused
    if (now) clearTimeout(this.#timer)
    else if (was) this.#start()
  }

  /** Gives the focus back, else to the page's `<main>`, before the host removes the toast. */
  #close(): void {
    if (holdsFocus(this)) {
      const before = this.#before
      const back = before?.isConnected && before !== document.body ? before : mainRegion(this)
      back?.focus()
    }
    this.emit('lintje-close')
  }

  protected override render(): TemplateResult {
    return html`<div
      class="lintje-toast lintje-toast--${this.kind}"
      role="status"
      aria-live="polite"
      @mouseenter=${() => this.#hold('pointer', true)}
      @mouseleave=${() => this.#hold('pointer', false)}
    >
      ${this.filled ? this.content() : nothing}
    </div>`
  }

  /** The mark, the message, the action and the close: what goes into the region. */
  private content(): TemplateResult {
    return html`<span class="lintje-toast__icon" aria-hidden="true"
        >${renderIcon(
          (this.resolvedStyle === 'new' ? TONE_ICON_COLOURED : TONE_ICON)[KIND_TONE[this.kind]],
          {
            size: 16,
          },
        )}</span
      >
      <span class="lintje-toast__text"><slot></slot></span>
      ${
        this.action
          ? html`<button
            type="button"
            class="lintje-toast__action"
            @click=${() => this.emit('lintje-action')}
          >
            ${this.action}
          </button>`
          : nothing
      }
      <button
        type="button"
        class="lintje-toast__close"
        aria-label="Melding sluiten"
        @click=${() => this.#close()}
      >
        ${renderIcon('functioneel-kruis', { size: 16 })}
      </button>`
  }
}

define('lintje-toast', LintjeToast)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-toast': LintjeToast
  }
}
