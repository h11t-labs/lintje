/**
 * `<lintje-tile>` — the frame around a chart, map or table.
 *
 * Top to bottom: header, notice, intro, legend, content, legend (`legend-below`), footnote.
 * `slot="aside"` puts a key figure beside the content, above it below 768 px. Hover actions show
 * on focus too, and always on touch screens. The tile expands and downloads nothing itself: the
 * host answers its events. With `collapsed-mobile` a phone shows only the head and a button that
 * unfolds the rest, for a tile that matters less there than its neighbours.
 *
 * Events: `lintje-tile-expand`, `lintje-tile-download`, `lintje-toggle` `boolean` (unfolded on a
 * phone, after the reader pressed the button).
 */
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { styleProps } from '../../../core/style-props'
import { define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { LintjeGridItemElement, spanStyles } from '../../shared/grid-item-element'
import { length } from '../../shared/length'
import { iconStyles, renderIcon, renderLeadingIcon } from '../../../icons/render'
import { MediaController } from '../../../core/media'
import { uniqueId } from '../../../core/id'
import '../../actions/button/button'
import '../../actions/icon-button/icon-button'
import '../../feedback/status-dot/status-dot'
import '../../feedback/skeleton/skeleton'
import { announcementBlockStyles, renderAnnouncementBlock } from '../../shared/announcement-block'
import { emptyStateBlockStyles, renderEmptyStateBlock } from '../../shared/empty-state-block'
import type { ContentStateKind } from '../../shared/tone'
import surfaceCss from './tile.css?inline'

/** The same four as `ContentState` in the contract. */
export type ContentState = ContentStateKind

const LOADING_TEXT = 'Gegevens laden…'

export class LintjeTile extends LintjeGridItemElement {
  // Empty and error are the shared blocks, so a tile reads like the elements on their own.
  static override styles = [
    spanStyles,
    iconStyles,
    shadowCss(surfaceCss),
    announcementBlockStyles,
    emptyStateBlockStyles,
  ]

  static override properties = {
    heading: { type: String },
    icon: { type: String },
    subtitle: { type: String },
    intro: { type: String },
    footnote: { type: String },
    footnoteSlotted: { state: true },
    asideSlotted: { state: true },
    legendBelow: { type: Boolean, attribute: 'legend-below' },
    expandable: { type: Boolean },
    collapsedMobile: { type: Boolean, attribute: 'collapsed-mobile', reflect: true },
    unfolded: { state: true },
    download: { type: Boolean },
    state: { type: String, reflect: true },
    message: { type: String },
    lastKnown: { type: String, attribute: 'last-known' },
    contentHeight: { type: String, attribute: 'content-height' },
    contentScroll: { type: Boolean, attribute: 'content-scroll', reflect: true },
    flush: { type: Boolean },
    breakable: { type: Boolean, reflect: true },
    filled: { state: true },
  }

  declare heading?: string
  /** An icon file name (`dist-icons/`), drawn before the title. Decorative. */
  declare icon?: string
  declare subtitle?: string
  declare intro?: string
  /** The line under the rule at the bottom; richer content goes in `slot="footnote"`. */
  declare footnote?: string
  /** The `<p>` stays in the template, hidden when empty: an unrendered slot reports nothing. */
  footnoteSlotted: boolean = false
  asideSlotted: boolean = false
  legendBelow: boolean = false
  expandable: boolean = false
  /**
   * On a phone, below 768 px, only the head shows with a button that unfolds the rest; on a wider
   * screen it changes nothing. For a tile that matters less on a phone, such as a map beside the
   * figures it summarises: it stays one tap away instead of being left out.
   */
  collapsedMobile: boolean = false
  /** On a phone, whether the reader unfolded a `collapsed-mobile` tile. */
  unfolded: boolean = false
  download: boolean = false
  /** `loading`, `empty` and `error` stand in for the content; the tile keeps its size. */
  state: ContentState = 'ready'
  declare message?: string
  declare lastKnown?: string
  contentHeight: string = 'var(--chart-h-main)'
  /** The tile has a height of its own: what does not fit scrolls inside it. */
  contentScroll: boolean = false
  /** The content runs to the tile's edges and indents what it draws by the tile's padding: rows
   * whose lines reach the frame, as a work list's. */
  flush: boolean = false
  /** On paper the tile may break between two sheets, as a long table does; otherwise it moves to
   * the next sheet whole where it fits. */
  breakable: boolean = false
  /** The words in the loading or error live region, or `null`; filled a frame after the region
   * is drawn, because a region that arrives with its text is not announced. */
  protected filled: string | null = null

  #fillFrame = 0
  readonly #mobile = new MediaController(this)
  readonly #foldId = uniqueId('lintje-tile-fold')

  override connectedCallback(): void {
    super.connectedCallback()
    // A frame cancelled on the way out is asked for again on the way back in.
    if (this.regionText !== null && this.filled !== this.regionText) this.requestUpdate()
  }

  override disconnectedCallback(): void {
    if (this.#fillFrame) cancelAnimationFrame(this.#fillFrame)
    this.#fillFrame = 0
    super.disconnectedCallback()
  }

  /** What the state's live region says, or `null` for a state without one. */
  private get regionText(): string | null {
    if (this.state === 'error' || this.state === 'empty') return this.message ?? ''
    return this.state === 'loading' ? LOADING_TEXT : null
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (changed.has('state')) this.filled = null
  }

  /** A region that stands empty: its words go in on the next frame. */
  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    if (this.regionText === null || this.filled === this.regionText || this.#fillFrame) return
    this.#fillFrame = requestAnimationFrame(() => {
      this.#fillFrame = 0
      this.filled = this.regionText
    })
  }

  private static filled(event: Event): boolean {
    const nodes = (event.target as HTMLSlotElement).assignedNodes({ flatten: true })
    return nodes.some(
      (node) => node.nodeType !== Node.TEXT_NODE || (node.textContent ?? '').trim() !== '',
    )
  }

  private onFootnoteChange(event: Event): void {
    this.footnoteSlotted = LintjeTile.filled(event)
  }

  private onAsideChange(event: Event): void {
    this.asideSlotted = LintjeTile.filled(event)
  }

  /** The button that folds a `collapsed-mobile` tile on a phone: its word, and the title it is about. */
  private foldToggle(titleId: string): TemplateResult {
    const open = this.unfolded
    return html`<button
      type="button"
      class=${classMap({ 'lintje-tile__fold-toggle': true, 'is-open': open })}
      aria-expanded=${open ? 'true' : 'false'}
      aria-controls=${this.#foldId}
      aria-describedby=${this.heading ? titleId : nothing}
      @click=${() => {
        this.unfolded = !open
        this.emit('lintje-toggle', this.unfolded)
      }}
    >
      ${renderIcon('functioneel-delta-omlaag', { size: 16, className: 'lintje-tile__fold-icon' })}${
        open ? 'Verbergen' : 'Tonen'
      }
    </button>`
  }

  protected override render(): TemplateResult {
    const ready = this.state === 'ready'
    const foldable = this.collapsedMobile && this.#mobile.matches
    const folded = foldable && !this.unfolded
    // A foldable tile names its title for the button, so it has an id of its own when the host gave none.
    const titleId = this.id ? `${this.id}-title` : foldable ? `${this.#foldId}-title` : undefined
    // A tile that scrolls itself is a Tab stop named by its title: Safari gives a scroller none,
    // and the host cannot reach into this root to add one (WCAG 2.1.1).
    const scroller = this.contentScroll
    const headingId = titleId ?? 'lintje-tile-title'
    const head =
      this.heading ||
      this.subtitle ||
      foldable ||
      (this.expandable && ready) ||
      (this.download && ready)

    return html`<section
      class=${classMap({ 'lintje-tile': true, 'lintje-tile--flush': this.flush })}
      aria-labelledby=${titleId && this.heading ? titleId : nothing}
    >
      ${
        head
          ? html`<header class="lintje-tile__head">
            <div
              class=${classMap({
                'lintje-tile__heading': true,
                'lintje-tile__heading--icon': Boolean(this.icon),
              })}
            >
              ${renderLeadingIcon(this.icon, 'lintje-tile__icon')}
              ${
                this.heading
                  ? html`<h3
                      id=${titleId ?? (scroller ? headingId : nothing)}
                      class="lintje-tile__title"
                    >${this.heading}</h3>`
                  : nothing
              }
              ${this.subtitle ? html`<p class="lintje-tile__sub">${this.subtitle}</p>` : nothing}
            </div>
            <div class="lintje-tile__actions">
              ${foldable ? this.foldToggle(titleId!) : nothing}
              <slot name="actions"></slot>
              ${
                this.expandable && ready
                  ? html`<lintje-icon-button
                    icon="functioneel-foto-vergroten"
                    label="Vergroot"
                    variant="tile"
                    @click=${() => this.emit('lintje-tile-expand')}
                  ></lintje-icon-button>`
                  : nothing
              }
              ${
                this.download && ready
                  ? html`<lintje-icon-button
                    icon="functioneel-downloaden"
                    label="Download"
                    variant="tile"
                    @click=${() => this.emit('lintje-tile-download')}
                  ></lintje-icon-button>`
                  : nothing
              }
            </div>
          </header>`
          : nothing
      }
      <div
        id=${this.#foldId}
        class=${classMap({ 'lintje-tile__fold': true, 'is-unfolded': foldable && this.unfolded })}
        ?hidden=${folded}
      >
      <slot name="notice"></slot>
      ${this.intro ? html`<p class="lintje-tile__intro">${this.intro}</p>` : nothing}
      ${this.legendBelow ? nothing : html`<slot name="legend"></slot>`}
      <div
        class=${classMap({
          'lintje-tile__body': true,
          'lintje-tile__body--aside': this.asideSlotted,
        })}
      >
        <div class="lintje-tile__aside" ?hidden=${!this.asideSlotted}>
          <slot name="aside" @slotchange=${this.onAsideChange}></slot>
        </div>
        <div
          class="lintje-tile__content"
          tabindex=${scroller ? 0 : nothing}
          role=${scroller && this.heading ? 'region' : nothing}
          aria-labelledby=${scroller && this.heading ? headingId : nothing}
        >
          ${this.content()}
        </div>
      </div>
      ${this.legendBelow ? html`<slot name="legend"></slot>` : nothing}
      <p class="lintje-tile__footnote" ?hidden=${!this.footnote && !this.footnoteSlotted}>
        ${this.footnote ?? nothing}<slot
          name="footnote"
          @slotchange=${this.onFootnoteChange}
        ></slot>
      </p>
      </div>
    </section>`
  }

  private content(): TemplateResult {
    const height = length(this.contentHeight)
    switch (this.state) {
      case 'loading':
        return html`<div ${styleProps({ height })} role="status">
          <span class="visually-hidden">${this.filled === LOADING_TEXT ? LOADING_TEXT : nothing}</span>
          <slot name="loading"><lintje-skeleton height="100%"></lintje-skeleton></slot>
        </div>`
      case 'empty':
        return html`<div class="lintje-chart-state lintje-chart-state--empty" ${styleProps({ height })}>
          ${renderEmptyStateBlock({
            text: this.message,
            compact: true,
            status: true,
            filled: this.filled === this.regionText,
          })}
        </div>`
      case 'error':
        return html`<div
          class="lintje-chart-state lintje-chart-state--error"
          ${styleProps({ minHeight: height })}
        >
          ${renderAnnouncementBlock({
            kind: 'error',
            text: this.message,
            live: true,
            filled: this.filled === this.regionText,
            coloured: this.isNewStyle,
          })}
          ${
            this.lastKnown
              ? html`<div class="lintje-chart-state__last-known">${this.lastKnown}</div>`
              : nothing
          }
        </div>`
      default:
        return html`<slot></slot>`
    }
  }
}

define('lintje-tile', LintjeTile)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-tile': LintjeTile
  }
}
