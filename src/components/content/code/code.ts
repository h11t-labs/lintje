/**
 * `<lintje-code>` — a block of code or JSON, on `--font-mono`; the host pretty-prints JSON.
 *
 * Scrolls sideways by default because a broken line is a changed line; the block is
 * `tabindex="0"` so the scroll is keyboard reachable (WCAG 2.1.1). `numbered` uses a CSS
 * counter, so a copy of the block is a copy of the code. No syntax colouring.
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { define } from '../../../core/element'
import { LintjeGridItemElement } from '../../../primitives/shared/grid-item-element'
import { shadowCss } from '../../../core/styles'
import codeCss from './code.css?inline'

export class LintjeCode extends LintjeGridItemElement {
  static override styles = shadowCss(codeCss)

  static override properties: PropertyDeclarations = {
    text: { attribute: false },
    language: { type: String, reflect: true },
    numbered: { type: Boolean, reflect: true },
    wrap: { type: Boolean, reflect: true },
    label: { type: String },
  }

  declare text?: string
  /** Shown as the label top right: `json`, `sql`, `python`. */
  declare language?: string
  numbered: boolean = false
  /** Break long lines instead of scrolling the block sideways. */
  wrap: boolean = false
  /** The accessible name of the block. The default names the language. */
  declare label?: string

  private get body(): string {
    return this.text ?? ''
  }

  private get name(): string {
    if (this.label) return this.label
    return this.language ? `Codeblok (${this.language})` : 'Codeblok'
  }

  protected override render(): TemplateResult {
    const lines = this.body.split('\n')
    return html`<div
      class=${classMap({
        'lintje-code': true,
        'lintje-code--numbered': this.numbered,
        'lintje-code--labelled': Boolean(this.language),
      })}
    >
      ${
        this.language
          ? html`<span class="lintje-code__language" aria-hidden="true">${this.language}</span>`
          : nothing
      }
      <pre
        class=${classMap({ 'lintje-code__block': true, 'is-wrapped': this.wrap })}
        role="region"
        tabindex="0"
        aria-label=${this.name}
      ><code>${
        this.numbered
          ? lines.map(
              (line, index) =>
                html`<span class="lintje-code__line"
                  >${index < lines.length - 1 ? `${line}\n` : line}</span
                >`,
            )
          : this.body || html`<slot></slot>`
      }</code></pre>
    </div>`
  }
}

define('lintje-code', LintjeCode)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-code': LintjeCode
  }
}
