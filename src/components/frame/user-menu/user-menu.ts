/**
 * `<lintje-user-menu>` — the user's avatar in the navigation bar and the menu it opens: name and
 * role, the host's rows (`MenuEntry`, as `lintje-menu-button`), "Afmelden", the version.
 *
 * A menu, not a dialog: no trap, and an Escape pressed in a dialog opened over it is the
 * dialog's. With `logout-action` "Afmelden" is a real `<form method="post">` with the CSRF
 * token in a hidden `csrf_token` field: signing out leaves the page, which a fetch cannot do.
 * `inline` draws the content without button and popover, for the shell's mobile sheet.
 *
 * Events: `lintje-action` (the row's value), `lintje-navigate` `{ href }` for a link row,
 * `lintje-logout` (only without `logout-action`).
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
import {
  nextRow,
  renderMenuEntries,
  type MenuEntry,
  type MenuItem,
} from '../../actions/menu-button/menu-button'
import '../../../primitives/popover/popover'
import '../../../primitives/tooltip/tooltip'
import menuButtonCss from '../../actions/menu-button/menu-button.css?inline'
import userMenuCss from './user-menu.css?inline'
import { isPlainClick } from '../../../core/links'
import { standsIn } from '../../../core/focus'
import type { UserMenuUser } from '../../../types'

let instances = 0

export class LintjeUserMenu extends LintjeElement {
  static override styles = [iconStyles, shadowCss(menuButtonCss), shadowCss(userMenuCss)]

  static override properties: PropertyDeclarations = {
    user: { attribute: false },
    items: { attribute: false },
    version: { type: String },
    logoutAction: { type: String, attribute: 'logout-action' },
    csrf: { type: String },
    inline: { type: Boolean, reflect: true },
    open: { type: Boolean, reflect: true },
  }

  declare user?: UserMenuUser | null
  items: MenuEntry[] = []
  /** Shown at the bottom: "Versie 2.4.1". */
  declare version?: string
  /** The URL "Afmelden" posts to; without it "Afmelden" sends `lintje-logout`. */
  declare logoutAction?: string
  /** The session's CSRF token, posted with "Afmelden". */
  csrf: string = ''
  /** The content without button and popover, on the navigation's colours. */
  inline: boolean = false
  open: boolean = false

  readonly #menuId = `lintje-user-menu-${++instances}`
  #pendingFocus: 'first' | 'last' | null = null

  private get trigger(): HTMLButtonElement | null {
    return this.renderRoot.querySelector<HTMLButtonElement>('.lintje-user-menu__trigger')
  }

  private rowElements(): HTMLElement[] {
    return [...this.renderRoot.querySelectorAll<HTMLElement>('.lintje-menu__row')]
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
    this.open = true
  }

  private hide(returnFocus: boolean): void {
    this.open = false
    if (returnFocus) this.trigger?.focus()
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
    }<span class="lintje-menu__label">${item.label}</span>${
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

  private renderLogout(): TemplateResult {
    const role = this.inline ? nothing : 'menuitem'
    const tabindex = this.inline ? nothing : '-1'
    const glyph = renderIcon('functioneel-uitloggen', { size: 16, className: 'lintje-menu__icon' })
    const label = html`${glyph}<span class="lintje-menu__label">Afmelden</span>`
    if (this.logoutAction) {
      return html`<form class="lintje-user-menu__logout" method="post" action=${this.logoutAction}>
        <input type="hidden" name="csrf_token" .value=${this.csrf} />
        <button
          type="submit"
          class="lintje-menu__row lintje-user-menu__logout-row focus-inset"
          role=${role}
          tabindex=${tabindex}
        >
          ${label}
        </button>
      </form>`
    }
    return html`<button
      type="button"
      class="lintje-menu__row lintje-user-menu__logout-row focus-inset"
      role=${role}
      tabindex=${tabindex}
      @click=${() => this.logout()}
    >
      ${label}
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
            ${
              this.inline
                ? html`<span class="lintje-user-menu__avatar" aria-hidden="true">${user.initials}</span>`
                : nothing
            }
            <div class="lintje-user-menu__names">
              <p class="lintje-user-menu__name">${user.name}</p>
              ${user.role ? html`<p class="lintje-user-menu__role">${user.role}</p>` : nothing}
            </div>
          </div>`
          : nothing
      }
      <div
        class="lintje-user-menu__menu"
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
        <div class="lintje-user-menu__group lintje-user-menu__group--logout">${this.renderLogout()}</div>
      </div>
      ${this.version ? html`<p class="lintje-user-menu__version">Versie ${this.version}</p>` : nothing}
    </div>`
  }

  protected override render(): TemplateResult {
    if (this.inline) return this.renderContent()
    const user = this.user
    return html`<button
        type="button"
        class=${classMap({ 'lintje-user-menu__trigger': true, 'is-open': this.open })}
        aria-label=${user ? `${user.initials}, menu van ${user.name}` : 'Gebruikersmenu'}
        aria-haspopup="menu"
        aria-expanded=${String(this.open)}
        aria-controls=${this.#menuId}
        @click=${() => (this.open ? this.hide(false) : this.show('first'))}
        @keydown=${this.onTriggerKeydown}
      >
        <span class="lintje-user-menu__avatar" aria-hidden="true">${user?.initials ?? ''}</span>
        ${renderIcon('functioneel-delta-omlaag', { size: 16, rotate: this.open ? 180 : undefined })}
      </button>
      <lintje-popover
        id=${this.#menuId}
        placement="bottom-end"
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
