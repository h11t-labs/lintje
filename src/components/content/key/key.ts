/**
 * `<lintje-key>` — one keyboard key on the page, drawn as Lintje draws a key inside its own
 * elements: `<lintje-key>Ctrl</lintje-key>`.
 *
 * A combination is two keys side by side, with a space between them. It reads as the key's text,
 * is no button and takes no focus.
 */
import { html, type PropertyDeclarations, type TemplateResult } from 'lit'
import { LintjeElement, define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import sharedKeyCss from '../../shared/key.css?inline'
import keyCss from './key.css?inline'

export class LintjeKey extends LintjeElement {
  static override styles = [shadowCss(keyCss), shadowCss(sharedKeyCss)]

  static override properties: PropertyDeclarations = {
    key: { type: String },
  }

  /** The key's text, for a host that sets it rather than writing it inside; the content wins. */
  declare key?: string

  protected override render(): TemplateResult {
    return html`<kbd class="lintje-key"><slot>${this.key}</slot></kbd>`
  }
}

define('lintje-key', LintjeKey)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-key': LintjeKey
  }
}
