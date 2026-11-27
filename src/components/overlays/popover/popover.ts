/**
 * `<lintje-popover>` — the floating panel: a surface fixed to the viewport under its anchor.
 *
 * Content and padding come through the slot. The host holds `open`: the popover only asks to be
 * closed. Its `lintje-close` does not bubble, so a window around it never hears it as its own:
 * whoever opened the popover listens on the popover itself.
 *
 * Events: `lintje-close` `{ reason: 'escape' | 'outside' | 'focus' }`.
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { ifDefined } from 'lit/directives/if-defined.js'
import { LintjeElement, define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { place, samePlace, stand, viewport, type Place, type Placement } from '../../shared/place'
import { holdsFocus, ownsEscape, standsIn } from '../../../core/focus'
import { answerEscape, isFreshEscape, isTopLayer, setLayerOpen } from '../../../core/escape'
import { FrameResizeObserver } from '../../shared/frame-resize-observer'
import popoverCss from './popover.css?inline'

export class LintjePopover extends LintjeElement {
  static override styles = shadowCss(popoverCss)

  static override properties: PropertyDeclarations = {
    open: { type: Boolean, reflect: true },
    placement: { type: String },
    label: { type: String },
    panelRole: { type: String, attribute: 'panel-role' },
    matchWidth: { type: Boolean, attribute: 'match-width' },
    gap: { type: Number },
    anchor: { attribute: false },
    opener: { attribute: false },
  }

  /** The owner's; the popover never opens or closes itself. */
  open: boolean = false
  placement: Placement = 'bottom-start'
  declare label?: string
  /** `dialog`, `menu` or `listbox`, when the slotted content has no role itself. */
  declare panelRole?: string
  matchWidth: boolean = false
  /** The room between the anchor and the panel, in px; 0 sets the panel against it. */
  gap: number = 6
  /** What the panel hangs under; default the previous sibling. */
  declare anchor?: Element | null
  /**
   * The control that opens the panel, where it is not the anchor: a press on it, or the focus it
   * takes, is not outside, so the owner's own toggle closes the panel instead of opening it again.
   */
  declare opener?: Element | null
  /** Where the panel stands, written onto it; `null` for a panel not yet placed. */
  #spot: Place | null = null

  private reflowFrame: number = 0

  private get anchorElement(): Element | null {
    return this.anchor ?? this.previousElementSibling
  }

  /** Whether an event passed through the panel, its anchor or its opener. */
  private fromOwn(path: EventTarget[]): boolean {
    const anchor = this.anchorElement
    return (
      path.includes(this) ||
      (anchor !== null && path.includes(anchor)) ||
      (this.opener != null && path.includes(this.opener))
    )
  }

  private readonly onOutsidePress = (event: MouseEvent): void => {
    if (!this.open) return
    if (this.fromOwn(event.composedPath())) return
    this.emitOwn('lintje-close', { reason: 'outside' })
  }

  /**
   * The focus landing outside the panel and its anchor, also from an anchor whose panel never took
   * it. A focusable box around the popover, where a press that takes no focus lands, is not outside.
   */
  private readonly onFocusIn = (event: FocusEvent): void => {
    if (!this.open) return
    const path = event.composedPath()
    if (this.fromOwn(path)) return
    const next = path[0]
    if (next instanceof Node && standsIn(this, next)) return
    this.emitOwn('lintje-close', { reason: 'focus' })
  }

  /**
   * Capture phase, answered and stopped: Escape closes the popover, not the drawer it stands in,
   * and not when a layer above (a tooltip, a layer opened later) answers it. Unless the focus
   * stands in a modal dialog opened over it: then the key is the dialog's. With the focus inside
   * the panel, a control there answers first (a lifted grip puts its row back).
   */
  private readonly onKeydown = (event: KeyboardEvent): void => {
    if (!this.open || !isFreshEscape(event)) return
    if (!ownsEscape(this) || !isTopLayer(this) || holdsFocus(this)) return
    answerEscape(event)
    event.stopPropagation()
    this.emitOwn('lintje-close', { reason: 'escape' })
  }

  /** What a control inside the panel left of an Escape, before the drawer around it hears it. */
  private readonly onOwnKeydown = (event: KeyboardEvent): void => {
    if (!this.open || !isFreshEscape(event)) return
    answerEscape(event)
    event.stopPropagation()
    this.emitOwn('lintje-close', { reason: 'escape' })
  }

  constructor() {
    super()
    this.addEventListener('keydown', this.onOwnKeydown)
  }

  private readonly onReflow = (): void => {
    if (!this.open || this.reflowFrame) return
    this.reflowFrame = requestAnimationFrame(() => {
      this.reflowFrame = 0
      this.measure()
    })
  }

  override connectedCallback(): void {
    super.connectedCallback()
    if (this.open) setLayerOpen(this, true)
    document.addEventListener('mousedown', this.onOutsidePress)
    document.addEventListener('focusin', this.onFocusIn)
    document.addEventListener('keydown', this.onKeydown, true)
    window.addEventListener('scroll', this.onReflow, { capture: true, passive: true })
    window.addEventListener('resize', this.onReflow)
  }

  override disconnectedCallback(): void {
    document.removeEventListener('mousedown', this.onOutsidePress)
    document.removeEventListener('focusin', this.onFocusIn)
    document.removeEventListener('keydown', this.onKeydown, true)
    window.removeEventListener('scroll', this.onReflow, { capture: true })
    window.removeEventListener('resize', this.onReflow)
    if (this.reflowFrame) cancelAnimationFrame(this.reflowFrame)
    this.reflowFrame = 0
    this.#anchorSize.disconnect()
    setLayerOpen(this, false)
    super.disconnectedCallback()
  }

  private anchorWidth: number | null = null
  /** An anchor that changes size, such as a rail that unfolds, carries its panel along. */
  readonly #anchorSize = new FrameResizeObserver(() => this.onReflow())

  private measure(): void {
    const anchor = this.anchorElement
    const panel = this.renderRoot.querySelector<HTMLElement>('.lintje-popover')
    if (!anchor || !panel) return
    const rect = anchor.getBoundingClientRect()
    const width = this.matchWidth ? Math.round(rect.width) : null
    // A new panel first stands at its anchor, so it takes the size it will have there.
    if (!this.#spot)
      this.#stand(
        panel,
        place(rect, { width: 0, height: 0 }, viewport(), this.placement, this.gap),
        width,
      )
    const box = { width: panel.offsetWidth, height: panel.offsetHeight }
    if (this.matchWidth) box.width = Math.max(box.width, rect.width)
    const next = place(rect, box, viewport(), this.placement, this.gap)
    if (samePlace(this.#spot, next) && width === this.anchorWidth) return
    this.#stand(panel, next, width)
  }

  #stand(panel: HTMLElement, spot: Place, width: number | null): void {
    stand(panel, spot)
    panel.style.setProperty('min-width', width === null ? '' : `${width}px`)
    panel.style.setProperty('--lintje-popover-space', `${spot.space}px`)
    this.#spot = spot
    this.anchorWidth = width
  }

  // Placed after the render, before the paint: the panel exists only now. A closed one leaves
  // the DOM, so the next opens unplaced.
  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    if (changed.has('open')) {
      setLayerOpen(this, this.open)
      this.#anchorSize.disconnect()
      const anchor = this.open ? this.anchorElement : null
      if (anchor) this.#anchorSize.observe(anchor)
    }
    if (this.open) this.measure()
    else this.#spot = null
  }

  protected override render(): TemplateResult | typeof nothing {
    if (!this.open) return nothing
    return html`<div
      class="lintje-popover"
      role=${ifDefined(this.panelRole)}
      aria-label=${ifDefined(this.label)}
    >
      <slot></slot>
    </div>`
  }
}

define('lintje-popover', LintjePopover)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-popover': LintjePopover
  }
}
