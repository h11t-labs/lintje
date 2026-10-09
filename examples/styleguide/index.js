/**
 * The style guide: every element of the design system, one category at a time.
 *
 * The shell's menu lists the categories; the page draws the chosen one. The category lives in
 * the URL (`?category=inputs`), next to mode, menu, theme and layout. In the top layout
 * each heading is an entry with its categories in a submenu. An address that names an
 * element (`#el-textarea`) opens the category that holds it. The specimens come from the
 * modules in `specimens/`; a module that is missing or throws is reported in the console and
 * skipped, so one module cannot take the page down. `/` or the shell's search icon searches every
 * element on every page.
 */
import * as bundle from '../../dist-elements/lintje.js'
import {
  answerLogout,
  carry,
  emblem,
  modeOf,
  searchWith,
  shellSettingsOf,
  themeOf,
} from '../_shared/settings.js'
import { CATEGORIES, MENU, namedIn } from './menu.js'
import { loadReference, renderElement, sectionId } from './shared.js'

// The emblem and every icon named by data are read one file at a time from the house set.
bundle.setIconSource({ base: '../../dist-icons/' })

/* The specimens --------------------------------------------------------------- */
// One module per category, and every one is loaded, so the page has every element's specimens;
// only the chosen category is drawn.
const MODULES = CATEGORIES.map((category) => category.name)
const specimens = new Map()
await Promise.all(
  MODULES.map(async (name) => {
    try {
      const { elements } = (await import(`./specimens/${name}.js`)).default
      for (const item of elements) specimens.set(sectionId(item), item)
    } catch (error) {
      console.warn(`specimens/${name}.js`, error)
    }
  }),
)
/** A category's elements, in the menu's order; one the modules do not have is reported and left out. */
const elementsOf = (category) =>
  category.elements.flatMap((name) => {
    const item = specimens.get(`el-${name}`) ?? specimens.get(name)
    if (!item) console.warn(`No specimens for "${name}" (${category.label})`)
    return item ? [item] : []
  })
const declarations = await loadReference('../../dist-elements/custom-elements.json')
const placed = new Set(CATEGORIES.flatMap((category) => category.elements))
const missing = bundle.LINTJE_TAGS.filter((tag) => !placed.has(tag.replace('lintje-', '')))
if (missing.length) console.warn('Not in the style guide:', missing.join(', '))

const categoryOf = (id) =>
  CATEGORIES.find((category) => category.elements.some((name) => `el-${name}` === id || name === id))

/* Where the page is: all of it in the URL ------------------------------------ */
const root = document.documentElement
const shell = document.getElementById('shell')
answerLogout(shell)
const pageHeader = document.getElementById('page-header')
const crumbs = document.getElementById('crumbs')
const index = document.getElementById('index')
const host = document.getElementById('elements')
const appSearch = document.getElementById('search')

const params = () => new URLSearchParams(location.search)
const theme = () => themeOf(location.search)
/** The category the address names: the one that holds the element in the hash, else `category`. */
const category = () =>
  categoryOf(location.hash.slice(1)) ??
  CATEGORIES.find((item) => item.name === namedIn(params())) ??
  CATEGORIES[0]
/** The reader's settings, carried from page to page: the search without the category. */
const settings = () => {
  const rest = params()
  rest.delete('category')
  const query = rest.toString()
  return query ? `?${query}` : ''
}

let drawn
function render() {
  const current = category()
  root.dataset.mode = modeOf(location.search)
  root.dataset.theme = theme()
  document.title = `${current.label} — Lintje stijlgids`

  shell.data = {
    name: 'Lintje stijlgids',
    emblem: emblem(theme()),
    home: carry('../'),
    // "Weergave" holds every setting: mode, where the menu stands, and the theme.
    ...shellSettingsOf(location.search, { layoutChoice: true }),
    share: true,
    search: true,
    navigation: [
      { label: 'Startpagina', icon: 'functioneel-home', href: carry('../') },
      ...MENU.map((group) => ({
        label: group.heading,
        links: group.items.map((item) => ({
          label: item.label,
          icon: item.icon,
          href: addressOf(item.name, settings()),
          active: item.name === current.name,
        })),
      })),
    ],
    user: {
      initials: 'LS',
      name: `Lintje ${bundle.LINTJE_VERSION}`,
      role: `${bundle.LINTJE_TAGS.length} elementen`,
    },
    pageName: current.label,
  }
  pageHeader.data = { kicker: 'Lintje stijlgids', title: current.label, description: current.intro }
  // A heading has no page of its own: its crumb is text.
  crumbs.items = [
    { label: 'Startpagina', href: carry('../') },
    { label: MENU.find((group) => group.items.includes(current)).heading },
    { label: current.label },
  ]

  // A specimen reads the theme when it is drawn (the shell's emblem), so a new theme redraws.
  const drawing = `${current.name}:${theme()}`
  if (drawn === drawing) return
  drawn = drawing
  host.replaceChildren()
  // The way to each element on this page: one small button per element.
  index.replaceChildren(
    ...elementsOf(current).map((item) => {
      const section = renderElement(host, item, declarations, current.name)
      const jump = document.createElement('lintje-button')
      jump.variant = 'tertiary'
      jump.size = 'compact'
      jump.textContent = item.tag ? item.tag.replace('lintje-', '') : (item.short ?? item.title)
      jump.addEventListener('click', () => {
        history.replaceState(null, '', `${location.pathname}${location.search}#${section.id}`)
        section.scrollIntoView()
      })
      return jump
    }),
  )
}

/** A category's address: this page, its `category` and the reader's settings. */
function addressOf(name, search) {
  const next = new URLSearchParams(search)
  if (name !== CATEGORIES[0].name) next.set('category', name)
  const query = next.toString()
  return `${location.pathname}${query ? `?${query}` : ''}`
}

/** Writes the address and draws what it says. Another category is a step in the history. */
function go(name, search, hash = '') {
  const address = `${addressOf(name, search)}${hash}`
  if (name === category().name) history.replaceState(null, '', address)
  else history.pushState(null, '', address)
  render()
}

// The shell asks; the page decides. A category is a page of this guide, another address is
// another page, and a change of mode, menu, theme or layout is the same page again.
// The guide cancels every `lintje-navigate` (below), so the start page is followed here.
shell.addEventListener('lintje-navigate', (event) => follow(event.detail.href))

/** Goes where an address points: another page, a category, or an element in its category. */
function follow(href) {
  const url = new URL(href, location.href)
  if (url.pathname !== location.pathname) {
    location.href = url.href
    return
  }
  const name = categoryOf(url.hash.slice(1))?.name ?? namedIn(url.searchParams) ?? CATEGORIES[0].name
  const changed = name !== category().name
  go(name, settings(), url.hash || (changed ? '' : location.hash))
  if (url.hash) reveal()
  else if (changed) window.scrollTo(0, 0)
}
shell.addEventListener('lintje-view-change', (event) => {
  go(category().name, searchWith(settings(), event.detail), location.hash)
})

/* Search: every element, on every page --------------------------------------- */
const ENTRIES = CATEGORIES.flatMap((group) =>
  elementsOf(group).map((item) => {
    const label = item.tag ? item.tag.replace('lintje-', '') : (item.short ?? item.title)
    return {
      result: { id: sectionId(item), label, meta: group.label, href: `#${sectionId(item)}` },
      text: [label, item.title, group.label].join(' ').toLocaleLowerCase('nl'),
    }
  }),
)

/**
 * Every category without a term; with one, the categories whose label holds it, then the
 * elements whose name, title or category hold it.
 */
function answer(term) {
  const wanted = term.trim().toLocaleLowerCase('nl')
  const categories = CATEGORIES.filter((item) => !wanted || item.label.toLocaleLowerCase('nl').includes(wanted))
  const categoryGroup = {
    label: 'Categorieën',
    items: categories.map((item) => ({ id: item.name, label: item.label, href: addressOf(item.name, settings()) })),
  }
  if (!wanted) return [categoryGroup]
  const found = ENTRIES.filter((entry) => entry.text.includes(wanted))
  // A name that holds the term comes before an element found by its title or category.
  const named = found.filter((entry) => entry.result.label.toLocaleLowerCase('nl').includes(wanted))
  const rest = found.filter((entry) => !named.includes(entry))
  return [categoryGroup, { label: 'Elementen', items: [...named, ...rest].map((entry) => entry.result) }]
}

function openSearch() {
  if (appSearch.open) return
  appSearch.query = ''
  appSearch.groups = answer('')
  appSearch.open = true
}

shell.addEventListener('lintje-search-open', openSearch)
// `/` goes to the latest search that registered it, which on "Paginakader" is a specimen.
document.addEventListener('lintje-open', (event) => {
  if (event.target.localName === 'lintje-app-search') openSearch()
})
appSearch.addEventListener('lintje-search', (event) => (appSearch.groups = answer(event.detail)))
appSearch.addEventListener('lintje-close', () => (appSearch.open = false))
appSearch.addEventListener('lintje-navigate', (event) => {
  event.preventDefault()
  follow(event.detail.href)
})

/**
 * Goes to the element the hash names. The sections did not exist when the browser applied
 * the hash, and they have their height only once the elements in them have rendered.
 */
async function reveal() {
  const target = document.getElementById(location.hash.slice(1))
  if (!target) return
  await Promise.all([...host.querySelectorAll('*')].map((node) => node.updateComplete))
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
  target.scrollIntoView()
}

// The guide is one page: a link inside a specimen goes nowhere.
for (const name of ['lintje-navigate', 'lintje-row-click', 'lintje-notification-open'])
  document.addEventListener(name, (event) => event.preventDefault())

// A link to an element in another category: draw that category, then go there.
window.addEventListener('hashchange', () => {
  render()
  reveal()
})
// Back and forward: the address has changed, draw what it says.
window.addEventListener('popstate', render)

render()
reveal()
