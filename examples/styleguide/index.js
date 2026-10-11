/**
 * The style guide: every element of the design system, a page per element.
 *
 * The shell's menu lists the categories; a category's page is an overview of its elements, and
 * each element has its own page. Where the reader is lives in the URL: `?category=inputs`, or
 * `?element=chart` with `&soort=pie` and `&staat=loading` for an element whose specimens come in
 * groups — next to mode, menu, theme and layout. `#el-textarea`, the older address, leads to the
 * element's page. The specimens come from the modules in `specimens/`; a module that is missing
 * or throws is reported in the console and skipped, so one module cannot take the page down.
 * `/` or the shell's search icon searches every element.
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
import { renderElementPage, renderOverview } from './page.js'
import { declarationsOf, loadJSON } from './reference.js'
import { nameOf, sectionId } from './shared.js'

// The emblem and every icon named by data are read one file at a time from the house set.
bundle.setIconSource({ base: '../../dist-icons/' })

/* The specimens --------------------------------------------------------------- */
// One module per category, and every one is loaded, so search knows every element.
const specimens = new Map()
await Promise.all(
  CATEGORIES.map(async ({ name }) => {
    try {
      const { elements } = (await import(`./specimens/${name}.js`)).default
      for (const item of elements) specimens.set(nameOf(item), item)
    } catch (error) {
      console.warn(`specimens/${name}.js`, error)
    }
  }),
)
/** A category's elements, in the menu's order; one the modules do not have is reported and left out. */
const elementsOf = (category) =>
  category.elements.flatMap((name) => {
    const item = specimens.get(name)
    if (!item) console.warn(`No specimens for "${name}" (${category.label})`)
    return item ? [item] : []
  })
const [manifest, dataTypes] = await Promise.all([
  loadJSON('../../dist-elements/custom-elements.json', { modules: [] }),
  loadJSON('../../dist-elements/data-types.json', { types: {} }),
])
const declarations = declarationsOf(manifest)
const placed = new Set(CATEGORIES.flatMap((category) => category.elements))
const missing = bundle.LINTJE_TAGS.filter((tag) => !placed.has(tag.replace('lintje-', '')))
if (missing.length) console.warn('Not in the style guide:', missing.join(', '))

const categoryOf = (name) => CATEGORIES.find((category) => category.elements.includes(name))

/* Where the page is: all of it in the URL ------------------------------------ */
const root = document.documentElement
const shell = document.getElementById('shell')
answerLogout(shell)
const pageHeader = document.getElementById('page-header')
const crumbs = document.getElementById('crumbs')
const host = document.getElementById('elements')
const appSearch = document.getElementById('search')

const PLACE = ['category', 'element', 'soort', 'staat']
const SOURCE = 'https://github.com/h11t-labs/lintje/blob/main/'
const theme = () => themeOf(location.search)
/** The reader's settings, carried from page to page: the search without the place. */
const settings = (search = location.search) => {
  const rest = new URLSearchParams(search)
  for (const key of PLACE) rest.delete(key)
  return rest
}

/** Where an address points: an element with its group and state, or a category. */
function placeOf(url) {
  const params = url.searchParams
  const fromHash = url.hash.startsWith('#el-') ? url.hash.slice(4) : null
  const name = fromHash ?? params.get('element')
  const item = name ? specimens.get(name) : undefined
  if (item) {
    return {
      item,
      category: categoryOf(nameOf(item)) ?? CATEGORIES[0],
      group: params.get(item.groups?.param ?? 'soort'),
      state: params.get('staat'),
    }
  }
  return { category: CATEGORIES.find((entry) => entry.name === namedIn(params)) ?? CATEGORIES[0] }
}

/** An address of this page: a category's or an element's, with the reader's settings. */
function addressOf({ category, item, group, state }, search = settings()) {
  const next = new URLSearchParams(search)
  if (item) {
    next.set('element', nameOf(item))
    if (group) next.set(item.groups?.param ?? 'soort', group)
    if (state && state !== item.states?.[0]?.value) next.set('staat', state)
  } else if (category && category.name !== CATEGORIES[0].name) next.set('category', category.name)
  const query = next.toString()
  return `${location.pathname}${query ? `?${query}` : ''}`
}
const elementAddress = (item, group, state) => addressOf({ item, group, state })

// The older address of an element, `#el-…`, becomes its page.
if (location.hash.startsWith('#el-')) {
  const place = placeOf(new URL(location.href))
  if (place.item) history.replaceState(null, '', addressOf(place))
}

let drawn
function render({ keepScroll = false } = {}) {
  const place = placeOf(new URL(location.href))
  const { category, item } = place
  root.dataset.mode = modeOf(location.search)
  root.dataset.theme = theme()
  document.title = `${item ? nameOf(item) : category.label} — Lintje stijlgids`

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
        links: group.items.map((entry) => ({
          label: entry.label,
          icon: entry.icon,
          href: addressOf({ category: entry }),
          active: entry.name === category.name,
        })),
      })),
    ],
    user: {
      initials: 'LS',
      name: `Lintje ${bundle.LINTJE_VERSION}`,
      role: `${bundle.LINTJE_TAGS.length} elementen`,
    },
    pageName: item ? nameOf(item) : category.label,
  }
  const heading = MENU.find((group) => group.items.includes(category)).heading
  for (const action of pageHeader.querySelectorAll('[slot="actions"]')) action.remove()
  if (item) {
    const module = declarations.get(item.tag)?.module
    if (module) {
      const source = document.createElement('lintje-button')
      source.slot = 'actions'
      source.variant = 'secondary'
      source.size = 'compact'
      source.href = `${SOURCE}${module}`
      source.target = '_blank'
      source.textContent = 'Broncode'
      pageHeader.append(source)
    }
    // The link to this page is the shell's "Delen".
    pageHeader.data = { kicker: category.label, title: item.tag ?? item.title, description: item.tag ? item.title : undefined }
    crumbs.items = [
      { label: 'Startpagina', href: carry('../') },
      { label: heading },
      { label: category.label, href: addressOf({ category }) },
      { label: nameOf(item) },
    ]
  } else {
    pageHeader.data = { kicker: 'Lintje stijlgids', title: category.label, description: category.intro }
    // A heading has no page of its own: its crumb is text.
    crumbs.items = [{ label: 'Startpagina', href: carry('../') }, { label: heading }, { label: category.label }]
  }

  // A specimen reads the theme when it is drawn (the shell's emblem), so a new theme redraws.
  const drawing = `${item ? `element:${nameOf(item)}:${place.group}:${place.state}` : `category:${category.name}`}:${theme()}`
  if (drawn === drawing) return
  drawn = drawing
  const scroll = window.scrollY
  host.replaceChildren()
  if (item) {
    renderElementPage(host, item, {
      declarations,
      types: dataTypes.types,
      siblings: elementsOf(category),
      category: category.name,
      categoryLabel: category.label,
      group: place.group,
      state: place.state,
      addressOf: elementAddress,
      go: (href, options) => follow(href, options),
      appAddress: (app) => carry(`../${app.href}`),
      categoryAddress: addressOf({ category }),
    })
  } else {
    renderOverview(host, elementsOf(category), {
      declarations,
      addressOf: (entry) => elementAddress(entry),
      go: (href) => follow(href),
    })
  }
  if (keepScroll) requestAnimationFrame(() => window.scrollTo(0, scroll))
}

/** Goes where an address points: another page, or a place on this one. */
function follow(href, { keepScroll = false } = {}) {
  const url = new URL(href, location.href)
  if (url.pathname !== location.pathname) {
    location.href = url.href
    return
  }
  // A link within the page (`#referentie`) only scrolls.
  if (url.search === location.search && url.hash) {
    history.replaceState(null, '', url.href)
    reveal()
    return
  }
  const before = placeOf(new URL(location.href))
  const after = placeOf(url)
  const target = `${addressOf(after, settings(url.search))}${url.hash.startsWith('#el-') ? '' : url.hash}`
  if (before.item === after.item && before.category === after.category) history.replaceState(null, '', target)
  else history.pushState(null, '', target)
  render({ keepScroll })
  if (url.hash && !url.hash.startsWith('#el-')) reveal()
  else if (!keepScroll) window.scrollTo(0, 0)
}

// The shell asks; the page decides. A category or an element is a page of this guide, another
// address is another page, and a change of mode, menu, theme or layout is the same page again.
// The guide cancels every `lintje-navigate` (below), so a link of the guide's own is followed here.
shell.addEventListener('lintje-navigate', (event) => follow(event.detail.href))
host.addEventListener('lintje-navigate', (event) => {
  // A link inside a specimen goes nowhere; the guide's own lead somewhere.
  if (event.target.closest('.guide__stage')) return
  follow(event.detail.href)
})
shell.addEventListener('lintje-view-change', (event) => {
  const place = placeOf(new URL(location.href))
  history.replaceState(null, '', addressOf(place, new URLSearchParams(searchWith(settings(), event.detail))))
  render({ keepScroll: true })
})

/* Search: every element, on every page --------------------------------------- */
const ENTRIES = CATEGORIES.flatMap((group) =>
  elementsOf(group).map((item) => {
    const label = nameOf(item)
    return {
      item,
      result: { id: sectionId(item), label, meta: group.label },
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
    items: categories.map((item) => ({ id: item.name, label: item.label, href: addressOf({ category: item }) })),
  }
  if (!wanted) return [categoryGroup]
  const found = ENTRIES.filter((entry) => entry.text.includes(wanted))
  // A name that holds the term comes before an element found by its title or category.
  const named = found.filter((entry) => entry.result.label.toLocaleLowerCase('nl').includes(wanted))
  const rest = found.filter((entry) => !named.includes(entry))
  return [
    categoryGroup,
    {
      label: 'Elementen',
      items: [...named, ...rest].map((entry) => ({ ...entry.result, href: elementAddress(entry.item) })),
    },
  ]
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
 * Goes to the place the hash names. The sections did not exist when the browser applied the
 * hash, and they have their height only once the elements in them have rendered.
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

// A link to an element's older address: draw its page.
window.addEventListener('hashchange', () => {
  if (location.hash.startsWith('#el-')) follow(location.href)
  else reveal()
})
// Back and forward: the address has changed, draw what it says.
window.addEventListener('popstate', () => render())

render()
reveal()
