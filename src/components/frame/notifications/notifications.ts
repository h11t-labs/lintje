/**
 * `<lintje-notifications>` — the bell with its unread counter, and the panel it opens.
 *
 * It fetches and marks nothing: the host sets `items`. More unread items than before are spoken
 * from a status region beside the bell. Above 768 px the panel is a popover; below, a full-screen
 * sheet that traps the focus.
 *
 * Events: `lintje-notification-open` `{ id, href? }` (a title was clicked; with an `href`, cancel
 * it to route), `lintje-notifications-read` ("Alles gelezen" was pressed).
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { keyed } from 'lit/directives/keyed.js'
import { LintjeElement, define } from '../../../core/element'
import { holdsFocus, standsIn } from '../../../core/focus'
import { MediaController, MOBILE } from '../../../core/media'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import '../../feedback/badge/badge'
import '../../overlays/popover/popover'
import { DialogHold } from '../../shared/dialog'
import { LiveMessage } from '../../shared/live-message'
import notificationsCss from './notifications.css?inline'
import dialogCloseCss from '../../shared/dialog-close.css?inline'
import { isPlainClick } from '../../../core/links'

export interface NotificationItem {
  id: string
  title: string
  /** One line under the title: the file, the reason. */
  text?: string
  /** When, as text the host formatted: "2 minuten geleden". */
  when: string
  href?: string
  unread?: boolean
}

let instances = 0

export function countLabel(count: number, max = 9): string {
  return count > max ? `${max}+` : String(count)
}

/** The bell's name says the count as the badge shows it, so a voice command can use it (WCAG 2.5.3). */
export function bellLabel(count: number, max = 9): string {
  return count > 0 ? `Meldingen, ${countLabel(count, max)} ongelezen` : 'Meldingen'
}

export function newsMessage(added: number): string {
  return added === 1 ? '1 nieuwe melding' : `${added} nieuwe meldingen`
}

export class LintjeNotifications extends LintjeElement {
  static override styles = [iconStyles, shadowCss(dialogCloseCss), shadowCss(notificationsCss)]

  static override properties: PropertyDeclarations = {
    items: { attribute: false },
    open: { type: Boolean, reflect: true },
    max: { type: Number },
  }

  items: NotificationItem[] = []
  /**
   * The highest figure the counter shows; above it the figure gets a plus, "9+". The bell's name
   * says the exact count.
   */
  max: number = 9
  open: boolean = false

  #shown = 0
  #replaced = false
  readonly #news = new LiveMessage(this)
  #refocus = false

  readonly #mobile = new MediaController(this, MOBILE)
  readonly #panelId = `lintje-notifications-${++instances}`

  private get bell(): HTMLButtonElement | null {
    return this.renderRoot.querySelector<HTMLButtonElement>('.lintje-notifications__bell')
  }

  private get unread(): number {
    return this.items.filter((item) => item.unread).length
  }

  private hide(returnFocus: boolean): void {
    this.open = false
    if (returnFocus) this.bell?.focus()
  }

  // The focus leaving the element closes the popover; the sheet below 768 px holds the focus.
  // A press that takes no focus blurs to nothing, or to a focusable box around the element.
  private readonly onFocusOut = (event: FocusEvent): void => {
    const next = event.relatedTarget as Node | null
    if (!this.open || this.#mobile.matches || !next) return
    if (standsIn(next, this) || standsIn(this, next)) return
    this.hide(false)
  }

  constructor() {
    super()
    this.addEventListener('focusout', this.onFocusOut)
  }

  /** The sheet on a phone has no popover to answer Escape: the hold does, while it is on top. */
  readonly #hold = new DialogHold(() => this.hide(true))

  override disconnectedCallback(): void {
    this.#hold.release()
    super.disconnectedCallback()
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (!changed.has('items')) return
    const count = this.unread
    const before = this.#shown
    this.#replaced = before > 0 && count > 0 && count !== before
    this.#shown = count
    if (this.hasUpdated && count > before) this.#news.say(newsMessage(count - before))
    const read = this.renderRoot.querySelector('.lintje-notifications__read')
    if (count === 0 && read && holdsFocus(read)) this.#refocus = true
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    if (this.#refocus) {
      this.#refocus = false
      const root = this.renderRoot
      const first = root.querySelector<HTMLElement>('.lintje-notifications__title')
      ;(first ?? root.querySelector<HTMLElement>('.lintje-notifications__close'))?.focus()
    }
    // Only the phone's sheet is modal.
    const sheet = this.open && this.#mobile.matches
    if (sheet && !this.#hold.held) this.#holdSheet()
    else if (!sheet && this.#hold.held) this.#hold.release()
  }

  #holdSheet(): void {
    const sheet = this.renderRoot.querySelector<HTMLElement>('.lintje-notifications__sheet')
    const close = this.renderRoot.querySelector<HTMLElement>('.lintje-notifications__close')
    if (sheet) this.#hold.hold(sheet, { focus: close ?? true })
  }

  private onPopoverClose(event: CustomEvent<{ reason: string }>): void {
    event.stopPropagation()
    this.hide(event.detail?.reason === 'escape')
  }

  private choose(item: NotificationItem, event: MouseEvent): void {
    if (item.href && !isPlainClick(event)) return
    this.hide(true)
    const followed = this.emit(
      'lintje-notification-open',
      item.href ? { id: item.id, href: item.href } : { id: item.id },
    )
    // With an href the browser follows the link, unless the host cancels the event.
    if (!followed) event.preventDefault()
  }

  private renderItem(item: NotificationItem): TemplateResult {
    const unread = Boolean(item.unread)
    const title = item.href
      ? html`<a
          class="lintje-notifications__title"
          href=${item.href}
          @click=${(event: MouseEvent) => this.choose(item, event)}
          >${item.title}</a
        >`
      : html`<button
          type="button"
          class="lintje-notifications__title"
          @click=${(event: MouseEvent) => this.choose(item, event)}
        >
          ${item.title}
        </button>`
    return html`<li class=${classMap({ 'lintje-notifications__item': true, 'is-unread': unread })}>
      ${
        unread
          ? html`<span class="lintje-notifications__dot" role="img" aria-label="Ongelezen"></span>`
          : html`<span class="lintje-notifications__dot-space"></span>`
      }
      <div class="lintje-notifications__body">
        ${title}
        ${item.text ? html`<p class="lintje-notifications__text">${item.text}</p>` : nothing}
        <p class="lintje-notifications__when">${item.when}</p>
      </div>
    </li>`
  }

  private renderPanel(mobile: boolean): TemplateResult {
    return html`<div class=${classMap({ 'lintje-notifications__panel': true, 'is-sheet': mobile })}>
      <div class="lintje-notifications__head">
        <h2 class="lintje-notifications__heading">Meldingen</h2>
        ${
          this.unread > 0
            ? html`<button
              type="button"
              class="lintje-notifications__read"
              @click=${() => this.emit('lintje-notifications-read')}
            >
              Alles gelezen
            </button>`
            : nothing
        }
        ${
          mobile
            ? html`<button
              type="button"
              class="lintje-dialog-close lintje-notifications__close"
              aria-label="Meldingen sluiten"
              @click=${() => this.hide(true)}
            >
              ${renderIcon('functioneel-kruis', { size: 16 })}
            </button>`
            : nothing
        }
      </div>
      ${
        this.items.length
          ? html`<ul class="lintje-notifications__list">
            ${this.items.map((item) => this.renderItem(item))}
          </ul>`
          : html`<p class="lintje-notifications__empty">
            Geen meldingen. Wat klaar is of mislukt, verschijnt hier.
          </p>`
      }
    </div>`
  }

  protected override render(): TemplateResult {
    const count = this.unread
    const mobile = this.#mobile.matches
    // The popover stands right after the bell: its previous sibling is what it is placed by.
    return html`<button
        type="button"
        class=${classMap({ 'lintje-notifications__bell': true, 'is-open': this.open })}
        aria-label=${bellLabel(count, this.max)}
        aria-haspopup="dialog"
        aria-expanded=${String(this.open)}
        aria-controls=${this.#panelId}
        @click=${() => (this.open ? this.hide(false) : (this.open = true))}
      >
        ${renderIcon('functioneel-bel', { size: 20 })}
        ${
          count > 0
            ? html`<lintje-badge class="lintje-notifications__count" variant="unread" aria-hidden="true"
              >${keyed(
                countLabel(count, this.max),
                html`<span
                  class=${classMap({
                    'lintje-notifications__figure': true,
                    'is-replaced': this.#replaced,
                  })}
                  >${countLabel(count, this.max)}</span
                >`,
              )}</lintje-badge
            >`
            : nothing
        }
      </button>
      ${
        mobile
          ? this.open
            ? html`<div
              id=${this.#panelId}
              class="lintje-notifications__sheet"
              role="dialog"
              aria-modal="true"
              aria-label="Meldingen"
              tabindex="-1"
            >
              ${this.renderPanel(true)}
            </div>`
            : nothing
          : html`<lintje-popover
            id=${this.#panelId}
            panel-role="dialog"
            label="Meldingen"
            placement="bottom-end"
            ?open=${this.open}
            @lintje-close=${this.onPopoverClose}
            >${this.renderPanel(false)}</lintje-popover
          >`
      }
      <span class="visually-hidden" role="status">${this.#news.text}</span>`
  }
}

define('lintje-notifications', LintjeNotifications)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-notifications': LintjeNotifications
  }
}
