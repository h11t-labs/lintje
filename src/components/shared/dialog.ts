/**
 * What every modal window does while it is open: it locks the page's scroll, keeps the focus
 * inside, answers Escape only when it is the window on top, and claims the room its footer takes
 * at the bottom of the screen, so a toast stands above the footer's buttons.
 */
import { holdOverflow, lockScroll, scrollRoot } from '../../core/host-config'
import { keepRoom, releaseRoom } from '../../core/scroll-room'
import { FocusTrap } from './focus-trap'

export interface HoldOptions {
  /** As `FocusTrap.activate`; `false` leaves it, for a window that moves it once its content has drawn. */
  focus?: boolean | HTMLElement
  /** The element that scrolls behind the window, when the host names one; else the page. */
  scroller?: HTMLElement | null
  /** The window's footer: from its top down, the screen is the window's room. */
  foot?: HTMLElement | null
}

export class DialogHold {
  readonly #trap = new FocusTrap()
  readonly #onEscape: () => void
  #released: (() => void) | null = null
  #unclaim: (() => void) | null = null

  // An Escape something inside already answered (`preventDefault`) is not the window's.
  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && !event.defaultPrevented && this.#trap.isTopmost())
      this.#onEscape()
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

  hold(container: HTMLElement, { focus = false, scroller, foot }: HoldOptions = {}): void {
    if (this.#released) return
    this.#released = scroller ? holdOverflow(scroller) : lockScroll()
    document.addEventListener('keydown', this.#onKeyDown)
    this.#trap.activate(container, { focus })
    if (foot) this.#claim(container, foot)
  }

  // Measured again when the footer or the window changes size, the screen turns, and once the
  // window's entrance has played: a rising frame stands lower until then.
  #claim(container: HTMLElement, foot: HTMLElement): void {
    const claim = (): void => {
      if (!this.#released) return
      const top = foot.getBoundingClientRect().top
      const shown = foot.offsetHeight > 0
      keepRoom(this, scrollRoot(), 'bottom', shown ? Math.ceil(window.innerHeight - top) : 0)
    }
    const sizes = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(claim)
    sizes?.observe(foot)
    sizes?.observe(container)
    window.addEventListener('resize', claim)
    const root = foot.getRootNode() as Document | ShadowRoot
    const entrance = typeof root.getAnimations === 'function' ? root.getAnimations() : []
    void Promise.allSettled(entrance.map((animation) => animation.finished)).then(claim)
    claim()
    this.#unclaim = () => {
      sizes?.disconnect()
      window.removeEventListener('resize', claim)
      releaseRoom(this)
    }
  }

  /** Lets go; unless `restore` is false, the focus goes back to the opener. */
  release(restore: boolean = true): void {
    if (!this.#released) return
    document.removeEventListener('keydown', this.#onKeyDown)
    this.#unclaim?.()
    this.#unclaim = null
    this.#released()
    this.#released = null
    this.#trap.deactivate(restore)
  }
}

/**
 * Tells a click on the scrim from one in the window it holds, without stopping the window's
 * clicks on their way to the host: only a press that starts and ends on the scrim itself counts,
 * so a drag out of the window or into it closes nothing.
 */
export class ScrimClick {
  #inside = false

  readonly onPointerDown = (event: PointerEvent): void => {
    this.#inside = event.target !== event.currentTarget
  }

  // A press that ends in the window clicks their common ancestor, the scrim.
  readonly onPointerUp = (event: PointerEvent): void => {
    if (event.target !== event.currentTarget) this.#inside = true
  }

  /** Whether this click is one on the scrim. */
  hits(event: Event): boolean {
    const inside = this.#inside
    this.#inside = false
    return event.target === event.currentTarget && !inside
  }
}
