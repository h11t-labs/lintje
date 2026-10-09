/**
 * `<lintje-chat-suggestions>` — sentences the reader can send with one press.
 *
 * `kind` is a rule, not decoration: `suggestion` (dashed) is something the reader could ask;
 * `choice` (solid) is an answer the assistant is waiting for. In a conversation they stand on the
 * reader's side, on the right; `align="start"` sets them left and side by side, as the examples
 * under a question box on a start page.
 *
 * Events: `lintje-suggestion-select` `{turnId, kind, label, value}` — a trigger;
 * `value` is the item's own, or its label.
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { LintjeElement, define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import chatSuggestionsCss from './chat-suggestions.css?inline'
import type { ChatSuggestion } from '../../../types'

export type ChatSuggestionKind = 'suggestion' | 'choice'
export type ChatSuggestionsAlign = 'end' | 'start'

export class LintjeChatSuggestions extends LintjeElement {
  static override styles = shadowCss(chatSuggestionsCss)

  static override properties: PropertyDeclarations = {
    label: { type: String },
    hint: { type: String },
    kind: { type: String, reflect: true },
    align: { type: String, reflect: true },
    items: { attribute: false },
    turnId: { type: String, attribute: 'turn-id' },
  }

  /** The caps line above the sentences: "Jij, als vervolgvraag". */
  declare label?: string
  /** The gray line under a set of choices. */
  declare hint?: string
  kind: ChatSuggestionKind = 'suggestion'
  /** `start`: left and side by side, outside a conversation. */
  align: ChatSuggestionsAlign = 'end'
  declare items?: ChatSuggestion[]
  /** It comes back in the event. */
  declare turnId?: string

  private select(item: ChatSuggestion): void {
    this.emit('lintje-suggestion-select', {
      turnId: this.turnId ?? null,
      kind: this.kind,
      label: item.label,
      value: item.value ?? item.label,
    })
  }

  protected override render(): TemplateResult | typeof nothing {
    const items = this.items ?? []
    if (!items.length) return nothing
    return html`<div
      class="lintje-chat-suggestions lintje-chat-suggestions--${this.kind} lintje-chat-suggestions--${this.align}"
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
      ${this.hint ? html`<p class="lintje-chat-suggestions__hint">${this.hint}</p>` : nothing}
    </div>`
  }
}

define('lintje-chat-suggestions', LintjeChatSuggestions)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-chat-suggestions': LintjeChatSuggestions
  }
}
