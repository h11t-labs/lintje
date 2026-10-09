/**
 * `<lintje-tabs>` — switches between panels slotted under each tab's `value`. The host holds
 * `value`; the tabs only ask. A modified click on a link tab is the browser's.
 * The row is one tab stop: arrows choose at once, and a disabled tab is reached but not chosen.
 * `variant="panel"` draws large tabs that head a panel: each with an icon and a hint, the chosen
 * one running into the panel below; on a phone the icon stands above the label and the hint goes.
 * When every tab is a link, the row is a `<nav>` of links, the chosen one `aria-current="page"`,
 * with the same look: pages are no tabs, and the content under it is the page's, not a tabpanel.
 *
 * Events: `lintje-tab-change` (the value), `lintje-navigate` `{ href }` for a tab with an `href`.
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
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import '../../../primitives/badge/badge'
import tabsCss from './tabs.css?inline'
import { isPlainClick } from '../../../core/links'

export interface TabItem {
  /** What `lintje-tab-change` carries and the name of the panel's slot. */
  value: string
  label: string
  href?: string
  count?: number
  /** A word beside the label ("Nieuw"); two words at most. */
  badge?: string
  /** The panel variant's icon, by file name. */
  icon?: string
  /** The panel variant's line under the label, hidden on a phone. */
  hint?: string
  disabled?: boolean
}

export type TabsVariant = 'line' | 'panel'

export function scrollEdges(
  scrollLeft: number,
  clientWidth: number,
  scrollWidth: number,
): { start: boolean; end: boolean } {
  return { start: scrollLeft > 1, end: scrollLeft + clientWidth < scrollWidth - 1 }
}

export function scrollToShow(
  tabLeft: number,
  tabWidth: number,
  scrollLeft: number,
  clientWidth: number,
): number {
  if (tabLeft < scrollLeft) return tabLeft
  if (tabLeft + tabWidth > scrollLeft + clientWidth) return tabLeft + tabWidth - clientWidth
  return scrollLeft
}

export class LintjeTabs extends LintjeElement {
  static override styles = [iconStyles, shadowCss(tabsCss)]

  static override properties: PropertyDeclarations = {
    tabs: { attribute: false },
    value: { type: String },
    label: { type: String },
    variant: { type: String, reflect: true },
    edges: { state: true },
  }

  tabs: TabItem[] = []
  /** The chosen tab's value; the first tab when unset. */
  declare value?: string
  label: string = ''
  /** `line` (default): a row over the content; `panel`: large tabs that head a bordered panel. */
  variant: TabsVariant = 'line'
  protected edges: { start: boolean; end: boolean } = { start: false, end: false }

  #resize: ResizeObserver | null = null
  /** A press inside a panel: Safari focuses the panel itself when the pressed control takes no
      focus, and that focus draws no ring. */
  #pressed = false

  private onPanelFocus(event: FocusEvent): void {
    ;(event.currentTarget as HTMLElement).classList.toggle('is-pressed', this.#pressed)
    this.#pressed = false
  }

  get selectedIndex(): number {
    const index = this.tabs.findIndex((tab) => tab.value === this.value)
    return index < 0 ? 0 : index
  }

  /** Every tab a link: the row is navigation between pages. */
  private get isNav(): boolean {
    return this.tabs.length > 0 && this.tabs.every((tab) => Boolean(tab.href))
  }

  private get list(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.lintje-tabs__list')
  }

  private tabElement(index: number): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(`#tab-${index}`)
  }

  override disconnectedCallback(): void {
    this.#resize?.disconnect()
    this.#resize = null
    super.disconnectedCallback()
  }

  private choose(index: number, event?: MouseEvent): void {
    const tab = this.tabs[index]
    if (!tab || tab.disabled) return
    this.emit('lintje-tab-change', tab.value)
    if (tab.href) this.followLink(tab.href, event)
  }

  private onClick(event: MouseEvent, index: number): void {
    const tab = this.tabs[index]
    if (!tab) return
    if (tab.href && !tab.disabled && !isPlainClick(event)) return
    this.choose(index, event)
  }

  private onKeydown(event: KeyboardEvent): void {
    const count = this.tabs.length
    if (!count) return
    const active = this.shadowRoot?.activeElement
    const current = Math.max(
      0,
      this.tabs.findIndex((_, index) => this.tabElement(index) === active),
    )
    let next: number | null = null
    if (event.key === 'ArrowRight') next = (current + 1) % count
    else if (event.key === 'ArrowLeft') next = (current - 1 + count) % count
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = count - 1
    if (next === null) return
    event.preventDefault()
    this.tabElement(next)?.focus()
    // A link tab is a page: an arrow only moves the focus, Enter goes there.
    if (!this.tabs[next]?.href) this.choose(next)
  }

  private measureEdges(): void {
    const list = this.list
    if (!list) return
    const next = scrollEdges(list.scrollLeft, list.clientWidth, list.scrollWidth)
    if (next.start !== this.edges.start || next.end !== this.edges.end) this.edges = next
  }

  protected override firstUpdated(): void {
    const list = this.list
    if (list && typeof ResizeObserver !== 'undefined') {
      this.#resize = new ResizeObserver(() => this.measureEdges())
      this.#resize.observe(list)
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    if (!changed.has('value') && !changed.has('tabs')) return
    const list = this.list
    const tab = this.tabElement(this.selectedIndex)
    if (list && tab && list.scrollWidth > list.clientWidth) {
      list.scrollLeft = scrollToShow(
        tab.offsetLeft,
        tab.offsetWidth,
        list.scrollLeft,
        list.clientWidth,
      )
    }
    this.measureEdges()
  }

  private renderTab(tab: TabItem, index: number, selected: boolean): TemplateResult {
    const classes = classMap({
      'lintje-tabs__tab': true,
      'focus-inset': true,
      'is-active': selected,
      'is-disabled': Boolean(tab.disabled),
    })
    const label = html`<span class="lintje-tabs__label">${tab.label}</span>${
      typeof tab.count === 'number'
        ? html`<lintje-badge variant="count">${tab.count}</lintje-badge>`
        : nothing
    }${tab.badge ? html`<lintje-badge tone="info">${tab.badge}</lintje-badge>` : nothing}`
    const content =
      this.variant === 'panel'
        ? html`${tab.icon ? renderIcon(tab.icon, { size: 24, className: 'lintje-tabs__icon' }) : nothing}<span
              class="lintje-tabs__text"
              ><span class="lintje-tabs__head">${label}</span>${
                tab.hint ? html`<span class="lintje-tabs__hint">${tab.hint}</span>` : nothing
              }</span
            >`
        : label
    if (this.isNav) {
      // A disabled page is a link without a target: `aria-disabled` needs the link role.
      return tab.disabled
        ? html`<a id="tab-${index}" class=${classes} role="link" aria-disabled="true">${content}</a>`
        : html`<a
            id="tab-${index}"
            class=${classes}
            href=${tab.href!}
            aria-current=${selected ? 'page' : nothing}
            @click=${(event: MouseEvent) => this.onClick(event, index)}
            >${content}</a
          >`
    }
    if (tab.href && !tab.disabled) {
      return html`<a
        id="tab-${index}"
        class=${classes}
        role="tab"
        href=${tab.href}
        aria-selected=${String(selected)}
        aria-controls="panel-${index}"
        tabindex=${selected ? 0 : -1}
        @click=${(event: MouseEvent) => this.onClick(event, index)}
        >${content}</a
      >`
    }
    return html`<button
      id="tab-${index}"
      type="button"
      class=${classes}
      role="tab"
      aria-selected=${String(selected)}
      aria-controls="panel-${index}"
      aria-disabled=${tab.disabled ? 'true' : nothing}
      tabindex=${selected ? 0 : -1}
      @click=${(event: MouseEvent) => this.onClick(event, index)}
    >
      ${content}
    </button>`
  }

  protected override render(): TemplateResult {
    const chosen = this.selectedIndex
    const nav = this.isNav
    const list = html`<div
      class=${classMap({
        'lintje-tabs__list': true,
        'is-scroll-start': this.edges.start,
        'is-scroll-end': this.edges.end,
      })}
      role=${nav ? nothing : 'tablist'}
      aria-label=${nav ? nothing : this.label || nothing}
      @keydown=${nav ? nothing : this.onKeydown}
      @scroll=${this.measureEdges}
    >
      ${this.tabs.map((tab, index) => this.renderTab(tab, index, index === chosen))}
    </div>`
    const classes = classMap({
      'lintje-tabs': true,
      'lintje-tabs--panel': this.variant === 'panel',
    })
    if (nav) {
      return html`<div class=${classes}>
        <nav aria-label=${this.label || nothing}>${list}</nav>
        <div class="lintje-tabs__panel"><slot name=${this.tabs[chosen]!.value}></slot></div>
      </div>`
    }
    return html`<div class=${classes}>
      ${list}
      ${this.tabs.map(
        (tab, index) => html`<div
          id="panel-${index}"
          class="lintje-tabs__panel"
          role="tabpanel"
          aria-labelledby="tab-${index}"
          tabindex="0"
          ?hidden=${index !== chosen}
          @pointerdown=${() => (this.#pressed = true)}
          @pointerup=${() => (this.#pressed = false)}
          @focus=${this.onPanelFocus}
          @blur=${(event: FocusEvent) => (event.currentTarget as HTMLElement).classList.remove('is-pressed')}
        >
          <slot name=${tab.value}></slot>
        </div>`,
      )}
    </div>`
  }
}

define('lintje-tabs', LintjeTabs)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-tabs': LintjeTabs
  }
}
