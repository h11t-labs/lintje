/**
 * `<lintje-modal>` — the large window for content: a title, the content and a footer. A question
 * or a short form goes in the small `<lintje-dialog>`.
 *
 * The host holds `open`: Escape, the close button and the scrim only ask. It is `position: fixed`
 * above the app frame, so no ancestor may carry a `transform`, `filter` or `contain`.
 *
 * Events: `lintje-close`, `lintje-download-csv`, `lintje-download-png`.
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { LintjeElement, define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import '../../actions/button/button'
import '../../actions/icon-button/icon-button'
import { DialogHold } from '../../shared/dialog'
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
    footerSlotted: { state: true },
    actionsSlotted: { state: true },
  }

  /** The host owns it; `lintje-close` asks for `false`. */
  open: boolean = false
  /** The dialog's accessible name and its title line; without it the dialog is "Venster". */
  heading: string = ''
  declare subtitle?: string
  /** The footer's CSV and PNG buttons, for content that can be downloaded. */
  csv: boolean = false
  png: boolean = false

  // The footer is hidden, not unrendered, when empty: an unrendered slot never reports again.
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

  readonly #hold = new DialogHold(() => this.close())
  #bodySize: ResizeObserver | null = null

  override disconnectedCallback(): void {
    this.#release()
    super.disconnectedCallback()
  }

  protected override updated(): void {
    if (this.open && !this.#hold.held) this.#open()
    else if (!this.open && this.#hold.held) this.#release()
    if (this.open) this.#fit()
  }

  /**
   * Writes the room the body may take to `--chart-h-expanded`, before the chart first measures:
   * the scrim's height less its padding, the dialog's edge, header and footer and the body's
   * padding. The dialog is as high as its content, so the room never comes from the body itself:
   * a chart that fills it makes the dialog full height, one with a height of its own a lower one.
   */
  #fit(): void {
    const scrim = this.renderRoot.querySelector<HTMLElement>('.lintje-modal__scrim')
    const dialog = this.renderRoot.querySelector<HTMLElement>('.lintje-modal')
    const body = this.renderRoot.querySelector<HTMLElement>('.lintje-modal__body')
    if (!scrim || !dialog || !body) return
    const px = (element: Element, property: string): number =>
      parseFloat(getComputedStyle(element).getPropertyValue(property)) || 0
    const height = (selector: string): number =>
      dialog.querySelector<HTMLElement>(selector)?.offsetHeight ?? 0
    const room =
      scrim.clientHeight -
      px(scrim, 'padding-top') -
      px(scrim, 'padding-bottom') -
      px(dialog, 'border-top-width') -
      px(dialog, 'border-bottom-width') -
      height('.lintje-modal__header') -
      height('.lintje-modal__footer') -
      px(body, 'padding-top') -
      px(body, 'padding-bottom')
    if (room > 0) body.style.setProperty('--chart-h-expanded', `${Math.floor(room)}px`)
    if (!this.#bodySize && typeof ResizeObserver !== 'undefined') {
      this.#bodySize = new ResizeObserver(() => this.#fit())
      this.#bodySize.observe(scrim)
    }
  }

  private close(): void {
    this.emit('lintje-close')
  }

  #open(): void {
    const dialog = this.renderRoot.querySelector<HTMLElement>('.lintje-modal')
    if (!dialog) return
    this.#hold.hold(dialog)
    dialog.focus()
  }

  #release(): void {
    if (!this.#hold.held) return
    this.#bodySize?.disconnect()
    this.#bodySize = null
    this.#hold.release()
  }

  protected override render(): TemplateResult | typeof nothing {
    if (!this.open) return nothing
    return html`<div class="lintje-modal__scrim" @click=${() => this.close()}>
      <div
        class="lintje-modal"
        role="dialog"
        aria-modal="true"
        aria-label=${this.heading.trim() || 'Venster'}
        tabindex="-1"
        @click=${(event: Event) => event.stopPropagation()}
      >
        <header class="lintje-modal__header">
          <div class="lintje-modal__heading">
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
