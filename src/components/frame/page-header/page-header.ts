/**
 * `<lintje-page-header>` — the title zone of a page, with an announcement above it.
 *
 * The title is an h2: the page's h1 is the shell's `name`.
 * Slots: `breadcrumbs` above the title, `actions` on its right.
 *
 * In the page's content it is a band, and tells the shell through the shared store when the
 * title scrolls under the top bar. The observer watches the title itself: a sentinel element in
 * this column would pick up the gap and push the page down 6 px.
 *
 * In `lintje-shell`'s `header` slot it stands flush in the shell's content column, as an
 * application's title row: no band, the description at every width, no observer.
 *
 * `editable` puts a pencil beside the title, shown while the title is pointed at or focused: the
 * way to rename what the page is about. The page renames; the header only asks.
 *
 * Events: `lintje-title-edit` (the pencil was pressed).
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type TemplateResult,
  type PropertyValues,
} from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { LintjeElement, define, type FrameSettings } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { lengthPx } from '../../../core/length'
import { MOBILE, MediaController } from '../../../core/media'
import { setTitleHidden } from '../../../core/frame-state'
import '../../feedback/announcement/announcement'
import '../../../primitives/icon-button/icon-button'
import headerCss from './page-header.css?inline'
import type { PageHeaderData } from '../../../types'

export class LintjePageHeader extends LintjeElement {
  static override styles = shadowCss(headerCss)

  static override properties: PropertyDeclarations = {
    data: { attribute: false },
    inShell: { state: true },
    hasActions: { state: true },
    editable: { type: Boolean, reflect: true },
  }

  declare data?: PageHeaderData | null
  /** In `lintje-shell`'s `header` slot: an application's title row, with no top bar to tell. */
  inShell: boolean = false
  /** An empty actions slot takes no place, so a long title never wraps onto an empty line. */
  hasActions: boolean = false
  /** A pencil beside the title asks to rename it. */
  editable: boolean = false

  protected override get dataSettings(): FrameSettings | undefined {
    return this.data ?? undefined
  }

  private readonly mobile = new MediaController(this, MOBILE)
  private observer: IntersectionObserver | null = null

  override connectedCallback(): void {
    super.connectedCallback()
    this.inShell = this.slot === 'header' && this.parentElement?.localName === 'lintje-shell'
  }

  override disconnectedCallback(): void {
    this.stopObserving()
    if (!this.inShell) setTitleHidden(false)
    super.disconnectedCallback()
  }

  private stopObserving(): void {
    this.observer?.disconnect()
    this.observer = null
  }

  /**
   * Thresholds 0 and 1: the observer fires when the title starts to disappear and when it is
   * gone. The top edge decides, so a title below the viewport does not count as hidden.
   */
  protected override updated(changed: PropertyValues<this>): void {
    if (this.inShell) return
    const relevant = changed.has('data') || this.observer === null
    if (!relevant) return
    this.stopObserving()
    const title = this.renderRoot.querySelector<HTMLElement>('.lintje-page-header__title')
    if (!title || this.mobile.matches) {
      setTitleHidden(false)
      return
    }
    // Read from the title itself: the token inherits from wherever the mode root is.
    const height = lengthPx(title, '--h-topbar', 56)
    this.observer = new IntersectionObserver(
      // Only "hidden" when it has scrolled out at the top, not when it is below the viewport.
      ([entry]) => setTitleHidden(entry.boundingClientRect.top < height),
      { rootMargin: `-${height}px 0px 0px 0px`, threshold: [0, 1] },
    )
    this.observer.observe(title)
  }

  protected override render(): TemplateResult | typeof nothing {
    const data = this.data
    if (!data) return nothing
    const isMobile = this.mobile.matches
    const inShell = this.inShell
    const showDescription = Boolean(data.description) && (inShell || !isMobile)
    const { asOf, source, more } = data

    // Parts are collected, not laid out over template lines: whitespace between two expressions
    // is a text node in a Lit template and would put a space before every separator.
    const meta: unknown[] = []
    if (asOf) meta.push(html`<span>Waarde van ${asOf}</span>`)
    if (asOf && source) meta.push(html`<span aria-hidden="true"> · </span>`)
    if (source) meta.push(html`<span>Bron: ${source}</span>`)
    if (more) {
      meta.push(html`<span aria-hidden="true"> · </span>`)
      meta.push(
        html`<a href=${more.href} class="lintje-page-header__more"
          >${more.label ?? 'Meer over deze cijfers'} ›</a
        >`,
      )
    }

    return html`
      ${
        data.announcement
          ? html`<lintje-announcement .data=${data.announcement}></lintje-announcement>`
          : nothing
      }
      <div class=${classMap({ 'lintje-page-header': true, 'lintje-page-header--shell': inShell })}>
        <slot name="breadcrumbs"></slot>
        ${
          isMobile && data.kicker
            ? html`<p class="lintje-page-header__kicker">${data.kicker}</p>`
            : nothing
        }
        <div class=${classMap({ 'lintje-page-header__row': true, 'is-described': showDescription })}>
          <div class="lintje-page-header__heading">
            <div class="lintje-page-header__title-row">
              <h2 class="lintje-page-header__title">${data.title}</h2>
              ${
                this.editable
                  ? html`<lintje-icon-button
                      class="lintje-page-header__edit"
                      icon="functioneel-bewerken"
                      label="Naam wijzigen"
                      variant="flat"
                      @click=${() => this.emit('lintje-title-edit')}
                    ></lintje-icon-button>`
                  : nothing
              }
            </div>
            ${
              showDescription
                ? html`<p class="lintje-page-header__description">${data.description}</p>`
                : nothing
            }
          </div>
          <slot
            name="actions"
            class=${classMap({ 'lintje-page-header__actions': true, 'is-empty': !this.hasActions })}
            @slotchange=${(event: Event) => {
              this.hasActions = (event.target as HTMLSlotElement).assignedElements().length > 0
            }}
          ></slot>
        </div>
        ${meta.length > 0 ? html`<p class="lintje-page-header__meta">${meta}</p>` : nothing}
      </div>
    `
  }
}

define('lintje-page-header', LintjePageHeader)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-page-header': LintjePageHeader
  }
}
