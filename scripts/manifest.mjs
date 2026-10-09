/**
 * The tag reference, read from the source: a Custom Elements Manifest (schema 1.0.0) with every
 * tag's properties, attributes, events and slots. Nothing is written by hand, so it cannot go
 * stale. Plain JavaScript, so the build and the tests read one file.
 *
 * The parser is the one Vite's bundler carries (`rolldown`).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { parseSync } from 'rolldown/experimental'

const EVENT_NAME = /^lintje-[a-z0-9-]+$/
const SLOT = /<slot(?:\s+name="([a-z-]+)")?/g
const LIT_TYPE = {
  String: 'string',
  Number: 'number',
  Boolean: 'boolean',
  Array: 'array',
  Object: 'object',
}

function sourceFiles(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) sourceFiles(path, files)
    else if (name.endsWith('.ts') && !name.endsWith('.test.ts') && !name.endsWith('.d.ts'))
      files.push(path)
  }
  return files
}

function walk(node, visit) {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit)
    return
  }
  if (typeof node.type === 'string') visit(node)
  for (const key in node) if (key !== 'type') walk(node[key], visit)
}

/** A JSDoc block as text: the stars and the indentation removed. */
const docText = (value) =>
  value
    .split('\n')
    .map((line) => line.replace(/^\s*\*? ?/, ''))
    .join('\n')
    .trim()

/** The `/** … *\/` that ends right before `start`, with at most `export` between. */
function docBefore(file, start) {
  const comment = file.docs.findLast((doc) => doc.end <= start)
  if (!comment || !/^\s*(export\s+)?$/.test(file.text.slice(comment.end, start))) return undefined
  return docText(comment.value.slice(1))
}

/** What a host may call or read besides the properties: the public members that carry a doc. */
function ownMethods(file, cls) {
  return cls.body.body.flatMap((member) => {
    if (member.type !== 'MethodDefinition' || member.static || member.key.type !== 'Identifier')
      return []
    if (member.accessibility === 'private' || member.accessibility === 'protected') return []
    if (member.kind !== 'method' && member.kind !== 'get') return []
    // A lifecycle callback is the browser's to call, not a host's.
    if (member.key.name.endsWith('Callback')) return []
    const description = docBefore(file, member.start)
    if (!description) return []
    const returns = member.value.returnType?.typeAnnotation
    const type = returns && file.text.slice(returns.start, returns.end).replace(/\s+/g, ' ')
    if (member.kind === 'get')
      return [{ kind: 'field', name: member.key.name, type, description, readonly: true }]
    const params = member.value.params.map((param) => file.text.slice(param.start, param.end))
    return [
      {
        kind: 'method',
        name: member.key.name,
        signature: `(${params.join(', ')})`,
        type,
        description,
      },
    ]
  })
}

const unwrap = (node) =>
  node && (node.type === 'TSAsExpression' || node.type === 'TSSatisfiesExpression')
    ? unwrap(node.expression)
    : node

const keyName = (node) => node.key?.name ?? node.key?.value

/** One parsed module: its classes, the tags it defines, the events it sends, its slots. */
function readModule(path) {
  const text = readFileSync(path, 'utf8')
  const { program, comments } = parseSync(path, text)
  const file = {
    path,
    text,
    docs: comments.filter((c) => c.type === 'Block' && c.value.startsWith('*')),
    classes: [],
    aliases: new Map(),
    tags: [],
    events: new Map(),
    dynamicEvents: false,
    literals: new Set(),
    slots: [...text.matchAll(SLOT)].map((match) => match[1] ?? ''),
  }
  const header = file.docs[0]
  file.header = header && header.start < 10 ? docText(header.value.slice(1)) : undefined

  walk(program, (node) => {
    if (node.type === 'ClassDeclaration' && node.id) file.classes.push(node)
    if (node.type === 'TSTypeAliasDeclaration') {
      const alias = text
        .slice(node.typeAnnotation.start, node.typeAnnotation.end)
        .replace(/\s+/g, ' ')
      if (alias.length <= 120) file.aliases.set(node.id.name, alias.replace(/^\| /, ''))
    }
    if (node.type === 'Literal' && typeof node.value === 'string' && EVENT_NAME.test(node.value))
      file.literals.add(node.value)
    if (node.type !== 'CallExpression') return
    const callee = node.callee
    if (callee.type === 'Identifier' && callee.name === 'define') {
      const [tag, cls] = node.arguments
      if (tag?.type === 'Literal' && cls?.type === 'Identifier')
        file.tags.push([tag.value, cls.name])
    }
    const method = callee.type === 'MemberExpression' ? callee.property?.name : undefined
    if (method === 'followLink') {
      // A link the reader chose: cancelable, and with the frame's own payload where it gives one.
      const payload = node.arguments[2] ? '{ pathname, search }' : '{ href }'
      if (!file.events.has('lintje-navigate'))
        file.events.set('lintje-navigate', { composed: true, detail: payload })
      return
    }
    if (method !== 'emit' && method !== 'emitLocal') return
    const [name, detail] = node.arguments
    if (name?.type !== 'Literal') {
      file.dynamicEvents = true
      return
    }
    const known = file.events.get(name.value) ?? { composed: false, detail: undefined }
    if (method === 'emit') known.composed = true
    if (!known.detail && detail) known.detail = detailText(text, detail)
    file.events.set(name.value, known)
  })
  return file
}

/** What an event carries, as far as the call says: the keys of an object, or a short expression. */
function detailText(text, node) {
  if (node.type === 'ObjectExpression') {
    const keys = node.properties.map((p) => {
      if (p.type === 'SpreadElement') return '…'
      return p.computed ? `[${text.slice(p.key.start, p.key.end)}]` : keyName(p)
    })
    return `{ ${keys.join(', ')} }`
  }
  const source = text.slice(node.start, node.end)
  return source.length <= 40 && !source.includes('\n') ? source : undefined
}

/** The reactive properties a class declares itself, in the order of `static properties`. */
function ownProperties(file, cls) {
  const members = cls.body.body.filter((m) => m.type === 'PropertyDefinition')
  const declared = unwrap(members.find((m) => m.static && keyName(m) === 'properties')?.value)
  if (declared?.type !== 'ObjectExpression') return []
  const fields = new Map(members.filter((m) => !m.static).map((m) => [keyName(m), m]))

  return declared.properties.flatMap((entry) => {
    const name = keyName(entry)
    const options = Object.fromEntries(
      (entry.value?.properties ?? []).map((option) => [keyName(option), option.value]),
    )
    if (!name || options.state?.value === true) return []
    const field = fields.get(name)
    const annotation = field?.typeAnnotation?.typeAnnotation
    const initial = field?.value && file.text.slice(field.value.start, field.value.end)
    const attribute =
      options.attribute?.value === false
        ? undefined
        : (options.attribute?.value ?? name.toLowerCase())
    return [
      {
        name,
        type: annotation
          ? file.text.slice(annotation.start, annotation.end).replace(/\s+/g, ' ')
          : (LIT_TYPE[options.type?.name] ?? 'unknown'),
        default: initial && initial.length <= 40 && !initial.includes('\n') ? initial : undefined,
        attribute,
        reflects: options.reflect?.value === true || undefined,
        description: field ? docBefore(file, field.start) : undefined,
      },
    ]
  })
}

export function buildManifest(srcDir) {
  const root = resolve(srcDir)
  const files = sourceFiles(root).map(readModule)
  const classes = new Map()
  for (const file of files) for (const cls of file.classes) classes.set(cls.id.name, { file, cls })
  // A named union says more written out: `ButtonSize` → `'regular' | 'compact' | 'chrome'`.
  const aliases = new Map(files.flatMap((file) => [...file.aliases]))
  const tagNames = new Set(files.flatMap((file) => file.tags.map(([tag]) => tag)))
  const tagFolders = new Set(
    files.filter((file) => file.tags.length).map((file) => dirname(file.path)),
  )

  /** A tag's own module, its helpers in the same folder, and the modules of its base classes. */
  function modulesOf(file, chain) {
    const folder = dirname(file.path)
    const helpers = files.filter((other) => dirname(other.path) === folder && !other.tags.length)
    return new Set([file, ...helpers, ...chain.map((entry) => entry.file)])
  }

  const modules = []
  for (const file of files) {
    if (!file.tags.length) continue
    const declarations = []
    const exports = []
    for (const [tagName, className] of file.tags) {
      const chain = []
      for (let name = className; classes.has(name); name = classes.get(name).cls.superClass?.name)
        chain.push(classes.get(name))
      if (!chain.length) continue

      const members = new Map()
      for (const entry of [...chain].reverse()) {
        for (const property of ownProperties(entry.file, entry.cls)) {
          const inherited =
            entry.cls.id.name === className ? undefined : { name: entry.cls.id.name }
          members.set(property.name, { ...members.get(property.name), ...property, inherited })
        }
      }

      // The base element's own are every tag's: not said per tag.
      const methods = chain
        .filter((entry) => entry.cls.id.name !== 'LintjeElement')
        .flatMap((entry) => ownMethods(entry.file, entry.cls))
      const events = new Map()
      const slots = new Set()
      for (const module of modulesOf(file, chain)) {
        // A folder of shared helpers serves many tags; only a tag's own folder speaks for it.
        const own = module === file || tagFolders.has(dirname(module.path))
        if (!own && !chain.some((entry) => entry.file === module)) continue
        // The base element only passes on what a tag asks it to send.
        if (module.classes.some((cls) => cls.id.name === 'LintjeElement')) continue
        for (const [name, event] of module.events)
          events.set(name, { ...event, ...events.get(name) })
        if (module.dynamicEvents)
          for (const name of module.literals)
            if (!tagNames.has(name) && !events.has(name)) events.set(name, { composed: true })
        for (const slot of module.slots) slots.add(slot)
      }

      const fields = [...members.values()].map((field) => ({
        ...field,
        type: aliases.get(field.type) ?? field.type,
      }))
      const text = (type) => (type ? { text: type } : undefined)
      declarations.push({
        kind: 'class',
        name: className,
        tagName,
        customElement: true,
        description: docBefore(chain[0].file, chain[0].cls.start) ?? file.header,
        superclass: chain[1] && { name: chain[1].cls.id.name },
        members: fields.map((field) => ({
          kind: 'field',
          name: field.name,
          type: text(field.type),
          default: field.default,
          description: field.description,
          attribute: field.attribute,
          reflects: field.reflects,
          inheritedFrom: field.inherited,
        })),
        methods: methods.map((method) => ({
          kind: method.kind,
          name: method.name,
          description: method.description,
          readonly: method.readonly,
          parameters: method.signature,
          return: text(method.type),
        })),
        attributes: fields
          .filter((field) => field.attribute)
          .map((field) => ({
            name: field.attribute,
            fieldName: field.name,
            type: text(field.type),
            default: field.default,
            description: field.description,
          })),
        events: [...events]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([name, event]) => ({
            name,
            type: { text: event.detail ? `CustomEvent<${event.detail}>` : 'CustomEvent' },
            description: event.composed ? undefined : 'Not composed: it stops at the shadow root.',
          })),
        slots: [...slots].sort().map((name) => ({ name })),
      })
      exports.push({
        kind: 'custom-element-definition',
        name: tagName,
        declaration: { name: className, module: relative(dirname(root), file.path) },
      })
    }
    modules.push({
      kind: 'javascript-module',
      path: relative(dirname(root), file.path),
      declarations,
      exports,
    })
  }
  modules.sort((a, b) => a.path.localeCompare(b.path))
  return { schemaVersion: '1.0.0', readme: 'README.md', modules }
}

/** Every tag's declaration, by tag name. */
export function declarationsByTag(manifest) {
  return new Map(
    manifest.modules.flatMap((module) => module.declarations.map((d) => [d.tagName, d])),
  )
}
