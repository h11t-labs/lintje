/**
 * Actions that do not fit on one line give way to one menu, "Meer", in front of the ones that
 * stay: the page header's actions today. `overflowCount` is the arithmetic; `OverflowController`
 * measures and applies it for an element whose actions are slotted `lintje-button`s.
 *
 * Both widths compared are independent of the outcome, so the choice cannot flip back and forth:
 * an action in the menu stays laid out, invisible (`data-lintje-overflow`, hidden by the owner's
 * `::slotted` rule), and the menu's trigger stays laid out the same way while it is spare, so
 * every natural width can be read in either state. The owner's order is the priority: the first
 * action goes first, the last never goes, and a menu of one row does not exist.
 */
import type { ReactiveController, ReactiveControllerHost } from 'lit'
import { passFocus } from '../../core/focus'
import type { LintjeButton } from '../actions/button/button'
import type { MenuEntry } from '../actions/menu-button/menu-button'
import { FrameResizeObserver } from './frame-resize-observer'

export interface OverflowItem {
  width: number
  /** Never goes into the menu: the last action, and anything that is not a button. */
  fixed: boolean
}

/**
 * How many of the collapsible items, from the first, go into the menu so that the rest and the
 * menu's trigger fit in `room` on one line. One alone never goes: then two go, or, with no second
 * one to go with it, none.
 */
export function overflowCount(
  items: OverflowItem[],
  menuWidth: number,
  gap: number,
  room: number,
): number {
  const collapsible = items.filter((item) => !item.fixed).length
  const need = (hidden: number): number => {
    let skipped = 0
    let width = 0
    let shown = 0
    for (const item of items) {
      if (!item.fixed && skipped < hidden) {
        skipped += 1
        continue
      }
      width += item.width
      shown += 1
    }
    if (hidden > 0) {
      width += menuWidth
      shown += 1
    }
    return width + gap * Math.max(0, shown - 1)
  }
  let hidden = collapsible
  for (let n = 0; n <= collapsible; n += 1) {
    if (need(n) <= room + 0.5) {
      hidden = n
      break
    }
  }
  if (hidden === 1) hidden = collapsible >= 2 ? 2 : 0
  return hidden
}

export interface OverflowHost extends ReactiveControllerHost, HTMLElement {
  readonly renderRoot: HTMLElement | DocumentFragment
}

export interface OverflowOptions {
  /** The box the actions must fit in on one line, in the host's render root. */
  row: string
  /** The `lintje-menu-button` that is "Meer", in the host's render root. */
  menu: string
  /** The name of the slot the actions are in. */
  slot: string
}

const OVERFLOW = 'data-lintje-overflow'

export class OverflowController implements ReactiveController {
  /** The buttons that went into the menu, in order. */
  collapsed: LintjeButton[] = []

  // A frame later: measuring is cheap, but what follows changes the row's height.
  #observer = new FrameResizeObserver(() => this.measure())
  #observed: Element[] = []

  constructor(
    private readonly host: OverflowHost,
    private readonly options: OverflowOptions,
  ) {
    host.addController(this)
  }

  hostDisconnected(): void {
    this.#observer.disconnect()
    this.#observed = []
    this.#apply([])
  }

  hostUpdated(): void {
    this.measure()
  }

  /** The actions in the slot, in order. */
  get actions(): HTMLElement[] {
    return [...this.host.children].filter(
      (child): child is HTMLElement =>
        child instanceof HTMLElement && child.slot === this.options.slot,
    )
  }

  /** The menu's rows: one per collapsed button, a danger button after a separator. */
  items(): MenuEntry[] {
    const rows: MenuEntry[] = []
    this.collapsed.forEach((button, index) => {
      const danger = (button.variant ?? '').startsWith('danger')
      if (danger && rows.length > 0 && rows[rows.length - 1] !== 'separator') rows.push('separator')
      const disabled = Boolean(button.disabled || button.busy)
      rows.push({
        value: String(index),
        label: button.textContent?.trim() || button.label || '',
        icon: button.icon,
        href: disabled ? undefined : button.href,
        disabled,
        reason: button.reason,
        danger,
      })
    })
    return rows
  }

  /** A chosen row clicks its button, so the owner's own listener sees the click. */
  activate(value: string): void {
    this.collapsed[Number(value)]?.click()
  }

  /**
   * Reads the room and every natural width, and writes the outcome straight onto the actions and
   * the menu, after a render (`hostUpdated`) or a frame after the observer, never inside it: a
   * synchronous change there would resize the row during the observer's own delivery. A render
   * asked for here would draw the host twice.
   */
  measure(): void {
    const root = this.host.renderRoot
    const row = root.querySelector<HTMLElement>(this.options.row)
    const menu = root.querySelector<HTMLElement & { items: MenuEntry[] }>(this.options.menu)
    const actions = this.actions
    this.#observe(row ? [row, ...actions] : [])
    if (!row || !menu) return
    const buttons = actions.filter(isButton)
    const primary = buttons[buttons.length - 1]
    const items = actions.map((action) => ({
      width: action.getBoundingClientRect().width,
      fixed: !isButton(action) || action === primary,
    }))
    // The gap between the actions is the menu's parent's, not the row's.
    const gap = parseFloat(getComputedStyle(menu.parentElement ?? row).columnGap) || 0
    const count = overflowCount(
      items,
      menu.getBoundingClientRect().width,
      gap,
      row.getBoundingClientRect().width,
    )
    const collapsed = buttons.filter((button) => button !== primary).slice(0, count)
    // A menu drawn anew has none of this yet: written after every render, and before the actions
    // go into it, so it can take the focus of the one that goes.
    const spare = collapsed.length === 0
    menu.classList.toggle('is-spare', spare)
    menu.inert = spare
    if (!sameList(collapsed, this.collapsed)) {
      this.collapsed = collapsed
      this.#apply(collapsed, menu)
    }
    menu.items = this.items()
  }

  #apply(collapsed: HTMLElement[], menu?: HTMLElement): void {
    for (const action of this.actions) {
      const hidden = collapsed.includes(action)
      // Made inert with the focus on it, it would drop the focus to the page.
      if (hidden && !action.inert && menu) passFocus(action, [menu])
      if (hidden) action.setAttribute(OVERFLOW, '')
      else action.removeAttribute(OVERFLOW)
      action.inert = hidden
    }
  }

  #observe(boxes: Element[]): void {
    if (sameList(boxes, this.#observed)) return
    this.#observer.disconnect()
    for (const box of boxes) this.#observer.observe(box)
    this.#observed = boxes
  }
}

function isButton(element: Element): element is LintjeButton {
  return element.localName === 'lintje-button'
}

function sameList(a: readonly Element[], b: readonly Element[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index])
}
