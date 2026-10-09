/**
 * `<lintje-confirm-dialog>` — a question that needs an answer before anything goes on.
 *
 * The owner holds `open`; Escape, the scrim and cancel only ask (`lintje-close`). The cancel
 * button has the focus on open, so Enter never confirms by itself. While `busy` nothing closes.
 * A dialog on the shared focus-trap stack.
 *
 * Events: `lintje-confirm`, `lintje-close` `{ reason: 'cancel' | 'escape' | 'scrim' }`,
 * `lintje-action` from the third button.
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
import { MediaController, MOBILE } from '../../../core/media'
import { shadowCss } from '../../../core/styles'
import { FocusTrap, focusTarget } from '../../shared/focus-trap'
import '../../../primitives/button/button'
import type { LintjeButton } from '../../../primitives/button/button'
import confirmDialogCss from './confirm-dialog.css?inline'

export type ConfirmTone = 'danger' | 'primary'
export type ConfirmCloseReason = 'cancel' | 'escape' | 'scrim'

export class LintjeConfirmDialog extends LintjeElement {
  static override styles = shadowCss(confirmDialogCss)

  static override properties: PropertyDeclarations = {
    open: { type: Boolean, reflect: true },
    heading: { type: String },
    confirmLabel: { type: String, attribute: 'confirm-label' },
    cancelLabel: { type: String, attribute: 'cancel-label' },
    actionLabel: { type: String, attribute: 'action-label' },
    tone: { type: String, reflect: true },
    busy: { type: Boolean, reflect: true },
  }

  /** The owner's: the dialog asks to be closed and never closes itself. */
  open: boolean = false
  /** The question, and the dialog's accessible name. */
  heading: string = ''
  /** The verb of the action ("Verwijderen"), never "OK". */
  confirmLabel: string = 'Bevestigen'
  cancelLabel: string = 'Annuleren'
  /** A third, tertiary button in front ("Weggooien"). */
  declare actionLabel?: string
  tone: ConfirmTone = 'danger'
  /** The confirmed action is under way: nothing else can be pressed, Escape does nothing. */
  busy: boolean = false

  readonly #mobile = new MediaController(this, MOBILE)
  #released: (() => void) | null = null
  readonly #trap = new FocusTrap()

  /** Only the dialog on top answers Escape. */
  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.#trap.isTopmost()) this.cancel('escape')
  }

  private cancel(reason: ConfirmCloseReason): void {
    if (this.busy) return
    this.emit('lintje-close', { reason })
  }

  override disconnectedCallback(): void {
    this.#release()
    super.disconnectedCallback()
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    if (this.open && !this.#released) void this.#hold()
    else if (!this.open && this.#released) this.#release()
  }

  async #hold(): Promise<void> {
    this.#released = lockScroll()
    document.addEventListener('keydown', this.#onKeyDown)
    const frame = this.renderRoot.querySelector<HTMLElement>('.lintje-confirm-dialog')
    if (!frame) return
    // Activated first so the trap records the opener; the safe button takes focus once drawn.
    this.#trap.activate(frame, { focus: false })
    const safe = this.renderRoot.querySelector<LintjeButton>('.lintje-confirm-dialog__cancel')
    if (!safe) return
    await safe.updateComplete
    if (this.open && this.#trap.isTopmost()) focusTarget(safe).focus()
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
    const block = this.#mobile.matches
    return html`<div class="lintje-confirm-dialog__scrim" @click=${() => this.cancel('scrim')}>
      <div
        class="lintje-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="lintje-confirm-dialog-heading"
        aria-describedby="lintje-confirm-dialog-text"
        tabindex="-1"
        @click=${(event: Event) => event.stopPropagation()}
      >
        <h2 id="lintje-confirm-dialog-heading" class="lintje-confirm-dialog__heading">
          ${this.heading}
        </h2>
        <div id="lintje-confirm-dialog-text" class="lintje-confirm-dialog__text">
          <slot></slot>
        </div>
        <div class="lintje-confirm-dialog__actions">
          ${
            this.actionLabel
              ? html`<lintje-button
                class="lintje-confirm-dialog__action"
                variant="tertiary"
                ?block=${block}
                ?disabled=${this.busy}
                @click=${() => this.emit('lintje-action')}
                >${this.actionLabel}</lintje-button
              >`
              : nothing
          }
          <lintje-button
            class="lintje-confirm-dialog__cancel"
            variant="secondary"
            ?block=${block}
            ?disabled=${this.busy}
            @click=${() => this.cancel('cancel')}
            >${this.cancelLabel}</lintje-button
          >
          <lintje-button
            class="lintje-confirm-dialog__confirm"
            variant=${this.tone === 'primary' ? 'primary' : 'danger'}
            ?block=${block}
            ?busy=${this.busy}
            @click=${() => this.emit('lintje-confirm')}
            >${this.confirmLabel}</lintje-button
          >
        </div>
      </div>
    </div>`
  }
}

define('lintje-confirm-dialog', LintjeConfirmDialog)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-confirm-dialog': LintjeConfirmDialog
  }
}
