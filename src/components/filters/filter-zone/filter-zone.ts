/**
 * `<lintje-filter-zone>` — the filter bar: one place for everything that narrows the numbers.
 *
 * The controls come in through the slot and the sentence as parts; the owner keeps the state. The
 * zone is expanded, scrolled (a sticky summary bar) or, below 768 px, the sentence only: a button
 * that asks the owner to open its sheet.
 *
 * Events: `lintje-filters-reset`, `lintje-zone-open-change` `boolean`,
 * `lintje-zone-scrolled-change` `boolean`, `lintje-zone-sheet-open` (below 768 px).
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type TemplateResult,
  type PropertyValues,
} from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { LintjeElement, define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import { badgeStyles, renderBadge } from '../../feedback/badge/badge'
import { lengthPx } from '../../../core/length'
import { MOBILE, MediaController } from '../../../core/media'
import { filterSentence, type SentencePart } from '../shared/sentence'
import {
  canStayScrolled,
  zoneExpanded,
  zoneReduce,
  type ZoneAction,
  type ZoneState,
} from './zone-state'
import zoneCss from './filter-zone.css?inline'
import { scrollRoot } from '../../../core/host-config'
import { holdsFocus } from '../../../core/focus'
import { heightSettleMs } from '../../shared/transition'

export class LintjeFilterZone extends LintjeElement {
  static override styles = [iconStyles, badgeStyles, shadowCss(zoneCss)]

  static override properties: PropertyDeclarations = {
    total: { type: Number },
    modified: { type: Number },
    open: { type: Boolean },
    scrolled: { type: Boolean },
    sheetOpen: { type: Boolean, attribute: 'sheet-open' },
    stick: { type: String },
    sentence: { attribute: false },
    settled: { state: true },
  }

  total: number = 0
  modified: number = 0
  /** The reader's choice to show the controls, held in the owner's URL. */
  open: boolean = false
  scrolled: boolean = false
  /** Below 768 px, whether the owner's sheet is open: the sentence that opens it says so. */
  sheetOpen: boolean = false
  /** The open transition is done, so the body may stop clipping the popovers hanging out of it. */
  protected settled: boolean = true
  private settleTimer: ReturnType<typeof setTimeout> | undefined
  /** `fixed` where the zone's own box is too small to stick in (a component mount). */
  stick: 'sticky' | 'fixed' = 'sticky'
  sentence: SentencePart[] = []

  private readonly mobile = new MediaController(this, MOBILE)
  /** Carries `:state(phone)`, which follows the controller as the template does; `null` in happy-dom. */
  readonly #internals: ElementInternals | null =
    typeof this.attachInternals === 'function' ? this.attachInternals() : null
  private observer: IntersectionObserver | null = null
  // `undefined` until the first update: `null === null` would skip the first report.
  private observed: HTMLElement | null | undefined = undefined
  private wasExpanded: boolean | undefined = undefined

  private readonly onResize = (): void => this.measureOverflow()
  /** The header or summary row held the focus before a re-render that may replace it. */
  #rowHadFocus = false

  override connectedCallback(): void {
    super.connectedCallback()
    window.addEventListener('resize', this.onResize)
  }

  override disconnectedCallback(): void {
    this.stopObserving()
    this.watchPageScroll(false)
    clearTimeout(this.settleTimer)
    window.removeEventListener('resize', this.onResize)
    super.disconnectedCallback()
  }

  // `is-scrollable`: the stuck panel is taller than the space below the top bar, and scrolling
  // clips popovers. Adds up the two boxes instead of reading `scrollHeight`, which counts an open
  // popover and would switch the scroll on, cutting off that popover. Written straight onto the
  // bar: a reactive property set after a render would draw the zone twice.
  private measureOverflow(): void {
    const inner = this.renderRoot.querySelector<HTMLElement>('.lintje-filter-bar__body-inner')
    const row = this.renderRoot.querySelector<HTMLElement>(
      '.lintje-filter-bar__header, .lintje-summary-bar',
    )
    const bar = this.renderRoot.querySelector<HTMLElement>('.lintje-filter-bar')
    if (!bar) return
    const topBar = inner ? lengthPx(inner, '--h-topbar', 56) : 0
    const scrollable =
      inner !== null &&
      row !== null &&
      row.offsetHeight + inner.offsetHeight > window.innerHeight - topBar
    bar.classList.toggle('is-scrollable', scrollable)
  }

  // The wait is the body's computed transition of its height, not `--dur-collapse`: whatever
  // `tokens/base.css` lets move under reduced motion decides it.
  private timeSettling(expanded: boolean): void {
    clearTimeout(this.settleTimer)
    if (!expanded) {
      this.settled = false
      return
    }
    const body = this.renderRoot.querySelector<HTMLElement>('.lintje-filter-bar__body')
    const duration = heightSettleMs(body)
    this.settled = !(duration > 0)
    if (!this.settled) this.settleTimer = setTimeout(() => (this.settled = true), duration)
  }

  private stopObserving(): void {
    this.observer?.disconnect()
    this.observer = null
    this.observed = undefined
  }

  // An IntersectionObserver on a 1 px sentinel marks when the bar reaches the top bar. The
  // sentinel decides whether to re-observe: crossing 768 px changes no tracked property, yet
  // the mobile render drops the sentinel and coming back creates a new one.
  // Open and closed draw the row with two templates, and a reset leaves with its count: a control
  // that held the focus is replaced, so the focus goes to the toggle instead of the page.
  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    // Whether the zone opens follows from its state and the breakpoint, so `settled` is known
    // before the render. The body it times is the one already drawn.
    const expanded = !this.mobile.matches && zoneExpanded(this.state)
    if (expanded !== this.wasExpanded) {
      const first = this.wasExpanded === undefined
      this.wasExpanded = expanded
      this.watchPageScroll(expanded)
      if (!first) this.timeSettling(expanded)
    }
    if (!changed.has('open') && !changed.has('modified')) return
    const row = this.renderRoot.querySelector('.lintje-filter-bar__header, .lintje-summary-bar')
    this.#rowHadFocus = this.#rowHadFocus || (row != null && holdsFocus(row))
  }

  protected override updated(changed: PropertyValues<this>): void {
    const states = this.#internals?.states
    if (states) {
      if (this.mobile.matches) states.add('phone')
      else states.delete('phone')
    }
    if (this.#rowHadFocus) {
      this.#rowHadFocus = false
      if (!holdsFocus(this)) {
        this.renderRoot.querySelector<HTMLElement>('.lintje-filter-toggle')?.focus()
      }
    }
    this.measureOverflow()
    const sentinel =
      this.renderRoot.querySelector<HTMLElement>('.lintje-filter-bar__sentinel') ?? null
    const remeasure = changed.has('open')
    if (!remeasure && sentinel === this.observed) return
    this.stopObserving()
    this.observed = sentinel
    if (!sentinel || this.mobile.matches) {
      this.report(false)
      return
    }
    const height = lengthPx(sentinel, '--h-topbar', 56)
    this.observer = new IntersectionObserver(([entry]) => this.report(!entry.isIntersecting), {
      rootMargin: `-${height}px 0px 0px 0px`,
      threshold: 0,
    })
    this.observer.observe(sentinel)
  }

  private report(scrolled: boolean): void {
    // The owner holds `scrolled`; it comes back through the property. Going down only pins where
    // the page stays long enough; going back up always unpins.
    this.emitLocal('lintje-zone-scrolled-change', scrolled && this.canPin())
  }

  // Only a `fixed` zone takes height out of the page when it pins: it leaves a placeholder of
  // the summary bar's height. Measured at the crossing; the sentinel before the bar stays put.
  // A page that grows later (a tile loading) pins at the next crossing.
  private canPin(): boolean {
    if (this.stick !== 'fixed' || this.scrolled) return true
    const sentinel = this.renderRoot.querySelector<HTMLElement>('.lintje-filter-bar__sentinel')
    const bar = this.renderRoot.querySelector<HTMLElement>('.lintje-filter-bar')
    const root = scrollRoot()
    const scroller = root && root !== document.scrollingElement ? root : document.scrollingElement
    if (!sentinel || !bar || !scroller) return true
    const topBar = lengthPx(sentinel, '--h-topbar', 56)
    return canStayScrolled({
      scrollHeight: scroller.scrollHeight,
      viewportHeight: scroller.clientHeight,
      lost: bar.offsetHeight - lengthPx(bar, '--h-contextbar', 48),
      threshold: this.pageScroll() + sentinel.getBoundingClientRect().top - topBar,
    })
  }

  private get state(): ZoneState {
    return { open: this.open, scrolled: this.scrolled }
  }

  private act(action: ZoneAction): void {
    const next = zoneReduce(this.state, action)
    if (next.open === this.open) return
    this.emitLocal('lintje-zone-open-change', next.open)
  }

  #openedAt = 0
  #scrollTarget: HTMLElement | Window | null = null

  private readonly onPageScroll = (): void => {
    // A reader working in the controls keeps them, however the page moves under them.
    const body = this.renderRoot.querySelector('.lintje-filter-bar__body')
    if (body && holdsFocus(body)) return
    this.act({ type: 'page-scrolled', distance: this.pageScroll() - this.#openedAt })
  }

  private pageScroll(): number {
    const root = scrollRoot()
    return root && root !== document.scrollingElement ? root.scrollTop : window.scrollY
  }

  private watchPageScroll(open: boolean): void {
    this.#scrollTarget?.removeEventListener('scroll', this.onPageScroll)
    this.#scrollTarget = null
    if (!open || this.mobile.matches) return
    const root = scrollRoot()
    this.#scrollTarget = root && root !== document.scrollingElement ? root : window
    this.#openedAt = this.pageScroll()
    this.#scrollTarget.addEventListener('scroll', this.onPageScroll, { passive: true })
  }

  protected override render(): TemplateResult {
    if (this.mobile.matches) {
      // The sentence that sticks under the header is the way to the sheet; the ring is inset,
      // since the bar runs from edge to edge of the screen.
      return html`<div class="lintje-filter-bar lintje-filter-bar--mobile">
        <button
          type="button"
          class="lintje-filter-bar__mobile-summary focus-inset"
          aria-haspopup="dialog"
          aria-expanded=${this.sheetOpen}
          @click=${() => this.emitLocal('lintje-zone-sheet-open')}
        >
          ${filterSentence(this.sentence)}
          <span class="lintje-filter-bar__mobile-end">
            ${
              this.modified > 0
                ? renderBadge({
                    value: this.modified,
                    label: `${this.modified} aangepast`,
                    tone: 'attention',
                  })
                : nothing
            }
            ${renderIcon('functioneel-delta-omlaag', { size: 16 })}
          </span>
        </button>
      </div>`
    }

    const expanded = zoneExpanded(this.state)
    const pinned = this.scrolled && this.stick === 'fixed'

    return html`
      <!-- The sentinel sits before the zone, not after it. After the zone it moves along
           when the zone collapses (461 -> 334 px), so when scrolling back up the threshold
           releases 127 px later than it triggered. Before the zone it stays put, and the
           threshold triggers the moment the bar touches the top bar. -->
      <div class="lintje-filter-bar__sentinel" aria-hidden="true"></div>
      ${pinned ? html`<div class="lintje-filter-bar__placeholder" aria-hidden="true"></div>` : nothing}
      <div
        class=${classMap({
          'lintje-filter-bar': true,
          'is-open': expanded,
          'is-settled': expanded && this.settled,
          'is-sticky': this.scrolled,
          'is-stuck-open': this.scrolled && expanded,
          'lintje-filter-bar--fixed': this.stick === 'fixed',
          'lintje-filter-bar--wrap': this.total > 4,
        })}
      >
        ${expanded ? this.renderHeader() : this.renderSummaryBar()}
        <!-- The body stays in the DOM in both states. A height only transitions between
             two values of one element, so swapping the body for the summary bar — what
             this did until now — can never be anything but a snap. It is the grid row
             that opens and closes (0fr to 1fr); see filter-zone.css. -->
        <div class="lintje-filter-bar__body" id="filter-body">
          <div class="lintje-filter-bar__body-inner">
            <div class="lintje-filter-bar__controls"><slot></slot></div>
            <p class="lintje-filter-bar__summary">${filterSentence(this.sentence)}</p>
          </div>
        </div>
      </div>
    `
  }

  private renderHeader(): TemplateResult {
    return html`
      <div class="lintje-filter-bar__header">
        ${renderIcon('functioneel-filters', { size: 16 })}
        <span class="lintje-filter-bar__title">Filters</span>
        <span class="lintje-filter-bar__hint">gelden voor alle cijfers op deze pagina</span>
        <span class="lintje-filter-bar__spacer"></span>
        ${
          this.modified > 0
            ? html`<span class="lintje-filter-bar__counter">
                <span class="lintje-filter-bar__dot"></span>
                ${this.modified} van ${this.total} afwijkend
              </span>
              <button
                type="button"
                class="lintje-filter-bar__reset"
                @click=${() => this.emitLocal('lintje-filters-reset')}
              >
                Herstel standaard
              </button>`
            : nothing
        }
        ${this.renderToggle(true)}
      </div>
    `
  }

  private renderSummaryBar(): TemplateResult {
    // The whole bar opens the filters; a button inside it keeps its own job.
    return html`<div
      class="lintje-summary-bar"
      @click=${(event: MouseEvent) => {
        if ((event.target as Element).closest('button')) return
        this.act({ type: 'expand' })
      }}
    >
      <button
        type="button"
        class="lintje-summary-bar__sentence"
        aria-expanded="false"
        aria-controls="filter-body"
        @click=${() => this.act({ type: 'expand' })}
      >
        ${filterSentence(this.sentence)}
      </button>
      <span class="lintje-summary-bar__spacer"></span>
      ${
        this.modified > 0
          ? html`<span class="lintje-summary-bar__counter">
            <span class="lintje-summary-bar__dot"></span>
            ${this.modified} afwijkend ·
            <button
              type="button"
              class="lintje-summary-bar__reset"
              @click=${() => this.emitLocal('lintje-filters-reset')}
            >
              herstel
            </button>
          </span>`
          : nothing
      }
      ${this.renderToggle(false)}
    </div>`
  }

  // `expanded` is the rendered state, not `open`: stuck and collapsed the zone is closed
  // however the URL reads. Its name is the word it shows; `aria-expanded` says the state.
  private renderToggle(expanded: boolean): TemplateResult {
    return html`<button
      type="button"
      class=${classMap({ 'lintje-filter-toggle': true, 'is-expanded': expanded })}
      aria-expanded=${expanded}
      aria-controls="filter-body"
      @click=${() => this.act({ type: expanded ? 'collapse' : 'expand' })}
    >
      Filters
      ${renderIcon('functioneel-delta-omlaag', { size: 16, className: 'lintje-filter-toggle__chevron' })}
    </button>`
  }
}

define('lintje-filter-zone', LintjeFilterZone)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-filter-zone': LintjeFilterZone
  }
}
