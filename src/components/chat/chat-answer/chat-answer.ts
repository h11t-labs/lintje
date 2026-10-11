/**
 * `<lintje-chat-answer>` — what the assistant answered, as a list of existing blocks.
 *
 * It draws none of the blocks itself; only the bold lead, strip, actions and follow-ups are its
 * own. A block still to come is that block with `state: 'loading'`. Only the `current` answer
 * can be retried, changed through its strip or followed up. The thumbs and "Gekopieerd" are
 * the element's own state; the conversation is not stored.
 *
 * Events: `lintje-answer-retry` `{turnId}` and `lintje-answer-rate` `{turnId, rating, reason}`
 * (`rating` is `'up'`, `'down'` or `null` when taken back; a `'down'` is followed by a second
 * event once the reader picks a reason). The strip's, the suggestions' and the blocks' events
 * pass through untouched.
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { LintjeElement, define } from '../../../core/element'
import { holdsFocus } from '../../../core/focus'
import { shadowCss } from '../../../core/styles'
import '../../../primitives/button/button'
import '../../../primitives/icon-button/icon-button'
import '../../../primitives/spinner/spinner'
import '../../feedback/announcement/announcement'
import '../../charts/chart/chart'
import '../chat-strip/chat-strip'
import '../chat-suggestions/chat-suggestions'
import '../../tables/data-table/data-table'
import '../../charts/kpi-row/kpi-row'
import '../../content/prose/prose'
import { ANNOUNCE_GAP, COPIED_FOR } from '../../shared/copied'
import { focusTarget } from '../../shared/focus-trap'
import { sentenceEnd } from '../../shared/sentence-end'
import chatAnswerCss from './chat-answer.css?inline'
import type {
  AnnouncementData,
  ChatAnswerState,
  ChatBlock,
  ChatStripData,
  ChatSuggestion,
} from '../../../types'

export type ChatRating = 'up' | 'down'

const REASONS = ['Klopt niet', 'Niet wat ik vroeg', 'Onduidelijk']

const CHOICES: Partial<Record<ChatAnswerState, { label: string; hint: string }>> = {
  'needs-clarification': {
    label: 'Kies je antwoord',
    hint: 'Of typ je eigen antwoord in het veld.',
  },
  'out-of-scope': {
    label: 'Kies wat je wilt doen',
    hint: 'Of stel een andere vraag in het veld.',
  },
}

export class LintjeChatAnswer extends LintjeElement {
  static override styles = shadowCss(chatAnswerCss)

  static override properties: PropertyDeclarations = {
    state: { type: String, reflect: true },
    lead: { type: String },
    text: { type: String },
    blocks: { attribute: false },
    strip: { attribute: false },
    status: { type: String },
    error: { attribute: false },
    choices: { attribute: false },
    followUps: { attribute: false },
    current: { type: Boolean, reflect: true },
    turnId: { type: String, attribute: 'turn-id' },
    rating: { state: true },
    reasonGiven: { state: true },
    note: { state: true },
    spoken: { state: true },
  }

  state: ChatAnswerState = 'ready'
  /** The first sentence, drawn bold. */
  declare lead?: string
  declare text?: string
  declare blocks?: ChatBlock[]
  declare strip?: ChatStripData
  /** `streaming`: the step that is running. */
  declare status?: string
  /** `error`: what went wrong, and the way out in words. */
  declare error?: { title?: string; text: string }
  /** The choices of `out-of-scope` and `needs-clarification`. */
  declare choices?: ChatSuggestion[]
  /** Suggested next questions; drawn on the current answer only. */
  declare followUps?: ChatSuggestion[]
  current: boolean = false
  /** The turn this answers; it comes back in the events. */
  declare turnId?: string

  rating: ChatRating | null = null
  reasonGiven: boolean = false
  note: string = ''
  /** The sentences of a streamed answer, spoken from a status region beside the text. */
  spoken: string[] = []

  /** This answer streamed here, so its text is spoken from `spoken`, not from the log. */
  #streamed = false
  #said = 0
  /** The words `#said` counts in. */
  #heard = ''
  #noteTimer: ReturnType<typeof setTimeout> | undefined
  #noteGap: ReturnType<typeof setTimeout> | undefined

  override disconnectedCallback(): void {
    clearTimeout(this.#noteTimer)
    clearTimeout(this.#noteGap)
    super.disconnectedCallback()
  }

  private get spokenText(): string {
    return [this.lead, this.text].filter(Boolean).join(' ')
  }

  // The log would read every word as it lands; whole sentences go to the status region instead.
  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (!changed.has('state') && !changed.has('lead') && !changed.has('text')) return
    const words = this.spokenText
    // Text replaced in place, not continued, is spoken from its start again.
    const fresh =
      (changed.has('state') && this.state === 'streaming') ||
      !words.startsWith(this.#heard.slice(0, this.#said))
    this.#heard = words
    if (fresh && (this.#streamed || this.state === 'streaming')) {
      this.#streamed = true
      this.#said = 0
      this.spoken = []
    }
    if (!this.#streamed || this.state === 'error') return
    const rest = words.slice(this.#said)
    const end = this.state === 'streaming' ? sentenceEnd(rest) : rest.length
    const sentence = rest.slice(0, end).trim()
    this.#said += end
    if (sentence) this.spoken = [...this.spoken, sentence]
  }

  private get detail(): { turnId: string | null } {
    return { turnId: this.turnId ?? null }
  }

  private get plainText(): string {
    const prose = (this.blocks ?? []).map((block) => (block.kind === 'prose' ? block.text : ''))
    return [[this.lead, this.text].filter(Boolean).join(' '), ...prose].filter(Boolean).join('\n\n')
  }

  /** The same words again are emptied first, so a screen reader hears them again. */
  private say(note: string, clearAfter?: number): void {
    clearTimeout(this.#noteTimer)
    clearTimeout(this.#noteGap)
    if (clearAfter) this.#noteTimer = setTimeout(() => (this.note = ''), clearAfter)
    if (note && note === this.note) {
      this.note = ''
      this.#noteGap = setTimeout(() => (this.note = note), ANNOUNCE_GAP)
    } else this.note = note
  }

  private async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.plainText)
      this.say('Gekopieerd', COPIED_FOR)
    } catch {
      this.say('Kopiëren is niet gelukt')
    }
  }

  private rate(rating: ChatRating): void {
    this.rating = this.rating === rating ? null : rating
    this.reasonGiven = false
    this.say('')
    this.emit('lintje-answer-rate', { ...this.detail, rating: this.rating, reason: null })
  }

  private giveReason(reason: string): void {
    // The reasons leave with the focus on one of them: it goes to the thumb they answer.
    const reasons = this.renderRoot.querySelector('.lintje-chat-answer__reasons')
    const down = this.renderRoot.querySelector<HTMLElement>('[label="Slecht antwoord"]')
    if (reasons && down && holdsFocus(reasons)) focusTarget(down).focus()
    this.reasonGiven = true
    this.say('Bedankt, doorgegeven.')
    this.emit('lintje-answer-rate', { ...this.detail, rating: 'down', reason })
  }

  private retry(): void {
    this.emit('lintje-answer-retry', this.detail)
  }

  protected override render(): TemplateResult {
    const state = this.state
    const finished = state === 'ready'
    const choices = CHOICES[state]
    return html`<article class="lintje-chat-answer">
      <div class="lintje-chat-answer__body">
        ${state === 'error' ? this.renderError() : this.renderText()}
        <div class="visually-hidden" role="status" aria-atomic="false">
          ${this.spoken.map((sentence) => html`<p>${sentence}</p>`)}
        </div>
        ${
          finished && this.strip
            ? html`<lintje-chat-strip
              turn-id=${this.turnId ?? nothing}
              .items=${this.strip.items}
              .details=${this.strip.details}
              details-label=${this.strip.detailsLabel ?? nothing}
              ?disabled=${!this.current}
            ></lintje-chat-strip>`
            : nothing
        }
        ${this.renderBlocks()}
        ${
          state === 'streaming'
            ? html`<lintje-spinner
              class="lintje-chat-answer__status"
              label=${this.status ?? 'Antwoord schrijven'}
            ></lintje-spinner>`
            : nothing
        }
        ${
          state === 'stopped'
            ? html`<p class="lintje-chat-answer__stopped">Antwoord gestopt.</p>`
            : nothing
        }
        ${finished ? this.renderActions() : nothing}
      </div>
      ${
        choices && this.current
          ? html`<lintje-chat-suggestions
            kind="choice"
            turn-id=${this.turnId ?? nothing}
            label=${choices.label}
            hint=${choices.hint}
            .items=${this.choices}
          ></lintje-chat-suggestions>`
          : nothing
      }
      ${
        finished && this.current
          ? html`<lintje-chat-suggestions
            turn-id=${this.turnId ?? nothing}
            label="Jij, als vervolgvraag"
            .items=${this.followUps}
          ></lintje-chat-suggestions>`
          : nothing
      }
    </article>`
  }

  private renderText(): TemplateResult {
    // Off for the log once it streams here; `aria-busy` alone is not heard by every reader.
    return html`<lintje-prose
      class="lintje-chat-answer__text"
      aria-live=${this.#streamed ? 'off' : nothing}
      aria-busy=${this.state === 'streaming' ? 'true' : nothing}
    >
      <p>
        <span class="visually-hidden">Assistent: </span>${
          this.lead
            ? html`<strong class="lintje-chat-answer__lead">${this.lead}</strong> `
            : nothing
        }${this.text ?? nothing}
      </p>
    </lintje-prose>`
  }

  private renderError(): TemplateResult {
    const notice: AnnouncementData = {
      kind: 'warning',
      // The answer failed just now: the announcement is a live region, so it is spoken.
      live: true,
      title: this.error?.title ?? 'Het antwoord is niet geladen',
      text:
        this.error?.text ??
        'Je vraag staat er nog: probeer het opnieuw, of stel een kortere vraag.',
    }
    return html`<span class="visually-hidden">Assistent: </span>
      <lintje-announcement .data=${notice}>
        ${
          this.current
            ? html`<lintje-button
              class="lintje-chat-answer__retry"
              slot="action"
              variant="secondary"
              icon="functioneel-refresh"
              @click=${() => this.retry()}
              >Opnieuw proberen</lintje-button
            >`
            : nothing
        }
      </lintje-announcement>`
  }

  private renderBlocks(): TemplateResult | typeof nothing {
    const blocks = this.blocks ?? []
    if (!blocks.length) return nothing
    return html`<div
      class="lintje-chat-answer__blocks"
      aria-busy=${this.state === 'streaming' ? 'true' : nothing}
    >
      ${blocks.map((block) => {
        switch (block.kind) {
          case 'prose':
            return html`<lintje-prose .html=${block.html} .text=${block.text}></lintje-prose>`
          case 'kpi-row':
            return html`<lintje-kpi-row .data=${block.data}></lintje-kpi-row>`
          case 'chart':
            return html`<lintje-chart
              span=${block.data.span ?? nothing}
              .data=${block.data}
            ></lintje-chart>`
          case 'data-table':
            return html`<lintje-data-table
              span=${block.data.span ?? nothing}
              .data=${block.data}
            ></lintje-data-table>`
        }
      })}
    </div>`
  }

  private renderActions(): TemplateResult {
    const askReason = this.rating === 'down' && !this.reasonGiven
    return html`<div class="lintje-chat-answer__actions">
        <lintje-icon-button
          icon="functioneel-kopieren"
          label="Antwoord kopiëren"
          variant="flat"
          @click=${() => this.copy()}
        ></lintje-icon-button>
        <lintje-icon-button
          icon="lichaam-duim-omhoog"
          label="Goed antwoord"
          variant="flat"
          .pressed=${this.rating === 'up'}
          ?active=${this.rating === 'up'}
          @click=${() => this.rate('up')}
        ></lintje-icon-button>
        <lintje-icon-button
          icon="lichaam-duim-omlaag"
          label="Slecht antwoord"
          variant="flat"
          .pressed=${this.rating === 'down'}
          ?active=${this.rating === 'down'}
          @click=${() => this.rate('down')}
        ></lintje-icon-button>
        ${
          this.current
            ? html`<lintje-icon-button
              icon="functioneel-refresh"
              label="Opnieuw beantwoorden"
              variant="flat"
                  @click=${() => this.retry()}
            ></lintje-icon-button>`
            : nothing
        }
        <span class="lintje-chat-answer__note" role="status">${this.note}</span>
      </div>
      ${
        askReason
          ? html`<div
            class="lintje-chat-answer__reasons"
            role="group"
            aria-labelledby="reasons"
          >
            <span id="reasons" class="lintje-chat-answer__reasons-label">Wat was er mis?</span>
            ${REASONS.map(
              (reason) => html`<lintje-button
                variant="tertiary"
                size="compact"
                @click=${() => this.giveReason(reason)}
                >${reason}</lintje-button
              >`,
            )}
          </div>`
          : nothing
      }`
  }
}

define('lintje-chat-answer', LintjeChatAnswer)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-chat-answer': LintjeChatAnswer
  }
}
