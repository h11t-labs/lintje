/**
 * The shared header's navigation bar, drawn straight from its render function: what an entry
 * and a page in a submenu look like in each state the menu knows — a page, no page yet, no
 * access — and that a group without a heading puts its entries in the bar.
 */
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import { render } from 'lit'
import { WHOLE_MENU, renderNavBar, type NavBarOptions, type NavGroup } from './header'

const GROUPS: NavGroup[] = [
  { items: [{ label: 'Overzicht', icon: 'functioneel-home', href: '/' }] },
  {
    heading: 'Aanvragen',
    items: [
      { label: 'Nieuw', icon: 'functioneel-plus', href: '/nieuw', active: true },
      { label: 'Wachtrij', icon: 'functioneel-klok', badge: { value: 'Nieuw', tone: 'new' } },
      { label: 'Bezwaren', icon: 'functioneel-mail', href: '/bezwaren', noAccess: true },
    ],
  },
]

const headerCss = readFileSync('src/components/frame/shell/header.css', 'utf8')

afterEach(() => {
  document.body.innerHTML = ''
})

function draw(overrides: Partial<NavBarOptions> = {}): HTMLElement {
  const root = document.createElement('div')
  document.body.append(root)
  render(
    renderNavBar({
      id: 'nav',
      groups: GROUPS,
      open: null,
      onNavigate: () => {},
      onOpen: () => {},
      ...overrides,
    }),
    root,
  )
  return root
}

describe('renderNavBar', () => {
  it('puts a group without a heading in the bar as links, a group with one as a button', () => {
    const root = draw()
    const entries = [...root.querySelectorAll('.lintje-navbar__entry')]
    expect(entries.map((entry) => [entry.tagName, entry.textContent!.trim()])).toEqual([
      ['A', 'Overzicht'],
      ['BUTTON', 'Aanvragen'],
    ])
    // The bar's own entries are words: no icon, though the data names one.
    expect(entries[0].querySelector('.lintje-icon')).toBeNull()
    expect(entries[1].classList.contains('is-active')).toBe(true)
    expect(root.querySelector('nav')!.getAttribute('aria-label')).toBe('Hoofdnavigatie')
  })

  it('draws a page, a page that is not there yet and a page without access', () => {
    const root = draw({ open: 1 })
    const pages = [...root.querySelectorAll('.lintje-navbar__page')]
    expect(pages.map((page) => page.tagName)).toEqual(['A', 'SPAN', 'SPAN'])
    expect(pages[0].getAttribute('href')).toBe('/nieuw')
    expect(pages[0].getAttribute('aria-current')).toBe('page')
    // A page is a block: its name, bold, over its figure when the data has one.
    expect(pages[0].querySelector('.lintje-navbar__page-text .lintje-navbar__label')).not.toBeNull()
    expect(pages[0].querySelector('.lintje-navbar__metric')).toBeNull()

    expect(pages[1].getAttribute('aria-disabled')).toBe('true')
    expect(pages[1].classList.contains('is-no-access')).toBe(false)
    expect(pages[1].querySelector('.lintje-badge')!.textContent!.trim()).toBe('Nieuw')
    // aria-disabled means nothing on a span: the words say it, not the muted colour alone.
    expect(pages[1].querySelector('.visually-hidden')!.textContent).toBe(', niet beschikbaar')

    // No access is said in words too, not by the strikethrough alone.
    expect(pages[2].classList.contains('is-no-access')).toBe(true)
    expect(pages[2].getAttribute('aria-disabled')).toBe('true')
    expect(pages[2].querySelector('[aria-label="Geen toegang"]')).not.toBeNull()

    const list = root.querySelector('.lintje-navbar__pages')!
    // The open entry is the list's name: the panel has no heading of its own.
    const entry = root.querySelector('button.lintje-navbar__entry')!
    expect(list.getAttribute('aria-labelledby')).toBe(entry.id)
    expect(root.querySelector('.lintje-navbar__heading')).toBeNull()
    // The blocks stand in a grid three wide.
    expect([...list.children].every((item) => item.className === 'lintje-navbar__item')).toBe(true)
    expect(headerCss).toMatch(
      /\.lintje-navbar__pages\s*\{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/,
    )
  })

  it('keeps the environment’s full name for a screen reader where a phone shows three letters', () => {
    // Below 768 px is the shell's `is-phone`.
    const label =
      /:where\(\.lintje-shell\.is-phone\) \.lintje-logobar__environment-label \{([^}]*)\}/.exec(
        headerCss,
      )?.[1] ?? ''
    expect(label).not.toContain('display: none')
    expect(label).toContain('clip: rect(0 0 0 0)')
  })

  it('keeps what stands in the bar and the submenu inside the content’s maximum width', () => {
    expect(headerCss).toMatch(/\.lintje-navbar \{[^}]*padding:[^;]*var\(--page-gutter\)/)
    expect(headerCss).toMatch(/\.lintje-navbar__submenu \{[^}]*padding:[^;]*var\(--page-gutter\)/)
  })

  it('asks to open on a click and on the pointer, and to close when the pointer leaves the bar', () => {
    const asked: (number | null)[] = []
    const root = draw({ onOpen: (index) => asked.push(index) })
    const button = root.querySelector<HTMLButtonElement>('button.lintje-navbar__entry')!
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }))
    button.dispatchEvent(new MouseEvent('mouseenter'))
    root.querySelector('.lintje-navbar')!.dispatchEvent(new MouseEvent('mouseleave'))
    expect(asked).toEqual([1, 1, null])
  })

  it('keeps the bar one row: what the fit is measured on stands apart from the outcome', () => {
    const css = headerCss.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(css).toMatch(/\.lintje-navbar \{[^}]*height: var\(--h-navbar\)/)
    expect(css).not.toMatch(/flex-wrap:\s*wrap/)
    // The room: what the start leaves, never sized by what stands in it.
    expect(css).toMatch(/\.lintje-navbar__entries \{[^}]*flex: 1 1 0;[^}]*min-width: 0/)
    // The need: the list's natural width, also while it is hidden.
    expect(css).toMatch(/\.lintje-navbar__list \{[^}]*width: max-content/)
    expect(css).toMatch(
      /\.lintje-navbar__list\.is-hidden \{[^}]*position: absolute[^}]*visibility: hidden/,
    )
    // A panel taller than the room under the bar scrolls inside itself.
    expect(css).toMatch(
      /\.lintje-navbar__submenu \{[^}]*max-height: var\(--lintje-navbar-room[^}]*overflow-y: auto/,
    )
  })
})

describe('renderNavBar, collapsed', () => {
  it('puts one "Menu" entry in the entries\u2019 place and keeps them out of sight and reach', () => {
    const root = draw({ collapsed: true })
    const list = root.querySelector('.lintje-navbar__list')!
    expect(list.classList.contains('is-hidden')).toBe(true)
    expect(list.hasAttribute('inert')).toBe(true)
    expect(list.getAttribute('aria-hidden')).toBe('true')
    const shown = [...root.querySelectorAll('.lintje-navbar__entry')].filter(
      (entry) => !list.contains(entry),
    )
    expect(shown.map((entry) => [entry.tagName, entry.textContent!.trim()])).toEqual([
      ['BUTTON', 'Menu'],
    ])
    const menu = shown[0]
    expect(menu.getAttribute('aria-expanded')).toBe('false')
    expect(menu.getAttribute('aria-controls')).toBe('nav-menu')
    expect(menu.querySelector('.lintje-icon')).not.toBeNull()
    // The reader's page is in the menu, yet "Menu" carries no edge: it nearly always would.
    expect(menu.classList.contains('is-active')).toBe(false)
  })

  it('opens one panel with the loose pages, then every headed group under its heading', () => {
    const root = draw({ collapsed: true, open: WHOLE_MENU })
    const panel = root.querySelector('#nav-menu')!
    expect(panel.classList.contains('lintje-navbar__submenu')).toBe(true)
    const menu = root.querySelector('#nav-menu-entry')!
    expect(menu.getAttribute('aria-expanded')).toBe('true')
    expect(menu.classList.contains('is-open')).toBe(true)
    const lists = [...panel.querySelectorAll('.lintje-navbar__pages')]
    expect(
      lists.map((list) =>
        [...list.querySelectorAll('.lintje-navbar__label')].map((l) => l.textContent),
      ),
    ).toEqual([['Overzicht'], ['Nieuw', 'Wachtrij', 'Bezwaren']])
    expect(lists[0].getAttribute('aria-labelledby')).toBe('nav-menu-entry')
    const heading = panel.querySelector('.lintje-navbar__heading')!
    expect(heading.textContent).toBe('Aanvragen')
    expect(lists[1].getAttribute('aria-labelledby')).toBe(heading.id)
    expect(heading.nextElementSibling).toBe(lists[1])
    // The hidden entries open nothing of their own.
    expect(root.querySelectorAll('.lintje-navbar__submenu')).toHaveLength(1)
  })

  it('opens the whole menu on a click only, and every click toggles it', () => {
    const asked: (number | null)[] = []
    const closed = draw({ collapsed: true, onOpen: (index) => asked.push(index) })
    const menu = closed.querySelector<HTMLButtonElement>('.lintje-navbar__entry--menu')!
    menu.dispatchEvent(new MouseEvent('mouseenter'))
    menu.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
    const open = draw({ collapsed: true, open: WHOLE_MENU, onOpen: (index) => asked.push(index) })
    const close = open.querySelector('.lintje-navbar__entry--menu')!
    expect(close.textContent!.trim()).toBe('Sluiten')
    open.querySelector('.lintje-navbar')!.dispatchEvent(new MouseEvent('mouseleave'))
    close.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
    close.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }))
    expect(asked).toEqual([WHOLE_MENU, null, null])
  })

  it('draws no "Menu" while the entries fit', () => {
    const root = draw()
    expect(root.querySelector('.lintje-navbar__entry--menu')).toBeNull()
    expect(root.querySelector('.lintje-navbar__list')!.hasAttribute('inert')).toBe(false)
  })
})
