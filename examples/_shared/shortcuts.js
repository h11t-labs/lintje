/**
 * The shortcut overview as a page builds it: a `lintje-dialog` with the register's list and, in
 * its footer, the switch for the one-character keys (WCAG 2.1.4). `?` opens it; with those keys
 * off (`setCharacterKeys`) it does not, so the page also opens it from a button or a menu. The
 * page loads `lintje-dialog`, `lintje-description-list` and `lintje-toggle`.
 */
import {
  characterKeys,
  keyLabels,
  registerShortcut,
  setCharacterKeys,
  shortcuts,
} from '../../dist-elements/core.js'

let shown = null

/**
 * Fills `dialog` and returns the function that opens it, read fresh from the register. `?` is
 * registered once and opens the overview filled last.
 */
export function shortcutOverview(dialog) {
  dialog.heading ||= 'Sneltoetsen'
  dialog.innerHTML = `<lintje-description-list></lintje-description-list>
    <lintje-toggle
      slot="footer"
      label="Sneltoetsen van één teken"
      hint="Uit werken alleen de sneltoetsen met Ctrl, Alt of Cmd."
    ></lintje-toggle>`
  const list = dialog.querySelector('lintje-description-list')
  const toggle = dialog.querySelector('lintje-toggle')
  toggle.checked = characterKeys()
  toggle.addEventListener('lintje-change', (event) => setCharacterKeys(event.detail))
  dialog.addEventListener('lintje-close', () => (dialog.open = false))

  const open = () => {
    // The list keeps every key, also the one-character ones while they are off.
    list.items = shortcuts().map(({ keys, description }) => ({ label: description, keys: keyLabels(keys) }))
    toggle.checked = characterKeys()
    dialog.open = true
  }
  if (!shown) registerShortcut({ keys: '?', description: 'Dit overzicht', handler: () => shown() })
  shown = open
  return open
}
