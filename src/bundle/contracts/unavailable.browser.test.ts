/**
 * An entry that cannot be chosen stays as it is under the pointer: no fill, no underline, no
 * other colour, in both house styles. An entry that can be chosen does answer the pointer. A
 * window's close button while the window is busy is such an entry.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import '../../components/frame/sub-nav/sub-nav'
import type { LintjeSubNav } from '../../components/frame/sub-nav/sub-nav'
import '../../components/overlays/dialog/dialog'
import '../../components/overlays/drawer/drawer'

interface Row {
  name: string
  mount: () => Promise<HTMLElement>
  /** The entry the pointer rests on. */
  entry: (element: HTMLElement) => HTMLElement
  /** The word inside it that a hover underlines. */
  label: (entry: HTMLElement) => HTMLElement
  /** Whether the entry can be chosen. */
  available: boolean
  /** The line under the word, which a hover leaves as it is. */
  line?: string
}

const frame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()))

async function subNav(): Promise<LintjeSubNav> {
  const element = document.createElement('lintje-sub-nav')
  element.label = 'In dit onderdeel'
  element.groups = [
    {
      items: [
        { label: 'Overzicht', href: '#overzicht', active: true },
        { label: 'Aanvragen', href: '#aanvragen' },
        { label: 'Rapporten' },
        { label: 'Beheer', href: '#beheer', noAccess: true },
      ],
    },
  ]
  document.body.append(element)
  await element.updateComplete
  return element
}

const subNavEntry =
  (index: number) =>
  (element: HTMLElement): HTMLElement =>
    element.shadowRoot!.querySelectorAll<HTMLElement>('.lintje-sub-nav__link')[index]
const subNavLabel = (entry: HTMLElement): HTMLElement =>
  entry.querySelector<HTMLElement>('.lintje-sub-nav__label')!

/** A window open on the page, busy or not; the pointer rests on its close button. */
function openWindow(
  tag: 'lintje-dialog' | 'lintje-drawer',
  busy: boolean,
): () => Promise<HTMLElement> {
  return async () => {
    const element = Object.assign(document.createElement(tag), { heading: 'Aanvraag', busy })
    document.body.append(element)
    element.open = true
    await element.updateComplete
    return element
  }
}

const closeButton =
  (selector: string) =>
  (element: HTMLElement): HTMLElement =>
    element.shadowRoot!.querySelector<HTMLElement>(selector)!
// The ✕ has no word; the button stands in for it.
const itself = (entry: HTMLElement): HTMLElement => entry

const WINDOWS: Row[] = (['lintje-dialog', 'lintje-drawer'] as const).flatMap((tag) =>
  [false, true].map((busy) => ({
    name: `${tag} :: sluitknop${busy ? ' terwijl bezig' : ''}`,
    mount: openWindow(tag, busy),
    entry: closeButton(`.${tag}__close`),
    label: itself,
    available: !busy,
    line: 'none',
  })),
)

const ROWS: Row[] = [
  ...WINDOWS,
  {
    name: 'lintje-sub-nav :: met pagina',
    mount: subNav,
    entry: subNavEntry(1),
    label: subNavLabel,
    available: true,
  },
  {
    name: 'lintje-sub-nav :: zonder pagina',
    mount: subNav,
    entry: subNavEntry(2),
    label: subNavLabel,
    available: false,
    line: 'none',
  },
  {
    name: 'lintje-sub-nav :: zonder toegang',
    mount: subNav,
    entry: subNavEntry(3),
    label: subNavLabel,
    available: false,
    line: 'line-through',
  },
]

afterEach(() => {
  delete document.documentElement.dataset.styleVersion
  document.body.replaceChildren()
})

/** What a hover may change: the fill and colour of the entry, the line under its word. */
function look(entry: HTMLElement, label: HTMLElement): string[] {
  const box = getComputedStyle(entry)
  return [box.backgroundColor, box.color, getComputedStyle(label).textDecorationLine]
}

describe.each(ROWS)('$name', (row) => {
  it.each(['classic', 'new'] as const)('under the pointer, in the %s style', async (style) => {
    if (style === 'new') document.documentElement.dataset.styleVersion = 'new'
    const element = await row.mount()
    const entry = row.entry(element)
    const label = row.label(entry)
    await userEvent.hover(document.body, { position: { x: 1, y: 1 } })
    await frame()
    const before = look(entry, label)
    // The word, not the link: a locator by the link's name misreads its bold room.
    await userEvent.hover(label)
    await frame()
    const after = look(entry, label)
    if (row.available) {
      expect(after).not.toEqual(before)
    } else {
      expect(after).toEqual(before)
      expect(after[2]).toBe(row.line)
    }
  })
})
