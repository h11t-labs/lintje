/**
 * Keeps the keyboard inside an open dialog and gives the focus back to its opener; when the opener
 * is gone, to the page's content.
 *
 * Focusables are counted at key time, through the composed tree (slots and shadow roots), and
 * skip anything not rendered or `visibility: hidden`. Traps stack: only the topmost acts, so
 * one Escape closes one dialog (`isTopmost()`). A popup that is no dialog asks
 * `ownsEscape(this)` (`core/focus.ts`, re-exported here).
 */

import { deepActiveElement, focusTarget, standsIn, tabbables } from '../../core/focus'

export { deepActiveElement, modalAround, ownsEscape } from '../../core/focus'
export { focusTarget, stopAfter, tabbables } from '../../core/focus'

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

/**
 * The stops Tab really makes: a group of radio buttons is one, its checked button or else its
 * first, as the browser steps.
 */
function radioStops(list: HTMLElement[]): HTMLElement[] {
  const isRadio = (element: HTMLElement): element is HTMLInputElement =>
    element instanceof HTMLInputElement && element.type === 'radio' && element.name !== ''
  return list.filter((element) => {
    if (!isRadio(element)) return true
    const group = list
      .filter(isRadio)
      .filter(
        (other) =>
          other.name === element.name &&
          other.form === element.form &&
          other.getRootNode() === element.getRootNode(),
      )
    return (group.find((radio) => radio.checked) ?? group[0]) === element
  })
}

/** A box that scrolls with nothing to focus in it: Chromium and Firefox stop Tab on it too. */
function scrollStop(element: HTMLElement): boolean {
  if (element.hasAttribute('tabindex')) return false
  const tall = element.scrollHeight > element.clientHeight
  const wide = element.scrollWidth > element.clientWidth
  if (!tall && !wide) return false
  const style = getComputedStyle(element)
  const scrolls = (value: string): boolean => value === 'auto' || value === 'scroll'
  if (!(tall && scrolls(style.overflowY)) && !(wide && scrolls(style.overflowX))) return false
  return tabbables(element.shadowRoot ?? element).length === 0
}

/** The stops of the window in Tab's order: its controls, a scroller, a radio group as one. */
const stops = (container: HTMLElement): HTMLElement[] =>
  radioStops(tabbables(container, scrollStop))

/** Focuses the first of `list` that takes it: a scroller does not in WebKit. */
function focusOneOf(list: HTMLElement[]): void {
  for (const stop of list) {
    stop.focus()
    if (deepActiveElement() === stop) return
  }
}

/**
 * The page's content, where the focus goes when the opener has left: the shell's `focusContent()`,
 * as its skip link, else the nearest `<main>` from `from` outwards.
 */
function focusContent(from: Node): void {
  const shell = document.querySelector('lintje-shell') as
    | (HTMLElement & { focusContent?: () => void })
    | null
  if (typeof shell?.focusContent === 'function') return shell.focusContent()
  for (let root = from.getRootNode(); ;) {
    const main = (root as ParentNode).querySelector?.<HTMLElement>('main')
    if (main) return main.focus()
    if (!(root instanceof ShadowRoot)) return
    root = root.host.getRootNode()
  }
}

/** The active traps, oldest first. */
const stack: FocusTrap[] = []

export class FocusTrap {
  #container: HTMLElement | null = null
  #opener: HTMLElement | null = null
  /** A Tab the browser takes, left to it: a step out of the window wraps around instead. */
  #stepping: 'forward' | 'back' | null = null

  isTopmost(): boolean {
    return this.#container !== null && stack[stack.length - 1] === this
  }

  // Only the real first and last stops wrap: from anything else inside, the browser takes the
  // step, as from a radio button or a scroller it made a stop.
  readonly #onKeyDown = (event: KeyboardEvent): void => {
    const container = this.#container
    if (event.key !== 'Tab' || !container?.isConnected || !this.isTopmost()) return
    const list = stops(container)
    if (list.length === 0) {
      event.preventDefault()
      container.focus()
      return
    }
    const active = deepActiveElement()
    const inside = active !== null && standsIn(active, container)
    if (event.shiftKey && (!inside || active === container || active === list[0])) {
      event.preventDefault()
      focusOneOf([...list].reverse())
    } else if (!event.shiftKey && (!inside || active === list[list.length - 1])) {
      event.preventDefault()
      focusOneOf(list)
    } else {
      this.#stepping = event.shiftKey ? 'back' : 'forward'
      requestAnimationFrame(() => (this.#stepping = null))
    }
  }

  readonly #onFocusIn = (): void => {
    const container = this.#container
    if (!container?.isConnected || !this.isTopmost()) return
    const stepping = this.#stepping
    this.#stepping = null
    if (composedContains(container, deepActiveElement())) return
    // A stop the trap does not know made the browser step out: around, as from the end.
    if (stepping)
      focusOneOf(stepping === 'back' ? [...stops(container)].reverse() : stops(container))
    else container.focus()
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

  /**
   * Stops and, unless `restore` is false, refocuses the opener; when that does not take the focus
   * (removed, hidden, disabled), the page's content does. May leave from mid-stack.
   */
  deactivate(restore: boolean = true): void {
    const container = this.#container
    if (!container) return
    document.removeEventListener('keydown', this.#onKeyDown)
    document.removeEventListener('focusin', this.#onFocusIn)
    const at = stack.indexOf(this)
    if (at !== -1) stack.splice(at, 1)
    this.#container = null
    const opener = this.#opener
    this.#opener = null
    if (!restore) return
    if (opener?.isConnected && opener !== document.body) opener.focus()
    if (!opener || deepActiveElement() !== opener) focusContent(container)
  }
}
