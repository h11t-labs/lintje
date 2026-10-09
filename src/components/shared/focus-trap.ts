/**
 * Keeps the keyboard inside an open dialog and gives the focus back to its opener.
 *
 * Focusables are counted at key time, through the composed tree (slots and shadow roots), and
 * skip anything not rendered or `visibility: hidden`. Traps stack: only the topmost acts, so
 * one Escape closes one dialog (`isTopmost()`). A popup that is no dialog asks
 * `ownsEscape(this)` (`core/focus.ts`, re-exported here).
 */

import { deepActiveElement } from '../../core/focus'

export { deepActiveElement, modalAround, ownsEscape } from '../../core/focus'

const FOCUSABLE = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]',
].join(',')

/** Whether `node` stands inside `container` in the composed tree, slotted content included. */
function composedContains(container: Element, node: Node | null): boolean {
  const slotted = Array.from(container.querySelectorAll('slot'), (slot) =>
    slot.assignedElements({ flatten: true }),
  ).flat()
  while (node) {
    if (node === container || slotted.includes(node as Element)) return true
    node = node.parentNode ?? (node instanceof ShadowRoot ? node.host : null)
  }
  return false
}

function isTabbable(element: HTMLElement): boolean {
  if (!element.matches(FOCUSABLE) || element.tabIndex < 0) return false
  // `visibilityProperty`: a closed disclosure is rendered but `visibility: hidden`.
  return typeof element.checkVisibility === 'function'
    ? element.checkVisibility({ visibilityProperty: true })
    : true
}

/** Every element under `root` that Tab stops on, in composed-tree order. */
export function tabbables(root: ParentNode): HTMLElement[] {
  const found: HTMLElement[] = []
  const visit = (element: Element): void => {
    if (element.hasAttribute('inert') || element.hasAttribute('hidden')) return
    if (element instanceof HTMLElement && isTabbable(element)) found.push(element)
    const children =
      element instanceof HTMLSlotElement
        ? element.assignedElements({ flatten: true })
        : Array.from((element.shadowRoot ?? element).children)
    for (const child of children) visit(child)
  }
  for (const child of Array.from(root.children)) visit(child)
  return found
}

/** The element itself when Tab stops on it, else its first stop (through its shadow root). */
export function focusTarget(element: HTMLElement): HTMLElement {
  if (isTabbable(element)) return element
  return tabbables(element.shadowRoot ?? element)[0] ?? element
}

/** The active traps, oldest first. */
const stack: FocusTrap[] = []

export class FocusTrap {
  #container: HTMLElement | null = null
  #opener: HTMLElement | null = null

  isTopmost(): boolean {
    return this.#container !== null && stack[stack.length - 1] === this
  }

  readonly #onKeyDown = (event: KeyboardEvent): void => {
    const container = this.#container
    if (event.key !== 'Tab' || !container?.isConnected || !this.isTopmost()) return
    const list = tabbables(container)
    if (list.length === 0) {
      event.preventDefault()
      container.focus()
      return
    }
    const index = list.indexOf(deepActiveElement() as HTMLElement)
    const first = list[0] as HTMLElement
    const last = list[list.length - 1] as HTMLElement
    if (event.shiftKey && index <= 0) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (index === -1 || index === list.length - 1)) {
      event.preventDefault()
      first.focus()
    }
  }

  readonly #onFocusIn = (): void => {
    const container = this.#container
    if (!container?.isConnected || !this.isTopmost()) return
    if (composedContains(container, deepActiveElement())) return
    container.focus()
  }

  /**
   * Remembers the focused element and focuses `container`, or `focus` when it is an element;
   * `false` leaves the focus. Activated again while active, it keeps the original opener.
   */
  activate(container: HTMLElement, { focus = true }: { focus?: boolean | HTMLElement } = {}): void {
    const opener = this.#container ? this.#opener : deepActiveElement()
    if (this.#container) this.deactivate(false)
    this.#opener = opener
    this.#container = container
    stack.push(this)
    document.addEventListener('keydown', this.#onKeyDown)
    document.addEventListener('focusin', this.#onFocusIn)
    if (focus instanceof HTMLElement) focusTarget(focus).focus()
    else if (focus) container.focus()
  }

  /** Stops and, unless `restore` is false, refocuses the opener. May leave from mid-stack. */
  deactivate(restore: boolean = true): void {
    if (!this.#container) return
    document.removeEventListener('keydown', this.#onKeyDown)
    document.removeEventListener('focusin', this.#onFocusIn)
    const at = stack.indexOf(this)
    if (at !== -1) stack.splice(at, 1)
    this.#container = null
    const opener = this.#opener
    this.#opener = null
    if (restore && opener?.isConnected) opener.focus()
  }
}
