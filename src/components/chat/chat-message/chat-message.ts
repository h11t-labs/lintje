/**
 * `<lintje-chat-message>` — what the reader asked: a filled bar on the right. A visually hidden
 * "Jij:" carries the role.
 *
 * Editing is the message's own state (`lintje-chat-composer variant="edit"`). The message never
 * changes its own text: asking again is an event and the host replaces the turn.
 *
 * Events: `lintje-message-edit` `{turnId, text, terms}` — ask this instead, replacing the answer
 * and everything after it. `lintje-editing-change` `{turnId, editing}` is not composed: it tells
 * the holding view which answers are about to be replaced.
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { LintjeElement, define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import '../../../primitives/icon-button/icon-button'
import '../chat-composer/chat-composer'
import type { LintjeChatComposer } from '../chat-composer/chat-composer'
import { termParts } from '../shared/chat-terms'
import chatMessageCss from './chat-message.css?inline'
import type { ChatSourceData, ChatTermData, ChatTermRange } from '../../../types'

export class LintjeChatMessage extends LintjeElement {
  static override styles = shadowCss(chatMessageCss)

  static override properties: PropertyDeclarations = {
    text: { type: String },
    terms: { attribute: false },
    time: { type: String },
    editable: { type: Boolean },
    editing: { type: Boolean, reflect: true },
    turnId: { type: String, attribute: 'turn-id' },
    vocabulary: { attribute: false },
    sources: { attribute: false },
  }

  text: string = ''
  declare terms?: ChatTermRange[]
  /** When it was sent, as the host formats it ("08:20"). */
  declare time?: string
  editable: boolean = false
  editing: boolean = false
  /** The turn this message opens; it comes back in the events. */
  declare turnId?: string

  declare vocabulary?: ChatTermData[]
  declare sources?: ChatSourceData[]

  private async setEditing(editing: boolean): Promise<void> {
    this.editing = editing
    this.emitLocal('lintje-editing-change', { turnId: this.turnId ?? null, editing })
    await this.updateComplete
    // Focus goes into the frame, and back to the button that opened it.
    const target = this.renderRoot.querySelector<HTMLElement>(
      editing ? 'lintje-chat-composer' : '.lintje-chat-message__edit',
    )
    if (editing) await (target as LintjeChatComposer | null)?.updateComplete
    // The inner `<button>` takes focus, not its host element.
    ;(target?.shadowRoot?.querySelector<HTMLElement>('button') ?? target)?.focus()
  }

  protected override render(): TemplateResult {
    return this.editing ? this.renderEditing() : this.renderSent()
  }

  private renderSent(): TemplateResult {
    // The text comes first in the document and last on the line, so a screen reader reads it first.
    return html`<div class="lintje-chat-message">
      <p class="lintje-chat-message__text">${this.renderText()}</p>
      <div class="lintje-chat-message__meta">
        ${
          this.editable
            ? html`<lintje-icon-button
              class="lintje-chat-message__edit"
              icon="functioneel-bewerken"
              label="Vraag bewerken"
              variant="flat"
              @click=${() => this.setEditing(true)}
            ></lintje-icon-button>`
            : nothing
        }
        ${this.time ? html`<span class="lintje-chat-message__time">${this.time}</span>` : nothing}
      </div>
    </div>`
  }

  // No white space of the template's own: the bar keeps the reader's.
  private renderText(): TemplateResult {
    const parts = termParts(this.text, this.terms).map((part) =>
      part.term
        ? html`<span
            class=${classMap({
              'lintje-chat-message__term': true,
              'is-uncertain': part.term.certain === false,
            })}
            title=${part.term.kind ?? nothing}
            >${part.text}</span
          >`
        : part.text,
    )
    return html`<span class="visually-hidden">Jij: </span>${parts}`
  }

  private renderEditing(): TemplateResult {
    return html`<div class="lintje-chat-message lintje-chat-message--editing">
      <div class="lintje-chat-message__head">
        <span class="lintje-chat-message__label">Jij, bewerken</span>
        ${this.time ? html`<span class="lintje-chat-message__time">${this.time}</span>` : nothing}
      </div>
      <lintje-chat-composer
        class="lintje-chat-message__frame"
        variant="edit"
        text=${this.text}
        .vocabulary=${this.vocabulary}
        .sources=${this.sources}
        @lintje-submit=${(event: CustomEvent<{ text: string; terms: ChatTermRange[] }>) => {
          event.stopPropagation()
          this.emit('lintje-message-edit', { turnId: this.turnId ?? null, ...event.detail })
          void this.setEditing(false)
        }}
        @lintje-cancel=${(event: Event) => {
          event.stopPropagation()
          void this.setEditing(false)
        }}
      ></lintje-chat-composer>
      <p class="lintje-chat-message__note">
        Het antwoord hieronder en alles wat erna kwam worden vervangen.
      </p>
    </div>`
  }
}

define('lintje-chat-message', LintjeChatMessage)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-chat-message': LintjeChatMessage
  }
}
