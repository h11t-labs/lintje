/**
 * When the filter zone shows its controls: closed until the reader opens it.
 * `open` is the reader's choice; `scrolled` (the zone touches the top bar) only moves the bar.
 * Kept apart from the element so the transitions test without a DOM.
 */
export interface ZoneState {
  open: boolean
  scrolled: boolean
}

export type ZoneAction =
  | { type: 'expand' }
  | { type: 'collapse' }
  | { type: 'scrolled'; scrolled: boolean }
  /** The page moved under the open controls, `distance` px from where they were opened. */
  | { type: 'page-scrolled'; distance: number }

/** How far, in px, the page may move under the open controls before they close. */
export const SCROLL_CLOSES_AFTER = 24

export function zoneExpanded(state: ZoneState): boolean {
  return state.open
}

/** A page that scrolls on under the open controls closes them, past a small tremble. */
export function zoneReduce(state: ZoneState, action: ZoneAction): ZoneState {
  switch (action.type) {
    case 'expand':
      return { ...state, open: true }
    case 'collapse':
      return { ...state, open: false }
    case 'scrolled':
      return { ...state, scrolled: action.scrolled }
    case 'page-scrolled':
      return Math.abs(action.distance) > SCROLL_CLOSES_AFTER ? { ...state, open: false } : state
  }
}

/**
 * Whether the reader can stay past the threshold once the zone pins. Pinning takes `lost` px out
 * of the page, so its furthest scroll position moves up as much; where that falls short of the
 * threshold the browser scrolls the reader back above it, the zone unpins and the page grows
 * again — open, pinned, open with every turn of the wheel. Then the zone stays in the page.
 */
export function canStayScrolled(page: {
  /** The scroller's `scrollHeight` before pinning. */
  scrollHeight: number
  /** The scroller's `clientHeight`. */
  viewportHeight: number
  /** The height pinning takes out of the page. */
  lost: number
  /** The scroll position at which the zone reaches the top bar. */
  threshold: number
}): boolean {
  return page.scrollHeight - page.viewportHeight - page.lost >= page.threshold
}
