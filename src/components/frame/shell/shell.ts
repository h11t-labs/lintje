/**
 * `<lintje-shell>` — the frame around a page: the Rijkshuisstijl header above it (`layout`
 * `top`, the default) or the menu beside it (`side`), the mobile header and menu below 768 px,
 * and a `<main>` with the host's content.
 *
 * It never fetches and never reads the URL: the active page (`active`) and the reader's settings
 * (`view`, `menu`, `layout`) are the host's. A change goes out as `lintje-view-change` and comes
 * back as data. `name` is the page's one `h1`.
 *
 * Slots: `full` runs edge to edge above the content (a hero, a filter bar, a conversation); `header`
 * holds the page's title (`lintje-page-header`); the default slot the content, at the page's
 * width and padding; `footer` runs edge to edge under it all (`lintje-footer`).
 *
 * Events: `lintje-navigate` `{ href }`, `lintje-view-change`, `lintje-search-open`; from its
 * parts `lintje-action`, `lintje-logout`, `lintje-notification-open`, `lintje-notifications-read`.
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { LintjeElement, define, type FrameSettings } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import { badgeStyles } from '../../../primitives/badge/badge'
import '../../../primitives/button/button'
import '../../actions/logo/logo'
import '../../feedback/toast/toast'
import '../../actions/qr-code/qr-code'
import '../notifications/notifications'
import '../user-menu/user-menu'
import { MOBILE, WIDE, MediaController } from '../../../core/media'
import { lockScroll, scrollRoot } from '../../../core/host-config'
import { lengthPx } from '../../../core/length'
import { FocusTrap, ownsEscape } from '../../shared/focus-trap'
import { holdsFocus } from '../../../core/focus'
import { FrameStateController } from '../../../core/frame-state'
import type { ShellData, ShellGroup, ShellLink, ShellViewChange } from '../../../types'
import { NavScrollbar, feedbackLabel, renderNavigation } from './navigation'
import { renderMobileHeader } from './mobile-header'
import { renderBarTools, renderTopBar } from './top-bar'
import {
  RIBBON_WIDTH,
  SubmenuController,
  renderHeaderScrim,
  renderLogoBar,
  renderNavBar,
  type NavGroup,
} from './header'
import headerCss from './header.css?inline'
import shellCss from './shell.css?inline'
import navigationCss from './navigation.css?inline'
import mobileHeaderCss from './mobile-header.css?inline'
import topBarCss from './top-bar.css?inline'
import dialogCloseCss from '../../shared/dialog-close.css?inline'
import keyCss from '../../shared/key.css?inline'

const MAIN_ID = 'lintje-shell-main'

const isGroup = (entry: ShellLink | ShellGroup): entry is ShellGroup => 'links' in entry

const activePage = (data?: ShellData | null): ShellLink | undefined =>
  data?.navigation
    ?.flatMap((entry) => (isGroup(entry) ? entry.links : [entry]))
    .find((link) => link.active)

/** Adjacent pages form one group without a heading; a group keeps its label as heading. */
export function toGroups(navigation: (ShellLink | ShellGroup)[]): NavGroup[] {
  const groups: NavGroup[] = []
  let run: NavGroup | null = null
  for (const entry of navigation) {
    if (isGroup(entry)) {
      run = null
      groups.push({ heading: entry.label, items: entry.links })
    } else {
      if (!run) groups.push((run = { items: [] }))
      run.items.push(entry)
    }
  }
  return groups
}

export class LintjeShell extends LintjeElement {
  static override styles = [
    iconStyles,
    badgeStyles,
    shadowCss(headerCss),
    shadowCss(shellCss),
    shadowCss(navigationCss),
    shadowCss(mobileHeaderCss),
    shadowCss(dialogCloseCss),
    shadowCss(keyCss),
    shadowCss(topBarCss),
  ]

  static override properties: PropertyDeclarations = {
    data: { attribute: false },
    layout: { type: String, reflect: true },
    openGroup: { state: true },
    barStuck: { state: true },
    railExpanded: { state: true },
    menuOpen: { state: true },
    menuLeaving: { state: true },
    shareOpen: { state: true },
    sharePhone: { state: true },
    viewOpen: { state: true },
    toolsCompact: { state: true },
    headerCompact: { state: true },
    hasContent: { state: true },
    toast: { state: true },
  }

  declare data?: ShellData | null

  protected override get dataSettings(): FrameSettings | undefined {
    return this.data ?? undefined
  }

  /** `data.layout`, mirrored on the element so its stylesheet can tell the two apart. */
  layout: 'side' | 'top' = 'top'
  /** Top layout: index of the open group; `WHOLE_MENU`; or `null`. */
  openGroup: number | null = null
  /** Top layout: the logo bar has scrolled away and the bar under it is pinned. */
  barStuck: boolean = false
  railExpanded: boolean = false
  /** The next focus in the rail is the shell's own hand-on after Escape: it does not expand. */
  railRefocus: boolean = false
  menuOpen: boolean = false
  /** The mobile menu is sliding out: still drawn, no longer open (see `willUpdate`). */
  menuLeaving: boolean = false
  shareOpen: boolean = false
  /** The share menu shows the QR code instead of its items. */
  sharePhone: boolean = false
  viewOpen: boolean = false
  /** Side layout: the name and the labelled tools do not fit in the top bar, so the tools are bare icons. */
  toolsCompact: boolean = false
  /** Below 768 px: the header's tools do not fit, so "Filters" and "Menu" show only their glyph. */
  headerCompact: boolean = false
  /** The `header` or default slot holds something; without, `full` takes the room. */
  hasContent: boolean = true
  declare toast?: string | null

  readonly wide = new MediaController(this, WIDE)
  readonly mobile = new MediaController(this, MOBILE)
  readonly submenu = new SubmenuController(this)
  readonly navScrollbar = new NavScrollbar(this)
  readonly store = new FrameStateController(this)
  readonly #menuTrap = new FocusTrap()
  #wasMobile: boolean | null = null
  #leaveTimer: ReturnType<typeof setTimeout> | null = null
  #scrollFrame = 0
  /** A shell inside another is a specimen of it (the style guide): its bar stays in the flow and
      its layers stay under the outer menus. */
  #nested = false
  #fitObserver: ResizeObserver | null = null
  #fitObserved: Element[] = []
  /** The labelled tools' width, measured while they show; the bare icons cannot tell it. */
  #labelledTools = 0
  /** Undoes the page's scroll lock while the mobile menu is open. */
  #menuReleased: (() => void) | null = null
  /** Below 768 px "Weergave" and "Delen" are sheets: modal, as the filter sheet is. */
  readonly #sheetTrap = new FocusTrap()
  #sheetReleased: (() => void) | null = null
  /** The scroller that carries the shell's `scroll-padding-top`. */
  #padded: HTMLElement | null = null

  readonly #onEscape = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return
    if (this.#sheetReleased) {
      if (!this.#sheetTrap.isTopmost()) return
      this.viewOpen = false
      this.shareOpen = false
      return
    }
    if (this.viewOpen || this.shareOpen) {
      // A dialog opened over the bar (the shortcuts overview) takes its own Escape.
      if (!ownsEscape(this)) return
      // The focus goes back to the tool only from the panel or the tool itself, never from
      // elsewhere on the page.
      if (this.#panelHoldsFocus()) {
        this.closePanel(this.viewOpen ? '.lintje-view__button' : '.lintje-share__button')
      } else {
        this.viewOpen = false
        this.shareOpen = false
      }
      return
    }
    if (!this.menuOpen || !this.#menuTrap.isTopmost()) return
    this.menuOpen = false
  }

  override connectedCallback(): void {
    super.connectedCallback()
    document.addEventListener('keydown', this.#onEscape)
    this.#nested = this.parentElement?.closest(this.localName) != null
    if (!this.#nested) window.addEventListener('scroll', this.#onScroll, { passive: true })
  }

  override disconnectedCallback(): void {
    document.removeEventListener('keydown', this.#onEscape)
    this.#releaseMenu()
    this.#menuTrap.deactivate(false)
    this.#releaseSheet(false)
    window.removeEventListener('scroll', this.#onScroll)
    this.#fitObserver?.disconnect()
    this.#fitObserver = null
    this.#fitObserved = []
    if (this.#scrollFrame) cancelAnimationFrame(this.#scrollFrame)
    this.#scrollFrame = 0
    if (this.#padded) this.#padded.style.scrollPaddingTop = ''
    this.#padded = null
    super.disconnectedCallback()
  }

  #releaseMenu(): void {
    this.#menuReleased?.()
    this.#menuReleased = null
  }

  /** Holds the open sheet: the page does not scroll, Tab stays inside, the close button has focus. */
  #holdSheet(): void {
    const sheet =
      this.mobile.matches && (this.viewOpen || this.shareOpen)
        ? this.renderRoot.querySelector<HTMLElement>(
            '.lintje-mobile-header .lintje-view__popover, .lintje-mobile-header .lintje-share__popover',
          )
        : null
    if (sheet && !this.#sheetReleased) {
      this.#sheetReleased = lockScroll()
      this.#sheetTrap.activate(sheet, {
        focus: sheet.querySelector<HTMLElement>('.lintje-share__close') ?? true,
      })
    } else if (!sheet) {
      this.#releaseSheet(true)
    }
  }

  /** Closing returns the focus to the tool that opened the sheet. */
  #releaseSheet(restore: boolean): void {
    if (!this.#sheetReleased) return
    this.#sheetReleased()
    this.#sheetReleased = null
    this.#sheetTrap.deactivate(restore)
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    // A viewport of 768 px or wider closes the open menu, or its fixed panel and trap would stay.
    if (this.#wasMobile === true && !this.mobile.matches && this.menuOpen) this.menuOpen = false
    this.#wasMobile = this.mobile.matches
    // The panel stays drawn until the slide out ends; the timer covers a missing `animationend`.
    if (changed.has('menuOpen')) {
      if (this.#leaveTimer) clearTimeout(this.#leaveTimer)
      this.#leaveTimer = null
      if (!this.menuOpen && changed.get('menuOpen') === true) {
        this.menuLeaving = true
        this.#leaveTimer = setTimeout(() => this.menuLeft(), 600)
      } else {
        this.menuLeaving = false
      }
    }
    // "Weergave" and "Delen" belong to the page they were opened on; another page closes them.
    if (
      changed.has('data') &&
      activePage(changed.get('data'))?.href !== activePage(this.data)?.href
    ) {
      this.viewOpen = false
      this.shareOpen = false
    }
    if (changed.has('shareOpen') && !this.shareOpen) this.sharePhone = false
    if (changed.has('data')) this.layout = this.data?.layout === 'side' ? 'side' : 'top'
  }

  /**
   * Closing the mobile menu returns the focus to its button: what had it may leave the DOM with
   * the panel.
   */
  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    // A slot that stays empty sends no `slotchange`: the first render counts the content once.
    if (changed.has('data') && changed.get('data') === undefined) this.#onSlotChange()
    if (changed.has('menuOpen')) {
      if (this.menuOpen) {
        this.#menuReleased ??= lockScroll()
        const region = this.renderRoot.querySelector<HTMLElement>('.lintje-mobile-chrome')
        if (region) this.#menuTrap.activate(region, { focus: false })
      } else if (changed.get('menuOpen') === true) {
        this.#releaseMenu()
        this.#menuTrap.deactivate(false)
        this.renderRoot
          .querySelector<HTMLButtonElement>('[aria-controls="lintje-mobile-menu-panel"]')
          ?.focus()
      }
    }
    this.#holdSheet()
    this.measureFit()
    this.#padScroll()
    if (this.#nested || this.layout !== 'top') return
    if (changed.has('data') || changed.has('layout')) this.measureScroll()
  }

  /**
   * The bars that stay at the top (and the filter bar stuck under them) would cover a control
   * the keyboard scrolls into view: the scroller keeps their height free above it.
   */
  #padScroll(): void {
    if (this.#nested) return
    const root = scrollRoot() ?? document.documentElement
    if (this.#padded && this.#padded !== root) this.#padded.style.scrollPaddingTop = ''
    this.#padded = root
    const bar =
      this.mobile.matches && this.layout === 'side'
        ? lengthPx(this, '--h-mobile-header', 72)
        : lengthPx(this, '--h-topbar', 56)
    const filters = this.store.state.hasFilters ? lengthPx(this, '--h-contextbar', 48) : 0
    root.style.scrollPaddingTop = `${Math.round(bar + filters)}px`
  }

  menuLeft(): void {
    if (this.#leaveTimer) clearTimeout(this.#leaveTimer)
    this.#leaveTimer = null
    this.menuLeaving = false
  }

  /**
   * Like the navigation bar's entries, the bars' tools give way when they do not fit, measured and
   * not by breakpoint: the top bar's to bare icons, the mobile header's words to their glyphs.
   * Each width compared is independent of the outcome, so neither can flip back and forth.
   */
  measureFit(): void {
    const bar = this.renderRoot.querySelector<HTMLElement>('.lintje-top-bar')
    const header = this.renderRoot.querySelector<HTMLElement>('.lintje-mobile-header')
    this.#observeFit([bar, header].filter((box): box is HTMLElement => box !== null))

    const words = bar?.querySelector<HTMLElement>('.lintje-top-bar__words')
    const tools = bar?.querySelector<HTMLElement>('.lintje-top-bar__actions')
    if (this.layout === 'side' && bar && words && tools && bar.clientWidth) {
      if (!this.toolsCompact) this.#labelledTools = tools.getBoundingClientRect().width
      const style = getComputedStyle(bar)
      const room = bar.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      const need = words.scrollWidth + lengthPx(this, '--space-6', 24) + this.#labelledTools
      const compact = need > room + 0.5
      if (compact !== this.toolsCompact) this.toolsCompact = compact
    }

    if (header?.clientWidth) {
      // The words shown for one reading, before anything paints.
      const was = header.classList.contains('is-compact')
      header.classList.remove('is-compact')
      const compact = header.scrollWidth > header.clientWidth + 0.5
      header.classList.toggle('is-compact', was)
      if (compact !== this.headerCompact) this.headerCompact = compact
    }
  }

  #observeFit(boxes: HTMLElement[]): void {
    if (typeof ResizeObserver === 'undefined') return
    if (
      boxes.length === this.#fitObserved.length &&
      boxes.every((box, i) => box === this.#fitObserved[i])
    )
      return
    this.#fitObserver ??= new ResizeObserver(() => this.measureFit())
    this.#fitObserver.disconnect()
    for (const box of boxes) this.#fitObserver.observe(box)
    this.#fitObserved = boxes
  }

  readonly #onScroll = (): void => {
    if (this.#scrollFrame || this.layout !== 'top') return
    this.#scrollFrame = requestAnimationFrame(() => {
      this.#scrollFrame = 0
      this.measureScroll()
    })
  }

  /** The bar pins once its place in the flow has left the viewport and unpins on return. */
  measureScroll(): void {
    const slot = this.renderRoot.querySelector('.lintje-shell__nav, .lintje-shell__mobile-bar')
    if (!slot) return
    this.barStuck = slot.getBoundingClientRect().top < 0
  }

  /* --- What the parts call -------------------------------------------- */

  /** A plain click on a page: the host routes it, or the browser follows the link. */
  follow(href: string, event: Event): void {
    this.openGroup = null
    this.followLink(href, event)
  }

  /** The host holds the setting: it hears the change and sets `data` again. */
  changeView(change: ShellViewChange): void {
    this.emit('lintje-view-change', change)
  }

  askSearch(): void {
    this.emit('lintje-search-open')
  }

  /** Closes "Weergave" or "Delen" with the focus on its tool, in the bar that shows: each bar has
   * one, and below 768 px the top bar's is hidden. A `lintje-button` hands the focus inside. */
  closePanel(tool: string): void {
    this.viewOpen = false
    this.shareOpen = false
    Array.from(this.renderRoot.querySelectorAll<HTMLElement>(tool))
      .find((button) => button.getClientRects().length > 0)
      ?.focus()
  }

  /** Whether the focus is in an open panel of "Weergave" or "Delen", or on its tool. */
  #panelHoldsFocus(): boolean {
    return Array.from(
      this.renderRoot.querySelectorAll('.lintje-view__popover, .lintje-share__popover'),
      (panel) => panel.parentElement,
    ).some((tool) => tool !== null && holdsFocus(tool))
  }

  showToast(text: string): void {
    this.toast = text
  }

  /* --- Skip link -------------------------------------------------------- */

  /** The main region lies under the bars that stay; the page scrolls it up to just below them. */
  skipToContent(event: Event): void {
    event.preventDefault()
    const target = this.renderRoot.querySelector<HTMLElement>(`#${MAIN_ID}`)
    if (!target) return
    target.focus({ preventScroll: true })
    const bars = this.renderRoot.querySelectorAll<HTMLElement>(
      '.lintje-top-bar, .lintje-mobile-header',
    )
    const below =
      this.layout === 'top'
        ? lengthPx(this, '--h-topbar', 56)
        : Math.max(0, ...Array.from(bars, (bar) => bar.getBoundingClientRect().bottom))
    const offset = target.getBoundingClientRect().top - below
    if (offset === 0) return
    const root = scrollRoot()
    if (root && root !== document.scrollingElement) root.scrollBy({ top: offset })
    else window.scrollBy({ top: offset })
  }

  #onSlotChange(): void {
    const slots = this.renderRoot.querySelectorAll<HTMLSlotElement>('.lintje-shell__content slot')
    this.hasContent = Array.from(slots).some((slot) =>
      slot
        .assignedNodes({ flatten: true })
        .some((node) => node.nodeType === Node.ELEMENT_NODE || node.textContent?.trim()),
    )
  }

  /* --- Parts ------------------------------------------------------------ */

  renderSearch(): TemplateResult | typeof nothing {
    if (!this.data?.search) return nothing
    return html`<button
      type="button"
      class="lintje-shell__tool"
      aria-label="Zoeken"
      title="Zoeken"
      aria-keyshortcuts="/"
      @click=${() => this.askSearch()}
    >
      ${renderIcon('functioneel-zoek', { size: 20 })}
    </button>`
  }

  renderNotifications(): TemplateResult | typeof nothing {
    const items = this.data?.notifications
    if (!items) return nothing
    return html`<lintje-notifications .items=${items}></lintje-notifications>`
  }

  /** In the bar the avatar opens it; `inline`, it is the foot of the mobile menu. */
  renderUserMenu(inline: boolean): TemplateResult | typeof nothing {
    const data = this.data
    if (!data?.user) return nothing
    return html`<lintje-user-menu
      class=${inline ? 'lintje-shell__sheet-user' : 'lintje-shell__user'}
      ?inline=${inline}
      .user=${data.user}
      .items=${data.userMenu ?? []}
      version=${data.version ?? nothing}
      logout-action=${data.logout?.href ?? nothing}
      csrf=${data.logout?.token ?? nothing}
    ></lintje-user-menu>`
  }

  private renderSkipLink(): TemplateResult {
    return html`<a
      class="lintje-shell__skip focus-inset"
      href="#${MAIN_ID}"
      @click=${(event: Event) => this.skipToContent(event)}
      >Naar de inhoud</a
    >`
  }

  private renderLogo(ribbon: number): TemplateResult {
    const data = this.data as ShellData
    const home = data.home
    return renderLogoBar({
      logo: data.logo,
      emblem: data.emblem,
      ribbon,
      environment: data.environment,
      home: home ? { href: home, onNavigate: (event) => this.follow(home, event) } : undefined,
    })
  }

  private renderNavEnd(data: ShellData): TemplateResult {
    const feedback = data.feedback
    return html`${this.renderSearch()}${this.renderNotifications()}${renderBarTools(this)}${
      feedback
        ? html`<a
            class="lintje-shell__tool"
            href=${feedback.href}
            aria-label=${feedbackLabel(feedback)}
            title=${feedbackLabel(feedback)}
            >${renderIcon('communicatie-tekstballonnen-met-vraagteken', { size: 20 })}</a
          >`
        : nothing
    }${this.renderUserMenu(false)}`
  }

  /** The slot of the nav bar keeps its height while the bar itself is pinned to the viewport. */
  private renderTop(data: ShellData, groups: NavGroup[]): TemplateResult {
    return html`${this.renderLogo(RIBBON_WIDTH.desktop)}
      <div class="lintje-shell__sentinel" aria-hidden="true"></div>
      <div class=${classMap({ 'lintje-shell__nav': true, 'is-stuck': this.barStuck })}>
        ${renderNavBar({
          id: 'lintje-shell-nav',
          groups,
          open: this.openGroup,
          collapsed: this.submenu.collapsed,
          onNavigate: (item, event) => this.follow(item.href as string, event),
          onOpen: (index) => (this.openGroup = index),
          // Cut with an ellipsis where it does not fit: the title keeps the whole name.
          start: data.name
            ? html`<h1 class="lintje-shell__name" title=${data.name}>${data.name}</h1>`
            : nothing,
          end: this.renderNavEnd(data),
        })}
      </div>
      ${renderHeaderScrim(this.openGroup !== null)}`
  }

  private renderTopPhone(groups: NavGroup[]): TemplateResult {
    return html`${this.renderLogo(RIBBON_WIDTH.phone)}
      <div class="lintje-shell__sentinel" aria-hidden="true"></div>
      <div class=${classMap({ 'lintje-shell__mobile-bar': true, 'is-stuck': this.barStuck })}>
        <div class="lintje-shell__mobile-pin">${renderMobileHeader(this, groups)}</div>
      </div>`
  }

  private renderMain(): TemplateResult {
    const onSlotChange = (): void => this.#onSlotChange()
    return html`<main
      id=${MAIN_ID}
      class=${classMap({ 'lintje-shell__main': true, 'is-bare': !this.hasContent })}
      tabindex="-1"
    >
      <slot name="full" @slotchange=${onSlotChange}></slot>
      <div class="lintje-shell__content" ?hidden=${!this.hasContent}>
        <slot name="header" @slotchange=${onSlotChange}></slot>
        <slot @slotchange=${onSlotChange}></slot>
      </div>
    </main>`
  }

  private renderToast(): TemplateResult | typeof nothing {
    return this.toast
      ? html`<lintje-toast
          kind="ok"
          @lintje-close=${(event: Event) => {
            event.stopPropagation()
            this.toast = null
          }}
          >${this.toast}</lintje-toast
        >`
      : nothing
  }

  protected override render(): TemplateResult | typeof nothing {
    const data = this.data
    if (!data) return nothing
    const groups = toGroups(data.navigation ?? [])
    if (this.layout === 'top') {
      return html`<div
        class=${classMap({
          'lintje-shell': true,
          'lintje-shell--top': true,
          'is-nested': this.#nested,
          'is-phone': this.mobile.matches,
        })}
      >
        ${this.renderSkipLink()}
        ${this.mobile.matches ? this.renderTopPhone(groups) : this.renderTop(data, groups)}
        ${this.renderMain()} <slot name="footer"></slot> ${this.renderToast()}
      </div>`
    }
    return html`<div
      class=${classMap({
        'lintje-shell': true,
        'lintje-shell--side': true,
        'is-unpinned': data.menu === 'unpinned',
        'is-nested': this.#nested,
        // Below 768 px the CSS follows this, not a media query: WebKit does not re-apply a shadow
        // root's media query after a resize, while the template already switches by MOBILE.
        'is-phone': this.mobile.matches,
      })}
    >
      ${this.renderSkipLink()} ${renderNavigation(this, groups)}
      <div class="lintje-shell__column">
        ${renderMobileHeader(this, groups)} ${renderTopBar(this)} ${this.renderMain()}
        <slot name="footer"></slot>
      </div>
      ${this.renderToast()}
    </div>`
  }
}

define('lintje-shell', LintjeShell)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-shell': LintjeShell
  }
}
