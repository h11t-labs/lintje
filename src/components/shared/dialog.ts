/**
 * What every modal window does while it is open: it locks the page's scroll, keeps the focus
 * inside and answers Escape only when it is the window on top.
 */
import { lockScroll } from '../../core/host-config'
import { FocusTrap } from './focus-trap'

export class DialogHold {
  readonly #trap = new FocusTrap()
  readonly #onEscape: () => void
  #released: (() => void) | null = null

  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.#trap.isTopmost()) this.#onEscape()
  }

  constructor(onEscape: () => void) {
    this.#onEscape = onEscape
  }

  get held(): boolean {
    return this.#released !== null
  }

  isTopmost(): boolean {
    return this.#trap.isTopmost()
  }

  /** The focus stays where it is: the window moves it once its content has drawn. */
  hold(container: HTMLElement): void {
    if (this.#released) return
    this.#released = lockScroll()
    document.addEventListener('keydown', this.#onKeyDown)
    this.#trap.activate(container, { focus: false })
  }

  release(): void {
    if (!this.#released) return
    document.removeEventListener('keydown', this.#onKeyDown)
    this.#released()
    this.#released = null
    this.#trap.deactivate()
  }
}
