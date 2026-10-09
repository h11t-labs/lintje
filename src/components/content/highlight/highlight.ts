/**
 * `<lintje-highlight>` — a marking in running text: low confidence, a glossary term, a search
 * match, or a difference. Each kind draws the element that means it and a line of its own, so
 * colour is never the only carrier. A difference also says what it is in hidden words, since a
 * screen reader does not name `<del>` and `<ins>`. The host wraps the words. Events: none.
 */
import { html, type PropertyDeclarations, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { LintjeElement, define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import '../../../primitives/tooltip/tooltip'
import highlightCss from './highlight.css?inline'

export type HighlightKind = 'uncertain' | 'term' | 'match' | 'added' | 'removed'

/** What a screen reader hears around a `<mark>`. */
const MARKED: Partial<Record<HighlightKind, string>> = {
  uncertain: 'lage zekerheid',
  term: 'term',
  match: 'zoekresultaat',
}

/** What a screen reader hears before a difference, unless the host names the side. */
const DIFFERENCE: Partial<Record<HighlightKind, string>> = {
  removed: 'verwijderd',
  added: 'toegevoegd',
}

export class LintjeHighlight extends LintjeElement {
  static override styles = shadowCss(highlightCss)

  static override properties: PropertyDeclarations = {
    kind: { type: String, reflect: true },
    current: { type: Boolean, reflect: true },
    explanation: { type: String },
    label: { type: String },
  }

  kind: HighlightKind = 'match'
  /** The active search match; only for `match`. */
  current: boolean = false
  /** For a term: the glossary's explanation, in a tooltip. Makes the term a button. */
  declare explanation?: string
  /** For a difference, what the hidden words call it ("jouw versie"); else "verwijderd" or "toegevoegd". */
  declare label?: string

  private get isControl(): boolean {
    return this.kind === 'term' && Boolean(this.explanation)
  }

  private get classes(): ReturnType<typeof classMap> {
    return classMap({
      'lintje-highlight': true,
      [`lintje-highlight--${this.kind}`]: true,
      'lintje-highlight--control': this.isControl,
      'is-current': this.kind === 'match' && this.current,
    })
  }

  protected override render(): TemplateResult {
    const kind = this.kind
    if (kind === 'removed' || kind === 'added') {
      const said = html`<span class="visually-hidden">${this.label || DIFFERENCE[kind]}: </span>`
      return kind === 'removed'
        ? html`<del class=${this.classes}>${said}<slot></slot></del>`
        : html`<ins class=${this.classes}>${said}<slot></slot></ins>`
    }
    if (this.isControl) {
      return html`<lintje-tooltip text=${this.explanation}
        ><button type="button" class=${this.classes}><slot></slot></button
      ></lintje-tooltip>`
    }
    const what =
      kind === 'match' && this.current ? 'huidig zoekresultaat' : (MARKED[kind] ?? 'markering')
    return html`<mark class=${this.classes}
      ><span class="visually-hidden">begin markering ${what}, </span><slot></slot
      ><span class="visually-hidden">, einde markering</span></mark
    >`
  }
}

define('lintje-highlight', LintjeHighlight)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-highlight': LintjeHighlight
  }
}
