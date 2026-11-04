/**
 * `<lintje-filter-sheet>` — the filters below 768 px, in a sheet that traps the focus while open.
 *
 * Nothing applies before "Toepassen": the owner keeps the draft and supplies the controls. Escape
 * in an open popover closes only that popover.
 *
 * Events: `lintje-filters-apply`, `lintje-sheet-close`, `lintje-filters-reset`.
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { LintjeElement, define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { iconStyles } from '../../../icons/render'
import '../../actions/button/button'
import '../../actions/icon-button/icon-button'
import { DialogHold } from '../../shared/dialog'
import { filterSentence, type SentencePart } from '../shared/sentence'
import sheetCss from './filter-sheet.css?inline'
import dialogCloseCss from '../../shared/dialog-close.css?inline'
import sharedSheetCss from '../../shared/sheet.css?inline'
import { SheetLeave, renderSheetHead } from '../../shared/sheet'
import { classMap } from 'lit/directives/class-map.js'

export class LintjeFilterSheet extends LintjeElement {
  static override styles = [
    iconStyles,
    shadowCss(dialogCloseCss),
    shadowCss(sheetCss),
    shadowCss(sharedSheetCss),
  ]

  static override properties: PropertyDeclarations = {
    open: { type: Boolean, reflect: true },
    resetDisabled: { type: Boolean, attribute: 'reset-disabled' },
    applyDisabled: { type: Boolean, attribute: 'apply-disabled' },
    sentence: { attribute: false },
    scrollLock: { attribute: false },
    restoreFocus: { attribute: false },
  }

  open: boolean = false
  resetDisabled: boolean = false
  applyDisabled: boolean = false
  /** The sentence for the draft. */
  sentence: SentencePart[] = []
  /** The element that scrolls the page; without it the sheet uses `lockScroll`. */
  declare scrollLock?: HTMLElement | null
  /** Closing gives the focus back to the button that opened it; `false` leaves it to the owner. */
  restoreFocus: boolean = true

  // Our own popups stop Escape themselves; this is the net for a host's control. The slotted
  // controls are asked, since a query cannot see into their shadow roots; the event's path
  // would not do either (Escape with focus on the body has a path of two).
  readonly #leave = new SheetLeave(this, () => this.open)

  readonly #hold = new DialogHold(() => {
    if (!this.hasOpenPopover()) this.close()
  })

  private hasOpenPopover(): boolean {
    const slot = this.renderRoot.querySelector('slot')
    const assigned = slot?.assignedElements({ flatten: true }) ?? []
    return assigned.some(
      (element) => element.hasAttribute('open') || element.querySelector('[open]') !== null,
    )
  }

  override disconnectedCallback(): void {
    this.#hold.release()
    super.disconnectedCallback()
  }

  private close(): void {
    this.emitLocal('lintje-sheet-close')
  }

  protected override updated(): void {
    if (this.open && !this.#hold.held) {
      const sheet = this.renderRoot.querySelector<HTMLElement>('.lintje-filter-sheet')
      // Shares the overlay counter, so a modal over the sheet shares the lock.
      if (sheet) this.#hold.hold(sheet, { focus: true, scroller: this.scrollLock })
    } else if (!this.open && this.#hold.held) {
      this.#hold.release(this.restoreFocus)
    }
  }

  protected override render(): TemplateResult | typeof nothing {
    const leaving = this.#leave.leaving
    if (!this.open && !leaving) return nothing
    return html`
      <div
        class=${classMap({
          'lintje-sheet__scrim': true,
          'lintje-filter-sheet__scrim': true,
          'is-leaving': leaving,
        })}
        @click=${() => this.close()}
      ></div>
      <div
        class=${classMap({ 'lintje-sheet': true, 'lintje-filter-sheet': true, 'is-leaving': leaving })}
        role=${leaving ? nothing : 'dialog'}
        aria-modal=${leaving ? nothing : 'true'}
        aria-label="Filters"
        tabindex="-1"
        ?inert=${leaving}
        @animationend=${this.#leave.end}
      >
        ${renderSheetHead({
          title: 'Filters',
          className: 'lintje-filter-sheet__header',
          closeClass: 'lintje-filter-sheet__close',
          extra: html`<span class="lintje-filter-sheet__hint">gelden voor alle cijfers</span>`,
          onClose: () => this.close(),
        })}

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
