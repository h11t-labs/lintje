/**
 * Whether an event came from the host's own content in one of `root`'s slots: that content answers
 * for itself, so a row around it does not also take the click. A slot's fallback is the element's.
 */
export function fromSlotted(event: Event, root: Node): boolean {
  return event
    .composedPath()
    .some(
      (node) =>
        node instanceof HTMLSlotElement &&
        node.getRootNode() === root &&
        node.assignedNodes().length > 0,
    )
}
