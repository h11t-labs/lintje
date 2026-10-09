/**
 * The header of the top layout: a logo bar and a navigation bar, as two render functions styled
 * by `header.css`. The calling element adopts the stylesheet and owns all state (open group,
 * active page, clicks); the functions read no URL.
 *
 * When the entries do not fit (`collapsed`) they give way to "Menu". They stay in the DOM, hidden,
 * so their width can be measured in either state (`SubmenuController`).
 */
import {
  html,
  nothing,
  type ReactiveController,
  type ReactiveControllerHost,
  type TemplateResult,
} from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { renderIcon } from '../../../icons/render'
import { isPlainClick } from '../../../core/links'
import { MOBILE, MediaController } from '../../../core/media'
import { ownsEscape } from '../../shared/focus-trap'
import { holdsFocus } from '../../../core/focus'
import '../../actions/logo/logo'
import { renderBadge } from '../../../primitives/badge/badge'
import type { ShellLink } from '../../../types'

/** Pages as the bars draw them: adjacent loose pages form one group without a heading. */
export interface NavGroup {
  heading?: string
  items: ShellLink[]
}

/** The ribbon's width in px; matches `--w-ribbon`. */
export const RIBBON_WIDTH = { desktop: 48, phone: 40 } as const

export interface LogoBarOptions {
  /** URL or data URI of an emblem the host resolved itself; wins over `emblem`. */
  logo?: string
  /** The theme's emblem (the ribbon) by file name, with the organisation's name and byline. */
  emblem?: { name: string; label: string; byline?: string }
  /** `RIBBON_WIDTH.desktop` or `.phone`. */
  ribbon: number
  /** The environment outside production ("Acceptatie"); a phone shows its first three letters. */
  environment?: string
  /** Without it the logo is not a link. */
  home?: { href: string; onNavigate: (event: MouseEvent) => void }
}

export function renderLogoBar(options: LogoBarOptions): TemplateResult {
  const { logo, emblem, ribbon, environment, home } = options
  const drawing = html`<lintje-logo
    full
    width=${ribbon}
    src=${logo ?? nothing}
    name=${emblem?.name ?? nothing}
    alt=${emblem?.label ?? nothing}
    byline=${emblem?.byline ?? nothing}
  ></lintje-logo>`
  return html`<div class="lintje-logobar">
    ${
      home
        ? html`<a
          class="lintje-logobar__home focus-inset"
          href=${home.href}
          aria-label="Naar de startpagina"
          title="Naar de startpagina"
          @click=${(event: MouseEvent) => {
            if (isPlainClick(event)) home.onNavigate(event)
          }}
          >${drawing}</a
        >`
        : drawing
    }
    ${
      environment
        ? html`<p class="lintje-logobar__environment" title=${environment}>
          <span class="lintje-logobar__environment-label">${environment}</span>
          <span class="lintje-logobar__environment-short" aria-hidden="true"
            >${environment.slice(0, 3)}</span
          >
        </p>`
        : nothing
    }
  </div>`
}

/** `NavBarOptions.open` while the panel of "Menu", the whole menu, is open. */
export const WHOLE_MENU = -1

export interface NavBarOptions {
  /** Unique within the calling shadow root: the submenus' ids are built from it. */
  id: string
  groups: NavGroup[]
  /** Index in `groups` of the open group, `WHOLE_MENU`, or `null`. */
  open: number | null
  collapsed?: boolean
  /** A plain click on an entry with a page. */
  onNavigate: (item: ShellLink, event: MouseEvent) => void
  /** Opens the submenu of this group, or closes whichever is open (`null`). */
  onOpen: (index: number | null) => void
  start?: TemplateResult | typeof nothing
  end?: TemplateResult | typeof nothing
}

/** An entry the reader can open: it has a page and nothing withholds it. */
export const hasPage = (item: ShellLink): boolean => Boolean(item.href) && !item.noAccess

/** Why an entry cannot be opened, in words: `aria-disabled` means nothing on a plain span, and
 * the muted colour alone is no reason (rule 13). */
export function unavailableWord(item: ShellLink): TemplateResult {
  return html`<span class="visually-hidden"
    >${item.noAccess ? ', geen toegang' : ', niet beschikbaar'}</span
  >`
}

function follow(options: NavBarOptions, item: ShellLink, event: MouseEvent): void {
  if (!isPlainClick(event)) return
  options.onOpen(null)
  options.onNavigate(item, event)
}

function pageBadge(item: ShellLink): TemplateResult | typeof nothing {
  const badge = item.badge
  if (!badge) return nothing
  return renderBadge({
    value: badge.value,
    variant: badge.tone === 'new' ? 'label' : badge.tone === 'action' ? 'unread' : 'count',
    label: badge.label,
    className: 'lintje-navbar__badge',
  })
}

function barLink(options: NavBarOptions, item: ShellLink): TemplateResult {
  if (!hasPage(item)) {
    return html`<span class="lintje-navbar__entry is-unavailable" aria-disabled="true"
      >${item.label}${unavailableWord(item)}</span
    >`
  }
  const active = Boolean(item.active)
  return html`<a
    class=${classMap({ 'lintje-navbar__entry': true, 'focus-inset': true, 'is-active': active })}
    href=${item.href as string}
    aria-current=${active ? 'page' : nothing}
    @click=${(event: MouseEvent) => follow(options, item, event)}
    ><span class="lintje-navbar__label">${item.label}</span></a
  >`
}

function pageLink(options: NavBarOptions, item: ShellLink): TemplateResult {
  const content = html`${renderIcon(item.icon, { size: 20, src: item.iconSrc })}
    <span class="lintje-navbar__page-text">
      <span class="lintje-navbar__label">${item.label}</span>
      ${
        item.metric
          ? html`<span class="lintje-navbar__metric"
              ><span class="lintje-navbar__metric-value">${item.metric.value}</span> ${
                item.metric.label
              }</span
            >`
          : nothing
      }
    </span>
    ${
      item.noAccess
        ? renderIcon('gebruiksvoorwerpen-hangslot-dicht', { size: 16, label: 'Geen toegang' })
        : hasPage(item)
          ? nothing
          : unavailableWord(item)
    }
    ${pageBadge(item)}`
  if (!hasPage(item)) {
    return html`<span
      class=${classMap({
        'lintje-navbar__page': true,
        'is-unavailable': true,
        'is-no-access': Boolean(item.noAccess),
      })}
      aria-disabled="true"
      >${content}</span
    >`
  }
  const active = Boolean(item.active)
  return html`<a
    class=${classMap({ 'lintje-navbar__page': true, 'is-active': active })}
    href=${item.href as string}
    aria-current=${active ? 'page' : nothing}
    @click=${(event: MouseEvent) => follow(options, item, event)}
    >${content}</a
  >`
}

function barPanel(
  options: NavBarOptions,
  index: number,
  panel: string,
  label: string,
  active: boolean,
  content: (entry: string) => TemplateResult,
  extra: Record<string, boolean> = {},
): TemplateResult {
  const open = options.open === index
  const whole = index === WHOLE_MENU
  const entry = `${panel}-entry`
  return html`<div class="lintje-navbar__group">
    <button
      type="button"
      id=${entry}
      class=${classMap({
        'lintje-navbar__entry': true,
        'lintje-navbar__entry--group': true,
        'focus-inset': true,
        'is-active': active,
        'is-open': open,
        ...extra,
      })}
      aria-expanded=${String(open)}
      aria-controls=${panel}
      @click=${(event: MouseEvent) => {
        // A group's pointer click never closes: hover has opened it already, and closing again
        // would make the entry blink. "Menu" opens on a click only, so every click toggles it.
        options.onOpen(open && (whole || event.detail === 0) ? null : index)
      }}
      @mouseenter=${whole ? nothing : () => options.onOpen(index)}
    >
      ${
        whole
          ? open
            ? html`<span class="lintje-navbar__label">Sluiten</span>${renderIcon('functioneel-kruis', { size: 16 })}`
            : html`${renderIcon('functioneel-menu', { size: 16 })}<span class="lintje-navbar__label">${label}</span>`
          : html`<span class="lintje-navbar__label">${label}</span>
              ${renderIcon('functioneel-delta-omlaag', { size: 16, rotate: open ? 180 : undefined })}`
      }
    </button>
    ${open ? html`<div id=${panel} class="lintje-navbar__submenu">${content(entry)}</div>` : nothing}
  </div>`
}

function pageList(options: NavBarOptions, items: ShellLink[], labelledBy: string): TemplateResult {
  return html`<ul class="lintje-navbar__pages" aria-labelledby=${labelledBy}>
    ${items.map((item) => html`<li class="lintje-navbar__item">${pageLink(options, item)}</li>`)}
  </ul>`
}

const isActiveIn = (items: ShellLink[]): boolean =>
  items.some((item) => hasPage(item) && Boolean(item.active))

function barGroup(options: NavBarOptions, group: NavGroup, index: number): TemplateResult {
  return barPanel(
    options,
    index,
    `${options.id}-submenu-${index}`,
    group.heading ?? '',
    isActiveIn(group.items),
    (entry) => pageList(options, group.items, entry),
  )
}

/**
 * "Menu": headingless pages first, then each headed group under its heading. It never carries the
 * active edge: the reader's page is nearly always in it, so the mark would say nothing.
 */
function barMenu(options: NavBarOptions): TemplateResult {
  const panel = `${options.id}-menu`
  const loose = options.groups.filter((group) => !group.heading).flatMap((group) => group.items)
  return barPanel(
    options,
    WHOLE_MENU,
    panel,
    'Menu',
    false,
    (entry) => html`${loose.length ? pageList(options, loose, entry) : nothing}
      ${options.groups.map((group, index) => {
        if (!group.heading) return nothing
        const heading = `${panel}-heading-${index}`
        return html`<p id=${heading} class="lintje-navbar__heading">${group.heading}</p>
          ${pageList(options, group.items, heading)}`
      })}`,
    { 'lintje-navbar__entry--menu': true },
  )
}

export function renderNavBar(options: NavBarOptions): TemplateResult {
  const collapsed = Boolean(options.collapsed)
  // "Menu" was opened by a click, so leaving the bar does not close it.
  const leave = (): void => {
    if (options.open !== WHOLE_MENU) options.onOpen(null)
  }
  return html`<div class="lintje-navbar" @mouseleave=${leave}>
    <div class="lintje-navbar__start">
      ${options.start ?? nothing}
      <nav class="lintje-navbar__entries" aria-label="Hoofdnavigatie">
        <div
          class=${classMap({ 'lintje-navbar__list': true, 'is-hidden': collapsed })}
          ?inert=${collapsed}
          aria-hidden=${collapsed ? 'true' : nothing}
        >
          ${options.groups.map((group, index) =>
            group.heading
              ? barGroup(options, group, index)
              : group.items.map((item) => barLink(options, item)),
          )}
        </div>
        ${collapsed ? barMenu(options) : nothing}
      </nav>
    </div>
    ${options.end ? html`<div class="lintje-navbar__end">${options.end}</div>` : nothing}
  </div>`
}

export interface SubmenuHost extends ReactiveControllerHost {
  /** As `NavBarOptions.open`. */
  openGroup: number | null
  readonly renderRoot: HTMLElement | DocumentFragment
}

/**
 * Closes the open submenu from outside the bar: Escape (unless a dialog over the bar owns it), a
 * click outside, focus leaving, a viewport under 768 px. It also decides `collapsed` (`measure`).
 * Both widths compared are independent of the outcome, so it cannot flip back and forth.
 */
export class SubmenuController implements ReactiveController {
  readonly #mobile: MediaController
  /** Pass as `NavBarOptions.collapsed`. */
  collapsed = false
  #observer: ResizeObserver | null = null
  #observed: Element[] = []

  constructor(private readonly host: SubmenuHost) {
    host.addController(this)
    this.#mobile = new MediaController(host, MOBILE)
  }

  get #bar(): HTMLElement | null {
    return this.host.renderRoot.querySelector<HTMLElement>('.lintje-navbar')
  }

  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || this.host.openGroup === null) return
    const bar = this.#bar
    if (bar && !ownsEscape(bar)) return
    const entry = this.host.renderRoot.querySelector<HTMLButtonElement>(
      '.lintje-navbar__entry[aria-expanded="true"]',
    )
    // A submenu opened by hover closes without taking the focus from where it is.
    const group = entry?.parentElement
    const refocus = group ? holdsFocus(group) : false
    this.host.openGroup = null
    if (refocus) entry?.focus()
  }

  readonly #onClick = (event: MouseEvent): void => {
    if (this.host.openGroup === null) return
    const bar = this.#bar
    if (bar && event.composedPath().includes(bar)) return
    this.host.openGroup = null
  }

  /** Focus to nowhere (a click on the page) is `#onClick`'s. */
  readonly #onFocusOut = (event: Event): void => {
    if (this.host.openGroup === null) return
    const next = (event as FocusEvent).relatedTarget as Node | null
    const bar = this.#bar
    if (!next || !bar || bar.contains(next)) return
    this.host.openGroup = null
  }

  hostConnected(): void {
    document.addEventListener('keydown', this.#onKeyDown)
    document.addEventListener('click', this.#onClick)
    this.host.renderRoot.addEventListener('focusout', this.#onFocusOut)
  }

  hostDisconnected(): void {
    document.removeEventListener('keydown', this.#onKeyDown)
    document.removeEventListener('click', this.#onClick)
    this.host.renderRoot.removeEventListener('focusout', this.#onFocusOut)
    this.#observer?.disconnect()
    this.#observer = null
    this.#observed = []
  }

  /** Below 768 px there is no bar: the open group closes and stays closed on widening. */
  hostUpdate(): void {
    if (this.#mobile.matches && this.host.openGroup !== null) this.host.openGroup = null
  }

  hostUpdated(): void {
    this.measure()
  }

  /**
   * A change of `collapsed` closes whatever was open, whose entry has gone. Without layout it
   * leaves the state as is. An open panel gets the room under the bar to scroll inside itself.
   */
  measure(): void {
    const root = this.host.renderRoot
    const nav = root.querySelector('.lintje-navbar__entries')
    const list = root.querySelector('.lintje-navbar__list')
    this.#observe([nav, list].filter((box): box is Element => box !== null))
    const bar = this.#bar
    if (bar && this.host.openGroup !== null) {
      const room = Math.max(0, window.innerHeight - bar.getBoundingClientRect().bottom)
      bar.style.setProperty('--lintje-navbar-room', `${Math.floor(room)}px`)
    }
    if (!nav || !list) return
    const need = list.getBoundingClientRect().width
    if (!need) return
    const collapsed = need > nav.getBoundingClientRect().width + 0.5
    if (collapsed === this.collapsed) return
    this.collapsed = collapsed
    this.host.openGroup = null
    this.host.requestUpdate()
  }

  #observe(boxes: Element[]): void {
    if (typeof ResizeObserver === 'undefined') return
    if (
      boxes.length === this.#observed.length &&
      boxes.every((box, i) => box === this.#observed[i])
    )
      return
    this.#observer ??= new ResizeObserver(() => this.measure())
    this.#observer.disconnect()
    for (const box of boxes) this.#observer.observe(box)
    this.#observed = boxes
  }
}

/** A sibling of the bars: inside the bar's stacking context it would dim the submenu itself. */
export function renderHeaderScrim(visible: boolean): TemplateResult | typeof nothing {
  return visible ? html`<div class="lintje-header-scrim" aria-hidden="true"></div>` : nothing
}
