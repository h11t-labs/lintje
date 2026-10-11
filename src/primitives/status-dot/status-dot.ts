/**
 * `<lintje-status-dot>` — a status with its word; colour is never the only carrier (rule 13).
 * Events: none.
 */
import { html, type TemplateResult } from 'lit'
import { styleProps } from '../../core/style-props'
import { LintjeElement, define } from '../../core/element'
import { shadowCss } from '../../core/styles'
import statusDotCss from './status-dot.css?inline'

import { TONE_WORD, type Tone } from '../shared/tone'

/** A source's delivery status: the element's own words, each a tone. */
export type StatusTone = 'complete' | 'delayed' | 'outage' | 'no-data'

const STATUS_TONE: Record<StatusTone, Tone> = {
  complete: 'success',
  delayed: 'warning',
  outage: 'error',
  'no-data': 'neutral',
}

export const STATUS_LABEL: Record<StatusTone, string> = {
  complete: 'compleet',
  delayed: 'vertraagd',
  outage: 'storing',
  'no-data': 'geen data',
}

export class LintjeStatusDot extends LintjeElement {
  static override styles = shadowCss(statusDotCss)

  static override properties = {
    tone: { type: String, reflect: true },
    label: { type: String },
    size: { type: Number },
  }

  tone: Tone | StatusTone = 'complete'
  /** Overrides the Dutch word for the tone. */
  declare label?: string
  size: number = 10

  protected override render(): TemplateResult {
    const delivery = Object.hasOwn(STATUS_TONE, this.tone) ? (this.tone as StatusTone) : undefined
    const tone = delivery ? STATUS_TONE[delivery] : (this.tone as Tone)
    const word = delivery ? STATUS_LABEL[delivery] : TONE_WORD[tone]
    return html`<span class="lintje-status">
      <span
        class="lintje-status__dot lintje-status__dot--${tone}"
        ${styleProps({ width: `${this.size}px`, height: `${this.size}px` })}
      ></span>
      <span>${this.label ?? word}</span>
    </span>`
  }
}

define('lintje-status-dot', LintjeStatusDot)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-status-dot': LintjeStatusDot
  }
}
