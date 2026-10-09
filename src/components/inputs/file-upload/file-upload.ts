/**
 * `<lintje-file-upload>` — choose or drop files, and see per file how far it is and how it ended.
 * It never uploads: it checks files against `accept` and `max-size`, sends the ones that pass
 * with `lintje-files-add`, and draws the rows from `.files`. A file it refuses itself never
 * reaches the host. Its value is the ids of the rows that are done.
 *
 * The button is the one control: it carries the label in its name and the types, the size and
 * the hint or error as its description. When a row with the focus goes, the focus moves to the
 * row in its place, else the one before, else the button.
 *
 * Events: `lintje-files-add` (the `File[]`), `lintje-file-remove` `{ id }`, `lintje-file-cancel`
 * `{ id }` — composed; `lintje-change` and, with a `name`, `lintje-values-change`.
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
import { holdsFocus } from '../../../core/focus'
import { MediaController, MOBILE } from '../../../core/media'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import '../../../primitives/button/button'
import '../../../primitives/progress-bar/progress-bar'
import { focusTarget } from '../../shared/focus-trap'
import { LintjeInputElement } from '../shared/input'
import inputCss from '../shared/input.css?inline'
import fileUploadCss from './file-upload.css?inline'

/** One row, as the host keeps it. */
export interface UploadFile {
  id: string
  name: string
  size: number
  state: 'busy' | 'done' | 'error'
  /** 0–100 while busy; left out, the bar is indeterminate. */
  progress?: number
  /** Why it was refused, in Dutch. */
  message?: string
}

const DECIMAL = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 1 })

export function formatSize(bytes: number): string {
  const units: [number, string][] = [
    [1024 ** 3, 'GB'],
    [1024 ** 2, 'MB'],
    [1024, 'kB'],
  ]
  for (const [size, unit] of units) {
    if (bytes >= size) {
      const value = bytes / size
      return `${unit === 'kB' ? Math.round(value) : DECIMAL.format(value)} ${unit}`
    }
  }
  return `${bytes} B`
}

const KINDS: Record<string, string> = {
  image: 'afbeeldingen',
  audio: 'geluid',
  video: 'video',
  text: 'tekst',
}

export function typesText(accept: string): string {
  const names = accept
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      if (token.startsWith('.')) return token.slice(1).toUpperCase()
      const [kind, sub] = token.split('/')
      if (sub === '*') return KINDS[kind] ?? kind
      return (sub ?? kind).toUpperCase()
    })
  if (names.length < 2) return names.join('')
  return `${names.slice(0, -1).join(', ')} of ${names[names.length - 1]}`
}

export function accepts(file: { name: string; type: string }, accept: string): boolean {
  const tokens = accept
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)
  if (!tokens.length) return true
  const name = file.name.toLowerCase()
  const type = file.type.toLowerCase()
  return tokens.some((token) => {
    if (token.startsWith('.')) return name.endsWith(token)
    if (token.endsWith('/*')) return type.startsWith(token.slice(0, -1))
    return type === token
  })
}

export function refusal(
  file: { name: string; type: string; size: number },
  accept: string,
  maxSize: number | undefined,
): string {
  if (!accepts(file, accept)) return 'Dit bestandstype kan niet'
  if (maxSize && file.size > maxSize) return `Groter dan ${formatSize(maxSize)}`
  return ''
}

export function rowNews(before: UploadFile[], after: UploadFile[]): string {
  const known = new Map(before.map((row) => [row.id, row.state]))
  const news: string[] = []
  for (const row of after) {
    const was = known.get(row.id)
    if (was === row.state) continue
    if (row.state === 'error') news.push(`${row.name} geweigerd: ${row.message ?? ''}`.trim())
    else if (row.state === 'done') news.push(`${row.name} klaar`)
    else if (was === undefined) news.push(`${row.name} toegevoegd`)
  }
  return news.join('. ')
}

/** A row's state in words: the icon beside the name is drawing only. */
const STATE_TEXT: Record<UploadFile['state'], string> = {
  busy: 'bezig',
  done: 'klaar',
  error: 'geweigerd',
}

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
  /** The row that held the focus before the rows changed, and where it stood. */
  #focusedRow: { id: string; index: number } | null = null

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
    if (rowsChanged) this.#focusedRow = this.focusedRow()
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
    const was = this.#focusedRow
    this.#focusedRow = null
    if (!was) return
    const rows = this.rowElements
    if (rows.some((row) => row.dataset.id === was.id)) return
    const next = rows[Math.min(was.index, rows.length - 1)]
    const target = next?.querySelector<HTMLElement>('lintje-button') ?? this.chooser
    if (target) focusTarget(target).focus()
  }

  private get rowElements(): HTMLElement[] {
    return [...this.renderRoot.querySelectorAll<HTMLElement>('.lintje-file-upload__row')]
  }

  private get chooser(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.lintje-file-upload__button')
  }

  private focusedRow(): { id: string; index: number } | null {
    const rows = this.rowElements
    const index = rows.findIndex((row) => holdsFocus(row))
    return index < 0 ? null : { id: rows[index].dataset.id ?? '', index }
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
      this.news = rowNews([], refused)
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

  private removeRow(row: UploadFile): void {
    if (this.refused.some((item) => item.id === row.id)) {
      this.refused = this.refused.filter((item) => item.id !== row.id)
      return
    }
    this.emit('lintje-file-remove', { id: row.id })
  }

  private get dropText(): string {
    const count = this.dragCount
    if (!count) return 'Laat los om de bestanden toe te voegen'
    return `Laat los om ${count} ${count === 1 ? 'bestand' : 'bestanden'} toe te voegen`
  }

  private get metaText(): string {
    const parts = [
      this.accept ? typesText(this.accept) : '',
      this.maxSize ? `hoogstens ${formatSize(this.maxSize)}` : '',
    ]
    return parts.filter(Boolean).join(' · ')
  }

  private renderRow(row: UploadFile): TemplateResult {
    const busy = row.state === 'busy'
    const icon = {
      busy: 'op-kantoor-document-blanco',
      done: 'functioneel-vinkje',
      error: 'functioneel-waarschuwing',
    }[row.state]
    const known = typeof row.progress === 'number'
    const detail = busy
      ? known
        ? `· ${Math.round(row.progress!)}%`
        : ''
      : row.state === 'done'
        ? `· ${formatSize(row.size)}`
        : ''
    return html`<li
      class=${classMap({ 'lintje-file-upload__row': true, [`is-${row.state}`]: true })}
      data-id=${row.id}
    >
      <div class="lintje-file-upload__row-head">
        ${renderIcon(icon, { size: 18, className: 'lintje-file-upload__row-icon' })}
        <span class="lintje-file-upload__name">
          <strong>${row.name}</strong
          ><span class="visually-hidden">, ${STATE_TEXT[row.state]}</span>
          ${detail ? html`<span class="lintje-file-upload__detail">${detail}</span>` : nothing}
          ${
            row.state === 'error' && row.message
              ? html`<span class="lintje-file-upload__reason">${row.message}</span>`
              : nothing
          }
        </span>
        <lintje-button
          variant="link"
          @click=${() => (busy ? this.emit('lintje-file-cancel', { id: row.id }) : this.removeRow(row))}
          >${busy ? 'Annuleren' : 'Verwijderen'}<span class="visually-hidden">
            ${row.name}</span
          ></lintje-button
        >
      </div>
      ${
        busy
          ? html`<lintje-progress-bar
            hide-label
            label=${`${row.name} uploaden`}
            .value=${known ? row.progress : undefined}
          ></lintje-progress-bar>`
          : nothing
      }
    </li>`
  }

  protected override render(): TemplateResult {
    const rows = [...(this.files ?? []), ...this.refused]
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
                <strong class="lintje-file-upload__text">${this.dropText}</strong>`
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
          ? html`<ul class="lintje-file-upload__list" aria-label="Bestanden">
            ${rows.map((row) => this.renderRow(row))}
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
