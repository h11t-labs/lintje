/** What the applications do the same way: a toast, a counted word, an upload that lets go of a file. */

/**
 * One toast at a time; the page removes it when it closes. An `action` is `{ label, run }`: the
 * one thing to do next.
 */
export function toast(text, kind = 'ok', action) {
  document.querySelector('lintje-toast')?.remove()
  const element = document.createElement('lintje-toast')
  element.kind = kind
  element.textContent = text
  if (action) {
    element.action = action.label
    element.addEventListener('lintje-action', action.run)
  }
  element.addEventListener('lintje-close', () => element.remove())
  document.body.append(element)
}

export const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`

/** A file the reader removes or cancels leaves the upload's list: the host owns `files`. */
export function dropRemovedFiles(upload) {
  const drop = (event) => (upload.files = upload.files.filter((row) => row.id !== event.detail.id))
  upload.addEventListener('lintje-file-remove', drop)
  upload.addEventListener('lintje-file-cancel', drop)
}
