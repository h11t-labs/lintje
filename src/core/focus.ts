/**
 * Where the focus is, through every shadow root, and whether a modal dialog stands around a
 * node. In `core/` because primitives and components both need it.
 */

/** The element that really has focus, through every shadow root below it. */
export function deepActiveElement(): HTMLElement | null {
  let element = document.activeElement
  try {
    while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement
  } catch {
    // happy-dom's `ShadowRoot.activeElement` throws while a focus event is being dispatched;
    // the deepest element found so far is the answer.
  }
  return element instanceof HTMLElement ? element : null
}

/**
 * One step up the flat tree: into the slot a node is assigned to, out of a shadow root. The slot
 * is asked of the parent's shadow root, not `assignedSlot`, so it holds in every slot-capable DOM.
 */
function flatParent(node: Node): Node | null {
  const root = node instanceof Element ? node.parentElement?.shadowRoot : null
  if (root) {
    const slot = Array.from(root.querySelectorAll('slot')).find((candidate) =>
      candidate.assignedElements().includes(node as Element),
    )
    if (slot) return slot
  }
  return node.parentNode ?? (node instanceof ShadowRoot ? node.host : null)
}

/** The open modal dialog (`aria-modal="true"`) the node stands in, through every root. */
export function modalAround(node: Node | null): Element | null {
  for (let at = node; at; at = flatParent(at)) {
    if (at instanceof Element && at.getAttribute('aria-modal') === 'true') return at
  }
  return null
}

/** Whether an Escape is `element`'s to answer: not when a modal dialog opened over it has focus. */
export function ownsEscape(element: Element): boolean {
  const dialog = modalAround(deepActiveElement())
  return !dialog || modalAround(element) === dialog
}

/** Whether `node` is `ancestor` or stands inside it, through every shadow root and slot. */
export function standsIn(node: Node, ancestor: Node): boolean {
  for (let at: Node | null = node; at; at = flatParent(at)) {
    if (at === ancestor) return true
  }
  return false
}

/** Whether the focus is on `element` or anything inside it, through every shadow root and slot. */
export function holdsFocus(element: Element): boolean {
  const active = deepActiveElement()
  return active !== null && standsIn(active, element)
}
