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

const escape = (text) =>
  text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])

/** A source comment's paragraphs as markup, `code` marked. The tag's own name at the start goes:
 *  the page's title says it. */
function paragraphsOf(description) {
  return escape(
    description.replace(/^`<lintje-[a-z-]+>`(?: \/ `<lintje-[a-z-]+>`)* — (.)/, (_, first) =>
      first.toUpperCase(),
    ),
  )
    .split(/\n\s*\n/)
    .map((part) => `<p>${part.replace(/`([^`]+)`/g, '<code>$1</code>')}</p>`)
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
function summaryOf(item, declaration, apps) {
  const parts = [count(allSpecimens(item).length, 'voorbeeld', 'voorbeelden')]
  if (item.groups) parts.push(`${item.groups.items.length} ${item.groups.plural}`)
  if (declaration) parts.push(count(fieldsOf(declaration).length, 'eigenschap', 'eigenschappen'))
  if (apps) parts.push(`in ${count(apps, 'app', 'apps')}`)
  return parts.join(' · ')
}

/** A specimen's short name: its label up to the colon. "Bezig: de breedte blijft" → "Bezig". */
const shortOf = (label) => label.split(/:|, |\s·\s/)[0]

/** A picture of a specimen: drawn live, so it has the page's theme and mode, but not to be used. */
function previewOf(specimen, className) {
  const frame = element('div', className)
  frame.inert = true
  frame.append(renderSpecimen({ ...specimen, label: undefined }).stage)
  return frame
}

// The width a wide specimen (a row of figures, a tile, a table) may take before it is made small:
// a page's content column, so it lays out as on a page.
const THUMB_WIDTH = 960

/**
 * A specimen as a thumbnail: drawn at its own size and scaled down as a whole until it fits its
 * box, centred. It never grows, and nothing is cut off. A wide one that has no width of its own
 * (a chart measures its room) is drawn at a tile's width.
 */
function thumbnailOf(specimen) {
  const frame = previewOf(specimen, 'guide__card-preview')
  const stage = frame.firstElementChild
  if (specimen.wide) stage.style.maxWidth = `${THUMB_WIDTH}px`
  const fit = () => {
    if (specimen.wide && !stage.style.width && stage.offsetWidth < THUMB_WIDTH / 2)
      stage.style.width = `${THUMB_WIDTH}px`
    const scale = Math.min(
      1,
      frame.clientWidth / Math.max(stage.offsetWidth, 1),
      frame.clientHeight / Math.max(stage.offsetHeight, 1),
    )
    stage.style.setProperty('--guide-scale', String(scale))
  }
  const observer = new ResizeObserver(fit)
  observer.observe(frame)
  observer.observe(stage)
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

/** A row of facts: label and value side by side, a value with `href` a link. */
function factsRow(items, go) {
  const list = element('dl', 'guide__facts')
  for (const { label, value, href } of items) {
    const pair = element('div', 'guide__fact')
    pair.append(element('dt', '', label))
    const dd = element('dd')
    if (href) {
      const link = element('a', '', value)
      link.href = href
      if (go)
        link.addEventListener('click', (event) => {
          event.preventDefault()
          go(href)
        })
      dd.append(link)
    } else dd.textContent = value
    pair.append(dd)
    list.append(pair)
  }
  return list
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
    const preview = allSpecimens(item).find((entry) => entry.preview)
    grid.append(
      linkCard('guide__card', addressOf(item), go, (card, link) => {
        if (preview) card.append(thumbnailOf(preview))
        // Without a specimen to show, the box stays empty: the name stands right under it.
        else card.append(element('div', 'guide__card-preview'))
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
 * A code box: the ways to write something as tabs on a bar, with Kopiëren at its end, and the
 * code of the chosen way under it. `read()` gives the code at the moment it is shown, so a
 * specimen's is what it drew. `closable`: shut, the bar says "Code dicht" and a tab opens it.
 */
function codeBox(kinds, read, { open = true, closable = false, label = 'Code' } = {}) {
  const box = element('div', 'guide__codebox')
  const tabs = document.createElement('lintje-tabs')
  tabs.label = label
  tabs.tabs = kinds.map(([value, title]) => ({ value, label: title }))
  tabs.value = kinds[0][0]
  const copy = document.createElement('lintje-copy-button')
  copy.size = 'compact'
  copy.variant = 'flat'
  const closed = element('span', 'guide__meta', 'Code dicht')
  const blocks = new Map()
  for (const [key, , language] of kinds) {
    const block = document.createElement('lintje-code')
    block.slot = key
    block.language = language
    block.className = 'guide__codeblock'
    blocks.set(key, block)
    tabs.append(block)
  }
  const show = (value) => {
    box.open = value
    box.classList.toggle('is-open', value)
    const code = read()
    for (const [key, block] of blocks) {
      block.hidden = !value
      block.text = code[key]?.text ?? ''
    }
    copy.text = code[tabs.value]?.copy ?? ''
    copy.hidden = !value
    closed.hidden = value
  }
  tabs.addEventListener('lintje-tab-change', (event) => {
    event.stopPropagation()
    tabs.value = event.detail
    show(true)
  })
  // Shut, the chosen tab opens the code too: a press on the row is a wish to read it.
  if (closable) tabs.addEventListener('click', () => box.open || show(true))
  box.show = show
  const end = element('div', 'guide__codebox-end')
  end.append(copy, closed)
  box.append(tabs, end)
  show(open || !closable)
  return box
}

/** The code box under a specimen, with the ways it can be written. */
function specimenCode(figure, html, open) {
  const read = () => codeOf(figure.stage, html)
  const kinds = CODE_KINDS.filter(([key]) => read()[key])
  if (!kinds.length) return null
  return codeBox(kinds, read, { open, closable: true, label: 'Code van dit voorbeeld' })
}

/* A specimen as a card ---------------------------------------------------------------- */

/** Links in a specimen's caption to the fields it shows; `show` opens one in the reference. */
function captionFields(figure, fields, show) {
  if (!fields.length) return
  const list = element('span', 'guide__shows')
  list.append(element('span', 'guide__meta', 'Toont'))
  for (const field of fields) {
    const link = element('a', 'guide__shown', field)
    link.href = '#referentie'
    link.addEventListener('click', (event) => {
      event.preventDefault()
      show(field)
    })
    list.append(link)
  }
  figure.querySelector('.guide__caption').insertBefore(list, figure.querySelector('.guide__anchor'))
}

/** One specimen as a card: the caption bar, the stage, what the host heard, and its code. */
function specimenCard(entry, options, { open = false, code = true } = {}) {
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
  if (code) {
    const box = specimenCode(figure, entry.html, open)
    if (box) {
      figure.append(box)
      figure.showCode = box.show
    }
  }
  return figure
}

function specimenGrid(item, wide = true) {
  const name = item.columns
    ? `guide__specimens guide__specimens--max-${item.columns}`
    : 'guide__specimens'
  return element('div', wide ? name : `${name} guide__specimens--narrow`)
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
function section(id, title, toc, { items, tab } = {}) {
  const node = element('section', 'guide__section')
  node.id = id
  const head = element('div', 'guide__section-head')
  head.append(heading(3, title))
  node.append(head)
  toc.push({ label: title, href: `#${id}`, items, tab: tab ?? title })
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
          const first = entry.specimens[0]
          if (first) card.append(miniOf(first))
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
const DRAWN_WIDTH = 420

/**
 * A kind's first specimen as a small picture: without its tile's title and footnote, drawn at a
 * readable width and scaled down to its card.
 */
function miniOf(specimen) {
  const frame = previewOf(
    {
      ...specimen,
      setup(stage) {
        specimen.setup?.(stage)
        for (const node of stage.querySelectorAll('lintje-chart'))
          node.data = {
            ...node.data,
            title: undefined,
            subtitle: undefined,
            footnote: undefined,
            expandable: false,
            download: false,
            chart: { ...node.data.chart, small: true },
          }
      },
    },
    'guide__mini',
  )
  const inner = frame.firstElementChild
  inner.style.width = `${DRAWN_WIDTH}px`
  new ResizeObserver(([entry]) => {
    frame.style.setProperty('--guide-scale', String(entry.contentRect.width / DRAWN_WIDTH))
  }).observe(frame)
  return frame
}

/**
 * An element's page. `group` is what the URL chose; `addressOf(item, group)` writes an address
 * and `go(address)` follows it.
 */
export function renderElementPage(host, item, context) {
  const { declarations, types, siblings, group, addressOf, go, categoryLabel } = context
  const declaration = declarations.get(item.tag)
  const groups = item.groups
  const chosen = groups && (groups.items.find((entry) => entry.value === group) ?? groups.items[0])
  const toc = []

  // What it is: the source comment's first paragraph, the rest a step away; its facts in a row;
  // the sections as tabs.
  const head = element('div', 'guide__head')
  if (declaration?.description) {
    const [first, ...rest] = paragraphsOf(declaration.description)
    const intro = document.createElement('lintje-prose')
    intro.className = 'guide__intro'
    intro.html = first
    head.append(intro)
    if (rest.length) {
      const more = document.createElement('lintje-expander')
      more.flat = true
      more.heading = 'Meer over deze tag'
      const prose = document.createElement('lintje-prose')
      prose.html = rest.join('')
      more.append(prose)
      head.append(more)
    }
  }
  const factItems = [
    {
      label: 'Soort',
      value: !declaration
        ? 'Sectie'
        : declaration.module?.includes('/primitives/')
          ? 'Primitive'
          : 'Component',
    },
    { label: 'Categorie', value: categoryLabel, href: context.categoryAddress },
    ...(declaration ? [{ label: 'API', value: apiOf(declaration) }] : []),
  ]
  const facts = factsRow(factItems, go)
  head.append(facts)
  const sectionTabs = document.createElement('lintje-tabs')
  sectionTabs.label = 'Op deze pagina'
  head.append(sectionTabs)

  const page = element('div', 'guide__page')
  const main = element('div', 'guide__main')
  const nav = document.createElement('lintje-sub-nav')
  nav.className = 'guide__toc'
  nav.expanded = true
  nav.label = 'Op deze pagina'
  page.append(main, nav)

  // The specimens; with groups, the chooser first and then the chosen one's.
  const figures = []
  const batches = []
  const draw = (entries, grid, options, card = {}) => {
    const batch = entries.map((entry, i) => {
      const figure = specimenCard(entry, options, {
        ...card,
        open: card.open ?? (figures.length === 0 && i === 0),
      })
      grid.append(figure)
      return figure
    })
    figures.push(...batch)
    batches.push(batch)
    return batch
  }
  const tocSpecimens = (entries) =>
    entries.filter((entry) => entry.label).map((entry) => ({ label: shortOf(entry.label), href: '' }))
  const codeSwitch = () => {
    const switcher = document.createElement('lintje-segmented')
    switcher.label = 'Code bij de voorbeelden'
    switcher.hideLabel = true
    switcher.options = [
      { value: 'none', label: 'Code verbergen' },
      { value: 'all', label: 'Code bij elk voorbeeld' },
    ]
    switcher.value = ''
    switcher.addEventListener('lintje-change', (event) => {
      event.stopPropagation()
      switcher.value = event.detail
      for (const figure of figures) figure.showCode?.(event.detail === 'all')
    })
    return switcher
  }

  let examples
  let variantCode
  if (groups) {
    const choose = section('kiezen', groups.question ?? `Welke ${groups.label.toLowerCase()}?`, toc)
    choose.append(
      element(
        'p',
        'guide__meta',
        `Begin bij de vraag die de lezer stelt. Elke ${groups.label.toLowerCase()} is een waarde van ${groups.key}.`,
      ),
      chooser(item, chosen, addressOf, go),
    )
    main.append(choose)

    // The chosen kind in its frame: what it is for, its specimens, the code of one, its fields.
    examples = section('voorbeelden', chosen.label, toc, {
      items: tocSpecimens(chosen.specimens),
      tab: `${groups.plural[0].toUpperCase()}${groups.plural.slice(1)}`,
    })
    examples.classList.add('guide__kind-frame')
    examples
      .querySelector('.guide__section-head')
      .append(
        element('code', 'guide__key', `${groups.key}: '${chosen.value}'`),
        element('span', 'guide__meta guide__push', count(chosen.specimens.length, 'voorbeeld', 'voorbeelden')),
      )
    if (chosen.use || chosen.avoid) {
      const advice = element('div', 'guide__advice')
      for (const [title, text] of [
        ['Neem hem voor', chosen.use],
        ['Niet voor', chosen.avoid],
      ]) {
        if (!text) continue
        const prose = document.createElement('lintje-prose')
        prose.html = `<p><strong>${title}</strong> ${escape(text)}</p>`
        advice.append(prose)
      }
      examples.append(advice)
    }
    const grid = specimenGrid(item, false)
    const batch = draw(chosen.specimens, grid, undefined, { code: false })
    examples.append(grid)
    // One code box for the chosen kind, of the specimen the reader marks with "Code".
    let marked = batch[0]
    const read = () => codeOf(marked.stage, marked.html)
    const kinds = CODE_KINDS.filter(([key]) => read()[key])
    const title = element('p', 'guide__meta')
    const mark = (figure) => {
      marked = figure
      for (const other of batch) other.classList.toggle('is-marked', other === figure)
      title.innerHTML = `Code van <strong>${escape(figure.querySelector('.guide__label')?.textContent ?? '')}</strong>`
      variantCode?.show(true)
    }
    for (const figure of batch) {
      const pick = document.createElement('lintje-button')
      pick.variant = 'link'
      pick.size = 'compact'
      pick.textContent = 'Code'
      pick.accessibleName = `Code van ${figure.querySelector('.guide__label')?.textContent}`
      pick.addEventListener('click', () => mark(figure))
      figure.querySelector('.guide__caption')?.insertBefore(pick, figure.querySelector('.guide__anchor'))
    }
    if (kinds.length) {
      variantCode = codeBox(kinds, read, { label: 'Code van het gekozen voorbeeld' })
      examples.append(title, variantCode)
    }
    mark(marked)
    main.append(examples)

    // What every kind shares: the states, drawn for the chosen kind, and the rest once.
    const shared = section('elke-soort', groups.shared ?? 'Voor elk', toc)
    shared.append(element('p', 'guide__meta', 'Eén keer getoond; het werkt bij elke soort hetzelfde.'))
    const states = (item.states ?? []).filter((state) => state.data)
    if (states.length && chosen.specimens[0]) {
      shared.append(heading(4, 'Staten'))
      const row = element('div', 'guide__specimens guide__specimens--states')
      for (const state of states) {
        const figure = specimenCard(
          { ...chosen.specimens[0], label: `${state.label} · ${state.data.state}` },
          { item, state },
          { code: false },
        )
        row.append(figure)
      }
      shared.append(row)
    }
    if (item.specimens.length) {
      const sharedGrid = specimenGrid(item, false)
      draw(item.specimens, sharedGrid, undefined, { open: false })
      shared.append(sharedGrid)
    }
    main.append(shared)
  } else {
    examples = section('voorbeelden', 'Voorbeelden', toc, { items: tocSpecimens(item.specimens) })
    examples.querySelector('.guide__section-head').append(codeSwitch())
    const grid = specimenGrid(item)
    draw(item.specimens, grid)
    examples.append(grid)
    main.append(examples)
  }
  // The specimens' entries in "Op deze pagina" point at their cards.
  for (const entry of toc)
    for (const [i, sub] of (entry.items ?? []).entries()) {
      const pool = entry.href === '#voorbeelden' ? batches[0] : batches.at(-1)
      sub.href = `#${pool?.[i]?.id}`
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
    const label = figure.querySelector('.guide__label')?.textContent
    if (label)
      for (const key of shown.get(figure))
        shownBy.set(key, [...(shownBy.get(key) ?? []), shortOf(label)])
  }

  // The chosen kind's own fields stand in its frame; the reference leaves them out.
  const union = declaration && groupUnion(item, declaration, types)
  let own
  if (union) {
    own = variantReference(types[union.typeName], chosen.value, union.typeName, shownBy, union.prefix)
    if (own) {
      const tile = document.createElement('lintje-tile')
      tile.heading = `Velden van ${groups.key}: '${chosen.value}'`
      own.bare = true
      own.plain = false
      tile.append(own)
      examples.append(tile)
    }
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
      usageSection(item.tag, context.appAddress, toc, (text, total) => {
        facts.append(factsRow([{ label: 'Toegepast in', value: text, href: '#toegepast' }]).firstChild)
        const tab = sectionTabs.tabs.find((entry) => entry.value === '#toegepast')
        if (tab && total) sectionTabs.tabs = sectionTabs.tabs.map((entry) => (entry === tab ? { ...entry, count: total } : entry))
      }),
    )
    main.append(loadSection(item, context.category, toc))
  }

  // The sections as tabs under the facts: links to their place, the one in view chosen.
  sectionTabs.tabs = toc.map((entry) => ({
    value: entry.href,
    label: entry.tab,
    href: entry.href,
    count: entry.href === '#voorbeelden' && !groups ? item.specimens.length : entry.href === '#voorbeelden' ? groups.items.length : undefined,
  }))
  sectionTabs.value = toc[0]?.href

  nav.groups = [
    { label: 'Op deze pagina', items: toc.map(({ label, href, items }) => ({ label, href, items })) },
    {
      label: 'Ook in deze categorie',
      items: siblings
        .filter((sibling) => sibling !== item)
        .map((sibling) => ({ label: nameOf(sibling), href: addressOf(sibling) })),
    },
  ]
  follow(nav, sectionTabs, toc)
  host.append(head, page)
}

/* "Op deze pagina" follows the reading ------------------------------------------------- */

let following
/** Marks the section in view in the list and the tabs, as `docs/guides/page-contents.md` does. */
function follow(nav, tabs, toc) {
  const all = (items) => items.flatMap((item) => [item, ...all(item.items ?? [])])
  const mark = (items, href) =>
    items.map((item) => ({
      label: item.label,
      href: item.href,
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
    let inView = null
    for (const item of toc) {
      const target = document.getElementById(item.href.slice(1))
      if (target && target.getBoundingClientRect().top <= line) inView = item.href
    }
    for (const item of all(toc)) {
      const target = document.getElementById(item.href.slice(1))
      if (target && target.getBoundingClientRect().top <= line) href = item.href
    }
    if (href === shown) return
    shown = href
    nav.groups = [{ ...nav.groups[0], items: mark(toc, href) }, ...nav.groups.slice(1)]
    tabs.value = inView ?? toc[0]?.href
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
  const node = section('toegepast', 'Toegepast in de applicaties', toc, { tab: 'Toegepast in' })
  node
    .querySelector('.guide__section-head')
    .append(element('span', 'guide__meta', 'Gevonden in de bestanden van examples/'))
  const note = document.createElement('lintje-prose')
  note.tone = 'muted'
  note.text = 'De voorbeeldapplicaties worden doorzocht…'
  node.append(note)
  usageOf(tag).then((usage) => {
    const total = usage.reduce((sum, entry) => sum + entry.places.length, 0)
    const text = total
      ? `${count(total, 'plek', 'plekken')} in ${count(usage.length, 'applicatie', 'applicaties')}`
      : 'nog nergens'
    onCount(text, total)
    if (!total) {
      note.text = 'Nog in geen enkele voorbeeldapplicatie.'
      return
    }
    note.remove()
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
      filter.hideLabel = true
      filter.options = [
        { value: '', label: `Alle ${total}` },
        ...usage.map(({ app, places }) => ({
          value: app.href,
          label: `${app.label} ${places.length}`,
        })),
      ]
      filter.value = ''
      filter.addEventListener('lintje-change', (event) => {
        event.stopPropagation()
        filter.value = event.detail
        for (const tile of tiles)
          tile.hidden = Boolean(event.detail) && tile.dataset.app !== event.detail
      })
      node.append(filter)
    }
    const grid = document.createElement('lintje-grid')
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
  const code = Object.fromEntries(ways.map(([key, , text]) => [key, { text, copy: text }]))
  node.append(
    codeBox(
      ways.map(([key, label]) => [key, label, 'js']),
      () => code,
      { label: 'Hoe je hem laadt' },
    ),
  )
  return node
}

