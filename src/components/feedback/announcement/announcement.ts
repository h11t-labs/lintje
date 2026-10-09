/**
 * `<lintje-announcement>` — a status message: warning, outage, info or ok.
 *
 * A live region only with `live: true`; drawn empty first and filled on the next frame so screen
 * readers announce it. `slot="action"` stands under the text, `slot="media"` beside it: an image
 * that belongs to the message, such as a code to scan. Closed with the focus on its close button,
 * it hands the focus to the next stop on the page (else the one before) before it goes.
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { define, type FrameSettings } from '../../../core/element'
import { deepActiveElement, holdsFocus } from '../../../core/focus'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import { LintjeGridItemElement, spanStyles } from '../../../primitives/shared/grid-item-element'
import '../../../primitives/tile/tile'
import { tabbables } from '../../shared/focus-trap'
import announcementCss from './announcement.css?inline'
import tileHostCss from '../../shared/view-tile.css?inline'
import type { AnnouncementKind, AnnouncementViewData } from '../../../types'

// One shape per kind, so the kind never rests on the tint alone.
const MARK: Record<AnnouncementKind, string> = {
  warning: 'functioneel-waarschuwing',
  outage: 'functioneel-foutmelding',
  info: 'functioneel-info',
  ok: 'functioneel-cirkel-vinkje',
}
// Only an outage interrupts the reader; the other three wait their turn.
const ROLE: Record<AnnouncementKind, 'alert' | 'status'> = {
  warning: 'status',
  outage: 'alert',
  info: 'status',
  ok: 'status',
}
const PREFIX: Record<AnnouncementKind, string> = {
  warning: 'Waarschuwing',
  outage: 'Storing',
  info: 'Informatie',
  ok: 'Gelukt',
}

const storageKey = (id: string): string => `lintje-announcement-dismissed:${id}`

export class LintjeAnnouncement extends LintjeGridItemElement {
  // The host box is its own file: `announcement.css` is shared with `<lintje-tile>`.
  static override styles = [
    iconStyles,
    spanStyles,
    shadowCss(tileHostCss),
    shadowCss(announcementCss),
  ]

  static override properties: PropertyDeclarations = {
    data: { attribute: false },
    compact: { type: Boolean, reflect: true },
    dismissed: { state: true },
    filled: { state: true },
  }

  declare data?: AnnouncementViewData | null
  /** The tighter form. Below 768 px every announcement is compact. */
  compact: boolean = false

  dismissed: string | null = null

  filled: string | null = null

  private fillFrame: number = 0

  protected override get dataSettings(): FrameSettings | undefined {
    return this.data ?? undefined
  }

  private get identity(): string {
    const data = this.data
    if (!data) return ''
    return data.announcementId ?? [data.kind, data.title, data.text].join('\u0000')
  }

  private get isDismissed(): boolean {
    const data = this.data
    if (!data) return false
    if (this.dismissed === this.identity) return true
    if (!data.announcementId) return false
    try {
      return localStorage.getItem(storageKey(data.announcementId)) === '1'
    } catch {
      return false
    }
  }

  /** Whether `node` stands in this element: in its shadow root or slotted into it. */
  private holds(node: Node): boolean {
    for (let at: Node | null = node; at;) {
      if (at === this) return true
      at = at.parentNode ?? (at instanceof ShadowRoot ? at.host : null)
    }
    return false
  }

  /** The page's next tab stop outside the announcement, else the one before it. */
  private neighbour(): HTMLElement | null {
    const stops = tabbables(document.body)
    const at = stops.indexOf(deepActiveElement() as HTMLElement)
    if (at === -1) return null
    const outside = (element: HTMLElement): boolean => !this.holds(element)
    return stops.slice(at + 1).find(outside) ?? stops.slice(0, at).reverse().find(outside) ?? null
  }

  private async close(): Promise<void> {
    const next = holdsFocus(this) ? this.neighbour() : null
    const id = this.data?.announcementId
    if (id) {
      try {
        localStorage.setItem(storageKey(id), '1')
      } catch {
        /* storage may be blocked */
      }
    }
    this.dismissed = this.identity
    if (!next) return
    await this.updateComplete
    next.focus()
  }

  override disconnectedCallback(): void {
    if (this.fillFrame) cancelAnimationFrame(this.fillFrame)
    this.fillFrame = 0
    super.disconnectedCallback()
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    const data = this.data
    if (!data?.live || this.isDismissed || this.filled === this.identity || this.fillFrame) return
    this.fillFrame = requestAnimationFrame(() => {
      this.fillFrame = 0
      this.filled = this.identity
    })
  }

  protected override render(): TemplateResult | typeof nothing {
    const data = this.data
    if (!data || this.isDismissed) return nothing
    const block = this.block(data)
    const tile = data.tile
    if (!tile) return block
    return html`<lintje-tile
      id=${this.id ? `${this.id}-tile` : nothing}
      span=${tile.span ?? nothing}
      heading=${tile.title ?? nothing}
      icon=${tile.icon ?? nothing}
      subtitle=${tile.subtitle ?? nothing}
      intro=${tile.intro ?? nothing}
      footnote=${tile.footnote ?? nothing}
      >${block}</lintje-tile
    >`
  }

  private block(data: AnnouncementViewData): TemplateResult {
    const kind: AnnouncementKind = data.kind ?? 'warning'
    const dismissible = Boolean(data.dismissible) && kind !== 'outage'
    const live = data.live === true
    // A live region is drawn empty first; `updated` fills it on the next frame.
    const empty = live && this.filled !== this.identity
    return html`<div
      class="lintje-announcement lintje-announcement--${kind} ${this.compact ? 'is-compact' : ''}"
      role=${live ? (ROLE[kind] ?? nothing) : nothing}
    >
      ${empty ? nothing : this.content(data, kind, dismissible)}
    </div>`
  }

  private content(
    data: AnnouncementViewData,
    kind: AnnouncementKind,
    dismissible: boolean,
  ): TemplateResult {
    const prefix = html`<span class="visually-hidden">${PREFIX[kind] ?? ''}: </span>`
    return html`<span class="lintje-announcement__icon" aria-hidden="true"
        >${MARK[kind] ? renderIcon(MARK[kind], { size: 16 }) : nothing}</span
      >
      <div class="lintje-announcement__body">
        <div class="lintje-announcement__content">
          ${
            data.title
              ? html`<p class="lintje-announcement__title">${prefix}${data.title}</p>`
              : nothing
          }
          ${
            data.text
              ? html`<p class="lintje-announcement__text">${data.title ? nothing : prefix}${data.text}</p>`
              : nothing
          }
          ${
            data.meta || data.link
              ? html`<p class="lintje-announcement__meta">
                ${data.meta ?? nothing}${data.meta && data.link ? ' · ' : nothing}${
                  data.link
                    ? html`<a class="lintje-announcement__link" href=${data.link.href}
                      >${data.link.label}</a
                    >`
                    : nothing
                }
              </p>`
              : nothing
          }
        </div>
        <slot name="action" class="lintje-announcement__action"></slot>
      </div>
      <slot name="media" class="lintje-announcement__media"></slot>
      ${
        dismissible
          ? html`<button
            type="button"
            class="lintje-announcement__close"
            aria-label="Mededeling sluiten"
            @click=${() => void this.close()}
          >
            ${renderIcon('functioneel-kruis', { size: 16 })}
          </button>`
          : nothing
      }`
  }
}

define('lintje-announcement', LintjeAnnouncement)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-announcement': LintjeAnnouncement
  }
}
