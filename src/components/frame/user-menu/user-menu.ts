/**
 * `<lintje-user-menu>` — the user's avatar in the navigation bar and the menu it opens: name and
 * role with "Afmelden" beside them, the host's rows (`MenuEntry`) and the version. With `variant="side"` it is
 * the foot of the side menu: the avatar with the name and role beside it, the menu above it. With
 * `variant="tab"` it is a tab of the shell's tab bar, the word Jij under the avatar. Below 768 px
 * the menu opens from below as a sheet, over the tabs.
 *
 * A menu, not a dialog: it traps no focus, and an Escape in a dialog opened over it is the
 * dialog's.
 *
 * Events: `lintje-action` `string` (the row's value), `lintje-navigate` `{ href }` (a link row),
 * `lintje-logout` (without `logout-action`), `lintje-toggle` `{ open }` (the menu opens or closes).
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { LintjeElement, define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import { avatarStyles, renderAvatar } from '../../shared/avatar'
import {
  nextRow,
  renderMenuEntries,
  type MenuEntry,
  type MenuItem,
} from '../../actions/menu-button/menu-button'
import '../../overlays/popover/popover'
import '../../overlays/tooltip/tooltip'
import { MediaController, MOBILE } from '../../../core/media'
import tabCss from '../shared/tab.css?inline'
import dialogCloseCss from '../../shared/dialog-close.css?inline'
import menuCss from '../../shared/menu.css?inline'
import menuButtonCss from '../../actions/menu-button/menu-button.css?inline'
import userMenuCss from './user-menu.css?inline'
import { isPlainClick } from '../../../core/links'
import { standsIn } from '../../../core/focus'
import { titleWhenCut } from '../../shared/cut-text'
import type { Person } from '../../../types'
import { uniqueId } from '../../../core/id'

export class LintjeUserMenu extends LintjeElement {
  static override styles = [
    iconStyles,
    avatarStyles,
    shadowCss(menuCss),
    shadowCss(menuButtonCss),
    shadowCss(userMenuCss),
    shadowCss(tabCss),
    shadowCss(dialogCloseCss),
  ]

  static override properties: PropertyDeclarations = {
    user: { attribute: false },
    items: { attribute: false },
    version: { type: String },
    logoutAction: { type: String, attribute: 'logout-action' },
    csrf: { type: String },
    inline: { type: Boolean, reflect: true },
    variant: { type: String, reflect: true },
    folded: { type: Boolean, reflect: true },
    open: { type: Boolean, reflect: true },
  }

  declare user?: Person | null
  items: MenuEntry[] = []
  /** Shown at the bottom: "Versie 2.4.1". */
  declare version?: string
  /**
   * The URL "Afmelden" posts a real `<form>` to: signing out leaves the page, which a fetch
   * cannot do. Without it "Afmelden" sends `lintje-logout`.
   */
  declare logoutAction?: string
  /** The session's CSRF token, posted with "Afmelden" in a hidden `csrf_token` field. */
  csrf: string = ''
  /** The content without button and popover, on the navigation's colours: for the mobile sheet. */
  inline: boolean = false
  /**
   * `bar`: the avatar in the navigation bar, the menu below it. `side`: the foot of the side
   * menu, named by the user's name with the role beside it, the menu above it. `tab`: a tab of
   * the shell's tab bar below 768 px.
   */
  variant: 'bar' | 'side' | 'tab' = 'bar'
  /** `side` in the folded rail: only the avatar shows; name and role stay for a screen reader. */
  folded: boolean = false
  open: boolean = false

  readonly #mobile = new MediaController(this, MOBILE)
  readonly #menuId = uniqueId('lintje-user-menu')
  readonly #roleId = uniqueId('lintje-user-menu-role')
  #pendingFocus: 'first' | 'last' | null = null

  private get trigger(): HTMLButtonElement | null {
    return this.renderRoot.querySelector<HTMLButtonElement>(
      '.lintje-user-menu__trigger, .lintje-tab-bar__tab',
    )
  }

  /** Below 768 px the menu of the bar and of a tab is a sheet from below. */
  private get sheet(): boolean {
    return this.variant !== 'side' && this.#mobile.matches
  }

  /** "Afmelden" beside the name comes last: the first arrow down never lands on it. */
  private rowElements(): HTMLElement[] {
    const logout = this.renderRoot.querySelector<HTMLElement>('.lintje-user-menu__logout-button')
    const rows = [...this.renderRoot.querySelectorAll<HTMLElement>('.lintje-menu__row')]
    return logout ? [...rows, logout] : rows
  }

  /** The rows as `nextRow()` reads them: only whether each one is disabled counts. */
  private rowStates(rows: HTMLElement[]): MenuItem[] {
    return rows.map((row) => ({
      value: '',
      label: '',
      disabled: row.getAttribute('aria-disabled') === 'true',
    }))
  }

  private focusRow(direction: 1 | -1, from: number): void {
    const rows = this.rowElements()
    const index = nextRow(this.rowStates(rows), from, direction)
    if (index >= 0) rows[index]?.focus()
  }

  private show(focus: 'first' | 'last'): void {
    this.#pendingFocus = focus
    this.setOpen(true)
  }

  private hide(returnFocus: boolean): void {
    this.setOpen(false)
    if (returnFocus) this.trigger?.focus()
  }

  private setOpen(open: boolean): void {
    if (this.open === open) return
    this.open = open
    this.emit('lintje-toggle', { open })
  }

  /** A pointer gets the whole name and role as a tooltip, only where they are cut off. */
  private readonly onTriggerPointerEnter = (): void => {
    for (const line of this.renderRoot.querySelectorAll<HTMLElement>(
      '.lintje-user-menu__trigger-name, .lintje-user-menu__trigger-role',
    )) {
      if (line.scrollWidth > line.clientWidth) line.title = line.textContent ?? ''
      else line.removeAttribute('title')
    }
  }

  // The focus leaving the element closes the menu. A press that takes no focus blurs to nothing,
  // or to a focusable box around the element: neither is leaving.
  private readonly onFocusOut = (event: FocusEvent): void => {
    const next = event.relatedTarget as Node | null
    if (!this.open || !next || standsIn(next, this) || standsIn(this, next)) return
    this.hide(false)
  }

  constructor() {
    super()
    this.addEventListener('focusout', this.onFocusOut)
  }

  private readonly onTriggerKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      this.show(event.key === 'ArrowDown' ? 'first' : 'last')
    }
  }

  private readonly onMenuKeydown = (event: KeyboardEvent): void => {
    if (this.inline) return
    // The sheet has no popover to answer Escape.
    if (event.key === 'Escape' && this.sheet) {
      event.preventDefault()
      this.hide(true)
      return
    }
    const rows = this.rowElements()
    const current = rows.findIndex((row) => row === this.shadowRoot?.activeElement)
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        this.focusRow(1, current)
        return
      case 'ArrowUp':
        event.preventDefault()
        this.focusRow(-1, current < 0 ? rows.length : current)
        return
      case 'Home':
        event.preventDefault()
        this.focusRow(1, -1)
        return
      case 'End':
        event.preventDefault()
        this.focusRow(-1, rows.length)
        return
      case 'Tab':
        // Tab goes on from the trigger, past the menu that stands after it.
        if (!event.shiftKey) this.trigger?.focus()
        this.hide(false)
        return
      case ' ': {
        const row = rows[current]
        if (row instanceof HTMLAnchorElement) {
          event.preventDefault()
          row.click()
        }
      }
    }
  }

  private onPopoverClose(event: CustomEvent<{ reason: string }>): void {
    event.stopPropagation()
    this.hide(event.detail?.reason === 'escape')
  }

  private choose(item: MenuItem, event: MouseEvent): void {
    if (item.disabled) {
      event.preventDefault()
      return
    }
    if (item.href && !isPlainClick(event)) return
    this.hide(!this.inline)
    this.emit('lintje-action', item.value)
    if (item.href) this.followLink(item.href, event)
  }

  private logout(): void {
    this.hide(!this.inline)
    this.emit('lintje-logout')
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    if (this.open && this.#pendingFocus) {
      const focus = this.#pendingFocus
      this.#pendingFocus = null
      const popover = this.renderRoot.querySelector('lintje-popover')
      void (popover?.updateComplete ?? Promise.resolve()).then(() =>
        focus === 'first' ? this.focusRow(1, -1) : this.focusRow(-1, this.rowElements().length),
      )
    }
  }

  private renderRow(item: MenuItem): TemplateResult {
    const role = this.inline ? nothing : 'menuitem'
    const tabindex = this.inline ? nothing : '-1'
    const classes = classMap({
      'lintje-menu__row': true,
      'focus-inset': true,
      'is-danger': Boolean(item.danger),
      'is-disabled': Boolean(item.disabled),
    })
    const content = html`${
      item.icon ? renderIcon(item.icon, { size: 16, className: 'lintje-menu__icon' }) : nothing
    }<span class="lintje-menu__label" @pointerenter=${titleWhenCut}>${item.label}</span>${
      item.hint ? html`<span class="lintje-menu__hint">${item.hint}</span>` : nothing
    }`
    if (item.href && !item.disabled) {
      return html`<a
        class=${classes}
        role=${role}
        tabindex=${tabindex}
        href=${item.href}
        @click=${(event: MouseEvent) => this.choose(item, event)}
        >${content}</a
      >`
    }
    const row = html`<button
      type="button"
      class=${classes}
      role=${role}
      tabindex=${tabindex}
      aria-disabled=${item.disabled ? 'true' : nothing}
      @click=${(event: MouseEvent) => this.choose(item, event)}
    >
      ${content}
    </button>`
    // As in `lintje-menu-button`: the reason shows on focus too, where a `title` never does.
    if (item.disabled && item.reason) {
      return html`<lintje-tooltip class="lintje-menu__tip" text=${item.reason}>${row}</lintje-tooltip>`
    }
    return row
  }

  /**
   * `compact`: the glyph alone beside the name, its word its accessible name. A button, not a
   * menu item: it stands outside the menu, but the arrows reach it after the rows.
   */
  private renderLogout(compact = false): TemplateResult {
    const role = this.inline || compact ? nothing : 'menuitem'
    const tabindex = this.inline ? nothing : '-1'
    const classes = compact
      ? 'lintje-user-menu__logout-button focus-inset'
      : 'lintje-menu__row lintje-user-menu__logout-row focus-inset'
    const content = compact
      ? renderIcon('functioneel-uitloggen', { size: 20 })
      : html`${renderIcon('functioneel-uitloggen', { size: 16, className: 'lintje-menu__icon' })}<span
            class="lintje-menu__label"
            @pointerenter=${titleWhenCut}
            >Afmelden</span
          >`
    const label = compact ? 'Afmelden' : nothing
    if (this.logoutAction) {
      return html`<form class="lintje-user-menu__logout" method="post" action=${this.logoutAction}>
        <input type="hidden" name="csrf_token" .value=${this.csrf} />
        <button type="submit" class=${classes} role=${role} tabindex=${tabindex} aria-label=${label}>
          ${content}
        </button>
      </form>`
    }
    return html`<button
      type="button"
      class=${classes}
      role=${role}
      tabindex=${tabindex}
      aria-label=${label}
      @click=${() => this.logout()}
    >
      ${content}
    </button>`
  }

  private renderContent(): TemplateResult {
    const user = this.user
    return html`<div
      class=${classMap({ 'lintje-user-menu__panel': true, 'is-inline': this.inline })}
      @keydown=${this.onMenuKeydown}
    >
      ${
        user
          ? html`<div class="lintje-user-menu__who">
            ${this.inline ? renderAvatar(user, { onNav: true }) : nothing}
            <div class="lintje-user-menu__names">
              <p class="lintje-user-menu__name">${user.name}</p>
              ${user.role ? html`<p class="lintje-user-menu__role">${user.role}</p>` : nothing}
            </div>
            ${this.renderLogout(true)}
          </div>`
          : nothing
      }
      <div
        class=${classMap({ 'lintje-user-menu__menu': true, 'is-empty': !this.items.length && Boolean(user) })}
        role=${this.inline ? 'group' : 'menu'}
        aria-label=${user ? `Menu van ${user.name}` : 'Gebruikersmenu'}
      >
        ${
          this.items.length
            ? html`<div class="lintje-user-menu__group">
              ${renderMenuEntries(this.items, 'lintje-user-menu', (item) => this.renderRow(item))}
            </div>`
            : nothing
        }
        ${
          user
            ? nothing
            : html`<div class="lintje-user-menu__group lintje-user-menu__group--logout">
              ${this.renderLogout()}
            </div>`
        }
      </div>
      ${this.version ? html`<p class="lintje-user-menu__version">Versie ${this.version}</p>` : nothing}
    </div>`
  }

  /** The name and role beside the avatar; the role is the button's description, not its name. */
  private renderNames(user: Person): TemplateResult {
    return html`<span class="lintje-user-menu__trigger-names">
      <span class="lintje-user-menu__trigger-name">${user.name}</span>
      ${
        user.role
          ? html`<span class="lintje-user-menu__trigger-role" id=${this.#roleId} aria-hidden="true"
            >${user.role}</span
          >`
          : nothing
      }
    </span>`
  }

  protected override render(): TemplateResult {
    if (this.inline) return this.renderContent()
    const user = this.user
    const side = this.variant === 'side'
    // The bar's avatar shows only initials; the foot shows the name, which is then its name.
    const label = !user
      ? 'Gebruikersmenu'
      : side
        ? nothing
        : user.initials
          ? `${user.initials}, menu van ${user.name}`
          : `Menu van ${user.name}`
    // The menu opens away from the trigger: down from the bar, up from the foot.
    const chevronUp = side ? !this.open : this.open
    if (this.variant === 'tab') return this.renderTab()
    return html`<button
        type="button"
        class=${classMap({
          'lintje-user-menu__trigger': true,
          'lintje-user-menu__trigger--side': side,
          'focus-inset': side,
          'is-open': this.open,
          'is-folded': side && this.folded,
          // Below 768 px the menu comes from below: only the avatar, no chevron, no fill.
          'is-bare': this.sheet,
        })}
        aria-label=${label}
        aria-describedby=${side && user?.role ? this.#roleId : nothing}
        aria-haspopup="menu"
        aria-expanded=${String(this.open)}
        aria-controls=${this.#menuId}
        @click=${() => (this.open ? this.hide(false) : this.show('first'))}
        @keydown=${this.onTriggerKeydown}
        @pointerenter=${side ? this.onTriggerPointerEnter : nothing}
      >
        ${renderAvatar(user ?? null, { onNav: true, size: side ? 'large' : 'medium' })}
        ${side && user ? this.renderNames(user) : nothing}
        ${
          this.sheet
            ? nothing
            : renderIcon('functioneel-delta-omlaag', {
                size: 16,
                rotate: chevronUp ? 180 : undefined,
                className: 'lintje-user-menu__chevron',
              })
        }
      </button>
      ${side ? html`<span class="lintje-user-menu__anchor" aria-hidden="true"></span>` : nothing}
      ${this.sheet ? this.renderSheet() : this.renderPopover(side)}`
  }

  /** As a tab: the avatar as the glyph, the word Jij under it. */
  private renderTab(): TemplateResult {
    // The visible word is the name, so a voice command can use it (WCAG 2.5.3); whose menu it is
    // follows, heard only.
    return html`<button
        type="button"
        class=${classMap({ 'lintje-tab-bar__tab': true, 'focus-inset': true, 'is-open': this.open })}
        aria-haspopup="menu"
        aria-expanded=${String(this.open)}
        aria-controls=${this.#menuId}
        @click=${() => (this.open ? this.hide(false) : this.show('first'))}
        @keydown=${this.onTriggerKeydown}
      >
        <span class="lintje-tab-bar__glyph" aria-hidden="true"
          >${renderAvatar(this.user ?? null, { onNav: true, size: 'small' })}</span
        ><span class="lintje-tab-bar__label">Jij</span>${
          this.user
            ? html`<span class="visually-hidden">, menu van ${this.user.name}</span>`
            : nothing
        }
      </button>
      ${this.sheet ? this.renderSheet() : this.renderPopover(false)}`
  }

  /** Below 768 px: a sheet from below over the page and the tabs, with a veil that closes it. */
  private renderSheet(): TemplateResult | typeof nothing {
    if (!this.open) return nothing
    return html`<div class="lintje-user-menu__scrim" @click=${() => this.hide(false)}></div>
      <div class="lintje-user-menu__sheet" id=${this.#menuId}>
        <!-- The head of every sheet: its name and a close button, as "Weergave" and "Delen". -->
        <div class="lintje-user-menu__sheet-head">
          <h2 class="lintje-user-menu__sheet-title">Jij</h2>
          <button
            type="button"
            class="lintje-dialog-close lintje-user-menu__close"
            aria-label="Jouw menu sluiten"
            @click=${() => this.hide(true)}
          >
            ${renderIcon('functioneel-kruis', { size: 16 })}
          </button>
        </div>
        ${this.renderContent()}
      </div>`
  }

  private renderPopover(side: boolean): TemplateResult {
    return html`<lintje-popover
        id=${this.#menuId}
        placement=${side ? 'top-start' : 'bottom-end'}
        ?match-width=${side}
        gap=${side ? 0 : nothing}
        .anchor=${side ? this.renderRoot?.querySelector('.lintje-user-menu__anchor') : undefined}
        .opener=${side ? this.trigger : undefined}
        ?open=${this.open}
        @lintje-close=${this.onPopoverClose}
        >${this.renderContent()}</lintje-popover
      >`
  }
}

define('lintje-user-menu', LintjeUserMenu)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-user-menu': LintjeUserMenu
  }
}
