/**
 * Looks up Lintje's tag reference (`custom-elements.json`) so an agent reads one tag instead of
 * the whole file.
 *
 *   node reference.mjs <custom-elements.json>          every tag, with its first line
 *   node reference.mjs <custom-elements.json> <tag>    one tag: attributes, properties, events, slots
 */
import { readFileSync } from 'node:fs'

const [file, tag] = process.argv.slice(2)
if (!file) {
  console.error('node reference.mjs <custom-elements.json> [lintje-<name>]')
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(file, 'utf8'))
const elements = manifest.modules
  .flatMap((module) => module.declarations ?? [])
  .filter((declaration) => declaration.customElement)

const summary = (element) => (element.description ?? '').split('\n')[0].replace(/^`<[^>]+>` — /, '')

if (!tag) {
  for (const element of elements) console.log(`${element.tagName} — ${summary(element)}`)
  process.exit(0)
}

const element = elements.find((candidate) => candidate.tagName === tag)
if (!element) {
  console.error(`No tag "${tag}"; run without a tag for the list.`)
  process.exit(1)
}

const type = (entry) => (entry.type?.text ? `: ${entry.type.text}` : '')
const note = (entry) => (entry.description ? ` — ${entry.description.replace(/\s+/g, ' ')}` : '')
const fields = element.members.filter(
  (member) => member.kind === 'field' && !member.privacy && !member.static,
)

console.log(`${element.tagName} (${element.name})\n\n${element.description ?? ''}\n`)
console.log('Attributes (HTML):')
for (const attribute of element.attributes ?? []) {
  console.log(`  ${attribute.name}${type(attribute)}${note(attribute)}`)
}
console.log('Properties (script only):')
for (const field of fields.filter((member) => !member.attribute)) {
  console.log(`  .${field.name}${type(field)}${note(field)}`)
}
console.log('Events:')
for (const event of element.events ?? []) console.log(`  ${event.name}${type(event)}${note(event)}`)
console.log('Slots:')
for (const slot of element.slots ?? []) console.log(`  ${slot.name || '(default)'}${note(slot)}`)
