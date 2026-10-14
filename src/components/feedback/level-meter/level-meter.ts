/**
 * `<lintje-level-meter>` — a measure as bars with a word beside them: the sound coming in, as
 * a voice shape that follows the level, or any measure in steps (`steps`): a connection, a
 * battery, how complete a source is.
 *
 * The host measures and sets `level` as often as it likes; the bars follow, without motion under
 * reduced motion. In steps the lit ones take the line colour of the `tone`, and the word is
 * the host's (`word`): the sound's own words only fit the sound.
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { LintjeElement, define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { styleProps } from '../../../core/style-props'
import type { Tone } from '../../shared/tone'
import levelMeterCss from './level-meter.css?inline'

/** The bars as parts of the loudest: a fixed shape the level scales, so it reads as a voice. */
const SHAPE = [0.4, 0.8, 0.55, 1, 0.45, 0.7, 0.9, 0.5, 0.75, 0.35]

/** The level's word: silence and a soft voice are worth saying, everything above is fine. */
export function levelWord(level: number): string {
  if (level < 0.05) return 'Stil'
  if (level < 0.2) return 'Zacht'
  return 'Goed'
}

/** How many of `steps` a level lights: half the steps for half the scale. */
export function litSteps(level: number, steps: number): number {
  return Math.round(Math.min(1, Math.max(0, level)) * steps)
}

export class LintjeLevelMeter extends LintjeElement {
  static override styles = shadowCss(levelMeterCss)

  static override properties: PropertyDeclarations = {
    level: { type: Number },
    words: { type: Boolean, reflect: true },
    steps: { type: Number },
    tone: { type: String, reflect: true },
    name: { type: String },
    word: { type: String },
  }

  /** The sound coming in, 0 to 1; `null` before it is measured: flat bars, a dash, never "Stil". */
  declare level?: number | null
  /** Draw the word beside the bars; without, the host says it (it is still the bars' name). */
  words: boolean = true
  /** Rising steps instead of the voice shape, as many as given; the level lights its share. */
  declare steps?: number
  /** The colour of what is lit, in steps: `success`, `warning` or `error`; the accent without. */
  declare tone?: Tone
  /** What the meter measures, for the screen reader ("Verbinding: zwak"). */
  name: string = 'Geluid'
  /** The host's word for the level; in steps there is no word without it. */
  declare word?: string

  private renderBars(level: number | null, quiet: boolean): TemplateResult {
    const steps = this.steps
    if (steps && steps > 0) {
      const lit = level === null ? 0 : litSteps(level, steps)
      return html`<span class="lintje-level-meter__bars lintje-level-meter__bars--steps" aria-hidden="true">
        ${Array.from({ length: steps }, (_, i) => {
          const rise = steps === 1 ? 1 : 0.3 + (0.7 * i) / (steps - 1)
          return html`<span
            class=${classMap({ 'lintje-level-meter__step': true, 'is-lit': i < lit })}
            ${styleProps({ height: `${Math.round(rise * 100)}%` })}
          ></span>`
        })}
      </span>`
    }
    return html`<span class="lintje-level-meter__bars" aria-hidden="true">
      ${SHAPE.map(
        (part) =>
          html`<span
            class="lintje-level-meter__bar"
            ${styleProps({ height: `${quiet ? 12 : Math.max(12, Math.round(part * level! * 100))}%` })}
          ></span>`,
      )}
    </span>`
  }

  protected override render(): TemplateResult {
    const level = this.level == null ? null : Math.min(1, Math.max(0, this.level))
    const steps = this.steps && this.steps > 0 ? this.steps : 0
    const word =
      level === null ? 'Nog niet gemeten' : (this.word ?? (steps ? '' : levelWord(level)))
    const count = steps && level !== null ? `${litSteps(level, steps)} van ${steps}` : ''
    const spoken = [word.toLowerCase(), count].filter(Boolean).join(', ')
    const quiet = level === null || (steps ? litSteps(level, steps) === 0 : level < 0.05)
    return html`<span
      class=${classMap({
        'lintje-level-meter': true,
        'is-quiet': quiet,
        [`is-${this.tone}`]: Boolean(this.tone),
      })}
      role="img"
      aria-label=${`${this.name}: ${spoken}`}
    >
      ${this.renderBars(level, quiet)}
      ${
        this.words && (word || level === null)
          ? html`<span class="lintje-level-meter__word" aria-hidden="true"
            >${level === null ? '—' : word}</span
          >`
          : nothing
      }
    </span>`
  }
}

define('lintje-level-meter', LintjeLevelMeter)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-level-meter': LintjeLevelMeter
  }
}
