/**
 * The style guide: every element of the design system, a page per element.
 *
 * The shell's menu lists the Fundament pages and the categories; a Fundament page shows the
 * tokens, a category's page is an overview of its elements, and each element has its own page.
 * Where the reader is lives in the URL: `?foundation=colour`, `?category=inputs`, or
 * `?element=chart` with `&tab=referentie` for its open tab, and `&soort=pie` for an element whose
 * specimens come in groups — next to mode, menu, theme and layout. `#el-textarea`, the older
 * address, leads to the element's page. The specimens come from the modules in `specimens/`; a module that is missing
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
import { renderFoundationPage } from './foundation.js'
import { CATEGORIES, FOUNDATION, MENU, namedIn } from './menu.js'
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
const [manifest, dataTypes, { tokens }] = await Promise.all([
  loadJSON('../../dist-elements/custom-elements.json', { modules: [] }),
  loadJSON('../../dist-elements/data-types.json', { types: {} }),
  loadJSON('../../dist-elements/tokens.json', { tokens: [] }),
])
const declarations = declarationsOf(manifest)
const placed = new Set(CATEGORIES.flatMap((category) => category.elements))
const missing = bundle.LINTJE_TAGS.filter((tag) => !placed.has(tag.replace('lintje-', '')))
if (missing.length) console.warn('Not in the style guide:', missing.join(', '))

const categoryOf = (name) => CATEGORIES.find((category) => category.elements.includes(name))

// Each tag's layer, and the tags that draw it: the manifest only says what a tag draws.
const COMPOSITE = new Set(
  CATEGORIES.flatMap((category) => (category.composite ?? []).map((name) => `lintje-${name}`)),
)
const usedBy = new Map()
for (const [tag, declaration] of declarations)
  for (const drawn of declaration.draws ?? []) usedBy.set(drawn, [...(usedBy.get(drawn) ?? []), tag])

/* Where the page is: all of it in the URL ------------------------------------ */
const root = document.documentElement
const shell = document.getElementById('shell')
answerLogout(shell)
const pageHeader = document.getElementById('page-header')
const crumbs = document.getElementById('crumbs')
const host = document.getElementById('elements')
const appSearch = document.getElementById('search')

const PLACE = ['foundation', 'category', 'element', 'soort', 'staat', 'tab']
const SOURCE = 'https://github.com/h11t-labs/lintje/blob/main/'
const theme = () => themeOf(location.search)
/** The reader's settings, carried from page to page: the search without the place. */
const settings = (search = location.search) => {
  const rest = new URLSearchParams(search)
  for (const key of PLACE) rest.delete(key)
  return rest
}

/** Where an address points: a Fundament page, an element with its group and state, or a category. */
function placeOf(url) {
  const params = url.searchParams
  const foundation = FOUNDATION.items.find((entry) => entry.name === params.get('foundation'))
  if (foundation) return { foundation }
  const fromHash = url.hash.startsWith('#el-') ? url.hash.slice(4) : null
  const name = fromHash ?? params.get('element')
  const item = name ? specimens.get(name) : undefined
  if (item) {
    return {
      item,
      category: categoryOf(nameOf(item)) ?? CATEGORIES[0],
      group: params.get(item.groups?.param ?? 'soort'),
      tab: params.get('tab'),
    }
  }
  return { category: CATEGORIES.find((entry) => entry.name === namedIn(params)) ?? CATEGORIES[0] }
}

/** An address of this page: a Fundament page's, a category's or an element's, with the reader's settings. */
function addressOf({ foundation, category, item, group, tab }, search = settings()) {
  const next = new URLSearchParams(search)
  if (foundation) next.set('foundation', foundation.name)
  else if (item) {
    next.set('element', nameOf(item))
    if (group) next.set(item.groups?.param ?? 'soort', group)
    if (tab && tab !== 'voorbeelden') next.set('tab', tab)
  } else if (category && category.name !== CATEGORIES[0].name) next.set('category', category.name)
  const query = next.toString()
  return `${location.pathname}${query ? `?${query}` : ''}`
}
const elementAddress = (item, group) => addressOf({ item, group })

// The older address of an element, `#el-…`, becomes its page.
if (location.hash.startsWith('#el-')) {
  const place = placeOf(new URL(location.href))
  if (place.item) history.replaceState(null, '', addressOf(place))
}

let drawn
function render({ keepScroll = false } = {}) {
  const place = placeOf(new URL(location.href))
  const { foundation, category, item } = place
  root.dataset.mode = modeOf(location.search)
  // A framed specimen is a page of its own: it follows the guide's mode.
  for (const frame of host.querySelectorAll('.guide__frame'))
    frame.contentDocument?.documentElement.setAttribute('data-mode', root.dataset.mode)
  root.dataset.theme = theme()
  const label = foundation?.label ?? (item ? nameOf(item) : category.label)
  document.title = `${label} — Lintje stijlgids`

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
      {
        label: FOUNDATION.heading,
        links: FOUNDATION.items.map((entry) => ({
          label: entry.label,
          icon: entry.icon,
          href: addressOf({ foundation: entry }),
          active: entry === foundation,
        })),
      },
      ...MENU.map((group) => ({
        label: group.heading,
        links: group.items.map((entry) => ({
          label: entry.label,
          icon: entry.icon,
          href: addressOf({ category: entry }),
          active: entry === category,
        })),
      })),
    ],
    user: {
      initials: 'LS',
      name: `Lintje ${bundle.LINTJE_VERSION}`,
      role: `${bundle.LINTJE_TAGS.length} elementen`,
    },
    pageName: label,
  }
  if (foundation) {
    pageHeader.hidden = false
    pageHeader.data = { kicker: 'Lintje stijlgids', title: foundation.label, description: foundation.intro }
    crumbs.items = [{ label: 'Startpagina', href: carry('../') }, { label: FOUNDATION.heading }, { label: foundation.label }]
    // A token reads the mode and the theme itself: a new one draws nothing again.
    const drawing = `foundation:${foundation.name}`
    if (drawn === drawing) return
    drawn = drawing
    host.replaceChildren()
    for (const part of pageHeader.querySelectorAll('[slot="meta"], [slot="tabs"]')) part.remove()
    renderFoundationPage(host, foundation, tokens)
    return
  }
  const heading = MENU.find((group) => group.items.includes(category)).heading
  // The page header names the page, a category or an element, with its facts and its parts:
  // with a light menu it is the band in the primary colour.
  pageHeader.hidden = false
  if (item) {
    pageHeader.data = {
      kicker: 'Lintje stijlgids',
      title: item.tag ?? item.title,
      description: item.tag ? item.title : undefined,
    }
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
  // The open tab is the page's own: another tab draws nothing again.
  const drawing = `${item ? `element:${nameOf(item)}:${place.group}` : `category:${category.name}`}:${theme()}`
  if (drawn === drawing) return
  drawn = drawing
  const scroll = window.scrollY
  host.replaceChildren()
  for (const part of pageHeader.querySelectorAll('[slot="meta"], [slot="tabs"]')) part.remove()
  if (item) {
    const module = declarations.get(item.tag)?.module
    renderElementPage(host, item, {
      head: pageHeader,
      source: module ? `${SOURCE}${module}` : undefined,
      declarations,
      types: dataTypes.types,
      category: category.name,
      group: place.group,
      tab: place.tab,
      // A tab is a place on the page, kept in its address without drawing it again.
      remember: (tab) => history.replaceState(null, '', addressOf({ ...placeOf(new URL(location.href)), tab })),
      tabAddress: (tab) => addressOf({ ...placeOf(new URL(location.href)), tab }),
      addressOf: elementAddress,
      layer: COMPOSITE.has(item.tag) ? 'Samengesteld' : 'Bouwsteen',
      draws: declarations.get(item.tag)?.draws ?? [],
      usedBy: (usedBy.get(item.tag) ?? []).sort(),
      tagAddress: (tag) =>
        addressOf({ item: specimens.get(tag.replace('lintje-', '')), tab: 'referentie' }),
      go: (href, options) => follow(href, options),
      appAddress: (app) => carry(`../${app.href}`),
    })
  } else {
    renderOverview(host, elementsOf(category), {
      declarations,
      addressOf: (entry) => elementAddress(entry),
      go: (href) => follow(href),
      category: category.name,
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
  const same = before.foundation === after.foundation && before.item === after.item && before.category === after.category
  if (same) history.replaceState(null, '', target)
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
  const foundationGroup = {
    label: FOUNDATION.heading,
    items: FOUNDATION.items
      .filter((item) => !wanted || item.label.toLocaleLowerCase('nl').includes(wanted))
      .map((item) => ({ id: `foundation-${item.name}`, label: item.label, href: addressOf({ foundation: item }) })),
  }
  const categoryGroup = {
    label: 'Categorieën',
    items: categories.map((item) => ({ id: item.name, label: item.label, href: addressOf({ category: item }) })),
  }
  if (!wanted) return [foundationGroup, categoryGroup]
  const found = ENTRIES.filter((entry) => entry.text.includes(wanted))
  // A name that holds the term comes before an element found by its title or category.
  const named = found.filter((entry) => entry.result.label.toLocaleLowerCase('nl').includes(wanted))
  const rest = found.filter((entry) => !named.includes(entry))
  return [
    foundationGroup,
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
