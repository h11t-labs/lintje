/**
 * One `IntersectionObserver` for every `<lintje-icon lazy>`: the icon asks for its file only
 * within `MARGIN` of the viewport. Without `IntersectionObserver` it reveals at once.
 */

export const MARGIN = '400px'

const reveals = new WeakMap<Element, () => void>()
let observer: IntersectionObserver | null = null
let unsupported = false

/** Made on the first `observeIcon`, so a page without `lazy` makes none and tests can stub it. */
function sharedObserver(): IntersectionObserver | null {
  if (observer || unsupported) return observer
  if (typeof IntersectionObserver !== 'function') {
    unsupported = true
    return null
  }
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const reveal = reveals.get(entry.target)
        unobserveIcon(entry.target)
        reveal?.()
      }
    },
    { rootMargin: MARGIN },
  )
  return observer
}

/** Calls `reveal` once `element` is within `MARGIN` of the viewport. Idempotent per element. */
export function observeIcon(element: Element, reveal: () => void): void {
  const shared = sharedObserver()
  if (!shared) {
    reveal()
    return
  }
  reveals.set(element, reveal)
  shared.observe(element)
}

export function unobserveIcon(element: Element): void {
  reveals.delete(element)
  observer?.unobserve(element)
}

/** Testing seam: forget the observer, so the next call builds a fresh one. */
export function resetIconObserver(): void {
  observer?.disconnect()
  observer = null
  unsupported = false
}
