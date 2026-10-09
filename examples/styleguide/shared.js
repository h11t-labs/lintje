/**
 * The style guide's contract: what every specimen module uses.
 *
 * A specimen module (`specimens/<name>.js`) exports one object:
 *
 *   export default {
 *     elements: [
 *       {
 *         tag: 'lintje-textarea',
 *         title: 'Meerregelig tekstveld met teller',
 *         specimens: [
 *           { label: 'Rust', html: '<lintje-textarea label="Omschrijving"></lintje-textarea>' },
 *           { label: 'Fout', html: '…', setup(stage) { stage.querySelector('…').items = [...] } },
 *         ],
 *       },
 *     ],
 *   }
 *
 * `html` is plain markup with the tags and their attributes; `setup(stage)` runs once, after
 * the markup stands, for what an attribute cannot carry: a rich property (`.items`, `.data`)
 * or a listener. It finds its nodes inside `stage`. `wide: true` on a specimen gives it the
 * full row; without it the specimens stand in columns. `columns: 2` or `3` on an element caps
 * them, for an element that reads badly side by side in a narrow column.
 *
 * An element is drawn once, in a `<lintje-tile>` that carries its tag and what it is, in the
 * page's own mode: the mode control in the shell's bar shows it in light and in dark.
 *
 * Under its specimens an element shows its reference — properties, events and slots — read
 * from `dist-elements/custom-elements.json`, which the build derives from the source.
 *
 * An element's section has the id `el-<tag without lintje->` (`#el-form`, `#el-tabs`). A
 * section that shows no single tag names its own
 * `id` instead of a `tag`, and a `short` name for the page's index. Which category an element
 * stands in is not the module's to say: the menu in `index.js` lists them.
 */

function element(name, className, text) {
  const node = document.createElement(name)
  if (className) node.className = className
  if (text) node.textContent = text
  return node
}

/** The id of an element's section. */
export const sectionId = ({ tag, id }) => id ?? `el-${tag.replace('lintje-', '')}`

/**
 * A line under a specimen that shows what the host heard: returns the function that writes it.
 * It is the guide's, so it stands under the stage's frame, not in it.
 */
export function log(stage, text = 'Nog niets gebeurd.') {
  const line = code(text)
  stage.closest('.guide__specimen').append(line)
  return (next) => (line.text = next)
}

/** A block of plain text in `lintje-code`: what the host heard, or what went wrong. */
function code(text) {
  const block = document.createElement('lintje-code')
  block.className = 'guide__log'
  block.wrap = true
  block.label = 'Wat de host hoorde'
  block.text = text
  return block
}

/** One specimen: its label and the stage the markup stands on. */
function specimen({ label, html, setup, wide }) {
  const figure = element('figure', wide ? 'guide__specimen guide__specimen--wide' : 'guide__specimen')
  if (label) figure.append(element('figcaption', 'guide__label', label))
  const stage = element('div', 'guide__stage')
  stage.innerHTML = html ?? ''
  figure.append(stage)
  if (setup) {
    try {
      setup(stage)
    } catch (error) {
      console.error(error)
      stage.append(code(String(error)))
    }
  }
  return figure
}

/** The tags' declarations from the built manifest, by tag; empty when the file is missing. */
export async function loadReference(url) {
  try {
    const manifest = await (await fetch(url)).json()
    return new Map(
      manifest.modules.flatMap((module) => module.declarations.map((d) => [d.tagName, d])),
    )
  } catch (error) {
    console.warn('No tag reference: run `npm run build:elements`.', error)
    return new Map()
  }
}

/** A table inside the element's tile. */
function table(caption, columns, rows) {
  const node = document.createElement('lintje-data-table')
  node.bare = true
  node.data = {
    caption,
    rowKey: 'name',
    pageSize: 100,
    // On a phone a row is its name, one measure and a line under it.
    columns: columns.map(([key, header, phone]) => ({
      key,
      header,
      format: 'text',
      sortable: false,
      mobileMeasure: phone === 'measure',
      mobileSubline: phone === 'subline',
    })),
    rows,
  }
  return node
}

/** A source comment as one line of plain text for a cell. */
const plain = (text) => text?.replace(/`/g, '').replace(/\s+/g, ' ') ?? null

/** What an event carries, from its manifest type: `CustomEvent<{ id }>` → `{ id }`. */
const detailOf = (event) => event.type.text.match(/^CustomEvent<(.*)>$/)?.[1] ?? null

/** A source comment as markup: escaped, its paragraphs kept and `code` marked. The tag's own
 *  name at the start goes: the tile's heading says it. */
function proseOf(description) {
  const escaped = description
    .replace(/^`<lintje-[a-z-]+>`(?: \/ `<lintje-[a-z-]+>`)* — /, '')
    .replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])
  return escaped
    .split(/\n\s*\n/)
    .map((part) => `<p>${part.replace(/`([^`]+)`/g, '<code>$1</code>')}</p>`)
    .join('')
}

/** An element's reference, closed until asked for: what it is, its properties, events and slots. */
function reference(declaration) {
  const box = document.createElement('lintje-expander')
  box.className = 'guide__reference'
  box.flat = true
  box.heading = 'Referentie'
  const stack = element('div', 'guide__stack')

  // `mode` is every element's; the page says it once.
  const fields = declaration.members.filter((field) => field.inheritedFrom?.name !== 'LintjeElement')
  const count = (n, one, many) => `${n} ${n === 1 ? one : many}`
  box.subtitle = [
    count(fields.length, 'eigenschap', 'eigenschappen'),
    count(declaration.events.length, 'event', 'events'),
    count(declaration.slots.length, 'slot', 'slots'),
  ].join(' · ')

  if (declaration.description) {
    const text = document.createElement('lintje-prose')
    text.html = proseOf(declaration.description)
    stack.append(text)
  }
  if (fields.length) {
    stack.append(
      table(
        `Eigenschappen van ${declaration.tagName}`,
        [
          ['name', 'Eigenschap'],
          ['attribute', 'Attribuut'],
          ['type', 'Type', 'measure'],
          ['initial', 'Standaard'],
          ['about', 'Toelichting', 'subline'],
        ],
        fields.map((field) => ({
          name: field.name,
          attribute: field.attribute ?? null,
          type: field.type?.text ?? null,
          initial: field.default ?? null,
          about: plain(field.description),
        })),
      ),
    )
  }
  if (declaration.events.length) {
    stack.append(
      table(
        `Events van ${declaration.tagName}`,
        [['name', 'Event'], ['detail', 'Detail', 'measure'], ['about', 'Toelichting', 'subline']],
        declaration.events.map((event) => ({
          name: event.name,
          detail: detailOf(event),
          about: event.description ?? null,
        })),
      ),
    )
  }
  if (declaration.methods.length) {
    stack.append(
      table(
        `Methoden van ${declaration.tagName}`,
        [['name', 'Methode of getter'], ['returns', 'Geeft', 'measure'], ['about', 'Toelichting', 'subline']],
        declaration.methods.map((method) => ({
          name: `${method.name}${method.parameters ?? ''}`,
          returns: method.return?.text ?? null,
          about: plain(method.description),
        })),
      ),
    )
  }
  if (declaration.slots.length) {
    const names = declaration.slots.map((slot) => slot.name || 'standaard').join(', ')
    const slots = document.createElement('lintje-prose')
    slots.tone = 'muted'
    slots.text = `Slots: ${names}`
    stack.append(slots)
  }
  box.append(stack)
  return box
}

/** How a page loads a tag: by itself, or with its category. */
function importOf(tag, category) {
  const code = document.createElement('lintje-code')
  code.language = 'js'
  code.text = `import 'lintje/tag/${tag.replace('lintje-', '')}'\nimport 'lintje/${category}' // of de hele categorie`
  return code
}

/**
 * One element's section: a tile with the tag, what it is, its specimens, how to load it and its
 * reference.
 */
export function renderElement(host, item, declarations, category) {
  const section = element('section', 'guide__element')
  section.id = sectionId(item)
  const tile = document.createElement('lintje-tile')
  tile.heading = item.tag ?? item.title
  if (item.tag && item.title) tile.subtitle = item.title
  const grid = element('div', item.columns ? `guide__specimens guide__specimens--max-${item.columns}` : 'guide__specimens')
  for (const entry of item.specimens) grid.append(specimen(entry))
  tile.append(grid)
  if (item.tag && category) tile.append(importOf(item.tag, category))
  const declaration = declarations?.get(item.tag)
  if (declaration) tile.append(reference(declaration))
  section.append(tile)
  host.append(section)
  return section
}
