/**
 * `<lintje-card-list>` — a collection as cards: a real list, in as many columns as fit up to
 * `max-columns`, every card in a row as tall as the tallest. Below 768 px one column.
 * `layout="horizontal"` draws every card across, two side by side at most where they fit.
 *
 * Slots: `empty` for the way out under the empty text (a link, a button).
 *
 * It draws `lintje-card` for each item and adds nothing of its own; the cards' events pass
 * through. While `loading` it holds skeleton cards, so the page does not jump; a status region
 * that is always there says it loads, and then how many it loaded.
 *
 * Events: those of its cards.
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { LintjeElement, define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { styleProps } from '../../../core/style-props'
import '../card/card'
import '../../feedback/empty-state/empty-state'
import type { CardData, CardLayout } from '../card/card'
import cardListCss from './card-list.css?inline'

export class LintjeCardList extends LintjeElement {
  static override styles = shadowCss(cardListCss)

  static override properties: PropertyDeclarations = {
    items: { attribute: false },
    label: { type: String },
    layout: { type: String, reflect: true },
    headingLevel: { type: Number, attribute: 'heading-level' },
    compact: { type: Boolean, reflect: true },
    loading: { type: Boolean, reflect: true },
    loadingCount: { type: Number, attribute: 'loading-count' },
    maxColumns: { type: Number, attribute: 'max-columns' },
    emptyText: { type: String, attribute: 'empty-text' },
    spoken: { state: true },
  }

  items: CardData[] = []
  /** Names the list for a screen reader when no heading right above it does. */
  declare label?: string
  /** `horizontal`: every card with its picture in a column on the left, for a long list. */
  layout: CardLayout = 'vertical'
  /** The level of every card's title, 2 to 4. */
  headingLevel: 2 | 3 | 4 = 3
  compact: boolean = false
  loading: boolean = false
  /** How many skeleton cards stand in while loading. */
  loadingCount: number = 3
  /** The most cards side by side: more than three stops reading as a row of choices. */
  maxColumns: number = 3
  emptyText: string = 'Er is hier nog niets.'
  /** What the status region says: drawn empty first and filled a frame later, so it is heard. */
  spoken: string = ''

  private fillFrame = 0

  override disconnectedCallback(): void {
    cancelAnimationFrame(this.fillFrame)
    this.fillFrame = 0
    super.disconnectedCallback()
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    if (!changed.has('loading')) return
    const was = changed.get('loading')
    // Only what follows a load is said: a list that arrives whole is no news.
    if (!this.loading && !was) return
    const count = this.items.length
    const text = this.loading
      ? 'Gegevens laden…'
      : count
        ? `Gegevens geladen: ${count} ${count === 1 ? 'item' : 'items'}.`
        : `Gegevens geladen. ${this.emptyText}`
    cancelAnimationFrame(this.fillFrame)
    this.fillFrame = requestAnimationFrame(() => {
      this.fillFrame = 0
      this.spoken = text
    })
  }

  protected override render(): TemplateResult {
    return html`<span class="visually-hidden" role="status">${this.spoken}</span>${this.renderBody()}`
  }

  private renderBody(): TemplateResult {
    if (!this.loading && !this.items.length) {
      return html`<lintje-empty-state compact text=${this.emptyText}
        ><slot name="empty"></slot
      ></lintje-empty-state>`
    }
    const cards = this.loading
      ? Array.from(
          { length: this.loadingCount },
          () => html`<li class="lintje-card-list__item" aria-hidden="true">
            <lintje-card loading layout=${this.layout} ?compact=${this.compact}></lintje-card>
          </li>`,
        )
      : this.items.map(
          (item) => html`<li class="lintje-card-list__item">
            <lintje-card
              .data=${item}
              layout=${this.layout}
              heading-level=${this.headingLevel}
              ?compact=${this.compact}
            ></lintje-card>
          </li>`,
        )
    // Across, a third card leaves too little room beside its picture.
    const columns = Math.max(
      1,
      Math.min(this.maxColumns, this.layout === 'horizontal' ? 2 : this.maxColumns),
    )
    return html`<ul
      class="lintje-card-list"
      aria-label=${this.label ?? nothing}
      aria-busy=${this.loading ? 'true' : nothing}
      ${styleProps({ '--card-list-columns': columns })}
    >
      ${cards}
    </ul>`
  }
}

define('lintje-card-list', LintjeCardList)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-card-list': LintjeCardList
  }
}
