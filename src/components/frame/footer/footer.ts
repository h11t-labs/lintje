/**
 * `<lintje-footer>` — the foot of a site or an application: a line that says what it is, columns
 * of links under a heading, and a row of the links every page carries (privacy, accessibility).
 * It stands on the menu's own fill and runs edge to edge; in `lintje-shell` it goes in the
 * `footer` slot. Below 768 px the columns stand under each other.
 *
 * Events: `lintje-navigate` `{ href }` for a plain click on a link.
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { LintjeElement, define } from '../../../core/element'
import { isPlainClick } from '../../../core/links'
import { shadowCss } from '../../../core/styles'
import footerCss from './footer.css?inline'

export interface FooterLink {
  label: string
  href: string
}

export interface FooterColumn {
  heading: string
  links: FooterLink[]
}

export interface FooterData {
  /** One line that says what the site is: "Datacatalogus — alle producten van het dataplatform". */
  tagline?: string
  columns?: FooterColumn[]
  /** The links every page carries, in the bottom row. */
  links?: FooterLink[]
  /** A short line beside them: the version, the last change. */
  note?: string
}

export class LintjeFooter extends LintjeElement {
  static override styles = shadowCss(footerCss)

  static override properties: PropertyDeclarations = {
    data: { attribute: false },
  }

  declare data?: FooterData

  private onLink(event: MouseEvent, href: string): void {
    if (isPlainClick(event)) this.followLink(href, event)
  }

  private link(item: FooterLink, className: string): TemplateResult {
    return html`<a class=${className} href=${item.href} @click=${(event: MouseEvent) => this.onLink(event, item.href)}
      >${item.label}</a
    >`
  }

  protected override render(): TemplateResult {
    const data = this.data ?? {}
    const columns = data.columns ?? []
    const links = data.links ?? []
    return html`<footer class="lintje-footer">
      <div class="lintje-footer__inner">
        ${data.tagline ? html`<p class="lintje-footer__tagline">${data.tagline}</p>` : nothing}
        ${
          columns.length
            ? html`<div class="lintje-footer__columns">
                ${columns.map(
                  (column) => html`<section class="lintje-footer__column">
                    <h2 class="lintje-footer__heading">${column.heading}</h2>
                    <ul class="lintje-footer__list">
                      ${column.links.map((item) => html`<li>${this.link(item, 'lintje-footer__link')}</li>`)}
                    </ul>
                  </section>`,
                )}
              </div>`
            : nothing
        }
        ${
          links.length || data.note
            ? html`<div class="lintje-footer__bottom">
                ${
                  links.length
                    ? html`<ul class="lintje-footer__meta">
                        ${links.map((item) => html`<li>${this.link(item, 'lintje-footer__meta-link')}</li>`)}
                      </ul>`
                    : nothing
                }
                ${data.note ? html`<p class="lintje-footer__note">${data.note}</p>` : nothing}
              </div>`
            : nothing
        }
      </div>
    </footer>`
  }
}

define('lintje-footer', LintjeFooter)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-footer': LintjeFooter
  }
}
