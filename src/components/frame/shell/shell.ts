/**
 * `<lintje-shell>` — the frame around a page: the Rijkshuisstijl header above it or the menu
 * beside it, the mobile header and menu below 768 px, and a `<main>` with the host's content.
 *
 * It never fetches and never reads the URL: the active page and the reader's settings are the
 * host's, and a change goes out as `lintje-view-change` and comes back as data. `full` runs edge
 * to edge above the content, `header` holds the `lintje-page-header` and `footer` the
 * `lintje-footer`. The events of its parts (`lintje-action`, `lintje-logout`,
 * `lintje-notification-open`, `lintje-notifications-read`) reach the host as they are.
 *
 * A bar of the host's own that sticks in the page carries `data-sticky="top"` or
 * `data-sticky="bottom"`: the scroller keeps the room it covers free as `scroll-padding`, with the
 * shell's own bar, so a control the keyboard scrolls to does not end up under it. The shell
 * follows the bar as it grows, stops sticking or goes.
 *
 * Events: `lintje-navigate` `{ href }`, `lintje-view-change` `ShellViewChange`,
 * `lintje-search-open`.
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
import { badgeStyles } from '../../feedback/badge/badge'
import '../../actions/button/button'
import '../../actions/logo/logo'
import '../../feedback/toast/toast'
import type { ToastKind } from '../../feedback/toast/toast'
import '../../actions/qr-code/qr-code'
import '../notifications/notifications'
import '../user-menu/user-menu'
import { MOBILE, WIDE, MediaController } from '../../../core/media'
import { lockScroll, scrollRoot } from '../../../core/host-config'
import { lengthPx } from '../../../core/length'
import { keepRoom, releaseRoom, type RoomSide } from '../../../core/scroll-room'
import { FocusTrap, ownsEscape } from '../../shared/focus-trap'
import { holdsFocus } from '../../../core/focus'
import { FrameStateController } from '../../../core/frame-state'
import type { ShellData, ShellGroup, ShellLink, ShellViewChange } from '../../../types'
import { NavScrollbar, feedbackLabel, renderNavigation } from './navigation'
import { renderMobileHeader } from './mobile-header'
import { renderBarTools, renderTopBar } from './top-bar'
import {
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

/** What a slot shows: an element, or text that is more than white space. */
const isContent = (node: Node): boolean =>
  node.nodeType === Node.ELEMENT_NODE ||
  (node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()))

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
    railExpanded: { state: true },
    menuOpen: { state: true },
    menuLeaving: { state: true },
    shareOpen: { state: true },
    sharePhone: { state: true },
    viewOpen: { state: true },
    toolsCompact: { state: true },
    hasContent: { state: true },
    toast: { state: true },
    toastKind: { state: true },
  }

  declare data?: ShellData | null

  protected override get dataSettings(): FrameSettings | undefined {
    return this.data ?? undefined
  }

  /** `data.layout`, mirrored on the element so its stylesheet can tell the two apart. */
  layout: 'side' | 'top' = 'top'
  /** Top layout: index of the open group; `WHOLE_MENU`; or `null`. */
  openGroup: number | null = null
  /** Top layout: the logo bar has scrolled away and the bar under it is pinned (`is-stuck`). */
  #barStuck: boolean = false
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
  /** The `header` or default slot holds something; without, `full` takes the room. */
  hasContent: boolean = true
  declare toast?: string | null
  toastKind: ToastKind = 'ok'

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
  /** The host's own bars that stick (`data-sticky`), which the scroller keeps room for too. */
  #hostBars: HTMLElement[] = []
  #hostBarSize: ResizeObserver | null = null
  #hostBarChange: MutationObserver | null = null
  #padFrame = 0

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
    if (this.#nested) return
    window.addEventListener('scroll', this.#onScroll, { passive: true })
    window.addEventListener('resize', this.#onHostBars)
    this.#watchHostBars()
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
    window.removeEventListener('resize', this.#onHostBars)
    this.#hostBarChange?.disconnect()
    this.#hostBarChange = null
    this.#hostBarSize?.disconnect()
    this.#hostBarSize = null
    this.#hostBars = []
    if (this.#padFrame) cancelAnimationFrame(this.#padFrame)
    this.#padFrame = 0
    releaseRoom(this)
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
    // A slot that stays empty sends no `slotchange`: the first data counts the content once.
    if (changed.has('data') && changed.get('data') === undefined)
      this.hasContent = this.#holdsContent()
  }

  /**
   * Closing the mobile menu returns the focus to its button: what had it may leave the DOM with
   * the panel.
   */
  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    if (changed.has('menuOpen')) {
      if (this.menuOpen) {
        this.#menuReleased ??= lockScroll()
        const region = this.renderRoot.querySelector<HTMLElement>('.lintje-mobile-chrome')
        if (region) this.#menuTrap.activate(region, { focus: false })
      } else if (changed.get('menuOpen') === true) {
        this.#releaseMenu()
        this.#menuTrap.deactivate(false)
        this.renderRoot
          .querySelector<HTMLButtonElement>('.lintje-mobile-header__button--menu')
          ?.focus()
      }
    }
    this.#holdSheet()
    this.#observeFit(changed.has('data') || changed.has('layout'))
    this.#fitHeader()
    this.#padScroll()
    if (this.#nested || this.layout !== 'top') return
    if (changed.has('data') || changed.has('layout')) this.measureScroll()
    else this.#markStuck()
  }

  /**
   * The bars that stay at the top (and the filter bar stuck under them) would cover a control
   * the keyboard scrolls into view: the scroller keeps their height free above it. A bar of the
   * host's own that sticks counts from its edge to where it ends.
   */
  #padScroll(): void {
    // An update that was due when the shell left claims nothing.
    if (this.#nested || !this.isConnected) return
    const root = scrollRoot() ?? document.documentElement
    const bar =
      this.mobile.matches && this.layout === 'side'
        ? lengthPx(this, '--h-mobile-header', 72)
        : lengthPx(this, '--h-topbar', 56)
    const { hasFilters, sentenceHeight } = this.store.state
    // Below 768 px the sentence wraps, so the filter bar measures it.
    const filters = !hasFilters
      ? 0
      : this.mobile.matches && sentenceHeight > 0
        ? sentenceHeight
        : lengthPx(this, '--h-contextbar', 48)
    keepRoom(this, root, 'top', Math.max(Math.round(bar + filters), this.#hostRoom('top')))
    keepRoom(this, root, 'bottom', this.#hostRoom('bottom'))
  }

  /** How far the host's bars of one edge reach into the scroller while they stick. */
  #hostRoom(side: RoomSide): number {
    let room = 0
    for (const bar of this.#hostBars) {
      if (bar.dataset.sticky !== side || !bar.isConnected) continue
      const style = getComputedStyle(bar)
      // Only what sticks covers anything: a bar the host lets scroll along (a phone) keeps none.
      if (style.position !== 'sticky' && style.position !== 'fixed') continue
      const edge = parseFloat(style[side])
      if (Number.isNaN(edge)) continue
      room = Math.max(room, edge + bar.getBoundingClientRect().height)
    }
    return room
  }

  /** Measured once a frame at most: a bar that comes, goes, grows or stops sticking. */
  readonly #onHostBars = (): void => {
    if (this.#padFrame) return
    this.#padFrame = requestAnimationFrame(() => {
      this.#padFrame = 0
      this.#collectHostBars()
      this.#padScroll()
    })
  }

  #watchHostBars(): void {
    if (typeof MutationObserver === 'undefined' || typeof ResizeObserver === 'undefined') return
    this.#hostBarSize = new ResizeObserver(this.#onHostBars)
    this.#hostBarChange = new MutationObserver(this.#onHostBars)
    this.#hostBarChange.observe(this, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-sticky', 'hidden', 'class', 'style'],
    })
    this.#collectHostBars()
  }

  #collectHostBars(): void {
    const bars = Array.from(this.querySelectorAll<HTMLElement>('[data-sticky]'))
    if (bars.length === this.#hostBars.length && bars.every((bar, i) => bar === this.#hostBars[i]))
      return
    this.#hostBarSize?.disconnect()
    for (const bar of bars) this.#hostBarSize?.observe(bar)
    this.#hostBars = bars
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
    this.#fitTools()
    this.#fitHeader()
  }

  // Bare icons are another template, so this is measured in the observer, whose first report
  // comes before the paint, and not after a render: that would draw the shell twice.
  #fitTools(): void {
    const bar = this.renderRoot.querySelector<HTMLElement>('.lintje-top-bar')
    const words = bar?.querySelector<HTMLElement>('.lintje-top-bar__words')
    const tools = bar?.querySelector<HTMLElement>('.lintje-top-bar__actions')
    if (this.layout !== 'side' || !bar || !words || !tools || !bar.clientWidth) return
    if (!this.toolsCompact) this.#labelledTools = tools.getBoundingClientRect().width
    const style = getComputedStyle(bar)
    const room = bar.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
    const need = words.scrollWidth + lengthPx(this, '--space-6', 24) + this.#labelledTools
    const compact = need > room + 0.5
    if (compact !== this.toolsCompact) this.toolsCompact = compact
  }

  // Only a class: written straight onto the header, so it can follow a render.
  #fitHeader(): void {
    const header = this.renderRoot.querySelector<HTMLElement>('.lintje-mobile-header')
    if (!header?.clientWidth) return
    // The words shown for one reading, before anything paints.
    header.classList.remove('is-compact')
    header.classList.toggle('is-compact', header.scrollWidth > header.clientWidth + 0.5)
  }

  /** Observes the bars; a bar observed anew is reported once more, with new data in it. */
  #observeFit(again: boolean): void {
    if (typeof ResizeObserver === 'undefined') return
    const boxes = [
      ...this.renderRoot.querySelectorAll<HTMLElement>('.lintje-top-bar, .lintje-mobile-header'),
    ]
    const same =
      boxes.length === this.#fitObserved.length &&
      boxes.every((box, i) => box === this.#fitObserved[i])
    if (same && !again) return
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
    this.#barStuck = slot.getBoundingClientRect().top < 0
    this.#markStuck()
  }

  // Straight onto the bar's slot, which a render may have replaced: a reactive property set after
  // a render would draw the shell twice.
  #markStuck(): void {
    this.renderRoot
      .querySelector('.lintje-shell__nav, .lintje-shell__mobile-bar')
      ?.classList.toggle('is-stuck', this.#barStuck)
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

  showToast(text: string, kind: ToastKind = 'ok'): void {
    this.toast = text
    this.toastKind = kind
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
      slot.assignedNodes({ flatten: true }).some(isContent),
    )
  }

  /** What the `header` and default slots will hold, read from the children before a render. */
  #holdsContent(): boolean {
    return Array.from(this.childNodes).some((node) => {
      const slot = node instanceof Element ? node.slot : ''
      if (slot !== '' && slot !== 'header') return false
      // A slot passed on (a shell inside another) holds what is assigned to it.
      return node instanceof HTMLSlotElement
        ? node.assignedNodes({ flatten: true }).some(isContent)
        : isContent(node)
    })
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

  /**
   * `bar`: the avatar in the bar opens it. `sheet`: inline, the foot of the mobile menu. `side`:
   * the foot of the side menu opens it, folded to the avatar in the folded rail.
   */
  renderUserMenu(place: 'bar' | 'sheet' | 'side', folded = false): TemplateResult | typeof nothing {
    const data = this.data
    if (!data?.user) return nothing
    const className = {
      bar: 'lintje-shell__user',
      sheet: 'lintje-shell__sheet-user',
      side: 'lintje-nav__user-menu',
    }[place]
    return html`<lintje-user-menu
      class=${className}
      ?inline=${place === 'sheet'}
      variant=${place === 'side' ? 'side' : nothing}
      ?folded=${folded}
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

  private renderLogo(): TemplateResult {
    const data = this.data as ShellData
    const home = data.home
    return renderLogoBar({
      logo: data.logo,
      emblem: data.emblem,
      environment: data.environment,
      home: home ? { href: home, onNavigate: (event) => this.follow(home, event) } : undefined,
    })
  }

  /** Paper has no bars: the logo, the application's name and the environment say what it is. */
  private renderPrintHead(data: ShellData): TemplateResult {
    const line = [data.name, data.environment].filter(Boolean).join(' · ')
    return html`<div class="lintje-shell__print-head" aria-hidden="true">
      <div class="lintje-shell__print-logo">
        <lintje-logo
          full
          src=${data.logo ?? nothing}
          name=${data.emblem?.name ?? nothing}
          alt=${data.emblem?.label ?? nothing}
          byline=${data.emblem?.byline ?? nothing}
        ></lintje-logo>
      </div>
      ${line ? html`<p class="lintje-shell__print-name">${line}</p>` : nothing}
    </div>`
  }

  private renderNavEnd(data: ShellData): TemplateResult {
    return html`${this.renderSearch()}${this.renderNotifications()}${renderBarTools(this)}${
      data.feedback ? this.renderFeedbackTool(data.feedback) : nothing
    }${this.renderUserMenu('bar')}`
  }

  /** The feedback link as a bare tool: its glyph, or its word without the icon file. */
  private renderFeedbackTool(feedback: NonNullable<ShellData['feedback']>): TemplateResult {
    const label = feedbackLabel(feedback)
    const glyph = renderIcon('communicatie-tekstballonnen-met-vraagteken', { size: 20 })
    const drawn = glyph !== nothing
    return html`<a
      class=${classMap({ 'lintje-shell__tool': true, 'lintje-shell__tool--text': !drawn })}
      href=${feedback.href}
      aria-label=${drawn ? label : nothing}
      title=${drawn ? label : nothing}
      >${drawn ? glyph : label}</a
    >`
  }

  /** The slot of the nav bar keeps its height while the bar itself is pinned to the viewport. */
  private renderTop(data: ShellData, groups: NavGroup[]): TemplateResult {
    return html`${this.renderLogo()}
      <div class="lintje-shell__sentinel" aria-hidden="true"></div>
      <div class="lintje-shell__nav">
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
    return html`${this.renderLogo()}
      <div class="lintje-shell__sentinel" aria-hidden="true"></div>
      <div class="lintje-shell__mobile-bar">
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
          kind=${this.toastKind}
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
        ${this.renderSkipLink()} ${this.renderPrintHead(data)}
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
        ${this.renderPrintHead(data)} ${renderMobileHeader(this, groups)} ${renderTopBar(this)} ${this.renderMain()}
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
