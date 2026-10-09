/**
 * `<lintje-level-meter>` — how loud the sound comes in, as bars with a word beside them: before a
 * recording to show the microphone works, during it to show it still does. The host measures and
 * sets `level` as often as it likes; the bars follow, without motion under reduced motion.
 *
 * `null` is not measured yet: flat bars and a dash, never "Stil" (rule 15).
 *
 * Events: none.
 */
import { html, type PropertyDeclarations, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { LintjeElement, define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { styleProps } from '../../../core/style-props'
import levelMeterCss from './level-meter.css?inline'

/** The bars as parts of the loudest: a fixed shape the level scales, so it reads as a voice. */
const SHAPE = [0.4, 0.8, 0.55, 1, 0.45, 0.7, 0.9, 0.5, 0.75, 0.35]

/** The level's word: silence and a soft voice are worth saying, everything above is fine. */
export function levelWord(level: number): string {
  if (level < 0.05) return 'Stil'
  if (level < 0.2) return 'Zacht'
  return 'Goed'
}

export class LintjeLevelMeter extends LintjeElement {
  static override styles = shadowCss(levelMeterCss)

  static override properties: PropertyDeclarations = {
    level: { type: Number },
    words: { type: Boolean, reflect: true },
  }

  /** The sound coming in, 0 to 1; `null` before it is measured. */
  declare level?: number | null
  /** Draw the word beside the bars; without, the host says it (it is still the bars' name). */
  words: boolean = true

  protected override render(): TemplateResult {
    const level = this.level == null ? null : Math.min(1, Math.max(0, this.level))
    const word = level === null ? 'Nog niet gemeten' : levelWord(level)
    const quiet = level === null || level < 0.05
    return html`<span
      class=${classMap({ 'lintje-level-meter': true, 'is-quiet': quiet })}
      role="img"
      aria-label=${`Geluid: ${word.toLowerCase()}`}
    >
      <span class="lintje-level-meter__bars" aria-hidden="true">
        ${SHAPE.map(
          (part) =>
            html`<span
              class="lintje-level-meter__bar"
              ${styleProps({ height: `${quiet ? 12 : Math.max(12, Math.round(part * level! * 100))}%` })}
            ></span>`,
        )}
      </span>
      ${
        this.words
          ? html`<span class="lintje-level-meter__word" aria-hidden="true"
            >${level === null ? '—' : word}</span
          >`
          : ''
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
