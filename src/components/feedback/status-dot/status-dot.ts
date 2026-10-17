/** `<lintje-status-dot>` — a status as a dot with its word; colour is never the only carrier. */
import { html, type CSSResult, type TemplateResult } from 'lit'
import { styleProps } from '../../../core/style-props'
import { LintjeElement, define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import statusDotCss from './status-dot.css?inline'
import statusDotHostCss from './status-dot-host.css?inline'

import { TONE_WORD, type Tone } from '../../shared/tone'

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

export const statusDotStyles: CSSResult = shadowCss(statusDotCss)

export interface StatusDotOptions {
  tone: Tone | StatusTone
  /** Overrides the Dutch word for the tone. */
  label?: string
  /** The dot's diameter in px; default 10. */
  size?: number
  className?: string
}

/** The one drawing of a status dot, also for a root that draws one without the element. */
export function renderStatusDot({
  tone,
  label,
  size = 10,
  className,
}: StatusDotOptions): TemplateResult {
  const delivery = Object.hasOwn(STATUS_TONE, tone) ? (tone as StatusTone) : undefined
  const own = delivery ? STATUS_TONE[delivery] : (tone as Tone)
  const word = delivery ? STATUS_LABEL[delivery] : TONE_WORD[own]
  return html`<span class="lintje-status ${className ?? ''}">
    <span
      class="lintje-status__dot lintje-status__dot--${own}"
      ${styleProps({ width: `${size}px`, height: `${size}px` })}
    ></span>
    <span>${label ?? word}</span>
  </span>`
}

export class LintjeStatusDot extends LintjeElement {
  static override styles = [shadowCss(statusDotHostCss), statusDotStyles]

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
    return renderStatusDot({ tone: this.tone, label: this.label, size: this.size })
  }
}

define('lintje-status-dot', LintjeStatusDot)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-status-dot': LintjeStatusDot
  }
}
