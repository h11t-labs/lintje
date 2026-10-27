/**
 * The style guide's two pages: a category's overview, a card per element, and an element's own
 * page — what it is, its specimens with their code, its reference, where it is used and how to
 * load it, with "Op deze pagina" beside it.
 */
import { codeOf, richProperties } from './code.js'
import {
  fieldsOf,
  interfaceFields,
  renderReference,
  typeNames,
  variantReference,
} from './reference.js'
import { allSpecimens, nameOf, renderSpecimen, slug } from './shared.js'
import { KIND_SKETCHES, SKETCHES, sketchOf } from './sketches.js'
import { usageOf } from './usage.js'

function element(name, className, text) {
  const node = document.createElement(name)
  if (className) node.className = className
  if (text) node.textContent = text
  return node
}

const heading = (level, text) =>
  element(`h${level}`, level === 3 ? 'guide__heading' : 'guide__subheading', text)

const count = (n, one, many) => `${n} ${n === 1 ? one : many}`

/** The API in one line: properties, events, slots. */
const apiOf = (declaration) =>
  [
    [fieldsOf(declaration).length, 'eigenschap', 'eigenschappen'],
    [declaration.events.length, 'event', 'events'],
    [declaration.slots.length, 'slot', 'slots'],
  ]
    .map(([n, one, many]) => (n ? count(n, one, many) : `geen ${many}`))
    .join(' · ')

/** What an element's card says about it in one line. */
function summaryOf(item, declaration, apps) {
  const parts = [count(allSpecimens(item).length, 'voorbeeld', 'voorbeelden')]
  if (item.groups) parts.push(`${item.groups.items.length} ${item.groups.plural}`)
  if (declaration) parts.push(count(fieldsOf(declaration).length, 'eigenschap', 'eigenschappen'))
  if (apps) parts.push(`in ${count(apps, 'app', 'apps')}`)
  return parts.join(' · ')
}

/**
 * A card whose title is its link; the link's area covers the card, so the whole card is
 * clickable while the title stays its one tab stop. `go` follows the guide's own addresses.
 */
function linkCard(className, href, go, parts) {
  const card = element('article', className)
  const link = element('a', 'guide__card-link')
  link.href = href
  link.addEventListener('click', (event) => {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    go(href)
  })
  parts(card, link)
  return card
}

/**
 * A row of facts: label and value side by side. A value with `href` is a link; `links` is a list
 * of them, comma-separated, with `value` the text when the list is empty.
 */
function factsRow(items, go, className = '') {
  const list = element('dl', `guide__facts ${className}`.trim())
  const linkTo = (value, href) => {
    const link = element('a', '', value)
    link.href = href
    if (go)
      link.addEventListener('click', (event) => {
        event.preventDefault()
        go(href)
      })
    return link
  }
  for (const { label, value, href, links } of items) {
    const pair = element('div', 'guide__fact')
    pair.append(element('dt', '', label))
    const dd = element('dd')
    if (links?.length)
      links.forEach((entry, i) => dd.append(...(i ? [', '] : []), linkTo(entry.value, entry.href)))
    else if (href) dd.append(linkTo(value, href))
    else dd.textContent = value
    pair.append(dd)
    list.append(pair)
  }
  return list
}

const LAYER_TEXT = {
  Bouwsteen: 'één bedieningselement, één waarde, één stuk inhoud of één kader.',
  Samengesteld: 'ordent een verzameling van de host uit bouwstenen.',
}

/** What a tag is built from and where it is used, each tag a link to its page. */
function buildSection(context, toc) {
  const node = section('opbouw', 'Opbouw', toc)
  const links = (tags) =>
    tags.map((tag) => ({ value: tag.replace('lintje-', ''), href: context.tagAddress(tag) }))
  node.append(
    element('p', 'guide__meta', `${context.layer}: ${LAYER_TEXT[context.layer]}`),
    factsRow(
      [
        { label: 'Bestaat uit', value: 'geen andere tag', links: links(context.draws) },
        { label: 'Gebruikt in', value: 'geen andere tag', links: links(context.usedBy) },
      ],
      context.go,
      'guide__facts--stacked',
    ),
  )
  return node
}

/* The overview ------------------------------------------------------------------------- */

/** A category's elements as cards: its preview, its name, what it is and what it holds. */
export function renderOverview(host, items, { declarations, addressOf, go, category }) {
  const tags = items.filter((item) => item.tag).length
  host.append(
    factsRow([
      { label: 'Elementen', value: String(items.length) },
      { label: 'Laden', value: `import 'lintje/${category}'` },
    ]),
  )
  const grid = element('div', 'guide__cards')
  for (const item of items) {
    grid.append(
      linkCard('guide__card', addressOf(item), go, (card, link) => {
        const preview = element('div', 'guide__card-preview')
        const sketch = sketchOf(SKETCHES[nameOf(item)])
        if (sketch) preview.append(sketch)
        card.append(preview)
        const body = element('div', 'guide__card-body')
        const title = element('h3', 'guide__card-title')
        // A section without a tag is named as the menu names it; its title is the line under it.
        link.append(element('code', '', nameOf(item)))
        title.append(link)
        body.append(title, element('p', 'guide__card-text', item.title))
        const meta = element('p', 'guide__meta', summaryOf(item, declarations.get(item.tag)))
        body.append(meta)
        if (item.tag)
          usageOf(item.tag).then((usage) => {
            meta.textContent = summaryOf(item, declarations.get(item.tag), usage.length)
          })
        card.append(body)
      }),
    )
  }
  host.append(grid)
  return tags
}

/* Code -------------------------------------------------------------------------------- */

const CODE_KINDS = [
  ['html', 'HTML', 'html'],
  ['js', 'JavaScript', 'js'],
  ['server', 'Server-HTML', 'html'],
]

/**
 * A code box: the ways to write something as tabs, each with its code and Kopiëren under it.
 * `read()` gives the code; `fill()` reads it again, so a specimen's is what it drew last.
 */
function codeBox(kinds, read, label = 'Code') {
  const box = element('div', 'guide__codebox')
  const tabs = document.createElement('lintje-tabs')
  tabs.label = label
  tabs.tabs = kinds.map(([value, title]) => ({ value, label: title }))
  tabs.value = kinds[0][0]
  const panels = new Map()
  for (const [key, , language] of kinds) {
    const panel = element('div', 'guide__codepanel')
    panel.slot = key
    const block = document.createElement('lintje-code')
    block.language = language
    const copy = document.createElement('lintje-copy-button')
    copy.size = 'compact'
    copy.variant = 'flat'
    panel.append(block, copy)
    panels.set(key, { block, copy })
    tabs.append(panel)
  }
  box.fill = () => {
    const code = read()
    for (const [key, { block, copy }] of panels) {
      block.text = code[key]?.text ?? ''
      copy.text = code[key]?.copy ?? ''
    }
  }
  tabs.addEventListener('lintje-tab-change', (event) => {
    event.stopPropagation()
    tabs.value = event.detail
  })
  box.append(tabs)
  box.fill()
  return box
}

/** The code under a specimen, shut in an expander: the page stays calm until a reader asks. */
function codeToggle(figure, html) {
  const read = () => codeOf(figure.stage, html)
  const kindsOf = () => {
    const code = read()
    return CODE_KINDS.filter(([key]) => code[key])
  }
  if (!kindsOf().length) return
  const expander = document.createElement('lintje-expander')
  expander.className = 'guide__specimen-code'
  expander.flat = true
  expander.leading = true
  expander.heading = 'Code'
  let box
  expander.addEventListener('lintje-toggle', (event) => {
    event.stopPropagation()
    if (!event.detail) return
    // Read when opened: a framed specimen has drawn by then, and the code is what it drew.
    if (box) box.fill()
    else expander.append((box = codeBox(kindsOf(), read, 'Code van dit voorbeeld')))
  })
  figure.append(expander)
}

/* A specimen as a row ------------------------------------------------------------------ */

/**
 * One specimen as a row: its title and its note beside the stage, what the host heard
 * under the stage, and its code a press away. `level` is its name's heading level.
 */
function example(entry, options, level = 3) {
  // A wide element, or one in a frame of its own, takes the row's width, its title above it.
  const wide = entry.wide ?? entry.frame ?? options?.item?.wide ?? options?.item?.frame
  const row = element('div', wide ? 'guide__example guide__example--wide' : 'guide__example')
  const about = element('div', 'guide__about')
  if (entry.label) {
    row.id = `vb-${slug(entry.label)}`
    about.append(element(`h${level}`, 'guide__example-name', entry.label))
    if (entry.note) {
      // A name in backticks is code: an attribute, a slot, a value.
      const note = element('p', 'guide__note')
      entry.note.split(/`([^`]+)`/).forEach((part, i) => {
        if (part) note.append(i % 2 ? element('code', '', part) : part)
      })
      about.append(note)
    }
  }
  const figure = renderSpecimen(entry, options)
  figure.html = entry.html
  codeToggle(figure, entry.html)
  row.append(about, figure)
  row.figure = figure
  return row
}

/* The element's page ------------------------------------------------------------------- */

/** The fields a specimen sets on the element's own tag: attributes, rich properties and their keys. */
function fieldsShown(figure, item, declaration) {
  const shown = new Set()
  if (!item.tag || !declaration) return shown
  const attributes = new Map(declaration.attributes.map((entry) => [entry.name, entry.fieldName]))
  const template = document.createElement('template')
  template.innerHTML = figure.html ?? ''
  for (const node of template.content.querySelectorAll(item.tag))
    for (const { name } of node.attributes) if (attributes.has(name)) shown.add(attributes.get(name))
  for (const node of figure.stage.querySelectorAll(item.tag))
    for (const [property, value] of richProperties(node)) {
      // An object is told by its keys; the property itself says nothing apart.
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        shown.add(property)
        continue
      }
      for (const [key, inner] of Object.entries(value)) {
        // The kind a group is chosen by is read one level deeper: `chart.donut`.
        const kind = item.groups && inner && typeof inner === 'object' && item.groups.key in inner
        if (!kind) shown.add(`${property}.${key}`)
        else
          for (const deeper of Object.keys(inner))
            if (deeper !== item.groups.key) shown.add(`${key}.${deeper}`)
      }
    }
  return shown
}

/** Where the union a group is chosen from stands: its type and the prefix of its fields. */
function groupUnion(item, declaration, types) {
  if (!item.groups || !declaration) return null
  for (const field of fieldsOf(declaration))
    for (const name of typeNames(field.type?.text, types))
      for (const inner of interfaceFields(name, types))
        for (const typeName of typeNames(inner.type, types))
          if (types[typeName].kind === 'union' && types[typeName].discriminant === item.groups.key)
            return { typeName, prefix: `${inner.name}.` }
  return null
}

/** A section in a tab, with its heading and the entry it gets in "Op deze pagina". */
export function section(id, title, toc, items) {
  const node = element('section', 'guide__section')
  node.id = id
  const head = element('div', 'guide__section-head')
  if (title) head.append(heading(3, title))
  node.append(head)
  if (title) toc.push({ label: title, href: `#${id}`, items })
  else if (items) toc.push(...items)
  return node
}

/** The kinds of an element that draws several, by the question they answer, each drawn small. */
function chooser(item, chosen, addressOf, go) {
  const groups = item.groups
  const box = element('div', 'guide__chooser')
  for (const [question, label] of Object.entries(groups.questions ?? { '': '' })) {
    const entries = groups.items.filter((entry) => !question || entry.question === question)
    if (!entries.length) continue
    const row = element('div', 'guide__choice')
    row.append(element('p', 'guide__question', label))
    const cards = element('div', 'guide__kinds')
    for (const entry of entries) {
      const href = addressOf(item, entry.value)
      cards.append(
        linkCard(entry === chosen ? 'guide__kind is-chosen' : 'guide__kind', href, go, (card, link) => {
          const mini = element('div', 'guide__mini')
          const sketch = sketchOf(KIND_SKETCHES[entry.value])
          if (sketch) mini.append(sketch)
          card.append(mini)
          link.textContent = entry.label
          if (entry === chosen) link.setAttribute('aria-current', 'true')
          const name = element('span', 'guide__kind-name')
          name.append(link)
          card.append(name)
        }),
      )
    }
    row.append(cards)
    box.append(row)
  }
  return box
}

// The element's page in tabs; each holds its part, and the URL remembers the open one.
const TABS = [
  ['voorbeelden', 'Voorbeelden'],
  ['referentie', 'Referentie'],
  ['toegepast', 'Toegepast in'],
  ['gebruiken', 'Gebruiken'],
]

/**
 * An element's page: its facts and its parts as tabs in the page header (`head`), and under it
 * the open part, with "Op deze pagina" beside it. `group` and `tab` are what the URL chose;
 * `addressOf(item, group)` writes an
 * address, `tabAddress(tab)` one of its tabs, `go(address)` follows it and `remember(tab)` writes
 * the open tab into the URL.
 */
export function renderElementPage(host, item, context) {
  const { declarations, types, group, addressOf, go } = context
  const declaration = declarations.get(item.tag)
  const groups = item.groups
  const chosen = groups && (groups.items.find((entry) => entry.value === group) ?? groups.items[0])
  const shownTabs = TABS.filter(([value]) => item.tag || value === 'voorbeelden')
  const toc = Object.fromEntries(shownTabs.map(([value]) => [value, []]))
  const panels = Object.fromEntries(
    shownTabs.map(([value]) => [value, element('div', 'guide__panel')]),
  )

  // Under the title, which says what it is, its facts in one quiet line.
  const kind = item.tag ? context.layer : 'Sectie'
  const facts = element('p', 'guide__summary')
  facts.slot = 'meta'
  const writeFacts = (apps) => {
    facts.textContent = [
      kind,
      ...(declaration ? [apiOf(declaration)] : []),
      ...(apps ? [`in ${count(apps, 'app', 'apps')}`] : []),
    ].join(' · ')
    if (!context.source) return
    const source = element('a', '', 'Broncode')
    source.href = context.source
    source.target = '_blank'
    facts.append(' · ', source)
  }
  writeFacts()

  // The parts are pages of the element: a row of links, each an address with its `&tab=`.
  const tabs = document.createElement('lintje-tabs')
  tabs.slot = 'tabs'
  tabs.label = `Over ${item.tag ?? nameOf(item)}`
  context.head.append(facts, tabs)

  const page = element('div', 'guide__page')
  const main = element('div', 'guide__main')
  const nav = document.createElement('lintje-sub-nav')
  nav.className = 'guide__toc'
  nav.expanded = true
  nav.label = 'Op deze pagina'
  main.append(...Object.values(panels))
  // First in the source, so Tab and a screen reader reach it where it shows below 1024 px.
  page.append(nav, main)
  const counts = {}
  const drawTabs = () => {
    tabs.tabs = shownTabs.map(([value, label]) => ({
      value,
      label,
      count: counts[value],
      href: context.tabAddress(value),
    }))
  }
  /** Opens a tab: its panel, its entries in "Op deze pagina", its place in the URL. */
  const open = (value) => {
    tabs.value = value
    for (const [key, panel] of Object.entries(panels)) panel.hidden = key !== value
    context.remember?.(value)
    follow(nav, toc[value])
  }
  tabs.addEventListener('lintje-tab-change', (event) => {
    event.stopPropagation()
    open(event.detail)
  })

  // The specimens, a row each; with groups, the chooser first and then the chosen one's.
  const examples = panels.voorbeelden
  const figures = []
  const batches = []
  const draw = (entries, list, options, level = 3) => {
    const rows = entries.map((entry) => example(entry, options, level))
    list.append(...rows)
    const batch = rows.map((row) => row.figure)
    figures.push(...batch)
    batches.push(batch)
    return rows
  }
  const rowList = () => element('div', 'guide__examples')
  const tocOf = (rows) =>
    rows
      .filter((row) => row.id)
      .map((row) => ({ label: row.querySelector('.guide__example-name').textContent, href: `#${row.id}` }))

  let frame = examples
  if (groups) {
    const choose = section('kiezen', groups.question ?? `Welke ${groups.label.toLowerCase()}?`, toc.voorbeelden)
    choose.append(chooser(item, chosen, addressOf, go))
    examples.append(choose)

    // The chosen kind: what it is for, once, then its specimens as every element's.
    const kindRows = rowList()
    const rows = draw(chosen.specimens, kindRows, { item }, 4)
    frame = section('soort', chosen.label, toc.voorbeelden, tocOf(rows))
    frame
      .querySelector('.guide__section-head')
      .append(element('code', 'guide__key', `${groups.key}: '${chosen.value}'`))
    if (chosen.use || chosen.avoid) {
      const advice = element('div', 'guide__advice')
      for (const [title, text] of [
        ['Neem hem voor', chosen.use],
        ['Niet voor', chosen.avoid],
      ]) {
        if (!text) continue
        const part = element('div')
        part.append(element('p', 'guide__advice-title', title), element('p', 'guide__advice-text', text))
        advice.append(part)
      }
      frame.append(advice)
    }
    frame.append(kindRows)
    examples.append(frame)

    // What every kind shares: the states, drawn small for the chosen kind, and the rest once.
    const shared = section('elke-soort', groups.shared ?? 'Voor elk', toc.voorbeelden)
    shared.append(element('p', 'guide__meta', 'Eén keer getoond; het werkt bij elke soort hetzelfde.'))
    const states = (item.states ?? []).filter((state) => state.data)
    if (states.length && chosen.specimens[0]) {
      const row = element('div', 'guide__states')
      for (const state of states) {
        const figure = renderSpecimen(chosen.specimens[0], { item, state })
        figure.append(element('figcaption', 'guide__state-name', state.label))
        row.append(figure)
      }
      shared.append(row)
    }
    if (item.specimens.length) {
      const list = rowList()
      draw(item.specimens, list, { item }, 4)
      shared.append(list)
    }
    examples.append(shared)
    counts.voorbeelden = groups.items.length
  } else {
    // The tab names the part; the specimens need no heading of their own.
    const list = section('voorbeelden-lijst', null, toc.voorbeelden)
    const rows = rowList()
    toc.voorbeelden.push(...tocOf(draw(item.specimens, rows, { item })))
    list.append(rows)
    examples.append(list)
    counts.voorbeelden = item.specimens.length
  }

  // Which specimen shows which field. A key of rich data that every specimen beside it sets (a
  // title, a footnote) tells nothing apart; an attribute is always the specimen's own choice.
  const shown = new Map(figures.map((figure) => [figure, fieldsShown(figure, item, declaration)]))
  for (const batch of batches) {
    if (batch.length < 2) continue
    const sets = batch.map((figure) => shown.get(figure))
    const everywhere = [...sets[0]].filter(
      (key) => key.includes('.') && sets.every((set) => set.has(key)),
    )
    for (const set of sets) for (const key of everywhere) set.delete(key)
  }
  const shownBy = new Map()
  for (const figure of figures) {
    const label = figure.closest('.guide__example')?.querySelector('.guide__example-name')?.textContent
    if (label)
      for (const key of shown.get(figure))
        shownBy.set(key, [...(shownBy.get(key) ?? []), label])
  }

  // "Te zien in" leads to the specimen of that name, and the focus to its heading: the tab it
  // was pressed in is hidden now.
  const onSeen = (name) => {
    open('voorbeelden')
    const row = [...examples.querySelectorAll('.guide__example')].find(
      (node) => node.querySelector('.guide__example-name')?.textContent === name,
    )
    const head = row?.querySelector('.guide__example-name')
    if (head) {
      head.tabIndex = -1
      head.focus({ preventScroll: true })
    }
    requestAnimationFrame(() => row?.scrollIntoView({ block: 'start' }))
  }

  // The chosen kind's own fields stand in its frame; the reference leaves them out.
  const union = declaration && groupUnion(item, declaration, types)
  if (union) {
    const own = variantReference(types[union.typeName], chosen.value, types, shownBy, union.prefix, onSeen)
    if (own) {
      const tile = document.createElement('lintje-tile')
      tile.heading = `Velden van ${groups.key}: '${chosen.value}'`
      tile.append(own)
      frame.append(tile)
    }
  }

  if (panels.referentie) {
    if (declaration) {
      // The tag's source comment, quoted as it stands: English, as the source is.
      let about
      if (declaration.description) {
        about = document.createElement('lintje-code')
        about.language = 'js'
        about.label = 'Kopcommentaar'
        about.text = `/**\n${declaration.description
          .split('\n')
          .map((line) => ` * ${line}`.trimEnd())
          .join('\n')}\n */`
      }
      panels.referentie.append(buildSection(context, toc.referentie))
      const reference = renderReference(declaration, types, {
        shownBy,
        skip: new Set(union ? [union.typeName] : []),
        onSeen,
        about,
      })
      toc.referentie.push(...reference.toc)
      panels.referentie.append(reference)
      counts.referentie = fieldsOf(declaration).length
    } else {
      const missing = document.createElement('lintje-prose')
      missing.tone = 'muted'
      missing.text = 'Geen referentie: draai `npm run build:elements`.'
      panels.referentie.append(missing)
    }
  }

  if (item.tag) {
    panels.toegepast.append(
      usageSection(item.tag, context.appAddress, toc.toegepast, (apps, total) => {
        writeFacts(apps)
        counts.toegepast = total || undefined
        drawTabs()
        if (tabs.value === 'toegepast') follow(nav, toc.toegepast)
      }),
    )
    panels.gebruiken.append(...useSections(item, context.category, figures[0], toc.gebruiken))
  }

  drawTabs()
  host.append(page)
  open(toc[context.tab] ? context.tab : 'voorbeelden')
}

/* "Op deze pagina" follows the reading ------------------------------------------------- */

let following
/** Marks the entry in view, as `docs/guides/page-contents.md` does; a tab without entries hides it. */
export function follow(nav, toc) {
  const all = (items) => items.flatMap((item) => [item, ...all(item.items ?? [])])
  const mark = (items, href) =>
    items.map((item) => ({
      label: item.label,
      href: item.href,
      active: item.href === href,
      ...(item.items ? { items: mark(item.items, href) } : {}),
    }))
  const groups = (href) => (toc.length ? [{ label: 'Op deze pagina', items: mark(toc, href) }] : [])
  let shown
  nav.hidden = !toc.length
  nav.groups = groups(null)
  const update = () => {
    if (!nav.isConnected) return
    const root = document.documentElement
    const end = scrollY + innerHeight >= root.scrollHeight - 1
    const line = end ? innerHeight : (parseFloat(getComputedStyle(root).scrollPaddingTop) || 0) + 1
    let href = null
    for (const item of all(toc)) {
      const target = document.getElementById(item.href.slice(1))
      if (target?.offsetParent && target.getBoundingClientRect().top <= line) href = item.href
    }
    if (href === shown) return
    shown = href
    nav.groups = groups(href)
  }
  if (!following) {
    let frame = 0
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => following?.())
    }
    addEventListener('scroll', schedule, { passive: true })
    addEventListener('resize', schedule)
  }
  following = update
  requestAnimationFrame(update)
}

/* Where it is used, and how to load it -------------------------------------------------- */

const PLACES_SHOWN = 12

/** Where the tag stands in the example applications, filled in once their files are read;
 *  `onCount(apps, places)` hears how many. */
function usageSection(tag, appAddress, toc, onCount) {
  const node = section('toegepast-lijst', null, toc)
  node
    .querySelector('.guide__section-head')
    .append(element('span', 'guide__meta', 'Gevonden in de bestanden van examples/'))
  const note = document.createElement('lintje-prose')
  note.tone = 'muted'
  note.text = 'De voorbeeldapplicaties worden doorzocht…'
  node.append(note)
  usageOf(tag).then((usage) => {
    const total = usage.reduce((sum, entry) => sum + entry.places.length, 0)
    if (!total) {
      note.text = 'Nog in geen enkele voorbeeldapplicatie.'
      onCount(0, 0)
      return
    }
    note.remove()
    const tiles = usage.map(({ app, places }) => {
      const tile = document.createElement('lintje-tile')
      tile.span = 12
      tile.id = `app-${app.href.replace(/\W+/g, '')}`
      tile.heading = app.label
      tile.subtitle = count(places.length, 'plek', 'plekken')
      tile.dataset.app = app.href
      toc.push({ label: app.label, href: `#${tile.id}` })
      const link = document.createElement('lintje-button')
      link.slot = 'actions'
      link.variant = 'link'
      link.size = 'compact'
      link.href = appAddress(app)
      link.textContent = `Openen in ${app.label}`
      const code = document.createElement('lintje-code')
      code.language = 'html'
      code.label = `${tag} in ${app.label}`
      const lines = places
        .slice(0, PLACES_SHOWN)
        .map((place) => `${place.path}:${place.line}  ${place.text}`)
      if (places.length > PLACES_SHOWN) lines.push(`… en nog ${places.length - PLACES_SHOWN}`)
      code.text = lines.join('\n')
      tile.append(link, code)
      return tile
    })
    if (usage.length > 1) {
      const filter = document.createElement('lintje-segmented')
      filter.label = 'Applicatie'
      filter.hideLabel = true
      filter.options = [
        { value: '', label: 'Alle', count: total },
        ...usage.map(({ app, places }) => ({
          value: app.href,
          label: app.label,
          count: places.length,
        })),
      ]
      filter.value = ''
      filter.addEventListener('lintje-change', (event) => {
        event.stopPropagation()
        filter.value = event.detail
        for (const tile of tiles)
          tile.hidden = Boolean(event.detail) && tile.dataset.app !== event.detail
      })
      node.querySelector('.guide__section-head').prepend(filter)
    }
    const grid = document.createElement('lintje-grid')
    grid.append(...tiles)
    node.append(grid)
    onCount(usage.length, total)
  })
  return node
}

/**
 * How to use the tag, in two steps: load it — by itself, with its category or the whole bundle —
 * and put it in the page, as its first specimen does.
 */
function useSections(item, category, first, toc) {
  const name = nameOf(item)
  const load = section('laden', '1. Laad de tag', toc)
  load.append(
    element('p', 'guide__meta', 'Eén import, in het script van je pagina. Kies hoeveel je laadt.'),
  )
  const ways = [
    ['Alleen deze tag', 'Het kleinst: voor een pagina die maar een paar elementen gebruikt.', `import 'lintje/tag/${name}'`],
    ['Zijn categorie', 'Elk element van dezelfde categorie, in één keer.', `import 'lintje/${category}'`],
    ['De hele bundel', 'Elk element van Lintje: het eenvoudigst, het grootst.', `import 'lintje'`],
  ]
  const list = element('div', 'guide__ways')
  for (const [title, text, code] of ways) {
    const way = element('div', 'guide__way')
    const about = element('div')
    about.append(element('p', 'guide__way-name', title), element('p', 'guide__note', text))
    const block = document.createElement('lintje-code')
    block.language = 'js'
    block.text = code
    const copy = document.createElement('lintje-copy-button')
    copy.size = 'compact'
    copy.variant = 'flat'
    copy.text = code
    way.append(about, block, copy)
    list.append(way)
  }
  load.append(list)
  const sections = [load]
  if (first) {
    const place = section('plaatsen', '2. Zet hem in je pagina', toc)
    place.append(
      element('p', 'guide__meta', 'Zoals het eerste voorbeeld: de markup, en wat een script erop zet.'),
    )
    const read = () => codeOf(first.stage, first.html)
    const code = read()
    const kinds = CODE_KINDS.filter(([key]) => code[key])
    if (kinds.length) place.append(codeBox(kinds, read, 'Code van het eerste voorbeeld'))
    sections.push(place)
  }
  return sections
}
