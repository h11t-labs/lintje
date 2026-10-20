/**
 * Where the focus is, through every shadow root, and whether a modal dialog stands around a
 * node. In `core/` because tags in every category need it.
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

const FOCUSABLE = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]',
].join(',')

/** Whether `element` is drawn and seen: a closed disclosure is rendered but `visibility: hidden`. */
function shown(element: Element): boolean {
  return typeof element.checkVisibility === 'function'
    ? element.checkVisibility({ visibilityProperty: true })
    : true
}

export function isTabbable(element: HTMLElement): boolean {
  return element.matches(FOCUSABLE) && element.tabIndex >= 0 && shown(element)
}

/** The children of `element` in the composed tree: a slot's assigned elements, a host's root. */
function composedChildren(element: Element): Element[] {
  return element instanceof HTMLSlotElement
    ? element.assignedElements({ flatten: true })
    : Array.from((element.shadowRoot ?? element).children)
}

/**
 * Every element under `root` that Tab stops on, in composed-tree order; `also` counts more as a
 * stop, as the focus trap counts a scroller.
 */
export function tabbables(
  root: ParentNode,
  also?: (element: HTMLElement) => boolean,
): HTMLElement[] {
  const found: HTMLElement[] = []
  const visit = (element: Element): void => {
    if (element.hasAttribute('inert') || element.hasAttribute('hidden')) return
    if (element instanceof HTMLElement && (isTabbable(element) || also?.(element)))
      found.push(element)
    for (const child of composedChildren(element)) visit(child)
  }
  for (const child of Array.from(root.children)) visit(child)
  return found
}

/** The first stop after `element` in the document that is not inside `skip`. */
export function stopAfter(element: HTMLElement, skip: Node): HTMLElement | null {
  const order = tabbables(document.body)
  const at = order.indexOf(element)
  if (at < 0) return null
  return order.slice(at + 1).find((stop) => !standsIn(stop, skip)) ?? null
}

/** The element itself when Tab stops on it, else its first stop (through its shadow root). */
export function focusTarget(element: HTMLElement): HTMLElement {
  if (isTabbable(element)) return element
  return tabbables(element.shadowRoot ?? element)[0] ?? element
}

/** The Tab stops before and after `element` in the document, outside it. */
function stopsAround(element: Element): { before: HTMLElement | null; after: HTMLElement | null } {
  let before: HTMLElement | null = null
  let after: HTMLElement | null = null
  let passed = false
  const visit = (node: Element): boolean => {
    if (node === element) {
      passed = true
      return false
    }
    if (node.hasAttribute('inert') || node.hasAttribute('hidden')) return false
    if (node instanceof HTMLElement && isTabbable(node)) {
      if (passed) {
        after = node
        return true
      }
      before = node
    }
    return composedChildren(node).some(visit)
  }
  Array.from(document.body.children).some(visit)
  return { before, after }
}

/**
 * Focuses `place` (an element of Lintje hands it inside), or else the first stop inside it;
 * whether the focus is in it now. A focus on `place` itself counts only when it can take one.
 */
function focusOn(place: HTMLElement): boolean {
  if (!place.isConnected || !shown(place)) return false
  place.focus({ preventScroll: true })
  const active = deepActiveElement()
  const taken = holdsFocus(place) && (active !== place || place.matches(FOCUSABLE))
  if (!taken) focusTarget(place).focus({ preventScroll: true })
  return holdsFocus(place) && deepActiveElement() !== (place.matches(FOCUSABLE) ? null : place)
}

/**
 * Hands the focus on before `going` disappears, so it never falls to `body`: when the focus is on
 * or inside `going`, it goes to the first of `places` that is on the page, shown and takes it;
 * without one, to the next Tab stop after `going`, else the one before. Elsewhere it stays.
 * Whether it moved.
 */
export function passFocus(
  going: Element,
  places: readonly (HTMLElement | null | undefined)[] = [],
): boolean {
  if (!holdsFocus(going)) return false
  for (const place of places) if (place && !standsIn(place, going) && focusOn(place)) return true
  const { before, after } = stopsAround(going)
  const next = after ?? before
  if (!next) return false
  next.focus({ preventScroll: true })
  return true
}
