/**
 * `<lintje-streaming-text>` — text that streams in while the server writes it. Plain text, never
 * HTML; a host wanting prose slots a `<lintje-prose>` once the stream is `done`. A screen reader
 * hears it per sentence from a polite live region; the visible box is `aria-busy` until the end.
 * The host owns the connection and sets `text` and `state`. `variant="plain"` drops the box and
 * takes the type of where it stands, for a surface that frames the text itself.
 *
 * Events: `lintje-stop` ("Stoppen"), `lintje-retry` ("Opnieuw").
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
import { shadowCss } from '../../../core/styles'
import '../../../primitives/button/button'
import type { LintjeButton } from '../../../primitives/button/button'
import '../../../primitives/spinner/spinner'
import { sentenceEnd } from '../../shared/sentence-end'
import streamingTextCss from './streaming-text.css?inline'

export { sentenceEnd }

export type StreamState = 'waiting' | 'streaming' | 'done' | 'stopped' | 'error'

const STOPPED = 'Gestopt'
const BROKEN = 'De verbinding viel weg. De tekst is niet af.'

export class LintjeStreamingText extends LintjeElement {
  static override styles = shadowCss(streamingTextCss)

  static override properties: PropertyDeclarations = {
    text: { type: String },
    state: { type: String, reflect: true },
    message: { type: String },
    label: { type: String },
    variant: { type: String, reflect: true },
    spoken: { state: true },
  }

  text: string = ''
  state: StreamState = 'waiting'
  /** What happened, for `error`. Without it: the connection dropped and the text is not done. */
  declare message?: string
  label: string = 'Bezig met schrijven'
  /** `box` (default): the text in a framed box; `plain`: no box, the type of where it stands. */
  variant: 'box' | 'plain' = 'box'
  spoken: string[] = []

  private said = 0
  /** "Stoppen" had the focus: hand it to "Opnieuw" once that renders. */
  private focusRetry = false

  private get ended(): boolean {
    return this.state === 'done' || this.state === 'stopped' || this.state === 'error'
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    // A stream that ends by itself takes "Stoppen" away as well, also from under the focus.
    if (changed.get('state') === 'streaming' && this.ended) {
      const stop = this.renderRoot.querySelector('.lintje-streaming-text__stop')
      if (stop && holdsFocus(stop)) this.focusRetry = true
    }
    if (!changed.has('text') && !changed.has('state') && !changed.has('message')) return
    const previous = (changed.get('text') as string | undefined) ?? ''
    const fresh =
      (changed.has('text') && !this.text.startsWith(previous)) ||
      (changed.has('state') && this.state === 'waiting')
    const spoken = fresh ? [] : [...this.spoken]
    if (fresh) this.said = 0

    const rest = this.text.slice(this.said)
    const end = this.ended ? rest.length : sentenceEnd(rest)
    if (end > 0) {
      const sentence = rest.slice(0, end).trim()
      if (sentence) spoken.push(sentence)
      this.said += end
    }
    if (changed.has('state') && this.state === 'stopped') spoken.push(STOPPED)
    if ((changed.has('state') || changed.has('message')) && this.state === 'error') {
      spoken.push(this.message || BROKEN)
    }
    if (fresh || spoken.length !== this.spoken.length) this.spoken = spoken
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    if (!this.focusRetry || !this.ended) return
    this.focusRetry = false
    // The button's own root exists one update after this render.
    const retry = this.renderRoot.querySelector<LintjeButton>('.lintje-streaming-text__retry')
    if (retry) {
      void retry.updateComplete.then(() => retry.shadowRoot?.querySelector('button')?.focus())
      return
    }
    // Done offers no button: the finished text takes the focus.
    this.renderRoot.querySelector<HTMLElement>('.lintje-streaming-text__box')?.focus()
  }

  private stop(): void {
    this.focusRetry = true
    this.emit('lintje-stop')
  }

  private renderBox(): TemplateResult | typeof nothing {
    if (this.state === 'waiting') {
      return html`<div
        class="lintje-streaming-text__box lintje-streaming-text__box--waiting"
        role="status"
      >
        <lintje-spinner></lintje-spinner>
        <span class="lintje-streaming-text__waiting">${this.label}</span>
      </div>`
    }
    if (this.state === 'done') {
      return html`<div class="lintje-streaming-text__box" tabindex="-1">
        <slot><span class="lintje-streaming-text__plain">${this.text}</span></slot>
      </div>`
    }
    if (!this.text && this.state !== 'streaming') return nothing
    const streaming = this.state === 'streaming'
    return html`<div class="lintje-streaming-text__box" aria-busy=${streaming ? 'true' : 'false'}
      ><span class="lintje-streaming-text__plain">${this.text}</span>${
        streaming
          ? html`<span class="lintje-streaming-text__caret" aria-hidden="true"></span>`
          : nothing
      }</div
    >`
  }

  private renderFoot(): TemplateResult | typeof nothing {
    if (this.state === 'streaming') {
      return html`<div class="lintje-streaming-text__foot">
        <lintje-button
          class="lintje-streaming-text__stop"
          variant="secondary"
          size="compact"
          @click=${this.stop}
          >Stoppen</lintje-button
        >
      </div>`
    }
    if (this.state !== 'stopped' && this.state !== 'error') return nothing
    const error = this.state === 'error'
    return html`<div class="lintje-streaming-text__foot">
      <span
        class=${classMap({
          'lintje-streaming-text__note': true,
          'lintje-streaming-text__note--error': error,
        })}
        >${error ? this.message || BROKEN : STOPPED}</span
      >
      <lintje-button
        class="lintje-streaming-text__retry"
        variant="link"
        size="compact"
        @click=${() => this.emit('lintje-retry')}
        >Opnieuw</lintje-button
      >
    </div>`
  }

  protected override render(): TemplateResult {
    // `aria-busy` goes on the visible box only: on an ancestor of the live region it would hold
    // back every sentence until the end.
    return html`<div
      class=${classMap({ 'lintje-streaming-text': true, 'lintje-streaming-text--plain': this.variant === 'plain' })}
    >
      ${this.renderBox()} ${this.renderFoot()}
      <div class="visually-hidden" aria-live="polite" aria-atomic="false">
        ${this.spoken.map((sentence) => html`<p>${sentence}</p>`)}
      </div>
    </div>`
  }
}

define('lintje-streaming-text', LintjeStreamingText)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-streaming-text': LintjeStreamingText
  }
}
