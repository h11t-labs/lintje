/**
 * `<lintje-icon-button>` — a square button with one icon, or its Dutch label as text when the
 * icon has no file. `disabled` renders `aria-disabled="true"` and a capturing `click` listener
 * swallows the activation, so the button stays focusable but no host listener sees it.
 * `live` is for what listens or speaks now (dictating, reading aloud): the primary fill and
 * moving bars beside the icon; the host still sets `pressed` and the label that stops it.
 */
import { html, nothing, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { LintjeElement, define } from '../../core/element'
import { shadowCss } from '../../core/styles'
import { iconStyles, renderIcon } from '../../icons/render'
import iconButtonCss from './icon-button.css?inline'

export type IconButtonVariant = 'flat' | 'outlined' | 'tile'

export class LintjeIconButton extends LintjeElement {
  static override styles = [iconStyles, shadowCss(iconButtonCss)]

  static override properties = {
    icon: { type: String },
    label: { type: String },
    variant: { type: String, reflect: true },
    active: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    size: { type: Number },
    pressed: { type: Boolean },
    expanded: { type: Boolean },
    description: { type: String },
    live: { type: Boolean, reflect: true },
  }

  declare icon?: string
  /** The accessible name and the tooltip. Required: the button has no text. */
  label: string = ''
  /** Accepted for hosts that set it; the box is always `--h-icon-button`. */
  size: 28 | 32 | 36 | 40 | 44 = 32
  variant: IconButtonVariant = 'outlined'
  active: boolean = false
  disabled: boolean = false
  declare pressed?: boolean
  declare expanded?: boolean
  /** Extra description read after the name; a wrapping `lintje-tooltip` sets its text here. */
  declare description?: string
  /** It listens or speaks now: the primary fill, with moving bars beside the icon. */
  live: boolean = false

  constructor() {
    super()
    this.addEventListener('click', this.refuseWhileDisabled, { capture: true })
  }

  private refuseWhileDisabled = (event: Event): void => {
    if (!this.disabled) return
    event.preventDefault()
    event.stopImmediatePropagation()
  }

  protected override render(): TemplateResult {
    // 16 px keeps filled house icons from reading too heavily.
    const glyph = this.icon ? renderIcon(this.icon, { size: 16 }) : nothing
    // No file with that name (yet): the label becomes the text; a button needs one of the two.
    const asText = Boolean(this.icon) && glyph === nothing
    return html`<button
      class=${classMap({
        'lintje-icon-button': true,
        [`lintje-icon-button--${this.variant}`]: true,
        'lintje-icon-button--text': asText,
        'is-active': this.active,
        'is-live': this.live && !asText,
        'is-disabled': this.disabled,
      })}
      type="button"
      title=${this.label}
      aria-label=${this.label}
      aria-pressed=${this.pressed === undefined ? nothing : String(this.pressed)}
      aria-expanded=${this.expanded === undefined ? nothing : String(this.expanded)}
      aria-description=${this.description || nothing}
      aria-disabled=${this.disabled ? 'true' : nothing}
    >
      ${asText ? html`<span class="lintje-icon-button__label">${this.label}</span>` : glyph}
      ${
        this.live && !asText
          ? html`<span class="lintje-icon-button__waves" aria-hidden="true"
              >${[0, 1, 2, 3].map(() => html`<span class="lintje-icon-button__wave"></span>`)}</span
            >`
          : nothing
      }
    </button>`
  }
}

define('lintje-icon-button', LintjeIconButton)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-icon-button': LintjeIconButton
  }
}
