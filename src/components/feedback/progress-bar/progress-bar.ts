/**
 * `<lintje-progress-bar>` — how far a task is; without a `value` a block slides along the track.
 *
 * The default slot takes one action right of the label line. Done, error and paused are said in
 * the value text and marked by a glyph.
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { LintjeElement, define } from '../../../core/element'
import { styleProps } from '../../../core/style-props'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import { TONE_ICON, WORK_STATE_LABEL, WORK_STATE_TONE, type WorkState } from '../../shared/tone'
import progressBarCss from './progress-bar.css?inline'

export type ProgressState = Extract<WorkState, 'busy' | 'done' | 'error' | 'paused'>

export class LintjeProgressBar extends LintjeElement {
  static override styles = [iconStyles, shadowCss(progressBarCss)]

  static override properties: PropertyDeclarations = {
    value: { type: Number },
    label: { type: String },
    hideLabel: { type: Boolean, attribute: 'hide-label' },
    detail: { type: String },
    state: { type: String, reflect: true },
  }

  /** 0–100; left out when the duration is unknown. */
  declare value?: number | null
  /** What is happening, in Dutch: the bar's accessible name. */
  label: string = ''
  /** Keeps the label for screen readers only. */
  hideLabel: boolean = false
  /** The figure on the right: "62% · nog ongeveer 3 min". */
  declare detail?: string
  state: ProgressState = 'busy'

  private get known(): boolean {
    return typeof this.value === 'number' && !Number.isNaN(this.value)
  }

  private get percent(): number {
    return Math.max(0, Math.min(100, this.value ?? 0))
  }

  private get resolvedState(): ProgressState {
    return this.state === 'busy' && this.known && this.percent >= 100 ? 'done' : this.state
  }

  private valueText(mark: { word: string } | undefined): string | undefined {
    const figure = this.detail ?? (mark && this.known ? `${this.percent}%` : undefined)
    return [figure, mark?.word].filter(Boolean).join(', ') || undefined
  }

  protected override render(): TemplateResult {
    const state = this.resolvedState
    const mark =
      state === 'busy'
        ? undefined
        : {
            word: WORK_STATE_LABEL[state].toLowerCase(),
            icon:
              state === 'paused' ? 'multimedia-player-pauze' : TONE_ICON[WORK_STATE_TONE[state]],
          }
    const head = !this.hideLabel && (this.label || this.detail)
    return html`<div class=${classMap({ 'lintje-progress': true, [`lintje-progress--${state}`]: true })}>
      ${
        head
          ? html`<div class="lintje-progress__head">
            <span class="lintje-progress__label"
              >${
                mark
                  ? renderIcon(mark.icon, { size: 16, className: 'lintje-progress__mark' })
                  : nothing
              }${this.label}</span
            >
            <span class="lintje-progress__detail">${this.detail ?? nothing}<slot></slot></span>
          </div>`
          : nothing
      }
      <div
        class=${classMap({ 'lintje-progress__track': true, 'is-indeterminate': !this.known })}
        role="progressbar"
        aria-label=${this.label}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow=${this.known ? this.percent : nothing}
        aria-valuetext=${this.valueText(mark) ?? nothing}
      >
        <div
          class="lintje-progress__fill"
          ${styleProps({ width: this.known ? `${this.percent}%` : null })}
        ></div>
      </div>
    </div>`
  }
}

define('lintje-progress-bar', LintjeProgressBar)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-progress-bar': LintjeProgressBar
  }
}
