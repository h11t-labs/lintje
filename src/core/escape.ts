/**
 * One Escape answers one thing. Whatever closes or undoes something on Escape asks
 * `isFreshEscape` first and calls `answerEscape` when it acts, so nothing under it acts on the
 * same press: the tooltip hears it first (on the window, in capture), the floating layers next,
 * a window around them last. In `core/` because tags in every category need it.
 *
 * Floating layers (a popover, a toggletip, a field's panel) all listen on the document, where
 * they would hear the key in the order they connected. They tell when they open and close, and
 * only the one opened last answers.
 */
import { ownsEscape } from './focus'

/** Whether `event` is an Escape no layer above has answered yet. */
export function isFreshEscape(event: KeyboardEvent): boolean {
  return event.key === 'Escape' && !event.defaultPrevented
}

/** Marks the Escape as answered: every layer under it lets it be. */
export function answerEscape(event: KeyboardEvent): void {
  event.preventDefault()
}

/** The open floating layers, the one opened last at the end. */
const layers: Element[] = []

/**
 * A floating layer opened (and is the top one now) or closed. One already open keeps its place,
 * so a layer moved in the page, which connects again, is not opened last.
 */
export function setLayerOpen(layer: Element, open: boolean): void {
  const at = layers.indexOf(layer)
  if (open && at < 0) layers.push(layer)
  if (!open && at >= 0) layers.splice(at, 1)
}

/**
 * Whether `layer` is the open floating layer opened last. One left on the page by mistake, or
 * under a modal dialog that has the focus, does not count: it would keep the key from every other.
 */
export function isTopLayer(layer: Element): boolean {
  for (let at = layers.length - 1; at >= 0; at--) {
    const candidate = layers[at]!
    // Gone from the page: a key never comes in the middle of a move, so it is gone for good.
    if (!candidate.isConnected) layers.splice(at, 1)
    else if (ownsEscape(candidate)) return candidate === layer
  }
  return true
}
