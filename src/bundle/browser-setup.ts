/**
 * What a page gives the elements, for every `*.browser.test.ts`: the fonts, the themes and the
 * tokens at document level — the order of `dist-elements/tokens.css` — and the house set as the
 * icon source.
 */
import { afterEach, beforeEach } from 'vitest'
import '../tokens/fonts.css'
import '../tokens/themes.css'
import '../tokens/tokens.css'
import { setIconSource } from '../icons/loader'

setIconSource({ base: '/dist-icons/' })

// Lit's `change-in-update` (a reactive property set after a render draws the element twice)
// and a key registered twice fail the test. A wrapper, not `vi.spyOn`: the style guide's test
// restores all mocks after each test.
const WARNED = /scheduled an update|is registered twice/
const warnings: string[] = []

const consoleWarn = console.warn
console.warn = (...args: unknown[]): void => {
  const line = args.map(String).join(' ')
  if (WARNED.test(line)) warnings.push(line)
  consoleWarn.apply(console, args)
}

/**
 * The tags that still draw twice. The match is the tag in the warning, not the test's name: an
 * element warns in the test that draws it first.
 */
const KNOWN_TWICE: string[] = [
  // #96: the stepper's row or column is another template, and measuring it in its observer
  // resizes the stepper inside the observer's own delivery (#56).
  'lintje-stepper',
]

declare global {
  // Lit warns once per page per kind: emptied, each test hears its own elements.
  var litIssuedWarnings: Set<string | undefined> | undefined
}

beforeEach(() => {
  globalThis.litIssuedWarnings?.clear()
})

afterEach(() => {
  const found = warnings.splice(0).filter((line) => {
    const tag = /Element (lintje-[a-z-]+) scheduled/.exec(line)?.[1]
    return !tag || !KNOWN_TWICE.includes(tag)
  })
  if (found.length > 0) throw new Error([...new Set(found)].join('\n'))
})
