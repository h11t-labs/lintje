/**
 * `<lintje-sortable-list>` — rows reordered by dragging a grip or with the keyboard.
 *
 * Only the grip starts a drag, so on a phone the list still scrolls under a finger. It reorders
 * its own copy of `items` until the host sends new ones, and tells an order once, when a row is
 * put down at a new place.
 *
 * Events: `lintje-change` `string[]` (the ids in order), `lintje-values-change`
 * `{ [name]: value }` (with a `name`), `lintje-checked-change` `string[]` (with `checkable`).
 */
import {
  html,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit'
import { classMap } from 'lit/directives/class-map.js'
import { repeat } from 'lit/directives/repeat.js'
import { LintjeElement, define } from '../../../core/element'
import { styleProps } from '../../../core/style-props'
import { shadowCss } from '../../../core/styles'
import { iconStyles, renderIcon } from '../../../icons/render'
import '../../inputs/checkbox/checkbox'
import { LiveMessage } from '../../shared/live-message'
import sortableListCss from './sortable-list.css?inline'

export interface SortableItem {
  id: string
  label: string
  /** With `checkable`: whether the box is ticked. */
  checked?: boolean
}

export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const target = Math.max(0, Math.min(list.length - 1, to))
  if (from === target || from < 0 || from >= list.length) return [...list]
  const next = [...list]
  const [entry] = next.splice(from, 1)
  next.splice(target, 0, entry as T)
  return next
}

/**
 * Where a dragged row lands: how many of the other rows (`middles`, top to bottom) are above it.
 * A row gives way once the dragged row covers half of it, the same going up as going down: the
 * rows above are passed by its `top` edge, the rows below by its `bottom`.
 */
export function dropIndex(
  middles: readonly number[],
  from: number,
  top: number,
  bottom: number,
): number {
  let index = 0
  while (index < middles.length && middles[index]! < (index < from ? top : bottom)) index++
  return index
}

/** How far a pointer may wander, in px, and still count as a tap rather than a drag. */
const TAP_SLOP = 4

interface Drag {
  id: string
  from: number
  to: number
  startY: number
  dy: number
  /** The dragged row's edges where it was picked up. */
  top: number
  bottom: number
  middles: number[]
  /** How far a row moves to make room: its height and the gap. */
  step: number
  /** Whether the grip had the focus before the press, which cancels the browser's own focus. */
  focused: boolean
  pointerId: number
}

export class LintjeSortableList extends LintjeElement {
  static override styles = [iconStyles, shadowCss(sortableListCss)]

  static override properties: PropertyDeclarations = {
    items: { attribute: false },
    name: { type: String },
    label: { type: String },
    checkable: { type: Boolean, reflect: true },
    order: { state: true },
    grabbed: { state: true },
    drag: { state: true },
  }

  items: SortableItem[] = []
  /** The filter key. Without it an order is only told to the component that drew the list. */
  name: string = ''
  declare label?: string
  /** A checkbox in every row, labelled with the row's name. */
  checkable: boolean = false
  protected order: SortableItem[] = []
  protected grabbed: { id: string; from: number } | null = null
  protected drag: Drag | null = null
  readonly #message = new LiveMessage(this)

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (changed.has('items')) this.order = this.items.map((item) => ({ ...item }))
  }

  private indexOf(id: string): number {
    return this.order.findIndex((item) => item.id === id)
  }

  private place(index: number): string {
    return `Plaats ${index + 1} van ${this.order.length}.`
  }

  private commit(moved: boolean): void {
    if (!moved) return
    const ids = this.order.map((item) => item.id)
    this.emitLocal('lintje-change', ids)
    if (this.name) this.emit('lintje-values-change', { [this.name]: ids })
  }

  private async focusGrip(id: string): Promise<void> {
    await this.updateComplete
    const grip = [
      ...this.renderRoot.querySelectorAll<HTMLElement>('.lintje-sortable-list__grip'),
    ].find((element) => element.dataset.id === id)
    grip?.focus()
  }

  /* --- Keyboard ------------------------------------------------------------ */

  private pickUp(item: SortableItem): void {
    const from = this.indexOf(item.id)
    this.grabbed = { id: item.id, from }
    this.#message.say(`${item.label} opgepakt. ${this.place(from)}`)
  }

  private putDown(item: SortableItem): void {
    if (!this.grabbed) return
    const at = this.indexOf(item.id)
    this.#message.say(`${item.label} neergelegd op plaats ${at + 1}.`)
    const moved = at !== this.grabbed.from
    this.grabbed = null
    this.commit(moved)
  }

  private putBack(item: SortableItem): void {
    if (!this.grabbed) return
    const { from } = this.grabbed
    this.order = moveItem(this.order, this.indexOf(item.id), from)
    this.#message.say(`${item.label} teruggezet op plaats ${from + 1}.`)
    this.grabbed = null
    void this.focusGrip(item.id)
  }

  /** Puts the row in the hand down at the place of `target`'s row. */
  private dropAt(target: SortableItem): void {
    const grabbed = this.grabbed
    if (!grabbed) return
    const held = this.order[this.indexOf(grabbed.id)]
    if (!held) return
    this.order = moveItem(this.order, this.indexOf(held.id), this.indexOf(target.id))
    this.putDown(held)
    void this.focusGrip(held.id)
  }

  private onGripKeydown(event: KeyboardEvent, item: SortableItem): void {
    const holding = this.grabbed?.id === item.id
    switch (event.key) {
      case ' ':
      case 'Enter':
        if (holding) this.putDown(item)
        else this.pickUp(item)
        break
      case 'ArrowUp':
      case 'ArrowDown': {
        if (!holding) return
        const at = this.indexOf(item.id)
        const to = Math.max(
          0,
          Math.min(this.order.length - 1, at + (event.key === 'ArrowUp' ? -1 : 1)),
        )
        if (to !== at) {
          this.order = moveItem(this.order, at, to)
          void this.focusGrip(item.id)
        }
        this.#message.say(this.place(to))
        break
      }
      case 'Escape':
        if (!holding) return
        this.putBack(item)
        break
      default:
        return
    }
    event.preventDefault()
    event.stopPropagation()
  }

  private onGripBlur(item: SortableItem): void {
    if (this.grabbed?.id !== item.id) return
    // A move re-renders the grip; it is focused again at once, so only a real leave counts.
    requestAnimationFrame(() => {
      const active = this.renderRoot instanceof ShadowRoot ? this.renderRoot.activeElement : null
      if (this.grabbed?.id === item.id && (active as HTMLElement | null)?.dataset.id !== item.id) {
        this.putDown(item)
      }
    })
  }

  /* --- Pointer ------------------------------------------------------------- */

  private onPointerDown(event: PointerEvent, item: SortableItem): void {
    if (event.button !== 0) return
    if (this.grabbed) {
      // A row in the hand goes down where the tapped grip stands, before the blur can drop it.
      event.preventDefault()
      this.dropAt(item)
      return
    }
    const rows = [...this.renderRoot.querySelectorAll<HTMLElement>('.lintje-sortable-list__row')]
    const from = this.indexOf(item.id)
    const boxes = rows.map((row) => row.getBoundingClientRect())
    const middles = boxes
      .filter((_, index) => index !== from)
      .map((box) => box.top + box.height / 2)
    const step = boxes.length > 1 ? boxes[1]!.top - boxes[0]!.top : 0
    const target = event.currentTarget as HTMLElement
    const focused = target.matches(':focus')
    target.setPointerCapture?.(event.pointerId)
    event.preventDefault()
    this.drag = {
      id: item.id,
      from,
      to: from,
      startY: event.clientY,
      dy: 0,
      top: boxes[from]!.top,
      bottom: boxes[from]!.bottom,
      middles,
      step,
      focused,
      pointerId: event.pointerId,
    }
    this.#message.say(`${item.label} opgepakt. ${this.place(from)}`)
  }

  private onPointerMove(event: PointerEvent): void {
    const drag = this.drag
    if (!drag || event.pointerId !== drag.pointerId) return
    const dy = event.clientY - drag.startY
    const to = dropIndex(drag.middles, drag.from, drag.top + dy, drag.bottom + dy)
    if (to !== drag.to) this.#message.say(this.place(to))
    this.drag = { ...drag, dy, to }
  }

  private onPointerUp(event: PointerEvent, item: SortableItem): void {
    const drag = this.drag
    if (!drag || event.pointerId !== drag.pointerId) return
    if (drag.to === drag.from && Math.abs(drag.dy) < TAP_SLOP) {
      this.drag = null
      this.pickUp(item)
      void this.focusGrip(item.id)
      return
    }
    this.order = moveItem(this.order, drag.from, drag.to)
    this.#message.say(`${item.label} neergelegd op plaats ${drag.to + 1}.`)
    this.drag = null
    this.commit(drag.to !== drag.from)
    // A grip that had the focus keeps it through the move; one that had none gets none.
    if (drag.focused) void this.focusGrip(item.id)
  }

  private onPointerCancel(): void {
    if (!this.drag) return
    this.drag = null
    this.#message.clear()
  }

  /* --- Boxes --------------------------------------------------------------- */

  private onCheck(event: CustomEvent<boolean>, item: SortableItem): void {
    // The box has no name: its lintje-change is for this list alone.
    event.stopPropagation()
    this.order = this.order.map((entry) =>
      entry.id === item.id ? { ...entry, checked: event.detail } : entry,
    )
    this.emit(
      'lintje-checked-change',
      this.order.filter((entry) => entry.checked).map((entry) => entry.id),
    )
  }

  /* --- Drawing ------------------------------------------------------------- */

  /** How far a row stands from its place while another is dragged: it makes room for the drop. */
  private offset(index: number): number | null {
    const drag = this.drag
    if (!drag) return null
    if (index === drag.from) return drag.dy
    if (drag.from < index && index <= drag.to) return -drag.step
    if (drag.to <= index && index < drag.from) return drag.step
    return 0
  }

  private row(item: SortableItem, index: number): TemplateResult {
    const dragging = this.drag?.id === item.id
    const lifted = dragging || this.grabbed?.id === item.id
    const offset = this.offset(index)
    return html`<li
      class=${classMap({
        'lintje-sortable-list__row': true,
        'is-lifted': lifted,
        'is-dragging': dragging,
      })}
      ${styleProps({ transform: offset ? `translateY(${offset}px)` : null })}
    >
      <button
        type="button"
        class="lintje-sortable-list__grip"
        data-id=${item.id}
        aria-label=${`${item.label} verplaatsen`}
        aria-pressed=${lifted ? 'true' : 'false'}
        aria-describedby="lintje-sortable-list-help"
        @keydown=${(event: KeyboardEvent) => this.onGripKeydown(event, item)}
        @blur=${() => this.onGripBlur(item)}
        @pointerdown=${(event: PointerEvent) => this.onPointerDown(event, item)}
        @pointermove=${(event: PointerEvent) => this.onPointerMove(event)}
        @pointerup=${(event: PointerEvent) => this.onPointerUp(event, item)}
        @pointercancel=${() => this.onPointerCancel()}
      >
        ${renderIcon('functioneel-sleep', { size: 16 })}
      </button>
      ${
        this.checkable
          ? html`<lintje-checkbox
              class="lintje-sortable-list__check"
              label=${item.label}
              ?checked=${Boolean(item.checked)}
              @lintje-change=${(event: CustomEvent<boolean>) => this.onCheck(event, item)}
            ></lintje-checkbox>`
          : html`<span class="lintje-sortable-list__label">${item.label}</span>`
      }
    </li>`
  }

  protected override render(): TemplateResult {
    return html`<div
      class=${classMap({ 'lintje-sortable-list': true, 'is-sorting': this.drag !== null })}
    >
      <ul class="lintje-sortable-list__rows" aria-label=${this.label ?? nothing}>
        ${repeat(
          this.order,
          (item) => item.id,
          (item, index) => this.row(item, index),
        )}
      </ul>
      <p id="lintje-sortable-list-help" class="visually-hidden">
        Spatie of Enter pakt op, pijl omhoog en omlaag verplaatsen, spatie of Enter legt neer,
        Escape zet terug. Of tik op de greep en daarna op de greep van de plaats waar de rij
        heen moet.
      </p>
      <p class="visually-hidden" role="status">${this.#message.text}</p>
    </div>`
  }
}

define('lintje-sortable-list', LintjeSortableList)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-sortable-list': LintjeSortableList
  }
}
