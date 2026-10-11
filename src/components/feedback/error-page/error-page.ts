/**
 * `<lintje-error-page>` — the page in place of the one the reader asked for: not found, no
 * access, a failure, or not available. It says why in words and shows the way onward.
 *
 * `code` is a small line above the heading ("Foutcode 404"), with the lock for 401 and 403 and
 * the outage mark for a 5xx. The server sends the HTTP status and the document's `<title>`; the
 * element only draws. The default slot takes what helps under the text (a search field, the
 * announcement of planned maintenance), `slot="actions"` the buttons; below 768 px the actions
 * stand under each other, and a `lintje-button` with `block` fills the width.
 *
 * A failure gives a `reference` the reader can copy and pass on, with the moment it happened.
 *
 * Events: `lintje-navigate` `{ href }` from a plain click on one of `links`.
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { LintjeElement, define } from '../../../core/element'
import { isPlainClick } from '../../../core/links'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import '../../actions/copy-button/copy-button'
import '../../tables/description-list/description-list'
import type { DescriptionItem } from '../../tables/description-list/description-list'
import errorPageCss from './error-page.css?inline'

export interface ErrorPageLink {
  label: string
  href: string
}

/** The mark beside the code: who may not enter, and what failed on the server's side. */
function markFor(code: string | undefined): { icon: string; tone: string } | null {
  const status = Number(code)
  if (status === 401 || status === 403)
    return { icon: 'gebruiksvoorwerpen-hangslot-dicht', tone: 'lock' }
  if (status >= 500 && status < 600) return { icon: 'functioneel-foutmelding', tone: 'error' }
  return null
}

export class LintjeErrorPage extends LintjeElement {
  static override styles = [iconStyles, shadowCss(errorPageCss)]

  static override properties: PropertyDeclarations = {
    code: { type: String },
    heading: { type: String },
    text: { type: String },
    level: { type: Number },
    links: { attribute: false },
    reference: { type: String },
    occurred: { type: String },
    hasActions: { state: true },
  }

  /** The HTTP status as the server sent it ("404"); without it there is no code line. */
  declare code?: string
  /** What is the matter, in words: "Deze pagina bestaat niet". */
  declare heading?: string
  /** Why, and what the reader can do. */
  declare text?: string
  /** 2 in `lintje-shell`, whose `name` is the page's h1; 1 for a page outside the shell. */
  level: 1 | 2 = 2
  /** "Verder naar": the pages a reader most likely wanted instead. */
  links: ErrorPageLink[] = []
  /** The code the service desk looks the failure up by, with a copy button. */
  declare reference?: string
  /** When it happened, as the host wrote it ("11 oktober 2026, 14.32 uur"). */
  declare occurred?: string
  // An empty actions slot takes no place in the column's gap.
  hasActions: boolean = false

  private follow(event: MouseEvent, href: string): void {
    if (!isPlainClick(event)) return
    this.followLink(href, event)
  }

  private renderCode(): TemplateResult | typeof nothing {
    if (!this.code) return nothing
    const mark = markFor(this.code)
    return html`<p class="lintje-error-page__code">
      ${
        mark
          ? renderIcon(mark.icon, {
              size: 16,
              className: `lintje-error-page__mark lintje-error-page__mark--${mark.tone}`,
            })
          : nothing
      }Foutcode ${this.code}
    </p>`
  }

  private renderHeading(): TemplateResult | typeof nothing {
    if (!this.heading) return nothing
    return this.level === 1
      ? html`<h1 class="lintje-error-page__heading">${this.heading}</h1>`
      : html`<h2 class="lintje-error-page__heading">${this.heading}</h2>`
  }

  private renderReference(): TemplateResult | typeof nothing {
    if (!this.reference) return nothing
    const items: DescriptionItem[] = [{ label: 'Referentie', value: this.reference }]
    if (this.occurred) items.push({ label: 'Tijdstip', value: this.occurred })
    // The button stands under the pairs: beside the value it squeezes the code in a narrow column.
    return html`<div class="lintje-error-page__reference">
      <lintje-description-list
        class="lintje-error-page__pairs"
        .items=${items}
      ></lintje-description-list>
      <lintje-copy-button text=${this.reference}></lintje-copy-button>
    </div>`
  }

  private renderLinks(): TemplateResult | typeof nothing {
    if (this.links.length === 0) return nothing
    const heading = 'Verder naar'
    return html`<nav class="lintje-error-page__links" aria-labelledby="links-heading">
      ${
        this.level === 1
          ? html`<h2 id="links-heading" class="lintje-error-page__links-heading">${heading}</h2>`
          : html`<h3 id="links-heading" class="lintje-error-page__links-heading">${heading}</h3>`
      }
      <ul class="lintje-error-page__list">
        ${this.links.map(
          (link) => html`<li class="lintje-error-page__item">
            <a
              class="lintje-error-page__link"
              href=${link.href}
              @click=${(event: MouseEvent) => this.follow(event, link.href)}
              >${renderIcon('functioneel-delta-rechts', { size: 16 })}${link.label}</a
            >
          </li>`,
        )}
      </ul>
    </nav>`
  }

  protected override render(): TemplateResult {
    return html`<div class="lintje-error-page">
      <div class="lintje-error-page__head">${this.renderCode()}${this.renderHeading()}</div>
      ${this.text ? html`<p class="lintje-error-page__text">${this.text}</p>` : nothing}
      <slot></slot>
      ${this.renderReference()}
      <slot
        name="actions"
        class=${classMap({ 'lintje-error-page__actions': true, 'is-empty': !this.hasActions })}
        @slotchange=${(event: Event) => {
          this.hasActions = (event.target as HTMLSlotElement).assignedElements().length > 0
        }}
      ></slot>
      ${this.renderLinks()}
    </div>`
  }
}

define('lintje-error-page', LintjeErrorPage)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-error-page': LintjeErrorPage
  }
}
