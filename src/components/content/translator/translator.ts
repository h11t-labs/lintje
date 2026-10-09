/**
 * `<lintje-translator>` — a text and its translation in one surface of two halves: the source on
 * the left, the translation on the right, each with its language above and its actions below.
 * The two languages flank the swap on the line between them. Below 768 px the halves stack.
 *
 * The source is a plain `lintje-textarea`; the host keeps `value`. The translation, the language
 * choices and the actions are the host's, in slots: `source-language`, `target-language`,
 * `target` (a plain `lintje-streaming-text`), `source-actions`, `target-note` (the AI label, right
 * under the translation) and `target-actions`.
 *
 * `variant="documents"` keeps the language bar and the swap and puts the default slot under them
 * at full width, for documents to translate: the upload and the queue.
 *
 * After the swap a status region says so, with the languages the host's choices then show
 * ("Talen omgewisseld: Engels naar Nederlands").
 *
 * Events: `lintje-text-change` (the source text), `lintje-languages-swap`.
 */
import { html, nothing, type PropertyDeclarations, type TemplateResult } from 'lit'
import { LintjeElement, define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import { MOBILE, MediaController } from '../../../core/media'
import { ANNOUNCE_GAP } from '../../shared/copied'
import '../../inputs/textarea/textarea'
import type { LintjeTextarea } from '../../inputs/textarea/textarea'
import '../../../primitives/icon-button/icon-button'
import translatorCss from './translator.css?inline'

/** The language a slotted choice shows: a `select`'s option or a `lintje-combobox`'s. */
function languageOf(slot: HTMLSlotElement | null): string {
  const [choice] = slot?.assignedElements({ flatten: true }) ?? []
  if (choice instanceof HTMLSelectElement)
    return choice.options[choice.selectedIndex]?.text.trim() ?? ''
  const { options, value } = (choice ?? {}) as {
    options?: { value: string; label: string }[]
    value?: unknown
  }
  return (Array.isArray(options) && options.find((option) => option.value === value)?.label) || ''
}

export class LintjeTranslator extends LintjeElement {
  static override styles = shadowCss(translatorCss)

  static override properties: PropertyDeclarations = {
    value: { type: String },
    maxlength: { type: Number },
    placeholder: { type: String },
    sourceLabel: { type: String, attribute: 'source-label' },
    targetLabel: { type: String, attribute: 'target-label' },
    variant: { type: String, reflect: true },
    spoken: { state: true },
  }

  value: string = ''
  /** The limit the source's counter counts to. */
  declare maxlength?: number
  placeholder: string = 'Typ of plak hier je tekst'
  /** The source's accessible name, and its half's. */
  sourceLabel: string = 'Tekst om te vertalen'
  /** The translation half's accessible name. */
  targetLabel: string = 'Vertaling'
  /** `text` (default): the source and its translation; `documents`: the languages over the default slot. */
  variant: 'text' | 'documents' = 'text'
  /** What the status region says after a swap. */
  spoken: string = ''

  private spokenTimer = 0

  readonly #mobile = new MediaController(this, MOBILE)

  private get field(): LintjeTextarea | null {
    return this.renderRoot.querySelector('lintje-textarea')
  }

  private onText(event: CustomEvent<string>): void {
    event.stopPropagation()
    this.value = event.detail ?? ''
    this.emit('lintje-text-change', this.value)
  }

  // The clear button goes with the text, so the focus moves to the field it emptied.
  private clear(): void {
    this.value = ''
    this.emit('lintje-text-change', '')
    void this.updateComplete.then(() => this.field?.focus())
  }

  override disconnectedCallback(): void {
    clearTimeout(this.spokenTimer)
    super.disconnectedCallback()
  }

  // The region is emptied first, so a second swap with the same words is heard too; the
  // languages are read after that pause, when the host has swapped its choices.
  private swap(): void {
    this.emit('lintje-languages-swap')
    this.spoken = ''
    clearTimeout(this.spokenTimer)
    this.spokenTimer = window.setTimeout(() => {
      const from = languageOf(this.renderRoot.querySelector('slot[name="source-language"]'))
      const to = languageOf(this.renderRoot.querySelector('slot[name="target-language"]'))
      this.spoken = from && to ? `Talen omgewisseld: ${from} naar ${to}` : 'Talen omgewisseld'
    }, ANNOUNCE_GAP)
  }

  private renderStatus(): TemplateResult {
    return html`<span class="visually-hidden" role="status">${this.spoken}</span>`
  }

  private renderSwap(): TemplateResult {
    return html`<div class="lintje-translator__swap">
      <lintje-icon-button
        icon="functioneel-wissel-horizontaal"
        label="Talen omwisselen"
        variant="outlined"
        @click=${this.swap}
      ></lintje-icon-button>
    </div>`
  }

  private renderDocuments(): TemplateResult {
    return html`<div class="lintje-translator lintje-translator--documents">
      <div class="lintje-translator__bars">
        <div class="lintje-translator__half">
          <div class="lintje-translator__bar lintje-translator__bar--source"><slot name="source-language"></slot></div>
        </div>
        <div class="lintje-translator__half lintje-translator__half--target">
          ${this.renderSwap()}
          <div class="lintje-translator__bar"><slot name="target-language"></slot></div>
        </div>
      </div>
      <div class="lintje-translator__content"><slot></slot></div>
    </div>${this.renderStatus()}`
  }

  protected override render(): TemplateResult {
    if (this.variant === 'documents') return this.renderDocuments()
    return html`<div class="lintje-translator">
      <div class="lintje-translator__half" role="group" aria-label=${this.sourceLabel}>
        <div class="lintje-translator__bar lintje-translator__bar--source"><slot name="source-language"></slot></div>
        <div class="lintje-translator__body lintje-translator__body--source">
          <lintje-textarea
            class="lintje-translator__text"
            variant="plain"
            commit="input"
            hide-label
            .label=${this.sourceLabel}
            .rows=${this.#mobile.matches ? 5 : 10}
            .value=${this.value}
            .maxlength=${this.maxlength}
            .placeholder=${this.placeholder}
            @lintje-change=${this.onText}
          ></lintje-textarea>
          ${
            this.value
              ? html`<lintje-icon-button
                  class="lintje-translator__clear"
                  icon="functioneel-kruis"
                  label="Tekst wissen"
                  variant="flat"
                  @click=${this.clear}
                ></lintje-icon-button>`
              : nothing
          }
        </div>
        <div class="lintje-translator__foot">
          <slot name="source-actions"></slot>
        </div>
      </div>
      <div class="lintje-translator__half lintje-translator__half--target" role="group" aria-label=${this.targetLabel}>
        ${this.renderSwap()}
        <div class="lintje-translator__bar"><slot name="target-language"></slot></div>
        <div class="lintje-translator__body">
          <slot name="target"></slot>
          <slot name="target-note"></slot>
        </div>
        <div class="lintje-translator__foot">
          <span class="lintje-translator__actions"><slot name="target-actions"></slot></span>
        </div>
      </div>
    </div>${this.renderStatus()}`
  }
}

define('lintje-translator', LintjeTranslator)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-translator': LintjeTranslator
  }
}
