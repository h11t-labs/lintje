/**
 * Finishes the declarations `tsc -p tsconfig.types.json` writes to `dist-elements/types/`: every
 * relative specifier gets its `.js` file, so the types resolve under `bundler` and `nodenext`
 * alike, and every entry of the build gets a `.d.ts` beside it (`lintje.d.ts`, `core.d.ts`, the
 * categories, `tag/<name>.d.ts`) that re-exports its source module's declarations.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { CATEGORY_NAMES, tagEntryName, tagModules } from './entries.mjs'

const OUT = resolve('dist-elements')
const TYPES = join(OUT, 'types')
const SRC = resolve('src')
const ENTRIES = ['index', 'core', 'dev', ...CATEGORY_NAMES]

function declarations(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) declarations(path, files)
    else if (name.endsWith('.d.ts')) files.push(path)
  }
  return files
}

const SPECIFIER = /(from\s+|import\s*\(|import\s+)(['"])(\.{1,2}\/[^'"]*)\2/g

function withExtension(file, specifier) {
  if (specifier.endsWith('.js')) return specifier
  const base = resolve(dirname(file), specifier)
  if (existsSync(`${base}.d.ts`)) return `${specifier}.js`
  if (existsSync(join(base, 'index.d.ts'))) return `${specifier}/index.js`
  throw new Error(`${relative(OUT, file)}: no declaration for "${specifier}"`)
}

for (const file of declarations(TYPES)) {
  const text = readFileSync(file, 'utf8')
  const next = text.replace(SPECIFIER, (_, lead, quote, specifier) => {
    return `${lead}${quote}${withExtension(file, specifier)}${quote}`
  })
  if (next !== text) writeFileSync(file, next)
}

/** `dist-elements/<entry>.d.ts` → the declarations of the module the entry was built from. */
function stub(entry, source) {
  const target = join(OUT, `${entry}.d.ts`)
  const module = join(TYPES, relative(SRC, source)).replace(/\.ts$/, '.js')
  let specifier = relative(dirname(target), module)
  if (!specifier.startsWith('.')) specifier = `./${specifier}`
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, `export * from '${specifier}'\n`)
}

for (const entry of ENTRIES) {
  stub(entry === 'index' ? 'lintje' : entry, join(SRC, 'bundle', `${entry}.ts`))
}
const tags = tagModules(SRC)
for (const [tag, file] of tags) stub(tagEntryName(tag), file)
console.log(`types: ${ENTRIES.length + tags.size} entries`)
