/**
 * Prints the section of `CHANGELOG.md` for one version, as the notes of its GitHub release:
 * `node scripts/release-notes.mjs 0.2.0`. Exits with 1 when the changelog has no such section, so
 * a tag without its entry fails before anything is published.
 */
import { readFileSync } from 'node:fs'

const version = process.argv[2]?.replace(/^v/, '')
if (!version) {
  console.error('usage: node scripts/release-notes.mjs <version>')
  process.exit(2)
}

const lines = readFileSync('CHANGELOG.md', 'utf8').split('\n')
const start = lines.findIndex((line) => line.startsWith(`## [${version}]`))
if (start === -1) {
  console.error(`CHANGELOG.md has no section "## [${version}]"`)
  process.exit(1)
}
const rest = lines.slice(start + 1)
const end = rest.findIndex((line) => line.startsWith('## ') || /^\[[^\]]+\]:/.test(line))
const body = (end === -1 ? rest : rest.slice(0, end)).join('\n').trim()
if (!body) {
  console.error(`CHANGELOG.md: the section "## [${version}]" is empty`)
  process.exit(1)
}
process.stdout.write(`${body}\n`)
