/**
 * The shell in its default, top layout: the landmarks and the skip link, the logo's link home,
 * the navigation's links and what a click on one sends, a group and its submenu, the environment,
 * the parts on the right only when the data asks for them, the slots, and the heading outline:
 * the name is the one `h1`, the page header's title the `h2`. happy-dom draws the desktop markup
 * at its default width; the phone is tested at 390 px. The side layout, "Weergave" and the
 * mobile menu are in `shell-parts.test.ts`.
 */
import { afterEach, describe, expect, it } from 'vitest'
import './shell'
import '../page-header/page-header'
import type { LintjeShell } from './shell'
import type { LintjePageHeader } from '../page-header/page-header'
import type { ShellData } from '../../../types'

const DATA: ShellData = {
  name: 'Transcriptie',
  navigation: [
    { label: 'Opnames', href: '/opnames', active: true },
    { label: 'Wachtrij', href: '/wachtrij' },
    { label: 'Woordenlijst', href: '/woordenlijst' },
  ],
  user: { name: 'J. de Vries', role: 'Teamleider', initials: 'JV' },
  userMenu: [{ value: 'sneltoetsen', label: 'Sneltoetsen' }],
  logout: { href: '/auth/logout', token: 'abc' },
  search: true,
  notifications: [{ id: 'n1', title: 'Transcriptie klaar', when: 'zojuist', unread: true }],
}

afterEach(() => {
  document.body.innerHTML = ''
})

async function mount(data: ShellData | null = DATA): Promise<LintjeShell> {
  const element = document.createElement('lintje-shell')
  element.innerHTML = '<lintje-page-header slot="header"></lintje-page-header><p>Inhoud</p>'
  element.querySelector<LintjePageHeader>('lintje-page-header')!.data = { title: 'Teamoverleg' }
  element.data = data
  document.body.append(element)
  await element.updateComplete
  return element
}

describe('lintje-shell', () => {
  it('draws nothing without data', async () => {
    const element = await mount(null)
    expect(element.shadowRoot!.querySelector('.lintje-shell')).toBeNull()
  })

  it('has the landmarks, the skip link first, and the three slots in main', async () => {
    const element = await mount()
    const root = element.shadowRoot!
    const first = root.querySelector('.lintje-shell--top')!.firstElementChild!
    expect(first.textContent!.trim()).toBe('Naar de inhoud')
    expect(root.querySelector('.lintje-logobar lintje-logo')!.hasAttribute('full')).toBe(true)
    expect(root.querySelector('nav')!.getAttribute('aria-label')).toBe('Hoofdnavigatie')
    // The top layout has no top bar and no side menu.
    expect(root.querySelector('.lintje-top-bar, .lintje-nav')).toBeNull()
    const main = root.querySelector('main')!
    expect(main.querySelector('slot[name="header"]')).not.toBeNull()
    expect(main.querySelector('slot:not([name])')).not.toBeNull()
    // A hero or a filter bar runs edge to edge: in main, but outside the padded content column.
    const full = main.querySelector('slot[name="full"]')!
    expect(full.parentElement).toBe(main)
    expect(full.closest('.lintje-shell__content')).toBeNull()

    ;(first as HTMLAnchorElement).click()
    expect(root.activeElement).toBe(main)
  })

  it('links the logo to home and sends a plain click on it as lintje-navigate', async () => {
    const element = await mount({ ...DATA, home: '/' })
    const home = element.shadowRoot!.querySelector<HTMLAnchorElement>('a.lintje-logobar__home')!
    expect(home.getAttribute('href')).toBe('/')
    expect(home.getAttribute('aria-label')).toBe('Naar de startpagina')
    const sent: unknown[] = []
    element.addEventListener('lintje-navigate', (event) => sent.push((event as CustomEvent).detail))
    home.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))
    expect(sent).toEqual([{ href: '/' }])

    const bare = await mount()
    expect(bare.shadowRoot!.querySelector('.lintje-logobar__home')).toBeNull()
    expect(bare.shadowRoot!.querySelector('.lintje-logobar lintje-logo')).not.toBeNull()
  })

  it('marks the active page and sends a plain click as lintje-navigate', async () => {
    const element = await mount()
    const links = [
      ...element.shadowRoot!.querySelectorAll<HTMLAnchorElement>('a.lintje-navbar__entry'),
    ]
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/opnames',
      '/wachtrij',
      '/woordenlijst',
    ])
    expect(links.map((link) => link.getAttribute('aria-current'))).toEqual(['page', null, null])

    const sent: unknown[] = []
    element.addEventListener('lintje-navigate', (event) => sent.push((event as CustomEvent).detail))
    const plain = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    links[1].dispatchEvent(plain)
    const modified = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      button: 0,
      ctrlKey: true,
    })
    links[2].dispatchEvent(modified)
    expect(plain.defaultPrevented).toBe(false)
    expect(modified.defaultPrevented).toBe(false)
    expect(sent).toEqual([{ href: '/wachtrij' }])
  })

  it('closes "Weergave" and "Delen" on another page, not on new data for the same page', async () => {
    const element = await mount({ ...DATA, share: true })
    element.viewOpen = true
    element.data = { ...DATA, share: true }
    await element.updateComplete
    expect(element.viewOpen).toBe(true)

    element.viewOpen = false
    element.shareOpen = true
    await element.updateComplete
    element.data = {
      ...DATA,
      share: true,
      navigation: DATA.navigation.map((link) => ({
        ...link,
        active: (link as { href?: string }).href === '/wachtrij',
      })),
    }
    await element.updateComplete
    expect(element.shareOpen).toBe(false)
  })

  it('draws search, the bell and the user menu only when the data asks for them', async () => {
    const full = await mount()
    const root = full.shadowRoot!
    let opened = 0
    full.addEventListener('lintje-search-open', () => opened++)
    root.querySelector<HTMLButtonElement>('button[aria-label="Zoeken"]')!.click()
    expect(opened).toBe(1)
    expect(root.querySelector('lintje-notifications')!.items).toHaveLength(1)
    const menu = root.querySelector('lintje-user-menu')!
    expect(menu.user?.initials).toBe('JV')
    expect(menu.getAttribute('logout-action')).toBe('/auth/logout')
    expect(menu.inline).toBe(false)

    const bare = await mount({ navigation: DATA.navigation })
    const bareRoot = bare.shadowRoot!
    expect(bareRoot.querySelector('button[aria-label="Zoeken"]')).toBeNull()
    expect(bareRoot.querySelector('lintje-notifications')).toBeNull()
    expect(bareRoot.querySelector('lintje-user-menu')).toBeNull()
    expect(bareRoot.querySelector('.lintje-shell__name')).toBeNull()
    expect(bareRoot.querySelector('.lintje-logobar__environment')).toBeNull()
  })

  it('shows the environment in the logo bar, with its short form beside it', async () => {
    const element = await mount({ ...DATA, environment: 'Acceptatie' })
    const block = element.shadowRoot!.querySelector('.lintje-logobar__environment')!
    expect(block.getAttribute('title')).toBe('Acceptatie')
    expect(block.querySelector('.lintje-logobar__environment-label')!.textContent).toBe(
      'Acceptatie',
    )
    expect(block.querySelector('.lintje-logobar__environment-short')!.textContent).toBe('Acc')
  })

  describe('a group', () => {
    const GROUPED: ShellData = {
      navigation: [
        { label: 'Overzicht', href: '/' },
        {
          label: 'Beheer',
          links: [
            { label: 'Woordenlijst', href: '/woordenlijst', icon: 'op-kantoor-boek', active: true },
            { label: 'Gebruikers', href: '/gebruikers', badge: { value: 3, tone: 'action' } },
          ],
        },
        { label: 'Hulp', href: '/hulp' },
      ],
    }
    const trigger = (element: LintjeShell): HTMLButtonElement =>
      element.shadowRoot!.querySelector<HTMLButtonElement>('button.lintje-navbar__entry')!
    const press = (button: HTMLButtonElement): boolean =>
      button.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, detail: 0 }))

    it('is a button between the links, marked when one of its pages is the active one', async () => {
      const element = await mount(GROUPED)
      const entries = [...element.shadowRoot!.querySelectorAll('.lintje-navbar__entry')]
      expect(entries.map((entry) => entry.tagName)).toEqual(['A', 'BUTTON', 'A'])
      const button = trigger(element)
      expect(button.textContent!.trim()).toBe('Beheer')
      expect(button.getAttribute('aria-expanded')).toBe('false')
      expect(button.classList.contains('is-active')).toBe(true)
      expect(element.shadowRoot!.querySelector('.lintje-navbar__submenu')).toBeNull()
      expect(element.shadowRoot!.querySelector('.lintje-header-scrim')).toBeNull()
    })

    it('opens its submenu named by its entry, the pages as links and the veil over the page', async () => {
      const element = await mount(GROUPED)
      press(trigger(element))
      await element.updateComplete
      const root = element.shadowRoot!
      const button = trigger(element)
      expect(button.getAttribute('aria-expanded')).toBe('true')
      const panel = root.querySelector('.lintje-navbar__submenu')!
      expect(panel.id).toBe(button.getAttribute('aria-controls'))
      expect(panel.querySelector('ul')!.getAttribute('aria-labelledby')).toBe(button.id)
      expect(button.textContent!.trim()).toBe('Beheer')
      const pages = [...panel.querySelectorAll<HTMLAnchorElement>('a.lintje-navbar__page')]
      expect(pages.map((page) => page.getAttribute('href'))).toEqual([
        '/woordenlijst',
        '/gebruikers',
      ])
      expect(pages.map((page) => page.getAttribute('aria-current'))).toEqual(['page', null])
      expect(pages[1].querySelector('.lintje-badge')!.textContent!.trim()).toBe('3')
      expect(root.querySelector('.lintje-header-scrim')).not.toBeNull()
    })

    it('closes on Escape with the focus back on its button, and on a click outside the bar', async () => {
      const element = await mount(GROUPED)
      trigger(element).focus()
      press(trigger(element))
      await element.updateComplete
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      await element.updateComplete
      expect(element.shadowRoot!.querySelector('.lintje-navbar__submenu')).toBeNull()
      expect(element.shadowRoot!.activeElement).toBe(trigger(element))

      press(trigger(element))
      await element.updateComplete
      expect(element.shadowRoot!.querySelector('.lintje-navbar__submenu')).not.toBeNull()
      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))
      await element.updateComplete
      expect(element.shadowRoot!.querySelector('.lintje-navbar__submenu')).toBeNull()
    })

    it('closes on Escape without taking the focus when it was opened by the pointer', async () => {
      const element = await mount(GROUPED)
      const elsewhere = document.createElement('button')
      document.body.append(elsewhere)
      elsewhere.focus()
      trigger(element).dispatchEvent(new MouseEvent('mouseenter'))
      await element.updateComplete
      expect(element.shadowRoot!.querySelector('.lintje-navbar__submenu')).not.toBeNull()
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      await element.updateComplete
      expect(element.shadowRoot!.querySelector('.lintje-navbar__submenu')).toBeNull()
      expect(document.activeElement).toBe(elsewhere)
    })

    it('gives the focus back to its button on Escape from a page inside it', async () => {
      const element = await mount(GROUPED)
      press(trigger(element))
      await element.updateComplete
      element.shadowRoot!.querySelector<HTMLAnchorElement>('a.lintje-navbar__page')!.focus()
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      await element.updateComplete
      expect(element.shadowRoot!.activeElement).toBe(trigger(element))
    })

    it('stays open under a click of the pointer, which has opened it already', async () => {
      const element = await mount(GROUPED)
      trigger(element).dispatchEvent(new MouseEvent('mouseenter'))
      await element.updateComplete
      expect(trigger(element).getAttribute('aria-expanded')).toBe('true')
      trigger(element).dispatchEvent(
        new MouseEvent('click', { bubbles: true, composed: true, detail: 1 }),
      )
      await element.updateComplete
      expect(trigger(element).getAttribute('aria-expanded')).toBe('true')
    })

    it('sends a page as lintje-navigate and closes', async () => {
      const element = await mount(GROUPED)
      press(trigger(element))
      await element.updateComplete
      const sent: unknown[] = []
      element.addEventListener('lintje-navigate', (event) =>
        sent.push((event as CustomEvent).detail),
      )
      const page =
        element.shadowRoot!.querySelectorAll<HTMLAnchorElement>('a.lintje-navbar__page')[1]
      const click = new MouseEvent('click', {
        bubbles: true,
        composed: true,
        cancelable: true,
        button: 0,
      })
      page.dispatchEvent(click)
      await element.updateComplete
      expect(click.defaultPrevented).toBe(false)
      expect(sent).toEqual([{ href: '/gebruikers' }])
      expect(element.shadowRoot!.querySelector('.lintje-navbar__submenu')).toBeNull()
    })
  })
})

const viewport = (width: number): void =>
  (
    window as unknown as { happyDOM: { setViewport(size: { width: number }): void } }
  ).happyDOM.setViewport({ width })

/**
 * Every heading in document order, through shadow roots and into slotted children. A closed
 * popover draws no slot, so what stands in it (the bell's panel) is not on the page.
 */
function outline(node: Element): string[] {
  if (node.matches('lintje-popover:not([open])')) return []
  const own = /^H[1-6]$/.test(node.tagName) ? [`${node.tagName}:${node.textContent?.trim()}`] : []
  const children = [...(node.shadowRoot?.children ?? []), ...node.children]
  return [...own, ...children.flatMap((child) => outline(child))]
}

/** The light DOM is walked after the shadow root, so a slotted heading lands in `main`'s place. */
async function headings(element: LintjeShell): Promise<string[]> {
  const header = element.querySelector<LintjePageHeader>('lintje-page-header')
  await Promise.all([element.updateComplete, header?.updateComplete])
  return outline(element)
}

describe('the heading outline', () => {
  afterEach(() => viewport(1024))

  it('makes the name the one h1 in the navigation bar, the page title an h2', async () => {
    const element = await mount()
    const name = element.shadowRoot!.querySelector('.lintje-navbar .lintje-shell__name')!
    expect(name.tagName).toBe('H1')
    // The name starts the bar, before the entries.
    expect(name.parentElement!.classList.contains('lintje-navbar__start')).toBe(true)
    expect(name.nextElementSibling!.classList.contains('lintje-navbar__entries')).toBe(true)
    expect(await headings(element)).toEqual(['H1:Transcriptie', 'H2:Teamoverleg'])
  })

  it('keeps the name as the one h1 in the mobile header below 768 px', async () => {
    const element = await mount()
    viewport(390)
    await element.updateComplete
    const name = element.shadowRoot!.querySelector(
      '.lintje-shell__mobile-bar .lintje-mobile-header h1',
    )!
    expect(name.textContent).toBe('Transcriptie')
    expect(element.shadowRoot!.querySelector('.lintje-navbar')).toBeNull()
    expect(await headings(element)).toEqual(['H1:Transcriptie', 'H2:Teamoverleg'])
  })

  it('draws no h1 without a name, at either width', async () => {
    const element = await mount({ navigation: DATA.navigation })
    expect(await headings(element)).toEqual(['H2:Teamoverleg'])
    viewport(390)
    await element.updateComplete
    expect(await headings(element)).toEqual(['H2:Teamoverleg'])
  })
})
