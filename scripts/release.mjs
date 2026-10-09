/**
 * Prepares a release on the working tree: `npm run release 0.2.0`. The `[Unreleased]` section of
 * `CHANGELOG.md` becomes `[0.2.0] - <today>` with an empty `[Unreleased]` above it and the links
 * at the bottom renewed, `package.json` and the lockfile take the version, and one commit records
 * it. The commit reaches main like any other (a pull request); the tag `v0.2.0` on that commit,
 * pushed, is the release.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const REPOSITORY = 'https://github.com/h11t-labs/lintje'
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
const entries = changelog.slice(afterHead, end).trim()
if (!entries) {
  console.error('the "[Unreleased]" section is empty: nothing to release')
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
git('add', 'CHANGELOG.md', 'package.json', 'package-lock.json')
git('commit', '-m', `Release ${version}`)
console.log(
  `Release ${version} is committed on ${git('branch', '--show-current')}. Get it onto main, then tag it there:\n` +
    `  git fetch origin && git tag v${version} origin/main && git push origin v${version}`,
)
