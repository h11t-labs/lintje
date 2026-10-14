/**
 * `<lintje-description-list>` — label-value pairs for a detail or a review screen, a real `<dl>`.
 *
 * A missing value (`null`, `undefined` or `''`) is a muted dash, never 0. A plain click on a link
 * is cancelled and sent as `lintje-navigate`. The facts of one thing side by side are
 * `<lintje-cells>`.
 *
 * Events: `lintje-navigate` `{ href }`.
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { define } from '../../../core/element'
import { LintjeGridItemElement, spanStyles } from '../../shared/grid-item-element'
import { shadowCss } from '../../../core/styles'
import descriptionListCss from './description-list.css?inline'
import { isPlainClick } from '../../../core/links'
import { TONE_ICON, type Tone } from '../../shared/tone'
import { iconStyles, renderIcon } from '../../../icons/render'
import { badgeStyles, renderBadge } from '../../feedback/badge/badge'

/** A link on the right of the value, for changing it ("Locatie wijzigen" as accessible name). */
export interface DescriptionAction {
  href: string
  /** The link's word; "Wijzigen" without it. */
  label?: string
}

export interface DescriptionItem {
  label: string
  /** Text the host formatted. Missing is a dash, never 0. */
  value?: string | number | null
  /** Makes the value a link. */
  href?: string
  action?: DescriptionAction
  /** The value as separate tags (word lists, people); `value` is then left out. */
  tags?: string[]
  /**
   * `changed`: differs from the default, and says "Aangepast". A shared tone carries its
   * glyph when it has one, and the words are the host's.
   */
  tone?: DescriptionTone
}

export type DescriptionTone = 'changed' | Tone
export type DescriptionListLayout = 'row' | 'column'

export class LintjeDescriptionList extends LintjeGridItemElement {
  static override styles = [iconStyles, badgeStyles, spanStyles, shadowCss(descriptionListCss)]

  static override properties: PropertyDeclarations = {
    items: { attribute: false },
    layout: { type: String, reflect: true },
  }

  items: DescriptionItem[] = []
  /** `column` keeps the label above the value at every width; `row` only below 768 px. */
  layout: DescriptionListLayout = 'row'

  private follow(event: MouseEvent, href: string): void {
    if (isPlainClick(event)) this.followLink(href, event)
  }

  private value(item: DescriptionItem): TemplateResult {
    if (item.tags) {
      return item.tags.length
        ? html`<ul class="lintje-description-list__tags">
            ${item.tags.map((tag) => html`<li class="lintje-description-list__tag">${tag}</li>`)}
          </ul>`
        : html`<span class="lintje-description-list__missing">Geen</span>`
    }
    const missing = item.value === null || item.value === undefined || item.value === ''
    if (missing) {
      return html`<span class="lintje-description-list__missing"
        ><span aria-hidden="true">—</span><span class="visually-hidden">geen waarde</span></span
      >`
    }
    if (item.href) {
      const href = item.href
      return html`<a
        class="lintje-description-list__link"
        href=${href}
        @click=${(event: MouseEvent) => this.follow(event, href)}
        >${item.value}</a
      >`
    }
    return html`<span>${item.value}</span>`
  }

  private action(item: DescriptionItem): TemplateResult | typeof nothing {
    if (!item.action) return nothing
    const { href } = item.action
    const word = item.action.label ?? 'Wijzigen'
    return html`<a
      class="lintje-description-list__action"
      href=${href}
      aria-label=${`${item.label} ${word.toLowerCase()}`}
      @click=${(event: MouseEvent) => this.follow(event, href)}
      >${word}</a
    >`
  }

  private renderItem(item: DescriptionItem): TemplateResult {
    const tone = item.tone
    return html`<div
      class=${classMap({
        'lintje-description-list__row': true,
        [`is-${tone}`]: Boolean(tone),
      })}
    >
      <dt class="lintje-description-list__label">${item.label}</dt>
      <dd class="lintje-description-list__value">
        <span class="lintje-description-list__main">
          ${tone && tone !== 'changed' ? renderIcon(TONE_ICON[tone], { size: 16 }) : nothing}
          ${this.value(item)}
          ${
            tone === 'changed'
              ? renderBadge({
                  value: 'Aangepast',
                  tone: 'neutral',
                  className: 'lintje-description-list__changed',
                })
              : nothing
          }
        </span>
        ${this.action(item)}
      </dd>
    </div>`
  }

  protected override render(): TemplateResult {
    const classes = classMap({
      'lintje-description-list': true,
      'lintje-description-list--column': this.layout === 'column',
    })
    return html`<dl class=${classes}>${this.items.map((item) => this.renderItem(item))}</dl>`
  }
}

define('lintje-description-list', LintjeDescriptionList)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-description-list': LintjeDescriptionList
  }
}
