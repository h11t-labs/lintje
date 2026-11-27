/**
 * `<lintje-multiselect>` — several values in one field: chips in the field, a search and a
 * checkbox list in the popover.
 *
 * The popover is fixed to the viewport, so a scrolling filter bar or sheet around it does not cut
 * it off. Escape and Tab out of the element close only the popover; a press outside closes it
 * and still reaches what it pressed.
 *
 * Events: `lintje-change` `string[]`, `lintje-values-change` `{ [name]: value }` (with a `name`),
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
import { iconStyles, renderIcon } from '../../../icons/render'
import { LintjeInputElement } from '../shared/input'
import { ownsEscape } from '../../shared/focus-trap'
import { answerEscape, isFreshEscape, isTopLayer, setLayerOpen } from '../../../core/escape'
import { holdsFocus, standsIn } from '../../../core/focus'
import { place, samePlace, stand, viewport, type Place } from '../../shared/place'
import { resultsText } from '../../shared/search-text'
import '../checkbox/checkbox'
import inputCss from '../shared/input.css?inline'
import multiselectCss from './multiselect.css?inline'
import type { FilterOption } from '../../../types'

/** The popover's distance from the field. */
const GAP = 4
const MIN_WIDTH = 260
const VALUE_ID = 'lintje-multiselect-value'
const SHOWN_ID = 'lintje-multiselect-shown'

function optionLabel(option: FilterOption): string {
  return option.label ?? String(option.value)
}

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
  /** What the status region says: the result count of a search, the count after a choice. */
  protected news: string = ''

  private reflowFrame: number = 0
  #spot: Place | null = null
  #width: number | null = null

  // On mousedown, with nothing over the page: the press closes the popover and its click still
  // lands on what the reader pointed at, which keeps the focus.
  private readonly onOutsideClick = (event: MouseEvent): void => {
    if (!this.open || event.composedPath().includes(this)) return
    this.open = false
    this.query = ''
  }

  private readonly onEscape = (event: KeyboardEvent): void => {
    if (!this.open || !isFreshEscape(event) || !ownsEscape(this) || !isTopLayer(this)) return
    answerEscape(event)
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
    if (this.open) setLayerOpen(this, true)
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
    setLayerOpen(this, false)
    super.disconnectedCallback()
  }

  // Placed as if without height, so `place()` flips on its smallest room and the list scrolls
  // within the room there is. Its width is the field's, at least `MIN_WIDTH`.
  private measure(): void {
    const field = this.renderRoot.querySelector<HTMLElement>('.lintje-multiselect__field')
    const popover = this.renderRoot.querySelector<HTMLElement>('.lintje-multiselect__popover')
    if (!field || !popover) return
    const rect = field.getBoundingClientRect()
    const width = Math.max(rect.width, MIN_WIDTH)
    const next = place(rect, { width, height: 0 }, viewport(), 'bottom-start', GAP)
    if (samePlace(this.#spot, next) && width === this.#width) return
    stand(popover, next)
    popover.style.setProperty('width', `${width}px`)
    popover.style.setProperty('--lintje-multiselect-space', `${next.space}px`)
    this.#spot = next
    this.#width = width
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    // A field turned off closes its popover, without giving the focus back to its button.
    if (this.open && this.isDisabled) {
      this.open = false
      this.query = ''
    }
    if (changed.has('open')) this.news = ''
  }

  // Placed after the render, before the paint: the popover exists only while open, so a new
  // one is unplaced. Focus moves to the search field only when the popover opens.
  protected override updated(changed: PropertyValues<this>): void {
    if (!changed.has('open')) return
    setLayerOpen(this, this.open)
    this.#spot = null
    if (!this.open) return
    this.measure()
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

  // Select-all ticks and unticks the options only: a chosen value outside them stays chosen.
  private chooseAll(checked: boolean): void {
    const selected = this.selected ?? []
    const values = (this.options ?? []).map((option) => option.value)
    this.choose(
      checked
        ? [...selected, ...values.filter((value) => !selected.includes(value))]
        : selected.filter((value) => !values.includes(value)),
    )
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
    // Counted over the options: a chosen value outside them ticks nothing.
    const chosen = options.filter((option) => selected.includes(option.value)).length
    const allSelected = options.length > 0 && chosen === options.length
    const indeterminate = chosen > 0 && !allSelected

    const chips = selected.slice(0, 2)
    const rest = selected.length - chips.length
    // A chosen value without its option shows as itself.
    const labels = selected.map((value) => {
      const option = options.find((item) => item.value === value)
      return option ? optionLabel(option) : value
    })

    return html`<div class="lintje-field lintje-multiselect" @focusout=${this.onFocusOut}>
      ${this.renderLabel()}
      ${this.renderMessages()}
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
        ?disabled=${this.isDisabled}
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
          (value, index) => html`<span class="lintje-multiselect__chip">
            <span class="lintje-multiselect__chip-label">${labels[index]}</span>
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
          ? html`<div
              class="lintje-multiselect__popover"
              role="dialog"
              aria-label=${this.label || this.placeholder}
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
                ${
                  options.length
                    ? this.checkbox(
                        `Alles selecteren (${options.length})`,
                        allSelected,
                        indeterminate,
                        (checked) => this.chooseAll(checked),
                      )
                    : nothing
                }
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
                      ${query ? html`Geen waarde met “${this.query}”.` : 'Geen waarden om te kiezen.'}
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
