/**
 * `<lintje-stepper>` — the steps of a form that takes more than one screen, or the phases of a
 * process. A line joins the markers: drawn through up to the current step, dashed after it. A
 * step still to come does nothing: jumping ahead is not possible. The host decides which step is
 * current; the element never reads the URL. A plain click on a done step is sent as
 * `lintje-navigate`, which a host that routes cancels; a modified click is the browser's.
 *
 * Events: `lintje-navigate` `{ href }`.
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
import { MediaController, MOBILE } from '../../../core/media'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import '../../../primitives/progress-bar/progress-bar'
import stepperCss from './stepper.css?inline'
import { isPlainClick } from '../../../core/links'

export type StepState = 'done' | 'current' | 'next'

export interface Step {
  label: string
  href?: string
  state: StepState
  /** How many errors a done step still has; the check becomes a warning with "2 fouten". */
  errors?: number
  /** A short line under the label, in Dutch as the host wrote it: "aug – sept 2023". */
  meta?: string
  /** A sentence or two about the step, shown only when the steps stand in a column. */
  description?: string
}

export type StepperLayout = 'row' | 'column'
export type StepperOrientation = 'horizontal' | 'vertical'

export function errorText(errors: number): string {
  return errors === 1 ? '1 fout' : `${errors} fouten`
}

export function position(steps: Step[]): { place: number; total: number; percent: number } {
  const total = steps.length
  const current = steps.findIndex((step) => step.state === 'current')
  const place = current < 0 ? steps.filter((step) => step.state === 'done').length : current + 1
  return { place, total, percent: total ? Math.round((place / total) * 100) : 0 }
}

/**
 * Row or column. In a column the steps' width cannot be measured, so the width remembered from
 * the last row decides when the row fits again.
 */
export function chooseLayout(
  layout: StepperLayout,
  available: number,
  needed: number,
  remembered: number,
): StepperLayout {
  if (layout === 'row') return needed > available ? 'column' : 'row'
  return remembered > 0 && remembered <= available ? 'row' : 'column'
}

const STATE_TEXT: Record<StepState, string> = {
  done: 'gedaan',
  current: 'huidige stap',
  next: 'nog niet aan de beurt',
}

export class LintjeStepper extends LintjeElement {
  static override styles = [iconStyles, shadowCss(stepperCss)]

  static override properties: PropertyDeclarations = {
    steps: { attribute: false },
    label: { type: String },
    orientation: { type: String },
    layout: { state: true },
  }

  steps: Step[] = []
  label: string = 'Stappen'
  /**
   * `horizontal` lays the steps in a row and stands them up when the row does not fit; on a phone
   * it becomes one line with a bar. `vertical` always stands them in a column, on a phone too.
   */
  orientation: StepperOrientation = 'horizontal'
  protected layout: StepperLayout = 'row'

  #mobile = new MediaController(this, MOBILE)
  #resize: ResizeObserver | null = null
  #rowWidth = 0

  override connectedCallback(): void {
    super.connectedCallback()
    if (typeof ResizeObserver === 'undefined') return
    this.#resize = new ResizeObserver(() => this.fit())
    this.#resize.observe(this)
  }

  override disconnectedCallback(): void {
    this.#resize?.disconnect()
    this.#resize = null
    super.disconnectedCallback()
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (changed.has('orientation')) this.layout = this.vertical ? 'column' : 'row'
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    this.fit()
  }

  private get vertical(): boolean {
    return this.orientation === 'vertical'
  }

  private fit(): void {
    if (this.vertical) return
    const list = this.renderRoot.querySelector<HTMLElement>('.lintje-stepper__list')
    if (!list) return
    // The lines stretch to fill the row: what it needs is its width with each line at its minimum.
    let slack = 0
    for (const line of list.querySelectorAll<HTMLElement>('.lintje-stepper__line')) {
      slack += line.offsetWidth - (parseFloat(getComputedStyle(line).minWidth) || 0)
    }
    const needed = list.scrollWidth - slack
    if (this.layout === 'row') this.#rowWidth = needed
    const next = chooseLayout(this.layout, list.clientWidth, needed, this.#rowWidth)
    if (next !== this.layout) this.layout = next
  }

  private follow(event: MouseEvent, href: string): void {
    if (isPlainClick(event)) this.followLink(href, event)
  }

  private renderMarker(step: Step, index: number): TemplateResult {
    const failed = step.state === 'done' && Boolean(step.errors)
    const classes = classMap({
      'lintje-stepper__marker': true,
      [`lintje-stepper__marker--${step.state}`]: true,
      'is-error': failed,
    })
    let glyph: TemplateResult | typeof nothing | string = String(index + 1)
    if (step.state === 'done') {
      glyph = renderIcon(failed ? 'functioneel-waarschuwing' : 'functioneel-vinkje', { size: 16 })
    }
    return html`<span class=${classes} aria-hidden="true">${glyph}</span>`
  }

  private renderName(step: Step): TemplateResult {
    if (step.state === 'done' && step.href) {
      const href = step.href
      return html`<a
        class="lintje-stepper__name lintje-stepper__name--link"
        href=${href}
        @click=${(event: MouseEvent) => this.follow(event, href)}
        >${step.label}<span class="visually-hidden">, ${STATE_TEXT.done}</span></a
      >`
    }
    return html`<span class="lintje-stepper__name"
      >${step.label}<span class="visually-hidden">, ${STATE_TEXT[step.state]}</span></span
    >`
  }

  /** The line to the next step stands on the label's line, so the meta line may run under it. */
  private renderBody(step: Step, last: boolean): TemplateResult {
    const description = this.layout === 'column' ? step.description : undefined
    return html`<div class="lintje-stepper__body">
      <div class="lintje-stepper__head">
        ${this.renderName(step)}${
          step.state === 'done' && step.errors
            ? html`<span class="lintje-stepper__errors">${errorText(step.errors)}</span>`
            : nothing
        }${last ? nothing : html`<span class="lintje-stepper__line"></span>`}
      </div>
      ${description ? html`<p class="lintje-stepper__description">${description}</p>` : nothing}${
        step.meta ? html`<span class="lintje-stepper__meta">${step.meta}</span>` : nothing
      }
    </div>`
  }

  private renderPhone(): TemplateResult {
    const { place, total, percent } = position(this.steps)
    const current = this.steps[place - 1]
    const text = `Stap ${place} van ${total}`
    return html`<nav class="lintje-stepper lintje-stepper--phone" aria-label=${this.label}>
      <div class="lintje-stepper__summary">
        <strong class="lintje-stepper__current">${current?.label ?? ''}</strong>
        <span class="lintje-stepper__count">${text}</span>
      </div>
      <lintje-progress-bar hide-label label=${text} value=${percent}></lintje-progress-bar>
    </nav>`
  }

  protected override render(): TemplateResult {
    if (this.#mobile.matches && !this.vertical) return this.renderPhone()
    return html`<nav class="lintje-stepper" aria-label=${this.label}>
      <ol class="lintje-stepper__list lintje-stepper__list--${this.layout}">
        ${this.steps.map(
          (step, index) => html`<li
            class=${classMap({
              'lintje-stepper__step': true,
              [`lintje-stepper__step--${step.state}`]: true,
            })}
            aria-current=${step.state === 'current' ? 'step' : nothing}
          >
            ${this.renderMarker(step, index)}${this.renderBody(step, index === this.steps.length - 1)}
          </li>`,
        )}
      </ol>
    </nav>`
  }
}

define('lintje-stepper', LintjeStepper)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-stepper': LintjeStepper
  }
}
