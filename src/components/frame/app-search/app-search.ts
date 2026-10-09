/**
 * `<lintje-app-search>` — one search field over everything in an application, opened with `/`.
 *
 * The owner holds `open`, `groups` and `loading`. A dialog on the shared focus-trap stack. The
 * field is a native `<input>`: `aria-controls` and `aria-activedescendant` cannot cross a root.
 *
 * Below 768 px it opens from below as a sheet, with the filter sheet's head — its name and a close
 * button — and the line of keys goes.
 *
 * Events: `lintje-open`, `lintje-search` (the term), `lintje-navigate` `{ href }`, `lintje-action`
 * (the id), `lintje-close` `{ reason: 'escape' | 'scrim' | 'button' | 'choice' }`.
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
import { lockScroll } from '../../../core/host-config'
import { MediaController, MOBILE } from '../../../core/media'
import { registerShortcut } from '../../../core/shortcuts'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import { FocusTrap } from '../../shared/focus-trap'
import { Debounce } from '../../shared/debounce'
import '../../../primitives/spinner/spinner'
import appSearchCss from './app-search.css?inline'
import dialogCloseCss from '../../shared/dialog-close.css?inline'
import keyCss from '../../shared/key.css?inline'
import { isPlainClick } from '../../../core/links'

export interface SearchResult {
  /** What `lintje-action` carries. */
  id: string
  label: string
  /** A fact on the right in the muted colour: a duration, a date. */
  meta?: string
  /** The result is a page: a choice sends `lintje-navigate`. */
  href?: string
}

export interface SearchGroup {
  label: string
  items: SearchResult[]
}

export type AppSearchCloseReason = 'escape' | 'scrim' | 'button' | 'choice'

/** Milliseconds after the last keystroke before `lintje-search` is sent. */
export const SEARCH_DELAY = 200

let instances = 0

/** The label split around the first case-insensitive occurrence of the term; null when absent. */
export function splitMatch(label: string, query: string): [string, string, string] | null {
  const term = query.trim()
  if (!term) return null
  const at = label.toLocaleLowerCase('nl').indexOf(term.toLocaleLowerCase('nl'))
  if (at < 0) return null
  return [label.slice(0, at), label.slice(at, at + term.length), label.slice(at + term.length)]
}

/** What the live region says; while loading the spinner's own status speaks. */
export function resultsMessage(count: number, query: string, loading: boolean): string {
  if (loading) return ''
  if (count === 0) return query.trim() ? `Geen resultaten voor “${query.trim()}”` : ''
  return count === 1 ? '1 resultaat' : `${count} resultaten`
}

export class LintjeAppSearch extends LintjeElement {
  static override styles = [
    iconStyles,
    shadowCss(dialogCloseCss),
    shadowCss(keyCss),
    shadowCss(appSearchCss),
  ]

  static override properties: PropertyDeclarations = {
    open: { type: Boolean, reflect: true },
    label: { type: String },
    query: { type: String },
    loading: { type: Boolean, reflect: true },
    groups: { attribute: false },
    active: { state: true },
  }

  /** The owner's: the element asks to be opened and closed and never does either itself. */
  open: boolean = false
  /** The field's accessible name. */
  label: string = 'Zoeken'
  query: string = ''
  /** The host is answering a search. */
  loading: boolean = false
  groups: SearchGroup[] = []
  /** The chosen row across all groups; -1 is none. */
  protected active: number = -1

  readonly #mobile = new MediaController(this, MOBILE)
  readonly #debounce = new Debounce(this, SEARCH_DELAY)
  readonly #id = `lintje-app-search-${++instances}`
  #unregister: (() => void) | null = null
  #released: (() => void) | null = null
  readonly #trap = new FocusTrap()

  private get results(): SearchResult[] {
    return this.groups.flatMap((group) => group.items)
  }

  private get input(): HTMLInputElement | null {
    return this.renderRoot.querySelector<HTMLInputElement>('.lintje-app-search__input')
  }

  private optionId(index: number): string {
    return `${this.#id}-option-${index}`
  }

  /** Only the dialog on top answers Escape. */
  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.#trap.isTopmost()) this.close('escape')
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.#unregister = registerShortcut({
      keys: '/',
      description: 'Zoeken',
      handler: () => {
        if (!this.open) this.emit('lintje-open')
      },
    })
  }

  override disconnectedCallback(): void {
    this.#unregister?.()
    this.#unregister = null
    this.#release()
    super.disconnectedCallback()
  }

  private close(reason: AppSearchCloseReason): void {
    this.emit('lintje-close', { reason })
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (changed.has('groups') || changed.has('loading')) {
      this.active = !this.loading && this.results.length ? 0 : -1
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    if (this.open && !this.#released) this.#hold()
    else if (!this.open && this.#released) this.#release()
    if ((changed as PropertyValues).has('active') && this.active >= 0) {
      this.renderRoot
        .querySelector(`#${this.optionId(this.active)}`)
        ?.scrollIntoView?.({ block: 'nearest' })
    }
  }

  #hold(): void {
    this.#released = lockScroll()
    document.addEventListener('keydown', this.#onKeyDown)
    const dialog = this.renderRoot.querySelector<HTMLElement>('.lintje-app-search')
    if (dialog) this.#trap.activate(dialog, { focus: this.input ?? true })
  }

  #release(): void {
    if (!this.#released) return
    this.#debounce.cancel()
    document.removeEventListener('keydown', this.#onKeyDown)
    this.#released()
    this.#released = null
    this.#trap.deactivate()
  }

  private onInput(event: Event): void {
    this.query = (event.target as HTMLInputElement).value
    this.#debounce.schedule(() => this.emit('lintje-search', this.query))
  }

  private onFieldKeydown(event: KeyboardEvent): void {
    const count = this.results.length
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        if (count) this.active = (this.active + 1) % count
        return
      case 'ArrowUp':
        event.preventDefault()
        if (count) this.active = (this.active - 1 + count) % count
        return
      case 'Enter': {
        event.preventDefault()
        const item = this.results[this.active]
        if (item && !this.loading) this.choose(item)
        else this.#debounce.flush()
      }
    }
  }

  private choose(item: SearchResult, event?: MouseEvent): void {
    if (item.href) {
      if (event && !isPlainClick(event)) return
      this.followLink(item.href, event)
    } else {
      this.emit('lintje-action', item.id)
    }
    this.close('choice')
  }

  private renderLabel(label: string): TemplateResult {
    const parts = splitMatch(label, this.query)
    if (!parts) return html`${label}`
    return html`${parts[0]}<strong class="lintje-app-search__match">${parts[1]}</strong>${parts[2]}`
  }

  private renderOption(item: SearchResult, index: number): TemplateResult {
    const active = index === this.active
    const classes = classMap({ 'lintje-app-search__option': true, 'is-active': active })
    const content = html`<span class="lintje-app-search__label">${this.renderLabel(item.label)}</span>${
      item.meta ? html`<span class="lintje-app-search__meta">${item.meta}</span>` : nothing
    }`
    const onClick = (event: MouseEvent): void => this.choose(item, event)
    return item.href
      ? html`<a
          id=${this.optionId(index)}
          class=${classes}
          role="option"
          aria-selected=${String(active)}
          tabindex="-1"
          href=${item.href}
          @click=${onClick}
          >${content}</a
        >`
      : html`<div
          id=${this.optionId(index)}
          class=${classes}
          role="option"
          aria-selected=${String(active)}
          @click=${onClick}
        >
          ${content}
        </div>`
  }

  private renderResults(): TemplateResult {
    let index = 0
    const listId = `${this.#id}-list`
    const count = this.results.length
    const term = this.query.trim()
    return html`
      ${
        this.loading
          ? html`<div class="lintje-app-search__busy">
            <lintje-spinner label="Zoeken"></lintje-spinner>
          </div>`
          : !count && term
            ? html`<p class="lintje-app-search__empty">Geen resultaten voor “${term}”</p>`
            : nothing
      }
      <div
        id=${listId}
        class="lintje-app-search__list"
        role="listbox"
        aria-label="Resultaten"
        ?hidden=${this.loading || !count}
      >
        ${this.groups.map((group, position) => {
          if (!group.items.length) return nothing
          const headId = `${this.#id}-group-${position}`
          return html`<div class="lintje-app-search__group" role="group" aria-labelledby=${headId}>
            <div id=${headId} class="lintje-app-search__heading">${group.label}</div>
            ${group.items.map((item) => this.renderOption(item, index++))}
          </div>`
        })}
      </div>
    `
  }

  protected override render(): TemplateResult | typeof nothing {
    if (!this.open) return nothing
    const listId = `${this.#id}-list`
    const count = this.results.length
    const expanded = !this.loading && count > 0
    return html`<div class="lintje-app-search__scrim" @click=${() => this.close('scrim')}>
      <div
        class="lintje-app-search"
        role="dialog"
        aria-modal="true"
        aria-label="Zoeken"
        tabindex="-1"
        @click=${(event: Event) => event.stopPropagation()}
      >
        ${
          this.#mobile.matches
            ? html`<div class="lintje-app-search__header">
                <h2 class="lintje-app-search__title">Zoeken</h2>
                <button
                  type="button"
                  class="lintje-dialog-close lintje-app-search__close"
                  aria-label="Zoeken sluiten"
                  @click=${() => this.close('button')}
                >
                  ${renderIcon('functioneel-kruis', { size: 16 })}
                </button>
              </div>`
            : nothing
        }
        <div class="lintje-app-search__field">
          ${renderIcon('functioneel-zoek', { size: 20, className: 'lintje-app-search__icon' })}
          <input
            class="lintje-app-search__input"
            type="search"
            role="combobox"
            autocomplete="off"
            spellcheck="false"
            aria-label=${this.label}
            aria-autocomplete="list"
            aria-expanded=${String(expanded)}
            aria-controls=${listId}
            aria-activedescendant=${expanded && this.active >= 0 ? this.optionId(this.active) : nothing}
            .value=${this.query}
            @input=${this.onInput}
            @keydown=${this.onFieldKeydown}
          />
        </div>
        <div
          class="lintje-app-search__results"
          ?hidden=${!this.loading && !count && !this.query.trim()}
          @mousedown=${(event: MouseEvent) => event.preventDefault()}
        >
          ${this.renderResults()}
        </div>
        <p class="visually-hidden" aria-live="polite">
          ${resultsMessage(count, this.query, this.loading)}
        </p>
        ${
          // A phone has no arrow keys and no Esc: there the close button stands beside the field.
          this.#mobile.matches
            ? nothing
            : html`<p class="lintje-app-search__keys">
                <span class="lintje-app-search__hint"
                  ><kbd class="lintje-key">↑</kbd><kbd class="lintje-key">↓</kbd> kiezen</span
                >
                <span class="lintje-app-search__hint"><kbd class="lintje-key">Enter</kbd> openen</span>
                <span class="lintje-app-search__hint"><kbd class="lintje-key">Esc</kbd> sluiten</span>
              </p>`
        }
      </div>
    </div>`
  }
}

define('lintje-app-search', LintjeAppSearch)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-app-search': LintjeAppSearch
  }
}
