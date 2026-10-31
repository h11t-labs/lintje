/**
 * The tab bar below 768 px (`mobile-tabs`): the loose pages as tabs at the bottom of the screen,
 * with the shell's parts the host sends there (`tab-parts`). Render functions of `<lintje-shell>`.
 */
import { html, nothing, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { renderIcon } from '../../../icons/render'
import { renderBadge } from '../../feedback/badge/badge'
import { isPlainClick } from '../../../core/links'
import type { ShellGroup, ShellLink } from '../../../types'
import { hasPage, isAction, unavailableWord } from './header'
import type { LintjeShell } from './shell'

/** The shell's parts that can stand as a tab instead of in the bar at the top. */
export type TabPart = 'search' | 'notifications' | 'user' | 'menu'
const TAB_PARTS: readonly TabPart[] = ['search', 'notifications', 'user', 'menu']

/** More tabs leave each too narrow for its word. */
export const MAX_TABS = 5

export interface TabPlan {
  /** The pages that are tabs, in the order of `navigation`. */
  pages: ShellLink[]
  /** The parts that are tabs, after the pages, Menu last. */
  parts: TabPart[]
  /** What is not a tab. The menu's panel holds every page, these and the tabs'. */
  rest: (ShellLink | ShellGroup)[]
}

/** `tab-parts`: names apart by spaces or commas; unset, Menu alone. */
export function parseTabParts(value: string | null | undefined): TabPart[] {
  if (value == null) return ['menu']
  const named = value.split(/[\s,]+/).filter(Boolean)
  return TAB_PARTS.filter((part) => named.includes(part))
}

/** The parts first claim their places; the loose pages fill the rest, in order. */
export function planTabs(navigation: (ShellLink | ShellGroup)[], parts: TabPart[]): TabPlan {
  const room = Math.max(0, MAX_TABS - parts.length)
  const pages: ShellLink[] = []
  const rest: (ShellLink | ShellGroup)[] = []
  for (const entry of navigation) {
    if (!('links' in entry) && pages.length < room) pages.push(entry)
    else rest.push(entry)
  }
  return { pages, parts, rest }
}

function glyph(name: string | undefined, src?: string, badge?: TemplateResult): TemplateResult {
  return html`<span class="lintje-tab-bar__glyph"
    >${renderIcon(name, { size: 24, src })}${badge ?? nothing}</span
  >`
}

/** The label is one line, cut with an ellipsis; the whole word stays the tab's name. */
function label(text: string): TemplateResult {
  return html`<span class="lintje-tab-bar__label">${text}</span>`
}

/** The menu's badge, on the glyph's corner: "Nieuw" becomes a dot, as in the folded rail. */
function badge(item: ShellLink, muted: boolean): TemplateResult | undefined {
  if (!item.badge) return undefined
  return renderBadge({
    value: item.badge.value,
    variant: item.badge.tone === 'new' ? 'label' : 'unread',
    surface: item.badge.tone === 'action' && !muted ? undefined : 'nav',
    muted,
    label: item.badge.label,
    className: `lintje-tab-bar__badge lintje-tab-bar__badge--${item.badge.tone}`,
  })
}

function pageTab(shell: LintjeShell, item: ShellLink): TemplateResult {
  if (isAction(item)) {
    return html`<button
      type="button"
      class="lintje-tab-bar__tab focus-inset"
      @click=${() => {
        shell.menuOpen = false
        shell.act(item)
      }}
    >
      ${glyph(item.icon, item.iconSrc, badge(item, false))} ${label(item.label)}
    </button>`
  }
  if (!hasPage(item)) {
    return html`<span class="lintje-tab-bar__tab is-muted" aria-disabled="true">
      ${glyph(item.icon, item.iconSrc, badge(item, true))} ${label(item.label)}
      ${unavailableWord(item)}
    </span>`
  }
  const active = Boolean(item.active)
  return html`<a
    class=${classMap({ 'lintje-tab-bar__tab': true, 'focus-inset': true, 'is-active': active })}
    href=${item.href as string}
    aria-current=${active ? 'page' : nothing}
    @click=${(event: MouseEvent) => {
      if (!isPlainClick(event)) return
      shell.menuOpen = false
      shell.follow(item.href as string, event)
    }}
  >
    ${glyph(item.icon, item.iconSrc, badge(item, false))} ${label(item.label)}
  </a>`
}

/** Menu is a button, never the reader's page: while its panel is open it reads Sluiten. */
function partTab(shell: LintjeShell, part: TabPart): TemplateResult | typeof nothing {
  if (part === 'search') {
    if (!shell.data?.search) return nothing
    return html`<button
      type="button"
      class="lintje-tab-bar__tab focus-inset"
      aria-keyshortcuts="/"
      @click=${() => {
        shell.menuOpen = false
        shell.askSearch()
      }}
    >
      ${glyph('functioneel-zoek')} ${label('Zoeken')}
    </button>`
  }
  if (part === 'notifications') return shell.renderNotifications(true)
  if (part === 'user') return shell.renderUserMenu('tab')
  const open = shell.menuOpen
  return html`<button
    type="button"
    class="lintje-tab-bar__tab lintje-tab-bar__tab--menu focus-inset"
    aria-controls=${open ? 'lintje-mobile-menu-panel' : nothing}
    @click=${() => {
      shell.menuOpen = !shell.menuOpen
    }}
  >
    ${glyph(open ? 'functioneel-kruis' : 'functioneel-menu')} ${label(open ? 'Sluiten' : 'Menu')}
  </button>`
}

export function renderTabBar(shell: LintjeShell, plan: TabPlan): TemplateResult {
  return html`<nav class="lintje-tab-bar" aria-label="Hoofdnavigatie">
    ${plan.pages.map((item) => pageTab(shell, item))}
    ${plan.parts.map((part) => partTab(shell, part))}
  </nav>`
}
