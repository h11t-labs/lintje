/**
 * The code under a specimen, read from what it drew: its markup, and the rich properties its
 * `setup` set, as a script would set them and as a page a server renders writes them.
 */

/** Markup without the indentation of the template literal it was written in. */
export function dedent(text) {
  const lines = text.replace(/^\n+|\s+$/g, '').split('\n')
  const indents = lines
    .slice(1)
    .filter((line) => line.trim())
    .map((line) => line.match(/^ */)[0].length)
  const cut = indents.length ? Math.min(...indents) : 0
  return [lines[0].trim(), ...lines.slice(1).map((line) => line.slice(cut))].join('\n')
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/
const LONG = 6

/**
 * A value as source text. `short` cuts a long list after three entries, for reading; the copy
 * takes the whole. `js` leaves the quotes off keys that need none.
 */
export function format(value, { short = false, js = false } = {}, depth = 0) {
  const pad = '  '.repeat(depth + 1)
  const end = '  '.repeat(depth)
  const nested = (item) => format(item, { short, js }, depth + 1)
  // JSON takes no comma after the last entry; a script reads better with one.
  const block = (open, lines, close) =>
    `${open}\n${lines.map((line, i) => `${pad}${line}${js || i < lines.length - 1 ? ',' : ''}`).join('\n')}\n${end}${close}`
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (typeof value.toJSON === 'function') return JSON.stringify(value)
  if (Array.isArray(value)) {
    const shown = short && value.length > LONG ? value.slice(0, 3) : value
    const items = shown.map(nested)
    const rest = value.length - shown.length
    const flat = `[${items.join(', ')}${rest ? `, /* … ${rest} meer */` : ''}]`
    if (!flat.includes('\n') && flat.length + depth * 2 <= 80) return flat
    return block('[', [...items, ...(rest ? [`/* … ${rest} meer */`] : [])], ']')
  }
  const entries = Object.entries(value).filter(
    ([, item]) => item !== undefined && typeof item !== 'function',
  )
  if (!entries.length) return '{}'
  const key = (name) => (js && IDENTIFIER.test(name) ? name : JSON.stringify(name))
  const parts = entries.map(([name, item]) => `${key(name)}: ${nested(item)}`)
  const flat = `{ ${parts.join(', ')} }`
  if (!flat.includes('\n') && flat.length + depth * 2 <= 72) return flat
  return block('{', parts, '}')
}

/** The properties without an attribute that differ from a fresh element's: what `setup` set. */
export function richProperties(element) {
  const properties = element.constructor.elementProperties
  if (!properties) return []
  const fresh = document.createElement(element.localName)
  return [...properties]
    .filter(([, options]) => options.attribute === false && !options.state)
    .map(([name]) => [name, element[name]])
    .filter(
      ([name, value]) =>
        value !== undefined && value !== null && JSON.stringify(value) !== JSON.stringify(fresh[name]),
    )
}

/** How deep a node stands below `root`, for the indentation of what is put into it. */
const depth = (node, root) => {
  let level = 0
  for (let parent = node.parentNode; parent && parent !== root; parent = parent.parentNode) level++
  return level
}

const variableOf = (tag) => tag.replace('lintje-', '').replace(/-(\w)/g, (_, c) => c.toUpperCase())

/** The tags a stage holds outside every shadow root, with their place among their kind. */
function tagsIn(root) {
  const seen = new Map()
  return [...root.querySelectorAll('*')]
    .filter((node) => node.localName.startsWith('lintje-'))
    .map((node) => {
      const index = seen.get(node.localName) ?? 0
      seen.set(node.localName, index + 1)
      return { node, index }
    })
}

/**
 * The code of one specimen: `html` as written, and — when `setup` gave a tag a rich property —
 * `js` that sets it and `server` with it as JSON in the markup. Each has a `text` to read and a
 * `copy` that is whole.
 */
export function codeOf(stage, html) {
  const markup = html ? dedent(html) : ''
  const code = { html: markup ? { text: markup, copy: markup } : undefined }
  const set = tagsIn(stage)
    .map((entry) => ({ ...entry, properties: richProperties(entry.node) }))
    .filter((entry) => entry.properties.length)
  if (!set.length) return code

  const counts = new Map()
  for (const { node } of set) counts.set(node.localName, (counts.get(node.localName) ?? 0) + 1)
  const script = (short) =>
    set
      .flatMap(({ node, index, properties }) => {
        const name = counts.get(node.localName) > 1 ? `${variableOf(node.localName)}${index + 1}` : variableOf(node.localName)
        const query =
          index === 0
            ? `document.querySelector('${node.localName}')`
            : `document.querySelectorAll('${node.localName}')[${index}]`
        return [
          `const ${name} = ${query}`,
          ...properties.map(([property, value]) => `${name}.${property} = ${format(value, { short, js: true })}`),
          '',
        ]
      })
      .join('\n')
      .trim()
  code.js = { text: script(true), copy: script(false) }

  // Only a tag the markup itself holds can carry its JSON; one `setup` made has no place there.
  const server = (short) => {
    const template = document.createElement('template')
    template.innerHTML = markup
    const written = tagsIn(template.content)
    let placed = 0
    for (const { node, index, properties } of set) {
      const target = written.find((entry) => entry.node.localName === node.localName && entry.index === index)
      if (!target) continue
      placed++
      for (const [property, value] of [...properties].reverse()) {
        const source = document.createElement('script')
        source.type = 'application/json'
        if (property !== 'data') source.dataset.prop = property
        const indent = '  '.repeat(depth(target.node, template.content) + 1)
        source.textContent = `\n${format(value, { short }).replace(/^/gm, `${indent}  `)}\n${indent}`
        target.node.prepend(`\n${indent}`, source)
      }
    }
    return placed ? template.innerHTML : undefined
  }
  const text = server(true)
  if (text) code.server = { text, copy: server(false) }
  return code
}
