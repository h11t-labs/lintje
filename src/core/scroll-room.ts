/**
 * What sticks at an edge of a scroller would cover a control the keyboard scrolls into view
 * (WCAG 2.4.11): each element claims the room it covers there, and the scroller keeps the largest
 * claim of each edge as its `scroll-padding`, never less than what the host set itself. In
 * `core/` because the frame, the forms, the chat and the feedback all claim room.
 */
import { deepActiveElement, holdsFocus } from './focus'
import { scrollRoot } from './host-config'

export type RoomSide = 'top' | 'bottom'

const PROPERTY = { top: 'scrollPaddingTop', bottom: 'scrollPaddingBottom' } as const

interface Edge {
  /** What stood there before the first claim, or what the host wrote since. */
  base: string
  wrote: string
  claims: Map<object, number>
}

const edges = new Map<HTMLElement, Partial<Record<RoomSide, Edge>>>()
/** The scroller each owner's claims stand on. */
const places = new Map<object, HTMLElement>()
const listeners = new Map<HTMLElement, Set<() => void>>()
const pending = new Set<HTMLElement>()

function write(scroller: HTMLElement, side: RoomSide): void {
  const sides = edges.get(scroller)
  const edge = sides?.[side]
  if (!sides || !edge) return
  const property = PROPERTY[side]
  const now = scroller.style[property]
  if (now !== edge.wrote) edge.base = now
  const value = edge.claims.size
    ? `${Math.ceil(Math.max(parseFloat(edge.base) || 0, ...edge.claims.values()))}px`
    : edge.base
  if (!edge.claims.size) {
    delete sides[side]
    if (!sides.top && !sides.bottom) edges.delete(scroller)
  }
  edge.wrote = value
  if (value === now) return
  scroller.style[property] = value
  // Told after the claim that changed it, so an owner that answers does not claim inside a claim.
  if (pending.has(scroller) || !listeners.get(scroller)?.size) return
  pending.add(scroller)
  queueMicrotask(() => {
    pending.delete(scroller)
    for (const listener of listeners.get(scroller) ?? []) listener()
  })
}

/** Keeps `room` px free at one edge of `scroller` for `owner`; 0 or no scroller drops the claim. */
export function keepRoom(
  owner: object,
  scroller: HTMLElement | null,
  side: RoomSide,
  room: number,
): void {
  const place = places.get(owner)
  if (place && place !== scroller) releaseRoom(owner)
  if (!scroller) return
  const sides = edges.get(scroller) ?? {}
  const edge = sides[side]
  if (!(room > 0)) {
    if (!edge?.claims.delete(owner)) return
  } else if (edge) {
    if (edge.claims.get(owner) === room) return
    edge.claims.set(owner, room)
  } else {
    const now = scroller.style[PROPERTY[side]]
    sides[side] = { base: now, wrote: now, claims: new Map([[owner, room]]) }
    edges.set(scroller, sides)
  }
  places.set(owner, scroller)
  write(scroller, side)
}

/** Drops every claim of `owner`; the scroller gets back what stood there without it. */
export function releaseRoom(owner: object): void {
  const scroller = places.get(owner)
  places.delete(owner)
  if (!scroller) return
  for (const side of ['top', 'bottom'] as const) {
    if (edges.get(scroller)?.[side]?.claims.delete(owner)) write(scroller, side)
  }
}

/** The largest room the others claim at one edge: what an element standing on top of them clears. */
export function roomBeside(owner: object, scroller: HTMLElement | null, side: RoomSide): number {
  const claims = scroller ? edges.get(scroller)?.[side]?.claims : undefined
  let room = 0
  for (const [other, px] of claims ?? []) if (other !== owner) room = Math.max(room, px)
  return room
}

/** Calls `listener` after the room at an edge of `scroller` changed; returns the undo. */
export function watchRoom(scroller: HTMLElement, listener: () => void): () => void {
  const set = listeners.get(scroller) ?? new Set()
  set.add(listener)
  listeners.set(scroller, set)
  return () => {
    set.delete(listener)
    if (!set.size) listeners.delete(scroller)
  }
}

/**
 * Scrolls the focused element clear of `cover` where it still lies under it: the room falls
 * short where WebKit scrolls a text field's text into view, not its border and padding, and for
 * a cover that keeps none. Only what `owner` itself covers: a sheet or dialog over it is not
 * under it.
 */
export function scrollFocusClear(owner: Element, cover: Element, side: RoomSide): void {
  const focused = deepActiveElement()
  // `body` after the focused element left before this frame: there is nothing to clear.
  if (!focused || focused === document.body || holdsFocus(owner)) return
  const room = cover.getBoundingClientRect()
  const box = focused.getBoundingClientRect()
  const left = Math.max(box.left, room.left)
  const right = Math.min(box.right, room.right)
  if (box.bottom <= room.top || box.top >= room.bottom || left >= right) return
  const y = (Math.max(box.top, room.top) + Math.min(box.bottom, room.bottom)) / 2
  const scope = owner.getRootNode() as Document | ShadowRoot
  const hit = scope.elementFromPoint((left + right) / 2, y)
  if (!hit || (hit !== owner && !owner.contains(hit))) return
  scrollRoot()?.scrollBy({
    top: side === 'bottom' ? box.bottom - room.top : box.top - room.bottom,
    behavior: 'instant',
  })
}
