/**
 * `<lintje-transcript>` — a recording's text in fragments, each with its speaker and timecode.
 *
 * `readonly` shows the text only, as a preview beside a running recording does: no editing, no
 * speaker menu and no seeking.
 *
 * Every speaker takes a colour, the same as in the player's waveform: a bar along the fragment,
 * the name beside it says who it is. `layout="chat"` draws each fragment as a message instead of
 * a row; `tinted` lays the speaker's colour under the whole fragment; `grouped` names a speaker
 * once over consecutive fragments, each keeping its own time. The fragment that sounds stands out
 * with a ring. Live, `speakingId` says who speaks now and a fragment's `pending` text is still
 * provisional.
 *
 * Above the fragments stands a row in the same columns: `note-label` beside `note` — the label
 * that a model made the text, and the host's sentence about it — and under it what the host
 * slots in `lead` (the AI work, each in its own expander).
 *
 * A fragment is edited from its pencil or by a double click on its text.
 *
 * Editing and the speakers are the host's state: the element asks, the host changes `segments`,
 * `editingId`, `busyId` and `errors`. It plays, saves and renames nothing itself. The search
 * property is `searchMatches`, not `matches` (that is `Element.matches()`).
 *
 * Events: `lintje-seek` (seconds), `lintje-segment-edit` (id), `lintje-segment-save`
 * `{ id, text }`, `lintje-segment-cancel` (id), `lintje-segment-speaker` `{ id, speaker }` (this
 * fragment to another speaker), `lintje-speaker-new` (id: this fragment to a speaker not named
 * yet), `lintje-speaker-rename` (the name to change everywhere).
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
import { deepActiveElement, holdsFocus } from '../../../core/focus'
import { prefersReducedMotion } from '../../../core/motion'
import { shadowCss } from '../../../core/styles'
import '../../../primitives/button/button'
import '../../../primitives/icon-button/icon-button'
import '../highlight/highlight'
import '../../inputs/textarea/textarea'
import '../../actions/menu-button/menu-button'
import type { LintjeTextarea } from '../../inputs/textarea/textarea'
import type { MenuEntry } from '../../actions/menu-button/menu-button'
import { formatTime, indexAt, speakerColours } from '../audio-player/playback'
import { styleProps } from '../../../core/style-props'
import { badgeStyles, renderBadge, type BadgeTone } from '../../../primitives/badge/badge'
import { iconStyles, renderIcon } from '../../../icons/render'
import transcriptCss from './transcript.css?inline'

export interface TranscriptSegment {
  id: string
  /** When it starts, in seconds. */
  start: number
  speaker: string
  text: string
  /** Character ranges `[from, to)` the recogniser was unsure of. */
  uncertain?: [number, number][]
  /** Words under the timecode: "Actiepunt". */
  tags?: { label: string; tone?: BadgeTone }[]
  /** Live: the tail the recogniser may still change, after `text`. */
  pending?: string
}

export interface TextPart {
  text: string
  uncertain: boolean
}

/** Character ranges `[from, to)` of a host's search hits, per segment id. */
export type TranscriptMatches = Record<string, [number, number][]>

/** The current hit: the segment, and the index into that segment's ranges. */
export interface TranscriptMatch {
  id: string
  index: number
}

/** `match` is the index of the hit the stretch is in, -1 for none. */
export interface MarkedPart extends TextPart {
  match: number
}

export type TranscriptLayout = 'rows' | 'chat'

/** How long a reader's own scroll keeps the transcript from following the recording. */
export const FOLLOW_PAUSE = 5000

const SCROLL_KEYS = new Set(['PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'Home', 'End'])

/**
 * The text cut at the uncertain ranges and at the search hits. A hit keeps its index into
 * `matches`, so the current one can be found; ranges are clamped to the text.
 */
export function markedParts(
  text: string,
  uncertain: readonly [number, number][] = [],
  matches: readonly [number, number][] = [],
): MarkedPart[] {
  const clamp = ([from, to]: readonly [number, number]): [number, number] => [
    Math.max(0, Math.min(from, text.length)),
    Math.max(0, Math.min(to, text.length)),
  ]
  const unsure = uncertain.map(clamp).filter(([from, to]) => to > from)
  const hits = matches.map(clamp)
  const cuts = new Set([0, text.length])
  for (const [from, to] of [...unsure, ...hits]) cuts.add(from).add(to)
  const points = [...cuts].sort((a, b) => a - b)
  const parts: MarkedPart[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i]!
    const to = points[i + 1]!
    if (to <= from) continue
    const isUncertain = unsure.some(([a, b]) => a <= from && to <= b)
    const match = hits.findIndex(([a, b]) => b > a && a <= from && to <= b)
    const last = parts[parts.length - 1]
    if (last && last.uncertain === isUncertain && last.match === match)
      last.text += text.slice(from, to)
    else parts.push({ text: text.slice(from, to), uncertain: isUncertain, match })
  }
  return parts
}

export function shouldFollow(now: number, lastUserScroll: number): boolean {
  return now - lastUserScroll >= FOLLOW_PAUSE
}

/** The speaker menu of one fragment: to whom it belongs, a new speaker, the name everywhere. */
export function speakerMenu(speaker: string, speakers: readonly string[]): MenuEntry[] {
  return [
    { heading: 'Dit fragment toewijzen aan' },
    ...speakers.map((name) => ({
      value: `speaker:${name}`,
      label: name,
      checked: name === speaker,
      radio: true,
    })),
    { value: 'new', label: 'Nieuwe spreker…' },
    'separator',
    { value: 'rename', label: `‘${speaker}’ overal een andere naam geven` },
  ]
}

export class LintjeTranscript extends LintjeElement {
  static override styles = [iconStyles, badgeStyles, shadowCss(transcriptCss)]

  static override properties: PropertyDeclarations = {
    segments: { attribute: false },
    speakers: { attribute: false },
    currentTime: { type: Number, attribute: 'current-time' },
    editingId: { type: String, attribute: 'editing-id' },
    busyId: { type: String, attribute: 'busy-id' },
    errors: { attribute: false },
    searchMatches: { attribute: false },
    currentMatch: { attribute: false },
    readonly: { type: Boolean, reflect: true },
    speakingId: { type: String, attribute: 'speaking-id' },
    size: { type: String, reflect: true },
    layout: { type: String, reflect: true },
    tinted: { type: Boolean, reflect: true },
    grouped: { type: Boolean, reflect: true },
    hasNote: { state: true },
  }

  segments: TranscriptSegment[] = []
  /**
   * Every speaker, in the order of their colours: the menu offers them, and a filtered list keeps
   * its colours. Without it, those in `segments`.
   */
  declare speakers?: string[] | null
  readonly: boolean = false
  /** Live: the segment of who speaks now. */
  declare speakingId?: string | null
  /** `large`: for reading along on a screen in the room. */
  size: 'regular' | 'large' = 'regular'
  /** `chat`: every fragment a message under its speaker, instead of a row. */
  layout: TranscriptLayout = 'rows'
  /** The speaker's colour under the whole fragment, not only in its bar. */
  tinted: boolean = false
  /** A speaker's consecutive fragments under one name. */
  grouped: boolean = false
  /** The recording's position in seconds. */
  declare currentTime?: number | null
  /** The segment in editing; the host sets it after `lintje-segment-edit`. */
  declare editingId?: string | null
  declare busyId?: string | null
  /** A save that failed: the message under the field, per segment id. */
  errors: Record<string, string> = {}
  searchMatches: TranscriptMatches = {}
  /** The hit framed as current; scrolled into view when it changes. */
  declare currentMatch?: TranscriptMatch | null

  protected hasNote: boolean = false

  private lastUserScroll = Number.NEGATIVE_INFINITY
  private followed: string | null = null
  /** The segment whose field had the focus when its save began. */
  private savedFrom: string | null = null

  private get currentIndex(): number {
    if (this.currentTime == null) return -1
    return indexAt(this.segments, this.currentTime)
  }

  private segmentElement(id: string): HTMLElement | null {
    return (
      [...this.renderRoot.querySelectorAll<HTMLElement>('.lintje-transcript__segment')].find(
        (item) => item.dataset.id === id,
      ) ?? null
    )
  }

  private focusInside(element: Element | null | undefined, selector: string): void {
    const target = element as (Element & { updateComplete?: Promise<unknown> }) | null | undefined
    if (!target) return
    void (target.updateComplete ?? Promise.resolve()).then(() =>
      target.shadowRoot?.querySelector<HTMLElement>(selector)?.focus(),
    )
  }

  /** The note's row shows only when the host gave it a sentence. */
  private readonly onNoteChange = (event: Event): void => {
    this.hasNote = (event.target as HTMLSlotElement).assignedNodes({ flatten: true }).length > 0
  }

  private readonly onUserScroll = (): void => {
    this.lastUserScroll = Date.now()
  }

  private readonly onListKeydown = (event: KeyboardEvent): void => {
    if (SCROLL_KEYS.has(event.key)) this.onUserScroll()
  }

  private seek(segment: TranscriptSegment): void {
    this.emit('lintje-seek', segment.start)
  }

  private edit(segment: TranscriptSegment): void {
    this.emit('lintje-segment-edit', segment.id)
  }

  private save(segment: TranscriptSegment): void {
    if (this.busyId === segment.id) return
    const field = this.segmentElement(segment.id)?.querySelector<LintjeTextarea>('lintje-textarea')
    this.emit('lintje-segment-save', { id: segment.id, text: field?.value ?? segment.text })
  }

  private cancel(segment: TranscriptSegment): void {
    if (this.busyId === segment.id) return
    this.emit('lintje-segment-cancel', segment.id)
  }

  private onEditorKeydown(segment: TranscriptSegment, event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault()
      this.cancel(segment)
    } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      this.save(segment)
    }
  }

  /** The menu's own `lintje-action` ends here, as the request it stands for. */
  private onSpeakerAction(segment: TranscriptSegment, event: CustomEvent<string>): void {
    event.stopPropagation()
    const value = String(event.detail)
    if (value.startsWith('speaker:')) {
      const speaker = value.slice('speaker:'.length)
      if (speaker !== segment.speaker) {
        this.emit('lintje-segment-speaker', { id: segment.id, speaker })
      }
    } else if (value === 'new') this.emit('lintje-speaker-new', segment.id)
    else if (value === 'rename') this.emit('lintje-speaker-rename', segment.speaker)
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (changed.has('busyId') && this.busyId) {
      const field = this.segmentElement(this.busyId)?.querySelector('lintje-textarea')
      this.savedFrom = field && holdsFocus(field) ? this.busyId : null
    }
  }

  /**
   * A saving field is natively disabled, which drops its focus to the page: "Opslaan", busy but
   * focusable, holds it meanwhile, and a save that failed gives it back to the field.
   */
  private keepSaveFocus(): void {
    const id = this.savedFrom
    if (!id) return
    const editor = this.segmentElement(id)?.querySelector('.lintje-transcript__editor')
    if (this.busyId === id) {
      // Before the field's own update disables it, so the focus never passes the page.
      editor?.querySelector('lintje-button')?.shadowRoot?.querySelector('button')?.focus()
      return
    }
    this.savedFrom = null
    if (this.editingId !== id || !editor) return
    const active = deepActiveElement()
    if (active && active !== document.body && !holdsFocus(editor)) return
    this.focusInside(editor.querySelector('lintje-textarea'), 'textarea')
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    if (changed.has('busyId')) this.keepSaveFocus()
    if (changed.has('editingId')) {
      const before = changed.get('editingId') as string | null | undefined
      if (this.editingId) {
        this.focusInside(
          this.segmentElement(this.editingId)?.querySelector('lintje-textarea'),
          'textarea',
        )
      } else if (before) {
        this.focusInside(
          this.segmentElement(before)?.querySelector('.lintje-transcript__edit'),
          'button',
        )
      }
    }
    if (changed.has('currentTime') || changed.has('segments')) this.follow()
    if (changed.has('currentMatch') && this.currentMatch) {
      this.renderRoot
        .querySelector<HTMLElement>('lintje-highlight[kind="match"][current]')
        ?.scrollIntoView?.({
          block: 'nearest',
          behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        })
    }
  }

  /**
   * Brings the fragment that sounds into view now, also when the reader scrolled away: after the
   * reader moved the recording's position.
   */
  reveal(): void {
    this.lastUserScroll = Number.NEGATIVE_INFINITY
    const segment = this.segments[this.currentIndex]
    if (!segment) return
    this.followed = segment.id
    void this.updateComplete.then(() =>
      this.segmentElement(segment.id)?.scrollIntoView?.({
        block: 'center',
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      }),
    )
  }

  private follow(): void {
    const segment = this.segments[this.currentIndex]
    if (!segment || segment.id === this.followed) return
    // Not marked as followed until it is: after the reader's 5 s the next tick follows.
    if (this.editingId || !shouldFollow(Date.now(), this.lastUserScroll)) return
    this.followed = segment.id
    this.segmentElement(segment.id)?.scrollIntoView?.({
      block: 'nearest',
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  }

  private renderText(segment: TranscriptSegment): TemplateResult {
    const current = this.currentMatch?.id === segment.id ? this.currentMatch.index : -1
    const parts = markedParts(segment.text, segment.uncertain, this.searchMatches?.[segment.id])
    return html`<p class="lintje-transcript__text">
      ${parts.map((part) => {
        const text = part.uncertain
          ? html`<lintje-highlight kind="uncertain">${part.text}</lintje-highlight>`
          : part.text
        return part.match === -1
          ? text
          : html`<lintje-highlight kind="match" ?current=${part.match === current}
              >${text}</lintje-highlight
            >`
      })}${
        segment.pending
          ? html` <span class="lintje-transcript__pending">${segment.pending}</span
              ><span class="lintje-transcript__caret" aria-hidden="true"></span>`
          : nothing
      }
    </p>`
  }

  private renderEditor(segment: TranscriptSegment): TemplateResult {
    const busy = this.busyId === segment.id
    return html`<div
      class="lintje-transcript__editor"
      @keydown=${(event: KeyboardEvent) => this.onEditorKeydown(segment, event)}
    >
      <lintje-textarea
        label="Tekst van dit fragment"
        hide-label
        rows="1"
        hint="Ctrl+Enter bewaart, Esc annuleert"
        .value=${segment.text}
        ?disabled=${busy}
        error=${this.errors?.[segment.id] || nothing}
      ></lintje-textarea>
      <div class="lintje-transcript__actions">
        <lintje-button
          variant="primary"
          size="compact"
          ?busy=${busy}
          @click=${() => this.save(segment)}
          >Opslaan</lintje-button
        >
        <lintje-button
          variant="link"
          size="compact"
          ?disabled=${busy}
          @click=${() => this.cancel(segment)}
          >Annuleren</lintje-button
        >
      </div>
    </div>`
  }

  private renderSpeaker(segment: TranscriptSegment, speakers: string[]): TemplateResult {
    if (this.readonly) {
      return html`<span class="lintje-transcript__speaker is-static">${segment.speaker}</span>`
    }
    return html`<lintje-menu-button
      class="lintje-transcript__speaker"
      variant="flat"
      label=${segment.speaker}
      accessible-label=${`Spreker: ${segment.speaker}, wisselen`}
      .items=${speakerMenu(segment.speaker, speakers)}
      @lintje-action=${(event: CustomEvent<string>) => this.onSpeakerAction(segment, event)}
    ></lintje-menu-button>`
  }

  private renderTime(segment: TranscriptSegment, isCurrent: boolean): TemplateResult {
    const time = formatTime(segment.start)
    if (this.readonly) {
      return html`<span class="lintje-transcript__time is-static">${time}</span>`
    }
    return html`<button
      type="button"
      class="lintje-transcript__time"
      aria-label=${`Speel af vanaf ${time}`}
      @click=${() => this.seek(segment)}
    >
      ${
        isCurrent
          ? renderIcon('multimedia-player-afspelen', {
              size: 12,
              className: 'lintje-transcript__playing',
            })
          : nothing
      }${time}
    </button>`
  }

  protected override render(): TemplateResult {
    const current = this.currentIndex
    // With `speakers` the colours follow that order, so a speaker keeps its colour when the host
    // shows only some fragments.
    const named = this.speakers?.length
      ? this.speakers.map((speaker) => ({ start: 0, speaker }))
      : null
    const colours = speakerColours(named ?? this.segments)
    const speakers = [...colours.keys()]
    return html`<div class="lintje-transcript">
      <div class=${classMap({ 'lintje-transcript__note': true, 'has-note': this.hasNote })}>
        <div class="lintje-transcript__note-label"><slot name="note-label"></slot></div>
        <div class="lintje-transcript__note-text">
          <slot name="note" @slotchange=${this.onNoteChange}></slot>
        </div>
      </div>
      <slot name="lead"></slot>
      <ol
        class="lintje-transcript__list"
        @wheel=${this.onUserScroll}
        @touchmove=${this.onUserScroll}
        @keydown=${this.onListKeydown}
      >
        ${this.segments.map((segment, index) => {
          const isCurrent = index === current
          const editing = this.editingId === segment.id
          const repeat = this.segments[index - 1]?.speaker === segment.speaker
          const colour = colours.get(segment.speaker)
          return html`<li
            class=${classMap({
              'lintje-transcript__segment': true,
              'is-current': isCurrent,
              'is-editing': editing,
              'is-repeat': repeat,
            })}
            data-id=${segment.id}
            aria-current=${isCurrent ? 'true' : nothing}
            ${styleProps({ '--lintje-speaker': colour ? `var(--color-chart-${colour})` : null })}
          >
            <div class="lintje-transcript__who">
              ${this.renderSpeaker(segment, speakers)}
              ${
                segment.id === this.speakingId
                  ? html`<span class="lintje-transcript__now">spreekt nu</span>`
                  : nothing
              }
            </div>
            <div class="lintje-transcript__when">
              ${this.renderTime(segment, isCurrent)}
              ${(segment.tags ?? []).map((tag) =>
                renderBadge({ value: tag.label, tone: tag.tone ?? 'neutral' }),
              )}
            </div>
            <div
              class="lintje-transcript__body"
              @dblclick=${
                this.readonly || editing
                  ? nothing
                  : (event: MouseEvent) => {
                      // The word the double click selected is no part of the edit.
                      event.preventDefault()
                      getSelection()?.removeAllRanges()
                      this.edit(segment)
                    }
              }
            >
              ${editing ? this.renderEditor(segment) : this.renderText(segment)}
            </div>
            ${
              this.readonly || editing
                ? nothing
                : html`<lintje-icon-button
                    class="lintje-transcript__edit"
                    icon="functioneel-bewerken"
                    label=${`Fragment van ${formatTime(segment.start)} bewerken`}
                    variant="flat"
                    @click=${() => this.edit(segment)}
                  ></lintje-icon-button>`
            }
          </li>`
        })}
      </ol>
    </div>`
  }
}

define('lintje-transcript', LintjeTranscript)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-transcript': LintjeTranscript
  }
}
