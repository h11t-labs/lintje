/**
 * `<lintje-toast>` — the toast: a glyph carries the meaning, so colour is not the only signal
 * (rule 13). An error, and a toast with an action, stay until closed. A plain `ok` toast closes
 * after six seconds; the pointer on it or the focus in it holds it, and its six seconds start
 * again when both have left. Closing with the focus inside, it gives the focus back first.
 *
 * It is a `role="status"` region drawn empty first, its content going in on the next frame: a
 * region that arrives together with its text is not announced, one that is filled is.
 *
 * Events: `lintje-close` (timed out or closed), `lintje-action`. The host owns whether it exists.
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { LintjeElement, define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { holdsFocus } from '../../../core/focus'
import { iconStyles, renderIcon } from '../../../icons/render'
import { deepActiveElement, ownsEscape } from '../../shared/focus-trap'
import toastCss from './toast.css?inline'

const LIFETIME = 6000

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
  static override styles = [iconStyles, shadowCss(toastCss)]

  static override properties: PropertyDeclarations = {
    kind: { type: String, reflect: true },
    action: { type: String },
    filled: { state: true },
  }

  /** `ok` closes itself after six seconds, unless it has an action; `error` stays. */
  kind: 'ok' | 'error' = 'ok'
  /** The label of the one action, e.g. "Ongedaan maken". Without it there is none. */
  declare action?: string

  filled: boolean = false

  #hovered = false
  #focused = false
  #timer = 0
  #fillFrame = 0
  /** The last element outside the toast that had the focus: where it goes back to. */
  #before: HTMLElement | null = null

  /** Not while the focus is in a dialog: that Escape is the dialog's. */
  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && ownsEscape(this)) this.#close()
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
  }

  override connectedCallback(): void {
    super.connectedCallback()
    document.addEventListener('keydown', this.#onKeyDown)
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
    document.removeEventListener('keydown', this.#onKeyDown)
    document.removeEventListener('focusin', this.#onFocusIn)
    clearTimeout(this.#timer)
    if (this.#fillFrame) cancelAnimationFrame(this.#fillFrame)
    this.#fillFrame = 0
    super.disconnectedCallback()
  }

  protected override updated(changed: Map<string, unknown>): void {
    if (changed.has('kind') || changed.has('action')) this.#start()
  }

  /** The six seconds, from the start; never for an error, an action or a held toast. */
  #start(): void {
    clearTimeout(this.#timer)
    if (this.kind === 'error' || this.action || this.#hovered || this.#focused) return
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
          this.kind === 'ok' ? 'functioneel-cirkel-vinkje' : 'functioneel-foutmelding',
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
