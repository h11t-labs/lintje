/**
 * `<lintje-ai-label>` — says that a model made the content below it.
 *
 * A neutral badge (provenance, not a verdict) and the one badge that may wrap, so a long name
 * stays on a 390 px screen. Place it above the block, once. `checked-by` turns it into
 * "Gecontroleerd door …", and the gear-and-brain mark into a check.
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { LintjeElement, define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import { badgeStyles, renderBadge } from '../../../primitives/badge/badge'
import aiLabelCss from './ai-label.css?inline'

const HINT = 'Controleer de tekst voor je hem gebruikt'

export class LintjeAiLabel extends LintjeElement {
  static override styles = [iconStyles, badgeStyles, shadowCss(aiLabelCss)]

  static override properties: PropertyDeclarations = {
    checkedBy: { type: String, attribute: 'checked-by' },
    hint: { type: String },
  }

  /** Who checked the text: "J. de Vries". */
  declare checkedBy?: string
  /** The line behind the badge; unchecked it defaults to the advice to check the text. */
  declare hint?: string

  protected override render(): TemplateResult {
    const checked = Boolean(this.checkedBy)
    const hint = this.hint ?? (checked ? '' : HINT)
    const words = html`<span class="lintje-ai-label__badge"
      >${renderIcon(checked ? 'functioneel-vinkje' : 'gereedschap-half-tandwiel-half-brein', {
        size: 14,
        className: 'lintje-ai-label__icon',
      })}<span>${checked ? `Gecontroleerd door ${this.checkedBy}` : 'Gemaakt door AI'}</span></span
    >`
    return html`<span class="lintje-ai-label">
      ${renderBadge({ value: words, tone: 'neutral', className: 'lintje-ai-label__box' })}${
        hint ? html`<span class="lintje-ai-label__hint">${hint}</span>` : nothing
      }
    </span>`
  }
}

define('lintje-ai-label', LintjeAiLabel)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-ai-label': LintjeAiLabel
  }
}
