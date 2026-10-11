/**
 * `<lintje-empty-state>` — the empty state on its own, outside a tile.
 *
 * Not an error: a failure is the tile's error state or an inline alert. It brings no words or
 * action of its own; the host chooses them and slots the action.
 */
import { html, type PropertyDeclarations, type PropertyValues, type TemplateResult } from 'lit'
import { LintjeElement, define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { iconStyles } from '../../../icons/render'
import {
  emptyStateBlockStyles,
  renderEmptyStateBlock,
  type HeadingLevel,
} from '../../../primitives/shared/empty-state-block'
import emptyStateCss from './empty-state.css?inline'

export type { HeadingLevel } from '../../../primitives/shared/empty-state-block'

export class LintjeEmptyState extends LintjeElement {
  static override styles = [iconStyles, shadowCss(emptyStateCss), emptyStateBlockStyles]

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
  /** One muted line, with a link button after it. */
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
    // A region that arrives with its words is not announced: drawn empty, filled on the next frame.
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

  protected override render(): TemplateResult {
    return renderEmptyStateBlock({
      heading: this.heading,
      text: this.text,
      icon: this.icon,
      level: this.level,
      compact: this.compact,
      status: this.status,
      filled: this.filled,
      action: html`<slot @slotchange=${this.onSlotChange}></slot>`,
      actionShown: this.slotted,
    })
  }
}

define('lintje-empty-state', LintjeEmptyState)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-empty-state': LintjeEmptyState
  }
}
