/**
 * `<lintje-prose>` — a block of text on the type scale. `html` wins over `text`, which wins over
 * the slot.
 *
 * The host renders the markdown and sanitises it: `html` is written into the shadow root as it
 * stands, and no sanitiser lives here. Events: none.
 */
import { html, type PropertyDeclarations, type TemplateResult } from 'lit'
import { unsafeHTML } from 'lit/directives/unsafe-html.js'
import { classMap } from 'lit/directives/class-map.js'
import { define } from '../../../core/element'
import { LintjeGridItemElement } from '../../../primitives/shared/grid-item-element'
import { shadowCss } from '../../../core/styles'
import proseCss from './prose.css?inline'

export type ProseTone = 'default' | 'muted'

export class LintjeProse extends LintjeGridItemElement {
  static override styles = shadowCss(proseCss)

  static override properties: PropertyDeclarations = {
    html: { attribute: false },
    text: { type: String },
    tone: { type: String, reflect: true },
  }

  /** Server-rendered, server-sanitised HTML. A property only. */
  declare html?: string
  /** One paragraph. Ignored when `html` is set. */
  declare text?: string
  /** `muted` suits a caption or a source line. */
  tone: ProseTone = 'default'

  protected override render(): TemplateResult {
    const classes = classMap({
      'lintje-prose': true,
      [`lintje-prose--${this.tone}`]: this.tone !== 'default',
    })
    if (this.html) return html`<div class=${classes}>${unsafeHTML(this.html)}</div>`
    if (this.text) return html`<div class=${classes}><p>${this.text}</p></div>`
    return html`<div class=${classes}><slot></slot></div>`
  }
}

define('lintje-prose', LintjeProse)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-prose': LintjeProse
  }
}
