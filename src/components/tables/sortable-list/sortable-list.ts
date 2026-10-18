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

/** Where a dragged row lands: how many of the other rows (`middles`, top to bottom) are above. */
export function dropIndex(middles: readonly number[], pointerY: number): number {
  let index = 0
  while (index < middles.length && middles[index]! < pointerY) index++
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
  middles: number[]
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
    aim: { state: true },
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
  /** That grip while the press is on it: the drop line shows where the row will land. */
  protected aim: string | null = null
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
      this.aim = item.id
      // A finger is held by the grip it touched; let go, the grip hears it slide off.
      const grip = event.currentTarget as HTMLElement
      if (grip.hasPointerCapture?.(event.pointerId)) grip.releasePointerCapture(event.pointerId)
      return
    }
    const rows = [...this.renderRoot.querySelectorAll<HTMLElement>('.lintje-sortable-list__row')]
    const from = this.indexOf(item.id)
    const middles = rows
      .filter((_, index) => index !== from)
      .map((row) => {
        const box = row.getBoundingClientRect()
        return box.top + box.height / 2
      })
    ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
    event.preventDefault()
    this.drag = {
      id: item.id,
      from,
      to: from,
      startY: event.clientY,
      dy: 0,
      middles,
      pointerId: event.pointerId,
    }
    this.#message.say(`${item.label} opgepakt. ${this.place(from)}`)
  }

  private onPointerMove(event: PointerEvent): void {
    const drag = this.drag
    if (!drag || event.pointerId !== drag.pointerId) return
    const to = dropIndex(drag.middles, event.clientY)
    if (to !== drag.to) this.#message.say(this.place(to))
    this.drag = { ...drag, dy: event.clientY - drag.startY, to }
  }

  private onPointerUp(event: PointerEvent, item: SortableItem): void {
    this.aim = null
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
    // The press is cancelled, so no browser focuses the grip on its own.
    void this.focusGrip(item.id)
  }

  private onGripClick(item: SortableItem): void {
    const pressed = this.#pressed
    this.#pressed = null
    this.aim = null
    if (pressed === item.id) this.dropAt(item)
  }

  /** The pointer leaves or comes back to the pressed grip: the drop line goes or returns. */
  private onGripHover(event: PointerEvent, item: SortableItem): void {
    if (this.#pressed !== item.id) return
    this.aim = event.type === 'pointerenter' && event.buttons & 1 ? item.id : null
  }

  private onPointerCancel(): void {
    this.#pressed = null
    this.aim = null
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

  private dropLine(index: number): 'before' | 'after' | null {
    const drag = this.drag
    if (drag) {
      if (drag.to === drag.from || index === drag.from) return null
      const others = this.order.map((_, at) => at).filter((at) => at !== drag.from)
      if (drag.to < others.length) return others[drag.to] === index ? 'before' : null
      return others[others.length - 1] === index ? 'after' : null
    }
    // A press on another grip while a row is in the hand: the side of it the row lands on.
    if (!this.grabbed || this.aim === null) return null
    const from = this.indexOf(this.grabbed.id)
    const to = this.indexOf(this.aim)
    if (index !== to || from === to) return null
    return from < to ? 'after' : 'before'
  }

  private row(item: SortableItem, index: number): TemplateResult {
    const dragging = this.drag?.id === item.id
    const lifted = dragging || this.grabbed?.id === item.id
    const line = this.dropLine(index)
    return html`<li
      data-id=${item.id}
      class=${classMap({
        'lintje-sortable-list__row': true,
        'is-lifted': lifted || this.landing === item.id,
        'is-dragging': dragging,
        'is-drop-before': line === 'before',
        'is-drop-after': line === 'after',
      })}
      ${styleProps({ transform: dragging ? `translateY(${this.drag!.dy}px)` : null })}
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
        @pointerleave=${(event: PointerEvent) => this.onGripHover(event, item)}
        @pointerenter=${(event: PointerEvent) => this.onGripHover(event, item)}
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
      <p class="lintje-sortable-list__status" role="status">${this.#message.text}</p>
    </div>`
  }
}

define('lintje-sortable-list', LintjeSortableList)

declare global {
  interface HTMLElementTagNameMap {
    'lintje-sortable-list': LintjeSortableList
  }
}
