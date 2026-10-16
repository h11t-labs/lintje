/**
 * Text cut with an ellipsis: with a pointer it stands on one line and its whole words in the
 * `title`; under the keyboard's focus and on a phone it wraps whole and stays inside its parent.
 * Text that never has a pointer to show a `title` is never cut.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { deepActiveElement } from '../../core/focus'
import '../../components/actions/button/button'
import '../../components/actions/menu-button/menu-button'
import '../../components/tables/data-table/data-table'
import '../../components/tables/list/list'
import type { DataTableData } from '../../types'

/**
 * How the whole text reaches a pointer: `measured` sets the `title` when the pointer finds the
 * text cut and none when it fits; `always` has it whatever the width; `never` is never cut.
 */
type Title = 'measured' | 'always' | 'never'

interface Row {
  name: string
  title: Title
  /** Puts the element on the page, holding `words` in a room too narrow for a long text. */
  mount: (words: string) => Promise<HTMLElement>
  /** The text that is cut. */
  text: (element: HTMLElement) => HTMLElement
  /** What takes the keyboard's focus; a `never` row needs none. */
  focus?: (element: HTMLElement) => HTMLElement
  /** What the element stays inside at 390 and 320 px. */
  room: (element: HTMLElement) => HTMLElement
}

/**
 * The rows that fail today, by name; each has its GitHub issue above it. A row that passes while
 * it matches an entry fails, so the fix takes its entry out.
 */
const KNOWN: RegExp[] = []

const LONG = 'Wijzigingen in de aanvraag opslaan en doorsturen naar de behandelaar van het loket'
const SHORT = 'Opslaan'

/* Helpers ----------------------------------------------------------------- */

const frame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()))

async function append<T extends HTMLElement>(
  element: T,
  parent: HTMLElement = document.body,
): Promise<T> {
  parent.append(element)
  await (element as T & { updateComplete?: Promise<unknown> }).updateComplete
  await frame()
  return element
}

/** A block on the page for an element to sit in: `width` wide, or the screen where that is less. */
function room(width: number): HTMLElement {
  const block = document.createElement('div')
  block.style.width = `${width}px`
  block.style.maxWidth = '100%'
  document.body.append(block)
  return block
}

const inShadow = (element: Element, selector: string): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>(selector)!

/** The first drawn match: a table has a wide and a phone form. */
function shown(element: Element, selector: string): HTMLElement {
  const matches = [...element.shadowRoot!.querySelectorAll<HTMLElement>(selector)]
  return matches.find((match) => match.getBoundingClientRect().width > 0) ?? matches[0]!
}

const cut = (text: HTMLElement): boolean => text.scrollWidth > text.clientWidth

function lines(text: HTMLElement): number {
  const height = parseFloat(getComputedStyle(text).lineHeight)
  return Math.round(text.getBoundingClientRect().height / height)
}

function inside(element: Element, parent: Element): boolean {
  const box = element.getBoundingClientRect()
  const outer = parent.getBoundingClientRect()
  return box.left >= outer.left - 1 && box.right <= outer.right + 1
}

async function viewport(width: number, height: number): Promise<void> {
  await page.viewport(width, height)
  // WebKit resizes the frame after `viewport()` resolves.
  await expect.poll(() => window.innerWidth).toBe(width)
}

/** A focus from the keyboard: after a key press a focus moved by script is one. */
async function keyboardFocus(target: HTMLElement): Promise<void> {
  const start = Object.assign(document.createElement('input'), { ariaLabel: 'Zoeken' })
  document.body.prepend(start)
  start.focus()
  await userEvent.keyboard('{Shift}')
  target.focus()
  await expect
    .poll(() => deepActiveElement()?.matches(':focus-visible') ?? false, {
      message: 'a keyboard focus',
    })
    .toBe(true)
}

/* Rows -------------------------------------------------------------------- */

function table(data: Partial<DataTableData>, width: number) {
  return async (words: string): Promise<HTMLElement> => {
    const element = document.createElement('lintje-data-table') as HTMLElement & {
      data: DataTableData
    }
    element.data = {
      caption: 'Loketten met een toelichting',
      rowKey: 'name',
      columns: [],
      rows: [],
      ...data,
    }
    element.data = JSON.parse(JSON.stringify(element.data).replaceAll('{words}', words))
    return append(element, room(width))
  }
}

const ROWS: Row[] = [
  {
    name: 'lintje-button',
    title: 'measured',
    mount: (words) =>
      append(
        Object.assign(document.createElement('lintje-button'), { textContent: words }),
        room(240),
      ),
    text: (element) => inShadow(element, '.lintje-button__label'),
    focus: (element) => element,
    room: (element) => element.parentElement!,
  },
  {
    name: 'lintje-menu-button :: trigger',
    title: 'measured',
    mount: (words) =>
      append(
        Object.assign(document.createElement('lintje-menu-button'), {
          label: words,
          items: [{ label: 'Bewaren', value: 'bewaren' }],
        }),
        room(240),
      ),
    text: (element) => inShadow(element, '.lintje-menu-button__trigger .lintje-button__label'),
    focus: (element) => inShadow(element, '.lintje-menu-button__trigger'),
    room: (element) => element.parentElement!,
  },
  {
    name: 'lintje-data-table :: truncate column',
    title: 'always',
    mount: table(
      {
        clickable: true,
        columns: [
          { key: 'name', header: 'Loket' },
          { key: 'note', header: 'Toelichting', truncate: true },
          { key: 'requests', header: 'Aanvragen' },
        ],
        rows: [{ name: 'Utrecht', note: '{words}', requests: 12 }],
      },
      900,
    ),
    text: (element) => shown(element, '.lintje-data-table__cell-text'),
    focus: (element) => shown(element, '.lintje-data-table__cell-text').closest('tr')!,
    room: (element) => element,
  },
  {
    name: 'lintje-data-table :: filter chip',
    title: 'never',
    mount: table(
      {
        columns: [
          { key: 'name', header: 'Loket', filter: { kind: 'text' } },
          { key: 'requests', header: 'Aanvragen' },
        ],
        rows: [{ name: 'Utrecht', requests: 12 }],
        filters: { name: '{words}' },
      },
      900,
    ),
    text: (element) => inShadow(element, '.lintje-data-table__chip'),
    room: (element) => element,
  },
  {
    name: 'lintje-list :: title',
    title: 'always',
    mount: (words) =>
      append(
        Object.assign(document.createElement('lintje-list'), {
          items: [{ id: 'l', title: words, meta: '10:12' }],
        }),
        room(320),
      ),
    text: (element) => inShadow(element, '.lintje-list__title'),
    focus: (element) => inShadow(element, '.lintje-list__title'),
    room: (element) => element.parentElement!,
  },
  {
    name: 'lintje-list :: title of a row that opens nothing, its action focused',
    title: 'always',
    mount: (words) =>
      append(
        Object.assign(document.createElement('lintje-list'), {
          items: [
            {
              id: 'l',
              title: words,
              clickable: false,
              action: { label: 'Annuleren', value: 'annuleren' },
            },
          ],
        }),
        room(480),
      ),
    text: (element) => inShadow(element, '.lintje-list__title'),
    focus: (element) => inShadow(element, 'lintje-button'),
    room: (element) => element.parentElement!,
  },
]

/* The contract ------------------------------------------------------------ */

beforeAll(() => {
  document.documentElement.lang = 'nl'
  document.body.style.margin = '0'
})

afterEach(async () => {
  await viewport(1440, 900)
  document.body.replaceChildren()
})

async function onPhones(row: Row, element: HTMLElement): Promise<void> {
  for (const [width, height] of [
    [390, 844],
    [320, 640],
  ] as const) {
    await viewport(width, height)
    await expect
      .poll(() => cut(row.text(element)), { message: `not cut at ${width} px` })
      .toBe(false)
    expect(inside(element, row.room(element)), `inside its parent at ${width} px`).toBe(true)
    expect(inside(row.text(element), row.room(element)), `the text inside at ${width} px`).toBe(
      true,
    )
  }
}

async function check(row: Row): Promise<void> {
  if (row.title === 'never') {
    const element = await row.mount(LONG)
    expect(cut(row.text(element)), 'not cut at 1440 px').toBe(false)
    await userEvent.hover(row.text(element))
    expect(row.text(element).hasAttribute('title'), 'no title').toBe(false)
    await onPhones(row, element)
    return
  }

  const element = await row.mount(LONG)
  const text = row.text(element)
  expect(cut(text), 'cut at 1440 px').toBe(true)
  expect(lines(text), 'one line at 1440 px').toBe(1)
  await userEvent.hover(text)
  await expect.poll(() => text.title, { message: 'the whole text as title' }).toBe(LONG)

  await keyboardFocus(row.focus!(element))
  await expect.poll(() => cut(text), { message: 'not cut under the focus' }).toBe(false)
  expect(lines(text), 'more than one line under the focus').toBeGreaterThan(1)
  ;(deepActiveElement() as HTMLElement | null)?.blur()
  document.body.querySelector('input')?.remove()

  await onPhones(row, element)

  if (row.title === 'measured') {
    document.body.replaceChildren()
    await viewport(1440, 900)
    const fits = await row.mount(SHORT)
    await userEvent.hover(row.text(fits))
    expect(row.text(fits).hasAttribute('title'), 'no title on a text that fits').toBe(false)
  }
}

describe('text cut with an ellipsis', () => {
  for (const row of ROWS) {
    it(row.name, async () => {
      const known = KNOWN.find((entry) => entry.test(row.name))
      try {
        await check(row)
      } catch (error) {
        if (known) return
        throw error
      }
      if (known) expect.fail(`passes: take ${known} out of KNOWN`)
    })
  }

  it('has no KNOWN entry that matches no row', () => {
    const names = ROWS.map((row) => row.name)
    const stale = KNOWN.filter((entry) => !names.some((name) => entry.test(name))).map(String)
    expect(stale, `matches no row, so take out of KNOWN:\n${stale.join('\n')}`).toHaveLength(0)
  })
})
