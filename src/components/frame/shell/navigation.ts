/** The side menu (pinned panel, rail, foot): render functions of `<lintje-shell>`. */
import {
  html,
  nothing,
  type ReactiveController,
  type ReactiveControllerHost,
  type TemplateResult,
} from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { renderIcon } from '../../../icons/render'
import { renderBadge } from '../../../primitives/badge/badge'
import { hasPage, unavailableWord, type NavGroup } from './header'
import type { ShellData, ShellLink } from '../../../types'
import type { LintjeShell } from './shell'
import { isPlainClick } from '../../../core/links'
import { deepActiveElement, holdsFocus } from '../../../core/focus'
import { focusTarget, tabbables } from '../../shared/focus-trap'
import { lengthPx } from '../../../core/length'

/** The pin's name stays the same; `aria-pressed` says whether the menu is pinned. */
export const PIN_LABEL = 'Menu vastzetten'

export function pinContent(pinned: boolean): { content: TemplateResult | string; asText: boolean } {
  const glyph = renderIcon(pinned ? 'kantoor-label' : 'kantoor-label-outline', { size: 16 })
  return glyph === nothing
    ? { content: 'Vastzetten', asText: true }
    : { content: glyph, asText: false }
}

/** `element.matches(selector)`, false where the engine does not know the selector. */
function matches(element: Element | null | undefined, selector: string): boolean {
  try {
    return element?.matches(selector) ?? false
  } catch {
    return false
  }
}

/** The focus is in the menu and was put there from the keyboard: the rail stays expanded. */
const keyboardInside = (nav: Element): boolean =>
  holdsFocus(nav) && matches(deepActiveElement(), ':focus-visible')

/**
 * The rail expands under the pointer and around the keyboard focus, and Escape folds it. What
 * only the expanded rail draws (the pin, "Afmelden") hands the focus back to the control before
 * it, else the one after, which does not expand the rail again.
 */
function railEvents(shell: LintjeShell, rail: boolean) {
  return {
    mouseenter: (): void => {
      if (rail) shell.railExpanded = true
    },
    mouseleave: (event: MouseEvent): void => {
      if (!keyboardInside(event.currentTarget as Element)) shell.railExpanded = false
    },
    focusin: (): void => {
      if (shell.railRefocus) shell.railRefocus = false
      else if (rail) shell.railExpanded = true
    },
    focusout: (event: FocusEvent): void => {
      const nav = event.currentTarget as Element
      const next = event.relatedTarget
      if (next instanceof Node && nav.contains(next)) return
      if (!matches(nav, ':hover')) shell.railExpanded = false
    },
    keydown: async (event: KeyboardEvent): Promise<void> => {
      if (event.key !== 'Escape' || !rail || !shell.railExpanded) return
      const nav = event.currentTarget as HTMLElement
      const focused = deepActiveElement()
      const order = tabbables(nav)
      const at = focused ? order.indexOf(focused) : -1
      const vanishes = (control: Element): boolean =>
        Boolean(control.closest('.lintje-nav__pin, .lintje-nav__logout'))
      shell.railExpanded = false
      if (at < 0 || !vanishes(order[at])) return
      const stays = (control: HTMLElement): boolean => !vanishes(control)
      const target = order.slice(0, at).reverse().find(stays) ?? order.slice(at + 1).find(stays)
      await shell.updateComplete
      if (!target?.isConnected) return
      shell.railRefocus = true
      focusTarget(target).focus()
    },
  }
}

/**
 * The menu's own scrollbar. A styled native bar takes width in every browser, which pulls the
 * rows' fill off the menu's edge, so the list hides its bar and this sizes and places an overlay
 * thumb; showing and fading it is CSS. Only the pointer uses it: keys and the wheel scroll the list.
 */
export class NavScrollbar implements ReactiveController {
  readonly #host: ReactiveControllerHost & HTMLElement & { renderRoot: ParentNode }
  #observer: ResizeObserver | null = null
  #observed: Element | null = null

  constructor(host: ReactiveControllerHost & HTMLElement & { renderRoot: ParentNode }) {
    this.#host = host
    host.addController(this)
  }

  get #list(): HTMLElement | null {
    return this.#host.renderRoot.querySelector<HTMLElement>('.lintje-nav__list')
  }

  hostUpdated(): void {
    this.draw()
  }

  hostDisconnected(): void {
    this.#observer?.disconnect()
    this.#observer = null
    this.#observed = null
  }

  /** The list's `scroll`, a resize of the list and every update. */
  readonly draw = (): void => {
    const list = this.#list
    const thumb = this.#host.renderRoot.querySelector<HTMLElement>('.lintje-nav__thumb')
    this.#observe(list)
    if (!list || !thumb) return
    const track = list.clientHeight
    const content = list.scrollHeight
    // Nothing to scroll, or nothing drawn (below 768 px the menu is `display: none`).
    if (content <= track + 1) {
      thumb.style.height = '0px'
      thumb.style.transform = ''
      return
    }
    // The visible share of the list, never shorter than a pointer still grabs.
    const height = Math.max(
      lengthPx(this.#host, '--space-8', 32),
      Math.round((track * track) / content),
    )
    const top = list.offsetTop + Math.round((list.scrollTop / (content - track)) * (track - height))
    thumb.style.height = `${height}px`
    thumb.style.transform = `translateY(${top}px)`
  }

  /** Dragging the thumb scrolls the list; the capture keeps the drag past the menu's edge. */
  readonly grab = (event: PointerEvent): void => {
    const thumb = event.currentTarget as HTMLElement
    const list = this.#list
    if (!list || event.button !== 0) return
    const travel = list.clientHeight - thumb.offsetHeight
    if (travel <= 0) return
    const scale = (list.scrollHeight - list.clientHeight) / travel
    const startY = event.clientY
    const startScroll = list.scrollTop
    event.preventDefault()
    try {
      thumb.setPointerCapture(event.pointerId)
    } catch {
      // A pointer that is no longer down: the drag ends at once.
    }
    thumb.classList.add('is-dragging')
    const move = (moved: PointerEvent): void => {
      list.scrollTop = startScroll + (moved.clientY - startY) * scale
    }
    const stop = (): void => {
      thumb.classList.remove('is-dragging')
      thumb.removeEventListener('pointermove', move)
      thumb.removeEventListener('pointerup', stop)
      thumb.removeEventListener('pointercancel', stop)
    }
    thumb.addEventListener('pointermove', move)
    thumb.addEventListener('pointerup', stop)
    thumb.addEventListener('pointercancel', stop)
  }

  #observe(list: HTMLElement | null): void {
    if (list === this.#observed || typeof ResizeObserver === 'undefined') return
    this.#observer ??= new ResizeObserver(() => this.draw())
    this.#observer.disconnect()
    if (list) this.#observer.observe(list)
    this.#observed = list
  }
}

/** The lock, or the words "geen toegang": the strikethrough alone is not a reason (rule 13). */
export function noAccessMark(className: string): TemplateResult {
  const glyph = renderIcon('gebruiksvoorwerpen-hangslot-dicht', { size: 16, label: 'Geen toegang' })
  return glyph === nothing ? html`<span class=${className}>geen toegang</span>` : glyph
}

export const versionText = (version: string): string => `v${version.replace(/^v/, '')}`

export const feedbackLabel = (feedback: NonNullable<ShellData['feedback']>): string =>
  feedback.label ?? 'Vragen of feedback'

/** The logo as a link to `data.home`, or the logo alone. */
export function homeLink(
  shell: LintjeShell,
  className: string,
  width: number,
  onNavigate?: () => void,
): TemplateResult {
  const data = shell.data
  const logo = html`<lintje-logo
    width=${width}
    src=${data?.logo ?? nothing}
    name=${data?.emblem?.name ?? nothing}
    alt=${data?.emblem?.label ?? nothing}
  ></lintje-logo>`
  const home = data?.home
  if (!home) return html`<span class=${className}>${logo}</span>`
  return html`<a
    href=${home}
    class=${className}
    aria-label="Naar de startpagina"
    title="Naar de startpagina"
    @click=${(event: MouseEvent) => {
      if (!isPlainClick(event)) return
      onNavigate?.()
      shell.follow(home, event)
    }}
    >${logo}</a
  >`
}

export function navRow(shell: LintjeShell, item: ShellLink, open: boolean): TemplateResult {
  const page = hasPage(item)
  const muted = !page
  const content = html`
    ${renderIcon(item.icon, { size: 20, src: item.iconSrc })}
    ${
      // In the rail the label is only heard; expanding on hover and focus shows it.
      open
        ? html`<span class="lintje-nav__label">${item.label}</span>`
        : html`<span class="visually-hidden">${item.label}</span>`
    }
    ${
      open && item.metric
        ? html`<span class="lintje-nav__metric">${item.metric.value}</span>`
        : nothing
    }
    ${item.noAccess && open ? noAccessMark('lintje-nav__metric') : nothing}
    ${!page && !(item.noAccess && open) ? unavailableWord(item) : nothing}
    ${
      // A bare "3" means nothing read aloud: with a label the figure is only seen and the
      // label only heard. `action` is the unread counter, `count` the menu's counter, `new` the word.
      item.badge
        ? renderBadge({
            value: item.badge.value,
            variant: item.badge.tone === 'new' ? 'label' : 'unread',
            surface: item.badge.tone === 'action' && !muted ? undefined : 'nav',
            muted,
            label: item.badge.label,
            className: `lintje-nav__badge lintje-nav__badge--${item.badge.tone}`,
          })
        : nothing
    }
  `
  if (page) {
    return html`<a
      href=${item.href as string}
      class=${classMap({ 'lintje-nav__item': true, 'is-active': Boolean(item.active) })}
      aria-current=${item.active ? 'page' : nothing}
      @click=${(event: MouseEvent) => {
        if (isPlainClick(event)) shell.follow(item.href as string, event)
      }}
      >${content}</a
    >`
  }
  return html`<span
    class=${classMap({
      'lintje-nav__item': true,
      'is-no-page': !item.noAccess,
      'is-no-access': Boolean(item.noAccess),
    })}
    aria-disabled="true"
    title=${open ? nothing : item.label}
    >${content}</span
  >`
}

export function renderNavigation(shell: LintjeShell, groups: NavGroup[]): TemplateResult {
  const data = shell.data
  const menu = data?.menu ?? 'pinned'
  // Below 1440 px the menu is always a rail; the pinned choice applies from 1440 up.
  const isWide = shell.wide.matches
  const rail = menu === 'unpinned' || !isWide
  const open = !rail || shell.railExpanded
  const pin = pinContent(menu === 'pinned')
  const on = railEvents(shell, rail)

  return html`
    <nav
      class=${classMap({
        'lintje-nav': true,
        'lintje-nav--rail': rail,
        'is-expanded': shell.railExpanded,
      })}
      aria-label="Hoofdnavigatie"
      @mouseenter=${on.mouseenter}
      @mouseleave=${on.mouseleave}
      @focusin=${on.focusin}
      @focusout=${on.focusout}
      @keydown=${on.keydown}
    >
      <div class="lintje-nav__header">
        ${homeLink(shell, 'lintje-nav__home', 44)}
        ${
          open && isWide
            ? html`<button
              type="button"
              class=${classMap({ 'lintje-nav__pin': true, 'lintje-nav__pin--text': pin.asText })}
              aria-pressed=${menu === 'pinned'}
              aria-label=${pin.asText ? nothing : PIN_LABEL}
              title=${PIN_LABEL}
              @click=${(event: MouseEvent) => {
                shell.changeView({ menu: menu === 'pinned' ? 'unpinned' : 'pinned' })
                // From the keyboard the rail stays open, so the focused pin stays drawn.
                const nav = (event.currentTarget as Element).closest('.lintje-nav')
                if (!nav || !keyboardInside(nav)) shell.railExpanded = false
              }}
            >
              ${pin.content}
            </button>`
            : nothing
        }
      </div>

      <div class="lintje-nav__list" @scroll=${shell.navScrollbar.draw}>
        ${groups.map(
          (group, index) => html`<div
            class="lintje-nav__group"
            role=${group.heading ? 'group' : nothing}
            aria-labelledby=${group.heading ? `lintje-nav-group-${index}` : nothing}
          >
            <!-- One element in both states, with a fixed height: the text heading when
                 expanded, a line in the same spot in the rail. -->
            ${
              group.heading
                ? html`<p class="lintje-nav__section-heading" id=${`lintje-nav-group-${index}`}>
                  <span class="lintje-nav__section-label">${group.heading}</span>
                  <span class="lintje-nav__separator" aria-hidden="true"></span>
                </p>`
                : nothing
            }
            ${group.items.map((item) => navRow(shell, item, open))}
          </div>`,
        )}
      </div>
      <!-- The list's scrollbar, right after it: its focus shows the thumb. -->
      <span
        class="lintje-nav__thumb"
        aria-hidden="true"
        @pointerdown=${shell.navScrollbar.grab}
      ></span>

      ${
        data?.environment
          ? html`<p class="lintje-nav__environment" title=${data.environment}>
            <!-- Both texts always in the DOM, like the headings: the short one for the rail. -->
            <span class="lintje-nav__environment-label">${data.environment}</span>
            <span class="lintje-nav__environment-short" aria-hidden="true"
              >${data.environment.slice(0, 3)}</span
            >
          </p>`
          : nothing
      }
      ${renderNavMeta(shell, open)}
      ${
        data?.user
          ? html`<div class="lintje-nav__footer">
            <span class="lintje-nav__avatar">${data.user.initials}</span>
            <!-- Always in the DOM; the rail hides it with opacity. -->
            <span class="lintje-nav__user">
              <b>${data.user.name}</b>
              ${data.user.role ? html`<span class="lintje-nav__role">${data.user.role}</span>` : nothing}
            </span>
            ${data.logout ? logoutButton(data.logout, 'lintje-nav__logout-button', open) : nothing}
          </div>`
          : nothing
      }
    </nav>
    <!-- Darkens the page while the rail lies over it expanded; purely visual. -->
    ${
      rail
        ? html`<div
          class=${classMap({ 'lintje-nav__scrim': true, 'is-visible': shell.railExpanded })}
          aria-hidden="true"
        ></div>`
        : nothing
    }
  `
}

/**
 * The block above the user: "Vragen of feedback" with the version, or the version alone. The
 * version-only row is not a `lintje-nav__item` (that class carries the hover) but keeps its
 * geometry, so the block below stands in the same place in both cases.
 */
export function renderNavMeta(shell: LintjeShell, open: boolean): TemplateResult | typeof nothing {
  const data = shell.data
  const version = data?.version ? versionText(data.version) : null
  if (data?.feedback) {
    const label = feedbackLabel(data.feedback)
    return html`<a class="lintje-nav__item lintje-nav__feedback" href=${data.feedback.href}>
      ${renderIcon('functioneel-mail', { size: 20, label: open ? undefined : label })}
      ${open ? html`<span class="lintje-nav__label">${label}</span>` : nothing}
      ${
        open && version
          ? html`<span class="lintje-nav__metric lintje-nav__version">${version}</span>`
          : nothing
      }
    </a>`
  }
  if (!version) return nothing
  return html`<p class="lintje-nav__version-row">
    ${open ? html`<span class="lintje-nav__metric lintje-nav__version">${version}</span>` : nothing}
  </p>`
}

/**
 * Afmelden, in its own form and not a fetch: the server answers with a redirect to the
 * identity provider, which only a navigation follows. The token travels in `csrf_token`,
 * which the middleware reads from a form-encoded body. Collapsed, the form is `hidden` and
 * not merely transparent, so nothing invisible is in the tab order.
 */
export function logoutButton(
  logout: NonNullable<ShellData['logout']>,
  buttonClass: string,
  open: boolean,
): TemplateResult {
  const label = 'Afmelden'
  const glyph = renderIcon('functioneel-uitloggen', { size: 18 })
  return html`<form class="lintje-nav__logout" method="post" action=${logout.href} ?hidden=${!open}>
    <input type="hidden" name="csrf_token" value=${logout.token} />
    <button type="submit" class=${buttonClass} aria-label=${label} title=${label}>
      ${glyph === nothing ? html`<span class="lintje-nav__logout-text">${label}</span>` : glyph}
    </button>
  </form>`
}
