/**
 * `<lintje-button>` — a button or, with `href`, a link with the same look.
 *
 * `disabled` and `busy` render `aria-disabled="true"`, never the native `disabled`: the button
 * stays in the tab order. A capturing `click` listener on the host swallows the activation, so
 * no host listener and no form sees it. `busy` keeps the variant's colours and the exact width.
 * A disabled or busy link renders no `href` and keeps `role="link"` and `tabindex="0"`.
 * `type="submit"|"reset"` acts on the nearest `<form>` itself: the inner `<button>` has no form
 * owner in a shadow root. ARIA on the host never reaches the inner control, so what a host needs
 * there (`expanded`, `pressed`, `haspopup`, `keyshortcuts`, `accessible-name`, `description`, `invalid`) is a
 * property; focusing the host focuses the inner control.
 */
import { LitElement, html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { LintjeElement, define } from '../../core/element'
import { shadowCss } from '../../core/styles'
import { iconStyles, renderIcon } from '../../icons/render'
import buttonCss from './button.css?inline'

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'link'
  | 'danger'
  | 'danger-secondary'
export type ButtonSize = 'regular' | 'compact' | 'chrome'

const REASON_ID = 'lintje-button-reason'

export class LintjeButton extends LintjeElement {
  static override styles = [iconStyles, shadowCss(buttonCss)]
  static override shadowRootOptions: ShadowRootInit = {
    ...LitElement.shadowRootOptions,
    delegatesFocus: true,
  }

  static override properties: PropertyDeclarations = {
    variant: { type: String, reflect: true },
    size: { type: String, reflect: true },
    icon: { type: String },
    iconRight: { type: String, attribute: 'icon-right' },
    disabled: { type: Boolean, reflect: true },
    busy: { type: Boolean, reflect: true },
    type: { type: String },
    href: { type: String },
    target: { type: String },
    rel: { type: String },
    download: { type: String },
    label: { type: String },
    expanded: { type: Boolean },
    reason: { type: String },
    pressed: { type: Boolean },
    haspopup: { type: String },
    keyshortcuts: { type: String },
    accessibleName: { type: String, attribute: 'accessible-name' },
    description: { type: String },
    invalid: { type: Boolean },
    slotted: { state: true },
  }

  variant: ButtonVariant = 'secondary'
  size: ButtonSize = 'regular'
  declare icon?: string
  declare iconRight?: string
  /** Unavailable: disabled gray and `aria-disabled`, still focusable. */
  disabled: boolean = false
  /** Why it is disabled, read with the button. Say it on the page as well: a mouse does not hear it. */
  declare reason?: string
  busy: boolean = false
  type: 'button' | 'submit' | 'reset' = 'button'
  /** Makes the button an `<a>` with the same look; `type` is then ignored. */
  declare href?: string
  /** The link's browsing context; `_blank` without a `rel` gets `noopener noreferrer`. */
  declare target?: string
  declare rel?: string
  /** The link downloads its target; the value is the suggested file name. */
  declare download?: string
  /** The label for a host that passes a property; slotted children win. */
  declare label?: string
  /** `aria-expanded` on the inner control, for a button that opens something; unset: none. */
  declare expanded?: boolean
  /** `aria-pressed` on the inner button, for a toggle; unset: none. */
  declare pressed?: boolean
  /** `aria-haspopup` on the inner control: `menu`, `dialog`, `listbox`… */
  declare haspopup?: string
  /** `aria-keyshortcuts` on the inner control, e.g. `/`. */
  declare keyshortcuts?: string
  /** The name when the visible label alone does not say enough; it starts with that label. */
  declare accessibleName?: string
  /** Extra description read after the name, e.g. a field's hint or error. */
  declare description?: string
  /** `aria-invalid` on the inner control, for a button that stands for a field. */
  invalid: boolean = false

  /** Whether the slot holds anything. The empty label span is hidden, not removed: removing the
   * `<slot>` could make `slotchange` fire again. */
  slotted: boolean = false

  constructor() {
    super()
    // Capture on the host runs before every listener a host adds.
    this.addEventListener('click', this.refuseWhileUnavailable, { capture: true })
    this.addEventListener('click', this.actOnForm)
  }

  /**
   * A submit or reset button acts on the host's form. A task later, so every listener has seen
   * the click and may have prevented it.
   */
  private actOnForm = (event: Event): void => {
    if (this.disabled || this.busy || this.href !== undefined) return
    const type = this.type
    if (type !== 'submit' && type !== 'reset') return
    setTimeout(() => {
      if (event.defaultPrevented) return
      const form = this.closest('form')
      if (!form) return
      if (type === 'reset') form.reset()
      else if (typeof form.requestSubmit === 'function') form.requestSubmit()
    })
  }

  private refuseWhileUnavailable = (event: Event): void => {
    if (!this.disabled && !this.busy) return
    event.preventDefault()
    event.stopImmediatePropagation()
  }

  private onSlotChange(event: Event): void {
    const nodes = (event.target as HTMLSlotElement).assignedNodes({ flatten: true })
    this.slotted = nodes.some(
      (node) => node.nodeType !== Node.TEXT_NODE || (node.textContent ?? '').trim() !== '',
    )
  }

  protected override render(): TemplateResult {
    const unavailable = this.disabled || this.busy
    const classes = classMap({
      'lintje-button': true,
      [`lintje-button--${this.variant}`]: true,
      [`lintje-button--${this.size}`]: true,
      'is-disabled': this.disabled && !this.busy,
      'is-busy': this.busy,
    })
    const busy = this.busy ? 'true' : nothing
    const disabled = unavailable ? 'true' : nothing
    const why = this.disabled && !this.busy && this.reason ? REASON_ID : nothing
    if (this.href !== undefined) {
      const rel = this.rel ?? (this.target === '_blank' ? 'noopener noreferrer' : undefined)
      return html`<a
        class=${classes}
        href=${unavailable ? nothing : this.href}
        role=${unavailable ? 'link' : nothing}
        tabindex=${unavailable ? '0' : nothing}
        target=${this.target ?? nothing}
        rel=${rel ?? nothing}
        download=${this.download ?? nothing}
        aria-busy=${busy}
        aria-disabled=${disabled}
        aria-describedby=${why}
        aria-label=${this.accessibleName || nothing}
        aria-description=${this.description || nothing}
        aria-keyshortcuts=${this.keyshortcuts || nothing}
        >${this.renderContent()}</a
      >${this.renderReason()}`
    }
    return html`<button
      class=${classes}
      type=${this.type}
      aria-busy=${busy}
      aria-disabled=${disabled}
      aria-describedby=${why}
            aria-expanded=${this.expanded === undefined ? nothing : String(this.expanded)}
      aria-pressed=${this.pressed === undefined ? nothing : String(this.pressed)}
      aria-haspopup=${this.haspopup || nothing}
      aria-keyshortcuts=${this.keyshortcuts || nothing}
      aria-label=${this.accessibleName || nothing}
      aria-description=${this.description || nothing}
      aria-invalid=${this.invalid ? 'true' : nothing}
    >
      ${this.renderContent()}
    </button>${this.renderReason()}`
  }

  private renderReason(): TemplateResult | typeof nothing {
    if (!this.disabled || this.busy || !this.reason) return nothing
    return html`<span id=${REASON_ID} class="visually-hidden">${this.reason}</span>`
  }

  private renderContent(): TemplateResult {
    return html`${this.busy ? html`<span class="lintje-button__busy" aria-hidden="true"></span>` : nothing}
      ${
        this.icon
          ? renderIcon(this.icon, {
              size: this.size === 'regular' ? 18 : 16,
              className: 'lintje-button__icon',
            })
          : nothing
      }
      <span class="lintje-button__label" ?hidden=${!this.slotted && !this.label}
        >${this.label ?? nothing}<slot @slotchange=${this.onSlotChange}></slot
      ></span>
      ${
        this.iconRight
          ? renderIcon(this.iconRight, { size: 16, className: 'lintje-button__icon' })
          : nothing
      }`
  }
}

define('lintje-button', LintjeButton)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-button': LintjeButton
  }
}
