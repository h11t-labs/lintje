/**
 * `<lintje-card>` — one item of a collection: a product, a dataset, a recording, an app. A muted
 * line above the title (its kind, its owner), the title, a line of text, optionally a few facts
 * as a small table, a status as a glyph and its word, and at most two actions. A screenshot stands above it, a logo beside the title.
 * Square and flat; in a grid it is drawn by `lintje-card-list`.
 *
 * `layout="horizontal"` puts the picture or logo in a column on the left, for a long list; below
 * 768 px it stands as the vertical card.
 *
 * A card is either a link or carries actions, never both. Without actions and with `href` the
 * whole card is clickable and the title is its one tab stop; with actions only the title and the
 * actions are. The card knows no domain: "toegang" or "eigenaar" are the host's words.
 *
 * `iconActions` stand beside the title as icon buttons, also on a card that is a link: an action
 * on the item itself, such as marking it. One with `pressed` is a switch; the card keeps nothing
 * and the host sets the new `pressed` after the event.
 *
 * `layout="horizontal"` wants a column of at least `--w-card-wide`; `lintje-card-list` keeps to it.
 *
 * Events: `lintje-navigate` `{ href }` (a plain click on the title, the card or an action with an
 * `href` in this tab), `lintje-card-action` `{ id, value }` (an action without `href`) and
 * `{ id, value, pressed }` (an icon action, with a switch's value asked for).
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { LintjeElement, define } from '../../../core/element'
import { isPlainClick } from '../../../core/links'
import { MediaController, MOBILE } from '../../../core/media'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import '../../../primitives/button/button'
import '../../../primitives/icon-button/icon-button'
import '../../../primitives/skeleton/skeleton'
import cardCss from './card.css?inline'

export type CardStatusTone = 'neutral' | 'success' | 'info' | 'attention' | 'error'

export interface CardStatus {
  /** The word that carries the status: "Je hebt toegang". */
  label: string
  tone?: CardStatusTone
  /** A glyph of the set instead of the tone's own mark; `neutral` has none of its own. */
  icon?: string
}

export interface CardAction {
  label: string
  /** Makes the action a link in the button's shape. */
  href?: string
  /** Sent in `lintje-card-action` by an action without `href`. Give one: without it the Dutch
   * label is sent, and a host should not branch on interface text. */
  value?: string
  /** `secondary` by default; one primary per card at most. A `link` stands at the end of the bar:
   * the way to the item's own page, "Details". */
  variant?: 'primary' | 'secondary' | 'link'
  /** Opens in a new tab, with the external-link mark and a word for a screen reader. */
  external?: boolean
}

export interface CardIconAction {
  /** Sent in `lintje-card-action`. */
  value: string
  /** The accessible name and the tooltip, "Favoriet"; the card adds its title to it. */
  label: string
  /** An icon file name; without a file the label stands as the text. */
  icon: string
  /** Makes it a switch: drawn pressed while `true`. */
  pressed?: boolean
  /** The icon while pressed, so the glyph carries the state too: the filled beside the outlined. */
  iconPressed?: string
}

export interface CardFact {
  label: string
  /** Text the host formatted. Missing is a dash, never 0. */
  value: string | null
}

export interface CardMedia {
  src: string
  /** Empty for a picture that only decorates. */
  alt: string
  /** `image` is a screenshot above the card; `logo` a square beside the title. */
  kind?: 'image' | 'logo'
}

export type CardLayout = 'vertical' | 'horizontal'

export interface CardData {
  id: string
  title: string
  /** Makes the title a link; without actions the whole card follows it. */
  href?: string
  /** The muted line above the title, its parts joined by a dot: ["Dashboard", "Dienst Vergunningen"]. */
  meta?: string[]
  description?: string
  /** A few facts as a small table under the text: "Verversing", "Bron". Left out in compact. */
  facts?: CardFact[]
  media?: CardMedia
  status?: CardStatus
  /** At most two are drawn. */
  actions?: CardAction[]
  /** Icon buttons beside the title; at most two are drawn. */
  iconActions?: CardIconAction[]
}

const TONE_ICON: Partial<Record<CardStatusTone, string>> = {
  success: 'functioneel-cirkel-vinkje',
  info: 'functioneel-info',
  attention: 'functioneel-waarschuwing',
  error: 'functioneel-foutmelding',
}

export class LintjeCard extends LintjeElement {
  static override styles = [iconStyles, shadowCss(cardCss)]

  static override properties: PropertyDeclarations = {
    data: { attribute: false },
    layout: { type: String, reflect: true },
    headingLevel: { type: Number, attribute: 'heading-level' },
    compact: { type: Boolean, reflect: true },
    loading: { type: Boolean, reflect: true },
    spoken: { state: true },
  }

  declare data?: CardData
  /** `horizontal`: the picture in a column on the left, for a long list. */
  layout: CardLayout = 'vertical'
  /** The level of the title, 2 to 4: a card stands under the page's or a section's heading. */
  headingLevel: 2 | 3 | 4 = 3
  /** The muted line, title, status and the first action only: a narrow column or a phone. */
  compact: boolean = false
  /** Draws the card's shape in skeletons, at the size the content will take. */
  loading: boolean = false
  /** What the status region says once the card has loaded: filled a frame after it is drawn. */
  spoken: string = ''

  // The region is drawn from the first load on, and stays, so the change to "geladen" is heard.
  private hasRegion = false
  private wasBusy = false
  private fillFrame = 0

  private get busy(): boolean {
    return this.loading || !this.data
  }

  override disconnectedCallback(): void {
    cancelAnimationFrame(this.fillFrame)
    this.fillFrame = 0
    super.disconnectedCallback()
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (this.busy) this.hasRegion = true
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    const busy = this.busy
    if (busy === this.wasBusy) return
    this.wasBusy = busy
    const text = busy ? 'Gegevens laden…' : 'Gegevens geladen.'
    cancelAnimationFrame(this.fillFrame)
    this.fillFrame = requestAnimationFrame(() => {
      this.fillFrame = 0
      this.spoken = text
    })
  }

  readonly #mobile = new MediaController(this, MOBILE)

  /** A phone has no room for a column beside the text: there every card stands upright. */
  private get horizontal(): boolean {
    return this.layout === 'horizontal' && !this.#mobile.matches
  }

  private get actions(): CardAction[] {
    return (this.data?.actions ?? []).slice(0, this.compact ? 1 : 2)
  }

  private get isLink(): boolean {
    return Boolean(this.data?.href) && this.actions.length === 0
  }

  private onCardClick(event: MouseEvent): void {
    const href = this.data?.href
    if (!href || !this.isLink || !isPlainClick(event)) return
    // A reader who selected text in the card meant to copy it, not to leave.
    if (getSelection()?.toString()) return
    const path = event.composedPath()
    const on = (name: string): boolean =>
      path.some((node) => node instanceof HTMLElement && node.classList.contains(name))
    // An icon action is a control of its own, also on a card that is a link.
    if (on('lintje-card__icon-action')) return
    const onTitle = on('lintje-card__link')
    // On the title the browser follows the href unless the host cancels the event.
    if (onTitle) this.followLink(href, event)
    else {
      event.preventDefault()
      this.followLink(href)
    }
  }

  private onTitleClick(event: MouseEvent): void {
    if (this.isLink || !this.data?.href || !isPlainClick(event)) return
    this.followLink(this.data.href, event)
  }

  private onAction(action: CardAction, event: MouseEvent): void {
    if (!this.data) return
    if (action.href) {
      if (!action.external && isPlainClick(event)) this.followLink(action.href, event)
      return
    }
    this.emit('lintje-card-action', { id: this.data.id, value: action.value ?? action.label })
  }

  private renderIconAction(action: CardIconAction, data: CardData): TemplateResult {
    const toggle = action.pressed !== undefined
    const pressed = action.pressed === true
    const detail = toggle
      ? { id: data.id, value: action.value, pressed: !pressed }
      : { id: data.id, value: action.value }
    return html`<lintje-icon-button
      class="lintje-card__icon-action"
      variant="flat"
      icon=${pressed && action.iconPressed ? action.iconPressed : action.icon}
      label=${`${action.label}: ${data.title}`}
      .pressed=${toggle ? pressed : undefined}
      ?active=${pressed}
      @click=${() => this.emit('lintje-card-action', detail)}
    ></lintje-icon-button>`
  }

  private heading(content: TemplateResult): TemplateResult {
    if (this.headingLevel === 2) return html`<h2 class="lintje-card__title">${content}</h2>`
    if (this.headingLevel === 4) return html`<h4 class="lintje-card__title">${content}</h4>`
    return html`<h3 class="lintje-card__title">${content}</h3>`
  }

  private renderTitle(data: CardData): TemplateResult {
    const content = data.href
      ? html`<a class="lintje-card__link" href=${data.href} @click=${this.onTitleClick}
          >${data.title}</a
        >`
      : html`${data.title}`
    return this.heading(content)
  }

  private renderStatus(status: CardStatus): TemplateResult {
    const tone = status.tone ?? 'neutral'
    const icon = status.icon ?? TONE_ICON[tone]
    return html`<p class="lintje-card__status lintje-card__status--${tone}">
      ${icon ? renderIcon(icon, { size: 16, className: 'lintje-card__status-icon' }) : nothing}
      <span>${status.label}</span>
    </p>`
  }

  private renderFacts(facts: CardFact[]): TemplateResult {
    return html`<dl class="lintje-card__facts">
      ${facts.map(
        (fact) => html`<div class="lintje-card__fact">
          <dt class="lintje-card__fact-label">${fact.label}</dt>
          <dd class="lintje-card__fact-value">
            ${
              fact.value === null || fact.value === ''
                ? html`<span class="lintje-card__missing"
                    ><span aria-hidden="true">—</span
                    ><span class="visually-hidden">geen waarde</span></span
                  >`
                : fact.value
            }
          </dd>
        </div>`,
      )}
    </dl>`
  }

  private renderAction(action: CardAction, title: string): TemplateResult {
    // The words "Openen" alone say nothing out of context; the title names what opens.
    const label = html`${action.label}<span class="visually-hidden"
        >: ${title}${action.external ? ' (opent in een nieuw tabblad)' : ''}</span
      >`
    return html`<lintje-button
      class=${action.variant === 'link' ? 'lintje-card__action lintje-card__action--link' : 'lintje-card__action'}
      variant=${action.variant ?? 'secondary'}
      href=${action.href ?? nothing}
      target=${action.external ? '_blank' : nothing}
      icon-right=${action.external ? 'functioneel-externe-link' : nothing}
      @click=${(event: MouseEvent) => this.onAction(action, event)}
      >${label}</lintje-button
    >`
  }

  private renderMedia(media: CardMedia): TemplateResult {
    return (media.kind ?? 'image') === 'logo'
      ? html`<img class="lintje-card__logo" src=${media.src} alt=${media.alt} />`
      : html`<img class="lintje-card__image" src=${media.src} alt=${media.alt} loading="lazy" />`
  }

  private renderLoading(): TemplateResult {
    return html`<div class="lintje-card is-loading">
      <div class="lintje-card__body">
        <lintje-skeleton width="40%" height="14px"></lintje-skeleton>
        <lintje-skeleton width="70%" height="24px"></lintje-skeleton>
        ${
          this.compact
            ? nothing
            : html`<lintje-skeleton width="100%" height="16px"></lintje-skeleton>
                <lintje-skeleton width="85%" height="16px"></lintje-skeleton>`
        }
      </div>
    </div>`
  }

  protected override render(): TemplateResult {
    return html`${
      this.hasRegion
        ? html`<span class="visually-hidden" role="status">${this.spoken}</span>`
        : nothing
    }${this.renderCard()}`
  }

  private renderCard(): TemplateResult {
    const data = this.data
    if (this.busy || !data) return this.renderLoading()
    const media = this.compact ? undefined : data.media
    const logo = media?.kind === 'logo'
    const horizontal = this.horizontal
    // Upright, a logo stands beside the title; across, every picture has the left column.
    const column = media && (horizontal || !logo)
    const meta = (data.meta ?? []).filter((part) => part.trim() !== '').join(' · ')
    const actions = this.actions
    return html`<article
      class=${classMap({
        'lintje-card': true,
        'is-link': this.isLink,
        'is-compact': this.compact,
        'is-horizontal': horizontal,
        'has-media': Boolean(column),
        'has-logo': logo,
      })}
      @click=${this.onCardClick}
    >
      ${column ? html`<div class="lintje-card__media">${this.renderMedia(media!)}</div>` : nothing}
      <div class="lintje-card__main">
        <div class="lintje-card__body">
          <div class="lintje-card__head">
            ${media && logo && !column ? this.renderMedia(media) : nothing}
            <div class="lintje-card__heading">
              ${meta ? html`<p class="lintje-card__meta">${meta}</p>` : nothing}
              ${this.renderTitle(data)}
            </div>
            ${(data.iconActions ?? []).slice(0, 2).map((action) => this.renderIconAction(action, data))}
            ${
              this.isLink
                ? renderIcon('functioneel-delta-rechts', {
                    size: 20,
                    className: 'lintje-card__chevron',
                  })
                : nothing
            }
          </div>
          ${
            data.description && !this.compact
              ? html`<p class="lintje-card__description">${data.description}</p>`
              : nothing
          }
          ${data.facts?.length && !this.compact ? this.renderFacts(data.facts) : nothing}
          ${data.status ? this.renderStatus(data.status) : nothing}
        </div>
        ${
          actions.length
            ? html`<div class="lintje-card__actions">
                ${actions.map((action) => this.renderAction(action, data.title))}
              </div>`
            : nothing
        }
      </div>
    </article>`
  }
}

define('lintje-card', LintjeCard)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-card': LintjeCard
  }
}
