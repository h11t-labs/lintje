/**
 * The wheel on a drawing that zooms, the map's and the graph's: it zooms only with Ctrl or ⌘,
 * and without them it scrolls the page and a hint says how.
 */

/** Wheel pixels per doubling of the zoom: a mouse notch is about a hundred, a pinch far less. */
const WHEEL_PX_PER_DOUBLING = 200

/** How long the hint stays after the last wheel. */
export const HINT_MS = 1500

/** A pinch on a trackpad arrives as a wheel with Ctrl, on every platform. */
export function zoomsWith(event: WheelEvent): boolean {
  return event.ctrlKey || event.metaKey
}

/** Doublings of the zoom a wheel asks for; lines and pages are turned into pixels. */
export function wheelDoublings(event: WheelEvent): number {
  const pixels =
    event.deltaMode === 1
      ? event.deltaY * 16
      : event.deltaMode === 2
        ? event.deltaY * 400
        : event.deltaY
  return -pixels / WHEEL_PX_PER_DOUBLING
}

export function hintText(): string {
  const platform = (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform
  const mac = /mac|iphone|ipad/i.test(platform ?? navigator.platform)
  return `Gebruik ${mac ? '⌘' : 'Ctrl'} + scrollen om te zoomen`
}
