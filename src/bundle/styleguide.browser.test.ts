/**
 * The style guide in a real browser: every element's specimens, drawn as the style guide draws
 * them, in light and dark, at 1440 and 390 px. An element passes when its tags are defined,
 * nothing reaches `console.error`, every icon it names has a file and axe finds no WCAG A or AA
 * violation. It does not look at the page and it does not listen to a screen reader.
 */
import axe from 'axe-core'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import { iconIsMissing } from '../icons/loader'
import './index'

interface Specimen {
  html?: string
  setup?: (stage: HTMLElement) => void
}

interface GuideElement {
  tag?: string
  id?: string
  title?: string
  specimens: Specimen[]
}

const modules = import.meta.glob<{ default: { elements: GuideElement[] } }>(
  '../../examples/styleguide/specimens/*.js',
)
const ELEMENTS = (await Promise.all(Object.values(modules).map((load) => load()))).flatMap(
  (module) => module.default.elements,
)
const nameOf = (item: GuideElement): string => item.tag ?? item.id ?? item.title ?? '?'

const MODES = ['light', 'dark'] as const
const VIEWPORTS = [
  { name: '1440 px', width: 1440, height: 900 },
  { name: '390 px', width: 390, height: 844 },
]
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

/** The name a specimen uses to show an icon that has no file. */
const NO_FILE_ON_PURPOSE = 'bestaat-niet'

/**
 * What axe finds today: each entry is a line in `docs/OPEN_ISSUES.md` and matches the finding's
 * line below. A finding that matches none fails its element; an entry that matches nothing in a
 * whole run fails too, so the fix takes its entry out.
 */
const KNOWN: RegExp[] = [/^color-contrast @ .*\.lintje-logobar__environment-(label|short) ::/]
const seen = new Set<RegExp>()
let drawn = 0

/** The icons asked for by name, so a name without a file is seen. */
const requested = new Set<string>()
const fetches = new Set<Promise<unknown>>()
const nativeFetch = window.fetch.bind(window)
window.fetch = (input, init) => {
  const request = nativeFetch(input, init)
  const url = input instanceof Request ? input.url : String(input)
  const icon = /\/dist-icons\/([^/?]+)\.svg/.exec(url)
  if (icon?.[1]) {
    requested.add(decodeURIComponent(icon[1]))
    const done: Promise<unknown> = request.then(
      () => fetches.delete(done),
      () => fetches.delete(done),
    )
    fetches.add(done)
  }
  return request
}

/** Every element under a node, through every shadow root. */
function deep(root: ParentNode, found: Element[] = []): Element[] {
  for (const element of root.querySelectorAll('*')) {
    found.push(element)
    if (element.shadowRoot) deep(element.shadowRoot, found)
  }
  return found
}

type Updating = Element & { updateComplete?: Promise<unknown>; isUpdatePending?: boolean }

/** The animations and transitions that end, in the document and in every shadow root. */
function ending(elements: Element[]): Animation[] {
  const roots = elements.flatMap((element) => element.shadowRoot ?? [])
  const running = [document, ...roots].flatMap((root) => root.getAnimations())
  return [...new Set(running)].filter(
    (animation) => animation.effect?.getComputedTiming().endTime !== Infinity,
  )
}

/** A picture or a recording the browser is still reading. */
const loading = (element: Element): boolean =>
  element instanceof HTMLImageElement
    ? !element.complete
    : element instanceof HTMLMediaElement &&
      Boolean(element.getAttribute('src')) &&
      !element.error &&
      element.readyState === HTMLMediaElement.HAVE_NOTHING

/**
 * Waits until the page is still: nothing left to draw or to load, no transition running — three
 * frames in a row, because what an element starts (a child, a media event) lands a frame later.
 */
async function settle(): Promise<void> {
  for (let round = 0, still = 0; round < 120 && still < 3; round++) {
    const before = deep(document.body) as Updating[]
    await Promise.all([...before.map((element) => element.updateComplete), ...fetches])
    for (const animation of ending(before)) animation.finish()
    await new Promise((resolve) => requestAnimationFrame(resolve))
    const after = deep(document.body) as Updating[]
    const moving =
      fetches.size > 0 ||
      ending(after).length > 0 ||
      after.some((element) => element.isUpdatePending || loading(element))
    still = moving ? 0 : still + 1
  }
}

/** One element's specimens on the page, built as `examples/styleguide/shared.js` builds them. */
function draw(item: GuideElement): void {
  const host = document.createElement('main')
  for (const specimen of item.specimens) {
    // A specimen's `log()` writes under the stage's frame: the figure around it.
    const figure = document.createElement('figure')
    figure.className = 'guide__specimen'
    const stage = document.createElement('div')
    stage.className = 'guide__stage'
    stage.innerHTML = specimen.html ?? ''
    figure.append(stage)
    host.append(figure)
    specimen.setup?.(stage)
  }
  document.body.append(host)
}

/** The colour a token resolves to on this page, as the browser writes it. */
function colourOf(token: string): string {
  const probe = document.createElement('span')
  probe.style.color = `var(${token})`
  document.body.append(probe)
  const colour = getComputedStyle(probe).color
  probe.remove()
  return colour
}

/** What axe finds and `KNOWN` does not hold, one line per node: the rule, where, and what is wrong. */
async function audit(name: string): Promise<string[]> {
  const disabled = colourOf('--color-text-disabled')
  const { violations } = await axe.run(document.body, {
    runOnly: { type: 'tag', values: WCAG },
    resultTypes: ['violations'],
    elementRef: true,
  })
  return violations
    .flatMap((violation) =>
      violation.nodes
        // The text of a control that is switched off is outside the contrast criterion.
        .filter(
          (node) =>
            violation.id !== 'color-contrast' ||
            !node.element ||
            getComputedStyle(node.element).color !== disabled,
        )
        .map((node) => {
          const check = [...node.any, ...node.all, ...node.none][0]
          const where = [name, ...node.target.flat()].join(' >> ')
          return `${violation.id} @ ${where} :: ${check?.message ?? violation.help}`
        }),
    )
    .filter((line) => {
      const known = KNOWN.find((entry) => entry.test(line))
      if (known) seen.add(known)
      return !known
    })
}

beforeAll(() => {
  document.documentElement.lang = 'nl'
  Object.assign(document.body.style, {
    margin: '0',
    background: 'var(--color-bg-page)',
    color: 'var(--color-text-primary)',
    font: 'var(--text-ui)',
    fontFamily: 'var(--font-ui)',
  })
})

afterEach(() => {
  document.body.replaceChildren()
  requested.clear()
  vi.restoreAllMocks()
})

describe.each(MODES)('the style guide in %s', (mode) => {
  describe.each(VIEWPORTS)('at $name', ({ width, height }) => {
    beforeAll(async () => {
      document.documentElement.dataset.mode = mode
      document.documentElement.dataset.theme = 'rijksoverheid'
      await page.viewport(width, height)
    })

    it.each(ELEMENTS.map((item) => [nameOf(item), item] as const))('%s', async (name, item) => {
      const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
      draw(item)
      await settle()
      drawn++

      const undefinedTags = deep(document.body)
        .filter(
          (element) => element.localName.startsWith('lintje-') && !element.matches(':defined'),
        )
        .map((element) => element.localName)
      expect.soft(undefinedTags, `tags without a definition: ${undefinedTags}`).toHaveLength(0)
      const logged = errors.mock.calls.map((call) => call.map(String).join(' '))
      expect.soft(logged, `console.error: ${logged.join(' | ')}`).toHaveLength(0)
      const missing = [...requested].filter(
        (icon) => icon !== NO_FILE_ON_PURPOSE && iconIsMissing(icon),
      )
      expect.soft(missing, `icons without a file: ${missing}`).toHaveLength(0)
      let found = await audit(name)
      // Halfway a transition is no state of the element: look again once it has landed.
      if (found.length) {
        await settle()
        found = await audit(name)
      }
      expect.soft(found, `axe:\n${found.join('\n')}`).toHaveLength(0)
    })
  })
})

describe('the known findings', () => {
  it('are all still found', ({ skip }) => {
    // A run of part of the style guide cannot say what is fixed.
    if (drawn < ELEMENTS.length * MODES.length * VIEWPORTS.length) skip()
    const fixed = KNOWN.filter((entry) => !seen.has(entry)).map(String)
    expect(
      fixed,
      `fixed, so take out of KNOWN and docs/OPEN_ISSUES.md:\n${fixed.join('\n')}`,
    ).toHaveLength(0)
  })
})
