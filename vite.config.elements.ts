/**
 * The custom-element build: the scripts a plain HTML page includes.
 *
 *   npm run build:elements        # → dist-elements/
 *
 * The script runs this configuration twice, and each run writes one way of loading
 * (`docs/guides/loading.md`):
 *
 * 1. **Everything, in one file** (the default mode): `lintje.js` — the elements, Lit, and every
 *    stylesheet as a string inside the module. Vite's `?inline` import puts the CSS there;
 *    `shadowCss()` turns each one into a single `CSSStyleSheet` that every shadow root adopts,
 *    so a page holding a hundred elements parses the CSS once. No `styles.css` next to it: a
 *    shadow root cannot use a linked stylesheet without fetching it per root. This run also
 *    writes `tokens.css` and `fonts.css`.
 * 2. **What a page uses** (`--mode split`): `core.js` (the host API), one file per category
 *    (`forms.js`, `charts.js`, …), one per tag (`tag/<name>.js`) and `dev.js`, over the shared
 *    code in `chunks/`. These files import one another, so a page that loads three of them has
 *    one copy of Lit and one of the module state (the host config, the icon source, the
 *    shortcuts).
 *
 * `lintje.js` stands apart from the second run on purpose: it stays one request, and it carries
 * its own copy of that state. A page loads `lintje.js` **or** the files of the second run, never
 * both.
 *
 * `tokens.css` — the six theme blocks of `themes.css`, then the tokens as the design writes them
 * (`:root`, `[data-mode='dark']`, `[data-density='compact']`). It is the file a host page styles
 * its own content with.
 *
 * `fonts.css` — the two `@font-face` rules, pointing at `fonts/` beside it, where the build copies
 * RijksSans from `@nl-rvo/assets`. A shadow root ignores `@font-face` (Chromium), so the
 * typography comes from the page.
 *
 * The bundle carries only the icons it draws itself (`src/icons/register.ts`); a name
 * that comes from data is fetched as one file from the page's icon folder
 * (`setIconSource()`, `src/icons/loader.ts`).
 */
import { defineConfig, type Plugin } from 'vite'
import { copyFileSync, cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { CATEGORY_NAMES, tagEntryName, tagModules } from './scripts/entries.mjs'

const resolvePath = (p: string) => fileURLToPath(new URL(p, import.meta.url))

const outDir = resolvePath('./dist-elements')
const PACKAGE = JSON.parse(readFileSync(resolvePath('./package.json'), 'utf8')) as {
  version: string
}
const TOKENS = resolvePath('./src/tokens/tokens.css')
const THEMES = resolvePath('./src/tokens/themes.css')
const FONTS = resolvePath('./src/tokens/fonts.css')

/**
 * The entries of the second run, by the name of their file:
 *
 * - `core` — the host API without a tag; `dev` — the check a host loads while developing;
 * - one per category;
 * - `tag/<name>` — one per tag, the module that defines it (`scripts/entries.mjs`). A module
 *   that defines two tags (`repeater.ts`) is the entry of both.
 */
function splitEntries(): Record<string, string> {
  const entry: Record<string, string> = {
    core: resolvePath('./src/bundle/core.ts'),
    dev: resolvePath('./src/bundle/dev.ts'),
  }
  for (const name of CATEGORY_NAMES) entry[name] = resolvePath(`./src/bundle/${name}.ts`)
  for (const [tag, file] of tagModules(resolvePath('./src'))) entry[tagEntryName(tag)] = file
  return entry
}

/**
 * The tokens as a page-level stylesheet: `themes.css`, then the tokens themselves.
 *
 * `themes.css` belongs HERE and not in the module: it is the one stylesheet a
 * shadow root must never adopt (`src/tokens/themes.css` says why). A page that
 * links this file gets the `rijksoverheid` default; `data-theme` on `<html>`
 * switches it.
 */
function pageTokens(): string {
  return `${readFileSync(THEMES, 'utf8')}\n${readFileSync(TOKENS, 'utf8')}`
}

const FONT_DIR = '../../node_modules/@nl-rvo/assets/fonts/'

/** The `@font-face` rules, pointing at the `fonts/` folder beside the file. */
function pageFonts(): string {
  return readFileSync(FONTS, 'utf8').replaceAll(FONT_DIR, './fonts/')
}

/** The font files `fonts.css` names. */
function fontFiles(): string[] {
  const css = readFileSync(FONTS, 'utf8')
  return [
    ...css.matchAll(/url\('\.\.\/\.\.\/node_modules\/@nl-rvo\/assets\/fonts\/([^']+)'\)/g),
  ].map((match) => match[1]!)
}

const SKILL = resolvePath('./skills/lintje')
const GUIDES = resolvePath('./docs/guides/')
const REPOSITORY = 'https://github.com/h11t-labs/lintje/blob/main/docs/guides/'

/** A guide outside the repository: a link that leaves `docs/guides/` points at the repository. */
function guide(file: string): string {
  return readFileSync(join(GUIDES, file), 'utf8').replace(
    /\]\((\.\.\/[^)]+)\)/g,
    (_, path: string) => `](${new URL(path, REPOSITORY).href})`,
  )
}

/**
 * Writes `tokens.css`, `fonts.css` and the `fonts/` it names next to the module, the guides, and
 * the agent skill (`skills/lintje/`) beside `custom-elements.json`, which it reads.
 */
function emitAssets(): Plugin {
  return {
    name: 'lintje-elements-assets',
    writeBundle(options) {
      const dir = options.dir ?? outDir
      writeFileSync(join(dir, 'tokens.css'), pageTokens())
      writeFileSync(join(dir, 'fonts.css'), pageFonts())
      mkdirSync(join(dir, 'fonts'), { recursive: true })
      for (const file of fontFiles()) {
        copyFileSync(resolvePath(`./src/tokens/${FONT_DIR}${file}`), join(dir, 'fonts', file))
      }
      mkdirSync(join(dir, 'guides'), { recursive: true })
      for (const file of readdirSync(GUIDES).filter((name) => name.endsWith('.md'))) {
        writeFileSync(join(dir, 'guides', file), guide(file))
      }
      cpSync(SKILL, join(dir, 'skills', 'lintje'), { recursive: true })
    },
  }
}

/**
 * What every entry of the second run loads, as one file: Lit, `core/`, the tokens, the icons and
 * the primitives. Nearly every tag draws a button or an icon, so apart they would be a dozen
 * requests that always travel together.
 */
const BASE =
  /node_modules[\\/](lit|lit-html|lit-element|@lit)[\\/]|[\\/]src[\\/](core|icons|tokens|primitives)[\\/]/

export default defineConfig(({ mode }) => {
  const split = mode === 'split'
  return {
    plugins: split ? [] : [emitAssets()],
    // The build carries its version (`LINTJE_VERSION`); the source alone says `dev`.
    define: { __LINTJE_VERSION__: JSON.stringify(PACKAGE.version) },
    publicDir: false,
    build: {
      outDir,
      // The first run starts the folder over; the second adds to it.
      emptyOutDir: !split,
      target: 'es2022',
      // The copied CSS travels as it is written.
      cssMinify: false,
      lib: split
        ? { entry: splitEntries(), formats: ['es'] }
        : {
            entry: resolvePath('./src/bundle/index.ts'),
            formats: ['es'],
            fileName: () => 'lintje.js',
          },
      rollupOptions: split
        ? {
            // A tag's code stands in the tag's own file, and another file that needs it imports
            // it from there. Without this the bundler keeps an entry's exports exact, moves the
            // code to a chunk and leaves the entry as a second request that only re-exports.
            preserveEntrySignatures: 'allow-extension',
            output: {
              entryFileNames: '[name].js',
              chunkFileNames: 'chunks/[name]-[hash].js',
              codeSplitting: { groups: [{ name: 'base', test: BASE }] },
            },
          }
        : { output: { entryFileNames: 'lintje.js' } },
    },
  }
})
