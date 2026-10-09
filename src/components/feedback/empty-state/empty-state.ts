/**
 * `<lintje-empty-state>` — the empty state on its own, outside a tile.
 *
 * Not an error: a failure is the tile's error state or an inline alert. It brings no action or
 * words of its own; the host chooses them and slots the action. `compact` is one muted line
 * with a link button after it. `status` puts it in a `role="status"` for when it appears after
 * an action: drawn empty first and filled on the next frame, since a region that arrives with
 * its words is not announced.
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
import { iconStyles, renderIcon } from '../../../icons/render'
import emptyStateCss from './empty-state.css?inline'

export type HeadingLevel = 2 | 3 | 4 | 5 | 6

export class LintjeEmptyState extends LintjeElement {
  static override styles = [iconStyles, shadowCss(emptyStateCss)]

  static override properties: PropertyDeclarations = {
    heading: { type: String },
    text: { type: String },
    icon: { type: String },
    compact: { type: Boolean, reflect: true },
    level: { type: Number },
    status: { type: Boolean },
    slotted: { state: true },
    filled: { state: true },
  }

  /** Not drawn when `compact`. */
  declare heading?: string
  /** The one sentence below the heading, or the whole line when `compact`. */
  declare text?: string
  /** An icon file name. Not drawn when `compact`. */
  declare icon?: string
  compact: boolean = false
  level: HeadingLevel = 3
  /** Announces the state: it appeared after an action. */
  status: boolean = false
  // An empty action wrapper would still add its margin.
  slotted: boolean = false
  protected filled: boolean = false

  #fillFrame = 0

  override disconnectedCallback(): void {
    if (this.#fillFrame) cancelAnimationFrame(this.#fillFrame)
    this.#fillFrame = 0
    super.disconnectedCallback()
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    if (!this.status || this.filled || this.#fillFrame) return
    this.#fillFrame = requestAnimationFrame(() => {
      this.#fillFrame = 0
      this.filled = true
    })
  }

  private onSlotChange(event: Event): void {
    const nodes = (event.target as HTMLSlotElement).assignedNodes({ flatten: true })
    this.slotted = nodes.some(
      (node) => node.nodeType !== Node.TEXT_NODE || (node.textContent ?? '').trim() !== '',
    )
  }

  private renderHeading(): TemplateResult | typeof nothing {
    if (!this.heading) return nothing
    const text = this.heading
    switch (this.level) {
      case 2:
        return html`<h2 class="lintje-empty-state__heading">${text}</h2>`
      case 4:
        return html`<h4 class="lintje-empty-state__heading">${text}</h4>`
      case 5:
        return html`<h5 class="lintje-empty-state__heading">${text}</h5>`
      case 6:
        return html`<h6 class="lintje-empty-state__heading">${text}</h6>`
      default:
        return html`<h3 class="lintje-empty-state__heading">${text}</h3>`
    }
  }

  protected override render(): TemplateResult {
    const role = this.status ? 'status' : nothing
    // The same region either way: only what is inside it waits for `filled`.
    const empty = this.status && !this.filled
    if (this.compact) {
      return html`<div class="lintje-empty-state lintje-empty-state--compact" role=${role}>
        ${empty ? nothing : html`${this.text ?? nothing} <slot></slot>`}
      </div>`
    }
    return html`<div class="lintje-empty-state" role=${role}>${empty ? nothing : this.content()}</div>`
  }

  private content(): TemplateResult {
    return html`${
      this.icon
        ? renderIcon(this.icon, { size: 40, className: 'lintje-empty-state__icon' })
        : nothing
    }
      ${this.renderHeading()}
      ${this.text ? html`<p class="lintje-empty-state__text">${this.text}</p>` : nothing}
      <div class="lintje-empty-state__action" ?hidden=${!this.slotted}>
        <slot @slotchange=${this.onSlotChange}></slot>
      </div>`
  }
}

define('lintje-empty-state', LintjeEmptyState)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-empty-state': LintjeEmptyState
  }
}
