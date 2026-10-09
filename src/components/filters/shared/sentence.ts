/**
 * The "Je ziet" sentence, rendered from parts the filter owner writes.
 * A function, not an element: the zone, sheet and bar style it from outside, which only
 * reaches it inside the same shadow root.
 */
import { html, nothing, type TemplateResult } from 'lit'
import { renderIcon } from '../../../icons/render'

export interface SentencePart {
  text: string
  emphasis: boolean
}

export function filterSentence(parts: SentencePart[], showIcon = true): TemplateResult {
  return html`${
    showIcon
      ? renderIcon('lichaam-oog', { size: 16, className: 'lintje-filter-summary__icon' })
      : nothing
  }<span class="lintje-filter-summary__text"
      >${parts.map((part) =>
        part.emphasis ? html`<b>${part.text}</b>` : html`<span>${part.text}</span>`,
      )}</span
    >`
}

/** The sentence as plain text, for the export footer and the shared link. */
export function sentenceText(parts: SentencePart[]): string {
  return parts.map((part) => part.text).join('')
}
