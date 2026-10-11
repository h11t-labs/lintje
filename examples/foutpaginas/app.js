/**
 * Foutpagina's — the page's half of the example. Which page stands is in the URL; the pages are
 * markup. It sets what a server would know (the moment of a failure, the links with the reader's
 * settings) and answers the buttons. Everything is fictional.
 */
import { toast } from '../_shared/page.js'
import { answerLogout, carry, emblem, modeOf, searchWith, shellSettingsOf, themeOf } from '../_shared/settings.js'

const params = new URLSearchParams(location.search)

const PAGES = [
  { id: 'niet-gevonden', label: 'Niet gevonden', title: 'Pagina niet gevonden' },
  { id: 'geen-toegang', label: 'Geen toegang', title: 'Geen toegang' },
  { id: 'storing', label: 'Storing', title: 'Er ging iets mis' },
  { id: 'onderhoud', label: 'Onderhoud', title: 'Gepland onderhoud' },
]
const current = PAGES.find((page) => page.id === params.get('pagina')) ?? PAGES[0]

const theme = themeOf(location.search)

// Mode and theme stand on <html> before the elements load, so they draw in them from the start.
const root = document.documentElement
root.dataset.mode = modeOf(location.search)
root.dataset.theme = theme

const lintje = await import('../../dist-elements/lintje.js')
lintje.setIconSource({ base: '../../dist-icons/' })

const $ = (id) => document.getElementById(id)

/** The address of one of the four pages; the first is the page without a parameter. */
function hrefFor(id) {
  const next = new URLSearchParams(params)
  if (id === PAGES[0].id) next.delete('pagina')
  else next.set('pagina', id)
  const query = next.toString()
  return query ? `?${query}` : location.pathname
}

document.title = `${current.title} — Foutpagina's — Lintje`
for (const page of PAGES) $(page.id).hidden = page.id !== current.id

/* The shell ----------------------------------------------------------------------------- */

const shell = $('shell')
const settings = shellSettingsOf(location.search)
shell.data = {
  name: "Foutpagina's",
  emblem: emblem(theme),
  home: carry('../'),
  navigation: PAGES.map((page) => ({
    label: page.label,
    href: hrefFor(page.id),
    active: page === current,
  })),
  view: settings.view,
  user: { name: 'J. de Vries', role: 'Medewerker · Dienst Vergunningen', initials: 'JV' },
  version: '1.0.0',
}
shell.addEventListener('lintje-navigate', (event) => {
  // Only the shell's own links; the error page's are links the browser follows.
  if (event.target !== shell) return
  event.preventDefault()
  location.href = event.detail.href
})
// The mode and the theme stand in the URL; the page loads again with them.
shell.addEventListener('lintje-view-change', (event) => {
  location.href = `${location.pathname}${searchWith(location.search, event.detail)}`
})
answerLogout(shell)

/* Niet gevonden: a search and the way onward ------------------------------------------------ */

$('niet-gevonden').links = [
  { label: 'De start van Lintje', href: carry('../') },
  { label: 'De stijlgids', href: carry('../styleguide/') },
  { label: 'De foutpagina in de stijlgids', href: carry('../styleguide/?category=feedback#el-error-page') },
]
$('zoeken').addEventListener('lintje-change', () => toast('Zoeken kan niet in dit voorbeeld.'))

/* Geen toegang: the request goes to the functional administrator ----------------------------- */

$('toegang').addEventListener('click', () => toast('Je aanvraag is naar de functioneel beheerder gestuurd.'))
$('ander-account').addEventListener('click', () => toast('Aanmelden met een ander account kan niet in dit voorbeeld.'))

/* Storing: the moment it happened, and trying again ------------------------------------------ */

const now = new Date()
const day = now.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
const time = now.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }).replace(':', '.')
$('storing').occurred = `${day}, ${time} uur`
$('opnieuw').addEventListener('click', () => location.reload())
$('naar-start').href = carry('../')
