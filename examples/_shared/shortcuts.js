/**
 * The shortcut overview as a page builds it: a `lintje-dialog` with the register's list. `?`
 * opens it; with the one-character keys off (`setCharacterKeys`) it does not, so the page also
 * opens it from a button or a menu.
 */
import { keyLabels, registerShortcut, shortcuts } from '../../dist-elements/core.js'

let shown = null

/**
 * Fills `dialog` and returns the function that opens it, read fresh from the register. `?` is
 * registered once and opens the overview filled last.
 */
export function shortcutOverview(dialog) {
  dialog.heading ||= 'Sneltoetsen'
  dialog.innerHTML = '<lintje-description-list></lintje-description-list>'
  const list = dialog.querySelector('lintje-description-list')
  dialog.addEventListener('lintje-close', () => (dialog.open = false))

  const open = () => {
    list.items = shortcuts().map(({ keys, description }) => ({ label: description, tags: keyLabels(keys) }))
    dialog.open = true
  }
  if (!shown) registerShortcut({ keys: '?', description: 'Dit overzicht', handler: () => shown() })
  shown = open
  return open
}
