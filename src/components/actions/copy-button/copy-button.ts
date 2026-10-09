/**
 * `<lintje-copy-button>` — text to the clipboard, with a confirmation.
 *
 * Copies `text`, or the text of the element whose id is in `for` (same root, read on press).
 * Disabled with nothing to copy; a `for` target that appears later enables it. A second copy
 * empties the status first so a screen reader hears it again.
 *
 * Events: `lintje-copy` (detail: the text) after a copy, `lintje-copy-error` (detail: the
 * text) when the browser refused.
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
import '../../../primitives/button/button'
import '../../../primitives/icon-button/icon-button'
import '../../feedback/toast/toast'
import { ANNOUNCE_GAP, COPIED_FOR } from '../../shared/copied'
import copyButtonCss from './copy-button.css?inline'

const LABEL = 'Kopiëren'
const COPIED = 'Gekopieerd'
const FAILED = 'Kopiëren is niet gelukt. Selecteer de tekst en kopieer hem zelf.'

export class LintjeCopyButton extends LintjeElement {
  static override styles = shadowCss(copyButtonCss)

  static override properties: PropertyDeclarations = {
    text: { type: String },
    target: { type: String, attribute: 'for' },
    iconOnly: { type: Boolean, attribute: 'icon-only', reflect: true },
    variant: { type: String },
    size: { type: String },
    disabled: { type: Boolean, reflect: true },
    copied: { state: true },
    failed: { state: true },
    status: { state: true },
  }

  /** The string to copy. */
  declare text?: string
  /** The id of the element whose text is copied, in the same root (the `for` attribute). */
  declare target?: string
  /** The outlined icon button instead of the labelled one. */
  iconOnly: boolean = false
  /** `primary` where copying is the page's goal; `flat` for the icon-only button beside other
   * quiet tools. Without it the labelled button is secondary and the icon-only one outlined. */
  declare variant?: 'primary' | 'flat'
  /** `compact` stands level with 40 px icon buttons. */
  size: 'regular' | 'compact' = 'regular'
  disabled: boolean = false
  copied: boolean = false
  failed: boolean = false
  protected status: string = ''

  private timer: ReturnType<typeof setTimeout> | undefined
  private gap: ReturnType<typeof setTimeout> | undefined
  /** Watches the root for the `for` target while it is missing. */
  private watch: MutationObserver | undefined

  override disconnectedCallback(): void {
    clearTimeout(this.timer)
    clearTimeout(this.gap)
    this.watch?.disconnect()
    this.watch = undefined
    super.disconnectedCallback()
  }

  private get source(): HTMLElement | null {
    if (!this.target) return null
    const root = this.getRootNode() as Document | ShadowRoot
    return root.getElementById?.(this.target) ?? null
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    const missing = Boolean(!this.text && this.target && this.isConnected && !this.source)
    if (missing && !this.watch) {
      this.watch = new MutationObserver(() => {
        if (this.source) this.requestUpdate()
      })
      this.watch.observe(this.getRootNode(), {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['id'],
      })
    } else if (!missing && this.watch) {
      this.watch.disconnect()
      this.watch = undefined
    }
  }

  private resolveText(): string {
    if (this.text) return this.text
    return this.source?.textContent?.trim() ?? ''
  }

  private get unavailable(): boolean {
    return this.disabled || (!this.text && !this.source)
  }

  private async copy(): Promise<void> {
    if (this.unavailable) return
    const text = this.resolveText()
    try {
      if (!text || !navigator.clipboard) throw new Error('no clipboard')
      await navigator.clipboard.writeText(text)
    } catch {
      this.failed = true
      this.emit('lintje-copy-error', text)
      return
    }
    this.failed = false
    this.copied = true
    clearTimeout(this.timer)
    clearTimeout(this.gap)
    this.timer = setTimeout(() => {
      this.copied = false
      this.status = ''
    }, COPIED_FOR)
    if (this.status === COPIED) {
      // The same words again are no change to a live region: empty it, then say them.
      this.status = ''
      this.gap = setTimeout(() => (this.status = COPIED), ANNOUNCE_GAP)
    } else this.status = COPIED
    this.emit('lintje-copy', text)
  }

  private onToastClose(event: Event): void {
    event.stopPropagation()
    this.failed = false
  }

  private renderButton(): TemplateResult {
    const icon = this.copied ? 'functioneel-vinkje' : 'functioneel-kopieren'
    if (this.iconOnly) {
      return html`<lintje-icon-button
        variant=${this.variant === 'flat' ? 'flat' : 'outlined'}
        icon=${icon}
        label=${this.copied ? COPIED : LABEL}
        ?disabled=${this.unavailable}
        @click=${this.copy}
      ></lintje-icon-button>`
    }
    // Both labels share one grid cell, so the width does not change on copy.
    return html`<lintje-button
      variant=${this.variant === 'primary' ? 'primary' : 'secondary'}
      size=${this.size === 'compact' ? 'compact' : 'regular'}
      icon=${icon}
      ?disabled=${this.unavailable}
      @click=${this.copy}
      ><span class="lintje-copy-button__labels"
        ><span
          class=${classMap({ 'lintje-copy-button__label': true, 'is-hidden': this.copied })}
          >${LABEL}</span
        ><span
          class=${classMap({ 'lintje-copy-button__label': true, 'is-hidden': !this.copied })}
          >${COPIED}</span
        ></span
      ></lintje-button
    >`
  }

  protected override render(): TemplateResult {
    return html`${this.renderButton()}<span class="visually-hidden" role="status"
        >${this.status || nothing}</span
      >${
        this.failed
          ? html`<lintje-toast kind="error" @lintje-close=${this.onToastClose}>${FAILED}</lintje-toast>`
          : nothing
      }`
  }
}

define('lintje-copy-button', LintjeCopyButton)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-copy-button': LintjeCopyButton
  }
}
