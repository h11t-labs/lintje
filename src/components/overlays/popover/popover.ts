/**
 * `<lintje-popover>` — the floating panel: a surface fixed to the viewport under its anchor.
 *
 * Content and padding come through the slot. The host holds `open`: the popover only asks to be
 * closed. A component that draws a popover in its own root stops its `lintje-close`.
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
import popoverCss from './popover.css?inline'

export class LintjePopover extends LintjeElement {
  static override styles = shadowCss(popoverCss)

  static override properties: PropertyDeclarations = {
    open: { type: Boolean, reflect: true },
    placement: { type: String },
    label: { type: String },
    panelRole: { type: String, attribute: 'panel-role' },
    matchWidth: { type: Boolean, attribute: 'match-width' },
    anchor: { attribute: false },
  }

  /** The owner's; the popover never opens or closes itself. */
  open: boolean = false
  placement: Placement = 'bottom-start'
  declare label?: string
  /** `dialog`, `menu` or `listbox`, when the slotted content has no role itself. */
  declare panelRole?: string
  matchWidth: boolean = false
  /** What the panel hangs under; default the previous sibling. */
  declare anchor?: Element | null
  /** Where the panel stands, written onto it; `null` for a panel not yet placed. */
  #spot: Place | null = null

  private reflowFrame: number = 0

  private get anchorElement(): Element | null {
    return this.anchor ?? this.previousElementSibling
  }

  private readonly onOutsidePress = (event: MouseEvent): void => {
    if (!this.open) return
    const path = event.composedPath()
    const anchor = this.anchorElement
    if (path.includes(this) || (anchor && path.includes(anchor))) return
    this.emit('lintje-close', { reason: 'outside' })
  }

  /**
   * The focus landing outside the panel and its anchor, also from an anchor whose panel never took
   * it. A focusable box around the popover, where a press that takes no focus lands, is not outside.
   */
  private readonly onFocusIn = (event: FocusEvent): void => {
    if (!this.open) return
    const path = event.composedPath()
    const anchor = this.anchorElement
    if (path.includes(this) || (anchor && path.includes(anchor))) return
    const next = path[0]
    if (next instanceof Node && standsIn(this, next)) return
    this.emit('lintje-close', { reason: 'focus' })
  }

  /**
   * Capture phase and stopped: Escape closes the popover, not the drawer it stands in. Unless
   * the focus stands in a modal dialog opened over it: then the key is the dialog's. With the
   * focus inside the panel, a control there answers first (a lifted grip puts its row back).
   */
  private readonly onKeydown = (event: KeyboardEvent): void => {
    if (!this.open || event.key !== 'Escape' || !ownsEscape(this) || holdsFocus(this)) return
    event.stopPropagation()
    this.emit('lintje-close', { reason: 'escape' })
  }

  /** What a control inside the panel left of an Escape, before the drawer around it hears it. */
  private readonly onOwnKeydown = (event: KeyboardEvent): void => {
    if (!this.open || event.key !== 'Escape' || event.defaultPrevented) return
    event.stopPropagation()
    this.emit('lintje-close', { reason: 'escape' })
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
    super.disconnectedCallback()
  }

  private anchorWidth: number | null = null

  private measure(): void {
    const anchor = this.anchorElement
    const panel = this.renderRoot.querySelector<HTMLElement>('.lintje-popover')
    if (!anchor || !panel) return
    const rect = anchor.getBoundingClientRect()
    const width = this.matchWidth ? Math.round(rect.width) : null
    // A new panel first stands at its anchor, so it takes the size it will have there.
    if (!this.#spot)
      this.#stand(panel, place(rect, { width: 0, height: 0 }, viewport(), this.placement), width)
    const box = { width: panel.offsetWidth, height: panel.offsetHeight }
    if (this.matchWidth) box.width = Math.max(box.width, rect.width)
    const next = place(rect, box, viewport(), this.placement)
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
