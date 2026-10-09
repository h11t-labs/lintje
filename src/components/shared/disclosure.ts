/**
 * The disclosure shared by `<lintje-expander>` and `<lintje-explainer>` (`disclosure.css`).
 * `DisclosureSettle` times the open transition off the body's own `transition-duration`, not
 * `--dur-collapse`: reduced motion zeroes the token but `tokens/base.css` still gives 80 ms.
 */
import {
  html,
  nothing,
  type ReactiveController,
  type ReactiveControllerHost,
  type TemplateResult,
} from 'lit'
import { renderIcon, renderLeadingIcon } from '../../icons/render'

let sequence = 0

export function nextDisclosureId(): string {
  sequence += 1
  return `lintje-disclosure-${sequence}`
}

export class DisclosureSettle implements ReactiveController {
  /** False while the body is growing; the box clips until then. */
  settled = true

  #host: ReactiveControllerHost
  #timer: ReturnType<typeof setTimeout> | undefined
  #was: boolean | undefined

  constructor(host: ReactiveControllerHost) {
    this.#host = host
    host.addController(this)
  }

  hostDisconnected(): void {
    clearTimeout(this.#timer)
  }

  /** Call from `updated()`. */
  observe(open: boolean, body: HTMLElement | null): void {
    if (open === this.#was) return
    const first = this.#was === undefined
    this.#was = open
    if (first) return
    clearTimeout(this.#timer)
    if (!open) {
      this.#set(false)
      return
    }
    const duration = body ? parseFloat(getComputedStyle(body).transitionDuration) * 1000 : 0
    this.#set(!(duration > 0))
    if (!this.settled) this.#timer = setTimeout(() => this.#set(true), duration)
  }

  #set(value: boolean): void {
    if (this.settled === value) return
    this.settled = value
    this.#host.requestUpdate()
  }
}

export interface DisclosureHeaderOptions {
  bodyId: string
  open: boolean
  /** The title text, drawn inside an `<h3>`. */
  title: unknown
  subtitle?: string
  /** An icon file name. Decorative. */
  icon?: string
  /** The chevron before the title instead of at the end of the row. */
  leading?: boolean
  toggle: () => void
}

/**
 * The heading holds the button, not the reverse: an `<h3>` inside a `<button>` is presentational
 * and reaches no assistive technology. Inside the button only phrasing content.
 */
export function disclosureHeader(options: DisclosureHeaderOptions): TemplateResult {
  const chevron = renderIcon('functioneel-delta-omlaag', {
    size: 16,
    className: 'lintje-disclosure__chevron',
  })
  const { bodyId, open, title, subtitle, icon, leading, toggle } = options
  const plain = !icon && !subtitle
  return html`<h3 class="lintje-disclosure__heading">
    <button
      type="button"
      class="lintje-disclosure__header"
      aria-expanded=${open}
      aria-controls=${bodyId}
      @click=${toggle}
    >
      ${leading ? chevron : nothing}
      <span class="lintje-disclosure__label ${plain ? 'lintje-disclosure__label--plain' : ''}">
        ${renderLeadingIcon(icon, 'lintje-disclosure__icon')}<span class="lintje-disclosure__title"
          >${title}</span
        >
        ${subtitle ? html`<span class="lintje-disclosure__sub">${subtitle}</span>` : nothing}
      </span>
      ${leading ? nothing : chevron}
    </button>
  </h3>`
}

/** The content stays in the DOM; closed it is `visibility: hidden`. */
export function disclosureBody(
  bodyId: string,
  content: unknown,
  contentClass?: string,
): TemplateResult {
  return html`<div class="lintje-disclosure__body" id=${bodyId}>
    <div class="lintje-disclosure__body-inner">
      <div class="lintje-disclosure__content ${contentClass ?? ''}">${content}</div>
    </div>
  </div>`
}
