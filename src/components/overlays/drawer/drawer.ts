/**
 * `<lintje-drawer>` — a side panel over the page, for a detail or a short form.
 *
 * The host holds `open`: Escape, the close button and the scrim only ask. Whether unsaved input
 * needs confirming first is the host's call. While `busy` none of them asks. The footer slot is
 * hidden when empty. A dialog on the shared focus-trap stack; focus goes to the first field,
 * else the close button.
 *
 * Events: `lintje-close` `{ reason: 'escape' | 'button' | 'scrim' }`.
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { LintjeElement, define } from '../../../core/element'
import { lockScroll } from '../../../core/host-config'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import { FocusTrap, tabbables } from '../../shared/focus-trap'
import drawerCss from './drawer.css?inline'
import dialogCloseCss from '../../shared/dialog-close.css?inline'

export type DrawerCloseReason = 'escape' | 'button' | 'scrim'

const FIELD = 'input:not([type="hidden"]), select, textarea'
/** The dialog's name when the host gave no heading. */
const FALLBACK_NAME = 'Zijpaneel'

export class LintjeDrawer extends LintjeElement {
  static override styles = [iconStyles, shadowCss(dialogCloseCss), shadowCss(drawerCss)]

  static override properties: PropertyDeclarations = {
    open: { type: Boolean, reflect: true },
    heading: { type: String },
    subtitle: { type: String },
    busy: { type: Boolean, reflect: true },
    footerSlotted: { state: true },
  }

  /** The host's: the drawer only asks to be closed. */
  open: boolean = false
  /** The title and the dialog's accessible name; without it the dialog is "Zijpaneel". */
  heading: string = ''
  declare subtitle?: string
  /** Saving: every way of closing is blocked. */
  busy: boolean = false
  protected footerSlotted: boolean = false

  #released: (() => void) | null = null
  readonly #trap = new FocusTrap()

  /** Only the dialog on top answers Escape: a confirm dialog over the drawer goes first. */
  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.#trap.isTopmost()) this.close('escape')
  }

  private close(reason: DrawerCloseReason): void {
    if (this.busy) return
    this.emit('lintje-close', { reason })
  }

  private get panel(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.lintje-drawer')
  }

  private onFooterSlotChange(event: Event): void {
    const nodes = (event.target as HTMLSlotElement).assignedNodes({ flatten: true })
    this.footerSlotted = nodes.some(
      (node) => node.nodeType !== Node.TEXT_NODE || (node.textContent ?? '').trim() !== '',
    )
  }

  /** Read once on opening, before the slot exists to report; `slotchange` keeps it current. */
  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (changed.has('open') && this.open) {
      this.footerSlotted = this.querySelector(':scope > [slot="footer"]') !== null
    }
  }

  override disconnectedCallback(): void {
    this.#release()
    super.disconnectedCallback()
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    if (this.open && !this.#released) this.#hold()
    else if (!this.open && this.#released) this.#release()
  }

  private focusFirst(): void {
    const panel = this.panel
    if (!panel) return
    const body = this.renderRoot.querySelector('.lintje-drawer__body')
    const field = body ? tabbables(body).find((element) => element.matches(FIELD)) : undefined
    const close = this.renderRoot.querySelector<HTMLElement>('.lintje-drawer__close')
    ;(field ?? close ?? panel).focus()
  }

  #hold(): void {
    if (import.meta.env?.DEV && !this.heading.trim()) {
      console.warn('<lintje-drawer> has no heading; its dialog is named "Zijpaneel".')
    }
    this.#released = lockScroll()
    document.addEventListener('keydown', this.#onKeyDown)
    const panel = this.panel
    // Activated first so the trap records the opener; focus moves once slotted fields have drawn.
    if (panel) this.#trap.activate(panel, { focus: false })
    const drawn = Array.from(this.querySelectorAll('*'), (element) =>
      'updateComplete' in element ? (element.updateComplete as Promise<unknown>) : null,
    ).filter((promise) => promise !== null)
    void Promise.all(drawn).then(() => {
      if (this.open && this.#trap.isTopmost()) this.focusFirst()
    })
  }

  #release(): void {
    if (!this.#released) return
    document.removeEventListener('keydown', this.#onKeyDown)
    this.#released()
    this.#released = null
    this.#trap.deactivate()
  }

  protected override render(): TemplateResult | typeof nothing {
    if (!this.open) return nothing
    const named = this.heading.trim() !== ''
    return html`<div class="lintje-drawer__scrim" @click=${() => this.close('scrim')}></div>
      <div
        class="lintje-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby=${named ? 'lintje-drawer-title' : nothing}
        aria-label=${named ? nothing : FALLBACK_NAME}
        aria-busy=${this.busy ? 'true' : nothing}
        tabindex="-1"
      >
        <header class="lintje-drawer__header">
          <div class="lintje-drawer__heading">
            ${
              named
                ? html`<h2 id="lintje-drawer-title" class="lintje-drawer__title">${this.heading}</h2>`
                : nothing
            }
            ${
              this.subtitle
                ? html`<p class="lintje-drawer__subtitle">${this.subtitle}</p>`
                : nothing
            }
          </div>
          <button
            type="button"
            class="lintje-dialog-close lintje-drawer__close"
            aria-label="Sluiten"
            aria-disabled=${this.busy ? 'true' : nothing}
            @click=${() => this.close('button')}
          >
            ${renderIcon('functioneel-kruis', { size: 16 })}
          </button>
        </header>
        <div class="lintje-drawer__body"><slot></slot></div>
        <footer class="lintje-drawer__footer" ?hidden=${!this.footerSlotted}>
          <slot name="footer" @slotchange=${this.onFooterSlotChange}></slot>
        </footer>
      </div>`
  }
}

define('lintje-drawer', LintjeDrawer)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-drawer': LintjeDrawer
  }
}
