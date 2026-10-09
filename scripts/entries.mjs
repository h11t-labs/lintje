/**
 * What the build's entries are made from: which module defines which tag (the one that calls
 * `define('lintje-<name>', …)`) and what a module imports. Plain JavaScript, shared with tests.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'

const DEFINE = /^define\('(lintje-[a-z0-9-]+)'/gm

/** An `import`, `export … from` or bare `import '…'`; `import type` is erased at build. */
const IMPORT =
  /^[ \t]*(?:import|export)[ \t]+(type[ \t]+)?[\w\s{},*$]*?from[ \t]+['"]([^'"]+)['"]|^[ \t]*import[ \t]+['"]([^'"]+)['"]/gm

function sourceFiles(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) sourceFiles(path, files)
    else if (name.endsWith('.ts') && !name.endsWith('.test.ts') && !name.endsWith('.d.ts'))
      files.push(path)
  }
  return files
}

export function tagModules(srcDir) {
  const found = []
  for (const file of sourceFiles(resolve(srcDir))) {
    for (const match of readFileSync(file, 'utf8').matchAll(DEFINE)) found.push([match[1], file])
  }
  return new Map(found.sort(([a], [b]) => a.localeCompare(b)))
}

/**
 * The categories (`src/categories.json`): `src/bundle/<name>.ts` becomes `dist-elements/<name>.js`.
 * Read from the working directory, the repository root for every script and test.
 */
export const CATEGORY_NAMES = JSON.parse(readFileSync(resolve('src/categories.json'), 'utf8')).map(
  (category) => category.name,
)

export const tagEntryName = (tag) => `tag/${tag.replace(/^lintje-/, '')}`

function resolveImport(from, specifier) {
  const base = resolve(dirname(from), specifier.replace(/\?.*$/, ''))
  for (const candidate of [base, `${base}.ts`, join(base, 'index.ts')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return null
}

export function importsOf(file) {
  const imports = new Set()
  if (!file.endsWith('.ts')) return imports
  for (const match of readFileSync(file, 'utf8').matchAll(IMPORT)) {
    if (match[1]) continue
    const specifier = match[2] ?? match[3]
    if (!specifier.startsWith('.')) imports.add(specifier.replace(/\?.*$/, ''))
    else {
      const resolved = resolveImport(file, specifier)
      if (resolved) imports.add(resolved)
    }
  }
  return imports
}

export function importClosure(file) {
  const seen = new Set()
  const stack = [resolve(file)]
  while (stack.length) {
    const next = stack.pop()
    if (seen.has(next)) continue
    seen.add(next)
    if (isAbsolute(next)) for (const imported of importsOf(next)) stack.push(imported)
  }
  return seen
}
