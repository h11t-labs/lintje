/**
 * Prepares a release on the working tree: `npm run release 0.2.0`. The entries in `changes/` (one
 * file per pull request, `<number>-<title>.md`) join what `[Unreleased]` in `CHANGELOG.md` holds,
 * per kind and newest first, and become `[0.2.0] - <today>` with an empty `[Unreleased]` above it
 * and the links at the bottom renewed; the files are removed, `package.json` and the lockfile take
 * the version, and one commit records it. The commit reaches main like any other (a pull request);
 * the tag `v0.2.0` on that commit, pushed, is the release.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'

const REPOSITORY = 'https://github.com/h11t-labs/lintje'
const CHANGES = 'changes'
// The six kinds of Keep a Changelog, in its order.
const KINDS = ['Toegevoegd', 'Gewijzigd', 'Verouderd', 'Verwijderd', 'Opgelost', 'Beveiliging']
const version = process.argv[2]
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
  console.error('usage: npm run release <major.minor.patch>')
  process.exit(2)
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()
if (git('status', '--porcelain')) {
  console.error('the working tree is not clean; commit or set aside the changes first')
  process.exit(1)
}
if (git('tag', '--list', `v${version}`)) {
  console.error(`the tag v${version} exists`)
  process.exit(1)
}

const changelog = readFileSync('CHANGELOG.md', 'utf8')
const head = changelog.indexOf('## [Unreleased]')
if (head === -1) {
  console.error('CHANGELOG.md has no "## [Unreleased]" section')
  process.exit(1)
}
const afterHead = head + '## [Unreleased]'.length
const nextSection = changelog.indexOf('\n## ', afterHead)
const links = changelog.indexOf('\n[unreleased]:', afterHead)
const end = nextSection === -1 ? links : nextSection

/** Splits entries into their `### <kind>` parts: kind → the text under it. */
const byKind = (text, source) => {
  const parts = new Map()
  let kind
  for (const line of text.trim().split('\n')) {
    const heading = /^### (.+)$/.exec(line)?.[1]
    if (heading) {
      if (!KINDS.includes(heading)) {
        console.error(`${source}: "### ${heading}" is not one of ${KINDS.join(', ')}`)
        process.exit(1)
      }
      kind = heading
    } else if (!kind && line.trim()) {
      console.error(`${source}: an entry comes before its "### <kind>" heading`)
      process.exit(1)
    } else if (kind) {
      parts.set(kind, `${parts.get(kind) ?? ''}${line}\n`)
    }
  }
  return parts
}

const files = (existsSync(CHANGES) ? readdirSync(CHANGES) : [])
  .filter((name) => name.endsWith('.md'))
  .map((name) => {
    const number = /^(\d+)-[a-z0-9-]+\.md$/.exec(name)?.[1]
    if (!number) {
      console.error(`${CHANGES}/${name}: the name is not <number>-<title>.md`)
      process.exit(1)
    }
    return { name, number: Number(number) }
  })
  .sort((a, b) => b.number - a.number)
const sources = [
  ...files.map(({ name }) =>
    byKind(readFileSync(`${CHANGES}/${name}`, 'utf8'), `${CHANGES}/${name}`),
  ),
  byKind(changelog.slice(afterHead, end), 'CHANGELOG.md [Unreleased]'),
]
const entries = KINDS.map((kind) => {
  const text = sources
    .map((parts) => parts.get(kind)?.trim())
    .filter(Boolean)
    .join('\n')
  return text && `### ${kind}\n\n${text}`
})
  .filter(Boolean)
  .join('\n\n')
if (!entries) {
  console.error(`${CHANGES}/ and "[Unreleased]" are empty: nothing to release`)
  process.exit(1)
}
const previous = /^\[(\d+\.\d+\.\d+)\]:/m.exec(changelog.slice(links))?.[1]
const today = new Date().toISOString().slice(0, 10)

const body =
  `## [Unreleased]\n\n## [${version}] - ${today}\n\n${entries}\n` +
  changelog.slice(end, links).replace(/\s+$/, '\n\n')
const linkLines = changelog
  .slice(links)
  .replace(/^\[unreleased\]:.*$/m, `[unreleased]: ${REPOSITORY}/compare/v${version}...HEAD`)
  .replace(
    /^(\[unreleased\]:.*\n)/m,
    (line) =>
      `${line}[${version}]: ${
        previous
          ? `${REPOSITORY}/compare/v${previous}...v${version}`
          : `${REPOSITORY}/releases/tag/v${version}`
      }\n`,
  )
writeFileSync('CHANGELOG.md', changelog.slice(0, head) + body + linkLines.replace(/^\n/, ''))

execFileSync('npm', ['version', version, '--no-git-tag-version'], { stdio: 'ignore' })
if (files.length) git('rm', '-q', ...files.map(({ name }) => `${CHANGES}/${name}`))
git('add', 'CHANGELOG.md', 'package.json', 'package-lock.json')
git('commit', '-m', `Release ${version}`)
console.log(
  `Release ${version} is committed on ${git('branch', '--show-current')}. Get it onto main, then tag it there:\n` +
    `  git fetch origin && git tag v${version} origin/main && git push origin v${version}`,
)
