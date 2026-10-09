/**
 * `<lintje-filter-sheet>` — the filters below 768 px. Nothing applies before "Toepassen"; the
 * owner keeps the draft and supplies the controls. Escape in an open popover closes only that
 * popover. Focus is trapped while open (`FocusTrap`).
 *
 * Events (bubbling, not composed): `lintje-filters-apply`, `lintje-sheet-close`,
 * `lintje-filters-reset`.
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type TemplateResult,
  type PropertyValues,
} from 'lit'
import { LintjeElement, define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import '../../../primitives/button/button'
import '../../../primitives/icon-button/icon-button'
import { holdOverflow, lockScroll } from '../../../core/host-config'
import { FocusTrap } from '../../shared/focus-trap'
import { filterSentence, type SentencePart } from '../shared/sentence'
import sheetCss from './filter-sheet.css?inline'
import dialogCloseCss from '../../shared/dialog-close.css?inline'

export class LintjeFilterSheet extends LintjeElement {
  static override styles = [iconStyles, shadowCss(dialogCloseCss), shadowCss(sheetCss)]

  static override properties: PropertyDeclarations = {
    open: { type: Boolean, reflect: true },
    resetDisabled: { type: Boolean, attribute: 'reset-disabled' },
    applyDisabled: { type: Boolean, attribute: 'apply-disabled' },
    sentence: { attribute: false },
    scrollLock: { attribute: false },
  }

  open: boolean = false
  resetDisabled: boolean = false
  applyDisabled: boolean = false
  /** The sentence for the draft. */
  sentence: SentencePart[] = []
  /** The element that scrolls the page; without it the sheet uses `lockScroll`. */
  declare scrollLock?: HTMLElement | null

  private locked: (() => void) | null = null
  readonly #trap = new FocusTrap()

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    // Only the dialog on top answers.
    if (!this.open || event.key !== 'Escape' || !this.#trap.isTopmost()) return
    // Our own popups stop the key themselves; this is the net for a host's control. The slotted
    // controls are asked, since a query cannot see into their shadow roots; the event's path
    // would not do either (Escape with focus on the body has a path of two).
    if (this.hasOpenPopover()) return
    this.close()
  }

  private hasOpenPopover(): boolean {
    const slot = this.renderRoot.querySelector('slot')
    const assigned = slot?.assignedElements({ flatten: true }) ?? []
    return assigned.some(
      (element) => element.hasAttribute('open') || element.querySelector('[open]') !== null,
    )
  }

  override connectedCallback(): void {
    super.connectedCallback()
    document.addEventListener('keydown', this.onKeyDown)
  }

  override disconnectedCallback(): void {
    document.removeEventListener('keydown', this.onKeyDown)
    this.unlock()
    this.#trap.deactivate()
    super.disconnectedCallback()
  }

  private close(): void {
    this.emitLocal('lintje-sheet-close')
  }

  private lock(): void {
    if (this.locked) return
    // Shares the overlay counter, so a modal over the sheet shares the lock.
    this.locked = this.scrollLock ? holdOverflow(this.scrollLock) : lockScroll()
  }

  private unlock(): void {
    this.locked?.()
    this.locked = null
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (!changed.has('open')) return
    if (this.open) {
      this.lock()
      const sheet = this.renderRoot.querySelector<HTMLElement>('.lintje-filter-sheet')
      if (sheet) this.#trap.activate(sheet)
    } else {
      this.unlock()
      this.#trap.deactivate()
    }
  }

  protected override render(): TemplateResult | typeof nothing {
    if (!this.open) return nothing
    return html`
      <div class="lintje-filter-sheet__scrim" @click=${() => this.close()}></div>
      <div
        class="lintje-filter-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
        tabindex="-1"
      >
        <div class="lintje-filter-sheet__header">
          <h2 class="lintje-filter-sheet__title">Filters</h2>
          <span class="lintje-filter-sheet__hint">gelden voor alle cijfers</span>
          <button
            type="button"
            aria-label="Filters sluiten"
            class="lintje-dialog-close lintje-filter-sheet__close"
            @click=${() => this.close()}
          >
            ${renderIcon('functioneel-kruis', { size: 16 })}
          </button>
        </div>

        <div class="lintje-filter-sheet__body">
          <slot></slot>
          <p class="lintje-filter-sheet__summary">${filterSentence(this.sentence)}</p>
        </div>

        <div class="lintje-filter-sheet__footer">
          <lintje-button
            variant="tertiary"
            block
            class="lintje-filter-sheet__action"
            ?disabled=${this.resetDisabled}
            @click=${() => this.emitLocal('lintje-filters-reset')}
            >Herstel standaard</lintje-button
          >
          <lintje-button
            variant="primary"
            block
            class="lintje-filter-sheet__action"
            ?disabled=${this.applyDisabled}
            @click=${() => this.emitLocal('lintje-filters-apply')}
            >Toepassen</lintje-button
          >
        </div>
      </div>
    `
  }
}

define('lintje-filter-sheet', LintjeFilterSheet)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-filter-sheet': LintjeFilterSheet
  }
}
