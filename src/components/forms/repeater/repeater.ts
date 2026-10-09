/**
 * `<lintje-repeater>` — a group of fields that repeats. The host writes the rows and owns the
 * list; the repeater asks, numbers and names the rows, and bounds them by `min` and `max`.
 * After an add, focus goes to the new row's first field; after a remove, to the remove button
 * of the row above (the add button when none is left). A live region says both.
 * It keeps no values and draws no undo toast.
 *
 * Events: `lintje-row-add` (detail: the index the new row gets) from the repeater, and
 * `lintje-row-remove` (detail: the row's index) from the row; both bubble and are composed.
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { LintjeElement, define } from '../../../core/element'
import { shadowCss } from '../../../core/styles'
import '../../../primitives/button/button'
import '../../../primitives/icon-button/icon-button'
import repeaterCss from './repeater.css?inline'
import repeaterRowCss from './repeater-row.css?inline'

const FOCUSABLE = 'input, select, textarea, button, [contenteditable="true"], [tabindex]'

/** The first focusable control inside an element, through the shadow roots on the way. */
export function firstFocusable(root: Element): HTMLElement | null {
  const candidate = root as HTMLElement
  if (
    candidate.matches(FOCUSABLE) &&
    !candidate.matches(':disabled') &&
    candidate.getAttribute('tabindex') !== '-1'
  ) {
    return candidate
  }
  // Light children first: in a row the slotted fields come before the row's own remove button.
  for (const child of [...root.children, ...(root.shadowRoot?.children ?? [])]) {
    const found = firstFocusable(child)
    if (found) return found
  }
  return null
}

export class LintjeRepeaterRow extends LintjeElement {
  static override styles = shadowCss(repeaterRowCss)

  static override properties: PropertyDeclarations = {
    index: { type: Number, reflect: true },
    label: { type: String },
    removable: { type: Boolean },
    disabled: { type: Boolean, reflect: true },
  }

  // The repeater sets these three.
  index: number = 0
  label: string = ''
  removable: boolean = true
  disabled: boolean = false

  focusRemove(): void {
    const button = this.renderRoot.querySelector('lintje-icon-button')
    const inner = button?.shadowRoot?.querySelector<HTMLElement>('button') ?? button
    inner?.focus()
  }

  private requestRemove(): void {
    if (!this.removable || this.disabled) return
    this.emit('lintje-row-remove', this.index)
  }

  protected override render(): TemplateResult {
    // A group named after the row, so a reader hears which row a field belongs to.
    return html`<div class="lintje-repeater-row" role="group" aria-label=${this.label || nothing}>
      <div class="lintje-repeater-row__fields"><slot></slot></div>
      <lintje-icon-button
        class="lintje-repeater-row__remove"
        icon="functioneel-verwijderen"
        variant="outlined"
        label=${`${this.label || 'Rij'} verwijderen`}
        ?disabled=${!this.removable || this.disabled}
        @click=${this.requestRemove}
      ></lintje-icon-button>
    </div>`
  }
}

export class LintjeRepeater extends LintjeElement {
  static override styles = shadowCss(repeaterCss)

  static override properties: PropertyDeclarations = {
    legend: { type: String },
    itemLabel: { type: String, attribute: 'item-label' },
    addLabel: { type: String, attribute: 'add-label' },
    min: { type: Number },
    max: { type: Number },
    disabled: { type: Boolean, reflect: true },
    count: { state: true },
    spoken: { state: true },
  }

  legend: string = ''
  /** What one row is, "Betrokkene": it names the rows and their remove buttons. */
  itemLabel: string = ''
  /** The add button's text. Default: "<item-label> toevoegen", or "Rij toevoegen". */
  declare addLabel?: string
  min: number = 0
  declare max?: number
  disabled: boolean = false

  protected count: number = 0
  protected spoken: string = ''

  /** The reader's last request, so focus can follow once the host has answered. */
  private pending: { kind: 'add' } | { kind: 'remove'; index: number } | null = null

  private readonly onRowRemove = (event: Event): void => {
    const index = (event as CustomEvent<number>).detail
    this.pending = { kind: 'remove', index }
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.addEventListener('lintje-row-remove', this.onRowRemove)
  }

  override disconnectedCallback(): void {
    this.removeEventListener('lintje-row-remove', this.onRowRemove)
    super.disconnectedCallback()
  }

  private name(index: number): string {
    return `${this.itemLabel || 'Rij'} ${index + 1}`
  }

  private get rows(): Element[] {
    const slot = this.renderRoot.querySelector('slot')
    return slot ? slot.assignedElements() : [...this.children]
  }

  private get atMax(): boolean {
    return this.max != null && this.count >= this.max
  }

  private sync(): void {
    const rows = this.rows
    const before = this.count
    this.count = rows.length
    rows.forEach((row, index) => {
      if (!(row instanceof LintjeRepeaterRow)) return
      row.index = index
      row.label = this.name(index)
      row.removable = rows.length > this.min
      row.disabled = this.disabled
    })

    const pending = this.pending
    if (pending?.kind === 'add' && rows.length > before) {
      this.pending = null
      this.spoken = `${this.name(rows.length - 1)} toegevoegd`
      const row = rows[rows.length - 1]
      void this.afterRows(row).then(() => firstFocusable(row)?.focus())
    } else if (pending?.kind === 'remove' && rows.length < before) {
      this.pending = null
      this.spoken = `${this.name(pending.index)} verwijderd`
      const above = rows[Math.max(0, pending.index - 1)]
      void this.afterRows(above).then(() => {
        if (above instanceof LintjeRepeaterRow) above.focusRemove()
        else this.focusAdd()
      })
    }
  }

  private async afterRows(row: Element | undefined): Promise<void> {
    await this.updateComplete
    if (row instanceof LintjeElement) await row.updateComplete
    // One more frame lets the fields in the row render.
    await new Promise((resolve) => requestAnimationFrame(resolve))
  }

  private focusAdd(): void {
    const button = this.renderRoot.querySelector('lintje-button')
    const inner = button?.shadowRoot?.querySelector<HTMLElement>('button') ?? button
    inner?.focus()
  }

  private add(): void {
    if (this.atMax || this.disabled) return
    this.pending = { kind: 'add' }
    this.emit('lintje-row-add', this.count)
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (changed.has('min') || changed.has('disabled') || changed.has('itemLabel')) this.sync()
  }

  protected override render(): TemplateResult {
    const addLabel =
      this.addLabel ?? (this.itemLabel ? `${this.itemLabel} toevoegen` : 'Rij toevoegen')
    return html`<fieldset class="lintje-repeater" ?disabled=${this.disabled}>
      <legend class="lintje-repeater__legend">${this.legend}</legend>
      <div class="lintje-repeater__body">
      <div class="lintje-repeater__rows"><slot @slotchange=${this.sync}></slot></div>
      <div class="lintje-repeater__foot">
        <lintje-button
          variant="secondary"
          icon="functioneel-plus"
          ?disabled=${this.atMax || this.disabled}
          @click=${this.add}
          >${addLabel}</lintje-button
        >
        ${
          this.max != null
            ? html`<span class="lintje-repeater__count">${this.count} van hoogstens ${this.max}</span>`
            : nothing
        }
      </div>
      </div>
      <span class="visually-hidden" aria-live="polite">${this.spoken}</span>
    </fieldset>`
  }
}

define('lintje-repeater-row', LintjeRepeaterRow)
define('lintje-repeater', LintjeRepeater)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-repeater': LintjeRepeater
    'lintje-repeater-row': LintjeRepeaterRow
  }
}
