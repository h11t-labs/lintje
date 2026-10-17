/**
 * `<lintje-attachment>` — one file as a quiet chip of one line: the icon of its kind or a
 * thumbnail, the name and the size, busy or with an error.
 *
 * It opens nothing itself: a chip with `href` is a link, one without asks the host with
 * `lintje-file-open`. A `removable` chip has the cross and opens nothing. Whoever draws a list
 * puts each chip in its own `<li>`.
 *
 * Events: `lintje-file-remove` `{ id }` (the cross on a done or failed file),
 * `lintje-file-cancel` `{ id }` (the cross on a busy one), `lintje-file-retry` `{ id }`,
 * `lintje-file-open` `{ id }` (a chip without `href`), `lintje-navigate` `{ href }` (a chip with
 * `href` and without `download`; cancel it to route yourself).
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
import { holdsFocus } from '../../../core/focus'
import { styleProps } from '../../../core/style-props'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import { formatSize, STATE_TEXT, type UploadFile } from '../../shared/files'
import { TONE_ICON } from '../../shared/tone'
import attachmentCss from './attachment.css?inline'

/** The first that fits, so CSV goes before text and a spreadsheet before a document. */
const KINDS: { icon: string; types: RegExp; extensions: string[] }[] = [
  { icon: 'op-kantoor-document-met-tekst-csv', types: /^text\/csv$/, extensions: ['csv'] },
  {
    icon: 'op-kantoor-document-met-vlakken-en-lijnen-erop',
    types: /spreadsheetml\.sheet$|^application\/vnd\.ms-excel$|opendocument\.spreadsheet$/,
    extensions: ['xlsx', 'xls', 'ods'],
  },
  {
    icon: 'op-kantoor-document-met-lijnen',
    types:
      /^application\/pdf$|wordprocessingml\.document$|^application\/msword$|opendocument\.text$|^text\//,
    extensions: ['pdf', 'docx', 'doc', 'odt', 'txt', 'md'],
  },
]
const BLANK = 'op-kantoor-document-blanco'

/** What follows the last dot, unless that dot starts the name: ".env" has none. */
export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1) : ''
}

export function fileIcon(file: Pick<UploadFile, 'name' | 'type'>): string {
  const type = file.type?.toLowerCase()
  const extension = extensionOf(file.name).toLowerCase()
  const kind = KINDS.find((entry) =>
    type ? entry.types.test(type) : entry.extensions.includes(extension),
  )
  return kind?.icon ?? BLANK
}

/** How many letters of the stem stay beside the extension when the name is cut in the middle. */
const KEPT = 6

/** The name in two: a stem that takes the ellipsis and keeps three letters, and a tail that stays. */
export function splitName(name: string): { stem: string; tail: string } {
  const extension = extensionOf(name)
  const base = extension ? name.slice(0, -(extension.length + 1)) : name
  const cut = base.length - KEPT
  // A stem of three letters or fewer is never cut, so it stays whole beside the tail.
  if (cut <= 3) return { stem: '', tail: name }
  return { stem: base.slice(0, cut), tail: name.slice(cut) }
}

export class LintjeAttachment extends LintjeElement {
  static override styles = [iconStyles, shadowCss(attachmentCss)]

  static override properties: PropertyDeclarations = {
    data: { attribute: false },
    removable: { type: Boolean, reflect: true },
    refused: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
  }

  declare data?: UploadFile
  /** The cross, in a question box or an upload field: the chip then opens nothing. */
  removable: boolean = false
  /** Its error is the drawing element's own refusal ("geweigerd"), not the host's ("mislukt"). */
  refused: boolean = false
  /** No cross, no "Opnieuw", and it opens nothing. */
  disabled: boolean = false

  /** "Opnieuw" held the focus, and leaves once the host sets the file busy again. */
  #retried = false

  /** The chip's first control: the cross, "Opnieuw", or the chip itself when it opens. */
  override focus(options?: FocusOptions): void {
    this.renderRoot
      .querySelector<HTMLElement>(
        '.lintje-attachment__remove, .lintje-attachment__retry, a.lintje-attachment__main, button.lintje-attachment__main',
      )
      ?.focus(options)
  }

  private get opens(): boolean {
    return !this.removable && !this.disabled && this.data?.state === 'done'
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    const retry = this.renderRoot.querySelector('.lintje-attachment__retry')
    if (changed.has('data') && retry && holdsFocus(retry)) this.#retried = true
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    if (!this.#retried || this.renderRoot.querySelector('.lintje-attachment__retry')) return
    this.#retried = false
    this.renderRoot.querySelector<HTMLElement>('.lintje-attachment__remove')?.focus()
  }

  private send(name: string): void {
    if (this.data) this.emit(name, { id: this.data.id })
  }

  private onLink(event: MouseEvent): void {
    const file = this.data
    if (!file?.href || file.download) return
    this.followLink(file.href, event)
  }

  /** What stands beside the name: the percentage, the reason, `detail` or the size. */
  private get detail(): string {
    const file = this.data!
    if (file.state === 'busy') {
      return typeof file.progress === 'number'
        ? `${Math.round(Math.min(100, Math.max(0, file.progress)))}%`
        : ''
    }
    if (file.state === 'error') return file.message ?? ''
    if (file.detail) return file.detail
    return typeof file.size === 'number' ? formatSize(file.size) : ''
  }

  /** The chip in words: the name, its state where it is not done, and what stands beside it. */
  private get spoken(): string {
    const file = this.data!
    const detail = this.detail
    if (file.state === 'error') {
      const word = this.refused ? STATE_TEXT.refused : STATE_TEXT.error
      return detail ? `${file.name}, ${word}: ${detail}` : `${file.name}, ${word}`
    }
    const parts = [file.name, file.state === 'busy' ? STATE_TEXT.busy : '', detail]
    if (this.opens && file.href && file.download) parts.push('downloaden')
    return parts.filter(Boolean).join(', ')
  }

  private renderMark(file: UploadFile): TemplateResult | typeof nothing {
    if (file.state === 'error') {
      return renderIcon(TONE_ICON.warning, { className: 'lintje-attachment__icon is-error' })
    }
    if (file.thumbnail) {
      return html`<img class="lintje-attachment__thumb" src=${file.thumbnail} alt="" />`
    }
    return renderIcon(fileIcon(file), { className: 'lintje-attachment__icon' })
  }

  private renderContent(file: UploadFile): TemplateResult {
    const { stem, tail } = splitName(file.name)
    const detail = this.detail
    const sign = this.opens && file.href && file.download
    return html`${this.renderMark(file)}
      <span class="lintje-attachment__name" title=${file.name} aria-hidden="true"
        >${stem ? html`<span class="lintje-attachment__stem">${stem}</span>` : nothing}<span
          class="lintje-attachment__tail"
          >${tail}</span
        ></span
      >
      ${
        detail
          ? html`<span class="lintje-attachment__detail" aria-hidden="true">${detail}</span>`
          : nothing
      }
      ${
        sign
          ? html`<span class="lintje-attachment__sign"
            >${renderIcon('functioneel-downloaden', { size: 12 })}</span
          >`
          : nothing
      }
      <span class="visually-hidden">${this.spoken}</span>`
  }

  private renderMain(file: UploadFile): TemplateResult {
    const content = this.renderContent(file)
    if (!this.opens) return html`<span class="lintje-attachment__main">${content}</span>`
    if (file.href) {
      return html`<a
        class="lintje-attachment__main"
        href=${file.href}
        ?download=${file.download}
        @click=${this.onLink}
        >${content}</a
      >`
    }
    return html`<button
      class="lintje-attachment__main"
      type="button"
      @click=${() => this.send('lintje-file-open')}
    >
      ${content}
    </button>`
  }

  private renderActions(file: UploadFile): TemplateResult | typeof nothing {
    if (this.disabled) return nothing
    const busy = file.state === 'busy'
    const retry = file.state === 'error' && file.retry
    return html`${
      retry
        ? html`<button
          class="lintje-attachment__action lintje-attachment__retry"
          type="button"
          aria-label=${`Opnieuw ${file.name}`}
          @click=${() => this.send('lintje-file-retry')}
        >
          ${renderIcon('functioneel-refresh', { size: 12 })}
        </button>`
        : nothing
    }
    ${
      this.removable
        ? html`<button
          class="lintje-attachment__action lintje-attachment__remove"
          type="button"
          aria-label=${`${busy ? 'Annuleren' : 'Verwijderen'} ${file.name}`}
          @click=${() => this.send(busy ? 'lintje-file-cancel' : 'lintje-file-remove')}
        >
          ${renderIcon('functioneel-kruis', { size: 12 })}
        </button>`
        : nothing
    }`
  }

  private renderProgress(file: UploadFile): TemplateResult | typeof nothing {
    if (file.state !== 'busy') return nothing
    const known = typeof file.progress === 'number'
    const value = known ? Math.round(Math.min(100, Math.max(0, file.progress!))) : undefined
    return html`<span
      class=${classMap({ 'lintje-attachment__progress': true, 'is-indeterminate': !known })}
      role="progressbar"
      aria-label=${`${file.name} uploaden`}
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow=${value ?? nothing}
      ><span
        class="lintje-attachment__progress-fill"
        ${styleProps({ width: known ? `${value}%` : null })}
      ></span
    ></span>`
  }

  protected override render(): TemplateResult | typeof nothing {
    const file = this.data
    if (!file) return nothing
    const actions = !this.disabled && (this.removable || (file.state === 'error' && file.retry))
    const sign = this.opens && file.href && file.download
    return html`<div
      class=${classMap({
        'lintje-attachment': true,
        'lintje-attachment--opens': this.opens,
        'lintje-attachment--end': Boolean(actions || sign),
        [`is-${file.state}`]: true,
        'is-disabled': this.disabled,
      })}
    >
      ${this.renderMain(file)} ${this.renderActions(file)} ${this.renderProgress(file)}
    </div>`
  }
}

define('lintje-attachment', LintjeAttachment)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-attachment': LintjeAttachment
  }
}
