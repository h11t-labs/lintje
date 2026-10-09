/**
 * `<lintje-tooltip>` — one short sentence about the element it wraps. Shows 300 ms after the
 * pointer rests, at once on keyboard focus; the pointer can move onto it, and Escape anywhere
 * hides it. Never the only place for something
 * the reader must know. The text is the wrapped element's description; `no-describe` leaves
 * that out when it is already its name.
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { LintjeElement, define } from '../../core/element'
import { styleProps, type StyleProps } from '../../core/style-props'
import { shadowCss } from '../../core/styles'
import { place, samePlace, viewport, type Place } from '../shared/place'
import tooltipCss from './tooltip.css?inline'

export const TOOLTIP_DELAY = 300
/** How long the bubble waits after the pointer leaves: time to cross the gap onto it. */
export const TOOLTIP_LINGER = 150

function spotStyle(spot: Place | null): StyleProps {
  if (!spot) return {}
  return {
    top: spot.top === null ? null : `${spot.top}px`,
    bottom: spot.bottom === null ? null : `${spot.bottom}px`,
    left: `${spot.left}px`,
  }
}

export class LintjeTooltip extends LintjeElement {
  static override styles = shadowCss(tooltipCss)

  static override properties: PropertyDeclarations = {
    text: { type: String },
    noDescribe: { type: Boolean, attribute: 'no-describe' },
    open: { state: true },
    spot: { state: true },
  }

  text: string = ''
  /** The text is already the element's accessible name. */
  noDescribe: boolean = false
  open: boolean = false
  protected spot: Place | null = null

  private timer: ReturnType<typeof setTimeout> | undefined
  private reflowFrame: number = 0
  /** The description this tooltip gave a `description` property, so it takes back only its own. */
  #described = ''

  private get target(): Element | null {
    return this.firstElementChild
  }

  private show(delay: number): void {
    clearTimeout(this.timer)
    if (!this.text) return
    if (!delay) {
      this.open = true
      return
    }
    this.timer = setTimeout(() => (this.open = true), delay)
  }

  private hide(): void {
    clearTimeout(this.timer)
    this.open = false
  }

  /** The bubble stands in the shadow root, so the pointer on it is still inside the host. */
  private readonly onPointerEnter = (): void => {
    if (this.open) clearTimeout(this.timer)
    else this.show(TOOLTIP_DELAY)
  }
  private readonly onPointerLeave = (): void => {
    clearTimeout(this.timer)
    if (this.open) this.timer = setTimeout(() => (this.open = false), TOOLTIP_LINGER)
  }
  private readonly onFocusIn = (): void => this.show(0)
  private readonly onFocusOut = (): void => this.hide()
  /** On the document: a tooltip opened by the pointer is dismissed wherever the focus is. */
  private readonly onKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.open) this.hide()
  }
  /** Fixed to the viewport, so it is placed again when what holds its element scrolls. */
  private readonly onReflow = (): void => {
    if (!this.open || this.reflowFrame) return
    this.reflowFrame = requestAnimationFrame(() => {
      this.reflowFrame = 0
      this.measure()
    })
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.addEventListener('mouseenter', this.onPointerEnter)
    this.addEventListener('mouseleave', this.onPointerLeave)
    this.addEventListener('focusin', this.onFocusIn)
    this.addEventListener('focusout', this.onFocusOut)
    document.addEventListener('keydown', this.onKeydown, true)
    window.addEventListener('scroll', this.onReflow, { capture: true, passive: true })
    window.addEventListener('resize', this.onReflow)
  }

  override disconnectedCallback(): void {
    this.removeEventListener('mouseenter', this.onPointerEnter)
    this.removeEventListener('mouseleave', this.onPointerLeave)
    this.removeEventListener('focusin', this.onFocusIn)
    this.removeEventListener('focusout', this.onFocusOut)
    document.removeEventListener('keydown', this.onKeydown, true)
    window.removeEventListener('scroll', this.onReflow, { capture: true })
    window.removeEventListener('resize', this.onReflow)
    if (this.reflowFrame) cancelAnimationFrame(this.reflowFrame)
    this.reflowFrame = 0
    clearTimeout(this.timer)
    super.disconnectedCallback()
  }

  private measure(): void {
    const target = this.target
    if (!target) return
    const bubble = this.renderRoot.querySelector<HTMLElement>('.lintje-tooltip')
    const box = { width: bubble?.offsetWidth ?? 0, height: bubble?.offsetHeight ?? 0 }
    const next = place(target.getBoundingClientRect(), box, viewport(), 'top-center', 8)
    if (!samePlace(this.spot, next)) this.spot = next
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (changed.has('text') || changed.has('noDescribe')) this.describe()
    if (!changed.has('open')) return
    if (this.open) this.measure()
    else this.spot = null
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    if (this.open) this.measure()
  }

  /**
   * An id cannot cross a shadow root, so the description goes on the element as text. An element
   * with a `description` property (`lintje-button`, `lintje-icon-button`) is a host around its
   * control: the property carries it to that control, where a screen reader reads it.
   */
  private describe(): void {
    const target = this.target
    if (!target) return
    const name = target.localName
    if (name.includes('-') && !customElements.get(name)) {
      void customElements.whenDefined(name).then(() => this.describe())
    }
    const text = this.noDescribe ? '' : this.text
    if ('description' in target) {
      target.removeAttribute('aria-description')
      const host = target as Element & { description?: string }
      if (text) host.description = text
      else if (host.description === this.#described) host.description = undefined
      this.#described = text
    } else if (text) target.setAttribute('aria-description', text)
    else target.removeAttribute('aria-description')
  }

  protected override render(): TemplateResult {
    return html`<slot @slotchange=${this.describe}></slot>${
      this.open
        ? html`<span class="lintje-tooltip" role="tooltip" ${styleProps(spotStyle(this.spot))}
            >${this.text}</span
          >`
        : nothing
    }`
  }
}

define('lintje-tooltip', LintjeTooltip)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-tooltip': LintjeTooltip
  }
}
