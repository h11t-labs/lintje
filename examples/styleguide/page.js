/**
 * The style guide's two pages: a category's overview, one tile per element, and an element's
 * own page — what it is, its specimens with their code, its reference and how to load it.
 */
import { codeOf, richProperties } from './code.js'
import { fieldsOf, interfaceFields, renderReference, typeNames, variantReference } from './reference.js'
import { allSpecimens, nameOf, renderSpecimen } from './shared.js'
import { usageOf } from './usage.js'

function element(name, className, text) {
  const node = document.createElement(name)
  if (className) node.className = className
  if (text) node.textContent = text
  return node
}

const heading = (level, text, id) => {
  const node = element(`h${level}`, level === 3 ? 'guide__heading' : 'guide__subheading', text)
  if (id) node.id = id
  return node
}

/** A source comment as markup: escaped, its paragraphs kept and `code` marked. The tag's own
 *  name at the start goes: the page's title says it. */
function proseOf(description) {
  const escaped = description
    .replace(/^`<lintje-[a-z-]+>`(?: \/ `<lintje-[a-z-]+>`)* — (.)/, (_, first) => first.toUpperCase())
    .replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])
  return escaped
    .split(/\n\s*\n/)
    .map((part) => `<p>${part.replace(/`([^`]+)`/g, '<code>$1</code>')}</p>`)
    .join('')
}

const count = (n, one, many) => `${n} ${n === 1 ? one : many}`

/** What an element's tile and page say about it in one line. */
function summaryOf(item, declaration) {
  const parts = [count(allSpecimens(item).length, 'voorbeeld', 'voorbeelden')]
  if (item.groups) parts.push(`${item.groups.items.length} ${item.groups.plural}`)
  if (declaration) {
    parts.push(count(fieldsOf(declaration).length, 'eigenschap', 'eigenschappen'))
    parts.push(count(declaration.events.length, 'event', 'events'))
  }
  return parts.join(' · ')
}

/* The overview ------------------------------------------------------------------------- */

/** A category's elements as tiles: each with its preview specimen, a line and the way in. */
export function renderOverview(host, items, { declarations, addressOf }) {
  const grid = document.createElement('lintje-grid')
  for (const item of items) {
    const tile = document.createElement('lintje-tile')
    tile.span = 6
    tile.heading = item.tag ?? item.title
    if (item.tag) tile.subtitle = item.title
    const body = element('div', 'guide__stack')
    const preview = allSpecimens(item).find((entry) => entry.preview)
    if (preview) {
      const frame = element('div', 'guide__preview')
      // A picture of the element, not a second copy to use: out of the tab order and unheard.
      frame.inert = true
      frame.append(renderSpecimen({ ...preview, label: undefined }).stage)
      body.append(frame)
    }
    const row = element('div', 'guide__row guide__row--apart')
    row.append(element('span', 'guide__meta', summaryOf(item, declarations.get(item.tag))))
    const open = document.createElement('lintje-button')
    open.variant = 'secondary'
    open.size = 'compact'
    open.href = addressOf(item)
    open.textContent = 'Bekijken'
    open.accessibleName = `Bekijken: ${nameOf(item)}`
    row.append(open)
    body.append(row)
    tile.append(body)
    grid.append(tile)
  }
  host.append(grid)
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
        else for (const deeper of Object.keys(inner)) if (deeper !== item.groups.key) shown.add(`${key}.${deeper}`)
      }
    }
  return shown
}

/** The code under a specimen: closed, and read from the stage only when it is opened. */
function codePanel(figure, html) {
  const box = document.createElement('lintje-expander')
  box.className = 'guide__code'
  box.flat = true
  box.heading = 'Code'
  let built = false
  box.addEventListener('lintje-toggle', () => {
    if (built) return
    built = true
    const code = codeOf(figure.stage, html)
    const kinds = [
      ['html', 'HTML', 'html'],
      ['js', 'JavaScript', 'js'],
      ['server', 'Server-HTML', 'html'],
    ].filter(([key]) => code[key])
    const tabs = document.createElement('lintje-tabs')
    tabs.label = 'Code van dit voorbeeld'
    tabs.tabs = kinds.map(([value, label]) => ({ value, label }))
    tabs.value = kinds[0][0]
    tabs.addEventListener('lintje-tab-change', (event) => {
      event.stopPropagation()
      tabs.value = event.detail
    })
    for (const [key, , language] of kinds) {
      const panel = element('div', 'guide__stack')
      panel.slot = key
      const block = document.createElement('lintje-code')
      block.language = language
      block.text = code[key].text
      const copy = document.createElement('lintje-copy-button')
      copy.text = code[key].copy
      copy.size = 'compact'
      panel.append(block, copy)
      tabs.append(panel)
    }
    box.append(tabs)
  })
  return box
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
  figure.querySelector('.guide__caption')?.append(list)
}

function specimenGrid(item) {
  return element(
    'div',
    item.columns ? `guide__specimens guide__specimens--max-${item.columns}` : 'guide__specimens',
  )
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

  const page = element('div', 'guide__page')
  const nav = document.createElement('lintje-sub-nav')
  nav.className = 'guide__nav'
  nav.label = categoryLabel
  nav.groups = [
    {
      label: categoryLabel,
      items: siblings.map((sibling) => ({
        label: nameOf(sibling),
        href: addressOf(sibling),
        active: sibling === item && !groups,
        items:
          sibling === item && groups
            ? groups.items.map((entry) => ({
                label: entry.label,
                href: addressOf(item, entry.value),
                active: entry === chosen,
              }))
            : undefined,
      })),
    },
  ]
  const main = element('div', 'guide__main')
  page.append(nav, main)

  // What it is: the source comment, and one line of what the page holds.
  const intro = document.createElement('lintje-prose')
  intro.className = 'guide__intro'
  intro.html = `${declaration?.description ? proseOf(declaration.description) : ''}<p>${summaryOf(item, declaration)}</p>`
  main.append(intro)

  // The specimens, and for the fields they show the reference's rows.
  const examples = element('section', 'guide__section')
  examples.id = 'voorbeelden'
  examples.append(heading(3, groups ? `${groups.label}: ${chosen.label}` : 'Voorbeelden'))
  const figures = []
  const batches = []
  const draw = (entries, grid, options) => {
    const batch = entries.map((entry) => {
      const figure = renderSpecimen(entry, options)
      figure.html = entry.html
      figure.append(codePanel(figure, entry.html))
      grid.append(figure)
      return figure
    })
    figures.push(...batch)
    batches.push(batch)
  }

  if (groups) {
    // The kinds, by the question they answer: the way to another one.
    const chooser = element('nav', 'guide__chooser')
    chooser.setAttribute('aria-label', `${groups.label} kiezen`)
    for (const [question, label] of Object.entries(groups.questions ?? { '': '' })) {
      const entries = groups.items.filter((entry) => !question || entry.question === question)
      if (!entries.length) continue
      const row = element('div', 'guide__choice')
      if (label) row.append(element('span', 'guide__question', label))
      const buttons = element('div', 'guide__row')
      for (const entry of entries) {
        const button = document.createElement('lintje-button')
        button.size = 'compact'
        button.variant = entry === chosen ? 'primary' : 'secondary'
        button.href = addressOf(item, entry.value, current?.value)
        button.textContent = entry.label
        if (entry === chosen) button.accessibleName = `${entry.label}, gekozen`
        buttons.append(button)
      }
      row.append(buttons)
      chooser.append(row)
    }
    examples.append(chooser)

    const panel = element('div', 'guide__group')
    panel.append(element('code', 'guide__key', `${groups.key}: '${chosen.value}'`))
    if (chosen.use || chosen.avoid) {
      const advice = document.createElement('lintje-prose')
      const escape = (text) => text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])
      advice.html = [
        chosen.use && `<p><strong>Neem hem voor</strong> ${escape(chosen.use)}</p>`,
        chosen.avoid && `<p><strong>Niet voor</strong> ${escape(chosen.avoid)}</p>`,
      ]
        .filter(Boolean)
        .join('')
      panel.append(advice)
    }
    if (states.length > 1) {
      const switcher = document.createElement('lintje-segmented')
      switcher.label = 'Staat'
      switcher.options = states.map(({ value, label }) => ({ value, label }))
      switcher.value = current.value
      switcher.addEventListener('lintje-change', (event) => {
        event.stopPropagation()
        go(addressOf(item, chosen.value, event.detail), { keepScroll: true })
      })
      panel.append(switcher)
    }
    const grid = specimenGrid(item)
    draw(chosen.specimens, grid, { item, state: current })
    panel.append(grid)
    examples.append(panel)
    if (item.specimens.length) {
      examples.append(heading(4, groups.shared ?? 'Voor elk'))
      const shared = specimenGrid(item)
      draw(item.specimens, shared)
      examples.append(shared)
    }
  } else {
    const grid = specimenGrid(item)
    draw(item.specimens, grid)
    examples.append(grid)
  }
  main.append(examples)

  // Which specimen shows which field; what every specimen beside it sets tells nothing apart.
  const shown = new Map(figures.map((figure) => [figure, fieldsShown(figure, item, declaration)]))
  for (const batch of batches) {
    if (batch.length < 2) continue
    const sets = batch.map((figure) => shown.get(figure))
    const everywhere = [...sets[0]].filter((key) => sets.every((set) => set.has(key)))
    for (const set of sets) for (const key of everywhere) set.delete(key)
  }
  const shownPer = figures.map((figure) => shown.get(figure))
  const shownBy = new Map()
  shownPer.forEach((set, i) => {
    const label = figures[i].querySelector('.guide__label')?.textContent
    if (label) for (const key of set) shownBy.set(key, [...(shownBy.get(key) ?? []), label])
  })

  const reference = element('section', 'guide__section')
  reference.id = 'referentie'
  reference.append(heading(3, 'Referentie'))
  let tables
  let own
  const union = declaration && groupUnion(item, declaration, types)
  if (union) {
    // The chosen kind's own fields stand with its specimens; the reference leaves them out.
    own = variantReference(types[union.typeName], chosen.value, union.typeName, shownBy, union.prefix)
    if (own) examples.querySelector('.guide__group').append(heading(4, `Velden van ${chosen.label}`), own)
  }
  if (declaration) {
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
  figures.forEach((figure, i) => captionFields(figure, [...shownPer[i]], show))

  if (item.tag) main.append(usageSection(item.tag, context.appAddress))

  if (item.tag) {
    const load = element('section', 'guide__section')
    load.id = 'laden'
    load.append(heading(3, 'Laden'))
    const code = document.createElement('lintje-code')
    code.language = 'js'
    code.text = [
      `import 'lintje/tag/${nameOf(item)}'  // alleen deze tag`,
      `import 'lintje/${context.category}'  // de hele categorie`,
      `import 'lintje'  // de hele bundel`,
    ].join('\n')
    load.append(code)
    main.append(load)
  }

  host.append(page)
}

const PLACES_SHOWN = 12

/** Where the tag stands in the example applications, filled in once the files are read. */
function usageSection(tag, appAddress) {
  const section = element('section', 'guide__section')
  section.id = 'toegepast'
  section.append(heading(3, 'Toegepast in'))
  const note = document.createElement('lintje-prose')
  note.tone = 'muted'
  note.text = 'De voorbeeldapplicaties worden doorzocht…'
  section.append(note)
  usageOf(tag).then((usage) => {
    const total = usage.reduce((sum, entry) => sum + entry.places.length, 0)
    note.text = total
      ? `${count(total, 'plek', 'plekken')} in ${count(usage.length, 'applicatie', 'applicaties')}.`
      : 'Nog in geen enkele voorbeeldapplicatie.'
    for (const { app, places } of usage) {
      const box = document.createElement('lintje-expander')
      box.flat = true
      box.heading = app.label
      box.subtitle = count(places.length, 'plek', 'plekken')
      const body = element('div', 'guide__stack')
      const code = document.createElement('lintje-code')
      code.language = 'html'
      code.label = `${tag} in ${app.label}`
      const lines = places.slice(0, PLACES_SHOWN).map((place) => `${place.path}:${place.line}  ${place.text}`)
      if (places.length > PLACES_SHOWN) lines.push(`… en nog ${places.length - PLACES_SHOWN}`)
      code.text = lines.join('\n')
      const open = document.createElement('lintje-button')
      open.variant = 'link'
      open.href = appAddress(app)
      open.textContent = `${app.label} openen`
      body.append(code, open)
      box.append(body)
      section.append(box)
    }
  })
  return section
}
