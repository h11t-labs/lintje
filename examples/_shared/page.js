/**
 * What the applications do the same way: a toast, a counted word, an upload that lets go of a
 * file, and the focus handed on before what has it goes.
 */

/** Whether the focus is on `element` or inside it, also inside the shadow roots under it. */
export function holdsFocus(element) {
  for (let at = document.activeElement; at; at = at.shadowRoot?.activeElement ?? null) {
    if (at === element || element.contains(at)) return true
  }
  return false
}

const CONTROL = 'button:not([disabled]), a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

/** Focuses a Lintje element: itself when it takes the focus, else the first control it draws. */
export function focusOn(element) {
  element.focus()
  for (const control of element.shadowRoot?.querySelectorAll(CONTROL) ?? []) {
    if (holdsFocus(element)) return
    control.focus()
  }
}

/**
 * Before `going` is hidden or removed, the focus in it goes to `to`: an element, or a function that
 * puts the focus somewhere. Without it the focus would fall to `body`.
 */
export function handOff(going, to) {
  if (!holdsFocus(going)) return
  if (typeof to === 'function') to()
  else focusOn(to)
}

/**
 * One toast at a time; the page removes it when it closes. An `action` is `{ label, run }`: the
 * one thing to do next. A new toast takes over the focus of the old one before the old one goes.
 */
export function toast(text, kind = 'ok', action) {
  const old = document.querySelector('lintje-toast')
  const element = document.createElement('lintje-toast')
  element.kind = kind
  element.textContent = text
  if (action) {
    element.action = action.label
    element.addEventListener('lintje-action', action.run)
  }
  element.addEventListener('lintje-close', () => element.remove())
  document.body.append(element)
  if (!old) return
  if (!holdsFocus(old)) return old.remove()
  // A toast draws its buttons a frame after it arrives.
  requestAnimationFrame(async () => {
    await element.updateComplete
    element.shadowRoot?.querySelector('button')?.focus()
    old.remove()
  })
}

export const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`

/** A file the reader removes or cancels leaves the upload's list: the host owns `files`. */
export function dropRemovedFiles(upload) {
  const drop = (event) => (upload.files = upload.files.filter((row) => row.id !== event.detail.id))
  upload.addEventListener('lintje-file-remove', drop)
  upload.addEventListener('lintje-file-cancel', drop)
}
