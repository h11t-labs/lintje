/**
 * Editing a cell in `<lintje-data-table>`: the column's `editor` turns its cells into tab stops.
 *
 * A save is a request, `lintje-cell-edit` `{ id, column, value }`; until the host's next `data`
 * the new value stands muted behind a spinner. That `data` answers it: `busyCells` is still
 * saving, `cellErrors` reopens the field with the message, a cell in neither is saved. The table
 * never keeps the value. Only the desktop table edits.
 */
import { html, nothing, type TemplateResult } from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { renderIcon } from '../../../icons/render'
import '../../../primitives/spinner/spinner'
import type {
  CellValue,
  DataTableData,
  TableCellError,
  TableCellRef,
  TableColumnData,
} from '../../../types'

export interface CellPosition {
  row: number
  column: number
}

export type CellMove = 'down' | 'next' | 'previous'

/** The cell a save moves to, or `null`; next and previous skip what `editable` refuses. */
export function nextEditableCell(
  from: CellPosition,
  move: CellMove,
  rows: number,
  columns: number,
  editable: (row: number, column: number) => boolean,
): CellPosition | null {
  if (move === 'down') {
    for (let row = from.row + 1; row < rows; row++) {
      if (editable(row, from.column)) return { row, column: from.column }
    }
    return null
  }
  const step = move === 'next' ? 1 : -1
  const last = rows * columns
  for (
    let index = from.row * columns + from.column + step;
    index >= 0 && index < last;
    index += step
  ) {
    const position = { row: Math.floor(index / columns), column: index % columns }
    if (editable(position.row, position.column)) return position
  }
  return null
}

export function cellKey(ref: TableCellRef): string {
  return `${ref.id}\u001f${ref.column}`
}

export function editText(value: CellValue): string {
  return value == null ? '' : String(value)
}

export type CellMode =
  | { kind: 'rest' }
  | { kind: 'busy'; value: string }
  | { kind: 'editor'; value: string; error?: string }

export interface EditGrid {
  ids: string[]
  columns: TableColumnData[]
  /** The first row on this page is row `offset + 1` (for the field label). */
  offset: number
  /** The tile's table or the expanded modal's: both stand in one shadow root, so ids name it. */
  copy: 'tile' | 'modal'
}

/** The table one save is about, and how the controller reaches it. */
export interface EditingHost {
  requestUpdate(): void
  editCell(detail: TableCellRef & { value: string }): void
}

let instances = 0

export class CellEditing {
  editing: TableCellRef | null = null
  /** What the table's status line reads out: saving, saved, refused. */
  message: string = ''

  readonly #host: EditingHost
  readonly #prefix = `lintje-data-table-${++instances}`
  readonly #pending = new Map<string, string>()
  /** The values the host refused, so the field opens again with them. */
  readonly #refused = new Map<string, string>()
  /** Errors closed with Escape; cleared when the host sends other errors. */
  readonly #dismissed = new Set<string>()
  #errorsSeen = JSON.stringify([])
  #errors = new Map<string, TableCellError>()
  #busy = new Set<string>()
  // The table the reader works in (the tile's or the modal's).
  #table: Element | null = null
  #focus: { key: string; target: 'cell' | 'editor' } | null = null

  constructor(host: EditingHost) {
    this.#host = host
  }

  get hintId(): string {
    return `${this.#prefix}-hint`
  }

  sync(data: DataTableData | null | undefined): void {
    const errors = data?.cellErrors ?? []
    const seen = JSON.stringify(errors)
    if (seen !== this.#errorsSeen) {
      this.#errorsSeen = seen
      this.#dismissed.clear()
    }
    this.#errors = new Map(errors.map((error) => [cellKey(error), error]))
    this.#busy = new Set((data?.busyCells ?? []).map(cellKey))
    for (const [key, value] of this.#pending) {
      if (this.#busy.has(key)) continue
      this.#pending.delete(key)
      const error = this.#errors.get(key)
      if (error) {
        this.#refused.set(key, value)
        this.message = `Niet opgeslagen: ${error.message}`
      } else {
        this.#refused.delete(key)
        this.message = 'Opgeslagen'
      }
    }
  }

  mode(ref: TableCellRef, original: CellValue): CellMode {
    const key = cellKey(ref)
    const pending = this.#pending.get(key)
    if (pending !== undefined) return { kind: 'busy', value: pending }
    if (this.#busy.has(key)) return { kind: 'busy', value: editText(original) }
    const error = this.#errors.get(key)
    if (error && !this.#dismissed.has(key)) {
      return {
        kind: 'editor',
        value: error.value ?? this.#refused.get(key) ?? editText(original),
        error: error.message,
      }
    }
    if (this.editing && cellKey(this.editing) === key)
      return { kind: 'editor', value: editText(original) }
    return { kind: 'rest' }
  }

  open(ref: TableCellRef, from: Element): void {
    this.#table = from.closest('table')
    this.editing = ref
    this.#focus = { key: cellKey(ref), target: 'editor' }
    this.#host.requestUpdate()
  }

  cancel(ref: TableCellRef): void {
    const key = cellKey(ref)
    if (this.#errors.has(key)) this.#dismissed.add(key)
    this.#refused.delete(key)
    if (this.editing && cellKey(this.editing) === key) this.editing = null
    this.#focus = { key, target: 'cell' }
    this.#host.requestUpdate()
  }

  // Sends the value when it differs from the row's or answers a refusal; a `move` opens the next.
  commit(
    ref: TableCellRef,
    value: string,
    original: CellValue,
    move: CellMove | null,
    grid: EditGrid,
  ): void {
    const key = cellKey(ref)
    const refused = this.#errors.has(key) && !this.#dismissed.has(key)
    if (refused || value !== editText(original)) {
      if (refused) this.#dismissed.add(key)
      this.#pending.set(key, value)
      this.message = 'Wordt opgeslagen'
      this.#host.editCell({ id: ref.id, column: ref.column, value })
    }
    this.editing = null
    this.#focus = { key, target: 'cell' }
    if (move) {
      const columns = grid.columns
      const from = {
        row: grid.ids.indexOf(ref.id),
        column: columns.findIndex((column) => column.key === ref.column),
      }
      const next = nextEditableCell(from, move, grid.ids.length, columns.length, (row, column) =>
        this.editable(
          { id: grid.ids[row] ?? '', column: columns[column]?.key ?? '' },
          columns[column],
        ),
      )
      if (next) {
        const target = { id: grid.ids[next.row] ?? '', column: columns[next.column]?.key ?? '' }
        this.editing = target
        this.#focus = { key: cellKey(target), target: 'editor' }
      }
    }
    this.#host.requestUpdate()
  }

  editable(ref: TableCellRef, column: TableColumnData | undefined): boolean {
    const key = cellKey(ref)
    return Boolean(column?.editor) && !this.#pending.has(key) && !this.#busy.has(key)
  }

  restoreFocus(root: ParentNode): void {
    const focus = this.#focus
    if (!focus) return
    this.#focus = null
    const scope: ParentNode = this.#table?.isConnected ? this.#table : root
    const cell = [...scope.querySelectorAll<HTMLElement>('[data-cell]')].find(
      (candidate) => candidate.dataset.cell === focus.key,
    )
    if (!cell) return
    const editor = cell.querySelector<HTMLInputElement | HTMLSelectElement>(
      '.lintje-data-table__editor',
    )
    if (focus.target === 'editor' && editor) {
      editor.focus()
      if (editor instanceof HTMLInputElement) editor.select()
    } else cell.focus()
  }

  /* --- Drawing ------------------------------------------------------------- */

  // `content` is the value as the table formats it; `label` the field's name ("Titel van rij 2").
  content(
    ref: TableCellRef,
    column: TableColumnData,
    original: CellValue,
    content: unknown,
    label: string,
    grid: EditGrid,
  ): unknown {
    const mode = this.mode(ref, original)
    if (mode.kind === 'busy') {
      return html`<span class="lintje-data-table__busy"
        ><lintje-spinner size="16"></lintje-spinner><span>${mode.value}</span></span
      >`
    }
    if (mode.kind === 'rest') {
      return html`${content}${renderIcon('functioneel-bewerken', {
        size: 14,
        className: 'lintje-data-table__edit-icon',
      })}`
    }
    const errorId = mode.error
      ? `${this.#prefix}-${grid.copy}-error-${grid.ids.indexOf(ref.id)}-${ref.column}`
      : null
    const onKeydown = (event: KeyboardEvent): void => {
      const field = event.currentTarget as HTMLInputElement | HTMLSelectElement
      event.stopPropagation()
      if (event.key === 'Escape') {
        event.preventDefault()
        this.cancel(ref)
      } else if (event.key === 'Enter') {
        event.preventDefault()
        this.commit(ref, field.value, original, 'down', grid)
      } else if (event.key === 'Tab') {
        event.preventDefault()
        this.commit(ref, field.value, original, event.shiftKey ? 'previous' : 'next', grid)
      }
    }
    // Leaving the field saves it; a refused value stays open until Enter or Escape.
    const onBlur = (event: FocusEvent): void => {
      if (mode.error || !this.editing || cellKey(this.editing) !== cellKey(ref)) return
      this.commit(ref, (event.currentTarget as HTMLInputElement).value, original, null, grid)
    }
    const classes = classMap({
      'lintje-data-table__editor': true,
      'focus-inset': true,
      'is-error': Boolean(mode.error),
    })
    const editor = column.editor
    const field =
      editor?.kind === 'select'
        ? html`<select
            class=${classes}
            aria-label=${label}
            aria-invalid=${mode.error ? 'true' : nothing}
            aria-describedby=${errorId ?? nothing}
            @keydown=${onKeydown}
            @blur=${onBlur}
          >
            ${(editor.options ?? []).map(
              (option) =>
                html`<option value=${option.value} ?selected=${option.value === mode.value}>
                  ${option.label ?? option.value}
                </option>`,
            )}
          </select>`
        : html`<input
            type="text"
            class=${classes}
            inputmode=${editor?.kind === 'number' ? 'decimal' : nothing}
            placeholder=${editor?.kind === 'date' ? 'dd-mm-jjjj' : nothing}
            aria-label=${label}
            aria-invalid=${mode.error ? 'true' : nothing}
            aria-describedby=${errorId ?? nothing}
            .value=${mode.value}
            @keydown=${onKeydown}
            @blur=${onBlur}
          />`
    return html`${field}${
      mode.error
        ? html`<span id=${errorId ?? nothing} class="lintje-data-table__edit-error">${mode.error}</span>`
        : nothing
    }`
  }

  cellClasses(ref: TableCellRef, original: CellValue): Record<string, boolean> {
    const mode = this.mode(ref, original)
    return {
      'lintje-data-table__cell--editable': true,
      'is-editing': mode.kind === 'editor',
      'is-busy': mode.kind === 'busy',
    }
  }

  cellKeydown(ref: TableCellRef, event: KeyboardEvent): void {
    if (event.target !== event.currentTarget) return
    if (event.key !== 'Enter' && event.key !== 'F2') return
    // The row's own Enter (drilldown) must not fire as well.
    event.preventDefault()
    event.stopPropagation()
    this.open(ref, event.currentTarget as Element)
  }

  renderStatus(): TemplateResult {
    return html`<span id=${this.hintId} class="visually-hidden">Bewerkbaar met Enter of F2</span
      ><span class="visually-hidden" role="status">${this.message}</span>`
  }
}
