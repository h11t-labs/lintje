/**
 * `<lintje-chat-composer>` — the question box: text field, source picker and split send button.
 *
 * The field is a plain-text `contenteditable`; the element never writes markup into it. Terms
 * are painted with the CSS Custom Highlight API so typing, input methods and undo stay the
 * browser's; without the API the field is unmarked. Terms come from `vocabulary` (matched while
 * typing) or from the host's `draftTerms`, which win while the text is unchanged.
 * The source selection is the host's; the draft, send key (in `localStorage`) and answer form
 * are the element's own.
 *
 * Events: `lintje-message-send` `{text, terms, sources, form}`, `lintje-answer-stop`,
 * `lintje-sources-change` `{ids}`, `lintje-draft-change` `{text}` (200 ms after the last key).
 * In `variant="edit"` it sends `lintje-submit` `{text, terms}` and `lintje-cancel` instead, both
 * not composed.
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { LintjeElement, define } from '../../../core/element'
import { holdsFocus } from '../../../core/focus'
import { MediaController } from '../../../core/media'
import { styleProps } from '../../../core/style-props'
import { shadowCss } from '../../../core/styles'
import '../../../primitives/button/button'
import '../../../primitives/icon-button/icon-button'
import '../../inputs/multiselect/multiselect'
import '../../inputs/radio-group/radio-group'
import type { LintjeMultiselect } from '../../inputs/multiselect/multiselect'
import { completions, recogniseTerms, wordBefore } from '../shared/chat-terms'
import keyCss from '../../shared/key.css?inline'
import chatComposerCss from './chat-composer.css?inline'
import type {
  ChatAnswerForm,
  ChatDraftTerms,
  ChatSourceData,
  ChatTermData,
  ChatTermRange,
  FilterOption,
} from '../../../types'

export type ChatComposerVariant = 'ask' | 'edit'
export type ChatSendKey = 'enter' | 'ctrl-enter'

const FORMS: FilterOption[] = [
  { value: 'auto', label: 'Automatisch (de assistent kiest)' },
  { value: 'text', label: 'Alleen tekst' },
  { value: 'chart', label: 'Met grafiek' },
  { value: 'table', label: 'Als tabel' },
]
const SEND_KEYS: FilterOption[] = [
  { value: 'enter', label: 'Enter (Shift+Enter: nieuwe regel)' },
  { value: 'ctrl-enter', label: 'Ctrl+Enter (Enter: nieuwe regel)' },
]

const SEND_KEY_STORE = 'lintje-chat-send-key'

/** The send key in words, in the field's description: the menu that sets it is a popup. */
const SEND_KEY_SAID: Record<ChatSendKey, string> = {
  enter: 'Enter verstuurt, Shift+Enter begint een nieuwe regel.',
  'ctrl-enter': 'Ctrl+Enter verstuurt, Enter begint een nieuwe regel.',
}

function storedSendKey(): ChatSendKey {
  try {
    return localStorage.getItem(SEND_KEY_STORE) === 'ctrl-enter' ? 'ctrl-enter' : 'enter'
  } catch {
    return 'enter'
  }
}

const CERTAIN = 'lintje-term'
const UNCERTAIN = 'lintje-term-uncertain'
const canHighlight = (): boolean =>
  typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined'

function highlight(name: string): Highlight {
  let registered = CSS.highlights.get(name)
  if (!registered) {
    registered = new Highlight()
    CSS.highlights.set(name, registered)
  }
  return registered
}

interface FieldText {
  text: string
  nodes: { node: Text; start: number }[]
}

function readField(input: HTMLElement): FieldText {
  const nodes: FieldText['nodes'] = []
  let text = ''
  const walker = document.createTreeWalker(input, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) {
      nodes.push({ node: node as Text, start: text.length })
      text += (node as Text).data
    } else if ((node as Element).localName === 'br') {
      text += '\n'
    }
  }
  return { text, nodes }
}

function locate(field: FieldText, offset: number): { node: Text; offset: number } | null {
  for (let index = field.nodes.length - 1; index >= 0; index--) {
    const { node, start } = field.nodes[index]
    if (offset >= start && offset <= start + node.data.length)
      return { node, offset: offset - start }
  }
  return null
}

interface Caption {
  left: number
  top: number
  kind: string
  certain: boolean
  /** The room up to the next caption on the same line; a longer caption is cut. */
  room?: number
}

export class LintjeChatComposer extends LintjeElement {
  static override styles = [shadowCss(keyCss), shadowCss(chatComposerCss)]

  static override properties: PropertyDeclarations = {
    variant: { type: String, reflect: true },
    text: { type: String },
    placeholder: { type: String },
    busy: { type: Boolean, reflect: true },
    recall: { type: String },
    sendKey: { type: String, attribute: 'send-key' },
    form: { type: String },
    sources: { attribute: false },
    vocabulary: { attribute: false },
    draftTerms: { attribute: false },
    optionsOpen: { type: Boolean, attribute: 'options-open', reflect: true },
    plain: { type: Boolean, reflect: true },
    draft: { state: true },
    caret: { state: true },
    completionIndex: { state: true },
    completionOff: { state: true },
    captions: { state: true },
  }

  /** `edit` is the frame a sent message is changed in: no picker, no split send. */
  variant: ChatComposerVariant = 'ask'
  /** The text to start from. Setting it again replaces what stands in the field. */
  text: string = ''
  placeholder: string = 'Stel een vraag over de gegevens'
  /** An answer is arriving: "Stoppen" stands in for the send button. */
  busy: boolean = false
  /** The last question, which ↑ brings back into an empty field. */
  declare recall?: string
  sendKey: ChatSendKey = storedSendKey()
  /** What kind of answer the reader asks for; it goes out with the question. */
  form: ChatAnswerForm = 'auto'
  /** Sources given and none `selected`: sending is off. The host sets them again on a change. */
  declare sources?: ChatSourceData[]
  declare vocabulary?: ChatTermData[]
  /** The host's own reading of the text; it wins while the text is unchanged. */
  declare draftTerms?: ChatDraftTerms
  optionsOpen: boolean = false
  /** Only "Versturen": no choice of the answer's form, no send key. For a question that is not a
   * conversation with data, such as the one on a start page that searches a catalogue. */
  plain: boolean = false

  draft: string = ''
  /** The caret as an offset into the draft. */
  caret: number = 0
  completionIndex: number = 0
  /** The reader dismissed the list, or took from it; typing brings it back. */
  completionOff: boolean = false
  captions: Caption[] = []

  readonly #mobile = new MediaController(this)
  /** Whether the browser keeps the field to plain text by itself. */
  #plain = true
  #ranges: { name: string; range: Range }[] = []
  #resize: ResizeObserver | null = null
  #announce: ReturnType<typeof setTimeout> | undefined
  /** "Stoppen" and the send button stand in for each other; one leaving with the focus. */
  #refocus = false

  private get input(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.lintje-chat-composer__input')
  }

  private get selectedIds(): string[] {
    return (this.sources ?? []).filter((source) => source.selected).map((source) => source.id)
  }

  private get noSource(): boolean {
    return this.variant === 'ask' && Boolean(this.sources?.length) && !this.selectedIds.length
  }

  private termsIn(text: string): ChatTermRange[] {
    if (this.draftTerms && this.draftTerms.text === text) return this.draftTerms.ranges
    return recogniseTerms(text, this.vocabulary, this.sources ? this.selectedIds : undefined)
  }

  private get suggestions(): ChatTermData[] {
    if (this.completionOff) return []
    if (this.termsIn(this.draft).some((term) => term.end === this.caret)) return []
    return completions(wordBefore(this.draft, this.caret), this.vocabulary)
  }

  override disconnectedCallback(): void {
    this.clearHighlights()
    this.#resize?.disconnect()
    this.#resize = null
    clearTimeout(this.#announce)
    super.disconnectedCallback()
  }

  protected override firstUpdated(): void {
    const input = this.input
    if (!input) return
    // Without `plaintext-only` the field is rich, so paste and Enter are kept plain by hand.
    if (input.contentEditable !== 'plaintext-only') {
      input.contentEditable = 'true'
      this.#plain = false
    }
    if (typeof ResizeObserver !== 'undefined') {
      this.#resize = new ResizeObserver(() => this.paint())
      this.#resize.observe(input)
    }
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (!changed.has('busy') || changed.get('busy') === undefined) return
    const leaving = this.renderRoot.querySelector(
      this.busy ? '.lintje-chat-composer__send' : '.lintje-chat-composer__stop',
    )
    if (leaving && holdsFocus(leaving)) this.#refocus = true
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has('text') && this.text !== this.draft) this.write(this.text, undefined, false)
    this.paint()
    // The field, where the next question starts; the send button is off while it is empty.
    if (this.#refocus) {
      this.#refocus = false
      this.focus()
    }
  }

  override focus(): void {
    this.write(this.draft)
  }

  /** Opens the source picker; the start screen's "Wijzigen" asks for it. */
  openSources(): void {
    const picker = this.renderRoot.querySelector<LintjeMultiselect>('lintje-multiselect')
    if (picker) picker.open = true
  }

  private selection(): Selection | null {
    const root = this.renderRoot as ShadowRoot & { getSelection?: () => Selection | null }
    return root.getSelection?.() ?? document.getSelection()
  }

  private read(): void {
    const input = this.input
    if (!input) return
    const field = readField(input)
    // An emptied field keeps a browser line break; it is no text.
    if (field.text === '\n') {
      input.textContent = ''
      field.text = ''
    }
    const selection = this.selection()
    const focus = field.nodes.find(({ node }) => node === selection?.focusNode)
    this.draft = field.text
    this.caret = focus ? focus.start + (selection?.focusOffset ?? 0) : field.text.length
  }

  private write(text: string, caret: number = text.length, focus: boolean = true): void {
    const input = this.input
    if (!input) return
    if (readField(input).text !== text) input.textContent = text
    if (focus) {
      input.focus()
      const place = locate(readField(input), caret)
      if (place) this.selection()?.collapse(place.node, place.offset)
    }
    this.draft = text
    this.caret = caret
  }

  private onInput(): void {
    this.read()
    this.completionOff = false
    this.completionIndex = 0
    clearTimeout(this.#announce)
    this.#announce = setTimeout(() => this.emit('lintje-draft-change', { text: this.draft }), 200)
  }

  private onPaste(event: ClipboardEvent): void {
    if (this.#plain) return
    event.preventDefault()
    document.execCommand('insertText', false, event.clipboardData?.getData('text/plain') ?? '')
  }

  private sends(event: KeyboardEvent): boolean {
    if (event.key !== 'Enter' || event.isComposing) return false
    const modified = event.ctrlKey || event.metaKey
    // A plain box has no menu to show the stored key in, so it keeps to Enter.
    const key = this.plain ? 'enter' : this.sendKey
    return key === 'enter' ? !event.shiftKey && !modified : modified
  }

  private onKeydown(event: KeyboardEvent): void {
    const list = this.suggestions
    if (list.length && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      this.completionIndex = (this.completionIndex + step + list.length) % list.length
    } else if (
      list.length &&
      (event.key === 'Enter' || event.key === 'Tab') &&
      !event.isComposing
    ) {
      event.preventDefault()
      this.complete(list[Math.min(this.completionIndex, list.length - 1)])
    } else if (list.length && event.key === 'Escape') {
      event.preventDefault()
      this.completionOff = true
    } else if (this.sends(event)) {
      event.preventDefault()
      this.send()
    } else if (event.key === 'Enter' && !this.#plain && !event.isComposing) {
      event.preventDefault()
      document.execCommand('insertLineBreak')
    } else if (event.key === 'Escape') {
      if (this.variant === 'edit') this.emitLocal('lintje-cancel')
      else if (this.busy) this.emit('lintje-answer-stop', {})
    } else if (event.key === 'ArrowUp' && this.draft === '' && this.recall) {
      event.preventDefault()
      this.write(this.recall)
    }
  }

  private complete(term: ChatTermData): void {
    const word = wordBefore(this.draft, this.caret)
    const start = this.caret - word.length
    const text = `${this.draft.slice(0, start)}${term.label} ${this.draft.slice(this.caret)}`
    this.write(text, start + term.label.length + 1)
    this.completionOff = true
  }

  private send(): void {
    const text = this.draft.trim()
    if (!text || this.noSource || (this.busy && this.variant === 'ask')) return
    const terms = this.termsFor(text)
    if (this.variant === 'edit') {
      this.emitLocal('lintje-submit', { text, terms })
      return
    }
    this.emit('lintje-message-send', { text, terms, sources: this.selectedIds, form: this.form })
    this.write('')
  }

  private termsFor(text: string): ChatTermRange[] {
    const lead = this.draft.length - this.draft.trimStart().length
    return this.termsIn(this.draft)
      .map((term) => ({ ...term, start: term.start - lead, end: term.end - lead }))
      .filter((term) => term.start >= 0 && term.end <= text.length)
  }

  private clearHighlights(): void {
    if (!canHighlight()) return
    for (const { name, range } of this.#ranges) highlight(name).delete(range)
    this.#ranges = []
  }

  // The browser's nodes change with every key, so the ranges are made again each time.
  private paint(): void {
    const input = this.input
    const box = this.renderRoot.querySelector<HTMLElement>('.lintje-chat-composer__field')
    if (!input || !box || !canHighlight()) return
    this.clearHighlights()
    const field = readField(input)
    const frame = box.getBoundingClientRect()
    const captions: Caption[] = []
    for (const term of this.termsIn(field.text)) {
      const from = locate(field, term.start)
      const to = locate(field, term.end)
      if (!from || !to) continue
      const range = new Range()
      range.setStart(from.node, from.offset)
      range.setEnd(to.node, to.offset)
      const name = term.certain === false ? UNCERTAIN : CERTAIN
      highlight(name).add(range)
      this.#ranges.push({ name, range })
      const first = range.getClientRects()[0]
      if (term.kind && first) {
        captions.push({
          left: Math.round(first.left - frame.left + box.scrollLeft),
          top: Math.round(first.top - frame.top + box.scrollTop),
          kind: term.kind,
          certain: term.certain !== false,
        })
      }
    }
    captions.forEach((caption, index) => {
      const next = captions[index + 1]
      if (next && next.top === caption.top) caption.room = Math.max(0, next.left - caption.left - 4)
    })
    if (JSON.stringify(captions) !== JSON.stringify(this.captions)) this.captions = captions
  }

  private setSendKey(key: ChatSendKey): void {
    this.sendKey = key
    try {
      localStorage.setItem(SEND_KEY_STORE, key)
    } catch {
      /* storage may be blocked */
    }
  }

  private async toggleOptions(open: boolean): Promise<void> {
    this.optionsOpen = open
    await this.updateComplete
    const target = this.renderRoot.querySelector<HTMLElement>(
      open ? '.lintje-chat-composer__options' : '.lintje-chat-composer__options-toggle',
    )
    // The inner `<button>` takes focus, not its host element.
    ;(target?.shadowRoot?.querySelector<HTMLElement>('button') ?? target)?.focus()
  }

  protected override render(): TemplateResult {
    const list = this.suggestions
    const active = Math.min(this.completionIndex, list.length - 1)
    const terms = this.termsIn(this.draft)
    const heard = terms
      .map((term) => {
        const word = this.draft.slice(term.start, term.end)
        const kind = [term.kind, term.certain === false ? 'niet zeker' : ''].filter(Boolean)
        return kind.length ? `${word} (${kind.join(', ')})` : word
      })
      .join(', ')
    return html`<div class="lintje-chat-composer lintje-chat-composer--${this.variant}">
      ${
        list.length
          ? html`<div
            id="completions"
            class="lintje-chat-composer__completions"
            role="listbox"
            aria-label="Aanvullen"
          >
            ${list.map(
              (term, index) => html`<div
                id="completion-${index}"
                class=${classMap({
                  'lintje-chat-composer__completion': true,
                  'is-active': index === active,
                })}
                role="option"
                aria-selected=${String(index === active)}
                @mousedown=${(event: Event) => {
                  event.preventDefault()
                  this.complete(term)
                }}
              >
                <span>${term.label}</span>
                <span class="lintje-chat-composer__completion-kind">${term.kind}</span>
              </div>`,
            )}
          </div>`
          : nothing
      }
      <div class="lintje-chat-composer__frame">
        <div class="lintje-chat-composer__field">
          <div
            class=${classMap({
              'lintje-chat-composer__input': true,
              'is-empty': this.draft === '',
            })}
            contenteditable="plaintext-only"
            role="textbox"
            aria-multiline="true"
            aria-label=${this.variant === 'edit' ? 'Je vraag bewerken' : 'Je vraag'}
            aria-describedby="hint send-key"
            aria-placeholder=${this.placeholder}
            aria-autocomplete=${this.vocabulary?.length ? 'list' : nothing}
            aria-controls=${list.length ? 'completions' : nothing}
            aria-activedescendant=${list.length ? `completion-${active}` : nothing}
            data-placeholder=${this.placeholder}
            @input=${this.onInput}
            @keydown=${this.onKeydown}
            @keyup=${this.read}
            @mouseup=${this.read}
            @paste=${this.onPaste}
          ></div>
          <div class="lintje-chat-composer__captions" aria-hidden="true">
            ${this.captions.map(
              (caption) => html`<span
                class=${classMap({
                  'lintje-chat-composer__caption': true,
                  'is-uncertain': !caption.certain,
                })}
                ${styleProps({
                  left: `${caption.left}px`,
                  top: `${caption.top}px`,
                  maxWidth: caption.room === undefined ? null : `${caption.room}px`,
                })}
                >${caption.kind}</span
              >`,
            )}
          </div>
        </div>
        <span id="send-key" class="visually-hidden"
          >${SEND_KEY_SAID[this.plain ? 'enter' : this.sendKey]}</span
        >
        <span class="visually-hidden" aria-live="polite">${heard ? `Herkend: ${heard}` : ''}</span>
        <div class="lintje-chat-composer__bar">
          ${this.variant === 'edit' ? this.renderEdit() : this.renderAsk()}
        </div>
      </div>
    </div>`
  }

  private renderAsk(): TemplateResult {
    const sources = this.sources ?? []
    const empty = this.draft.trim() === ''
    return html`${
      sources.length
        ? html`<lintje-multiselect
            class="lintje-chat-composer__sources"
            label="Bronnen voor je volgende vraag"
            hide-label
            summary="Bronnen: ${this.selectedIds.length} van ${sources.length}"
            .options=${sources.map((source) => ({
              value: source.id,
              label: source.label,
              description: [source.description, source.asOf].filter(Boolean).join(' · '),
            }))}
            .selected=${this.selectedIds}
            @lintje-change=${(event: CustomEvent<string[]>) => {
              event.stopPropagation()
              this.emit('lintje-sources-change', { ids: event.detail })
            }}
          ></lintje-multiselect>`
        : nothing
    }
      <span id="hint" class="lintje-chat-composer__hint" role="status"
        >${this.noSource ? 'Kies eerst een bron om een vraag te stellen' : ''}</span
      >
      ${
        this.busy
          ? html`<lintje-button
            class="lintje-chat-composer__stop"
            variant="secondary"
            icon="multimedia-player-stop"
            @click=${() => this.emit('lintje-answer-stop', {})}
            >Stoppen</lintje-button
          >`
          : html`<div class="lintje-chat-composer__send">
            ${
              this.#mobile.matches
                ? html`<lintje-icon-button
                  class="lintje-chat-composer__send-half"
                  icon="functioneel-verzenden"
                  label="Versturen"
                  active
                  ?disabled=${empty || this.noSource}
                  @click=${() => this.send()}
                ></lintje-icon-button>`
                : html`<lintje-button
                  variant="primary"
                  icon="functioneel-verzenden"
                  ?disabled=${empty || this.noSource}
                  @click=${() => this.send()}
                  >Versturen</lintje-button
                >`
            }
            ${
              this.plain
                ? nothing
                : html`<lintje-icon-button
                    class="lintje-chat-composer__send-half lintje-chat-composer__options-toggle"
                    icon="functioneel-delta-omlaag"
                    label="Opties bij versturen"
                    ?active=${!(empty || this.noSource)}
                    .expanded=${this.optionsOpen}
                    @click=${() => this.toggleOptions(!this.optionsOpen)}
                  ></lintje-icon-button>
                  ${this.optionsOpen ? this.renderSendOptions() : nothing}`
            }
          </div>`
      }`
  }

  private renderSendOptions(): TemplateResult {
    return html`<span
        class="lintje-chat-composer__scrim"
        @click=${() => this.toggleOptions(false)}
      ></span>
      <div
        class="lintje-chat-composer__options"
        role="dialog"
        aria-label="Opties bij versturen"
        tabindex="-1"
        @keydown=${(event: KeyboardEvent) => {
          if (event.key !== 'Escape') return
          event.stopPropagation()
          void this.toggleOptions(false)
        }}
      >
        <lintje-radio-group
          label="Antwoord als"
          .options=${FORMS}
          value=${this.form}
          @lintje-change=${(event: CustomEvent<ChatAnswerForm>) => {
            event.stopPropagation()
            this.form = event.detail
          }}
        ></lintje-radio-group>
        <lintje-radio-group
          label="Versturen met"
          .options=${SEND_KEYS}
          value=${this.sendKey}
          @lintje-change=${(event: CustomEvent<ChatSendKey>) => {
            event.stopPropagation()
            this.setSendKey(event.detail)
          }}
        ></lintje-radio-group>
        <div class="lintje-chat-composer__shortcuts">
          <span class="lintje-chat-composer__shortcuts-label">Sneltoetsen</span>
          <dl class="lintje-chat-composer__keys">
            <dt class="lintje-chat-composer__key-name">Vorige vraag terughalen</dt>
            <dd class="lintje-chat-composer__key"><kbd class="lintje-key">↑</kbd></dd>
            <dt class="lintje-chat-composer__key-name">Antwoord stoppen</dt>
            <dd class="lintje-chat-composer__key"><kbd class="lintje-key">Esc</kbd></dd>
          </dl>
        </div>
      </div>`
  }

  private renderEdit(): TemplateResult {
    return html`<span id="hint" class="lintje-chat-composer__hint"></span>
      <lintje-button variant="tertiary" size="chrome" @click=${() => this.emitLocal('lintje-cancel')}
        >Annuleren</lintje-button
      >
      <lintje-button
        variant="primary"
        size="chrome"
        ?disabled=${this.draft.trim() === ''}
        @click=${() => this.send()}
        >Opnieuw vragen</lintje-button
      >`
  }
}

define('lintje-chat-composer', LintjeChatComposer)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-chat-composer': LintjeChatComposer
  }
}
