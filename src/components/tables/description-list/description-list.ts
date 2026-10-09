/**
 * `<lintje-description-list>` — label-value pairs for a detail or a review screen, a real `<dl>`.
 *
 * A missing value (`null`, `undefined` or `''`) is a muted dash, never 0 (rule 15). A plain click
 * on a link is cancelled and sent as `lintje-navigate`; a modified click is the browser's.
 *
 * `layout="grid"` sets the pairs as cells side by side, for a summary of what is about to happen
 * ("Deze opname"): a cell can take two columns, carry an icon and a tone, show its value as tags,
 * and take richer content through a slot named by the item (`slot`). Below 30rem of its own width
 * it has two columns.
 *
 * Events: `lintje-navigate` `{ href }`.
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { define } from '../../../core/element'
import { LintjeGridItemElement, spanStyles } from '../../../primitives/shared/grid-item-element'
import { shadowCss } from '../../../core/styles'
import descriptionListCss from './description-list.css?inline'
import { isPlainClick } from '../../../core/links'
import { styleProps } from '../../../core/style-props'
import { iconStyles, renderIcon } from '../../../icons/render'
import { badgeStyles, renderBadge } from '../../../primitives/badge/badge'

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
  /** Grid: an icon by the label, by file name. */
  icon?: string
  /** Grid: two columns instead of one. */
  span?: 1 | 2
  /** Grid: the one figure a reader looks at, as large as a key figure. */
  large?: boolean
  /**
   * `changed`: differs from the default, and says "Aangepast". `warning` and `error`: something to
   * act on; the glyph comes with it, the words are the host's (in the value or its slot).
   */
  tone?: DescriptionTone
  /** The name of a slot drawn under the value, for what a string cannot say (a meter, a button). */
  slot?: string
}

export type DescriptionTone = 'changed' | 'warning' | 'error'
export type DescriptionListLayout = 'row' | 'column' | 'grid'

const TONE_ICON: Record<Exclude<DescriptionTone, 'changed'>, string> = {
  warning: 'functioneel-waarschuwing',
  error: 'functioneel-foutmelding',
}

export class LintjeDescriptionList extends LintjeGridItemElement {
  static override styles = [iconStyles, badgeStyles, spanStyles, shadowCss(descriptionListCss)]

  static override properties: PropertyDeclarations = {
    items: { attribute: false },
    layout: { type: String, reflect: true },
    columns: { type: Number },
    surface: { type: Boolean, reflect: true },
  }

  items: DescriptionItem[] = []
  /** Grid: how many cells stand side by side where there is room; two below 30rem. */
  columns: number = 4
  /** Grid: the cells take the surface and a frame, for a wash such as the hero's. */
  surface: boolean = false
  /** `column` keeps the label above the value at every width; `row` only below 768 px; `grid`: cells. */
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
    // A cell whose slot says it all has no value of its own, and no dash either.
    if (missing && item.slot) return html``
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
    const grid = this.layout === 'grid'
    const tone = item.tone
    return html`<div
      class=${classMap({
        'lintje-description-list__row': true,
        'is-wide': grid && item.span === 2,
        'is-large': grid && Boolean(item.large),
        [`is-${tone}`]: Boolean(tone),
      })}
    >
      <dt class="lintje-description-list__label"
        >${grid && item.icon ? renderIcon(item.icon, { size: 16 }) : nothing}${item.label}</dt
      >
      <dd class="lintje-description-list__value">
        <span class="lintje-description-list__main">
          ${tone && tone !== 'changed' ? renderIcon(TONE_ICON[tone], { size: 16 }) : nothing}
          ${this.value(item)}
        </span>
        ${item.slot ? html`<slot name=${item.slot}></slot>` : nothing}
        ${
          tone === 'changed'
            ? renderBadge({
                value: 'Aangepast',
                tone: 'neutral',
                className: 'lintje-description-list__changed',
              })
            : nothing
        }
        ${this.action(item)}
      </dd>
    </div>`
  }

  protected override render(): TemplateResult {
    const classes = classMap({
      'lintje-description-list': true,
      'lintje-description-list--column': this.layout === 'column',
      'lintje-description-list--grid': this.layout === 'grid',
    })
    return html`<dl class=${classes} ${styleProps({ '--lintje-columns': String(this.columns) })}>
      ${this.items.map((item) => this.renderItem(item))}
    </dl>`
  }
}

define('lintje-description-list', LintjeDescriptionList)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-description-list': LintjeDescriptionList
  }
}
