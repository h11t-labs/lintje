/**
 * `<lintje-chat-steps>` — what the assistant did for one answer: a series of steps on a rail that
 * folds into one line.
 *
 * The closed line shows what counts now: the running step, else a failed one, else a stopped one,
 * else how many. It never opens or closes by itself; whether it is open is its own state. The
 * labels, states and duration are the host's: it counts nothing and keeps no timer. Steps are
 * only added at the end, and compared by position. Only the first step starting and a failure
 * are spoken, and only once the element has drawn: steps it arrives with stay silent, except a
 * lone first step that has just begun.
 *
 * Events: `lintje-navigate` `{ href }` from a link in a detail (cancel it to route yourself).
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
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import '../../feedback/spinner/spinner'
import { uniqueId } from '../../../core/id'
import disclosureCss from '../../shared/disclosure.css?inline'
import { TONE_ICON } from '../../shared/tone'
import chatStepsCss from './chat-steps.css?inline'
import type { ChatStep } from '../../../types'

type StepState = NonNullable<ChatStep['state']>
type Mark = 'ring' | 'cross' | 'open' | 'square'

const MARK: Record<StepState, Mark> = {
  busy: 'ring',
  error: 'cross',
  cancelled: 'open',
  done: 'square',
}

const stateOf = (step: ChatStep): StepState => step.state ?? 'done'

/** The state in words, after a label that does not say it already: the mark alone is a drawing. */
const STATE_WORD: Partial<Record<Mark, string>> = {
  ring: 'bezig',
  cross: 'mislukt',
  open: 'gestopt',
}

function renderStateWord(label: string, mark: Mark): TemplateResult | typeof nothing {
  const word = STATE_WORD[mark]
  if (!word || label.toLowerCase().includes(word)) return nothing
  return html`<span class="visually-hidden">, ${word}</span>`
}

/** The whole line as `title`, only while it is cut: a line that fits needs no tooltip. */
function titleWhenCut(event: Event, line: string): void {
  const text = event.currentTarget as HTMLElement
  if (text.scrollWidth > text.clientWidth) text.title = line
  else text.removeAttribute('title')
}

export const stepCount = (count: number): string => `${count} ${count === 1 ? 'stap' : 'stappen'}`

/** A sentence for the status region: the label closed with a full stop, then the detail. */
const sentence = (text: string): string => (/[.!?]$/.test(text) ? text : `${text}.`)

/** What the closed line shows: a mark, a label and the muted rest after it. */
export interface StepsSummary {
  mark: Mark
  /** The step that counts now; without one only `rest` stands. */
  label?: string
  failed?: boolean
  rest: string
}

export function summarise(items: ChatStep[], duration?: string): StepsSummary {
  const states = items.map(stateOf)
  const busy = states.lastIndexOf('busy')
  const time = busy < 0 && duration ? duration : ''
  const count = stepCount(items.length)
  if (busy >= 0) {
    return { mark: 'ring', label: items[busy].label, rest: busy > 0 ? `stap ${busy + 1}` : '' }
  }
  const failed = states.indexOf('error')
  if (failed >= 0) {
    const rest = [count, time].filter(Boolean).join(' · ')
    return { mark: 'cross', label: items[failed].label, failed: true, rest }
  }
  const stopped = states.indexOf('cancelled')
  if (stopped >= 0) return { mark: 'open', label: items[stopped].label, rest: count }
  return { mark: 'square', rest: [count, time].filter(Boolean).join(' · ') }
}

export class LintjeChatSteps extends LintjeElement {
  static override styles = [iconStyles, shadowCss(disclosureCss), shadowCss(chatStepsCss)]

  static override properties: PropertyDeclarations = {
    items: { attribute: false },
    duration: { type: String },
    open: { type: Boolean, reflect: true },
    spoken: { state: true },
  }

  items: ChatStep[] = []
  /** How long it took, as the host formats it ("12 s"); not drawn while a step runs. */
  declare duration?: string
  open: boolean = false
  /** What the status region has said, one sentence per paragraph. */
  spoken: string[] = []

  readonly #bodyId = uniqueId('lintje-disclosure')
  /** The states the region last knew, by position; `null` before the first draw. */
  #known: StepState[] | null = null
  #frame = 0

  override disconnectedCallback(): void {
    cancelAnimationFrame(this.#frame)
    this.#frame = 0
    super.disconnectedCallback()
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (!changed.has('items')) return
    const items = this.items ?? []
    const states = items.map(stateOf)
    const known = this.#known
    const news: string[] = []
    const lone = items.length === 1 && states[0] === 'busy'
    if (known === null ? lone : !known.length && states[0] === 'busy') {
      news.push(`Bezig: ${sentence(items[0].label)}`)
    }
    if (known !== null) {
      items.forEach((step, index) => {
        if (states[index] !== 'error' || known[index] === 'error') return
        news.push([sentence(step.label), step.detail].filter(Boolean).join(' '))
      })
    }
    this.#known = states
    // A region filled together with its words is not heard: the words come a frame later.
    if (news.length) {
      this.#frame = requestAnimationFrame(() => {
        this.#frame = 0
        this.spoken = [...this.spoken, ...news]
      })
    }
  }

  private get expandable(): boolean {
    const items = this.items ?? []
    return items.length > 1 || items.some((step) => Boolean(step.detail))
  }

  private renderMark(mark: Mark): TemplateResult {
    const inner =
      mark === 'ring'
        ? html`<lintje-spinner class="lintje-chat-steps__spinner"></lintje-spinner>`
        : mark === 'cross'
          ? renderIcon(TONE_ICON.error, { className: 'lintje-chat-steps__cross' })
          : html`<span class="lintje-chat-steps__square lintje-chat-steps__square--${mark}"></span>`
    return html`<span class="lintje-chat-steps__mark" aria-hidden="true">${inner}</span>`
  }

  private renderDetail(step: ChatStep): TemplateResult | string {
    const { detail = '', href, linkText } = step
    if (!href || !detail) return detail
    const link = (text: string): TemplateResult =>
      html`<a
        class="lintje-chat-steps__link"
        href=${href}
        @click=${(event: MouseEvent) => this.followLink(href, event)}
        >${text}</a
      >`
    const at = linkText ? detail.indexOf(linkText) : -1
    if (!linkText || at < 0) return link(detail)
    return html`${detail.slice(0, at)}${link(linkText)}${detail.slice(at + linkText.length)}`
  }

  private renderStep(step: ChatStep, index: number, last: boolean): TemplateResult {
    const state = stateOf(step)
    const line = step.detail ? `${step.label} · ${step.detail}` : step.label
    return html`<li
      class=${classMap({
        'lintje-chat-steps__step': true,
        [`is-${state}`]: true,
        'is-last': last,
      })}
      data-index=${index}
    >
      <span class="lintje-chat-steps__rail">
        ${this.renderMark(MARK[state])}<span class="lintje-chat-steps__line" aria-hidden="true"></span>
      </span>
      <span
        class="lintje-chat-steps__text"
        @pointerenter=${(event: PointerEvent) => titleWhenCut(event, line)}
        ><span class="lintje-chat-steps__label">${step.label}${renderStateWord(step.label, MARK[state])}</span>${
          step.detail
            ? html`<span class="lintje-chat-steps__detail"> · ${this.renderDetail(step)}</span>`
            : nothing
        }</span
      >
    </li>`
  }

  private renderLine(summary: StepsSummary): TemplateResult {
    return html`${this.renderMark(summary.mark)}<span class="lintje-chat-steps__summary"
      >${
        summary.label
          ? html`<span
              class=${classMap({ 'lintje-chat-steps__now': true, 'is-error': Boolean(summary.failed) })}
              >${summary.label}${renderStateWord(summary.label, summary.mark)}</span
            >`
          : nothing
      }${
        summary.rest
          ? html`<span class="lintje-chat-steps__rest"
              >${summary.label ? ' · ' : ''}${summary.rest}</span
            >`
          : nothing
      }</span
    >`
  }

  protected override render(): TemplateResult {
    const items = this.items ?? []
    const region = html`<div class="visually-hidden" role="status" aria-atomic="false">
      ${this.spoken.map((words) => html`<p>${words}</p>`)}
    </div>`
    if (!items.length) return region
    const busy = items.some((step) => stateOf(step) === 'busy')
    const closed = summarise(items, this.duration)
    if (!this.expandable) {
      const only = items[0]
      const time = !busy && this.duration ? this.duration : ''
      return html`<div class="lintje-chat-steps" aria-live="off">
          <div class="lintje-chat-steps__head">
            ${this.renderLine({
              mark: MARK[stateOf(only)],
              label: only.label,
              failed: stateOf(only) === 'error',
              rest: time,
            })}
          </div>
        </div>
        ${region}`
    }
    // Open, the line above the list says only how many and how long: the list says the rest.
    const line = this.open
      ? {
          mark: busy ? ('ring' as const) : ('square' as const),
          rest: [stepCount(items.length), busy ? '' : (this.duration ?? '')]
            .filter(Boolean)
            .join(' · '),
        }
      : closed
    return html`<div
        class=${classMap({
          'lintje-chat-steps': true,
          'lintje-disclosure': true,
          'is-open': this.open,
        })}
        aria-live="off"
      >
        <button
          type="button"
          class="lintje-chat-steps__head lintje-chat-steps__toggle"
          aria-expanded=${String(this.open)}
          aria-controls=${this.#bodyId}
          @click=${() => (this.open = !this.open)}
        >
          ${this.renderLine(line)}
          ${renderIcon('functioneel-delta-omlaag', {
            className: 'lintje-disclosure__chevron lintje-chat-steps__chevron',
          })}
        </button>
        <div class="lintje-disclosure__body" id=${this.#bodyId}>
          <div class="lintje-disclosure__body-inner">
            <ol class="lintje-chat-steps__list">
              ${items.map((step, index) => this.renderStep(step, index, index === items.length - 1))}
            </ol>
          </div>
        </div>
      </div>
      ${region}`
  }
}

define('lintje-chat-steps', LintjeChatSteps)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-chat-steps': LintjeChatSteps
  }
}
