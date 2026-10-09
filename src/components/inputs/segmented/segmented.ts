/**
 * `<lintje-segmented>` — one row of options, the chosen one marked. A row wider than its room
 * stands as a column instead, each option a row of its own.
 * In a filter bar it is `hide-label` and nameless; the bar decides what to commit.
 *
 * Events: `lintje-change`; with a `name` also the composed `lintje-values-change`.
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { LintjeInputElement } from '../shared/input'
import inputCss from '../shared/input.css?inline'
import segmentedCss from './segmented.css?inline'
import type { FilterOption } from '../../../types'

/** The chosen option's `description`, in a box under the options: what that choice does. */
const DESCRIPTION_ID = 'lintje-segmented-description'

export class LintjeSegmented extends LintjeInputElement {
  static override styles = [shadowCss(segmentedCss), shadowCss(inputCss)]

  static override properties: PropertyDeclarations = {
    value: { type: String },
    bold: { type: Boolean },
    stacked: { type: Boolean, reflect: true },
    options: { attribute: false },
    column: { state: true },
  }

  value: string = ''
  /** Bold the chosen option, as a modified filter does. */
  bold: boolean = false
  stacked: boolean = false
  declare options?: FilterOption[]
  protected column: boolean = false
  /** The row's own width, measured while it is a row: the column turns back once that fits. */
  #rowWidth = 0
  #observer: ResizeObserver | null = null

  override connectedCallback(): void {
    super.connectedCallback()
    if (typeof ResizeObserver === 'undefined') return
    this.#observer = new ResizeObserver(() => this.#fit())
    this.#observer.observe(this)
  }

  override disconnectedCallback(): void {
    this.#observer?.disconnect()
    this.#observer = null
    super.disconnectedCallback()
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    // Other options make another row: it is measured again as a row.
    if (changed.has('options')) this.column = false
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    this.#fit()
  }

  // The frame is clamped to its room (the host, or a settings row's control cell), so the
  // room is its own width and the row's width is what it holds.
  #fit(): void {
    const frame = this.renderRoot.querySelector<HTMLElement>('.lintje-segmented')
    if (!frame || !frame.clientWidth) return
    if (!this.column) this.#rowWidth = frame.scrollWidth
    const column = this.#rowWidth > frame.clientWidth
    if (column !== this.column) this.column = column
  }

  private choose(value: string): void {
    this.value = value
    this.commit(value)
  }

  protected override render(): TemplateResult {
    const chosen = (this.options ?? []).find((option) => option.value === this.value)
    const description = chosen?.description
    const describedBy = [
      description ? DESCRIPTION_ID : '',
      this.describedBy === nothing ? '' : this.describedBy,
    ]
      .filter(Boolean)
      .join(' ')
    return html`<div class="lintje-field">
      ${this.renderLabel()}
      <div
        class=${classMap({
          'lintje-segmented': true,
          'is-column': this.column,
          'is-error': Boolean(this.error),
        })}
        role="group"
        aria-labelledby=${this.labelId}
        aria-describedby=${describedBy || nothing}
        aria-invalid=${this.error ? 'true' : nothing}
      >
        ${(this.options ?? []).map(
          (option) => html`<button
            type="button"
            class=${classMap({
              'lintje-segmented__option': true,
              'is-active': option.value === this.value,
              'is-bold': this.bold && option.value === this.value,
            })}
            aria-pressed=${option.value === this.value}
            ?disabled=${this.disabled}
            @click=${() => this.choose(option.value)}
          >
            ${option.label}
          </button>`,
        )}
      </div>
      ${
        description
          ? html`<p class="lintje-segmented__description" id=${DESCRIPTION_ID}>${description}</p>`
          : nothing
      }
      ${this.renderFoot()}
    </div>`
  }
}

define('lintje-segmented', LintjeSegmented)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-segmented': LintjeSegmented
  }
}
