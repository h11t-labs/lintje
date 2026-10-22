/**
 * The reader's settings the examples share: the six themes, each theme's emblem, and the query
 * keys that travel from one example to the next so it opens the way the last one looked.
 */

export const THEMES = ['rijksoverheid', 'marechaussee', 'landmacht', 'marine', 'luchtmacht', 'defensie']

const LABELS = {
  rijksoverheid: 'Rijksoverheid',
  marechaussee: 'Koninklijke Marechaussee',
  landmacht: 'Koninklijke Landmacht',
  marine: 'Koninklijke Marine',
  luchtmacht: 'Koninklijke Luchtmacht',
  defensie: 'Ministerie van Defensie',
}

/** The theme the query names, else the default. */
export const themeOf = (search) => {
  const name = new URLSearchParams(search).get('theme')
  return THEMES.includes(name) ? name : THEMES[0]
}

/** `?mode=dark` or `?mode=light`; without it the reader's system decides. */
export function modeOf(search) {
  const setting = new URLSearchParams(search).get('mode')
  const dark = setting === 'dark' || (setting !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)
  return dark ? 'dark' : 'light'
}

/** Where the shell's navigation stands on a page that lets the reader choose: `?layout=top`
    above the page, else beside it. */
export const layoutOf = (search) => (new URLSearchParams(search).get('layout') === 'top' ? 'top' : 'side')

/** `?style=classic`: the earlier house style, the menu filled in the theme's colour and square
    corners; without it the new one, the light menu and the rounded corner. */
export const styleOf = (search) =>
  new URLSearchParams(search).get('style') === 'classic' ? 'classic' : 'new'

/** `?corner=square`: the band at the page's head without the house style's rounded corner. */
export const cornerOf = (search) =>
  new URLSearchParams(search).get('corner') === 'square' ? 'square' : 'round'

/** Draws the chosen house style: the shell's tone, and the corner the band of a page takes. */
export function applyStyle(shell, search = location.search) {
  const fresh = styleOf(search) === 'new'
  shell.navTone = fresh ? 'light' : 'filled'
  const round = fresh && cornerOf(search) === 'round'
  const root = document.documentElement.style
  root.setProperty('--lintje-radius-corner', round ? '48px' : '0px')
  // The earlier house style is square throughout; the new one keeps the tokens' own corners.
  for (const hook of ['--lintje-radius', '--lintje-radius-control']) {
    if (fresh) root.removeProperty(hook)
    else root.setProperty(hook, '0px')
  }
}

/** A theme's emblem: the ribbon by file name and the organisation's name as text. */
export const emblem = (theme) => ({ name: `embleem-${theme}`, label: LABELS[theme] })

/** The keys that travel along; `menu` and `layout` only mean something to a page whose reader
    chooses where the menu stands. */
export const CARRIED = ['theme', 'mode', 'style', 'corner', 'menu', 'layout']

/** The keys that travel to an application: its menu always stands above the page. */
export const CARRIED_TO_APPS = ['theme', 'mode', 'style', 'corner']

/** The shell's `view`, `menu` and `layout` as the query holds them; `themes` lists them all. */
export function shellSettingsOf(search, { layoutChoice = false } = {}) {
  const params = new URLSearchParams(search)
  const mode = params.get('mode')
  return {
    view: {
      mode: mode === 'light' || mode === 'dark' ? mode : 'system',
      layoutChoice,
      themes: THEMES.map((name) => ({ value: name, label: LABELS[name] })),
      theme: themeOf(search),
      style: styleOf(search),
      // The corner is the new house style's: the earlier one offers no choice.
      corner: styleOf(search) === 'new' ? cornerOf(search) : undefined,
    },
    menu: params.get('menu') === 'unpinned' ? 'unpinned' : 'pinned',
    layout: layoutOf(search),
  }
}

/** The query after the shell's `lintje-view-change`: a default is never written, so it leaves. */
export function searchWith(search, change) {
  const params = new URLSearchParams(search)
  const write = (key, value, fallback) =>
    value === fallback ? params.delete(key) : params.set(key, value)
  if ('mode' in change) write('mode', change.mode, 'system')
  if ('menu' in change) write('menu', change.menu, 'pinned')
  if ('layout' in change) write('layout', change.layout, 'side')
  if ('theme' in change) write('theme', change.theme, THEMES[0])
  if ('style' in change) write('style', change.style, 'new')
  if ('corner' in change) write('corner', change.corner, 'round')
  const query = params.toString()
  return query ? `?${query}` : ''
}

/** `href` with the carried keys of `search` added to its own query; a hash stays at the end. */
export function carry(href, search = location.search, keys = CARRIED) {
  const [address, hash] = href.split('#')
  const [path, own] = address.split('?')
  const query = new URLSearchParams(own)
  const here = new URLSearchParams(search)
  for (const key of keys) if (here.get(key)) query.set(key, here.get(key))
  const text = query.toString()
  return `${path}${text ? `?${text}` : ''}${hash ? `#${hash}` : ''}`
}

/** "Afmelden" leaves for the identity provider in a real application; an example says so. */
export function answerLogout(shell) {
  shell.addEventListener('lintje-logout', () => {
    document.querySelector('lintje-toast')?.remove()
    const toast = document.createElement('lintje-toast')
    toast.kind = 'ok'
    toast.textContent = 'Afmelden kan niet in dit voorbeeld.'
    toast.addEventListener('lintje-close', () => toast.remove())
    document.body.append(toast)
  })
}
