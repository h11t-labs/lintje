/**
 * `<lintje-language-nav>` — the choice of language: a button with the current language and a
 * chevron, and the languages in a popover under it, the current one filled in the primary.
 *
 * The host holds `current`: a choice goes out as `lintje-language-change`, and a language with an
 * `href` is followed as a link, so a page per language works without script. In `lintje-shell` it
 * goes in the `end` slot, at the end of the bar.
 *
 * Events: `lintje-language-change` `{ code }`, `lintje-navigate` `{ href }` (a language with an
 * `href`).
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { LintjeElement, define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import { isPlainClick } from '../../../core/links'
import { standsIn } from '../../../core/focus'
import { uniqueId } from '../../../core/id'
import '../../overlays/popover/popover'
import menuCss from '../../shared/menu.css?inline'
import languageNavCss from './language-nav.css?inline'

export interface Language {
  /** The BCP 47 tag, `nl` or `en`: what `lintje-language-change` carries and the row's `lang`. */
  code: string
  /** The language's name in that language: "Nederlands", "English". */
  label: string
  /** The same page in that language; the row is then a link. */
  href?: string
}

export class LintjeLanguageNav extends LintjeElement {
  static override styles = [iconStyles, shadowCss(menuCss), shadowCss(languageNavCss)]

  static override properties: PropertyDeclarations = {
    languages: { attribute: false },
    current: { type: String },
    label: { type: String },
    open: { type: Boolean, reflect: true },
  }

  languages: Language[] = []
  /** The code of the language the page is in. */
  current: string = ''
  /** The name of the choice for a screen reader, before the current language. */
  label: string = 'Taal'
  open: boolean = false

  readonly #menuId = uniqueId('lintje-language-nav')

  private get trigger(): HTMLButtonElement | null {
    return this.renderRoot.querySelector<HTMLButtonElement>('.lintje-language-nav__button')
  }

  private rowElements(): HTMLElement[] {
    return [...this.renderRoot.querySelectorAll<HTMLElement>('.lintje-language-nav__row')]
  }

  private show(first: boolean): void {
    this.open = true
    void this.updateComplete.then(() => {
      const popover = this.renderRoot.querySelector('lintje-popover')
      void (popover?.updateComplete ?? Promise.resolve()).then(() => {
        const rows = this.rowElements()
        ;(first ? rows[0] : rows[rows.length - 1])?.focus()
      })
    })
  }

  private hide(returnFocus: boolean): void {
    this.open = false
    if (returnFocus) this.trigger?.focus()
  }

  // The focus leaving the element closes the list; a press that takes no focus is not leaving.
  private readonly onFocusOut = (event: FocusEvent): void => {
    const next = event.relatedTarget as Node | null
    if (!this.open || !next || standsIn(next, this) || standsIn(this, next)) return
    this.hide(false)
  }

  constructor() {
    super()
    this.addEventListener('focusout', this.onFocusOut)
  }

  private onTriggerKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      this.show(event.key === 'ArrowDown')
    }
  }

  private onListKeydown(event: KeyboardEvent): void {
    const rows = this.rowElements()
    const current = rows.findIndex((row) => row === this.shadowRoot?.activeElement)
    const count = rows.length
    const to = (index: number): void => {
      event.preventDefault()
      rows[((index % count) + count) % count]?.focus()
    }
    switch (event.key) {
      case 'ArrowDown':
        return to(current + 1)
      case 'ArrowUp':
        return to(current - 1)
      case 'Home':
        return to(0)
      case 'End':
        return to(count - 1)
      case 'Tab':
        // Tab goes on from the button, past the list that stands after it.
        if (!event.shiftKey) this.trigger?.focus()
        this.hide(false)
    }
  }

  private choose(language: Language, event: MouseEvent): void {
    this.hide(true)
    this.emit('lintje-language-change', { code: language.code })
    if (language.href && isPlainClick(event)) this.followLink(language.href, event)
  }

  private renderRow(language: Language): TemplateResult {
    const current = language.code === this.current
    const classes = classMap({
      'lintje-menu__row': true,
      'lintje-language-nav__row': true,
      'focus-inset': true,
      'is-current': current,
    })
    const content = html`<span class="lintje-menu__label">${language.label}</span>`
    const row = language.href
      ? html`<a
          class=${classes}
          role="menuitemradio"
          tabindex="-1"
          lang=${language.code}
          aria-checked=${String(current)}
          href=${language.href}
          @click=${(event: MouseEvent) => this.choose(language, event)}
          >${content}</a
        >`
      : html`<button
          type="button"
          class=${classes}
          role="menuitemradio"
          tabindex="-1"
          lang=${language.code}
          aria-checked=${String(current)}
          @click=${(event: MouseEvent) => this.choose(language, event)}
        >
          ${content}
        </button>`
    return html`<li role="none">${row}</li>`
  }

  protected override render(): TemplateResult | typeof nothing {
    const current = this.languages.find((language) => language.code === this.current)
    if (!current) return nothing
    return html`<div class="lintje-language-nav">
      <button
        type="button"
        class=${classMap({ 'lintje-language-nav__button': true, 'is-open': this.open })}
        lang=${current.code}
        aria-label=${`${this.label}: ${current.label}`}
        aria-haspopup="menu"
        aria-expanded=${String(this.open)}
        aria-controls=${this.#menuId}
        @click=${() => (this.open ? this.hide(false) : this.show(true))}
        @keydown=${this.onTriggerKeydown}
      >
        <span class="lintje-language-nav__current">${current.label}</span>
        ${renderIcon('functioneel-delta-omlaag', {
          size: 16,
          className: 'lintje-language-nav__chevron',
        })}
      </button>
      <lintje-popover
        id=${this.#menuId}
        placement="bottom-end"
        ?open=${this.open}
        @lintje-close=${(event: CustomEvent<{ reason: string }>) => {
          event.stopPropagation()
          this.hide(event.detail?.reason === 'escape')
        }}
      >
        <ul class="lintje-menu" role="menu" aria-label=${this.label} @keydown=${this.onListKeydown}>
          ${this.languages.map((language) => this.renderRow(language))}
        </ul>
      </lintje-popover>
    </div>`
  }
}

define('lintje-language-nav', LintjeLanguageNav)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-language-nav': LintjeLanguageNav
  }
}
