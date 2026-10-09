/**
 * `<lintje-status-dot>` — a status with its word; colour is never the only carrier (rule 13).
 * Events: none.
 */
import { html, type TemplateResult } from 'lit'
import { styleProps } from '../../core/style-props'
import { LintjeElement, define } from '../../core/element'
import { shadowCss } from '../../core/styles'
import statusDotCss from './status-dot.css?inline'

export type StatusTone = 'complete' | 'delayed' | 'outage' | 'no-data'

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

  tone: StatusTone = 'complete'
  /** Overrides the Dutch word for the tone. */
  declare label?: string
  size: number = 10

  protected override render(): TemplateResult {
    return html`<span class="lintje-status">
      <span
        class="lintje-status__dot lintje-status__dot--${this.tone}"
        ${styleProps({ width: `${this.size}px`, height: `${this.size}px` })}
      ></span>
      <span>${this.label ?? STATUS_LABEL[this.tone]}</span>
    </span>`
  }
}

define('lintje-status-dot', LintjeStatusDot)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-status-dot': LintjeStatusDot
  }
}
