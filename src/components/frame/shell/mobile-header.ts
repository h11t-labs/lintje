/** The header below 768 px and the menu under it: render functions of `<lintje-shell>`. */
import { html, nothing, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { renderIcon } from '../../../icons/render'
import { renderBadge } from '../../../primitives/badge/badge'
import { setFrameState } from '../../../core/frame-state'
import { hasPage, unavailableWord, type NavGroup } from './header'
import type { ShellLink } from '../../../types'
import type { LintjeShell } from './shell'
import { feedbackLabel, homeLink, noAccessMark, versionText } from './navigation'
import { renderBarTools } from './top-bar'
import { isPlainClick } from '../../../core/links'

/**
 * The environment and feedback rows in the mobile panel: below 768 px there is no rail to show
 * them, and a page's own footer is the host's. The version stands in the user menu, or here
 * without a user.
 */
export function renderMobileMeta(shell: LintjeShell): TemplateResult {
  const data = shell.data
  const version = data?.version && !data.user ? versionText(data.version) : null
  return html`
    ${
      data?.environment
        ? html`<p class="lintje-mobile-menu__environment">${data.environment}</p>`
        : nothing
    }
    ${
      data?.feedback
        ? html`<a class="lintje-mobile-menu__item lintje-mobile-menu__feedback" href=${data.feedback.href}>
          ${renderIcon('functioneel-mail', { size: 20 })}
          <span class="lintje-mobile-menu__label">${feedbackLabel(data.feedback)}</span>
          ${version ? html`<span class="lintje-mobile-menu__version">${version}</span>` : nothing}
        </a>`
        : version
          ? html`<p class="lintje-mobile-menu__item lintje-mobile-menu__feedback">
            <span class="lintje-mobile-menu__version">${version}</span>
          </p>`
          : nothing
    }
  `
}

/**
 * Mobile header. The header and the panel stand in one region, `.lintje-mobile-chrome`: while the
 * menu is open it is the modal dialog and the focus trap keeps Tab inside, so the dialog's own
 * close button is not hidden from a screen reader.
 */
export function renderMobileHeader(shell: LintjeShell, groups: NavGroup[]): TemplateResult {
  const data = shell.data
  const count = shell.store.state.modifiedCount
  const open = shell.menuOpen
  const word = 'lintje-mobile-header__word'
  const close = (): void => {
    shell.menuOpen = false
  }
  return html`<div
    class="lintje-mobile-chrome"
    tabindex="-1"
    role=${open ? 'dialog' : nothing}
    aria-modal=${open ? 'true' : nothing}
    aria-label=${open ? 'Menu' : nothing}
  >
    <header class=${classMap({ 'lintje-mobile-header': true, 'is-compact': shell.headerCompact })}>
      ${
        shell.layout === 'top'
          ? // The logo is in the logo bar above; this name is the page's one h1 below 768 px.
            data?.name
            ? html`<h1 class="lintje-mobile-header__title" title=${data.name}>${data.name}</h1>`
            : nothing
          : html`
              <!-- The page's one h1 below 768 px. The header draws no name — the page
                   header's kicker shows it — so the heading is there for the outline only.
                   At 768 px and up this header is display: none and the top bar has it. -->
              ${data?.name ? html`<h1 class="visually-hidden">${data.name}</h1>` : nothing}
              ${homeLink(shell, 'lintje-mobile-header__home', 32, close)}
            `
      }
      <div class="lintje-mobile-header__actions">
        <!-- Open, the menu is a dialog of its own: only its close button stays. -->
        ${
          open
            ? nothing
            : html`${shell.renderSearch()}${shell.renderNotifications()}${
                // Only where this header shows, so an open panel is never drawn twice.
                shell.mobile.matches ? renderBarTools(shell) : nothing
              }${
                !shell.store.state.hasFilters
                  ? // No filter zone on this page: a Filters button would open nothing.
                    nothing
                  : html`<button
                    type="button"
                    class="lintje-mobile-header__button"
                    aria-haspopup="dialog"
                    aria-expanded=${shell.store.state.sheetOpen}
                    @click=${() => setFrameState({ sheetOpen: true })}
                  >
                    ${renderIcon('functioneel-filters', { size: 16 })}
                    <span class=${word}>Filters</span>
                    ${
                      count > 0
                        ? // The number of modified filters: the attention badge, near-black on orange.
                          renderBadge({
                            value: count,
                            label: `${count} aangepast`,
                            tone: 'attention',
                            className: 'lintje-mobile-header__badge',
                          })
                        : nothing
                    }
                  </button>`
              }`
        }
        <!-- One button in both states, so opening the menu leaves the focus
             where it is: only the label and the glyph change places. -->
        <button
          type="button"
          class="lintje-mobile-header__button"
          aria-expanded=${open}
          aria-controls="lintje-mobile-menu-panel"
          @click=${() => {
            shell.menuOpen = !shell.menuOpen
          }}
        >
          ${
            open
              ? html`<span class=${word}>Sluiten</span>${renderIcon('functioneel-kruis', { size: 16 })}`
              : html`${renderIcon('functioneel-menu', { size: 16 })}<span class=${word}>Menu</span>`
          }
        </button>
      </div>
    </header>

    ${
      open || shell.menuLeaving
        ? html`<div
          class=${classMap({ 'lintje-mobile-menu': true, 'is-leaving': shell.menuLeaving })}
          id="lintje-mobile-menu-panel"
          ?inert=${shell.menuLeaving}
          @animationend=${(event: AnimationEvent) => {
            if (event.target === event.currentTarget && shell.menuLeaving) shell.menuLeft()
          }}
        >
          <nav class="lintje-mobile-menu__list" aria-label="Hoofdnavigatie">
            ${groups.map(
              (group, index) => html`<div
                role=${group.heading ? 'group' : nothing}
                aria-labelledby=${group.heading ? `lintje-mobile-menu-group-${index}` : nothing}
              >
                ${
                  group.heading
                    ? html`<p
                        class="lintje-mobile-menu__heading"
                        id=${`lintje-mobile-menu-group-${index}`}
                      >
                        ${group.heading}
                      </p>`
                    : nothing
                }
                ${group.items.map((item) => renderMobileItem(shell, item))}
              </div>`,
            )}
          </nav>
          ${renderMobileMeta(shell)} ${shell.renderUserMenu(true)}
        </div>`
        : nothing
    }
  </div>`
}

export function renderMobileItem(shell: LintjeShell, item: ShellLink): TemplateResult {
  const content = html`
    ${renderIcon(item.icon, { size: 20, src: item.iconSrc })}
    <span class="lintje-mobile-menu__label">${item.label}</span>
    ${item.noAccess ? noAccessMark('lintje-mobile-menu__meta') : nothing}
    ${hasPage(item) || item.noAccess ? nothing : unavailableWord(item)}
  `
  if (!hasPage(item)) {
    return html`<span class="lintje-mobile-menu__item is-muted" aria-disabled="true"
      >${content}</span
    >`
  }
  // Selecting closes the menu.
  return html`<a
    href=${item.href as string}
    class=${classMap({ 'lintje-mobile-menu__item': true, 'is-active': Boolean(item.active) })}
    aria-current=${item.active ? 'page' : nothing}
    @click=${(event: MouseEvent) => {
      if (!isPlainClick(event)) return
      shell.menuOpen = false
      shell.follow(item.href as string, event)
    }}
    >${content}</a
  >`
}
