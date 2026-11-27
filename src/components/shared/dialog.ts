/**
 * What every modal window does while it is open: it locks the page's scroll, keeps the focus
 * inside, answers Escape only when it is the window on top, and shows its footer to a toast,
 * which stands above it where the two would meet.
 */
import { holdOverflow, lockScroll } from '../../core/host-config'
import { FocusTrap } from './focus-trap'

/** The footers of the open windows. */
const feet = new Set<HTMLElement>()
const footListeners = new Set<() => void>()
const tellFeet = (): void => {
  for (const listener of footListeners) listener()
}

/** The footers of the open windows that are drawn now. */
export function openFeet(): HTMLElement[] {
  return Array.from(feet).filter((foot) => foot.isConnected && foot.offsetHeight > 0)
}

/** Calls `listener` when a window's footer comes, goes or moves; returns the undo. */
export function watchFeet(listener: () => void): () => void {
  footListeners.add(listener)
  return () => footListeners.delete(listener)
}

export interface HoldOptions {
  /** As `FocusTrap.activate`; `false` leaves it, for a window that moves it once its content has drawn. */
  focus?: boolean | HTMLElement
  /** The element that scrolls behind the window, when the host names one; else the page. */
  scroller?: HTMLElement | null
  /** The window's footer, which a toast keeps clear of. */
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

  // Told again when the footer or the window changes size or scrolls, the screen turns, and once
  // the window's entrance has played: a rising frame stands lower until then.
  #claim(container: HTMLElement, foot: HTMLElement): void {
    feet.add(foot)
    const sizes = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(tellFeet)
    sizes?.observe(foot)
    sizes?.observe(container)
    window.addEventListener('resize', tellFeet)
    // A window taller than the screen scrolls its footer into view.
    const root = foot.getRootNode() as Document | ShadowRoot
    root.addEventListener('scroll', tellFeet, true)
    const entrance = typeof root.getAnimations === 'function' ? root.getAnimations() : []
    void Promise.allSettled(entrance.map((animation) => animation.finished)).then(tellFeet)
    tellFeet()
    this.#unclaim = () => {
      sizes?.disconnect()
      window.removeEventListener('resize', tellFeet)
      root.removeEventListener('scroll', tellFeet, true)
      feet.delete(foot)
      tellFeet()
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
