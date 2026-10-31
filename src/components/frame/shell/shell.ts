/**
 * `<lintje-shell>` — the frame around a page: the Rijkshuisstijl header above it or the menu
 * beside it, the mobile header and menu below 768 px, and a `<main>` with the host's content.
 *
 * It never fetches and never reads the URL: the active page and the reader's settings are the
 * host's, and a change goes out as `lintje-view-change` and comes back as data. `nav-tone`
 * chooses the menu's colours: filled in the theme's colour, or light as the house style's bar
 * and side navigation; unset, the new house style takes light and the earlier one filled.
 * `mobile-tabs` puts the loose pages below 768 px as tabs at the bottom of the screen, and
 * `tab-parts` says which of the shell's parts stand there as a tab instead of in the bar at the
 * top. An entry with `action` sends `lintje-action` with its name. `end` takes what a host
 * puts at the end of the bar, such as
 * `lintje-language-nav`, before the search and the user. `header` holds the `lintje-page-header`,
 * the page's head; `full` runs edge to edge above the content (a filter bar, a hero), under the
 * head in the new style and above it in the earlier one; `footer` holds the `lintje-footer`. The events of its parts (`lintje-action`, `lintje-logout`,
 * `lintje-notification-open`, `lintje-notifications-read`) reach the host as they are.
 *
 * Events: `lintje-navigate` `{ href }`, `lintje-view-change` `ShellViewChange`,
 * `lintje-search-open`, `lintje-action` with the entry's `action`.
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
import { lockScroll, onScrollLocks, scrollRoot } from '../../../core/host-config'
import { lengthPx } from '../../../core/length'
import { FocusTrap, ownsEscape } from '../../shared/focus-trap'
import { holdsFocus } from '../../../core/focus'
import { FrameStateController } from '../../../core/frame-state'
import type { ShellData, ShellGroup, ShellLink, ShellViewChange } from '../../../types'
import { NavScrollbar, feedbackLabel, renderNavigation } from './navigation'
import { renderMobileHeader } from './mobile-header'
import { renderBarTools, renderTopBar } from './top-bar'
import { parseTabParts, planTabs, type TabPlan } from './tab-bar'
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
import tabCss from '../shared/tab.css?inline'
import tabBarCss from './tab-bar.css?inline'
import dialogCloseCss from '../../shared/dialog-close.css?inline'
import keyCss from '../../shared/key.css?inline'

const MAIN_ID = 'lintje-shell-main'
/** How much the visual viewport loses before it is a keyboard and not a browser's own bar. */
const KEYBOARD_MIN = 150

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
    shadowCss(tabCss),
    shadowCss(tabBarCss),
  ]

  static override properties: PropertyDeclarations = {
    data: { attribute: false },
    layout: { type: String, reflect: true },
    navTone: { type: String, attribute: 'nav-tone', reflect: true },
    mobileTabs: { type: Boolean, attribute: 'mobile-tabs', reflect: true },
    tabParts: { type: String, attribute: 'tab-parts' },
    keyboardOpen: { state: true },
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
  /**
   * `filled`: the menu in the theme's colour, beside or above the page. `light`: the house
   * style's white bar and side navigation, with the words in the primary colour, a row under the
   * pointer filled in it and the reader's page in its wash. Unset, the style decides: light in
   * the new house style, filled in the earlier one. The effective tone stands on the host as
   * `data-tone`, where the stylesheet, the page head and the hero read it.
   */
  declare navTone?: 'filled' | 'light'
  /**
   * Below 768 px the loose pages of `navigation` stand as tabs at the bottom of the screen, at
   * most five with the parts of `tab-parts`; the rest and every group are in the menu's panel,
   * which opens above the tabs. The bar at the top stays. Above 768 px it changes nothing.
   */
  mobileTabs: boolean = false
  /**
   * With `mobile-tabs`: the shell's parts that stand as a tab instead of in the bar at the top,
   * apart by spaces: `search`, `notifications`, `user` and `menu`. Unset, Menu alone; empty,
   * none. Each part stands in one place.
   */
  declare tabParts?: string | null
  /** A keyboard on the screen has taken the room of the tabs (`visualViewport`). */
  keyboardOpen: boolean = false
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
    globalThis.visualViewport?.addEventListener('resize', this.#onViewport)
    this.#stopLocks = onScrollLocks((count) => {
      this.#locks = count
      this.#passBottom()
    })
  }

  override disconnectedCallback(): void {
    document.removeEventListener('keydown', this.#onEscape)
    this.#releaseMenu()
    this.#menuTrap.deactivate(false)
    this.#releaseSheet(false)
    window.removeEventListener('scroll', this.#onScroll)
    globalThis.visualViewport?.removeEventListener('resize', this.#onViewport)
    this.#stopLocks?.()
    this.#stopLocks = null
    this.#fitObserver?.disconnect()
    this.#fitObserver = null
    this.#fitObserved = []
    if (this.#scrollFrame) cancelAnimationFrame(this.#scrollFrame)
    this.#scrollFrame = 0
    if (!this.#nested) {
      document.documentElement.style.removeProperty('--lintje-shell-bottom')
      document.documentElement.style.removeProperty('--lintje-toast-bottom')
    }
    if (this.#padded) {
      this.#padded.style.scrollPaddingTop = ''
      this.#padded.style.scrollPaddingBottom = ''
    }
    this.#padded = null
    super.disconnectedCallback()
  }

  /**
   * A keyboard on the screen shrinks the visual viewport, not the layout one; zooming in shrinks
   * it too, so the zoom is taken out. While it is open the tabs give way, as on iOS.
   */
  readonly #onViewport = (): void => {
    const viewport = globalThis.visualViewport
    if (!viewport) return
    const open = window.innerHeight - viewport.height * viewport.scale > KEYBOARD_MIN
    if (open !== this.keyboardOpen) this.keyboardOpen = open
  }

  /** Whether the tabs stand below 768 px. */
  get tabsShown(): boolean {
    return this.mobileTabs && this.mobile.matches
  }

  /** Which entries are tabs and what the menu's panel holds; without tabs, the panel holds all. */
  tabPlan(): TabPlan {
    const navigation = this.data?.navigation ?? []
    if (!this.tabsShown) return { pages: [], parts: [], rest: navigation }
    // A part the shell does not have takes no place.
    const has = {
      search: this.data?.search,
      notifications: this.data?.notifications,
      user: this.data?.user,
    }
    const parts = parseTabParts(this.tabParts).filter(
      (part) => part === 'menu' || Boolean(has[part]),
    )
    return planTabs(navigation, parts)
  }

  /** An entry with `action`: the host opens what it names. */
  act(item: ShellLink): void {
    this.openGroup = null
    this.emit('lintje-action', item.action)
  }

  /** How many overlays hold the page still; the menu's own panel is one of them while open. */
  #locks = 0
  #stopLocks: (() => void) | null = null

  /**
   * What a host puts on the page outside the shell (a toast on `body`) reads the tabs' height too:
   * it stands on the document, as long as the tabs do. A toast reads `--lintje-toast-bottom`: the
   * tabs' height, or nothing while a sheet covers them (any overlay that holds the page, other
   * than the menu's panel, which stops on the tabs), so it never hangs in the middle of a sheet.
   */
  #passBottom(): void {
    if (this.#nested) return
    const style = document.documentElement.style
    const tabs = 'calc(var(--h-tab-bar) + env(safe-area-inset-bottom, 0px))'
    const shown = this.tabsShown && !this.keyboardOpen
    const covered = this.#locks > (this.menuOpen ? 1 : 0)
    if (shown) style.setProperty('--lintje-shell-bottom', tabs)
    else style.removeProperty('--lintje-shell-bottom')
    if (shown && !covered) style.setProperty('--lintje-toast-bottom', tabs)
    else style.removeProperty('--lintje-toast-bottom')
  }

  /* A mistake that shows nothing is said once in the console, as the development build's warning. */
  #warned = new Set<string>()
  #warnOnce(key: string, message: string): void {
    if (this.#warned.has(key)) return
    this.#warned.add(key)
    console.warn(`<${this.localName}>: ${message}`)
  }

  #checkTabs(): void {
    if (this.tabParts != null && !this.mobileTabs)
      this.#warnOnce('parts', '`tab-parts` does nothing without `mobile-tabs`.')
    if (!this.tabsShown || !this.data) return
    const plan = this.tabPlan()
    if (plan.pages.length + plan.parts.length < 2)
      this.#warnOnce('few', '`mobile-tabs` with fewer than two tabs: leave it off.')
    for (const label of this.renderRoot.querySelectorAll<HTMLElement>('.lintje-tab-bar__label')) {
      if (label.scrollWidth > label.clientWidth + 0.5)
        this.#warnOnce(
          `cut:${label.textContent}`,
          `the tab "${label.textContent}" is cut: keep a tab's label to one short word.`,
        )
    }
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
            '.lintje-mobile-chrome .lintje-view__popover, .lintje-mobile-chrome .lintje-share__popover',
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

  override resolveSettings(): void {
    super.resolveSettings()
    const tone = this.navTone ?? (this.isNewStyle ? 'light' : 'filled')
    if (this.dataset.tone !== tone) this.dataset.tone = tone
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
      // Above the tabs the panel goes at once: a tab tapped while it slides would wait for it.
      if (!this.menuOpen && changed.get('menuOpen') === true && !this.tabsShown) {
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
        if (region) {
          // Under a logo bar still in view the panel is shorter by it; the page cannot scroll now.
          const bar = region.querySelector('.lintje-mobile-header')?.getBoundingClientRect()
          if (bar) region.style.setProperty('--lintje-mobile-menu-top', `${bar.bottom}px`)
          this.#menuTrap.activate(region, { focus: false })
        }
      } else if (changed.get('menuOpen') === true) {
        this.#releaseMenu()
        this.#menuTrap.deactivate(false)
        // The button that opened it: the tab Menu, or Menu in the header.
        this.renderRoot
          .querySelector<HTMLButtonElement>(
            '.lintje-tab-bar__tab--menu, .lintje-mobile-header__button--menu',
          )
          ?.focus()
      }
    }
    this.#holdSheet()
    this.#checkTabs()
    this.#passBottom()
    this.#observeFit(changed.has('data') || changed.has('layout'))
    this.#fitHeader()
    this.#padScroll()
    if (this.#nested || !this.#pins) return
    if (changed.has('data') || changed.has('layout')) this.measureScroll()
    else this.#markStuck()
  }

  /**
   * The bars that stay at the top (and the filter bar stuck under them) would cover a control
   * the keyboard scrolls into view: the scroller keeps their height free above it.
   */
  #padScroll(): void {
    if (this.#nested) return
    const root = scrollRoot() ?? document.documentElement
    if (this.#padded && this.#padded !== root) {
      this.#padded.style.scrollPaddingTop = ''
      this.#padded.style.scrollPaddingBottom = ''
    }
    this.#padded = root
    const bar = lengthPx(this, '--h-topbar', 56)
    const { hasFilters, sentenceHeight } = this.store.state
    // Below 768 px the sentence wraps, so the filter bar measures it.
    const filters = !hasFilters
      ? 0
      : this.mobile.matches && sentenceHeight > 0
        ? sentenceHeight
        : lengthPx(this, '--h-contextbar', 48)
    root.style.scrollPaddingTop = `${Math.round(bar + filters)}px`
    root.style.scrollPaddingBottom =
      this.tabsShown && !this.keyboardOpen ? `${lengthPx(this, '--h-tab-bar', 64)}px` : ''
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

  /** A bar pins to the top: the navigation bar of the top layout, and the bar on a phone. */
  get #pins(): boolean {
    return this.layout === 'top' || this.mobile.matches
  }

  readonly #onScroll = (): void => {
    if (this.#scrollFrame || !this.#pins) return
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
    const slots = this.renderRoot.querySelectorAll<HTMLSlotElement>(
      '.lintje-shell__main slot:not([name="full"])',
    )
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

  /** `tab`: as a tab of the tab bar below 768 px. */
  renderNotifications(tab = false): TemplateResult | typeof nothing {
    const items = this.data?.notifications
    if (!items) return nothing
    return html`<lintje-notifications
      .items=${items}
      variant=${tab ? 'tab' : nothing}
    ></lintje-notifications>`
  }

  /**
   * `bar`: the avatar in the bar opens it, below 768 px as a sheet from below. `tab`: a tab of the
   * tab bar opens it. `side`: the foot of the side menu opens it, folded to the avatar in the
   * folded rail.
   */
  renderUserMenu(place: 'bar' | 'tab' | 'side', folded = false): TemplateResult | typeof nothing {
    const data = this.data
    if (!data?.user) return nothing
    const className = {
      bar: 'lintje-shell__user',
      tab: 'lintje-shell__tab-user',
      side: 'lintje-nav__user-menu',
    }[place]
    return html`<lintje-user-menu
      class=${className}
      variant=${place === 'bar' ? nothing : place}
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
    return html`<slot name="end"></slot>${this.renderSearch()}${this.renderNotifications()}${renderBarTools(this)}${
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
          onAction: (item) => this.act(item),
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

  /** Below 768 px, in both layouts: the logo bar, and the bar under it that pins once it scrolls away. */
  private renderPhone(plan: TabPlan): TemplateResult {
    // The panel holds every page, the tabs' too, so it is never empty; the tabs are the short way.
    const panel = toGroups(this.data?.navigation ?? [])
    return html`${this.renderLogo()}
      <div class="lintje-shell__sentinel" aria-hidden="true"></div>
      <div class="lintje-shell__mobile-bar">
        <div class="lintje-shell__mobile-pin">${renderMobileHeader(this, panel, plan)}</div>
      </div>`
  }

  /** The shell's own state below 768 px, for its stylesheet. */
  private phoneClasses(plan: TabPlan): Record<string, boolean> {
    const tabs = this.tabsShown
    return {
      'is-phone': this.mobile.matches,
      'has-tabs': tabs,
      'has-menu-tab': tabs && plan.parts.includes('menu'),
      'is-keyboard': tabs && this.keyboardOpen,
    }
  }

  private renderMain(): TemplateResult {
    const onSlotChange = (): void => this.#onSlotChange()
    // The new style stands the page's head above what runs edge to edge (a filter bar under it
    // stays sticky); the earlier one keeps the head in the content column under it.
    const fresh = this.isNewStyle
    const header = html`<slot name="header" @slotchange=${onSlotChange}></slot>`
    return html`<main
      id=${MAIN_ID}
      class=${classMap({ 'lintje-shell__main': true, 'is-bare': !this.hasContent })}
      tabindex="-1"
    >
      ${fresh ? header : nothing}
      <slot name="full" @slotchange=${onSlotChange}></slot>
      <div class="lintje-shell__content" ?hidden=${!this.hasContent}>
        ${fresh ? nothing : header}
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
    const plan = this.tabPlan()
    if (this.layout === 'top') {
      return html`<div
        class=${classMap({
          'lintje-shell': true,
          'lintje-shell--top': true,
          'is-nested': this.#nested,
          ...this.phoneClasses(plan),
        })}
      >
        ${this.renderSkipLink()} ${this.renderPrintHead(data)}
        ${this.mobile.matches ? this.renderPhone(plan) : this.renderTop(data, groups)}
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
        ...this.phoneClasses(plan),
      })}
    >
      ${this.renderSkipLink()} ${renderNavigation(this, groups)}
      <div class="lintje-shell__column">
        ${this.renderPrintHead(data)} ${this.mobile.matches ? this.renderPhone(plan) : nothing} ${renderTopBar(this)} ${this.renderMain()}
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
