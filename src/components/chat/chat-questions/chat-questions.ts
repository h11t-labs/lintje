/**
 * `<lintje-chat-questions>` — what the assistant asks before it answers, in a box above the
 * question box. One `one` question without descriptions is the short form: a tap sends. Anything
 * else is steps: one question at a time, with Vorige, Volgende and Versturen.
 *
 * Every choice question ends in "Iets anders…". What the reader picked is the element's own until
 * it sends, and starts over only when the questions change (other ids). It checks its own questions
 * at Volgende and Versturen. `focus()` puts the focus on the first choice; `lintje-chat` calls it
 * when the box appears while the focus is in the conversation and the question box holds no
 * draft. The host sets `state: 'sending'`
 * while it waits, then adds a turn with `text` as the reader's message, which ends the questions.
 *
 * Events: `lintje-questions-answer` `{ turnId, answers, text }` (`answers`: per question
 * `{ id, values, other, skipped }`; `text`: the reader's message, a line per question).
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { keyed } from 'lit/directives/keyed.js'
import { LintjeElement, define } from '../../../core/element'
import { MediaController } from '../../../core/media'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import { OTHER_VALUE, otherField } from '../../shared/controls'
import { OTHER_MISSING_TEXT, renderOtherField } from '../../shared/other'
import '../../actions/button/button'
import '../../feedback/progress-bar/progress-bar'
import '../../inputs/checkbox-group/checkbox-group'
import '../../inputs/radio-group/radio-group'
import '../../inputs/text-input/text-input'
import '../../inputs/textarea/textarea'
import frameCss from '../shared/frame.css?inline'
import chatQuestionsCss from './chat-questions.css?inline'
import type { ChatQuestion, ChatQuestionsData } from '../../../types'

/** The reader's answer to one question, as `lintje-questions-answer` carries it. */
export interface ChatQuestionAnswer {
  id: string
  /** Only the host's options; at most one for `one`; the text as the one value for `text`. */
  values: string[]
  /** The text of "Iets anders…" while it is chosen; `null` otherwise. */
  other: string | null
  /** An optional question that went by without an answer. */
  skipped: boolean
}

/** What the reader has picked or typed for one question so far. */
interface Draft {
  /** The chosen values, `other` among them while "Iets anders…" is chosen. */
  values: string[]
  other: string
  text: string
}

interface Problem {
  error?: string
  otherError?: string
}

const OTHER_LABEL = 'Iets anders…'
const NO_PREFERENCE = 'geen voorkeur'
const MOST = 5

const empty = (): Draft => ({ values: [], other: '', text: '' })

/** The short form: one `one` question whose options need no line of their own. */
export function isShortForm(questions: ChatQuestion[]): boolean {
  return (
    questions.length === 1 &&
    questions[0].kind === 'one' &&
    !(questions[0].options ?? []).some((option) => option.description)
  )
}

export class LintjeChatQuestions extends LintjeElement {
  static override styles = [iconStyles, shadowCss(frameCss), shadowCss(chatQuestionsCss)]

  static override properties: PropertyDeclarations = {
    data: { attribute: false },
    turnId: { type: String, attribute: 'turn-id' },
    step: { state: true },
    drafts: { state: true },
    problems: { state: true },
    skipped: { state: true },
    otherOpen: { state: true },
    said: { state: true },
  }

  declare data?: ChatQuestionsData | null
  /** The turn whose answer asks; it comes back in the event. */
  declare turnId?: string

  step: number = 0
  drafts: Record<string, Draft> = {}
  problems: Record<string, Problem> = {}
  /** The optional questions the reader passed with Overslaan. */
  skipped: string[] = []
  /** The short form's "Iets anders…" is open. */
  otherOpen: boolean = false
  /** What the status region says. */
  said: string = ''

  readonly #mobile = new MediaController(this)
  #ids = ''
  #warned = false
  #focusNext = false
  #announce = 0
  /** The choices change height on their own ("Iets anders…" opens): the line under them follows. */
  #sized: ResizeObserver | null = null
  #watched: Element | null = null

  private get questions(): ChatQuestion[] {
    return this.data?.questions ?? []
  }

  private get sending(): boolean {
    return this.data?.state === 'sending'
  }

  private get short(): boolean {
    return isShortForm(this.questions)
  }

  private get current(): ChatQuestion | undefined {
    return this.questions[Math.min(this.step, this.questions.length - 1)]
  }

  private draft(id: string): Draft {
    return this.drafts[id] ?? empty()
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (!changed.has('data')) return
    const ids = this.questions.map((question) => question.id).join(' ')
    if (this.questions.length > MOST && !this.#warned) {
      this.#warned = true
      console.warn(
        `<lintje-chat-questions>: ${this.questions.length} questions; ask at most ${MOST}.`,
      )
    }
    if (ids !== this.#ids) {
      this.#ids = ids
      this.step = 0
      this.drafts = {}
      this.problems = {}
      this.skipped = []
      this.otherOpen = false
      if (ids) this.say(this.short ? 'Assistent vraagt' : `Assistent vraagt, ${this.position}`)
    }
    if (this.sending) this.say('Antwoorden versturen')
  }

  // Choices taller than their box get a line under them that says there is more. Measured after
  // drawing, so it goes on the DOM, not into a property that would draw again.
  private measure(): void {
    const list = this.renderRoot.querySelector<HTMLElement>('.lintje-chat-questions__choices')
    list?.classList.toggle('is-scrolling', list.scrollHeight > list.clientHeight + 1)
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    this.measure()
    const control = this.renderRoot.querySelector('.lintje-chat-questions__control')
    if (control !== this.#watched && typeof ResizeObserver !== 'undefined') {
      this.#sized ??= new ResizeObserver(() => this.measure())
      if (this.#watched) this.#sized.unobserve(this.#watched)
      if (control) this.#sized.observe(control)
      this.#watched = control
    }
    if (this.#focusNext) {
      this.#focusNext = false
      void this.focusQuestion()
    }
  }

  override disconnectedCallback(): void {
    cancelAnimationFrame(this.#announce)
    this.#sized?.disconnect()
    this.#sized = null
    this.#watched = null
    super.disconnectedCallback()
  }

  /** The status region is drawn empty: its words come a frame later, so they are read. */
  private say(words: string): void {
    cancelAnimationFrame(this.#announce)
    this.said = ''
    this.#announce = requestAnimationFrame(() => (this.said = words))
  }

  private get position(): string {
    return `vraag ${this.step + 1} van ${this.questions.length}`
  }

  /** The focus on the current question's first choice, or the chosen one. */
  override focus(): void {
    void this.focusQuestion()
  }

  private async focusQuestion(): Promise<void> {
    await this.updateComplete
    const control = this.renderRoot.querySelector<HTMLElement & { updateComplete?: unknown }>(
      '.lintje-chat-questions__control, .lintje-chat-questions__chip',
    )
    await control?.updateComplete
    control?.focus()
  }

  private async focusOther(): Promise<void> {
    await this.updateComplete
    const group = this.renderRoot.querySelector<HTMLElement & { updateComplete: Promise<unknown> }>(
      '.lintje-chat-questions__control',
    )
    await group?.updateComplete
    const field = otherField(group?.shadowRoot ?? this.renderRoot)
    await field?.updateComplete
    field?.focus()
  }

  private change(id: string, change: Partial<Draft>): void {
    this.drafts = { ...this.drafts, [id]: { ...this.draft(id), ...change } }
    this.skipped = this.skipped.filter((skipped) => skipped !== id)
    const problem = { ...this.problems[id] }
    if ('other' in change) delete problem.otherError
    else {
      delete problem.error
      if (!(change.values ?? []).includes(OTHER_VALUE)) delete problem.otherError
    }
    this.problems = { ...this.problems, [id]: problem }
  }

  /** What is wrong with a question's answer, if anything. */
  private check(question: ChatQuestion): Problem | null {
    const draft = this.draft(question.id)
    if (question.kind === 'text') {
      if (draft.text.trim() || question.optional) return null
      return { error: question.error ?? 'Vul een antwoord in.' }
    }
    if (draft.values.includes(OTHER_VALUE) && !draft.other.trim()) {
      return { otherError: OTHER_MISSING_TEXT }
    }
    if (draft.values.length || question.optional) return null
    return { error: question.error ?? 'Kies een antwoord.' }
  }

  /** Volgende and Versturen: on to the next question, or send from the last. */
  private next(): void {
    const question = this.current
    if (!question || this.sending) return
    const problem = this.check(question)
    if (problem) {
      this.problems = { ...this.problems, [question.id]: problem }
      void (problem.otherError ? this.focusOther() : this.focusQuestion())
      return
    }
    this.advance()
  }

  private skip(): void {
    const question = this.current
    if (!question || this.sending) return
    this.skipped = [...this.skipped.filter((id) => id !== question.id), question.id]
    this.problems = { ...this.problems, [question.id]: {} }
    this.advance()
  }

  private back(): void {
    if (this.sending || this.step === 0) return
    this.step -= 1
    this.#focusNext = true
    this.say(`Vraag ${this.step + 1} van ${this.questions.length}`)
  }

  private advance(): void {
    if (this.step >= this.questions.length - 1) {
      this.send()
      return
    }
    this.step += 1
    this.#focusNext = true
    this.say(`Vraag ${this.step + 1} van ${this.questions.length}`)
  }

  /** The answer to one question, as the event carries it. */
  private answerTo(question: ChatQuestion): ChatQuestionAnswer {
    const draft = this.draft(question.id)
    const skipped = { id: question.id, values: [], other: null, skipped: true }
    if (this.skipped.includes(question.id)) return skipped
    if (question.kind === 'text') {
      const text = draft.text.trim()
      return text ? { id: question.id, values: [text], other: null, skipped: false } : skipped
    }
    const values = draft.values.filter((value) => value !== OTHER_VALUE)
    const other = draft.values.includes(OTHER_VALUE) ? draft.other.trim() : null
    if (!values.length && other === null) return skipped
    return { id: question.id, values, other, skipped: false }
  }

  /** How an answer reads in the reader's message: the labels, then the own text. */
  private words(question: ChatQuestion, answer: ChatQuestionAnswer): string {
    if (answer.skipped) return NO_PREFERENCE
    if (question.kind === 'text') return answer.values[0]
    const labels = answer.values.map(
      (value) => question.options?.find((option) => option.value === value)?.label ?? value,
    )
    return [...labels, ...(answer.other ? [answer.other] : [])].join(', ')
  }

  private send(): void {
    const answers = this.questions.map((question) => this.answerTo(question))
    const text = this.short
      ? this.words(this.questions[0], answers[0])
      : this.questions
          .map((question, index) => `${question.label}: ${this.words(question, answers[index])}`)
          .join('\n')
    this.emit('lintje-questions-answer', { turnId: this.turnId ?? null, answers, text })
  }

  /** The short form: a tap on a choice sends it. */
  private pick(value: string): void {
    if (this.sending) return
    const id = this.questions[0].id
    this.drafts = { ...this.drafts, [id]: { ...this.draft(id), values: [value] } }
    this.send()
  }

  private toggleOther(): void {
    if (this.sending) return
    const id = this.questions[0].id
    this.otherOpen = !this.otherOpen
    this.change(id, { values: this.otherOpen ? [OTHER_VALUE] : [] })
    if (this.otherOpen) void this.focusOther()
  }

  private onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.isComposing || event.shiftKey || event.altKey) return
    const origin = event.composedPath()[0]
    // A button's own Enter is its click; in free text Enter is a new line, Ctrl+Enter is Volgende.
    if (origin instanceof HTMLButtonElement || origin instanceof HTMLAnchorElement) return
    if (origin instanceof HTMLTextAreaElement && !(event.ctrlKey || event.metaKey)) return
    // The field committed on this Enter already; the form around it would submit too.
    event.preventDefault()
    if (!this.short) this.next()
    else if (this.otherOpen) this.next()
  }

  protected override render(): TemplateResult | typeof nothing {
    const questions = this.questions
    if (!questions.length) return nothing
    return html`<form
      class=${classMap({
        'lintje-chat-frame': true,
        'lintje-chat-questions': true,
        'is-phone': this.#mobile.matches,
      })}
      aria-label="Vragen van de assistent"
      aria-busy=${this.sending ? 'true' : nothing}
      novalidate
      @submit=${(event: Event) => event.preventDefault()}
      @keydown=${this.onKeydown}
    >
      ${this.short ? this.renderShort(questions[0]) : this.renderStep()}
      <div class="visually-hidden" role="status">${this.said}</div>
    </form>`
  }

  private renderShort(question: ChatQuestion): TemplateResult {
    const draft = this.draft(question.id)
    const problem = this.problems[question.id] ?? {}
    return html`<div
      class="lintje-chat-questions__body"
      role="group"
      aria-labelledby="question"
      aria-describedby=${question.hint ? 'hint' : nothing}
    >
      <p id="question" class="lintje-chat-questions__question">${question.text}</p>
      ${question.hint ? html`<p id="hint" class="lintje-chat-questions__hint">${question.hint}</p>` : nothing}
      <div class="lintje-chat-questions__chips">
        ${(question.options ?? []).map(
          (option) => html`<button
            type="button"
            class="lintje-chat-questions__chip"
            aria-disabled=${this.sending ? 'true' : nothing}
            @click=${() => this.pick(option.value)}
          >
            ${option.label}
          </button>`,
        )}
        <button
          type="button"
          class=${classMap({
            'lintje-chat-questions__chip': true,
            'lintje-chat-questions__chip--other': true,
            'is-chosen': this.otherOpen,
          })}
          aria-expanded=${String(this.otherOpen)}
          aria-disabled=${this.sending ? 'true' : nothing}
          @click=${() => this.toggleOther()}
        >
          ${OTHER_LABEL}
        </button>
      </div>
      ${
        this.otherOpen
          ? html`<div class="lintje-chat-questions__own">
            ${renderOtherField({
              label: OTHER_LABEL,
              text: draft.other,
              placeholder: question.otherPlaceholder,
              error: problem.otherError,
              className: 'lintje-chat-questions__own-field',
              onCommit: (text) => this.change(question.id, { other: text }),
            })}
            <lintje-button
              class="lintje-chat-questions__own-send"
              ?block=${this.#mobile.matches}
              variant="primary"
              ?busy=${this.sending}
              @click=${() => this.next()}
              >Versturen</lintje-button
            >
          </div>`
          : nothing
      }
    </div>`
  }

  private renderStep(): TemplateResult {
    const questions = this.questions
    const question = this.current!
    const index = questions.indexOf(question)
    const last = index === questions.length - 1
    const count = `Vraag ${index + 1} van ${questions.length}`
    const hint =
      question.kind === 'text'
        ? [question.hint, `Ctrl+Enter: ${last ? 'versturen' : 'volgende vraag'}.`]
            .filter(Boolean)
            .join(' ')
        : question.hint
    const error = this.problems[question.id]?.error
    return html`<div class="lintje-chat-questions__progress">
        <p class="lintje-chat-questions__count" aria-hidden="true">
          ${count} <span class="lintje-chat-questions__label">· ${question.label}</span>
        </p>
        <lintje-progress-bar
          hide-label
          label="Vragen van de assistent"
          detail="${count}: ${question.label}"
          .value=${(index / questions.length) * 100}
        ></lintje-progress-bar>
      </div>
      <div class="lintje-chat-questions__body">
        <p class="lintje-chat-questions__question" aria-hidden="true">
          ${question.text}${
            question.optional
              ? html` <span class="lintje-chat-questions__optional">(niet verplicht)</span>`
              : nothing
          }
        </p>
        ${hint ? html`<p class="lintje-chat-questions__hint" aria-hidden="true">${hint}</p>` : nothing}
        ${
          error
            ? html`<p class="lintje-chat-questions__error" role="alert">
              ${renderIcon('functioneel-waarschuwing', { size: 14 })}${error}
            </p>`
            : nothing
        }
        <!-- Firefox makes a scroller a tab stop of its own; the choices in it are the stops. -->
        <div class="lintje-chat-questions__choices" tabindex="-1">
          ${keyed(question.id, this.renderControl(question, [error, hint].filter(Boolean).join(' ')))}
        </div>
      </div>
      <div class="lintje-chat-questions__actions">
        ${
          index > 0
            ? html`<lintje-button
              class="lintje-chat-questions__back"
              ?block=${this.#mobile.matches}
              variant="tertiary"
              ?disabled=${this.sending}
              @click=${() => this.back()}
              >Vorige</lintje-button
            >`
            : nothing
        }
        ${
          question.optional
            ? html`<lintje-button
              class="lintje-chat-questions__skip"
              ?block=${this.#mobile.matches}
              variant="tertiary"
              ?disabled=${this.sending}
              @click=${() => this.skip()}
              >Overslaan</lintje-button
            >`
            : nothing
        }
        <lintje-button
          class="lintje-chat-questions__next"
          ?block=${this.#mobile.matches}
          variant="primary"
          ?busy=${this.sending && last}
          ?disabled=${this.sending && !last}
          @click=${() => this.next()}
          >${last ? 'Versturen' : 'Volgende'}</lintje-button
        >
      </div>`
  }

  // The question, its hint and its error stand above the choices, so the choices alone scroll and
  // stay in view with the focus; the group carries them as its hidden label and description.
  private renderControl(question: ChatQuestion, description: string): TemplateResult {
    const draft = this.draft(question.id)
    const problem = this.problems[question.id] ?? {}
    const common = {
      label: question.text,
      description: description || undefined,
      required: !question.optional,
      optional: Boolean(question.optional),
    }
    if (question.kind === 'text') {
      return html`<lintje-textarea
        class="lintje-chat-questions__control"
        label=${common.label}
        hide-label
        placeholder=${question.placeholder ?? ''}
        .description=${common.description}
        .value=${draft.text}
        ?required=${common.required}
        ?optional=${common.optional}
        @lintje-change=${(event: CustomEvent<string>) => {
          event.stopPropagation()
          this.change(question.id, { text: event.detail })
        }}
      ></lintje-textarea>`
    }
    const onOther = (event: CustomEvent<string>): void => {
      event.stopPropagation()
      this.change(question.id, { other: event.detail })
    }
    if (question.kind === 'many') {
      return html`<lintje-checkbox-group
        class="lintje-chat-questions__control"
        label=${common.label}
        hide-label
        other
        other-label=${OTHER_LABEL}
        other-placeholder=${question.otherPlaceholder ?? nothing}
        .options=${question.options ?? []}
        .description=${common.description}
        .selected=${draft.values}
        .otherText=${draft.other}
        .otherError=${problem.otherError}
        ?required=${common.required}
        ?optional=${common.optional}
        @lintje-change=${(event: CustomEvent<string[]>) => {
          event.stopPropagation()
          this.change(question.id, { values: event.detail })
        }}
        @lintje-other-change=${onOther}
      ></lintje-checkbox-group>`
    }
    return html`<lintje-radio-group
      class="lintje-chat-questions__control"
      label=${common.label}
      hide-label
      other
      other-label=${OTHER_LABEL}
      other-placeholder=${question.otherPlaceholder ?? nothing}
      .options=${question.options ?? []}
      .description=${common.description}
      .value=${draft.values[0] ?? ''}
      .otherText=${draft.other}
      .otherError=${problem.otherError}
      ?required=${common.required}
      ?optional=${common.optional}
      @lintje-change=${(event: CustomEvent<string>) => {
        event.stopPropagation()
        this.change(question.id, { values: event.detail ? [event.detail] : [] })
      }}
      @lintje-other-change=${onOther}
    ></lintje-radio-group>`
  }
}

define('lintje-chat-questions', LintjeChatQuestions)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-chat-questions': LintjeChatQuestions
  }
}
