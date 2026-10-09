/**
 * `<lintje-multiselect>` — several values in one field: chips in the field, a search and a
 * checkbox list in the popover.
 *
 * Rows are `<lintje-checkbox>` without a `name`, so no filter change escapes the popover. The
 * popover is a dialog, not a listbox: it holds a search field and buttons besides the rows. It is
 * fixed to the viewport and anchored to the field: an absolute one is cut off by the scrolling
 * filter bar and sheet around it. Escape closes only the popover (`ownsEscape`) and gives the
 * focus back to the field; so does Tab out of the element, without taking the focus back.
 *
 * Events: `lintje-change`; with a `name` also `lintje-values-change` (`shared/input.ts`).
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { styleProps, type StyleProps } from '../../../core/style-props'
import { define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import { LintjeInputElement } from '../shared/input'
import { ownsEscape } from '../../shared/focus-trap'
import { holdsFocus, standsIn } from '../../../core/focus'
import '../checkbox/checkbox'
import inputCss from '../shared/input.css?inline'
import multiselectCss from './multiselect.css?inline'
import type { FilterOption } from '../../../types'

/** Where the popover stands, in viewport pixels; `bottom` is set when it flips above. */
interface PopoverAnchor {
  top: number | null
  bottom: number | null
  left: number
  width: number
  /** The popover's `max-height`. */
  space: number
}

const GAP = 4
const EDGE = 8
/** Below this much room the popover flips above the field. */
const MIN_WIDTH = 260
const MIN_SPACE = 180
const VALUE_ID = 'lintje-multiselect-value'
const SHOWN_ID = 'lintje-multiselect-shown'

/** Through the CSSOM: `style-src 'self'` drops a `style` attribute (`core/style-props.ts`). */
function anchorStyle(anchor: PopoverAnchor | null): StyleProps {
  if (!anchor) return {}
  return {
    top: anchor.top === null ? null : `${anchor.top}px`,
    bottom: anchor.bottom === null ? null : `${anchor.bottom}px`,
    left: `${anchor.left}px`,
    width: `${anchor.width}px`,
    '--lintje-multiselect-space': `${anchor.space}px`,
  }
}

function optionLabel(option: FilterOption): string {
  return option.label ?? String(option.value)
}

const resultsText = (count: number): string => (count === 1 ? '1 resultaat' : `${count} resultaten`)

export class LintjeMultiselect extends LintjeInputElement {
  static override styles = [iconStyles, shadowCss(inputCss), shadowCss(multiselectCss)]

  static override properties: PropertyDeclarations = {
    placeholder: { type: String },
    summary: { type: String },
    stacked: { type: Boolean, reflect: true },
    open: { type: Boolean, reflect: true },
    options: { attribute: false },
    selected: { attribute: false },
    query: { state: true },
    anchor: { state: true },
    news: { state: true },
  }

  placeholder: string = 'Kies één of meer…'
  /** One line instead of the chips ("Bronnen: 2 van 4"), where there is no room for them. */
  declare summary?: string
  stacked: boolean = false
  open: boolean = false
  declare options?: FilterOption[]
  declare selected?: string[]
  query: string = ''
  protected anchor: PopoverAnchor | null = null
  /** What the status region says: the result count of a search, the count after a choice. */
  protected news: string = ''

  private reflowFrame: number = 0

  private readonly onOutsideClick = (event: MouseEvent): void => {
    if (!this.open) return
    if (!event.composedPath().includes(this)) this.open = false
  }

  private readonly onEscape = (event: KeyboardEvent): void => {
    if (!this.open || event.key !== 'Escape' || !ownsEscape(this)) return
    event.stopPropagation()
    void this.close()
  }

  private get trigger(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.lintje-multiselect__field')
  }

  /** Closes the popover; the focus it held goes back to the field instead of to the page. */
  private async close(): Promise<void> {
    const popover = this.renderRoot.querySelector('.lintje-multiselect__popover')
    const had = popover !== null && holdsFocus(popover)
    this.open = false
    this.query = ''
    await this.updateComplete
    if (had) this.trigger?.focus()
  }

  // Only a focus that lands elsewhere closes. A press on the popover that takes no focus (its
  // padding, an option's text) blurs to nothing, or to a focusable box around the element, such
  // as the shell's main region: neither is elsewhere. A press outside closes in `onOutsideClick`.
  private onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null
    if (!this.open || !next || this.renderRoot.contains(next) || standsIn(this, next)) return
    this.open = false
    this.query = ''
  }

  // Scroll is captured so a scrolling box around the element counts; one measurement per frame.
  private readonly onReflow = (): void => {
    if (!this.open || this.reflowFrame) return
    this.reflowFrame = requestAnimationFrame(() => {
      this.reflowFrame = 0
      this.measure()
    })
  }

  override connectedCallback(): void {
    super.connectedCallback()
    document.addEventListener('mousedown', this.onOutsideClick)
    document.addEventListener('keydown', this.onEscape, true)
    window.addEventListener('scroll', this.onReflow, { capture: true, passive: true })
    window.addEventListener('resize', this.onReflow)
  }

  override disconnectedCallback(): void {
    document.removeEventListener('mousedown', this.onOutsideClick)
    document.removeEventListener('keydown', this.onEscape, true)
    window.removeEventListener('scroll', this.onReflow, { capture: true })
    window.removeEventListener('resize', this.onReflow)
    if (this.reflowFrame) cancelAnimationFrame(this.reflowFrame)
    this.reflowFrame = 0
    super.disconnectedCallback()
  }

  private measure(): void {
    const field = this.renderRoot.querySelector<HTMLElement>('.lintje-multiselect__field')
    if (!field) return
    const rect = field.getBoundingClientRect()
    const viewHeight = window.innerHeight || document.documentElement.clientHeight
    const viewWidth = window.innerWidth || document.documentElement.clientWidth
    const width = Math.max(rect.width, MIN_WIDTH)
    const below = viewHeight - rect.bottom - GAP - EDGE
    const above = rect.top - GAP - EDGE
    const flip = below < MIN_SPACE && above > below
    const next: PopoverAnchor = {
      top: flip ? null : rect.bottom + GAP,
      bottom: flip ? viewHeight - rect.top + GAP : null,
      left: Math.max(EDGE, Math.min(rect.left, viewWidth - width - EDGE)),
      width,
      space: Math.max(MIN_SPACE, flip ? above : below),
    }
    const current = this.anchor
    if (
      current &&
      current.top === next.top &&
      current.bottom === next.bottom &&
      current.left === next.left &&
      current.width === next.width &&
      current.space === next.space
    )
      return
    this.anchor = next
  }

  // Measured before the popover is drawn, so the first paint is in place; also for `open` set by script.
  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (!changed.has('open')) return
    if (this.open) this.measure()
    else this.anchor = null
    this.news = ''
  }

  // Focus moves to the search field only when the popover opens.
  protected override updated(changed: PropertyValues<this>): void {
    if (!changed.has('open') || !this.open) return
    const input = this.renderRoot.querySelector<HTMLInputElement>(
      '.lintje-multiselect__search-input',
    )
    if (input && this.shadowRoot?.activeElement !== input) input.focus({ preventScroll: true })
  }

  private choose(next: string[]): void {
    this.news = `${next.length} geselecteerd`
    this.announce(next)
  }

  private search(query: string): void {
    this.query = query
    const needle = query.trim().toLowerCase()
    const count = (this.options ?? []).filter((option) =>
      optionLabel(option).toLowerCase().includes(needle),
    ).length
    this.news = !needle ? '' : count ? resultsText(count) : `Geen waarde met “${query}”`
  }

  /** The field's value in words, for its name: the chips alone say only the first two. */
  private valueText(labels: string[]): string {
    return labels.length
      ? `${labels.length} geselecteerd: ${labels.join(', ')}`
      : 'niets geselecteerd'
  }

  private toggleOption(value: string): void {
    const selected = this.selected ?? []
    this.choose(
      selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value],
    )
  }

  private checkbox(
    label: string,
    checked: boolean,
    indeterminate: boolean,
    onChange: (checked: boolean) => void,
    description?: string,
  ): TemplateResult {
    return html`<lintje-checkbox
      class="lintje-multiselect__option"
      label=${label}
      hint=${description ?? nothing}
      ?checked=${checked}
      ?indeterminate=${indeterminate && !checked}
      @lintje-change=${(event: CustomEvent<boolean>) => onChange(event.detail)}
    ></lintje-checkbox>`
  }

  protected override render(): TemplateResult {
    const options = this.options ?? []
    const selected = this.selected ?? []
    const query = this.query.trim().toLowerCase()
    const visible = options.filter((option) => optionLabel(option).toLowerCase().includes(query))
    const allSelected = selected.length === options.length
    const indeterminate = selected.length > 0 && !allSelected

    const chips = selected.slice(0, 2)
    const rest = selected.length - chips.length
    const labels = selected.map((value) => options.find((o) => o.value === value)?.label ?? value)

    return html`<div class="lintje-field lintje-multiselect" @focusout=${this.onFocusOut}>
      ${this.renderLabel()}
      <button
        type="button"
        class=${classMap({
          'lintje-multiselect__field': true,
          'is-error': Boolean(this.error),
        })}
        aria-expanded=${this.open}
        aria-haspopup="dialog"
        aria-labelledby="${this.labelId} ${SHOWN_ID} ${VALUE_ID}"
        aria-describedby=${this.describedBy}
        aria-invalid=${this.error ? 'true' : nothing}
        ?disabled=${this.disabled}
        title=${labels.length ? labels.join(', ') : nothing}
        @click=${() => {
          if (this.open) void this.close()
          else this.open = true
        }}
      >
        <span id=${VALUE_ID} class="visually-hidden">${this.valueText(labels)}</span>
        <!-- What the button shows is part of its name, so a voice command can use it (WCAG 2.5.3). -->
        <span id=${SHOWN_ID} class="lintje-multiselect__shown">        ${
          this.summary
            ? html`<span class="lintje-multiselect__summary">${this.summary}</span>${renderIcon(
                'functioneel-delta-omlaag',
                { size: 16 },
              )}`
            : nothing
        }
        ${
          selected.length === 0 && !this.summary
            ? html`<span class="lintje-multiselect__placeholder">${this.placeholder}</span>`
            : nothing
        }
        ${(this.summary ? [] : chips).map(
          (value) => html`<span class="lintje-multiselect__chip">
            <span class="lintje-multiselect__chip-label"
              >${options.find((option) => option.value === value)?.label}</span
            >
            <!-- Mouse shortcut. No button and no role: chips sit inside the trigger button, and
                 a button inside a button is invalid HTML and not focusable. For keyboard and
                 screen reader users, removing goes through the options panel. -->
            <span
              aria-hidden="true"
              class="lintje-multiselect__chip-remove"
              @click=${(event: Event) => {
                event.stopPropagation()
                this.toggleOption(value)
              }}
              >×</span
            >
          </span>`,
        )}
        ${
          rest > 0 && !this.summary
            ? html`<span class="lintje-multiselect__overflow">+${rest}</span>`
            : nothing
        }</span
        >
      </button>

      ${
        this.open
          ? html`<span
              class="lintje-multiselect__scrim"
              @click=${() => void this.close()}
            ></span>
            <div
              class="lintje-multiselect__popover"
              role="dialog"
              aria-label=${this.label || this.placeholder}
              ${styleProps(anchorStyle(this.anchor))}
            >
              <div class="lintje-multiselect__search">
                <input
                  class="lintje-multiselect__search-input"
                  .value=${this.query}
                  placeholder="Zoek…"
                  aria-label="Zoeken"
                  @input=${(event: Event) => this.search((event.target as HTMLInputElement).value)}
                />
              </div>
              <div class="lintje-multiselect__list">
                ${this.checkbox(
                  `Alles selecteren (${options.length})`,
                  allSelected,
                  indeterminate,
                  (checked) => this.choose(checked ? options.map((option) => option.value) : []),
                )}
                ${visible.map((option) =>
                  this.checkbox(
                    optionLabel(option),
                    selected.includes(option.value),
                    false,
                    () => this.toggleOption(option.value),
                    option.description,
                  ),
                )}
                ${
                  visible.length === 0
                    ? html`<p class="lintje-multiselect__no-results">
                      Geen waarde met “${this.query}”.
                    </p>`
                    : nothing
                }
              </div>
              <div class="lintje-multiselect__footer">
                <button type="button" class="lintje-multiselect__clear" @click=${() => this.choose([])}>
                  Wissen
                </button>
                <span>${selected.length} geselecteerd</span>
              </div>
            </div>`
          : nothing
      }
      <span class="visually-hidden" role="status">${this.news}</span>
      ${this.renderFoot()}
    </div>`
  }
}

define('lintje-multiselect', LintjeMultiselect)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-multiselect': LintjeMultiselect
  }
}
