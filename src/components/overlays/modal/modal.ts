/**
 * `<lintje-modal>` — the expand modal: title, subtitle, slotted content, a footer.
 *
 * It is `position: fixed` above the app frame, so no ancestor may carry a `transform`, `filter`
 * or `contain`. The footer is hidden, not unrendered, when empty: an unrendered slot never
 * reports its content again.
 *
 * `narrow` makes it a dialog with a form: as high as its content and as wide as a form reads,
 * with a sentence in `footer` on the left and its buttons in `actions` on the right.
 *
 * Events: `lintje-close` (the host owns `open`), `lintje-download-csv`, `lintje-download-png`.
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { LintjeElement, define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { lockScroll } from '../../../core/host-config'
import { iconStyles, renderIcon } from '../../../icons/render'
import '../../../primitives/button/button'
import '../../../primitives/icon-button/icon-button'
import { FocusTrap } from '../../shared/focus-trap'
import modalCss from './modal.css?inline'
import dialogCloseCss from '../../shared/dialog-close.css?inline'

export class LintjeModal extends LintjeElement {
  static override styles = [iconStyles, shadowCss(dialogCloseCss), shadowCss(modalCss)]

  static override properties: PropertyDeclarations = {
    open: { type: Boolean, reflect: true },
    heading: { type: String },
    subtitle: { type: String },
    csv: { type: Boolean },
    png: { type: Boolean },
    narrow: { type: Boolean, reflect: true },
    footerSlotted: { state: true },
    actionsSlotted: { state: true },
  }

  /** The host owns it; `lintje-close` asks for `false`. */
  open: boolean = false
  /** The dialog's accessible name and its title line. */
  heading: string = 'Vergroot'
  declare subtitle?: string
  /** The footer's CSV and PNG buttons. Default `true`: bind as a property, `.csv=${false}`. */
  csv: boolean = true
  png: boolean = true
  /** A dialog with a form: its content's height, a form's width. */
  narrow: boolean = false

  footerSlotted: boolean = false
  actionsSlotted: boolean = false

  private onActionsSlotChange(event: Event): void {
    this.actionsSlotted =
      (event.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0
  }

  private onFooterSlotChange(event: Event): void {
    const nodes = (event.target as HTMLSlotElement).assignedNodes({ flatten: true })
    this.footerSlotted = nodes.some(
      (node) => node.nodeType !== Node.TEXT_NODE || (node.textContent ?? '').trim() !== '',
    )
  }

  #released: (() => void) | null = null
  readonly #trap = new FocusTrap()
  #bodySize: ResizeObserver | null = null

  /** Escape closes the dialog on top only: a modal opened over a drawer goes first. */
  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.#trap.isTopmost()) this.close()
  }

  override disconnectedCallback(): void {
    this.#release()
    super.disconnectedCallback()
  }

  protected override updated(): void {
    if (this.open && !this.#released) this.#hold()
    else if (!this.open && this.#released) this.#release()
    if (this.open) this.#fit()
  }

  /** Writes the body's inner height to `--chart-h-expanded`, before the chart first measures. */
  #fit(): void {
    const body = this.renderRoot.querySelector<HTMLElement>('.lintje-modal__body')
    if (!body) return
    const style = getComputedStyle(body)
    const inner = body.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
    if (inner > 0) body.style.setProperty('--chart-h-expanded', `${Math.floor(inner)}px`)
    if (!this.#bodySize && typeof ResizeObserver !== 'undefined') {
      this.#bodySize = new ResizeObserver(() => this.#fit())
      this.#bodySize.observe(body)
    }
  }

  private close(): void {
    this.emit('lintje-close')
  }

  #hold(): void {
    this.#released = lockScroll()
    document.addEventListener('keydown', this.#onKeyDown)
    const dialog = this.renderRoot.querySelector<HTMLElement>('.lintje-modal')
    if (dialog) this.#trap.activate(dialog)
  }

  #release(): void {
    if (!this.#released) return
    this.#bodySize?.disconnect()
    this.#bodySize = null
    document.removeEventListener('keydown', this.#onKeyDown)
    this.#released()
    this.#released = null
    this.#trap.deactivate()
  }

  protected override render(): TemplateResult | typeof nothing {
    if (!this.open) return nothing
    return html`<div class="lintje-modal__scrim" @click=${() => this.close()}>
      <div
        class="lintje-modal"
        role="dialog"
        aria-modal="true"
        aria-label=${this.heading}
        tabindex="-1"
        @click=${(event: Event) => event.stopPropagation()}
      >
        <header class="lintje-modal__header">
          <div>
            <h2 class="lintje-modal__title">${this.heading}</h2>
            ${
              this.subtitle ? html`<p class="lintje-modal__subtitle">${this.subtitle}</p>` : nothing
            }
          </div>
          <button
            type="button"
            class="lintje-dialog-close lintje-modal__close"
            aria-label="Sluiten"
            @click=${() => this.close()}
          >
            ${renderIcon('functioneel-kruis', { size: 16 })}
          </button>
        </header>

        <div class="lintje-modal__body"><slot></slot></div>

        <footer
          class="lintje-modal__footer"
          ?hidden=${!this.csv && !this.png && !this.footerSlotted && !this.actionsSlotted}
        >
          <span><slot name="footer" @slotchange=${this.onFooterSlotChange}></slot></span>
          <div class="lintje-modal__actions" ?hidden=${!this.csv && !this.png && !this.actionsSlotted}>
            <slot name="actions" @slotchange=${this.onActionsSlotChange}></slot>
          ${
            this.csv || this.png
              ? html`
                ${
                  this.csv
                    ? html`<lintje-button
                      variant="tertiary"
                      size="compact"
                      icon="functioneel-downloaden"
                      @click=${() => this.emit('lintje-download-csv')}
                      >CSV</lintje-button
                    >`
                    : nothing
                }
                ${
                  this.png
                    ? html`<lintje-button
                      variant="tertiary"
                      size="compact"
                      icon="functioneel-downloaden"
                      @click=${() => this.emit('lintje-download-png')}
                      >PNG</lintje-button
                    >`
                    : nothing
                }`
              : nothing
          }
          </div>
        </footer>
      </div>
    </div>`
  }
}

define('lintje-modal', LintjeModal)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-modal': LintjeModal
  }
}
