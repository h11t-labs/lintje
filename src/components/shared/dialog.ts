/**
 * What every modal window does while it is open: it locks the page's scroll, keeps the focus
 * inside and answers Escape only when it is the window on top.
 */
import { holdOverflow, lockScroll } from '../../core/host-config'
import { FocusTrap } from './focus-trap'

export interface HoldOptions {
  /** As `FocusTrap.activate`; `false` leaves it, for a window that moves it once its content has drawn. */
  focus?: boolean | HTMLElement
  /** The element that scrolls behind the window, when the host names one; else the page. */
  scroller?: HTMLElement | null
}

export class DialogHold {
  readonly #trap = new FocusTrap()
  readonly #onEscape: () => void
  #released: (() => void) | null = null

  // An Escape something inside already answered (`preventDefault`) is not the window's.
  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && !event.defaultPrevented && this.#trap.isTopmost()) this.#onEscape()
  }

  /** `onEscape` runs only for the window on top; a window with its own condition checks it there. */
  constructor(onEscape: () => void) {
    this.#onEscape = onEscape
  }

  get held(): boolean {
    return this.#released !== null
  }

  isTopmost(): boolean {
    return this.#trap.isTopmost()
  }

  hold(container: HTMLElement, { focus = false, scroller }: HoldOptions = {}): void {
    if (this.#released) return
    this.#released = scroller ? holdOverflow(scroller) : lockScroll()
    document.addEventListener('keydown', this.#onKeyDown)
    this.#trap.activate(container, { focus })
  }

  release(): void {
    if (!this.#released) return
    document.removeEventListener('keydown', this.#onKeyDown)
    this.#released()
    this.#released = null
    this.#trap.deactivate()
  }
}
