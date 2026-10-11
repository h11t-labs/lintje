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

/** A source comment as one line of plain text for a cell. */
const plain = (text) => text?.replace(/`/g, '').replace(/\s+/g, ' ') ?? null

/** What an event carries, from its manifest type: `CustomEvent<{ id }>` → `{ id }`. */
const detailOf = (event) => event.type.text.match(/^CustomEvent<(.*)>$/)?.[1] ?? null

/** The values of a type that is a union of strings: `'a' | 'b'` → `a · b`; otherwise the type. */
const valuesOf = (type) =>
  type && /^'[^']*'(\s*\|\s*'[^']*')+$/.test(type)
    ? type.replace(/'/g, '').replace(/\s*\|\s*/g, ' · ')
    : type

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

/**
 * A table in the reference, one row per entry. `key` is what a row is found by: `only(key)` shows
 * that row, `match(term)` the rows whose key holds the term. On a phone a row is its name, a
 * short measure and a line under it, `subline` with `{key}` placeholders. `bare` for a table in a
 * tile; otherwise it stands on the page itself.
 */
const LONG = new Set(['about', 'type', 'seen', 'detail'])

function table(caption, columns, rows, { subline, bare = false } = {}) {
  const node = document.createElement('lintje-data-table')
  if (bare) node.bare = true
  else node.plain = true
  const all = rows.map((row, i) => ({ id: String(i), ...row }))
  const draw = (shown) => {
    node.data = {
      caption,
      rowKey: 'id',
      pageSize: 200,
      columns: columns.map(([key, header, phone]) => ({
        key,
        header,
        format: 'text',
        sortable: false,
        // A long explanation is cut on one line; it is whole under the focus and in its title.
        truncate: LONG.has(key),
        mobileMeasure: phone === 'measure',
        mobileSubline: phone === 'subline',
      })),
      rows: shown,
      mobileSublineTemplate: subline,
    }
    // A table with nothing to show steps aside, and its tile or heading with it.
    node.hidden = !shown.length
    if (node.tile) node.tile.hidden = !shown.length
    node.previousElementSibling?.classList.toggle('is-empty', !shown.length)
  }
  draw(all)
  node.only = (key) => draw(all.filter((row) => row.key === key))
  node.match = (term) => draw(term ? all.filter((row) => row.key.toLowerCase().includes(term)) : all)
  return node
}

const heading = (text, level = 4) => {
  const node = document.createElement(`h${level}`)
  node.className = 'guide__subheading'
  node.textContent = text
  return node
}

/** "Te zien in": the specimens that show a field, by their label. */
const seenIn = (shownBy, key) => {
  const labels = shownBy.get(key) ?? []
  if (!labels.length) return null
  return labels.length > 3
    ? `${labels.slice(0, 3).join(', ')} en ${labels.length - 3} meer`
    : labels.join(', ')
}

/** One field table of a type: name, values, required, what it is, and where a specimen shows it. */
function fieldTable(caption, fields, shownBy, prefix) {
  return table(
    caption,
    [
      ['name', 'Veld'],
      ['type', 'Waarden'],
      ['required', 'Verplicht', 'measure'],
      ['about', 'Toelichting'],
      ['seen', 'Te zien in'],
    ],
    fields.map((field) => ({
      key: field.name,
      name: field.name,
      type: valuesOf(field.type),
      required: field.optional ? 'nee' : 'ja',
      about: plain(field.description),
      seen: seenIn(shownBy, `${prefix}${field.name}`),
    })),
    { subline: '{type} · {about}' },
  )
}

/** A tile in the reference's row of the small parts: slots, events, methods. */
function partTile(title, span, content) {
  const tile = document.createElement('lintje-tile')
  tile.heading = title
  tile.span = span
  tile.append(content)
  return tile
}

const prose = (text) => {
  const node = document.createElement('lintje-prose')
  node.text = text
  return node
}

/**
 * The reference: a search over every table, the properties, the fields of a rich property, and
 * the slots, events and methods. `shownBy` maps a field (`variant`, `data.title`, `chart.donut`)
 * to the labels of the specimens that set it; `skip` names the types the page shows elsewhere,
 * such as the kinds of a chart.
 */
export function renderReference(declaration, types, { shownBy = new Map(), skip = new Set() } = {}) {
  const stack = document.createElement('div')
  stack.className = 'guide__stack guide__reference'
  const tables = new Map()
  const fields = fieldsOf(declaration)

  const search = document.createElement('lintje-text-input')
  search.className = 'guide__search'
  search.type = 'search'
  search.layout = 'row'
  search.label = 'Zoek een eigenschap'
  search.placeholder = 'bijv. icon'
  search.commitOn = 'input'
  const searchRow = document.createElement('div')
  searchRow.className = 'guide__row'
  searchRow.append(search)
  stack.append(searchRow)

  /** A table in a tile that names it, the tile gone with the table when a search finds nothing. */
  const inTile = (title, node) => {
    node.bare = true
    node.plain = false
    const tile = document.createElement('lintje-tile')
    tile.heading = title
    tile.append(node)
    node.tile = tile
    return tile
  }

  if (fields.length) {
    const properties = table(
      `Eigenschappen van ${declaration.tagName}`,
      [
        ['name', 'Eigenschap'],
        ['type', 'Waarden'],
        ['initial', 'Standaard', 'measure'],
        ['about', 'Toelichting'],
        ['seen', 'Te zien in'],
      ],
      fields.map((field) => ({
        key: field.name,
        name: field.name,
        type: valuesOf(field.type?.text) ?? null,
        initial: field.default ?? null,
        // The attribute is said where it is not the property's own name.
        about: [
          field.attribute && field.attribute !== field.name ? `Attribuut ${field.attribute}.` : '',
          plain(field.description) ?? '',
        ]
          .join(' ')
          .trim() || null,
        seen: seenIn(shownBy, field.name),
      })),
      { subline: '{type} · {about}' },
    )
    const total = document.createElement('span')
    total.className = 'guide__meta'
    total.textContent = `${fields.length} eigenschappen`
    searchRow.append(total)
    stack.append(inTile(`Eigenschappen van ${declaration.tagName}`, properties))
    tables.set('', properties)
  }

  // A rich property's type, one level deep: its fields, and the types they name.
  const expanded = new Set()
  const expand = (name, prefix, depth) => {
    if (expanded.has(name) || skip.has(name) || depth > 1) return
    expanded.add(name)
    const type = types[name]
    if (type.kind === 'interface') {
      const own = interfaceFields(name, types)
      if (!own.length) return
      const node = fieldTable(`Velden van ${name}`, own, shownBy, prefix)
      tables.set(prefix, node)
      if (depth) {
        // A type a field names is a step further: closed, as a union's variants are.
        const box = document.createElement('lintje-expander')
        box.flat = true
        box.heading = name
        box.subtitle = plain(type.description) ?? `${own.length} velden`
        box.append(node)
        node.reveal = () => (box.open = true)
        stack.append(box)
      } else stack.append(inTile(`${prefix.slice(0, -1)}: ${name}`, node))
      for (const field of own)
        for (const inner of typeNames(field.type, types)) expand(inner, `${field.name}.`, depth + 1)
    } else if (type.kind === 'union') {
      stack.append(heading(`${name}: een van ${type.variants.length}, naar ${type.discriminant}`))
      for (const variant of type.variants) {
        const box = document.createElement('lintje-expander')
        box.flat = true
        box.heading = `${type.discriminant}: '${variant.value}'`
        box.subtitle = plain(variant.description) ?? `${variant.fields.length} velden`
        box.append(
          fieldTable(
            `Velden van ${name} met ${type.discriminant} '${variant.value}'`,
            variant.fields,
            shownBy,
            prefix,
          ),
        )
        stack.append(box)
      }
    }
  }
  for (const field of fields)
    if (field.attribute === undefined)
      for (const name of typeNames(field.type?.text, types)) expand(name, `${field.name}.`, 0)

  // The small parts side by side: what goes in, what comes out, what a host may call.
  const parts = document.createElement('lintje-grid')
  parts.append(
    partTile(
      'Slots',
      6,
      prose(
        declaration.slots.length
          ? declaration.slots.map((slot) => slot.name || 'standaard').join(', ')
          : 'Geen: alles komt binnen als eigenschap.',
      ),
    ),
    partTile(
      'Events',
      6,
      declaration.events.length
        ? table(
            `Events van ${declaration.tagName}`,
            [
              ['name', 'Event'],
              ['detail', 'Detail', 'measure'],
              ['about', 'Toelichting', 'subline'],
            ],
            declaration.events.map((event) => ({
              key: event.name,
              name: event.name,
              detail: detailOf(event),
              about: event.description ?? null,
            })),
            { bare: true },
          )
        : prose('Geen eigen events: luister naar de gewone van de browser, zoals click.'),
    ),
  )
  if (declaration.methods.length)
    parts.append(
      partTile(
        'Methoden',
        12,
        table(
          `Methoden van ${declaration.tagName}`,
          [
            ['name', 'Methode of getter'],
            ['returns', 'Geeft', 'measure'],
            ['about', 'Toelichting', 'subline'],
          ],
          declaration.methods.map((method) => ({
            key: method.name,
            name: `${method.name}${method.parameters ?? ''}`,
            returns: method.return?.text ?? null,
            about: plain(method.description),
          })),
          { bare: true },
        ),
      ),
    )
  stack.append(parts)

  const searchable = () => [...stack.querySelectorAll('lintje-data-table')].filter((node) => node.match)
  search.addEventListener('lintje-change', (event) => {
    event.stopPropagation()
    const term = String(event.detail ?? '').trim().toLowerCase()
    for (const node of searchable()) node.match(term)
    // A match in a closed type opens it.
    if (term)
      for (const box of stack.querySelectorAll('lintje-expander'))
        if (!box.querySelector('lintje-data-table')?.hidden) box.open = true
  })

  /** Shows one field's row: `variant`, or `data.title` in the table of `data`. */
  stack.show = (key) => {
    const dot = key.lastIndexOf('.')
    const target = tables.get(dot < 0 ? '' : key.slice(0, dot + 1))
    if (!target) return null
    target.only(dot < 0 ? key : key.slice(dot + 1))
    target.reveal?.()
    return target
  }
  return stack
}

/** The field table of one variant of a union, for a page that shows its variants apart. */
export function variantReference(union, value, typeName, shownBy, prefix) {
  const variant = union.variants.find((entry) => entry.value === value)
  if (!variant) return null
  return fieldTable(
    `Velden van ${typeName} met ${union.discriminant} '${value}'`,
    variant.fields,
    shownBy,
    prefix,
  )
}
