/**
 * `<lintje-tooltip>` — one short sentence about the element it wraps.
 *
 * It shows 300 ms after the pointer rests and at once on keyboard focus; Escape anywhere hides it.
 * Never the only place for something the reader must know. The text becomes the wrapped element's
 * description.
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { LintjeElement, define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { place, samePlace, stand, viewport, type Place } from '../../shared/place'
import tooltipCss from './tooltip.css?inline'
import bubbleCss from '../../shared/tooltip-bubble.css?inline'

export const TOOLTIP_DELAY = 300
/** How long the bubble waits after the pointer leaves: time to cross the gap onto it. */
export const TOOLTIP_LINGER = 150

export class LintjeTooltip extends LintjeElement {
  static override styles = [shadowCss(tooltipCss), shadowCss(bubbleCss)]

  static override properties: PropertyDeclarations = {
    text: { type: String },
    noDescribe: { type: Boolean, attribute: 'no-describe' },
    placement: { type: String },
    open: { state: true },
  }

  text: string = ''
  /** The text is already the element's accessible name: it is not given as its description too. */
  noDescribe: boolean = false
  /** Above the element, or `left` of it, level with it: for a column of buttons along an edge. */
  placement: 'top' | 'left' = 'top'
  open: boolean = false
  /** Where the bubble stands, written onto it; `null` for a bubble not yet placed. */
  #spot: Place | null = null

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
    const bubble = this.renderRoot.querySelector<HTMLElement>('.lintje-tooltip')
    if (!target || !bubble) return
    const rect = target.getBoundingClientRect()
    const side = this.placement === 'left' ? 'left-center' : 'top-center'
    // A new bubble first stands at its element, so it takes the size it will have there.
    if (!this.#spot) stand(bubble, place(rect, { width: 0, height: 0 }, viewport(), side, 8))
    const box = { width: bubble.offsetWidth, height: bubble.offsetHeight }
    const next = place(rect, box, viewport(), side, 8)
    if (samePlace(this.#spot, next)) return
    stand(bubble, next)
    this.#spot = next
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (changed.has('text') || changed.has('noDescribe')) this.describe()
  }

  // Placed after the render, before the paint: the bubble exists only now. A closed one leaves
  // the DOM, so the next opens unplaced.
  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    if (this.open) this.measure()
    else this.#spot = null
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
      this.open ? html`<span class="lintje-tooltip" role="tooltip">${this.text}</span>` : nothing
    }`
  }
}

define('lintje-tooltip', LintjeTooltip)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-tooltip': LintjeTooltip
  }
}
