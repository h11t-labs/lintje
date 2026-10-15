/**
 * `<lintje-chat>` — a conversation with data, from `ChatData`; the host owns the transport.
 *
 * An answer arrives by setting `data` again: keep the objects that did not change, so only the
 * changed part is redrawn. It scrolls with what scrolls around it, and its question box stays in
 * view at the bottom.
 *
 * It sends no events of its own: those of its question box, messages and answers reach the host,
 * with the `turnId` where a turn sent them. The host answers `lintje-message-send` with a new turn,
 * `lintje-message-edit` by asking again without that turn and all after it, and
 * `lintje-strip-change` by answering again with the new assumption. A turn's `divider` stands as a
 * centred line above its question. The `questions` of the last answer stand in a box above the
 * question box until the next turn; on a phone the question box folds to one line meanwhile.
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { repeat } from 'lit/directives/repeat.js'
import { LintjeElement, define, type FrameSettings } from '../../../core/element'
import { deepActiveElement, holdsFocus } from '../../../core/focus'
import { scrollRoot } from '../../../core/host-config'
import { MediaController } from '../../../core/media'
import { prefersReducedMotion } from '../../../core/motion'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import '../../actions/button/button'
import '../chat-answer/chat-answer'
import '../chat-composer/chat-composer'
import type { LintjeChatComposer } from '../chat-composer/chat-composer'
import '../chat-message/chat-message'
import '../chat-questions/chat-questions'
import type { LintjeChatQuestions } from '../chat-questions/chat-questions'
import '../chat-suggestions/chat-suggestions'
import chatCss from './chat.css?inline'
import type {
  ChatAnswerData,
  ChatData,
  ChatDivider,
  ChatSourceData,
  ChatStartData,
  ChatTurnData,
} from '../../../types'

const TRIMMED = 'De assistent neemt de vragen hierboven niet meer mee.'

/** The two states in which the assistant waits on the reader; only then do its questions count. */
const ASKING = new Set<ChatAnswerData['state']>(['needs-clarification', 'out-of-scope'])

/**
 * A line between turns, centred: line, label, line. A plain paragraph in the reading order; the
 * lines and the arrow are drawing. Not a separator, whose name is often skipped and which holds no
 * sentence, and not a heading, which would read as standing over what follows.
 */
function renderDivider(divider: ChatDivider): TemplateResult {
  const kind = divider.kind ?? 'time'
  const context = kind === 'context'
  const note = divider.note ?? (context ? TRIMMED : undefined)
  return html`<div
    class=${classMap({ 'lintje-chat__divider': true, 'lintje-chat__divider--context': context })}
  >
    <p class="lintje-chat__divider-label">
      <span class="lintje-chat__divider-line" aria-hidden="true"></span>
      <span class="lintje-chat__divider-text"
        >${
          context
            ? renderIcon('functioneel-pijl-omhoog', { className: 'lintje-chat__divider-icon' })
            : nothing
        }${divider.label}</span
      >
      <span class="lintje-chat__divider-line" aria-hidden="true"></span>
    </p>
    ${note ? html`<p class="lintje-chat__divider-note">${note}</p>` : nothing}
  </div>`
}

/** The nearest ancestor that scrolls, across slots and shadow roots; without one, the page's. */
function scrollerOf(element: Element): HTMLElement | null {
  let node: Element | null = element
  for (;;) {
    node =
      node.assignedSlot ?? node.parentElement ?? (node.getRootNode() as ShadowRoot).host ?? null
    if (!node || node === document.body || node === document.documentElement) return scrollRoot()
    const overflow = getComputedStyle(node).overflowY
    if (overflow === 'auto' || overflow === 'scroll') return node as HTMLElement
  }
}

type PaddingSide = 'scrollPaddingTop' | 'scrollPaddingBottom'

/**
 * One side of a scroller's `scroll-padding`, raised to what the chat needs and never below what
 * another element (the shell's bar, a form's action bar) set there; given back on release.
 */
class ScrollRoom {
  #element: HTMLElement | null = null
  /** What stood there before, or what another element wrote since. */
  #base = ''
  #wrote = ''

  constructor(readonly side: PaddingSide) {}

  reserve(element: HTMLElement | null, room: number): void {
    if (element !== this.#element) {
      this.release()
      this.#element = element
      this.#base = element?.style[this.side] ?? ''
    }
    if (!element) return
    const now = element.style[this.side]
    if (now !== this.#wrote) this.#base = now
    const base = parseFloat(this.#base) || 0
    this.#wrote = room > base ? `${Math.ceil(room)}px` : this.#base
    element.style[this.side] = this.#wrote
  }

  release(): void {
    const element = this.#element
    if (element && element.style[this.side] === this.#wrote) element.style[this.side] = this.#base
    this.#element = null
    this.#wrote = ''
  }
}

export class LintjeChat extends LintjeElement {
  static override styles = [iconStyles, shadowCss(chatCss)]

  static override properties: PropertyDeclarations = {
    data: { attribute: false },
    editingId: { state: true },
    away: { state: true },
    paged: { state: true },
    composerOpen: { state: true },
  }

  declare data?: ChatData | null

  /** The turn whose message is in its input frame, if any. */
  editingId: string | null = null
  away: boolean = false
  /** The page scrolls the conversation, so a question sticks under the shell's pinned bar. */
  paged: boolean = false
  /** On a phone, the reader opened the folded question box while the assistant asks. */
  composerOpen: boolean = false

  /** Pixels from the end that count as away. */
  static readonly AWAY = 120
  /** Pixels from the end that still count as standing at it. */
  static readonly AT_END = 8

  #turns = 0
  /** The reader stands at the end, so what grows there keeps them at it. */
  #atEnd = true
  /** Where the scroller stood at its last scroll. */
  #top = 0
  #growth: ResizeObserver | null = null
  #footerSize: ResizeObserver | null = null
  readonly #mobile = new MediaController(this)
  /** The ids of the questions in the box, to see a new set arrive. */
  #asked = ''
  readonly #roomAbove = new ScrollRoom('scrollPaddingTop')
  readonly #roomBelow = new ScrollRoom('scrollPaddingBottom')

  override connectedCallback(): void {
    super.connectedCallback()
    window.addEventListener('scroll', this.#onScroll, { capture: true, passive: true })
    if (typeof ResizeObserver === 'undefined') return
    // The start screen rests at its top; a conversation rests at its end.
    this.#growth = new ResizeObserver(() => {
      if (this.#atEnd && this.data?.turns?.length) this.toEnd()
      this.reserveRoom()
    })
    this.#growth.observe(this)
    this.#footerSize = new ResizeObserver(() => this.reserveRoom())
  }

  override disconnectedCallback(): void {
    window.removeEventListener('scroll', this.#onScroll, { capture: true })
    this.#growth?.disconnect()
    this.#growth = null
    this.#footerSize?.disconnect()
    this.#footerSize = null
    this.#roomAbove.release()
    this.#roomBelow.release()
    super.disconnectedCallback()
  }

  /**
   * The question that sticks above and the question box that sticks below would cover what the
   * focus scrolls to (WCAG 2.4.11): the scroller keeps their height free, as the form's action
   * bar does. Above, the tallest question that sticks, from where it sticks.
   */
  private reserveRoom(): void {
    const footer = this.renderRoot.querySelector<HTMLElement>('.lintje-chat__footer')
    if (!this.isConnected || !footer) return
    const scroller = scrollerOf(this)
    let above = 0
    for (const message of this.renderRoot.querySelectorAll<HTMLElement>('.lintje-chat__message')) {
      const style = getComputedStyle(message)
      if (style.position !== 'sticky') continue
      above = Math.max(above, (parseFloat(style.top) || 0) + message.offsetHeight)
    }
    this.#roomAbove.reserve(scroller, above)
    this.#roomBelow.reserve(scroller, footer.offsetHeight)
  }

  /** How far the conversation's end lies below what its scroller shows. */
  private beyond(): number {
    const scroller = scrollerOf(this)
    if (!scroller) return 0
    const edge =
      scroller === document.scrollingElement
        ? scroller.clientHeight
        : scroller.getBoundingClientRect().bottom
    return this.getBoundingClientRect().bottom - edge
  }

  // An answer that grows leaves the end below the reader without a scroll of theirs: only
  // scrolling up leaves the end, and only arriving there returns to it.
  readonly #onScroll = (): void => {
    const top = scrollerOf(this)?.scrollTop ?? 0
    const beyond = this.beyond()
    if (top < this.#top) this.#atEnd = false
    if (beyond <= LintjeChat.AT_END) this.#atEnd = true
    this.#top = top
    this.away = !this.#atEnd && beyond > LintjeChat.AWAY
  }

  private toEnd(behavior: ScrollBehavior = 'auto'): void {
    const beyond = this.beyond()
    if (beyond > 0) scrollerOf(this)?.scrollBy({ top: beyond, behavior })
  }

  private get composer(): LintjeChatComposer | null {
    return this.renderRoot.querySelector<LintjeChatComposer>('.lintje-chat__composer')
  }

  // The button leaves once the end is in view, so the focus goes where the next question starts.
  private toLatest(): void {
    this.toEnd(prefersReducedMotion() ? 'auto' : 'smooth')
    this.composer?.focus()
  }

  /** The questions of the last answer while it waits on the reader; none while a turn is edited. */
  private get asking(): ChatAnswerData | null {
    const turns = this.data?.turns ?? []
    const answer = turns[turns.length - 1]?.answer
    if (!answer?.questions?.questions.length || !ASKING.has(answer.state)) return null
    return this.editingId === null ? answer : null
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    this.paged = scrollerOf(this) === scrollRoot()
    if ((changed.has('data') || changed.has('editingId')) && holdsFocus(this)) {
      void this.keepFocus()
    }
    const asked = (this.asking?.questions?.questions ?? []).map((question) => question.id).join(' ')
    if (asked === this.#asked) return
    this.#asked = asked
    this.composerOpen = false
    // A new box takes the focus from where the reader stood in the conversation.
    if (asked && holdsFocus(this)) void this.focusQuestions()
  }

  private async focusQuestions(): Promise<void> {
    await this.updateComplete
    this.renderRoot.querySelector<LintjeChatQuestions>('lintje-chat-questions')?.focus()
  }

  private async openComposer(open: boolean): Promise<void> {
    this.composerOpen = open
    await this.updateComplete
    await this.composer?.updateComplete
    this.composer?.focus()
  }

  /**
   * A turn can take the focused control away: an edit that ends, or the edit button an answer
   * that starts takes away. Once the turns have drawn, a focus that fell out goes to the field.
   */
  private async keepFocus(): Promise<void> {
    await this.updateComplete
    await new Promise((settled) => requestAnimationFrame(settled))
    const active = deepActiveElement()
    if (this.isConnected && (!active || active === document.body)) this.composer?.focus()
  }

  // A new turn scrolls to the end; a growing answer does not move a reader who scrolled up.
  protected override updated(changed: PropertyValues<this>): void {
    const footer = this.renderRoot.querySelector<HTMLElement>('.lintje-chat__footer')
    if (footer) this.#footerSize?.observe(footer)
    const turns = this.data?.turns?.length ?? 0
    // A question that starts or stops sticking need not change a size the observers see.
    if (turns !== this.#turns || changed.has('editingId') || changed.has('paged')) {
      this.reserveRoom()
    }
    if (!changed.has('data')) return
    if (turns > this.#turns) {
      this.#atEnd = true
      this.toEnd()
    }
    this.#turns = turns
  }

  protected override get dataSettings(): FrameSettings | undefined {
    return this.data ?? undefined
  }

  private onEditingChange(event: Event): void {
    const { turnId, editing } = (event as CustomEvent<{ turnId: string; editing: boolean }>).detail
    if (editing) this.editingId = turnId
    else if (this.editingId === turnId) this.editingId = null
  }

  protected override render(): TemplateResult | typeof nothing {
    const data = this.data
    if (!data) return nothing
    const turns = data.turns ?? []
    const last = turns[turns.length - 1]
    const asking = this.asking
    const folds = Boolean(asking) && this.#mobile.matches
    return html`<div class=${classMap({ 'lintje-chat': true, 'lintje-chat--page': this.paged })}>
      <div class="lintje-chat__log" role="log" aria-label="Gesprek">
        ${
          turns.length
            ? this.renderTurns(turns, data)
            : this.renderStart(data.start ?? {}, data.sources)
        }
      </div>
      <div class="lintje-chat__footer">
        ${
          this.away && turns.length
            ? html`<div class="lintje-chat__latest">
              <span class="lintje-chat__latest-button">
                <lintje-button
                  variant="tertiary"
                  size="chrome"
                  icon="functioneel-pijl-omlaag"
                  @click=${() => this.toLatest()}
                  >Naar nieuwste</lintje-button
                >
              </span>
            </div>`
            : nothing
        }
        <div class="lintje-chat__ask">
        ${
          asking
            ? html`<lintje-chat-questions
              class="lintje-chat__questions"
              turn-id=${last.id}
              .data=${asking.questions}
            ></lintje-chat-questions>`
            : nothing
        }
        <lintje-chat-composer
          class="lintje-chat__composer"
          placeholder=${asking ? 'Stel een nieuwe vraag' : (data.placeholder ?? nothing)}
          hint=${asking ? 'Een nieuwe vraag slaat deze vragen over' : nothing}
          ?collapsed=${folds && !this.composerOpen}
          ?collapsible=${folds && this.composerOpen}
          @lintje-composer-expand=${() => this.openComposer(true)}
          @lintje-composer-collapse=${() => this.openComposer(false)}
          recall=${last?.message.text ?? nothing}
          ?busy=${turns.some((turn) => turn.answer?.state === 'streaming')}
          .sources=${data.sources}
          .vocabulary=${data.vocabulary}
          .draftTerms=${data.draftTerms}
          accept=${data.upload?.accept ?? nothing}
          .maxSize=${data.upload?.maxSize}
          .files=${data.upload ? (data.upload.files ?? []) : undefined}
        ></lintje-chat-composer>
        </div>
      </div>
    </div>`
  }

  private renderTurns(turns: ChatTurnData[], data: ChatData): TemplateResult {
    const editingIndex = turns.findIndex((turn) => turn.id === this.editingId)
    const editing = editingIndex !== -1
    const busy = turns.some((turn) => turn.answer?.state === 'streaming')
    return html`<div class="lintje-chat__list">
      ${repeat(
        turns,
        (turn) => turn.id,
        (turn, index) => {
          const answer = turn.answer
          const replaced = editing && index >= editingIndex
          return html`<section class="lintje-chat__turn">
            ${turn.divider ? renderDivider(turn.divider) : nothing}
            <lintje-chat-message
              class="lintje-chat__message"
              turn-id=${turn.id}
              text=${turn.message.text}
              time=${turn.message.time ?? nothing}
              .terms=${turn.message.terms}
              .attachments=${turn.message.attachments}
              .vocabulary=${data.vocabulary}
              .sources=${data.sources}
              ?editable=${!busy && (!editing || index === editingIndex)}
              @lintje-editing-change=${this.onEditingChange}
            ></lintje-chat-message>
            ${
              answer
                ? html`<lintje-chat-answer
                  class=${classMap({ 'lintje-chat__answer': true, 'is-replaced': replaced })}
                  turn-id=${turn.id}
                  state=${answer.state ?? 'ready'}
                  lead=${answer.lead ?? nothing}
                  text=${answer.text ?? nothing}
                  status=${answer.status ?? nothing}
                  .steps=${answer.steps}
                  .blocks=${answer.blocks}
                  .strip=${answer.strip}
                  .error=${answer.error}
                  .followUps=${answer.followUps}
                  ?current=${index === turns.length - 1 && !editing}
                  ?inert=${replaced}
                ></lintje-chat-answer>`
                : nothing
            }
          </section>`
        },
      )}
    </div>`
  }

  private renderStart(start: ChatStartData, sources: ChatSourceData[] = []): TemplateResult {
    const chosen = sources.filter((source) => source.selected)
    return html`<div class="lintje-chat__start">
      <div class="lintje-chat__intro">
        <h3 class="lintje-chat__title">
          <span class="visually-hidden">Assistent: </span>${
            start.title ?? 'Waar wil je meer over weten?'
          }
        </h3>
        ${start.intro ? html`<p class="lintje-chat__lede">${start.intro}</p>` : nothing}
        ${sources.length ? this.renderSources(chosen) : nothing}
        ${start.note ? html`<p class="lintje-chat__note">${start.note}</p>` : nothing}
      </div>
      <lintje-chat-suggestions
        label="Jij, als eerste vraag"
        .items=${start.starters}
      ></lintje-chat-suggestions>
    </div>`
  }

  private renderSources(chosen: ChatSourceData[]): TemplateResult {
    const heading =
      chosen.length === 0
        ? 'Je hebt geen bron gekozen'
        : `Je vraagt over ${chosen.length} ${chosen.length === 1 ? 'bron' : 'bronnen'}`
    return html`<section class="lintje-chat__sources" aria-labelledby="sources">
      <div class="lintje-chat__sources-head">
        <h4 id="sources" class="lintje-chat__sources-title">${heading}</h4>
        <lintje-button
          variant="link"
          size="compact"
          @click=${() =>
            this.renderRoot
              .querySelector<LintjeChatComposer>('lintje-chat-composer')
              ?.openSources()}
          >Wijzigen</lintje-button
        >
      </div>
      ${
        chosen.length
          ? html`<ul class="lintje-chat__source-list">
            ${chosen.map(
              (source) => html`<li class="lintje-chat__source">
                <span>${source.label}</span>
                ${
                  source.asOf
                    ? html`<span class="lintje-chat__source-meta">${source.asOf}</span>`
                    : nothing
                }
              </li>`,
            )}
          </ul>`
          : nothing
      }
    </section>`
  }
}

define('lintje-chat', LintjeChat)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-chat': LintjeChat
  }
}
