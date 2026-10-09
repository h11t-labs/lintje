/**
 * `<lintje-pagination>` — the "21–40 van 131 documenten" count on the left, "Vorige", page
 * numbers and "Volgende" in the middle and, with `page-sizes`, the choice how many stand on a page
 * on the right. Where the three do not fit on one line the count and the choice go below.
 *
 * It does not write the URL. With `href-template` every page is a link and a plain click is
 * handed to the host as `lintje-navigate`; without one they are buttons. A choice shows at once
 * and the host confirms it through `page` and `page-size`. Pages count from 1.
 *
 * Events: `lintje-page-change` `{ page }`; `lintje-page-size-change` `{ pageSize, page }`, where
 * `page` is the one that keeps the first row in view; with `href-template` also
 * `lintje-navigate` `{ href }`.
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { repeat } from 'lit/directives/repeat.js'
import { LintjeElement, define } from '../../../core/element'
import { formatNumber } from '../../../core/format'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import buttonCss from '../../../primitives/button/button.css?inline'
import paginationCss from './pagination.css?inline'
import { isPlainClick } from '../../../core/links'
import '../../actions/menu-button/menu-button'

export type PageSlot = number | 'gap'

const SLOTS = 7

/**
 * The page numbers to show for `page` of `pageCount` (both from 1): all up to seven, beyond that
 * exactly seven slots so the row keeps its length. A `'gap'` hides at least two pages.
 */
export function pageRange(page: number, pageCount: number): PageSlot[] {
  const count = Math.max(0, Math.floor(pageCount))
  if (count <= SLOTS) return Array.from({ length: count }, (_, index) => index + 1)
  const current = Math.min(Math.max(1, Math.floor(page)), count)
  if (current <= 4) return [1, 2, 3, 4, 5, 'gap', count]
  if (current >= count - 3) return [1, 'gap', count - 4, count - 3, count - 2, count - 1, count]
  return [1, 'gap', current - 1, current, current + 1, 'gap', count]
}

/** What the counted things are called, e.g. `{ many: 'documenten', one: 'document' }`. */
export interface CountUnit {
  many: string
  one: string
}

const RESULTS: CountUnit = { many: 'resultaten', one: 'resultaat' }

/**
 * "21–40 van 131 documenten": the rows on `page`, or `null` when the host gave no total. When
 * everything fits on one page the range would repeat the total, so only the total stands.
 */
export function rangeText(
  page: number,
  pageSize?: number,
  total?: number,
  unit: CountUnit = RESULTS,
): string | null {
  if (!pageSize || total === undefined || total === null || Number.isNaN(total)) return null
  if (total <= 0) return `Geen ${unit.many}`
  const noun = total === 1 ? unit.one : unit.many
  if (total <= pageSize) return `${formatNumber(total)} ${noun}`
  const first = Math.min((page - 1) * pageSize + 1, total)
  const last = Math.min(page * pageSize, total)
  const range =
    first === last ? formatNumber(first) : `${formatNumber(first)}–${formatNumber(last)}`
  return `${range} van ${formatNumber(total)} ${noun}`
}

/** `"10, 20, 50"` → `[10, 20, 50]`: whole, positive, each once, in the host's order. */
export function parsePageSizes(value: string | null): number[] | undefined {
  if (!value) return undefined
  const sizes = value
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((size) => Number.isInteger(size) && size > 0)
  return sizes.length ? [...new Set(sizes)] : undefined
}

type Control = 'previous' | 'next' | number

export class LintjePagination extends LintjeElement {
  static override styles = [iconStyles, shadowCss(buttonCss), shadowCss(paginationCss)]

  static override properties: PropertyDeclarations = {
    page: { type: Number },
    pageCount: { type: Number, attribute: 'page-count' },
    total: { type: Number },
    pageSize: { type: Number, attribute: 'page-size' },
    pageSizes: { attribute: 'page-sizes', converter: { fromAttribute: parsePageSizes } },
    unit: { type: String },
    unitOne: { type: String, attribute: 'unit-one' },
    hrefTemplate: { type: String, attribute: 'href-template' },
    label: { type: String },
    compact: { state: true },
    stacked: { state: true },
  }

  page: number = 1
  /** Without it the pages follow from `total` and `page-size`. */
  declare pageCount?: number
  /** Rows over all pages, for the count. */
  declare total?: number
  declare pageSize?: number
  /** `"10, 20, 50"`: draws the choice how many stand on a page. */
  declare pageSizes?: number[]
  /** What is counted, plural and singular: `unit="documenten" unit-one="document"`. */
  declare unit?: string
  declare unitOne?: string
  /** `?pagina={page}`: every page becomes a link with that href. */
  declare hrefTemplate?: string
  label: string = 'Paginering'

  /** Only the chevrons: "Vorige" and "Volgende" do not fit beside the numbers. */
  protected compact: boolean = false
  /** The count and the size choice below the pages: the three zones do not fit on one line. */
  protected stacked: boolean = false
  #resize: ResizeObserver | null = null

  override connectedCallback(): void {
    super.connectedCallback()
    if (typeof ResizeObserver === 'undefined') return
    this.#resize = new ResizeObserver(() => this.fit())
    this.#resize.observe(this)
  }

  override disconnectedCallback(): void {
    this.#resize?.disconnect()
    this.#resize = null
    super.disconnectedCallback()
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    this.fit()
  }

  /**
   * Drops the words when the row with them would not fit on one line. It always measures the row
   * with the words, shown for the measurement only, so the choice never flips back and forth.
   */
  private fit(): void {
    const row = this.renderRoot.querySelector<HTMLElement>('.lintje-pagination')
    const nav = this.renderRoot.querySelector<HTMLElement>('.lintje-pagination__nav')
    if (!row || !nav) return
    const words = [...nav.querySelectorAll<HTMLElement>('.lintje-pagination__word')]
    const show = (compact: boolean): void => {
      row.classList.toggle('is-compact', compact)
      for (const word of words) word.classList.toggle('visually-hidden', compact)
    }
    show(false)
    const parts = [
      ...nav.querySelectorAll<HTMLElement>(
        '[data-step], .lintje-pagination__page, .lintje-pagination__gap, .lintje-pagination__where',
      ),
    ].filter((part) => part.getClientRects().length > 0)
    const gap = parseFloat(getComputedStyle(nav).columnGap) || 0
    const needed = parts.reduce(
      (sum, part) => sum + Math.max(part.getBoundingClientRect().width, part.scrollWidth),
      gap * (parts.length - 1),
    )
    const available = row.clientWidth
    // The pages stay centred, so each side takes as much as the wider of the two.
    const side = Math.max(
      0,
      ...[
        ...row.querySelectorAll<HTMLElement>('.lintje-pagination__count, .lintje-pagination__size'),
      ].map((part) => Math.max(part.getBoundingClientRect().width, part.scrollWidth)),
    )
    const rowGap = parseFloat(getComputedStyle(row).columnGap) || 0
    show(this.compact)
    const compact = needed > available + 0.5
    const stacked = side > 0 && needed + 2 * (side + rowGap) > available + 0.5
    if (compact !== this.compact) this.compact = compact
    if (stacked !== this.stacked) this.stacked = stacked
  }

  private get count(): number {
    if (this.pageCount) return Math.max(1, Math.floor(this.pageCount))
    if (this.pageSize && this.total) return Math.max(1, Math.ceil(this.total / this.pageSize))
    return 1
  }

  private get current(): number {
    return Math.min(Math.max(1, Math.floor(this.page || 1)), this.count)
  }

  private hrefFor(page: number): string | undefined {
    return this.hrefTemplate ? this.hrefTemplate.replaceAll('{page}', String(page)) : undefined
  }

  private choose(event: MouseEvent, page: number, control: Control): void {
    const href = this.hrefFor(page)
    if (href && !isPlainClick(event)) return
    if (page === this.current) {
      event.preventDefault()
      return
    }
    this.page = page
    this.emit('lintje-page-change', { page })
    if (href) this.followLink(href, event)
    void this.updateComplete.then(() => this.keepFocus(control))
  }

  private get countUnit(): CountUnit {
    if (!this.unit) return RESULTS
    return { many: this.unit, one: this.unitOne || this.unit }
  }

  private chooseSize(size: number): void {
    if (!size || size === this.pageSize) return
    const first = this.pageSize ? (this.current - 1) * this.pageSize : 0
    const page = Math.floor(first / size) + 1
    this.pageSize = size
    this.page = page
    this.emit('lintje-page-size-change', { pageSize: size, page })
  }

  private sizes(): TemplateResult | typeof nothing {
    const sizes = this.pageSizes
    if (!sizes?.length) return nothing
    const current = this.pageSize ?? sizes[0]
    // A size the host set outside the list still shows as the chosen one.
    const all = sizes.includes(current) ? sizes : [...sizes, current].sort((a, b) => a - b)
    const many = this.countUnit.many
    // Flat, like the steps: a bordered field here would outweigh the pages themselves.
    return html`<lintje-menu-button
      class="lintje-pagination__size"
      variant="flat"
      placement="bottom-end"
      label=${`${formatNumber(current)} per pagina`}
      accessible-label=${`${many[0].toUpperCase()}${many.slice(1)}: ${formatNumber(current)} per pagina`}
      .items=${all.map((size) => ({
        value: String(size),
        label: `${formatNumber(size)} per pagina`,
        checked: size === current,
        radio: true,
      }))}
      @lintje-action=${(event: CustomEvent<string>) => {
        event.stopPropagation()
        this.chooseSize(Number(event.detail))
      }}
    ></lintje-menu-button>`
  }

  /** Focus stays on the used control, else the current page, else the other step (phone). */
  private keepFocus(control: Control): void {
    const root = this.renderRoot as ShadowRoot
    const used = root.querySelector<HTMLElement>(
      typeof control === 'number' ? `[data-page="${control}"]` : `[data-step="${control}"]`,
    )
    const candidates = [
      used,
      root.querySelector<HTMLElement>('[aria-current="page"]'),
      root.querySelector<HTMLElement>('[data-step]:not(:disabled)'),
    ]
    for (const candidate of candidates) {
      if (!candidate || (candidate instanceof HTMLButtonElement && candidate.disabled)) continue
      candidate.focus()
      if (root.activeElement === candidate) return
    }
  }

  private step(step: 'previous' | 'next', target: number, disabled: boolean): TemplateResult {
    const previous = step === 'previous'
    const text = previous ? 'Vorige' : 'Volgende'
    const icon = renderIcon('functioneel-delta-rechts', {
      size: 16,
      flip: previous ? 'horizontal' : undefined,
    })
    // Hidden, the word stays the step's name.
    const word = html`<span
      class=${classMap({ 'lintje-pagination__word': true, 'visually-hidden': this.compact })}
      >${text}</span
    >`
    const content = previous ? html`${icon}${word}` : html`${word}${icon}`
    const href = this.hrefFor(target)
    // A disabled link is not a link: the end of the row is always a disabled button.
    if (disabled || !href) {
      return html`<button
        type="button"
        class=${classMap({
          'lintje-button': true,
          'lintje-button--link': true,
          'lintje-pagination__step': true,
          'is-disabled': disabled,
        })}
        data-step=${step}
        ?disabled=${disabled}
        @click=${(event: MouseEvent) => this.choose(event, target, step)}
      >
        ${content}
      </button>`
    }
    return html`<a
      class="lintje-button lintje-button--link lintje-pagination__step"
      data-step=${step}
      href=${href}
      @click=${(event: MouseEvent) => this.choose(event, target, step)}
      >${content}</a
    >`
  }

  private number(page: number, current: number): TemplateResult {
    const active = page === current
    const classes = classMap({ 'lintje-pagination__page': true, 'is-current': active })
    const name = active ? `Pagina ${page}, huidige pagina` : `Ga naar pagina ${page}`
    const href = this.hrefFor(page)
    if (href) {
      return html`<a
        class=${classes}
        href=${href}
        data-page=${page}
        aria-label=${name}
        aria-current=${active ? 'page' : nothing}
        @click=${(event: MouseEvent) => this.choose(event, page, page)}
        >${page}</a
      >`
    }
    return html`<button
      type="button"
      class=${classes}
      data-page=${page}
      aria-label=${name}
      aria-current=${active ? 'page' : nothing}
      @click=${(event: MouseEvent) => this.choose(event, page, page)}
    >
      ${page}
    </button>`
  }

  protected override render(): TemplateResult {
    const count = this.count
    const current = this.current
    const slots = pageRange(current, count)
    const at = slots.indexOf(current)
    const range = rangeText(current, this.pageSize, this.total, this.countUnit)
    return html`<div
      class=${classMap({
        'lintje-pagination': true,
        'is-compact': this.compact,
        'is-stacked': this.stacked,
      })}
    >
      ${range ? html`<p class="lintje-pagination__count">${range}</p>` : nothing}
      <nav class="lintje-pagination__nav" aria-label=${this.label}>
        ${this.step('previous', current - 1, current <= 1)}
        <span class="lintje-pagination__pages">
          ${repeat(
            slots,
            // Keyed by page: a number keeps its DOM button, the two gaps are told apart by side.
            (slot, index) => (slot === 'gap' ? (index < at ? 'gap-before' : 'gap-after') : slot),
            (slot) =>
              slot === 'gap'
                ? html`<span class="lintje-pagination__gap" aria-hidden="true">…</span>`
                : this.number(slot, current),
          )}
        </span>
        <span class="lintje-pagination__where">Pagina ${current} van ${count}</span>
        ${this.step('next', current + 1, current >= count)}
      </nav>
      ${this.sizes()}
    </div>`
  }
}

define('lintje-pagination', LintjePagination)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-pagination': LintjePagination
  }
}
