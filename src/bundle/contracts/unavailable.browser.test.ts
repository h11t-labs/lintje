/**
 * An entry that cannot be chosen stays as it is under the pointer: no fill, no underline, no
 * other colour, in both house styles. An entry that can be chosen does answer the pointer. A
 * window's close button while the window is busy is such an entry.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import '../../components/frame/shell/shell'
import '../../components/frame/sub-nav/sub-nav'
import type { LintjeShell } from '../../components/frame/shell/shell'
import type { LintjeSubNav } from '../../components/frame/sub-nav/sub-nav'
import '../../components/overlays/dialog/dialog'
import '../../components/overlays/drawer/drawer'
import type { ShellLink } from '../../types'

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
  /** Where the pointer rests before: the page, or what keeps the entry in view. */
  rest?: (element: HTMLElement) => HTMLElement
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

const LINKS: ShellLink[] = [
  { label: 'Overzicht', href: '#overzicht', active: true },
  { label: 'Aanvragen', href: '#aanvragen' },
  { label: 'Rapporten' },
  { label: 'Beheer', href: '#beheer', noAccess: true },
]

async function shell(layout: 'top' | 'side', grouped = false): Promise<LintjeShell> {
  await page.viewport(1440, 900)
  const element = document.createElement('lintje-shell')
  element.data = {
    name: 'Dashboard Vergunningen',
    layout,
    navigation: grouped
      ? [
          { label: 'Start', href: '#start', active: true },
          { label: 'Onderdelen', links: LINKS },
        ]
      : LINKS,
  }
  document.body.append(element)
  await element.updateComplete
  return element
}

const within =
  (selector: string, index: number) =>
  (element: HTMLElement): HTMLElement =>
    element.shadowRoot!.querySelectorAll<HTMLElement>(selector)[index]
const navbarLabel = (entry: HTMLElement): HTMLElement =>
  entry.querySelector<HTMLElement>('.lintje-navbar__label')!
// The side menu draws its lines on the row itself; a ✕ has no word, the button stands in for it.
const itself = (entry: HTMLElement): HTMLElement => entry
const groupButton = within('button.lintje-navbar__entry', 0)

const shellRows = (
  name: string,
  mount: () => Promise<HTMLElement>,
  selector: string,
  label: (entry: HTMLElement) => HTMLElement,
  lines: [string, string],
  rest?: (element: HTMLElement) => HTMLElement,
): Row[] => [
  {
    name: `${name} :: met pagina`,
    mount,
    entry: within(selector, 1),
    label,
    available: true,
    rest,
  },
  {
    name: `${name} :: zonder pagina`,
    mount,
    entry: within(selector, 2),
    label,
    available: false,
    line: lines[0],
    rest,
  },
  {
    name: `${name} :: zonder toegang`,
    mount,
    entry: within(selector, 3),
    label,
    available: false,
    line: lines[1],
    rest,
  },
]

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
  ...shellRows('lintje-shell :: balk', () => shell('top'), '.lintje-navbar__entry', navbarLabel, [
    'none',
    'line-through',
  ]),
  ...shellRows(
    'lintje-shell :: groep in de balk',
    () => shell('top', true),
    '.lintje-navbar__page',
    navbarLabel,
    ['none', 'line-through'],
    groupButton,
  ),
  ...shellRows('lintje-shell :: zijmenu', () => shell('side'), '.lintje-nav__item', itself, [
    'none',
    'line-through',
  ]),
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
    // A page in a group of the bar is drawn once the group opens.
    if (row.rest) await userEvent.hover(row.rest(element))
    else await userEvent.hover(document.body, { position: { x: 1, y: 1 } })
    await (element as LintjeShell).updateComplete
    await frame()
    const entry = row.entry(element)
    const label = row.label(entry)
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
