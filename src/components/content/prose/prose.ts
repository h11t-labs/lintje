/**
 * `<lintje-prose>` — a block of text on the type scale: `html`, else `text`, else the slot.
 *
 * `html` is for formatted content: the host renders the markdown and sanitises it, and it is
 * written into the shadow root as it stands. `text` is one paragraph. The slot is for plain text
 * only, in the block's font and colour: a heading, list or paragraph in it gets no styling.
 */
import { html, type PropertyDeclarations, type PropertyValues, type TemplateResult } from 'lit'
import { unsafeHTML } from 'lit/directives/unsafe-html.js'
import { classMap } from 'lit/directives/class-map.js'
import { define } from '../../../core/element'
import { LintjeGridItemElement } from '../../shared/grid-item-element'
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

  /** Formatted content: server-rendered, server-sanitised HTML. A property only. */
  declare html?: string
  /** One paragraph. Ignored when `html` is set. */
  declare text?: string
  /** `muted` suits a caption or a source line. */
  tone: ProseTone = 'default'

  // A block of the host's code scrolls sideways, and Safari gives a scroller no Tab stop of its
  // own: each takes one, named as lintje-code names its block (WCAG 2.1.1).
  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    for (const block of this.renderRoot.querySelectorAll('pre')) {
      block.tabIndex = 0
      block.setAttribute('role', 'region')
      block.setAttribute('aria-label', 'Codeblok')
    }
  }

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
