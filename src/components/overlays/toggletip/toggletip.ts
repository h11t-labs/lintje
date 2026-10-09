/**
 * `<lintje-toggletip>` — a small "i" button that shows a short explanation on a click.
 *
 * The trigger is a real `<button>` in this root, not a nested `<lintje-icon-button>`, because
 * `aria-controls` cannot point across a shadow boundary. The explanation is a `role="status"`
 * region that is always rendered, empty and `.visually-hidden` while closed: filling a region
 * that already exists is what a screen reader announces. Escape is taken in the capture phase
 * and stopped, so a modal or sheet around it stays open. The popover is fixed to the viewport
 * and placed by `place()`, so a scrolling tile cannot cut it off.
 *
 * Events: `lintje-toggle` (composed, bubbling), detail `{ open }`.
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { styleProps, type StyleProps } from '../../../core/style-props'
import { LintjeElement, define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import { EDGE, place, viewport, type Place } from '../../../primitives/shared/place'
import { ownsEscape } from '../../shared/focus-trap'
import { standsIn } from '../../../core/focus'
import iconButtonCss from '../../../primitives/icon-button/icon-button.css?inline'
import toggletipCss from './toggletip.css?inline'

export type ToggletipPlacement = 'bottom-start' | 'bottom-end'

const GAP = 4

let nextId = 0

export class LintjeToggletip extends LintjeElement {
  static override styles = [iconStyles, shadowCss(iconButtonCss), shadowCss(toggletipCss)]

  static override properties: PropertyDeclarations = {
    label: { type: String },
    placement: { type: String, reflect: true },
    open: { type: Boolean, reflect: true },
    spot: { state: true },
  }

  /** The trigger's accessible name and tooltip. */
  label: string = 'Toelichting'
  placement: ToggletipPlacement = 'bottom-start'
  open: boolean = false
  protected spot: Place | null = null

  private readonly popoverId = `lintje-toggletip-${++nextId}`
  private reflowFrame: number = 0

  private get trigger(): HTMLButtonElement | null {
    return this.renderRoot.querySelector<HTMLButtonElement>('.lintje-toggletip__trigger')
  }

  private setOpen(open: boolean): void {
    if (this.open === open) return
    this.open = open
    this.emit('lintje-toggle', { open })
  }

  private readonly onOutsideClick = (event: MouseEvent): void => {
    if (this.open && !event.composedPath().includes(this)) this.setOpen(false)
  }

  /** Escape works with the focus anywhere: a mouse click in Safari leaves the trigger unfocused. */
  private readonly onEscape = (event: KeyboardEvent): void => {
    if (!this.open || event.key !== 'Escape' || !ownsEscape(this)) return
    event.stopPropagation()
    const inside = event.composedPath().includes(this)
    this.setOpen(false)
    if (inside) this.trigger?.focus()
  }

  // Only a focus that lands elsewhere closes. A press on the bubble's text blurs to nothing, or
  // to a focusable box around the element, such as the shell's main region: neither is
  // elsewhere. A press outside closes in `onOutsideClick`.
  private readonly onFocusout = (event: FocusEvent): void => {
    const next = event.relatedTarget as Node | null
    if (!this.open || !next) return
    if (standsIn(next, this) || standsIn(this, next)) return
    this.setOpen(false)
  }

  private readonly onReflow = (): void => {
    if (!this.open || this.reflowFrame) return
    this.reflowFrame = requestAnimationFrame(() => {
      this.reflowFrame = 0
      this.measure()
    })
  }

  constructor() {
    super()
    this.addEventListener('focusout', this.onFocusout)
  }

  override connectedCallback(): void {
    super.connectedCallback()
    document.addEventListener('mousedown', this.onOutsideClick)
    document.addEventListener('keydown', this.onEscape, true)
    window.addEventListener('scroll', this.onReflow, { capture: true, passive: true })
    window.addEventListener('resize', this.onReflow)
  }

  override disconnectedCallback(): void {
    document.removeEventListener('mousedown', this.onOutsideClick)
    document.removeEventListener('keydown', this.onEscape, true)
    window.removeEventListener('scroll', this.onReflow, { capture: true })
    window.removeEventListener('resize', this.onReflow)
    if (this.reflowFrame) cancelAnimationFrame(this.reflowFrame)
    this.reflowFrame = 0
    super.disconnectedCallback()
  }

  private measure(): void {
    const trigger = this.trigger
    const popover = this.renderRoot.querySelector<HTMLElement>('.lintje-toggletip__popover')
    if (!trigger || !popover) return
    const box = { width: popover.offsetWidth, height: popover.offsetHeight }
    const next = place(trigger.getBoundingClientRect(), box, viewport(), this.placement, GAP)
    const spot = this.spot
    if (spot && spot.top === next.top && spot.bottom === next.bottom && spot.left === next.left)
      return
    this.spot = next
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (changed.has('open') && !this.open) this.spot = null
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (this.open && (changed.has('open') || changed.has('placement'))) this.measure()
  }

  private spotStyle(): StyleProps {
    const spot = this.spot
    // Before the first measurement it stands at the left edge, to take its natural width.
    if (!spot) return { top: null, bottom: null, left: `${EDGE}px` }
    return {
      top: spot.top === null ? null : `${spot.top}px`,
      bottom: spot.bottom === null ? null : `${spot.bottom}px`,
      left: `${spot.left}px`,
    }
  }

  protected override render(): TemplateResult {
    // Without a file for the glyph the label becomes the button's text.
    const glyph = renderIcon('functioneel-info', { size: 16 })
    const asText = glyph === nothing
    return html`<button
        type="button"
        class=${classMap({
          'lintje-icon-button': true,
          'lintje-icon-button--flat': true,
          'lintje-icon-button--text': asText,
          'lintje-toggletip__trigger': true,
        })}
        title=${this.label}
        aria-label=${this.label}
        aria-expanded=${String(this.open)}
        aria-controls=${this.popoverId}
        @click=${() => this.setOpen(!this.open)}
      >
        ${asText ? html`<span class="lintje-icon-button__label">${this.label}</span>` : glyph}
      </button>
      <div
        id=${this.popoverId}
        class=${classMap({
          'lintje-toggletip__popover': true,
          'is-open': this.open,
          'visually-hidden': !this.open,
        })}
        role="status"
        ${styleProps(this.open ? this.spotStyle() : {})}
      >
        ${this.open ? html`<slot></slot>` : nothing}
      </div>`
  }
}

define('lintje-toggletip', LintjeToggletip)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-toggletip': LintjeToggletip
  }
}
