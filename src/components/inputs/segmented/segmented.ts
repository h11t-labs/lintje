/**
 * `<lintje-segmented>` — one row of options, the chosen one marked; a row wider than its room
 * stands as a column.
 *
 * In a filter bar it is `hide-label` and nameless: the bar decides what to commit.
 *
 * Events: `lintje-change` `string`, `lintje-values-change` `{ [name]: value }` (with a `name`),
 * `lintje-reset` (the reset link was pressed).
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
import '../../feedback/badge/badge'
import { FrameResizeObserver } from '../../shared/frame-resize-observer'
import { LintjeInputElement } from '../shared/input'
import { LiveMessage } from '../../shared/live-message'
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
  }

  value: string = ''
  /** Bold the chosen option, as a modified filter does. */
  bold: boolean = false
  stacked: boolean = false
  declare options?: FilterOption[]
  /** The options stand in a column: `is-column` on the frame, set by the measurement. */
  #column: boolean = false
  /** The row's own width, measured while it is a row: the column turns back once that fits. */
  #rowWidth = 0
  #observer = new FrameResizeObserver(() => this.#fit())
  readonly #live = new LiveMessage(this)

  override connectedCallback(): void {
    super.connectedCallback()
    this.#observer.observe(this)
  }

  override disconnectedCallback(): void {
    this.#observer.disconnect()
    super.disconnectedCallback()
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    // Other options make another row: it is measured again as a row.
    if (changed.has('options')) this.#setColumn(false)
    this.#fit()
  }

  // The frame is clamped to its room (the host, or a settings row's control cell), so the
  // room is its own width and the row's width is what it holds. WebKit rounds `scrollWidth`
  // up where it rounds `clientWidth` off, so zoomed, a row that fits measures a pixel wider
  // than its frame; without the pixel of slack it turns column, fits, turns row, and so on
  // without end, until Safari kills the page.
  #fit(): void {
    const frame = this.renderRoot.querySelector<HTMLElement>('.lintje-segmented')
    if (!frame || !frame.clientWidth) return
    if (!this.#column) this.#rowWidth = frame.scrollWidth
    this.#setColumn(this.#rowWidth > frame.clientWidth + 1)
  }

  // Straight onto the frame: a reactive property set after a render would draw it twice.
  #setColumn(column: boolean): void {
    this.#column = column
    this.renderRoot.querySelector('.lintje-segmented')?.classList.toggle('is-column', column)
  }

  // The description changes under the options, away from the focus: a reader's own choice says
  // it, a value the host sets does not.
  private choose(value: string): void {
    this.value = value
    this.commit(value)
    const description = this.options?.find((option) => option.value === value)?.description
    if (description) this.#live.say(description)
    else this.#live.clear()
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
      ${this.renderMessages()}
      <div
        class=${classMap({
          'lintje-segmented': true,
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
            ?disabled=${this.isDisabled}
            @click=${() => this.choose(option.value)}
          >
            ${option.label}${
              typeof option.count === 'number'
                ? html`<lintje-badge variant="count">${option.count}</lintje-badge>`
                : nothing
            }
          </button>`,
        )}
      </div>
      ${
        description
          ? html`<p class="lintje-segmented__description" id=${DESCRIPTION_ID}>${description}</p>`
          : nothing
      }
      ${this.renderFoot()}
      <span class="visually-hidden" role="status">${this.#live.text}</span>
    </div>`
  }
}

define('lintje-segmented', LintjeSegmented)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-segmented': LintjeSegmented
  }
}
