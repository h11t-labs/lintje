/**
 * `<lintje-dialog>` — the small window: a question that needs an answer, or a short form. The
 * large window for content is `<lintje-modal>`.
 *
 * The owner holds `open`; Escape, the scrim and the close button only ask (`lintje-close`).
 * `alert` makes it an `alertdialog` without a close button, described by its text. `persistent`
 * asks nothing on Escape or the scrim: only its buttons answer. While `busy` nothing asks, the
 * last primary or danger button in `actions` turns busy and the others disabled.
 *
 * The focus goes to the slotted element with `autofocus`; without one to the first field, and
 * in an alert to the window itself, so Enter never confirms by itself. Below 768 px the buttons
 * stack with the last on top: the host puts the safe one first.
 *
 * Events: `lintje-close` `{ reason: 'escape' | 'scrim' | 'button' }`.
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { LintjeElement, define } from '../../../core/element'
import { MediaController, MOBILE } from '../../../core/media'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import { AttributeHold, PropertyHold } from '../../forms/form/controls'
import { DialogHold } from '../../shared/dialog'
import { focusTarget, tabbables } from '../../shared/focus-trap'
import dialogCss from './dialog.css?inline'
import dialogCloseCss from '../../shared/dialog-close.css?inline'

export type DialogCloseReason = 'escape' | 'scrim' | 'button'

// A field to type in: a checkbox or a switch first would turn on a stray Space.
const FIELD =
  'input:not([type="hidden"], [type="checkbox"], [type="radio"]), select, textarea, [contenteditable]'

/** Whether a slot holds anything but white space. */
function filled(slot: HTMLSlotElement): boolean {
  return slot
    .assignedNodes({ flatten: true })
    .some((node) => node.nodeType !== Node.TEXT_NODE || (node.textContent ?? '').trim() !== '')
}

export class LintjeDialog extends LintjeElement {
  static override styles = [iconStyles, shadowCss(dialogCloseCss), shadowCss(dialogCss)]

  static override properties: PropertyDeclarations = {
    open: { type: Boolean, reflect: true },
    heading: { type: String },
    alert: { type: Boolean, reflect: true },
    persistent: { type: Boolean, reflect: true },
    wide: { type: Boolean, reflect: true },
    busy: { type: Boolean, reflect: true },
    footerSlotted: { state: true },
  }

  /** The owner's: the dialog asks to be closed and never closes itself. */
  open: boolean = false
  /** The question or the task, and the dialog's accessible name. */
  heading: string = ''
  /** A question that needs an answer: an `alertdialog`, without a close button. */
  alert: boolean = false
  /** Escape and the scrim ask nothing, for a question that must be answered. */
  persistent: boolean = false
  /** As wide as a short form reads, instead of a question. */
  wide: boolean = false
  /** The answer is under way: nothing asks to close, the buttons wait. */
  busy: boolean = false
  protected footerSlotted: boolean = false

  readonly #mobile = new MediaController(this, MOBILE)
  readonly #hold = new DialogHold(() => this.ask('escape'))
  readonly #busy = new PropertyHold('busy')
  readonly #disabled = new PropertyHold('disabled')
  readonly #block = new AttributeHold('block')

  private ask(reason: DialogCloseReason): void {
    if (this.busy || (this.persistent && reason !== 'button')) return
    this.emit('lintje-close', { reason })
  }

  private get frame(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.lintje-dialog')
  }

  private get buttons(): HTMLElement[] {
    return Array.from(this.querySelectorAll<HTMLElement>(':scope > [slot="actions"]'))
  }

  /** Read once on opening, before the slots exist to report; `slotchange` keeps it current. */
  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (changed.has('open') && this.open) {
      this.footerSlotted =
        this.querySelector(':scope > [slot="footer"], :scope > [slot="actions"]') !== null
    }
  }

  override disconnectedCallback(): void {
    this.#release()
    super.disconnectedCallback()
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    if (this.open && !this.#hold.held) this.#open()
    else if (!this.open && this.#hold.held) this.#release()
    this.#holdButtons()
  }

  #open(): void {
    const frame = this.frame
    if (!frame) return
    this.#hold.hold(frame)
    // The focus moves once the slotted buttons and fields have drawn their own roots.
    const drawn = Array.from(this.querySelectorAll('*'), (element) =>
      'updateComplete' in element ? (element.updateComplete as Promise<unknown>) : null,
    ).filter((promise) => promise !== null)
    void Promise.all(drawn).then(() => {
      if (this.open && this.#hold.isTopmost()) this.#focusFirst()
    })
  }

  #focusFirst(): void {
    const frame = this.frame
    if (!frame) return
    const chosen = this.querySelector<HTMLElement>('[autofocus]')
    if (chosen) return focusTarget(chosen).focus()
    if (this.alert) return frame.focus()
    const body = this.renderRoot.querySelector('.lintje-dialog__body')
    const field = body ? tabbables(body).find((element) => element.matches(FIELD)) : undefined
    const close = this.renderRoot.querySelector<HTMLElement>('.lintje-dialog__close')
    ;(field ?? close ?? frame).focus()
  }

  #release(): void {
    this.#hold.release()
    this.#busy.release()
    this.#disabled.release()
    this.#block.release()
  }

  #holdButtons(): void {
    if (!this.open) return
    const buttons = this.buttons
    if (this.busy) {
      const answers = buttons.filter((button) =>
        ['primary', 'danger'].includes(button.getAttribute('variant') ?? ''),
      )
      const answer = answers.at(-1) ?? buttons.at(-1)
      this.#busy.apply(answer ? [answer] : [], true)
      this.#disabled.apply(
        buttons.filter((button) => button !== answer),
        true,
      )
    } else {
      this.#busy.release()
      this.#disabled.release()
    }
    if (this.#mobile.matches) this.#block.apply(buttons, true)
    else this.#block.release()
  }

  private onSlotChange(): void {
    const slots = this.renderRoot.querySelectorAll<HTMLSlotElement>('slot[name]')
    this.footerSlotted = Array.from(slots).some(filled)
    this.#holdButtons()
  }

  protected override render(): TemplateResult | typeof nothing {
    if (!this.open) return nothing
    return html`<div class="lintje-dialog__scrim" @click=${() => this.ask('scrim')}>
      <div
        class="lintje-dialog"
        role=${this.alert ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby="lintje-dialog-heading"
        aria-describedby=${this.alert ? 'lintje-dialog-text' : nothing}
        aria-busy=${this.busy ? 'true' : nothing}
        tabindex="-1"
        @click=${(event: Event) => event.stopPropagation()}
      >
        <header class="lintje-dialog__header">
          <h2 id="lintje-dialog-heading" class="lintje-dialog__heading">${this.heading}</h2>
          ${
            this.alert
              ? nothing
              : html`<button
                type="button"
                class="lintje-dialog-close lintje-dialog__close"
                aria-label="Sluiten"
                aria-disabled=${this.busy ? 'true' : nothing}
                @click=${() => this.ask('button')}
              >
                ${renderIcon('functioneel-kruis', { size: 16 })}
              </button>`
          }
        </header>
        <div id="lintje-dialog-text" class="lintje-dialog__body"><slot></slot></div>
        <div class="lintje-dialog__footer" ?hidden=${!this.footerSlotted}>
          <div class="lintje-dialog__note">
            <slot name="footer" @slotchange=${this.onSlotChange}></slot>
          </div>
          <div class="lintje-dialog__actions">
            <slot name="actions" @slotchange=${this.onSlotChange}></slot>
          </div>
        </div>
      </div>
    </div>`
  }
}

define('lintje-dialog', LintjeDialog)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-dialog': LintjeDialog
  }
}
