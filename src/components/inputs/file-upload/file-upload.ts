/**
 * `<lintje-file-upload>` — choose or drop files, and see per file how far it is and how it ended.
 *
 * It never uploads: it checks files against `accept` and `max-size`, sends the ones that pass with
 * `lintje-files-add` and draws `files` as attachments under the zone. A file it refuses never
 * reaches the host, nor do the events of its chip. Its value is the ids of the files that are done.
 *
 * Events: `lintje-files-add` `File[]`, `lintje-change` `string[]`, `lintje-values-change`
 * `{ [name]: value }` (with a `name`), `lintje-reset` (the reset link was pressed); from its chips
 * `lintje-file-remove` `{ id }`, `lintje-file-cancel` `{ id }` and `lintje-file-retry` `{ id }`.
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { define } from '../../../core/element'
import { MediaController, MOBILE } from '../../../core/media'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import '../../actions/button/button'
import '../../content/attachment/attachment'
import {
  dropText,
  limitsText,
  refusal,
  RowFocus,
  rowNews,
  type UploadFile,
} from '../../shared/files'
import { LintjeInputElement } from '../shared/input'
import inputCss from '../shared/input.css?inline'
import fileUploadCss from './file-upload.css?inline'

const doneIds = (rows: UploadFile[] | undefined): string[] =>
  (rows ?? []).filter((row) => row.state === 'done').map((row) => row.id)

const hasFiles = (event: DragEvent): boolean =>
  [...(event.dataTransfer?.types ?? [])].includes('Files')

export class LintjeFileUpload extends LintjeInputElement {
  static override styles = [iconStyles, shadowCss(inputCss), shadowCss(fileUploadCss)]

  static override properties: PropertyDeclarations = {
    files: { attribute: false },
    accept: { type: String },
    maxSize: { type: Number, attribute: 'max-size' },
    single: { type: Boolean },
    fill: { type: Boolean, reflect: true },
    dragging: { state: true },
    dragCount: { state: true },
    refused: { state: true },
    news: { state: true },
  }

  /** The host's rows: one per file of `lintje-files-add`, moved busy, then done or error. */
  declare files?: UploadFile[]
  /** The file chooser's filter and the element's own check: ".pdf,.jpg" or "image/*". */
  accept: string = ''
  /** The largest file, in bytes. */
  declare maxSize?: number
  single: boolean = false
  /** The zone takes the height it is given, its content stacked in the middle: beside a taller block. */
  fill: boolean = false
  protected dragging: boolean = false
  /** How many are dragged: 0 when the browser does not say. */
  protected dragCount: number = 0
  protected refused: UploadFile[] = []
  protected news: string = ''

  readonly #mobile = new MediaController(this, MOBILE)
  #depth: number = 0
  #refusedCount: number = 0
  readonly #rowFocus = new RowFocus()

  private readonly onDragEnter = (event: DragEvent): void => {
    if (this.disabled || !hasFiles(event)) return
    this.#depth += 1
    this.dragging = true
    this.dragCount = event.dataTransfer?.items?.length ?? 0
  }

  private readonly onDragLeave = (): void => {
    if (!this.dragging) return
    this.#depth = Math.max(0, this.#depth - 1)
    if (this.#depth === 0) this.dragging = false
  }

  private readonly onDragEnd = (): void => {
    this.#depth = 0
    this.dragging = false
  }

  override connectedCallback(): void {
    super.connectedCallback()
    document.addEventListener('dragenter', this.onDragEnter)
    document.addEventListener('dragleave', this.onDragLeave)
    document.addEventListener('drop', this.onDragEnd)
    document.addEventListener('dragend', this.onDragEnd)
  }

  override disconnectedCallback(): void {
    document.removeEventListener('dragenter', this.onDragEnter)
    document.removeEventListener('dragleave', this.onDragLeave)
    document.removeEventListener('drop', this.onDragEnd)
    document.removeEventListener('dragend', this.onDragEnd)
    this.onDragEnd()
    super.disconnectedCallback()
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    const rowsChanged = changed.has('files') || (changed as Map<string, unknown>).has('refused')
    if (rowsChanged) this.#rowFocus.hold(this.rowElements)
    if (!changed.has('files')) return
    const before = changed.get('files') as UploadFile[] | undefined
    const news = rowNews(before ?? [], this.files ?? [])
    if (news) this.news = news
    if (before === undefined) return
    const done = doneIds(this.files)
    if (done.join('\n') !== doneIds(before).join('\n')) this.announce(done)
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    this.#rowFocus.restore(this.rowElements, () => this.focusControl())
  }

  private get rowElements(): HTMLElement[] {
    return [...this.renderRoot.querySelectorAll<HTMLElement>('.lintje-file-upload__file')]
  }

  private get chooser(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.lintje-file-upload__button')
  }

  add(chosen: File[]): void {
    if (this.disabled || !chosen.length) return
    const files = this.single ? chosen.slice(0, 1) : chosen
    const passed: File[] = []
    const refused: UploadFile[] = []
    for (const file of files) {
      const reason = refusal(file, this.accept, this.maxSize)
      if (!reason) {
        passed.push(file)
        continue
      }
      this.#refusedCount += 1
      refused.push({
        id: `lintje-refused-${this.#refusedCount}`,
        name: file.name,
        size: file.size,
        state: 'error',
        message: reason,
      })
    }
    if (refused.length) {
      this.refused = [...this.refused, ...refused]
      this.news = rowNews([], refused, true)
    }
    if (passed.length) this.emit('lintje-files-add', passed)
  }

  /**
   * The label's click lands on the one thing in the zone that answers: the button. Its own
   * `<button>` stands in its shadow root, which a search of this root does not reach.
   */
  protected override focusControl(options?: FocusOptions): void {
    this.chooser?.shadowRoot?.querySelector<HTMLElement>('button')?.focus(options)
  }

  private pick(): void {
    this.renderRoot.querySelector<HTMLInputElement>('.lintje-file-upload__input')?.click()
  }

  private onPicked(event: Event): void {
    const input = event.target as HTMLInputElement
    this.add([...(input.files ?? [])])
    input.value = ''
  }

  private onDragOver(event: DragEvent): void {
    if (this.disabled || !hasFiles(event)) return
    event.preventDefault()
  }

  private onDrop(event: DragEvent): void {
    if (this.disabled) return
    event.preventDefault()
    this.onDragEnd()
    this.add([...(event.dataTransfer?.files ?? [])])
  }

  /** A chip of its own refusal is the element's alone: its event stops here and the chip goes. */
  private onChipEvent(event: Event): void {
    const { id } = (event as CustomEvent<{ id: string }>).detail
    if (!this.refused.some((row) => row.id === id)) return
    event.stopPropagation()
    this.refused = this.refused.filter((row) => row.id !== id)
  }

  private get metaText(): string {
    return limitsText(this.accept, this.maxSize)
  }

  private renderRow(row: UploadFile, refused: boolean): TemplateResult {
    return html`<li class="lintje-file-upload__row">
      <lintje-attachment
        class="lintje-file-upload__file"
        data-id=${row.id}
        removable
        ?refused=${refused}
        ?disabled=${this.disabled}
        .data=${row}
      ></lintje-attachment>
    </li>`
  }

  protected override render(): TemplateResult {
    const files = this.files ?? []
    const rows = [...files, ...this.refused]
    const dragging = this.dragging && !this.disabled
    const meta = this.metaText
    const choose = this.single ? 'Bestand kiezen' : 'Bestanden kiezen'
    const description = [meta, this.footMessage || this.hint].filter(Boolean).join('. ')
    return html`<div class="lintje-field">
      ${this.label ? this.renderLabel() : nothing}
      <div
        class=${classMap({
          'lintje-file-upload': true,
          'lintje-file-upload--fill': this.fill,
          'is-dragging': dragging,
          'is-error': Boolean(this.error),
          'is-disabled': this.disabled,
        })}
        @dragover=${this.onDragOver}
        @drop=${this.onDrop}
      >
        ${
          dragging
            ? html`${renderIcon('functioneel-upload', { size: 20, className: 'lintje-file-upload__icon' })}
                <strong class="lintje-file-upload__text">${dropText(this.dragCount)}</strong>`
            : html`<lintje-button
                  class="lintje-file-upload__button"
                  variant="secondary"
                  icon="functioneel-upload"
                  ?block=${this.#mobile.matches}
                  ?disabled=${this.disabled}
                  ?invalid=${Boolean(this.error)}
                  accessible-name=${this.label ? `${choose}, ${this.labelText}` : nothing}
                  description=${description || nothing}
                  @click=${this.pick}
                  >${choose}</lintje-button
                >
                <span class="lintje-file-upload__text"
                  >${this.single ? 'of sleep het hierheen' : 'of sleep ze hierheen'}</span
                >
                ${meta ? html`<span class="lintje-file-upload__meta">${meta}</span>` : nothing}`
        }
        <input
          class="lintje-file-upload__input"
          type="file"
          hidden
          tabindex="-1"
          accept=${this.accept || nothing}
          ?multiple=${!this.single}
          ?disabled=${this.disabled}
          @change=${this.onPicked}
        />
      </div>
      ${
        rows.length
          ? html`<ul
            class="lintje-file-upload__list"
            aria-label="Bestanden"
            @lintje-file-remove=${this.onChipEvent}
            @lintje-file-cancel=${this.onChipEvent}
            @lintje-file-retry=${this.onChipEvent}
          >
            ${rows.map((row, index) => this.renderRow(row, index >= files.length))}
          </ul>`
          : nothing
      }
      <span class="visually-hidden" role="status">${this.news}</span>
      ${this.renderFoot()}
    </div>`
  }
}

define('lintje-file-upload', LintjeFileUpload)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-file-upload': LintjeFileUpload
  }
}
