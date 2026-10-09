/**
 * `<lintje-popover>` — the floating panel: a surface fixed to the viewport under its anchor
 * (`.anchor`, or the previous sibling). Content and padding come through the slot.
 *
 * The owner holds `open`: the popover only asks to be closed. Events: `lintje-close`
 * `{ reason: 'escape' | 'outside' }`; a component drawing a popover in its own root stops it.
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { ifDefined } from 'lit/directives/if-defined.js'
import { LintjeElement, define } from '../../core/element'
import { styleProps, type StyleProps } from '../../core/style-props'
import { shadowCss } from '../../core/styles'
import { place, samePlace, viewport, type Place, type Placement } from '../shared/place'
import { holdsFocus, ownsEscape } from '../../core/focus'
import popoverCss from './popover.css?inline'

function spotStyle(spot: Place | null, minWidth: number | null): StyleProps {
  if (!spot) return {}
  return {
    top: spot.top === null ? null : `${spot.top}px`,
    bottom: spot.bottom === null ? null : `${spot.bottom}px`,
    left: `${spot.left}px`,
    'min-width': minWidth === null ? null : `${minWidth}px`,
    '--lintje-popover-space': `${spot.space}px`,
  }
}

export class LintjePopover extends LintjeElement {
  static override styles = shadowCss(popoverCss)

  static override properties: PropertyDeclarations = {
    open: { type: Boolean, reflect: true },
    placement: { type: String },
    label: { type: String },
    panelRole: { type: String, attribute: 'panel-role' },
    matchWidth: { type: Boolean, attribute: 'match-width' },
    anchor: { attribute: false },
    spot: { state: true },
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
  protected spot: Place | null = null

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
    document.addEventListener('keydown', this.onKeydown, true)
    window.addEventListener('scroll', this.onReflow, { capture: true, passive: true })
    window.addEventListener('resize', this.onReflow)
  }

  override disconnectedCallback(): void {
    document.removeEventListener('mousedown', this.onOutsidePress)
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
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    const panel = this.renderRoot.querySelector<HTMLElement>('.lintje-popover')
    const box = { width: panel?.offsetWidth ?? 0, height: panel?.offsetHeight ?? 0 }
    if (this.matchWidth) box.width = Math.max(box.width, rect.width)
    const next = place(rect, box, viewport(), this.placement)
    const width = this.matchWidth ? Math.round(rect.width) : null
    if (samePlace(this.spot, next) && width === this.anchorWidth) return
    this.anchorWidth = width
    this.spot = next
  }

  /** Measures before the first paint, so nothing flashes in the corner. */
  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (!changed.has('open')) return
    if (this.open) this.measure()
    else this.spot = null
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    if (this.open) this.measure()
  }

  protected override render(): TemplateResult | typeof nothing {
    if (!this.open) return nothing
    return html`<div
      class="lintje-popover"
      role=${ifDefined(this.panelRole)}
      aria-label=${ifDefined(this.label)}
      ${styleProps(spotStyle(this.spot, this.anchorWidth))}
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
