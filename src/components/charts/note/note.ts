/** `<lintje-note>` — the analyst's note ("Toelichting analist"). Events: none. */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { define, type FrameSettings } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { LintjeGridItemElement, spanStyles } from '../../../primitives/shared/grid-item-element'
import noteCss from './note.css?inline'
import type { NoteData } from '../../../types'

export class LintjeNote extends LintjeGridItemElement {
  static override styles = [spanStyles, shadowCss(noteCss)]

  static override properties: PropertyDeclarations = {
    data: { attribute: false },
  }

  declare data?: NoteData | null

  protected override get dataSettings(): FrameSettings | undefined {
    return this.data ?? undefined
  }

  protected override render(): TemplateResult | typeof nothing {
    const data = this.data
    if (!data) return nothing
    return html`<section class="lintje-note">
      <header class="lintje-note__header">
        <h3 class="lintje-note__title">${data.title ?? 'Toelichting analist'}</h3>
        <span class="lintje-note__date">${data.date}</span>
      </header>
      <p class="lintje-note__text">${data.text}</p>
      <p class="lintje-note__author">— ${data.author}</p>
    </section>`
  }
}

define('lintje-note', LintjeNote)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-note': LintjeNote
  }
}
