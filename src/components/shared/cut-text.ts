/**
 * A text cut to one line with an ellipsis carries its whole words in `title`, for a pointer; one
 * that fits carries none, so a plain label gets no tooltip that repeats it. Measured when the
 * pointer arrives, not by an observer per element: as `@pointerenter=${titleWhenCut}` on the text.
 */
export function titleWhenCut(event: Event): void {
  const text = event.currentTarget as HTMLElement
  if (text.scrollWidth > text.clientWidth) text.title = wholeText(text)
  else text.removeAttribute('title')
}

/** The words as drawn, slotted ones included. */
function wholeText(element: HTMLElement): string {
  const words = (node: Node): string =>
    node instanceof HTMLSlotElement
      ? node.assignedNodes({ flatten: true }).map(words).join('')
      : node.nodeType === Node.ELEMENT_NODE
        ? [...node.childNodes].map(words).join('')
        : node.nodeType === Node.TEXT_NODE
          ? (node.textContent ?? '')
          : ''
  return words(element).replace(/\s+/g, ' ').trim()
}
