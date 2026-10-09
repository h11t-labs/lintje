/**
 * `<lintje-sub-nav>` — the navigation within one part of an application, beside its content.
 *
 * Groups of links, optionally under a label, and one action below them ("Nieuw …"). The host
 * marks the reader's page with `active`; an item's `items` show while it or one of them is active.
 * Below 768 px it is one button with the reader's page, which opens the list in place. It never
 * reads the URL.
 *
 * Events: `lintje-navigate` `{ href }`, `lintje-action` `{ value }` (the action).
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { LintjeElement, define } from '../../../core/element'
import { holdsFocus } from '../../../core/focus'
import { isPlainClick } from '../../../core/links'
import { MediaController, MOBILE } from '../../../core/media'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import { badgeStyles, renderBadge } from '../../../primitives/badge/badge'
import subNavCss from './sub-nav.css?inline'

export interface SubNavItem {
  label: string
  /** Without it the item has no page and is drawn muted. */
  href?: string
  /** The page the reader is on; the host decides. */
  active?: boolean
  /** An icon file name, drawn before the label. */
  icon?: string
  /** A count after the label; `label` is what a screen reader hears: "2 ongelezen". */
  badge?: { value: string | number; label?: string }
  /** The page exists but the reader may not open it: struck through, with a lock. */
  noAccess?: boolean
  /** The level below, shown while this item or one of them is active. */
  items?: SubNavItem[]
}

export interface SubNavGroup {
  /** Names the group; without it the group stands apart by space alone. */
  label?: string
  items: SubNavItem[]
}

/** The one action below the groups; its `value` comes back in `lintje-action`. */
export interface SubNavAction {
  label: string
  value: string
  /** An icon file name; `functioneel-plus` when left out. */
  icon?: string
}

const onPath = (item: SubNavItem): boolean =>
  Boolean(item.active) || Boolean(item.items?.some(onPath))

/** The active item and the label of its group, for the phone's button. */
export function activeEntry(groups: SubNavGroup[]): { item: SubNavItem; group?: string } | null {
  const find = (items: SubNavItem[]): SubNavItem | null => {
    for (const item of items) {
      if (item.active) return item
      const below = item.items ? find(item.items) : null
      if (below) return below
    }
    return null
  }
  for (const group of groups) {
    const item = find(group.items)
    if (item) return { item, group: group.label }
  }
  return null
}

let instances = 0

export class LintjeSubNav extends LintjeElement {
  static override styles = [iconStyles, badgeStyles, shadowCss(subNavCss)]

  static override properties: PropertyDeclarations = {
    groups: { attribute: false },
    action: { attribute: false },
    label: { type: String },
    open: { state: true },
  }

  /** The groups, in order. One group without a label is a plain list. */
  groups: SubNavGroup[] = []
  /** The action below the groups, or none. */
  declare action?: SubNavAction
  /** The navigation's accessible name: "Instellingen". */
  label: string = 'Submenu'
  /** Whether the phone's list is open. */
  open: boolean = false

  #mobile = new MediaController(this, MOBILE)
  #id = `lintje-sub-nav-${++instances}`

  /** The phone's list hides what it holds: a focus in it goes to its button first, not the page. */
  #close(): void {
    const panel = this.renderRoot.querySelector('.lintje-sub-nav__panel')
    if (panel && holdsFocus(panel)) {
      this.renderRoot.querySelector<HTMLButtonElement>('.lintje-sub-nav__toggle')?.focus()
    }
    this.open = false
  }

  private follow(event: MouseEvent, href: string): void {
    if (!isPlainClick(event)) return
    this.#close()
    this.followLink(href, event)
  }

  private act(value: string): void {
    this.#close()
    this.emit('lintje-action', { value })
  }

  private onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || !this.open) return
    event.stopPropagation()
    this.open = false
    this.renderRoot.querySelector<HTMLButtonElement>('.lintje-sub-nav__toggle')?.focus()
  }

  private renderItem(item: SubNavItem): TemplateResult {
    const below = item.items?.length && onPath(item) ? item.items : null
    const ancestor = !item.active && Boolean(below)
    const icon = item.icon
      ? renderIcon(item.icon, { size: 20, className: 'lintje-sub-nav__icon' })
      : nothing
    const badge = item.badge
      ? renderBadge({
          value: item.badge.value,
          variant: 'count',
          label: item.badge.label,
          className: 'lintje-sub-nav__count',
        })
      : nothing
    const label = html`<span class="lintje-sub-nav__label">${item.label}</span>`
    let entry: TemplateResult
    if (item.noAccess || !item.href) {
      // Without access the lock says why (rule 13); without the file, the words do. A span's
      // aria-disabled is not read, so an item without a page says so in words.
      const lock = renderIcon('gebruiksvoorwerpen-hangslot-dicht', {
        size: 16,
        label: 'Geen toegang',
        className: 'lintje-sub-nav__lock',
      })
      entry = html`<span
        class=${classMap({
          'lintje-sub-nav__link': true,
          'is-no-access': Boolean(item.noAccess),
          'is-no-page': !item.noAccess,
        })}
        aria-disabled="true"
        >${icon}${label}${
          item.noAccess
            ? lock === nothing
              ? html`<span>geen toegang</span>`
              : lock
            : html`<span class="visually-hidden"> (niet beschikbaar)</span>`
        }</span
      >`
    } else {
      const href = item.href
      entry = html`<a
        class=${classMap({
          'lintje-sub-nav__link': true,
          'focus-inset': true,
          'is-current': Boolean(item.active),
          'is-ancestor': ancestor,
        })}
        href=${href}
        aria-current=${item.active ? 'page' : nothing}
        @click=${(event: MouseEvent) => this.follow(event, href)}
        >${icon}${label}${badge}</a
      >`
    }
    return html`<li>
      ${entry}${
        below
          ? html`<ul class="lintje-sub-nav__list lintje-sub-nav__list--nested">
              ${below.map((child) => this.renderItem(child))}
            </ul>`
          : nothing
      }
    </li>`
  }

  private renderGroups(): TemplateResult {
    const action = this.action
    return html`${this.groups.map((group, index) => {
      const id = `${this.#id}-g${index}`
      return html`<div class="lintje-sub-nav__group">
        ${group.label ? html`<p id=${id} class="lintje-sub-nav__heading">${group.label}</p>` : nothing}
        <ul class="lintje-sub-nav__list" aria-labelledby=${group.label ? id : nothing}>
          ${group.items.map((item) => this.renderItem(item))}
        </ul>
      </div>`
    })}${
      action
        ? html`<div class="lintje-sub-nav__group">
            <button
              type="button"
              class="lintje-sub-nav__link lintje-sub-nav__link--action focus-inset"
              @click=${() => this.act(action.value)}
            >
              ${renderIcon(action.icon ?? 'functioneel-plus', {
                size: 20,
                className: 'lintje-sub-nav__icon',
              })}<span class="lintje-sub-nav__label">${action.label}</span>
            </button>
          </div>`
        : nothing
    }`
  }

  private renderPhone(): TemplateResult {
    const entry = activeEntry(this.groups)
    const panel = `${this.#id}-panel`
    return html`<nav class="lintje-sub-nav" aria-label=${this.label} @keydown=${this.onKeydown}>
      <button
        type="button"
        class=${classMap({ 'lintje-sub-nav__toggle': true, 'is-open': this.open })}
        aria-expanded=${this.open ? 'true' : 'false'}
        aria-controls=${panel}
        @click=${() => (this.open = !this.open)}
      >
        <span class="lintje-sub-nav__toggle-text">
          ${entry?.group ? html`<span class="lintje-sub-nav__toggle-group">${entry.group}</span>` : nothing}
          <span class="lintje-sub-nav__toggle-current">${entry?.item.label ?? this.label}</span>
        </span>
        ${renderIcon('functioneel-delta-omlaag', { size: 24, className: 'lintje-sub-nav__toggle-icon' })}
      </button>
      <div id=${panel} class="lintje-sub-nav__panel" ?hidden=${!this.open}>${this.renderGroups()}</div>
    </nav>`
  }

  protected override render(): TemplateResult | typeof nothing {
    if (!this.groups.length && !this.action) return nothing
    if (this.#mobile.matches) return this.renderPhone()
    return html`<nav class="lintje-sub-nav" aria-label=${this.label}>${this.renderGroups()}</nav>`
  }
}

define('lintje-sub-nav', LintjeSubNav)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-sub-nav': LintjeSubNav
  }
}
