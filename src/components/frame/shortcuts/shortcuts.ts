/**
 * `<lintje-shortcuts>` — the overview of the keyboard shortcuts this page has registered.
 *
 * The list is the register's (`core/shortcuts.ts`), read when the window opens. The element
 * registers `?` itself and asks to be opened (`lintje-open`). The owner holds `open`, as with
 * `<lintje-confirm-dialog>`, whose frame and stylesheet this uses. Under the list a switch turns
 * the one-character keys off and on (WCAG 2.1.4); with them off, `?` opens nothing, so a page
 * also opens the overview from a button or a menu.
 *
 * Events: `lintje-open`, `lintje-close` `{ reason: 'escape' | 'scrim' | 'button' }`.
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
import {
  characterKeys,
  isCharacterKey,
  keyLabels,
  registerShortcut,
  setCharacterKeys,
  shortcuts,
  type ShortcutInfo,
} from '../../../core/shortcuts'
import { shadowCss } from '../../../core/styles'
import { FocusTrap } from '../../shared/focus-trap'
import '../../../primitives/button/button'
import '../../inputs/toggle/toggle'
import confirmDialogCss from '../../overlays/confirm-dialog/confirm-dialog.css?inline'
import keyCss from '../../shared/key.css?inline'
import shortcutsCss from './shortcuts.css?inline'

export type ShortcutsCloseReason = 'escape' | 'scrim' | 'button'

export class LintjeShortcuts extends LintjeElement {
  static override styles = [shadowCss(confirmDialogCss), shadowCss(keyCss), shadowCss(shortcutsCss)]

  static override properties: PropertyDeclarations = {
    open: { type: Boolean, reflect: true },
    heading: { type: String },
    list: { state: true },
    characterKeys: { state: true },
  }

  /** The owner's: the window asks to be closed and never closes itself. */
  open: boolean = false
  heading: string = 'Sneltoetsen'
  protected list: ShortcutInfo[] = []
  protected characterKeys: boolean = true

  #unregister: (() => void) | null = null
  #released: (() => void) | null = null
  readonly #trap = new FocusTrap()

  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.#trap.isTopmost()) this.close('escape')
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.#unregister = registerShortcut({
      keys: '?',
      description: 'Dit overzicht',
      handler: () => {
        if (!this.open) this.emit('lintje-open')
      },
    })
  }

  override disconnectedCallback(): void {
    this.#unregister?.()
    this.#unregister = null
    this.#release()
    super.disconnectedCallback()
  }

  private close(reason: ShortcutsCloseReason): void {
    this.emit('lintje-close', { reason })
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (changed.has('open') && this.open) {
      this.list = shortcuts()
      this.characterKeys = characterKeys()
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    if (this.open && !this.#released) this.#hold()
    else if (!this.open && this.#released) this.#release()
  }

  #hold(): void {
    this.#released = lockScroll()
    document.addEventListener('keydown', this.#onKeyDown)
    const frame = this.renderRoot.querySelector<HTMLElement>('.lintje-confirm-dialog')
    if (frame) this.#trap.activate(frame)
  }

  #release(): void {
    if (!this.#released) return
    document.removeEventListener('keydown', this.#onKeyDown)
    this.#released()
    this.#released = null
    this.#trap.deactivate()
  }

  private renderRow(item: ShortcutInfo): TemplateResult {
    return html`<dt class="lintje-shortcuts__what">${item.description}</dt>
      <dd class="lintje-shortcuts__keys">
        ${keyLabels(item.keys).map((label) => html`<kbd class="lintje-key">${label}</kbd>`)}
      </dd>`
  }

  private onCharacterKeys(event: CustomEvent<boolean>): void {
    this.characterKeys = event.detail
    setCharacterKeys(event.detail)
  }

  private renderSetting(): TemplateResult | typeof nothing {
    if (!this.list.some((item) => isCharacterKey(item.keys))) return nothing
    return html`<lintje-toggle
      class="lintje-shortcuts__setting"
      label="Sneltoetsen van één teken"
      hint="Uit werken alleen de sneltoetsen met Ctrl, Alt of Cmd."
      .checked=${this.characterKeys}
      @lintje-change=${this.onCharacterKeys}
    ></lintje-toggle>`
  }

  protected override render(): TemplateResult | typeof nothing {
    if (!this.open) return nothing
    return html`<div class="lintje-confirm-dialog__scrim" @click=${() => this.close('scrim')}>
      <div
        class="lintje-confirm-dialog lintje-shortcuts"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lintje-shortcuts-heading"
        tabindex="-1"
        @click=${(event: Event) => event.stopPropagation()}
      >
        <h2 id="lintje-shortcuts-heading" class="lintje-confirm-dialog__heading">${this.heading}</h2>
        <dl class="lintje-shortcuts__list">${this.list.map((item) => this.renderRow(item))}</dl>
        ${this.renderSetting()}
        <div class="lintje-confirm-dialog__actions">
          <lintje-button variant="secondary" @click=${() => this.close('button')}>Sluiten</lintje-button>
        </div>
      </div>
    </div>`
  }
}

define('lintje-shortcuts', LintjeShortcuts)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-shortcuts': LintjeShortcuts
  }
}
