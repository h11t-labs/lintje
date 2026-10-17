/**
 * `<lintje-accordion>` — expanders stacked as one list: a row per `<lintje-expander>`, lines
 * between them, the chevron before each title.
 *
 * It holds nothing: each row keeps its own `open`, and a host that keeps an open row in the URL
 * sets `open` on that row. More rows may stand open at once unless `exclusive`. Hide nothing here
 * that every reader needs: what a row holds is easily missed.
 *
 * Events: none of its own. Each row sends `lintje-toggle`, also when `exclusive` or the link
 * "Alles openen" opened or closed it.
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
import { AttributeHold, PropertyHold } from '../../shared/controls'
import type { HeadingLevel } from '../../shared/empty-state-block'
import { LintjeExpander } from '../expander/expander'
import '../../actions/button/button'
import accordionCss from './accordion.css?inline'

export class LintjeAccordion extends LintjeElement {
  static override styles = shadowCss(accordionCss)

  static override properties: PropertyDeclarations = {
    exclusive: { type: Boolean, reflect: true },
    toggleAll: { type: Boolean, attribute: 'toggle-all' },
    level: { type: Number },
    allOpen: { state: true },
  }

  /** Opening a row closes the others; content then moves away under the reader. */
  exclusive: boolean = false
  /** A link above the rows, "Alles openen" or "Alles sluiten". Not with `exclusive`. */
  toggleAll: boolean = false
  /** The rows' heading level, 2 to 6; each row's own (`h3`) when unset. */
  declare level?: HeadingLevel
  protected allOpen: boolean = false

  readonly #flat = new PropertyHold('flat')
  readonly #leading = new PropertyHold('leading')
  readonly #level = new PropertyHold('level')
  readonly #row = new AttributeHold('row')
  // Each open row reflects `open`, also when the host sets it; the link reads that.
  readonly #observer = new MutationObserver(() => this.#count())
  /** While the accordion itself opens or closes rows, their toggles ask nothing of it. */
  #own = false
  #synced = false

  private get rows(): LintjeExpander[] {
    const slot = this.renderRoot.querySelector('slot')
    const elements = slot ? slot.assignedElements() : [...this.children]
    return elements.filter(
      (element): element is LintjeExpander => element instanceof LintjeExpander,
    )
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.addEventListener('lintje-toggle', this.#onToggle)
    this.#observer.observe(this, { attributes: true, attributeFilter: ['open'], subtree: true })
    if (this.hasUpdated) this.#sync()
  }

  override disconnectedCallback(): void {
    this.removeEventListener('lintje-toggle', this.#onToggle)
    this.#observer.disconnect()
    this.#release()
    super.disconnectedCallback()
  }

  // Also after the first render, whether or not the slot reports the rows it starts with.
  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    if (!this.#synced || changed.has('level')) this.#sync()
  }

  /** A row outside the accordion has what it had before. */
  #release(): void {
    this.#flat.release()
    this.#leading.release()
    this.#level.release()
    this.#row.release()
  }

  #sync(): void {
    this.#synced = true
    this.#release()
    const rows = this.rows
    this.#flat.apply(rows, true)
    this.#leading.apply(rows, true)
    this.#row.apply(rows, true)
    if (this.level != null) this.#level.apply(rows, this.level)
    this.#count()
  }

  #count(): void {
    const rows = this.rows
    this.allOpen = rows.length > 0 && rows.every((row) => row.open)
  }

  readonly #onToggle = (event: Event): void => {
    const row = event.target
    if (this.#own || !this.exclusive || (event as CustomEvent<boolean>).detail !== true) return
    if (!(row instanceof LintjeExpander) || row.parentElement !== this) return
    this.#set(
      this.rows.filter((other) => other !== row),
      false,
    )
  }

  /** Opens or closes rows for the reader; each changed row tells it, as if it was pressed. */
  #set(rows: LintjeExpander[], open: boolean): void {
    this.#own = true
    for (const row of rows) {
      if (row.open === open) continue
      row.open = open
      row.dispatchEvent(
        new CustomEvent('lintje-toggle', { detail: open, bubbles: true, composed: true }),
      )
    }
    this.#own = false
  }

  protected override render(): TemplateResult {
    const link = this.toggleAll && !this.exclusive
    return html`${
      link
        ? html`<div class="lintje-accordion__bar">
            <lintje-button variant="link" @click=${() => this.#set(this.rows, !this.allOpen)}
              >${this.allOpen ? 'Alles sluiten' : 'Alles openen'}</lintje-button
            >
          </div>`
        : nothing
    }
      <div class="lintje-accordion__rows"><slot @slotchange=${() => this.#sync()}></slot></div>`
  }
}

define('lintje-accordion', LintjeAccordion)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-accordion': LintjeAccordion
  }
}
