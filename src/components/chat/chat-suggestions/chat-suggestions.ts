/**
 * `<lintje-chat-suggestions>` — sentences the reader can send with one press, on the reader's side,
 * dashed: what the reader could ask. A question the assistant waits on is `lintje-chat-questions`.
 *
 * Events: `lintje-suggestion-select` `{ turnId, label, value }` (`value` is the item's own, or its
 * label).
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { LintjeElement, define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import chatSuggestionsCss from './chat-suggestions.css?inline'
import screenOnlyCss from '../../shared/screen-only.css?inline'
import type { ChatSuggestion } from '../../../types'

export type ChatSuggestionsAlign = 'end' | 'start'

export class LintjeChatSuggestions extends LintjeElement {
  static override styles = [shadowCss(chatSuggestionsCss), shadowCss(screenOnlyCss)]

  static override properties: PropertyDeclarations = {
    label: { type: String },
    align: { type: String, reflect: true },
    items: { attribute: false },
    turnId: { type: String, attribute: 'turn-id' },
  }

  /** The caps line above the sentences: "Jij, als vervolgvraag". */
  declare label?: string
  /** `start`: left and side by side, outside a conversation, as examples under a question box. */
  align: ChatSuggestionsAlign = 'end'
  declare items?: ChatSuggestion[]
  /** It comes back in the event. */
  declare turnId?: string

  private select(item: ChatSuggestion): void {
    this.emit('lintje-suggestion-select', {
      turnId: this.turnId ?? null,
      label: item.label,
      value: item.value ?? item.label,
    })
  }

  protected override render(): TemplateResult | typeof nothing {
    const items = this.items ?? []
    if (!items.length) return nothing
    return html`<div
      class="lintje-chat-suggestions lintje-chat-suggestions--${this.align}"
      role="group"
      aria-labelledby=${this.label ? 'label' : nothing}
      aria-label=${this.label ? nothing : 'Suggesties'}
    >
      ${
        this.label
          ? html`<span id="label" class="lintje-chat-suggestions__label">${this.label}</span>`
          : nothing
      }
      <div class="lintje-chat-suggestions__list">
        ${items.map(
          (item) => html`<button
            type="button"
            class="lintje-chat-suggestions__item"
            @click=${() => this.select(item)}
          >
            ${item.label}
          </button>`,
        )}
      </div>
    </div>`
  }
}

define('lintje-chat-suggestions', LintjeChatSuggestions)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-chat-suggestions': LintjeChatSuggestions
  }
}
