/**
 * `<lintje-breadcrumbs>` — the breadcrumb trail above a page's title.
 *
 * The last item is the current page (`aria-current`), never a link. Past `MAX_LEVELS` the middle
 * collapses into a "…" menu. It never reads the URL: the host passes the levels.
 *
 * Events: `lintje-navigate` `{ href }`.
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { LintjeElement, define } from '../../../core/element'
import { MediaController, MOBILE } from '../../../core/media'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import '../../actions/menu-button/menu-button'
import type { MenuItem } from '../../actions/menu-button/menu-button'
import breadcrumbsCss from './breadcrumbs.css?inline'
import { isPlainClick } from '../../../core/links'

/** Without `href` a level is not a link. */
export interface Crumb {
  label: string
  href?: string
}

export const MAX_LEVELS = 4

export interface Trail {
  head: Crumb[]
  folded: Crumb[]
  tail: Crumb[]
}

export function trail(items: Crumb[]): Trail {
  if (items.length <= MAX_LEVELS) return { head: items, folded: [], tail: [] }
  return { head: items.slice(0, 1), folded: items.slice(1, -2), tail: items.slice(-2) }
}

export class LintjeBreadcrumbs extends LintjeElement {
  static override styles = [iconStyles, shadowCss(breadcrumbsCss)]

  static override properties: PropertyDeclarations = {
    items: { attribute: false },
    label: { type: String },
  }

  items: Crumb[] = []
  label: string = 'Kruimelpad'

  #mobile = new MediaController(this, MOBILE)

  private follow(event: MouseEvent, href: string): void {
    if (isPlainClick(event)) this.followLink(href, event)
  }

  private renderCrumb(item: Crumb, current: boolean): TemplateResult {
    if (current) {
      return html`<span class="lintje-breadcrumbs__current" aria-current="page">${item.label}</span>`
    }
    if (!item.href) return html`<span class="lintje-breadcrumbs__text">${item.label}</span>`
    const href = item.href
    return html`<a
      class="lintje-breadcrumbs__link"
      href=${href}
      @click=${(event: MouseEvent) => this.follow(event, href)}
      >${item.label}</a
    >`
  }

  private renderMenu(folded: Crumb[]): TemplateResult {
    const items: MenuItem[] = folded.map((crumb, index) => ({
      value: String(index),
      label: crumb.label,
      href: crumb.href,
      disabled: !crumb.href,
    }))
    // The menu's `lintje-navigate` crosses to the host; its `lintje-action` stops here.
    return html`<lintje-menu-button
      variant="ellipsis"
      label="Tussenliggende niveaus tonen"
      .items=${items}
      @lintje-action=${(event: Event) => event.stopPropagation()}
    ></lintje-menu-button>`
  }

  private renderPhone(): TemplateResult | typeof nothing {
    const back = this.items.at(-2)
    if (!back?.href) return nothing
    const href = back.href
    return html`<nav class="lintje-breadcrumbs lintje-breadcrumbs--back" aria-label=${this.label}>
      <a
        class="lintje-breadcrumbs__back"
        href=${href}
        @click=${(event: MouseEvent) => this.follow(event, href)}
      >
        ${renderIcon('functioneel-delta-rechts', { size: 16, flip: 'horizontal' })}${back.label}
      </a>
    </nav>`
  }

  protected override render(): TemplateResult | typeof nothing {
    if (!this.items.length) return nothing
    if (this.#mobile.matches) return this.renderPhone()
    const { head, folded, tail } = trail(this.items)
    const last = this.items.length - 1
    const entries: TemplateResult[] = head.map((item, index) =>
      this.renderCrumb(item, index === last),
    )
    if (folded.length) {
      entries.push(this.renderMenu(folded))
      tail.forEach((item, index) => entries.push(this.renderCrumb(item, index === tail.length - 1)))
    }
    return html`<nav class="lintje-breadcrumbs" aria-label=${this.label}>
      <ol class="lintje-breadcrumbs__list">
        ${entries.map(
          (entry, index) =>
            html`<li class="lintje-breadcrumbs__item">
              ${
                index
                  ? html`<span class="lintje-breadcrumbs__separator" aria-hidden="true">›</span>`
                  : nothing
              }${entry}
            </li>`,
        )}
      </ol>
    </nav>`
  }
}

define('lintje-breadcrumbs', LintjeBreadcrumbs)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-breadcrumbs': LintjeBreadcrumbs
  }
}
