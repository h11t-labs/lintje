/**
 * `<lintje-chat-strip>` — the strip under an answer's text: what the answer assumed, as
 * label/value pairs, and how it was calculated.
 *
 * A fixed value is plain text; one with `options` is a native `<select>` drawn as a term (the
 * browser's own list and phone picker); one with `pressed` is a suggestion. The strip keeps only
 * whether its details are open; a change is an event and the host sets the items again.
 *
 * Events: `lintje-strip-change` `{turnId, key, value}` — a state; `value` is the
 * chosen option's value, or the suggestion's new `pressed`.
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { LintjeElement, define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import disclosureCss from '../../shared/disclosure.css?inline'
import chatStripCss from './chat-strip.css?inline'
import type { ChatStripItem } from '../../../types'

export class LintjeChatStrip extends LintjeElement {
  static override styles = [iconStyles, shadowCss(disclosureCss), shadowCss(chatStripCss)]

  static override properties: PropertyDeclarations = {
    items: { attribute: false },
    details: { attribute: false },
    detailsLabel: { type: String, attribute: 'details-label' },
    disabled: { type: Boolean, reflect: true },
    turnId: { type: String, attribute: 'turn-id' },
    open: { type: Boolean, reflect: true },
  }

  declare items?: ChatStripItem[]
  declare details?: { term: string; description: string }[]
  detailsLabel: string = 'Berekening'
  /** Every value is plain text and untaken suggestions are left out: the answer is a record. */
  disabled: boolean = false
  /** The turn this strip belongs to; it comes back in the event. */
  declare turnId?: string
  open: boolean = false

  private change(key: string, value: string | boolean): void {
    this.emit('lintje-strip-change', { turnId: this.turnId ?? null, key, value })
  }

  // The host owns the value. `<option selected>` stops counting once the reader has touched
  // the list, so the value is set on the element after every render.
  protected override updated(): void {
    for (const select of this.renderRoot.querySelectorAll<HTMLSelectElement>('select')) {
      select.value = select.dataset.value ?? ''
    }
  }

  private value(item: ChatStripItem): TemplateResult {
    if (item.options && !this.disabled) {
      const chosen = item.options.find((option) => option.value === item.value)
      return html`<span class="lintje-chat-strip__term">
        <span class="lintje-chat-strip__term-text">${chosen?.label ?? item.value}</span>
        ${renderIcon('functioneel-delta-omlaag', { size: 16 })}
        <select
          class="lintje-chat-strip__select"
          aria-label=${item.label}
          data-value=${item.value}
          @change=${(event: Event) => {
            const select = event.target as HTMLSelectElement
            const value = select.value
            select.value = item.value
            if (value !== item.value) this.change(item.key, value)
          }}
        >
          ${item.options.map((option) => html`<option value=${option.value}>${option.label}</option>`)}
        </select>
      </span>`
    }
    if (item.pressed !== undefined && !this.disabled) {
      return html`<button
        type="button"
        class=${classMap({ 'lintje-chat-strip__suggestion': true, 'is-pressed': item.pressed })}
        aria-pressed=${String(item.pressed)}
        @click=${() => this.change(item.key, !item.pressed)}
      >
        ${item.value}
      </button>`
    }
    const chosen = item.options?.find((option) => option.value === item.value)
    return html`<span class="lintje-chat-strip__text">${chosen?.label ?? item.value}</span>`
  }

  protected override render(): TemplateResult | typeof nothing {
    const items = (this.items ?? []).filter((item) => !(this.disabled && item.pressed === false))
    const details = this.details ?? []
    if (!items.length && !details.length) return nothing
    return html`<div
      class=${classMap({ 'lintje-chat-strip': true, 'lintje-disclosure': true, 'is-open': this.open })}
      role="group"
      aria-label="Uitgangspunten"
    >
      <div class="lintje-chat-strip__row">
        <dl class="lintje-chat-strip__items">
          ${items.map(
            (item) => html`<div
              class=${classMap({
                'lintje-chat-strip__item': true,
                'lintje-chat-strip__item--fixed': !item.options && item.pressed === undefined,
              })}
            >
              <dt class="lintje-chat-strip__label">${item.label}</dt>
              <dd class="lintje-chat-strip__value">${this.value(item)}</dd>
            </div>`,
          )}
        </dl>
        ${
          details.length
            ? html`<button
              type="button"
              class="lintje-chat-strip__toggle"
              aria-expanded=${String(this.open)}
              aria-controls="details"
              @click=${() => {
                this.open = !this.open
              }}
            >
              <span>${this.detailsLabel}</span>
              ${renderIcon('functioneel-delta-omlaag', {
                size: 16,
                className: 'lintje-disclosure__chevron',
              })}
            </button>`
            : nothing
        }
      </div>
      ${
        details.length
          ? html`<div class="lintje-disclosure__body">
            <div id="details" class="lintje-disclosure__body-inner">
              <dl class="lintje-chat-strip__details">
                ${details.map(
                  (row) => html`<div class="lintje-chat-strip__detail">
                    <dt class="lintje-chat-strip__detail-term">${row.term}</dt>
                    <dd class="lintje-chat-strip__detail-text">${row.description}</dd>
                  </div>`,
                )}
              </dl>
            </div>
          </div>`
          : nothing
      }
    </div>`
  }
}

define('lintje-chat-strip', LintjeChatStrip)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-chat-strip': LintjeChatStrip
  }
}
