/**
 * Below 768 px: the bar under the logo bar, the menu's panel and the tabs. Render functions of
 * `<lintje-shell>`, the same in both layouts.
 */
import { html, nothing, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { renderIcon } from '../../../icons/render'
import { hasPage, isAction, noAccessMark, unavailableNote, type NavGroup } from './header'
import type { ShellLink } from '../../../types'
import { renderSheetHead } from '../../shared/sheet'
import type { LintjeShell } from './shell'
import { feedbackLabel, versionText } from './navigation'
import { renderShare, renderView } from './top-bar'
import { renderTabBar, type TabPlan } from './tab-bar'
import { isPlainClick } from '../../../core/links'

/** A row of the panel that opens a sheet of the shell's own: "Weergave" or "Delen". */
function toolRow(label: string, icon: string, className: string, open: () => void): TemplateResult {
  return html`<button
    type="button"
    class=${`lintje-mobile-menu__item lintje-mobile-menu__item--action ${className}`}
    aria-haspopup="dialog"
    @click=${open}
  >
    ${renderIcon(icon, { size: 20 })}
    <span class="lintje-mobile-menu__label">${label}</span>
  </button>`
}

/**
 * The top of the panel: what the reader sets for this page, and what the host puts at the end
 * of the bar (`end`). On a phone the bar has no room for them.
 */
function renderPanelTools(shell: LintjeShell): TemplateResult {
  const data = shell.data
  return html`<div class="lintje-mobile-menu__tools">
    ${
      data?.view
        ? toolRow('Weergave', 'functioneel-darkmode', 'lintje-view__button', () => {
            shell.viewOpen = true
            shell.shareOpen = false
          })
        : nothing
    }
    ${
      data?.share
        ? toolRow('Delen', 'functioneel-delen', 'lintje-share__button', () => {
            shell.shareOpen = true
            shell.viewOpen = false
          })
        : nothing
    }
    <slot name="end"></slot>
  </div>`
}

/**
 * The foot of the panel: feedback and the version. The version stands in the user menu, or here
 * without a user.
 */
export function renderMobileMeta(shell: LintjeShell): TemplateResult | typeof nothing {
  const data = shell.data
  if (!data) return nothing
  const version = data.version && !data.user ? versionText(data.version) : null
  if (!data.feedback && !version) return nothing
  return html`<div
    class="lintje-mobile-menu__about"
    role="group"
    aria-labelledby="lintje-mobile-menu-about"
  >
    <p class="lintje-mobile-menu__heading" id="lintje-mobile-menu-about">Over deze app</p>
    ${
      data.feedback
        ? html`<a
          class="lintje-mobile-menu__item lintje-mobile-menu__feedback"
          href=${data.feedback.href}
        >
          ${renderIcon('functioneel-mail', { size: 20 })}
          <span class="lintje-mobile-menu__label">${feedbackLabel(data.feedback)}</span>
        </a>`
        : nothing
    }
    ${version ? html`<p class="lintje-mobile-menu__version">${version}</p>` : nothing}
  </div>`
}

/**
 * The page's one h1 is the application's name; once the page's head has scrolled away, the
 * page's name stands above it and the name gets small.
 */
function renderTitles(shell: LintjeShell): TemplateResult | typeof nothing {
  const data = shell.data
  if (!data?.name) return nothing
  const swap = Boolean(data.pageName) && shell.store.state.titleHidden
  const className = swap ? 'lintje-mobile-header__title is-small' : 'lintje-mobile-header__title'
  const title = html`<h1 class=${className} title=${data.name}>${data.name}</h1>`
  return html`<div class="lintje-mobile-header__titles">
    ${
      swap
        ? html`<span class="lintje-mobile-header__page" aria-hidden="true">${data.pageName}</span>`
        : nothing
    }
    ${title}
  </div>`
}

function renderBack(shell: LintjeShell): TemplateResult | typeof nothing {
  const back = shell.data?.back
  if (!back) return nothing
  return html`<a
    class="lintje-mobile-header__back"
    href=${back.href}
    aria-label=${back.label ?? 'Terug'}
    @click=${(event: MouseEvent) => {
      if (isPlainClick(event)) shell.follow(back.href, event)
    }}
    >${renderIcon('functioneel-terug', { size: 20 })}</a
  >`
}

/**
 * The bar, the panel and the tabs stand in one region, `.lintje-mobile-chrome`: while the menu is
 * open it is the modal dialog and the focus trap keeps Tab inside, so the dialog's own close
 * button (Menu in the bar, or the tab Menu) is not hidden from a screen reader. `groups` is what
 * the panel holds: every page, with tabs too. A part that is a tab is not in the bar.
 */
export function renderMobileHeader(
  shell: LintjeShell,
  groups: NavGroup[],
  plan: TabPlan,
): TemplateResult {
  const data = shell.data
  const open = shell.menuOpen
  const tabbed = new Set(plan.parts)
  // On a phone the panel is a sheet from below, with a head and a veil.
  const sheet = shell.mobile.matches
  const close = (): void => {
    shell.menuOpen = false
  }
  const word = 'lintje-mobile-header__word'
  return html`<div
    class="lintje-mobile-chrome"
    tabindex="-1"
    role=${open ? 'dialog' : nothing}
    aria-modal=${open ? 'true' : nothing}
    aria-label=${open ? 'Menu' : nothing}
  >
    <!-- Under the open sheet's veil the bar cannot be reached; Tab skips it too. -->
    <header class="lintje-mobile-header" ?inert=${open}>
      ${renderBack(shell)} ${renderTitles(shell)}
      <div class="lintje-mobile-header__actions">
        ${tabbed.has('search') ? nothing : shell.renderSearch()}${
          tabbed.has('notifications') ? nothing : shell.renderNotifications()
        }${tabbed.has('user') ? nothing : shell.renderUserMenu('bar')}
        <!-- It opens the menu only: the sheet from below closes with its own button,
             since this one lies under the veil. It names its panel while there is one. -->
        ${
          tabbed.has('menu')
            ? nothing
            : html`<button
              type="button"
              class="lintje-mobile-header__button lintje-mobile-header__button--menu"
              aria-controls=${open ? 'lintje-mobile-menu-panel' : nothing}
              @click=${() => {
                shell.menuOpen = true
              }}
            >
              ${renderIcon('functioneel-menu', { size: 16 })}<span class=${word}>Menu</span>
            </button>`
        }
      </div>
    </header>

    ${
      sheet && (open || shell.menuLeaving)
        ? html`<div
            class=${classMap({
              'lintje-sheet__scrim': true,
              'lintje-sheet__scrim--tab': shell.tabsShown,
              'lintje-mobile-menu__scrim': true,
              'is-leaving': !open,
            })}
            @click=${close}
          ></div>`
        : nothing
    }
    ${
      open || shell.menuLeaving
        ? html`<div
          class=${classMap({
            'lintje-sheet': sheet,
            'lintje-sheet--tab': sheet && shell.tabsShown,
            'lintje-mobile-menu': true,
            'is-leaving': shell.menuLeaving,
          })}
          id="lintje-mobile-menu-panel"
          ?inert=${shell.menuLeaving}
          @animationend=${(event: AnimationEvent) => {
            if (event.target === event.currentTarget && shell.menuLeaving) shell.menuLeft()
          }}
        >
          ${
            sheet
              ? renderSheetHead({
                  title: 'Menu',
                  className: 'lintje-mobile-menu__head',
                  closeClass: 'lintje-mobile-menu__close',
                  onClose: close,
                })
              : nothing
          }
          ${
            data?.environment
              ? html`<p class="lintje-mobile-menu__environment">${data.environment}</p>`
              : nothing
          }
          ${renderPanelTools(shell)}
          <!-- With tabs the tab bar is the main navigation; the panel holds every page. -->
          <nav
            class="lintje-mobile-menu__list"
            aria-label=${shell.tabsShown ? 'Alle pagina’s' : 'Hoofdnavigatie'}
          >
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
          ${renderMobileMeta(shell)}
        </div>`
        : nothing
    }
    ${shell.tabsShown ? renderTabBar(shell, plan) : nothing}
    <!-- "Weergave" and "Delen" open from the panel as sheets over everything, the tabs too. -->
    ${
      (shell.viewOpen || shell.viewLeave.leaving) && data?.view
        ? html`<div class="lintje-view">${renderView(shell, data.view)}</div>`
        : nothing
    }
    ${
      (shell.shareOpen || shell.shareLeave.leaving) && data?.share
        ? html`<div class="lintje-share">${renderShare(shell)}</div>`
        : nothing
    }
  </div>`
}

export function renderMobileItem(shell: LintjeShell, item: ShellLink): TemplateResult {
  const content = html`
    ${renderIcon(item.icon, { size: 20, src: item.iconSrc })}
    <span class="lintje-mobile-menu__label"
      >${item.label}${
        hasPage(item) || isAction(item) || item.noAccess
          ? nothing
          : unavailableNote('lintje-mobile-menu__note')
      }</span
    >
    ${item.noAccess ? noAccessMark('lintje-mobile-menu__meta') : nothing}
  `
  if (isAction(item)) {
    return html`<button
      type="button"
      class="lintje-mobile-menu__item lintje-mobile-menu__item--action"
      @click=${() => {
        shell.menuOpen = false
        shell.act(item)
      }}
    >
      ${content}
    </button>`
  }
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
