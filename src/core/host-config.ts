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

/** Each locked element: how many overlays hold it, and the styles it had before the first. */
const holds = new Map<
  HTMLElement,
  { count: number; overflow: string; gutter: HTMLElement | null; scrollbarGutter: string }
>()

/** Whether `element` shows a scrollbar that takes room; an overlay scrollbar takes none. */
function takesRoom(element: HTMLElement): boolean {
  if (element === document.documentElement) return window.innerWidth > element.clientWidth
  const style = getComputedStyle(element)
  const borders = parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth)
  return element.offsetWidth - borders > element.clientWidth
}

/**
 * Sets `overflow: hidden` on `element` and returns the undo. Locks are counted: the last undo
 * restores the original styles, so overlays may close in any order. An undo works once.
 * `gutter` is the element whose scrollbar it hides; while that took room, `scrollbar-gutter:
 * stable` keeps the room, so the content does not widen and jump sideways.
 */
export function holdOverflow(element: HTMLElement, gutter: HTMLElement = element): () => void {
  const hold = holds.get(element)
  if (hold) hold.count += 1
  else {
    const keeps = takesRoom(gutter) ? gutter : null
    holds.set(element, {
      count: 1,
      overflow: element.style.overflow,
      gutter: keeps,
      scrollbarGutter: keeps?.style.scrollbarGutter ?? '',
    })
    if (keeps) keeps.style.scrollbarGutter = 'stable'
  }
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
    if (current.gutter) current.gutter.style.scrollbarGutter = current.scrollbarGutter
  }
}

/**
 * Locks the page behind an overlay and returns the undo. On the document's own scroller that is
 * `document.body`, whose `overflow` passes to the viewport; the gutter is `<html>`'s.
 */
export function lockScroll(): () => void {
  if (typeof document === 'undefined') return () => {}
  const root = scrollRoot()
  if (root && root !== document.scrollingElement) return holdOverflow(root)
  return holdOverflow(document.body, document.documentElement)
}
