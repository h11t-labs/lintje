/**
 * `<lintje-cells>` — the facts of one thing side by side, each a label above its value with a
 * hairline between them: how a running recording is doing, the facts of a case under its
 * title, what is about to happen, a device in a list.
 *
 * With `columns` the cells stand in an aligned grid, two below 30 rem; without, each takes its
 * own width and the row wraps. On a wash (`surface`) the row stands in one panel. A missing
 * value is a muted dash, never 0. A plain click on a link is cancelled and sent as
 * `lintje-navigate`.
 *
 * Events: `lintje-navigate` `{ href }`.
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { define } from '../../../core/element'
import { LintjeGridItemElement, spanStyles } from '../../shared/grid-item-element'
import { shadowCss } from '../../../core/styles'
import { isPlainClick } from '../../../core/links'
import { styleProps } from '../../../core/style-props'
import { TONE_ICON, type Tone } from '../../shared/tone'
import { iconStyles, renderIcon } from '../../../icons/render'
import { badgeStyles, renderBadge } from '../../feedback/badge/badge'
import { litSteps } from '../../feedback/level-meter/level-meter'
import '../../feedback/level-meter/level-meter'
import cellsCss from './cells.css?inline'

/** A link beside the value, for changing it ("Behandelaar wijzigen" as accessible name). */
export interface CellAction {
  href: string
  /** The link's word; "Wijzigen" without it. */
  label?: string
}

/** A measure drawn before the value: the level meter, in steps when `steps` is given. */
export interface CellMeter {
  /** 0 to 1; `null` before it is measured. */
  level: number | null
  /** Rising steps instead of the voice shape; the level lights its share. */
  steps?: number
  /** The colour of what is lit; the accent without. */
  tone?: Tone
}

export type CellTone = 'changed' | Tone

/** How many columns a `fill` cell spans: the rest of its row, at the grid's columns and at two. */
interface Fill {
  wide: number
  narrow: number
}

/**
 * Walks the items as the grid places them, at `columns` and at the two of a narrow container,
 * so a `fill` cell knows how much of its row is left; a wide cell on a narrow grid is a row.
 */
export function fillSpans(items: CellItem[], columns: number): (Fill | undefined)[] {
  const place = (width: number): number[] => {
    let cursor = 0
    return items.map((item) => {
      const size = item.span === 2 ? Math.min(2, width) : 1
      if (item.span === 'fill') {
        const span = width - cursor
        cursor = 0
        return span
      }
      if (cursor + size > width) cursor = 0
      cursor = (cursor + size) % width
      return size
    })
  }
  const wide = place(columns)
  const narrow = place(2)
  return items.map((item, i) =>
    item.span === 'fill' ? { wide: wide[i]!, narrow: narrow[i]! } : undefined,
  )
}

export interface CellItem {
  label: string
  /** An icon by the label, by file name. */
  icon?: string
  /** Text the host formatted; with a meter, its word. Missing is a dash, never 0. */
  value?: string | number | null
  /** A muted detail after the value ("3 seconden achter"). */
  detail?: string
  /** The one figure a reader looks at, as large as a key figure on a phone. */
  large?: boolean
  /** Makes the value a link. */
  href?: string
  action?: CellAction
  /** The value as separate tags (word lists, people); `value` is then left out. */
  tags?: string[]
  /**
   * `changed`: differs from the default, and says "Aangepast". A shared tone carries its glyph
   * before the value; the words are the host's.
   */
  tone?: CellTone
  meter?: CellMeter
  /** Two columns of the grid instead of one, or `fill`: the rest of its row. */
  span?: 1 | 2 | 'fill'
  /** The name of a slot drawn under the value, for what a string cannot say (a button). */
  slot?: string
}

export class LintjeCells extends LintjeGridItemElement {
  static override styles = [iconStyles, badgeStyles, spanStyles, shadowCss(cellsCss)]

  static override properties: PropertyDeclarations = {
    items: { attribute: false },
    columns: { type: Number, reflect: true },
    surface: { type: Boolean, reflect: true },
  }

  items: CellItem[] = []
  /** An aligned grid of this many cells side by side where there is room; without, a free row. */
  declare columns?: number
  /** The row takes the surface and a frame, for a wash such as the hero's. */
  surface: boolean = false

  private follow(event: MouseEvent, href: string): void {
    if (isPlainClick(event)) this.followLink(href, event)
  }

  private value(item: CellItem): TemplateResult | typeof nothing {
    if (item.tags) {
      return item.tags.length
        ? html`<ul class="lintje-cells__tags">
            ${item.tags.map((tag) => html`<li class="lintje-cells__tag">${tag}</li>`)}
          </ul>`
        : html`<span class="lintje-cells__missing">Geen</span>`
    }
    const missing = item.value === null || item.value === undefined || item.value === ''
    // A cell whose slot or measured meter says it all has no value of its own, and no dash either.
    if (missing && (item.slot || item.meter?.level != null)) return nothing
    if (missing) {
      return html`<span class="lintje-cells__missing"
        ><span aria-hidden="true">—</span><span class="visually-hidden">geen waarde</span></span
      >`
    }
    if (item.href) {
      const href = item.href
      return html`<a
        class="lintje-cells__link"
        href=${href}
        @click=${(event: MouseEvent) => this.follow(event, href)}
        >${item.value}</a
      >`
    }
    return html`<span>${item.value}</span>`
  }

  // The meter is hidden from the screen reader: the cell's words carry it, with its count after.
  private meter(meter: CellMeter): TemplateResult {
    return html`<lintje-level-meter
      class="lintje-cells__meter"
      aria-hidden="true"
      .level=${meter.level}
      .steps=${meter.steps}
      .tone=${meter.tone}
      .words=${false}
    ></lintje-level-meter>`
  }

  private count(meter: CellMeter | undefined): TemplateResult | typeof nothing {
    if (!meter?.steps || meter.level == null) return nothing
    return html`<span class="visually-hidden"
      >, ${litSteps(meter.level, meter.steps)} van ${meter.steps}</span
    >`
  }

  private action(item: CellItem): TemplateResult | typeof nothing {
    if (!item.action) return nothing
    const { href } = item.action
    const word = item.action.label ?? 'Wijzigen'
    return html`<a
      class="lintje-cells__action"
      href=${href}
      aria-label=${`${item.label} ${word.toLowerCase()}`}
      @click=${(event: MouseEvent) => this.follow(event, href)}
      >${word}</a
    >`
  }

  private renderCell(item: CellItem, fill: Fill | undefined): TemplateResult {
    const tone = item.tone
    return html`<div
      class=${classMap({
        'lintje-cells__cell': true,
        'is-wide': item.span === 2,
        'is-fill': Boolean(fill),
        'is-large': Boolean(item.large),
        [`is-${tone}`]: Boolean(tone),
      })}
      ${styleProps(
        fill
          ? { '--lintje-fill': String(fill.wide), '--lintje-fill-narrow': String(fill.narrow) }
          : {},
      )}
    >
      <dt class="lintje-cells__label"
        >${item.icon ? renderIcon(item.icon, { size: 16 }) : nothing}${item.label}</dt
      >
      <dd class="lintje-cells__value">
        ${tone && tone !== 'changed' ? renderIcon(TONE_ICON[tone], { size: 16 }) : nothing}
        ${item.meter ? this.meter(item.meter) : nothing} ${this.value(item)}${this.count(item.meter)}
        ${item.detail ? html`<span class="lintje-cells__detail">${item.detail}</span>` : nothing}
        ${
          tone === 'changed'
            ? renderBadge({
                value: 'Aangepast',
                tone: 'neutral',
                className: 'lintje-cells__changed',
              })
            : nothing
        }
        ${this.action(item)}
        ${item.slot ? html`<div class="lintje-cells__extra"><slot name=${item.slot}></slot></div>` : nothing}
      </dd>
    </div>`
  }

  protected override render(): TemplateResult {
    const columns = this.columns && this.columns > 0 ? this.columns : 0
    const fills = columns ? fillSpans(this.items, columns) : []
    // The first column's line falls outside the clip; see cells.css.
    return html`<div class="lintje-cells__clip">
      <dl
        class=${classMap({ 'lintje-cells': true, 'lintje-cells--grid': columns > 0 })}
        ${styleProps({ '--lintje-columns': columns ? String(columns) : null })}
      >
        ${this.items.map((item, i) => this.renderCell(item, fills[i]))}
      </dl>
    </div>`
  }
}

define('lintje-cells', LintjeCells)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-cells': LintjeCells
  }
}
