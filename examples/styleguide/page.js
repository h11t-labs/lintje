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
import { allSpecimens, nameOf, renderSpecimen } from './shared.js'
import { usageOf } from './usage.js'

function element(name, className, text) {
  const node = document.createElement(name)
  if (className) node.className = className
  if (text) node.textContent = text
  return node
}

const heading = (level, text) =>
  element(`h${level}`, level === 3 ? 'guide__heading' : 'guide__subheading', text)

const escape = (text) => text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])

/** A source comment as markup: escaped, its paragraphs kept and `code` marked. The tag's own
 *  name at the start goes: the page's title says it. */
function proseOf(description) {
  return escape(
    description.replace(/^`<lintje-[a-z-]+>`(?: \/ `<lintje-[a-z-]+>`)* — (.)/, (_, first) =>
      first.toUpperCase(),
    ),
  )
    .split(/\n\s*\n/)
    .map((part) => `<p>${part.replace(/`([^`]+)`/g, '<code>$1</code>')}</p>`)
    .join('')
}

const count = (n, one, many) => `${n} ${n === 1 ? one : many}`

/** The API in one line: properties, events, slots. */
const apiOf = (declaration) =>
  [
    count(fieldsOf(declaration).length, 'eigenschap', 'eigenschappen'),
    count(declaration.events.length, 'event', 'events'),
    count(declaration.slots.length, 'slot', 'slots'),
  ].join(' · ')

/** What an element's card says about it in one line. */
function summaryOf(item, declaration) {
  const parts = [count(allSpecimens(item).length, 'voorbeeld', 'voorbeelden')]
  if (item.groups) parts.push(`${item.groups.items.length} ${item.groups.plural}`)
  if (declaration) parts.push(count(fieldsOf(declaration).length, 'eigenschap', 'eigenschappen'))
  return parts.join(' · ')
}

/** A picture of a specimen: drawn live, so it has the page's theme and mode, but not to be used. */
function previewOf(specimen, className) {
  const frame = element('div', className)
  frame.inert = true
  frame.append(renderSpecimen({ ...specimen, label: undefined }).stage)
  return frame
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

/* The overview ------------------------------------------------------------------------- */

/** A category's elements as cards: its preview, its name, what it is and what it holds. */
export function renderOverview(host, items, { declarations, addressOf, go }) {
  const grid = element('div', 'guide__cards')
  for (const item of items) {
    const preview = allSpecimens(item).find((entry) => entry.preview)
    grid.append(
      linkCard('guide__card', addressOf(item), go, (card, link) => {
        if (preview) card.append(previewOf(preview, 'guide__card-preview'))
        const body = element('div', 'guide__card-body')
        const title = element('h3', 'guide__card-title')
        link.append(element('code', '', item.tag ? nameOf(item) : item.title))
        title.append(link)
        body.append(title)
        if (item.tag) body.append(element('p', 'guide__card-text', item.title))
        body.append(element('p', 'guide__meta', summaryOf(item, declarations.get(item.tag))))
        card.append(body)
      }),
    )
  }
  host.append(grid)
}

/* A specimen as a card ---------------------------------------------------------------- */

const CODE_KINDS = [
  ['html', 'HTML', 'html'],
  ['js', 'JavaScript', 'js'],
  ['server', 'Server-HTML', 'html'],
]

/**
 * The bar under a specimen: the ways to write it as tabs, and the code of the chosen one. A tab
 * opens the code; the button beside it closes it. The code is read from the stage when shown,
 * so it is what the specimen drew.
 */
function codeBar(figure, html, open) {
  const kinds = CODE_KINDS.filter(([key]) => codeOf(figure.stage, html)[key])
  const bar = element('div', 'guide__codebar')
  if (!kinds.length) return bar
  const tabs = document.createElement('lintje-tabs')
  tabs.label = 'Code van dit voorbeeld'
  tabs.tabs = kinds.map(([value, label]) => ({ value, label }))
  tabs.value = kinds[0][0]
  const copy = document.createElement('lintje-copy-button')
  copy.size = 'compact'
  const toggle = document.createElement('lintje-button')
  toggle.variant = 'tertiary'
  toggle.size = 'compact'

  const blocks = new Map()
  for (const [key, , language] of kinds) {
    const block = document.createElement('lintje-code')
    block.slot = key
    block.language = language
    blocks.set(key, block)
    tabs.append(block)
  }
  const show = (value) => {
    figure.codeOpen = value
    const code = codeOf(figure.stage, html)
    for (const [key, block] of blocks) {
      block.hidden = !value
      block.text = code[key]?.text ?? ''
    }
    copy.text = code[tabs.value]?.copy ?? ''
    copy.hidden = !value
    toggle.textContent = value ? 'Code verbergen' : 'Code tonen'
    toggle.expanded = value
  }
  tabs.addEventListener('lintje-tab-change', (event) => {
    event.stopPropagation()
    tabs.value = event.detail
    show(true)
  })
  toggle.addEventListener('click', () => show(!figure.codeOpen))
  figure.showCode = show
  const end = element('div', 'guide__row')
  end.append(copy, toggle)
  bar.append(tabs, end)
  show(open)
  return bar
}

/** Links in a specimen's caption to the fields it shows; `show` opens one in the reference. */
function captionFields(figure, fields, show) {
  if (!fields.length) return
  const list = element('span', 'guide__shows')
  list.append(element('span', 'guide__meta', 'Toont'))
  for (const field of fields) {
    const link = element('a', 'guide__shown')
    link.href = '#referentie'
    link.append(element('code', '', field))
    link.addEventListener('click', (event) => {
      event.preventDefault()
      show(field)
    })
    list.append(link)
  }
  figure.querySelector('.guide__caption').insertBefore(list, figure.querySelector('.guide__anchor'))
}

/** One specimen as a card: the caption bar, the stage, what the host heard, and the code bar. */
function specimenCard(entry, options, open) {
  const figure = renderSpecimen(entry, options)
  figure.html = entry.html
  const caption = figure.querySelector('.guide__caption')
  if (caption) {
    // A specimen that answers its reader shows what the host heard: it can be tried.
    if (figure.querySelector('.guide__log')) {
      const badge = document.createElement('lintje-badge')
      badge.textContent = 'Interactief'
      caption.append(badge)
    }
    const anchor = element('a', 'guide__anchor', '#')
    anchor.href = `#${figure.id}`
    anchor.setAttribute('aria-label', `Link naar ${entry.label}`)
    caption.append(anchor)
  }
  figure.append(codeBar(figure, entry.html, open))
  return figure
}

function specimenGrid(item) {
  return element(
    'div',
    item.columns ? `guide__specimens guide__specimens--max-${item.columns}` : 'guide__specimens',
  )
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

/** A section of the page, with its heading and the entry it gets in "Op deze pagina". */
function section(id, title, toc, items) {
  const node = element('section', 'guide__section')
  node.id = id
  const head = element('div', 'guide__section-head')
  head.append(heading(3, title))
  node.append(head)
  toc.push({ label: title, href: `#${id}`, items })
  return node
}

/** The kinds of an element that draws several, by the question they answer, each drawn small. */
function chooser(item, chosen, current, addressOf, go) {
  const groups = item.groups
  const box = element('div', 'guide__chooser')
  for (const [question, label] of Object.entries(groups.questions ?? { '': '' })) {
    const entries = groups.items.filter((entry) => !question || entry.question === question)
    if (!entries.length) continue
    const row = element('div', 'guide__choice')
    if (label) row.append(element('p', 'guide__question', label))
    const cards = element('div', 'guide__kinds')
    for (const entry of entries) {
      const href = addressOf(item, entry.value, current?.value)
      cards.append(
        linkCard(entry === chosen ? 'guide__kind is-chosen' : 'guide__kind', href, go, (card, link) => {
          const first = entry.specimens[0]
          if (first) card.append(scaledPreview(first))
          link.textContent = entry.label
          if (entry === chosen) link.setAttribute('aria-current', 'true')
          const name = element('span', 'guide__kind-name')
          name.append(link)
          card.append(name, element('code', 'guide__key', entry.value))
        }),
      )
    }
    row.append(cards)
    box.append(row)
  }
  return box
}

// The width a small chart is drawn at before it is scaled to its card: wide enough for its axes.
const DRAWN_WIDTH = 640

/** A specimen drawn at a readable width and scaled down to the width of its card. */
function scaledPreview(specimen) {
  const frame = previewOf(specimen, 'guide__mini')
  const inner = frame.firstElementChild
  inner.style.width = `${DRAWN_WIDTH}px`
  new ResizeObserver(([entry]) => {
    frame.style.setProperty('--guide-scale', String(entry.contentRect.width / DRAWN_WIDTH))
  }).observe(frame)
  return frame
}

/**
 * An element's page. `group` and `state` are what the URL chose; `addressOf(item, group, state)`
 * writes an address and `go(address)` follows it.
 */
export function renderElementPage(host, item, context) {
  const { declarations, types, siblings, group, state, addressOf, go, categoryLabel } = context
  const declaration = declarations.get(item.tag)
  const groups = item.groups
  const chosen = groups && (groups.items.find((entry) => entry.value === group) ?? groups.items[0])
  const states = item.states ?? []
  const current = states.find((entry) => entry.value === state) ?? states[0]
  const toc = []

  const page = element('div', 'guide__page')
  const main = element('div', 'guide__main')
  const nav = document.createElement('lintje-sub-nav')
  nav.className = 'guide__toc'
  nav.expanded = true
  nav.label = 'Op deze pagina'
  page.append(main, nav)

  // What it is: the source comment, and its facts in a row.
  if (declaration?.description) {
    const intro = document.createElement('lintje-prose')
    intro.className = 'guide__intro'
    intro.html = proseOf(declaration.description)
    main.append(intro)
  }
  const facts = document.createElement('lintje-description-list')
  facts.layout = 'grid'
  facts.columns = 4
  const factItems = [
    {
      label: 'Soort',
      value: !declaration ? 'Sectie' : declaration.module?.includes('/primitives/') ? 'Primitive' : 'Component',
    },
    { label: 'Categorie', value: categoryLabel, href: context.categoryAddress },
    { label: 'API', value: declaration ? apiOf(declaration) : null },
    { label: 'Toegepast in', value: item.tag ? 'wordt gezocht…' : null },
  ]
  facts.items = factItems
  main.append(facts)

  // The specimens; with groups, the chooser first and then the chosen one's.
  const figures = []
  const batches = []
  const draw = (entries, grid, options) => {
    const batch = entries.map((entry, i) => {
      const figure = specimenCard(entry, options, figures.length === 0 && i === 0)
      grid.append(figure)
      return figure
    })
    figures.push(...batch)
    batches.push(batch)
  }
  const tocSpecimens = (entries) =>
    entries.filter((entry) => entry.label).map((entry) => ({ label: entry.label, href: '' }))
  const codeSwitch = () => {
    const switcher = document.createElement('lintje-segmented')
    switcher.label = 'Code'
    switcher.options = [
      { value: 'first', label: 'Bij het eerste' },
      { value: 'all', label: 'Bij elk voorbeeld' },
    ]
    switcher.value = 'first'
    switcher.addEventListener('lintje-change', (event) => {
      event.stopPropagation()
      figures.forEach((figure, i) => figure.showCode?.(event.detail === 'all' || i === 0))
    })
    return switcher
  }

  let examples
  if (groups) {
    const choose = section('kiezen', groups.question ?? `Welke ${groups.label.toLowerCase()}?`, toc)
    choose.append(chooser(item, chosen, current, addressOf, go))
    main.append(choose)

    examples = section('voorbeelden', chosen.label, toc, tocSpecimens(chosen.specimens))
    examples.querySelector('.guide__section-head').append(element('code', 'guide__key', `${groups.key}: '${chosen.value}'`))
    if (chosen.use || chosen.avoid) {
      const advice = document.createElement('lintje-prose')
      advice.className = 'guide__intro'
      advice.html = [
        chosen.use && `<p><strong>Neem hem voor</strong> ${escape(chosen.use)}</p>`,
        chosen.avoid && `<p><strong>Niet voor</strong> ${escape(chosen.avoid)}</p>`,
      ]
        .filter(Boolean)
        .join('')
      examples.append(advice)
    }
    const controls = element('div', 'guide__row')
    if (states.length > 1) {
      const switcher = document.createElement('lintje-segmented')
      switcher.label = 'Staat'
      switcher.options = states.map(({ value, label }) => ({ value, label }))
      switcher.value = current.value
      switcher.addEventListener('lintje-change', (event) => {
        event.stopPropagation()
        go(addressOf(item, chosen.value, event.detail), { keepScroll: true })
      })
      controls.append(switcher)
    }
    controls.append(codeSwitch())
    examples.append(controls)
    const grid = specimenGrid(item)
    draw(chosen.specimens, grid, { item, state: current })
    examples.append(grid)
    main.append(examples)
    if (item.specimens.length) {
      const shared = section('elke-soort', groups.shared ?? 'Voor elk', toc, tocSpecimens(item.specimens))
      const sharedGrid = specimenGrid(item)
      draw(item.specimens, sharedGrid)
      shared.append(sharedGrid)
      main.append(shared)
    }
  } else {
    examples = section('voorbeelden', 'Voorbeelden', toc, tocSpecimens(item.specimens))
    examples.querySelector('.guide__section-head').append(codeSwitch())
    const grid = specimenGrid(item)
    draw(item.specimens, grid)
    examples.append(grid)
    main.append(examples)
  }
  // The specimens' entries in "Op deze pagina" point at their cards.
  for (const entry of toc)
    for (const sub of entry.items ?? [])
      sub.href = `#${figures.find((figure) => figure.querySelector('.guide__label')?.textContent === sub.label)?.id}`

  // Which specimen shows which field; what every specimen beside it sets tells nothing apart.
  const shown = new Map(figures.map((figure) => [figure, fieldsShown(figure, item, declaration)]))
  for (const batch of batches) {
    if (batch.length < 2) continue
    const sets = batch.map((figure) => shown.get(figure))
    const everywhere = [...sets[0]].filter((key) => sets.every((set) => set.has(key)))
    for (const set of sets) for (const key of everywhere) set.delete(key)
  }
  const shownBy = new Map()
  for (const figure of figures) {
    const label = figure.querySelector('.guide__label')?.textContent
    if (label) for (const key of shown.get(figure)) shownBy.set(key, [...(shownBy.get(key) ?? []), label])
  }

  // The chosen kind's own fields stand with its specimens; the reference leaves them out.
  const union = declaration && groupUnion(item, declaration, types)
  let own
  if (union) {
    own = variantReference(types[union.typeName], chosen.value, union.typeName, shownBy, union.prefix)
    if (own) examples.append(heading(4, `Velden van ${chosen.label}`), own)
  }

  const reference = section('referentie', 'Referentie', toc)
  let tables
  if (declaration) {
    reference
      .querySelector('.guide__section-head')
      .append(element('span', 'guide__meta', `Gelezen uit ${declaration.module}`))
    tables = renderReference(declaration, types, {
      shownBy,
      skip: new Set(union ? [union.typeName] : []),
    })
    reference.append(tables)
  } else {
    const missing = document.createElement('lintje-prose')
    missing.tone = 'muted'
    missing.text = item.tag
      ? 'Geen referentie: draai `npm run build:elements`.'
      : 'Dit is geen losse tag; er is geen referentie.'
    reference.append(missing)
  }
  main.append(reference)

  const show = (field) => {
    if (own && field.startsWith(union.prefix)) {
      own.only(field.slice(union.prefix.length))
      own.scrollIntoView({ block: 'start' })
      return
    }
    ;(tables?.show(field) ?? reference).scrollIntoView({ block: 'start' })
  }
  for (const figure of figures) captionFields(figure, [...shown.get(figure)], show)

  if (item.tag) {
    main.append(
      usageSection(item.tag, context.appAddress, toc, (text) => {
        factItems[3] = { ...factItems[3], value: text, href: '#toegepast' }
        facts.items = [...factItems]
      }),
    )
    main.append(loadSection(item, context.category, toc))
  }

  nav.groups = [
    { label: 'Op deze pagina', items: toc },
    {
      label: `Ook in ${categoryLabel}`,
      items: siblings
        .filter((sibling) => sibling !== item)
        .map((sibling) => ({ label: nameOf(sibling), href: addressOf(sibling) })),
    },
  ]
  follow(nav, toc)
  host.append(page)
}

/* "Op deze pagina" follows the reading ------------------------------------------------- */

let following
/** Marks the section in view, as `docs/guides/page-contents.md` does it. */
function follow(nav, toc) {
  const all = (items) => items.flatMap((item) => [item, ...all(item.items ?? [])])
  const mark = (items, href) =>
    items.map((item) => ({
      ...item,
      active: item.href === href,
      ...(item.items ? { items: mark(item.items, href) } : {}),
    }))
  let shown
  const update = () => {
    if (!nav.isConnected) return
    const root = document.documentElement
    const end = scrollY + innerHeight >= root.scrollHeight - 1
    const line = end ? innerHeight : (parseFloat(getComputedStyle(root).scrollPaddingTop) || 0) + 1
    let href = null
    for (const item of all(toc)) {
      const target = document.getElementById(item.href.slice(1))
      if (target && target.getBoundingClientRect().top <= line) href = item.href
    }
    if (href === shown) return
    shown = href
    nav.groups = [{ ...nav.groups[0], items: mark(toc, href) }, ...nav.groups.slice(1)]
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

/** Where the tag stands in the example applications, filled in once their files are read. */
function usageSection(tag, appAddress, toc, onCount) {
  const node = section('toegepast', 'Toegepast in', toc)
  const note = document.createElement('lintje-prose')
  note.tone = 'muted'
  note.text = 'De voorbeeldapplicaties worden doorzocht…'
  node.append(note)
  usageOf(tag).then((usage) => {
    const total = usage.reduce((sum, entry) => sum + entry.places.length, 0)
    const text = total
      ? `${count(total, 'plek', 'plekken')} in ${count(usage.length, 'applicatie', 'applicaties')}`
      : 'nog nergens'
    onCount(text)
    note.text = total ? `${text}, gevonden in hun bestanden.` : 'Nog in geen enkele voorbeeldapplicatie.'
    if (!total) return

    const grid = document.createElement('lintje-grid')
    const tiles = usage.map(({ app, places }) => {
      const tile = document.createElement('lintje-tile')
      tile.span = 12
      tile.heading = app.label
      tile.subtitle = count(places.length, 'plek', 'plekken')
      tile.dataset.app = app.href
      const open = document.createElement('lintje-button')
      open.slot = 'actions'
      open.variant = 'link'
      open.size = 'compact'
      open.href = appAddress(app)
      open.textContent = `Openen in ${app.label}`
      const code = document.createElement('lintje-code')
      code.language = 'html'
      code.label = `${tag} in ${app.label}`
      const lines = places
        .slice(0, PLACES_SHOWN)
        .map((place) => `${place.path}:${place.line}  ${place.text}`)
      if (places.length > PLACES_SHOWN) lines.push(`… en nog ${places.length - PLACES_SHOWN}`)
      code.text = lines.join('\n')
      tile.append(open, code)
      return tile
    })
    if (usage.length > 1) {
      const filter = document.createElement('lintje-segmented')
      filter.label = 'Applicatie'
      filter.options = [
        { value: '', label: `Alle ${total}` },
        ...usage.map(({ app, places }) => ({ value: app.href, label: `${app.label} ${places.length}` })),
      ]
      filter.value = ''
      filter.addEventListener('lintje-change', (event) => {
        event.stopPropagation()
        for (const tile of tiles) tile.hidden = Boolean(event.detail) && tile.dataset.app !== event.detail
      })
      node.append(filter)
    }
    grid.append(...tiles)
    node.append(grid)
  })
  return node
}

/** How a page loads the tag: by itself, with its category, or the whole bundle. */
function loadSection(item, category, toc) {
  const node = section('laden', 'Laden', toc)
  const ways = [
    ['tag', 'Alleen deze tag', `import 'lintje/tag/${nameOf(item)}'`],
    ['category', 'De categorie', `import 'lintje/${category}'`],
    ['bundle', 'De hele bundel', `import 'lintje'`],
  ]
  const tabs = document.createElement('lintje-tabs')
  tabs.label = 'Hoe je hem laadt'
  tabs.tabs = ways.map(([value, label]) => ({ value, label }))
  tabs.value = 'tag'
  tabs.addEventListener('lintje-tab-change', (event) => {
    event.stopPropagation()
    tabs.value = event.detail
  })
  for (const [value, , text] of ways) {
    const panel = element('div', 'guide__row guide__row--code')
    panel.slot = value
    const code = document.createElement('lintje-code')
    code.language = 'js'
    code.text = text
    const copy = document.createElement('lintje-copy-button')
    copy.text = text
    copy.size = 'compact'
    panel.append(code, copy)
    tabs.append(panel)
  }
  node.append(tabs)
  return node
}
