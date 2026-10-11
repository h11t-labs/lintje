/**
 * What an element finishes before the page goes to paper: one `beforeprint` listener for the
 * page, and every element that registers runs before the browser lays out the print.
 *
 * A callback must leave its final state in the DOM before it returns. "Afdrukken" in the shell
 * calls `window.print()` inside a frame callback, so `beforeprint` fires with a script on the
 * stack and a Lit update queued as a microtask would land after the print layout.
 */

const callbacks = new Set<() => void>()
let listening = false

function finish(): void {
  for (const callback of callbacks) callback()
}

/** Runs `callback` before every print; the returned function unregisters it. */
export function onBeforePrint(callback: () => void): () => void {
  if (!listening && typeof window !== 'undefined') {
    window.addEventListener('beforeprint', finish)
    listening = true
  }
  callbacks.add(callback)
  return () => callbacks.delete(callback)
}

const media = new Set<(printing: boolean) => void>()
let mediaQuery: MediaQueryList | null = null

function switched(event: MediaQueryListEvent): void {
  for (const callback of media) callback(event.matches)
}

/**
 * Runs `callback` with `true` when the page is laid out for paper and `false` when it is back on
 * screen. Inside the call a box measures its paper size, which `beforeprint` is too early for.
 */
export function onPrintMedia(callback: (printing: boolean) => void): () => void {
  if (!mediaQuery && typeof matchMedia !== 'undefined') {
    mediaQuery = matchMedia('print')
    mediaQuery.addEventListener('change', switched)
  }
  media.add(callback)
  return () => media.delete(callback)
}
