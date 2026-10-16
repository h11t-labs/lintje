/** True for a plain left click; a modifier or another button is left to the browser. */
export function isPlainClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
}

/** A click a link opens in a new tab: with a modifier, or with the middle button (`auxclick`). */
export function isNewTabClick(event: MouseEvent): boolean {
  return event.type === 'auxclick' ? event.button === 1 : !isPlainClick(event)
}
