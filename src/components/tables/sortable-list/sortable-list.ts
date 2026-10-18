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
import { durationMs } from '../../../core/motion'
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
 * The place of a dragged row whose centre is at `centre`, now at `at`: it passes a neighbour when
 * it passes that neighbour's middle. `slots` are the middles of the places, top to bottom.
 */
export function dragIndex(slots: readonly number[], centre: number, at: number): number {
  let index = at
  while (index < slots.length - 1 && centre > slots[index + 1]!) index++
  while (index > 0 && centre < slots[index - 1]!) index--
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
  /** The middle of every place, measured when the drag began. */
  slots: number[]
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
    landing: { state: true },
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
  /** The grip pressed while a row is in the hand, until its click. */
  #pressed: string | null = null
  /** The row that was put down, lifted until it has slid into its place. */
  protected landing: string | null = null
  #landed?: ReturnType<typeof setTimeout>

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (changed.has('items')) this.order = this.items.map((item) => ({ ...item }))
  }

  override disconnectedCallback(): void {
    clearTimeout(this.#landed)
    super.disconnectedCallback()
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
    this.land(item.id, () => {
      this.order = moveItem(this.order, this.indexOf(item.id), from)
      this.#message.say(`${item.label} teruggezet op plaats ${from + 1}.`)
      this.grabbed = null
    })
    void this.focusGrip(item.id)
  }

  /** Puts the row in the hand down at the place of `target`'s row. */
  private dropAt(target: SortableItem): void {
    const grabbed = this.grabbed
    if (!grabbed) return
    const held = this.order[this.indexOf(grabbed.id)]
    if (!held) return
    this.land(held.id, () => {
      this.order = moveItem(this.order, this.indexOf(held.id), this.indexOf(target.id))
      this.putDown(held)
    })
    void this.focusGrip(held.id)
  }

  private onGripKeydown(event: KeyboardEvent, item: SortableItem): void {
    if (this.drag) {
      if (event.key !== 'Escape') return
      this.cancelDrag()
      event.preventDefault()
      event.stopPropagation()
      return
    }
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
          void this.slide(() => {
            this.order = moveItem(this.order, at, to)
          })
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
    this.#pressed = null
    if (event.button !== 0) return
    if (this.grabbed) {
      // The grip in the hand keeps the focus, so its blur does not put the row down; the click
      // on this grip does, and a release beside it changes nothing.
      event.preventDefault()
      this.#pressed = item.id
      return
    }
    const from = this.indexOf(item.id)
    const slots = this.rows().map((row) => {
      const box = row.getBoundingClientRect()
      return box.top + box.height / 2
    })
    const grip = event.currentTarget as HTMLElement
    grip.setPointerCapture?.(event.pointerId)
    event.preventDefault()
    // The grip takes the focus, so Escape can put the rows back during the drag.
    grip.focus()
    this.drag = {
      id: item.id,
      from,
      to: from,
      startY: event.clientY,
      dy: 0,
      slots,
      pointerId: event.pointerId,
    }
    this.#message.say(`${item.label} opgepakt. ${this.place(from)}`)
  }

  private onPointerMove(event: PointerEvent): void {
    const drag = this.drag
    if (!drag || event.pointerId !== drag.pointerId) return
    const dy = event.clientY - drag.startY
    const to = dragIndex(drag.slots, (drag.slots[drag.from] ?? 0) + dy, drag.to)
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
    // The row settles from under the pointer into the gap the others left it.
    this.land(item.id, () => {
      this.order = moveItem(this.order, drag.from, drag.to)
      this.#message.say(`${item.label} neergelegd op plaats ${drag.to + 1}.`)
      this.drag = null
      this.commit(drag.to !== drag.from)
    })
    void this.focusGrip(item.id)
  }

  /** A drag that is cancelled puts every row back and tells nothing. */
  private cancelDrag(): void {
    const drag = this.drag
    if (!drag) return
    this.land(drag.id, () => {
      this.drag = null
    })
    this.#message.clear()
  }

  private onGripClick(item: SortableItem): void {
    const pressed = this.#pressed
    this.#pressed = null
    if (pressed === item.id) this.dropAt(item)
  }

  private onPointerCancel(): void {
    this.#pressed = null
    this.cancelDrag()
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

  /* --- Motion -------------------------------------------------------------- */

  private rows(): HTMLElement[] {
    return [...this.renderRoot.querySelectorAll<HTMLElement>('.lintje-sortable-list__row')]
  }

  /**
   * Changes the order, and the rows slide from where they stood to their new place: inverted on
   * `translate`, which a drag's `transform` leaves alone, and let go on the row's transition.
   */
  private async slide(change: () => void): Promise<void> {
    const before = new Map(
      this.rows().map((row) => [row.dataset.id, row.getBoundingClientRect().top]),
    )
    change()
    await this.updateComplete
    const rows = this.rows()
    for (const row of rows) {
      row.style.setProperty('transition', 'none')
      row.style.removeProperty('translate')
    }
    const shifts = rows.map((row) => {
      const top = before.get(row.dataset.id)
      return top === undefined ? 0 : top - row.getBoundingClientRect().top
    })
    rows.forEach((row, index) => {
      if (shifts[index]) row.style.setProperty('translate', `0 ${shifts[index]}px`)
    })
    // The shifted place is styled before the transition comes back, so it runs from there.
    void rows[0]?.offsetHeight
    for (const row of rows) {
      row.style.removeProperty('transition')
      row.style.removeProperty('translate')
    }
  }

  /** A slide after which the row `id` keeps its lifted look until it has landed. */
  private land(id: string, change: () => void): void {
    this.landing = id
    clearTimeout(this.#landed)
    void this.slide(change).then(() => {
      this.#landed = setTimeout(() => (this.landing = null), durationMs(this, '--dur-base'))
    })
  }

  /* --- Drawing ------------------------------------------------------------- */

  /** How far a row moves out of the way of the dragged one: to the place next to it. */
  private shift(index: number): number | null {
    const drag = this.drag
    if (!drag || index === drag.from) return null
    const { from, to, slots } = drag
    if (from < to && index > from && index <= to) return slots[index - 1]! - slots[index]!
    if (to < from && index >= to && index < from) return slots[index + 1]! - slots[index]!
    return null
  }

  private row(item: SortableItem, index: number): TemplateResult {
    const dragging = this.drag?.id === item.id
    const lifted = dragging || this.grabbed?.id === item.id
    const shift = this.shift(index)
    return html`<li
      data-id=${item.id}
      class=${classMap({
        'lintje-sortable-list__row': true,
        'is-lifted': lifted || this.landing === item.id,
        'is-dragging': dragging,
      })}
      ${styleProps({
        transform: dragging ? `translateY(${this.drag!.dy}px)` : null,
        translate: shift ? `0 ${shift}px` : null,
      })}
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
        @mousedown=${(event: MouseEvent) => {
          // Where a browser still sends it, the grip in the hand keeps the focus here too.
          if (this.grabbed) event.preventDefault()
        }}
        @pointermove=${(event: PointerEvent) => this.onPointerMove(event)}
        @pointerup=${(event: PointerEvent) => this.onPointerUp(event, item)}
        @pointercancel=${() => this.onPointerCancel()}
        @click=${() => this.onGripClick(item)}
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
    return html`<div class="lintje-sortable-list">
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
