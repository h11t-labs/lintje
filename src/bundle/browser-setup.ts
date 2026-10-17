/**
 * What a page gives the elements, for every `*.browser.test.ts`: the fonts, the themes and the
 * tokens at document level — the order of `dist-elements/tokens.css` — and the house set as the
 * icon source. A `ResizeObserver` loop fails the test it falls in, or the file when it falls
 * between or after the tests.
 */
import { afterAll, afterEach, beforeEach, expect } from 'vitest'
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
  // #271: an accordion whose rows all stand open at load sets `allOpen` from `updated()`, so the
  // link is drawn a second time as "Alles sluiten".
  'lintje-accordion',
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

// Vitest turns the loop's `error` event into a `console.error`; listening on `window` instead
// would make it report every real uncaught error as a `console.error` too.
const LOOP = /ResizeObserver loop/
const loops: string[] = []
let test = ''
let where = 'before the first test'

const consoleError = console.error
console.error = (...args: unknown[]): void => {
  if (args.some((arg) => LOOP.test(arg instanceof Error ? arg.message : String(arg)))) {
    loops.push(where)
  }
  consoleError.apply(console, args)
}

function check(found: string[]): void {
  if (found.length > 0) {
    const places = [...new Set(found)].join('; ')
    throw new Error(`ResizeObserver loop completed with undelivered notifications ${places}`)
  }
}

// The loop is reported after a frame's layout, so what a test changed last shows two frames on.
async function settle(): Promise<void> {
  await new Promise(requestAnimationFrame)
  await new Promise(requestAnimationFrame)
}

// One between two tests fails the file, not the next test, which a retry would let pass.
const between: string[] = []

beforeEach(() => {
  between.push(...loops.splice(0))
  test = expect.getState().currentTestName ?? ''
  where = `in "${test}"`
})

afterEach(async () => {
  try {
    await settle()
    check(loops.splice(0))
  } finally {
    where = `after "${test}"`
  }
})

afterAll(async () => {
  await settle()
  check([...between.splice(0), ...loops.splice(0)])
})
