/**
 * Where a floating box stands against its anchor, in viewport pixels: below or above at a fixed
 * gap, flipped when the room is too small and the other side has more, never past the viewport.
 * Shared by the popover and the tooltip.
 */

export type Placement = 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end' | 'top-center'

/** `bottom` is set instead of `top` when the box stands above the anchor. */
export interface Place {
  top: number | null
  bottom: number | null
  left: number
  /** The room on the side the box stands: its `max-height`. */
  space: number
}

export interface Rect {
  top: number
  bottom: number
  left: number
  right: number
  width: number
}

export const EDGE = 8
const MIN_SPACE = 180

export function place(
  anchor: Rect,
  box: { width: number; height: number },
  view: { width: number; height: number },
  placement: Placement = 'bottom-start',
  gap: number = 6,
): Place {
  const below = view.height - anchor.bottom - gap - EDGE
  const above = anchor.top - gap - EDGE
  const need = Math.min(box.height || MIN_SPACE, MIN_SPACE)
  const wantsTop = placement.startsWith('top')
  const onTop = wantsTop ? !(above < need && below > above) : below < need && above > below

  let left = anchor.left
  if (placement.endsWith('-end')) left = anchor.right - box.width
  if (placement === 'top-center') left = anchor.left + anchor.width / 2 - box.width / 2
  left = Math.max(EDGE, Math.min(left, view.width - box.width - EDGE))

  return {
    top: onTop ? null : anchor.bottom + gap,
    bottom: onTop ? view.height - anchor.top + gap : null,
    left: Math.round(left),
    space: Math.max(0, onTop ? above : below),
  }
}

export function samePlace(a: Place | null, b: Place | null): boolean {
  if (!a || !b) return a === b
  return a.top === b.top && a.bottom === b.bottom && a.left === b.left && a.space === b.space
}

/** The viewport size; `window.innerWidth` is zero in a test document. */
export function viewport(): { width: number; height: number } {
  return {
    width: window.innerWidth || document.documentElement.clientWidth || 1024,
    height: window.innerHeight || document.documentElement.clientHeight || 768,
  }
}
