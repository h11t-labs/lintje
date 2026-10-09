/**
 * What a host page tells the elements about itself. One instance for the whole bundle.
 */

export interface HostConfig {
  /** The element that scrolls the page: overlays lock it. Default: the document's scroller. */
  scrollRoot: () => HTMLElement | null
}

const defaults: HostConfig = {
  scrollRoot: () =>
    typeof document === 'undefined' ? null : (document.scrollingElement as HTMLElement | null),
}

let config: HostConfig = defaults

/** The host says what it knows, once, before the first element renders. */
export function setHostConfig(patch: Partial<HostConfig>): void {
  config = { ...config, ...patch }
}

/** The element that scrolls the page, as the host named it. */
export function scrollRoot(): HTMLElement | null {
  return config.scrollRoot()
}

/** Each locked element: how many overlays hold it, and the overflow it had before the first. */
const holds = new Map<HTMLElement, { count: number; overflow: string }>()

/**
 * Sets `overflow: hidden` on `element` and returns the undo. Locks are counted: the last undo
 * restores the original overflow, so overlays may close in any order. An undo works once.
 */
export function holdOverflow(element: HTMLElement): () => void {
  const hold = holds.get(element)
  if (hold) hold.count += 1
  else holds.set(element, { count: 1, overflow: element.style.overflow })
  element.style.overflow = 'hidden'
  let released = false
  return () => {
    if (released) return
    released = true
    const current = holds.get(element)
    if (!current) return
    current.count -= 1
    if (current.count > 0) return
    holds.delete(element)
    element.style.overflow = current.overflow
  }
}

/**
 * Locks the page behind an overlay and returns the undo. On the document's own scroller that is
 * `document.body`: `overflow: hidden` there leaves `<html>`'s scrollbar gutter alone, so the
 * page does not jump sideways.
 */
export function lockScroll(): () => void {
  if (typeof document === 'undefined') return () => {}
  const root = scrollRoot()
  const element = !root || root === document.scrollingElement ? document.body : root
  return holdOverflow(element)
}
