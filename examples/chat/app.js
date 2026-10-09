/**
 * Vraag het de data — the page's half of the example. It sets `data` on the shell, hands the
 * chat to the conversation in `../_data/chat.js`, which answers the chat's events and plays
 * each answer with timers, and keeps mode, menu, theme and layout in the URL.
 */
import * as lintje from '../../dist-elements/lintje.js'
import { converse } from '../_data/chat.js'
import {
  answerLogout,
  carry,
  emblem,
  modeOf,
  searchWith,
  shellSettingsOf,
  themeOf,
} from '../_shared/settings.js'

// The emblem and the menu's icons are read one file at a time from the house set.
lintje.setIconSource({ base: '../../dist-icons/' })

/* The URL: mode, menu, theme, layout and the demo state ---------------------------------- */

const params = () => new URLSearchParams(location.search)

/* The shell ------------------------------------------------------------------------------ */

// The same fictional dashboard as `../dashboard/`, on its chat page. The entries under
// "Lintje" are not the dashboard's own: they lead back to the other examples. Every link
// carries the reader's settings, so the next page opens the way this one looks.
const navigation = () => [
  { label: 'Overzicht', icon: 'functioneel-home', href: carry('../dashboard/') },
  { label: 'Vraag het de data', icon: 'communicatie-tekstballonnen', href: carry('./'), active: true },
  {
    label: 'Lintje',
    links: [
      { label: 'Startpagina', icon: 'functioneel-menu', href: carry('../') },
      { label: 'Stijlgids', icon: 'functioneel-tegelweergave', href: carry('../styleguide/?category=chat') },
    ],
  },
]

const root = document.documentElement
const shell = document.getElementById('shell')
answerLogout(shell)

function render() {
  root.dataset.mode = modeOf(location.search)
  root.dataset.theme = themeOf(location.search)
  shell.data = {
    name: 'Dashboard Vergunningen',
    emblem: emblem(themeOf(location.search)),
    home: carry('../dashboard/'),
    navigation: navigation(),
    // "Weergave" offers where the menu stands, as it does on the dashboard.
    ...shellSettingsOf(location.search, { layoutChoice: true }),
    share: true,
    user: { initials: 'JV', name: 'J. Vermeer', role: 'Analist · Dienst Vergunningen' },
    pageName: 'Vraag het de data',
  }
}

// The shell asks; the page decides: a change of mode, menu, theme or layout is this
// page again with a new query. A link the browser follows by itself.
shell.addEventListener('lintje-view-change', (event) => {
  history.replaceState(null, '', `${location.pathname}${searchWith(location.search, event.detail)}`)
  render()
})

render()

/* The conversation ----------------------------------------------------------------------- */

converse(document.getElementById('chat'), { turns: params().get('demo') === '1' })
