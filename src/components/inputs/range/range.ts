/**
 * `<lintje-range>` — one track, one or two handles, over labeled steps.
 *
 * Two handles: `from` and `to` are indexes into `steps`, and a change is `[from, to]`. With
 * `single`, `value` is the step itself, not its index, and a change is that step. A drag commits
 * when the pointer is let go (`draft`/`draftPair` show it meanwhile); a key press commits at once.
 * With two handles only the thumbs take the pointer, so a press on the track moves the nearer
 * handle there; on stacked handles the side of the press decides.
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
import { styleProps } from '../../../core/style-props'
import { define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { LintjeInputElement } from '../shared/input'
import { planTicks } from './range-ticks'
import inputCss from '../shared/input.css?inline'
import rangeCss from './range.css?inline'

/** One character of `--text-axis` (~6.5 px), rounded up. */
const AXIS_CHARACTER = 7

const pageStep = (count: number): number => Math.max(1, Math.round((count - 1) / 10))

export class LintjeRange extends LintjeInputElement {
  static override styles = [shadowCss(inputCss), shadowCss(rangeCss)]

  static override properties: PropertyDeclarations = {
    from: { type: Number },
    to: { type: Number },
    value: { type: Number },
    single: { type: Boolean, reflect: true },
    unit: { type: String },
    stacked: { type: Boolean, reflect: true },
    steps: { attribute: false },
    draft: { state: true },
    draftPair: { state: true },
    trackWidth: { state: true },
  }

  from: number = 0
  to: number = 0
  /** `single`: the chosen STEP, not its index; `null` before there is one. */
  value: number | string | null = null
  /** One handle instead of two. */
  single: boolean = false
  /** The unit behind the value, e.g. "min". */
  declare unit?: string
  stacked: boolean = false
  declare steps?: (number | string)[]
  draft: number | null = null
  draftPair: [number, number] | null = null
  trackWidth: number = 0

  private observer?: ResizeObserver

  override connectedCallback(): void {
    super.connectedCallback()
    if (typeof ResizeObserver === 'undefined') return
    this.observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0
      if (Math.round(width) !== Math.round(this.trackWidth)) this.trackWidth = width
    })
    this.observer.observe(this)
  }

  override disconnectedCallback(): void {
    this.observer?.disconnect()
    this.observer = undefined
    super.disconnectedCallback()
  }

  // A value from outside ends the drag's draft.
  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (changed.has('value')) this.draft = null
    if (changed.has('from') || changed.has('to')) this.draftPair = null
  }

  // Fallback for when the observer never fires: an element hidden when connected (the filter
  // sheet's controls) does not always get an entry when it appears.
  protected override updated(): void {
    const width = this.offsetWidth
    if (width && Math.round(width) !== Math.round(this.trackWidth)) this.trackWidth = width
  }

  private get lastIndex(): number {
    return (this.steps?.length ?? 0) - 1
  }

  private get index(): number {
    if (this.draft !== null) return this.draft
    const found = (this.steps ?? []).findIndex((step) => step === this.value)
    return found < 0 ? 0 : found
  }

  private get pair(): [number, number] {
    return this.draftPair ?? [this.from, this.to]
  }

  // The handle stops at the other one: the native input is put back where it may stand.
  private moveHandle(handle: 'from' | 'to', event: Event): [number, number] {
    const input = event.target as HTMLInputElement
    const [from, to] = this.pair
    const index = Number(input.value)
    const next: [number, number] =
      handle === 'from' ? [Math.min(index, to), to] : [from, Math.max(index, from)]
    input.value = String(handle === 'from' ? next[0] : next[1])
    this.draftPair = next
    return next
  }

  private commitRange(from: number, to: number): void {
    this.announce([from, to])
  }

  private commitStep(index: number): void {
    const step = (this.steps ?? [])[index]
    if (step === undefined) return
    this.draft = index
    this.commit(typeof step === 'string' ? step : Number(step))
  }

  private clamp(index: number): number {
    return Math.min(this.lastIndex, Math.max(0, index))
  }

  // Arrows move one step, PageUp/PageDown a tenth of the scale, Home/End the ends.
  private key(event: KeyboardEvent): void {
    if (this.disabled) return
    const page = pageStep(this.steps?.length ?? 0)
    const move: Partial<Record<string, number>> = {
      ArrowRight: 1,
      ArrowUp: 1,
      ArrowLeft: -1,
      ArrowDown: -1,
      PageUp: page,
      PageDown: -page,
    }
    let next: number | undefined
    if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = this.lastIndex
    else if (move[event.key] !== undefined)
      next = this.clamp(this.index + (move[event.key] as number))
    if (next === undefined) return
    event.preventDefault()
    if (next !== this.index) this.commitStep(next)
  }

  private percent(index: number): number {
    return this.lastIndex > 0 ? (index / this.lastIndex) * 100 : 0
  }

  private get valueText(): string {
    const steps = this.steps ?? []
    if (!this.single) return `${steps[this.pair[0]] ?? ''} – ${steps[this.pair[1]] ?? ''}`
    return this.stepText(this.index)
  }

  /** A step as a screen reader hears it: the step itself and the unit, not its index. */
  private stepText(index: number): string {
    const step = (this.steps ?? [])[index]
    return step === undefined ? '' : `${step}${this.unit ? ` ${this.unit}` : ''}`
  }

  private onTrackPress(event: PointerEvent): void {
    if (this.single || this.disabled || event.target instanceof HTMLInputElement) return
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect()
    if (!box.width || this.lastIndex < 1) return
    const ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width))
    const index = Math.round(ratio * this.lastIndex)
    const [from, to] = this.pair
    const lower = index <= from || (index < to && index - from <= to - index)
    const next: [number, number] = lower ? [index, to] : [from, index]
    event.preventDefault()
    const inputs = this.renderRoot.querySelectorAll<HTMLInputElement>('.lintje-range__input')
    inputs[lower ? 0 : 1]?.focus()
    if (next[0] === from && next[1] === to) return
    this.draftPair = next
    this.commitRange(...next)
  }

  private handles(): TemplateResult {
    const last = this.lastIndex
    if (this.single) {
      return html`<input
        type="range"
        class="lintje-range__input"
        role="slider"
        min="0"
        max=${last}
        .value=${String(this.index)}
        ?disabled=${this.disabled}
        aria-labelledby=${this.labelId}
        aria-describedby=${this.describedBy}
        aria-valuemin=${(this.steps ?? [])[0] ?? 0}
        aria-valuemax=${(this.steps ?? [])[last] ?? 0}
        aria-valuenow=${(this.steps ?? [])[this.index] ?? 0}
        aria-valuetext=${this.valueText}
        aria-invalid=${this.error ? 'true' : nothing}
        @keydown=${this.key}
        @input=${(event: Event) => {
          this.draft = Number((event.target as HTMLInputElement).value)
        }}
        @change=${(event: Event) => this.commitStep(Number((event.target as HTMLInputElement).value))}
      />`
    }
    const [from, to] = this.pair
    // Stacked at the end, the upper handle could not move: the lower one comes on top.
    const raised = from === to && to === last
    return html`<input
        type="range"
        class=${classMap({ 'lintje-range__input': true, 'is-raised': raised })}
        min="0"
        max=${last}
        .value=${String(from)}
        ?disabled=${this.disabled}
        aria-label="${this.label} van${this.labelSuffixText}"
        aria-valuetext=${this.stepText(from)}
        aria-describedby=${this.describedBy}
        aria-invalid=${this.error ? 'true' : nothing}
        @input=${(event: Event) => this.moveHandle('from', event)}
        @change=${(event: Event) => this.commitRange(...this.moveHandle('from', event))}
      />
      <input
        type="range"
        class="lintje-range__input"
        min="0"
        max=${last}
        .value=${String(to)}
        ?disabled=${this.disabled}
        aria-label="${this.label} tot en met${this.labelSuffixText}"
        aria-valuetext=${this.stepText(to)}
        aria-describedby=${this.describedBy}
        aria-invalid=${this.error ? 'true' : nothing}
        @input=${(event: Event) => this.moveHandle('to', event)}
        @change=${(event: Event) => this.commitRange(...this.moveHandle('to', event))}
      />`
  }

  protected override render(): TemplateResult {
    const steps = this.steps ?? []
    const lastKnown = this.lastIndex
    const widest = steps.reduce<number>((most, step) => Math.max(most, String(step).length), 1)
    const scale = planTicks({
      count: steps.length,
      width: this.trackWidth,
      labelWidth: widest * AXIS_CHARACTER,
    })
    const labelled = new Set(scale.labels)
    const place = (index: number) =>
      index === 0
        ? { left: '0', right: null, transform: 'none' }
        : index === lastKnown
          ? { left: null, right: '0', transform: 'none' }
          : { left: `${this.percent(index)}%`, right: null, transform: 'translateX(-50%)' }
    const low = this.single ? 0 : this.pair[0]
    const high = this.single ? this.index : this.pair[1]
    return html`<div class="lintje-field">
      ${this.renderLabel(undefined, html`<span class="lintje-field__value">${this.valueText}</span>`)}
      ${
        this.hideLabel ? html`<span class="lintje-range__values">${this.valueText}</span>` : nothing
      }
      <div
        class=${classMap({ 'lintje-range': true, 'is-error': Boolean(this.error) })}
        @pointerdown=${this.onTrackPress}
      >
        <span class="lintje-range__track"></span>
        <span
          class="lintje-range__fill"
          ${styleProps({
            left: `${this.percent(low)}%`,
            right: `${100 - this.percent(high)}%`,
          })}
        ></span>
        ${this.handles()}
      </div>
      <div class="lintje-range__scale" aria-hidden="true">
        ${scale.marks.map(
          (index) => html`<span
            class=${classMap({
              'lintje-range__mark': true,
              'is-labelled': labelled.has(index),
            })}
            ${styleProps({ left: `${this.percent(index)}%` })}
          ></span>`,
        )}
        ${scale.labels.map(
          (index) => html`<span
            class=${classMap({
              'lintje-range__step': true,
              'is-active': this.single ? index === this.index : index >= low && index <= high,
            })}
            ${styleProps(place(index))}
            >${steps[index]}</span
          >`,
        )}
      </div>
      ${this.renderFoot()}
    </div>`
  }
}

define('lintje-range', LintjeRange)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-range': LintjeRange
  }
}
