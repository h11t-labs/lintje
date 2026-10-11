/**
 * Where a focused mark must move so that the overlays on the map do not cover it (WCAG 2.4.11):
 * plain box arithmetic, shared by the svg map and the one on a basemap.
 */

export interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

/** How far a revealed mark stands off the overlay or edge it passed, in px. */
export const REVEAL_MARGIN = 8

/** What stands over the drawing: the tile's own overlays and Leaflet's credit. */
export const OVERLAYS =
  '.lintje-map-chart__layers, .lintje-map-chart__zoom, .lintje-map-chart__selection, .lintje-map-chart__scale-bar, .leaflet-control'

/** The overlays in `area`, as boxes in client pixels; one that is not drawn has no size. */
export function overlayBoxes(area: Element): Box[] {
  return [...area.querySelectorAll(OVERLAYS)]
    .map((overlay) => overlay.getBoundingClientRect())
    .filter((rect) => rect.width > 0 && rect.height > 0)
}

const overlaps = (a: Box, b: Box): boolean =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

const inside = (a: Box, b: Box): boolean =>
  a.left >= b.left && a.right <= b.right && a.top >= b.top && a.bottom <= b.bottom

const moved = (box: Box, x: number, y: number): Box => ({
  left: box.left + x,
  right: box.right + x,
  top: box.top + y,
  bottom: box.bottom + y,
})

/**
 * The smallest move of the drawing that puts `mark` inside `view` and clear of every overlay,
 * `margin` off what it had to pass: `[0, 0]` when it already is, `null` when no move does it.
 */
export function clearance(
  mark: Box,
  view: Box,
  overlays: Box[],
  margin: number,
): [number, number] | null {
  const clear = (x: number, y: number) => {
    const box = moved(mark, x, y)
    return inside(box, view) && !overlays.some((overlay) => overlaps(box, overlay))
  }
  if (clear(0, 0)) return [0, 0]
  const xs = [0, view.left + margin - mark.left, view.right - margin - mark.right]
  const ys = [0, view.top + margin - mark.top, view.bottom - margin - mark.bottom]
  for (const overlay of overlays) {
    xs.push(overlay.right + margin - mark.left, overlay.left - margin - mark.right)
    ys.push(overlay.bottom + margin - mark.top, overlay.top - margin - mark.bottom)
  }
  let best: [number, number] | null = null
  for (const x of xs) {
    for (const y of ys) {
      if (best && Math.hypot(x, y) >= Math.hypot(...best)) continue
      if (clear(x, y)) best = [x, y]
    }
  }
  return best
}

/** Whether nothing of `mark` shows: outside `view`, or what is inside lies under one overlay. */
export function hidden(mark: Box, view: Box, overlays: Box[]): boolean {
  const seen: Box = {
    left: Math.max(mark.left, view.left),
    right: Math.min(mark.right, view.right),
    top: Math.max(mark.top, view.top),
    bottom: Math.min(mark.bottom, view.bottom),
  }
  if (seen.left >= seen.right || seen.top >= seen.bottom) return true
  return overlays.some((overlay) => inside(seen, overlay))
}

/** Whether the focus came from the keyboard: a pointer's focus must not move what it pressed. */
export function keyboardFocus(element: Element): boolean {
  try {
    return element.matches(':focus-visible')
  } catch {
    return true
  }
}
