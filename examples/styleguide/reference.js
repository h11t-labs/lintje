/**
 * An element's reference, read from the build: its properties, events, methods and slots
 * (`custom-elements.json`), and the types its rich properties take, field by field
 * (`data-types.json`). Both come from the source; nothing here is written by hand.
 */

/** A file the build writes next to the bundle; empty when the build has not run. */
export async function loadJSON(url, empty) {
  try {
    return await (await fetch(url)).json()
  } catch (error) {
    console.warn(`No ${url.split('/').at(-1)}: run \`npm run build:elements\`.`, error)
    return empty
  }
}

/** The tags' declarations from the manifest, by tag, each with the path of its module. */
export const declarationsOf = (manifest) =>
  new Map(
    manifest.modules.flatMap((module) =>
      module.declarations.map((d) => [d.tagName, { ...d, module: module.path }]),
    ),
  )

// Every element's, so the page says it once.
const EVERY_ELEMENTS = new Set(['LintjeElement'])
const EVERY_TYPES = new Set(['FrameSettings'])

/** The fields a host sets on an element: its own, not the base element's. */
export const fieldsOf = (declaration) =>
  declaration.members.filter((field) => !EVERY_ELEMENTS.has(field.inheritedFrom?.name))

/** A source comment as one line of plain text. */
const plain = (text) => text?.replace(/`/g, '').replace(/\s+/g, ' ').trim() || null

/** What an event carries, from its manifest type: `CustomEvent<{ id }>` → `{ id }`. */
const detailOf = (event) => event.type.text.match(/^CustomEvent<(.*)>$/)?.[1] ?? null

/** The values of a type that is a union of literals: `'a' | 'b'` → `['a', 'b']`; otherwise null. */
const literalsOf = (type) =>
  type && /^('[^']*'|\w+)(\s*\|\s*('[^']*'|\w+))+$/.test(type) && type.includes("'")
    ? type.split(/\s*\|\s*/)
    : null

/** The names of the known types a type text mentions: `KpiData[] | null` → `KpiData`. */
export const typeNames = (text, types) =>
  [...new Set(text?.match(/\b[A-Z]\w*/g) ?? [])].filter(
    (name) => types[name] && !EVERY_TYPES.has(name),
  )

/** An interface's fields, with those of what it extends first, as a host writes them. */
export function interfaceFields(name, types, seen = new Set()) {
  const type = types[name]
  if (type?.kind !== 'interface' || seen.has(name) || EVERY_TYPES.has(name)) return []
  seen.add(name)
  const inherited = type.extends.flatMap((base) => interfaceFields(base, types, seen))
  return [...inherited, ...type.fields]
}

function element(name, className, text) {
  const node = document.createElement(name)
  if (className) node.className = className
  if (text) node.textContent = text
  return node
}

/**
 * One entry of the reference as a row: its name (and how HTML writes it), its type or its
 * values, its default, its source comment — quoted as one, in English — and the specimens that
 * show it. `key` is what a search finds it by.
 */
function propRow({ name, attribute, type, initial, required, about, seen }, onSeen) {
  const row = element('div', 'guide__prop')
  row.key = name.toLowerCase()
  const head = element('div', 'guide__prop-head')
  head.append(element('code', 'guide__prop-name', name))
  if (required) head.append(element('span', 'guide__required', 'verplicht'))
  if (attribute) head.append(element('code', 'guide__prop-attr', `${attribute}="…"`))
  const body = element('div', 'guide__prop-body')
  const line = element('div', 'guide__prop-type')
  const literals = literalsOf(type)
  if (literals) for (const value of literals) line.append(element('code', 'guide__value', value))
  else if (type) line.append(element('code', '', type))
  if (initial) {
    const value = element('span', 'guide__meta', 'standaard ')
    value.append(element('code', '', initial))
    line.append(value)
  }
  body.append(line)
  if (about) body.append(element('p', 'guide__comment', about))
  if (seen?.length) {
    const where = element('p', 'guide__meta guide__seen', 'Te zien in ')
    seen.forEach((label, i) => {
      if (i) where.append(i === seen.length - 1 ? ' en ' : ', ')
      const link = element('a', '', label)
      link.href = '#'
      link.addEventListener('click', (event) => {
        event.preventDefault()
        onSeen?.(label)
      })
      where.append(link)
    })
    body.append(where)
  }
  row.append(head, body)
  return row
}

/** A list of rows in a box. */
const propList = (rows, nested = false) => {
  const list = element('div', nested ? 'guide__props guide__props--nested' : 'guide__props')
  list.append(...rows)
  return list
}

/** The rows of a type's fields; a field that names a type of its own opens it under it. */
function fieldRows(fields, types, context, prefix, depth = 0) {
  return fields.map((field) => {
    const row = propRow(
      {
        name: field.name,
        type: field.type,
        required: !field.optional,
        about: plain(field.description),
        seen: [...new Set(context.shownBy.get(`${prefix}${field.name}`) ?? [])],
      },
      context.onSeen,
    )
    if (depth < 1)
      for (const name of typeNames(field.type, types))
        row.querySelector('.guide__prop-body').append(...typeBoxes(name, types, context, `${field.name}.`, depth + 1))
    return row
  })
}

/** A type's fields under the field that takes it, closed: an expander per interface or variant. */
function typeBoxes(name, types, context, prefix, depth) {
  const type = types[name]
  if (!type || context.skip.has(name)) return []
  const box = (heading, subtitle, rows) => {
    const node = document.createElement('lintje-expander')
    node.flat = true
    node.leading = true
    node.heading = heading
    if (subtitle) node.subtitle = subtitle
    node.append(propList(rows, true))
    return node
  }
  if (type.kind === 'interface') {
    const fields = interfaceFields(name, types)
    if (!fields.length) return []
    return [box(`${fields.length} velden van ${name}`, null, fieldRows(fields, types, context, prefix, depth))]
  }
  if (type.kind === 'union')
    return type.variants.map((variant) =>
      box(
        `${type.discriminant}: '${variant.value}'`,
        `${variant.fields.length} velden`,
        fieldRows(variant.fields, types, context, prefix, depth),
      ),
    )
  return []
}

// The attributes shown before "Alle tonen": the ones the specimens use most.
const FIRST = 5

/**
 * The reference: a search and a choice of part, then the attributes, the rich properties ("Data")
 * with their types under them, the events, slots and methods, and the tag's own source comment.
 * `shownBy` maps a field (`variant`, `data.title`) to the names of the specimens that set it, and
 * `onSeen(name)` goes to one; `skip` names the types the page shows elsewhere. The result's `toc`
 * is its entries for "Op deze pagina".
 */
export function renderReference(
  declaration,
  types,
  { shownBy = new Map(), skip = new Set(), onSeen, about } = {},
) {
  const stack = element('div', 'guide__reference')
  const context = { shownBy, skip, onSeen }
  const fields = fieldsOf(declaration)
  const attributes = fields.filter((field) => field.attribute !== undefined)
  const rich = fields.filter((field) => field.attribute === undefined)
  const sections = []
  const toc = []

  const part = (id, title, sub, content, items) => {
    const node = element('section', 'guide__section')
    node.id = `ref-${id}`
    node.dataset.part = id
    node.append(element('h3', 'guide__heading', title))
    if (sub) node.append(element('p', 'guide__meta', sub))
    node.append(content)
    stack.append(node)
    sections.push(node)
    toc.push({ label: title, href: `#${node.id}`, ...(items ? { items } : {}) })
    return node
  }

  // The search and the choice of part, above every part.
  const tools = element('div', 'guide__ref-tools')
  const search = document.createElement('lintje-text-input')
  search.className = 'guide__search'
  search.type = 'search'
  search.label = 'Zoek een eigenschap'
  search.hideLabel = true
  search.placeholder = 'Zoek een eigenschap, bijv. icon'
  search.commitOn = 'input'
  tools.append(search)
  let filter
  if (attributes.length && rich.length) {
    filter = document.createElement('lintje-segmented')
    filter.label = 'Toon'
    filter.hideLabel = true
    filter.options = [
      { value: '', label: 'Alles', count: fields.length },
      { value: 'attributen', label: 'Attributen', count: attributes.length },
      { value: 'data', label: 'Data', count: rich.length },
    ]
    filter.value = ''
    tools.append(filter)
  }
  stack.append(tools)

  const seenOf = (key) => [...new Set(shownBy.get(key) ?? [])]
  let rest = []
  let more
  if (attributes.length) {
    // The most used first, in the source's order among equals.
    const ranked = attributes
      .map((field, i) => ({ field, i, uses: seenOf(field.name).length }))
      .sort((a, b) => b.uses - a.uses || a.i - b.i)
      .map(({ field }) => field)
    const rows = ranked.map((field) =>
      propRow(
        {
          name: field.name,
          attribute: field.attribute,
          type: field.type?.text,
          initial: field.default,
          about: plain(field.description),
          seen: seenOf(field.name),
        },
        onSeen,
      ),
    )
    const list = propList(rows)
    if (rows.length > FIRST + 1) {
      rest = rows.slice(FIRST)
      for (const row of rest) row.hidden = true
      more = element('div', 'guide__prop guide__prop--more')
      const names = element('span', 'guide__meta', `En nog ${rest.length}: ${ranked.slice(FIRST).map((field) => field.name).join(', ')}`)
      const all = document.createElement('lintje-button')
      all.variant = 'link'
      all.size = 'compact'
      all.textContent = 'Alle tonen'
      all.addEventListener('click', () => {
        for (const row of rest) row.hidden = false
        // The button goes with its row; the focus goes to the first attribute it showed.
        rest[0].tabIndex = -1
        rest[0].focus()
        more.hidden = true
        rest = []
      })
      more.append(names, all)
      list.append(more)
    }
    part('attributen', 'Attributen', 'Zet je in de HTML; een script zet ze als eigenschap, met de naam links.', list)
  }

  if (rich.length) {
    const rows = rich.map((field) => {
      const row = propRow(
        {
          name: field.name,
          type: field.type?.text,
          initial: field.default,
          about: plain(field.description),
          seen: seenOf(field.name),
        },
        onSeen,
      )
      row.id = `ref-${field.name}`
      for (const name of typeNames(field.type?.text, types))
        row.querySelector('.guide__prop-body').append(...typeBoxes(name, types, context, `${field.name}.`, 0))
      return row
    })
    part(
      'data',
      'Data',
      'Rijke waarden: alleen via een script (el.data = { … }) of als JSON in de markup. Hun velden klap je open.',
      propList(rows),
      rich.map((field) => ({ label: field.name, href: `#ref-${field.name}` })),
    )
  }

  if (declaration.events.length)
    part(
      'events',
      'Events',
      'Wat het element meldt; de host luistert en beslist.',
      propList(
        declaration.events.map((event) =>
          propRow({ name: event.name, type: detailOf(event), about: plain(event.description) }),
        ),
      ),
    )
  if (declaration.slots.length)
    part(
      'slots',
      'Slots',
      'Waar je eigen markup in komt.',
      propList(
        declaration.slots.map((slot) =>
          propRow({ name: slot.name || 'standaard', about: plain(slot.description) }),
        ),
      ),
    )
  if (declaration.methods.length)
    part(
      'methoden',
      'Methoden',
      'Wat een host mag aanroepen.',
      propList(
        declaration.methods.map((method) =>
          propRow({
            name: `${method.name}${method.parameters ?? ''}`,
            type: method.return?.text,
            about: plain(method.description),
          }),
        ),
      ),
    )
  if (about) part('over', 'Over deze tag', `Het kopcommentaar in ${declaration.module}.`, about)

  const rows = () => [...stack.querySelectorAll('.guide__prop')].filter((row) => row.key)
  const apply = () => {
    const term = String(search.value ?? '').trim().toLowerCase()
    const chosen = filter?.value ?? ''
    for (const row of rows()) {
      const found = !term || row.key.includes(term)
      row.hidden = !found || (!term && rest.includes(row))
      // A match inside a closed type opens it.
      if (found && term) row.parentElement.closest('lintje-expander')?.setAttribute('open', '')
    }
    if (more) more.hidden = Boolean(term) || !rest.length
    for (const node of sections) {
      const wanted = !chosen || node.dataset.part === chosen
      const any = !term || node.dataset.part === 'over' ? true : rows().some((row) => !row.hidden && node.contains(row))
      node.hidden = !wanted || !any || (term && node.dataset.part === 'over')
    }
  }
  search.addEventListener('lintje-change', (event) => {
    event.stopPropagation()
    search.value = event.detail
    apply()
  })
  filter?.addEventListener('lintje-change', (event) => {
    event.stopPropagation()
    filter.value = event.detail
    apply()
  })
  stack.toc = toc
  return stack
}

/** The fields of one variant of a union, for a page that shows its variants apart. */
export function variantReference(union, value, types, shownBy, prefix, onSeen) {
  const variant = union.variants.find((entry) => entry.value === value)
  if (!variant) return null
  return propList(fieldRows(variant.fields, types, { shownBy, skip: new Set(), onSeen }, prefix))
}
