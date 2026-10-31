/**
 * The tab bar below 768 px (`mobile-tabs`): which entries are tabs, what the menu's panel holds,
 * where each part of the shell stands, and what a tab says and sends.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import './shell'
import type { LintjeShell } from './shell'
import type { ShellData, ShellGroup, ShellLink } from '../../../types'
import { parseTabParts, planTabs } from './tab-bar'
import { setFrameState } from '../../../core/frame-state'
import { lockScroll } from '../../../core/host-config'

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver
})

const page = (label: string, extra: Partial<ShellLink> = {}): ShellLink => ({
  label,
  href: `/${label.toLowerCase()}`,
  icon: 'functioneel-home',
  ...extra,
})

const NAVIGATION: (ShellLink | ShellGroup)[] = [
  page('Zaken', { active: true, badge: { value: 12, tone: 'count', label: '12 open zaken' } }),
  page('Taken'),
  { label: 'Lagen', action: 'lagen', icon: 'functioneel-tegelweergave' },
  page('Agenda'),
  page('Correspondentie'),
  { label: 'Beheer', links: [page('Gebruikers')] },
]

const viewport = (width: number): void =>
  (
    window as unknown as { happyDOM: { setViewport(size: { width: number }): void } }
  ).happyDOM.setViewport({ width })

const mounted: LintjeShell[] = []

async function mount(attributes: Record<string, string> = {}, extra: Partial<ShellData> = {}) {
  const shell = document.createElement('lintje-shell')
  for (const [name, value] of Object.entries(attributes)) shell.setAttribute(name, value)
  shell.data = {
    name: 'Zaaksysteem',
    layout: 'side',
    navigation: NAVIGATION,
    search: true,
    ...extra,
  }
  document.body.append(shell)
  mounted.push(shell)
  await shell.updateComplete
  return shell
}

const root = (shell: LintjeShell): ShadowRoot => shell.shadowRoot as ShadowRoot
const tabs = (shell: LintjeShell): HTMLElement[] =>
  Array.from(root(shell).querySelectorAll<HTMLElement>('.lintje-tab-bar__tab'))
const labels = (shell: LintjeShell): string[] =>
  tabs(shell).map((tab) => tab.querySelector('.lintje-tab-bar__label')?.textContent ?? '')

afterEach(() => {
  for (const shell of mounted.splice(0)) shell.remove()
  viewport(1024)
  vi.restoreAllMocks()
})

describe('planning the tabs', () => {
  it('reads tab-parts: unset is Menu alone, empty is none, unknown names are left out', () => {
    expect(parseTabParts(undefined)).toEqual(['menu'])
    expect(parseTabParts('')).toEqual([])
    expect(parseTabParts('menu, search  foo')).toEqual(['search', 'menu'])
  })

  it('lets the parts claim their places and fills the rest with loose pages, up to five', () => {
    const plan = planTabs(NAVIGATION, ['menu'])
    expect(plan.pages.map((item) => item.label)).toEqual(['Zaken', 'Taken', 'Lagen', 'Agenda'])
    expect(plan.rest.map((entry) => entry.label)).toEqual(['Correspondentie', 'Beheer'])
    const two = planTabs(NAVIGATION, ['search', 'menu'])
    expect(two.pages).toHaveLength(3)
  })

  it('never puts a group in the tabs', () => {
    const plan = planTabs([{ label: 'Beheer', links: [page('Gebruikers')] }, page('Zaken')], [])
    expect(plan.pages.map((item) => item.label)).toEqual(['Zaken'])
    expect(plan.rest.map((entry) => entry.label)).toEqual(['Beheer'])
  })
})

describe('the tab bar in the shell', () => {
  it('is drawn below 768 px only, and only with mobile-tabs', async () => {
    const plain = await mount()
    viewport(390)
    await plain.updateComplete
    expect(root(plain).querySelector('.lintje-tab-bar')).toBeNull()

    const shell = await mount({ 'mobile-tabs': '' })
    await shell.updateComplete
    expect(root(shell).querySelector('.lintje-tab-bar')).not.toBeNull()
    viewport(1024)
    await shell.updateComplete
    expect(root(shell).querySelector('.lintje-tab-bar')).toBeNull()
  })

  it('draws the loose pages and Menu last, in a nav named Hoofdnavigatie', async () => {
    viewport(390)
    const shell = await mount({ 'mobile-tabs': '' })
    const nav = root(shell).querySelector('.lintje-tab-bar')!
    expect(nav.localName).toBe('nav')
    expect(nav.getAttribute('aria-label')).toBe('Hoofdnavigatie')
    expect(labels(shell)).toEqual(['Zaken', 'Taken', 'Lagen', 'Agenda', 'Menu'])
  })

  it('marks the reader page as a link with aria-current; Menu is a button, never current', async () => {
    viewport(390)
    const shell = await mount({ 'mobile-tabs': '' })
    const [zaken, , , , menu] = tabs(shell)
    expect(zaken.localName).toBe('a')
    expect(zaken.getAttribute('aria-current')).toBe('page')
    expect(zaken.classList.contains('is-active')).toBe(true)
    expect(zaken.textContent).toContain('12 open zaken')
    expect(menu.localName).toBe('button')
    expect(menu.hasAttribute('aria-current')).toBe(false)
  })

  it('sends lintje-action with the name of an entry with action', async () => {
    viewport(390)
    const shell = await mount({ 'mobile-tabs': '' })
    const heard = vi.fn()
    shell.addEventListener('lintje-action', (event) => heard((event as CustomEvent).detail))
    const lagen = tabs(shell)[2]
    expect(lagen.localName).toBe('button')
    lagen.click()
    expect(heard).toHaveBeenCalledWith('lagen')
  })

  it('opens the panel from the tab Menu, which then reads Sluiten; the panel holds every page', async () => {
    viewport(390)
    const shell = await mount({ 'mobile-tabs': '' })
    expect(root(shell).querySelector('.lintje-mobile-header__button--menu')).toBeNull()
    const menu = () => tabs(shell).at(-1)!
    menu().click()
    await shell.updateComplete
    expect(shell.menuOpen).toBe(true)
    expect(menu().textContent).toContain('Sluiten')
    const panel = root(shell).querySelector('.lintje-mobile-menu')!
    const entries = Array.from(panel.querySelectorAll('.lintje-mobile-menu__label'), (n) =>
      n.textContent?.trim(),
    )
    expect(entries).toEqual(['Zaken', 'Taken', 'Lagen', 'Agenda', 'Correspondentie', 'Gebruikers'])
    expect(panel.querySelector('nav')?.getAttribute('aria-label')).toBe('Alle pagina’s')
    menu().click()
    await shell.updateComplete
    expect(shell.menuOpen).toBe(false)
  })

  it('keeps each part in one place: in the tabs when tab-parts names it, else in the header', async () => {
    viewport(390)
    const header = await mount({ 'mobile-tabs': '', 'tab-parts': '' })
    expect(labels(header)).toEqual(['Zaken', 'Taken', 'Lagen', 'Agenda', 'Correspondentie'])
    expect(root(header).querySelector('.lintje-mobile-header__button--menu')).not.toBeNull()

    const search = await mount({ 'mobile-tabs': '', 'tab-parts': 'search menu' })
    expect(labels(search)).toEqual(['Zaken', 'Taken', 'Lagen', 'Zoeken', 'Menu'])
    expect(root(search).querySelector('.lintje-mobile-header [aria-label="Zoeken"]')).toBeNull()
  })

  it('warns once about tab-parts without mobile-tabs', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const shell = await mount({ 'tab-parts': 'menu' })
    shell.requestUpdate()
    await shell.updateComplete
    expect(warn.mock.calls.filter(([text]) => String(text).includes('tab-parts'))).toHaveLength(1)
  })
})

describe('the parts of the shell as tabs, and the bar at the top', () => {
  const NOTICES = [{ id: 'n1', title: 'Rapport klaar', when: 'zojuist', unread: true }]
  const USER = { initials: 'MV', name: 'M. Visser', role: 'Analist' }

  it('draws the bell and the user as tabs when tab-parts names them, and not in the bar', async () => {
    viewport(390)
    const shell = await mount(
      { 'mobile-tabs': '', 'tab-parts': 'notifications user menu' },
      { notifications: NOTICES, user: USER },
    )
    const bar = root(shell).querySelector('.lintje-tab-bar')!
    expect(bar.querySelector('lintje-notifications')?.getAttribute('variant')).toBe('tab')
    expect(bar.querySelector('lintje-user-menu')?.getAttribute('variant')).toBe('tab')
    const header = root(shell).querySelector('.lintje-mobile-header')!
    expect(header.querySelector('lintje-notifications, lintje-user-menu')).toBeNull()
    // Two loose pages, then the bell, the user and Menu: five in all.
    expect(labels(shell)).toEqual(['Zaken', 'Taken', 'Menu'])
    expect(bar.children.length).toBe(5)
  })

  it('leaves out a part the shell does not have', async () => {
    viewport(390)
    const shell = await mount({ 'mobile-tabs': '', 'tab-parts': 'notifications user menu' })
    expect(root(shell).querySelector('.lintje-tab-bar lintje-notifications')).toBeNull()
    expect(labels(shell)).toEqual(['Zaken', 'Taken', 'Lagen', 'Agenda', 'Menu'])
  })

  it('starts the user tab’s name with its word, and opens the menu as a sheet from below', async () => {
    viewport(390)
    const shell = await mount({ 'mobile-tabs': '', 'tab-parts': 'user menu' }, { user: USER })
    const user = root(shell).querySelector('.lintje-tab-bar lintje-user-menu') as HTMLElement & {
      updateComplete: Promise<unknown>
    }
    await user.updateComplete
    const tab = user.shadowRoot!.querySelector<HTMLButtonElement>('.lintje-tab-bar__tab')!
    expect(tab.hasAttribute('aria-label')).toBe(false)
    // The avatar is only seen; the word and whose menu it is are the name.
    expect(tab.querySelector('.lintje-tab-bar__glyph')?.getAttribute('aria-hidden')).toBe('true')
    const heard = [...tab.children].filter((node) => !node.hasAttribute('aria-hidden'))
    expect(heard.map((node) => node.textContent).join('')).toBe('Jij, menu van M. Visser')
    tab.click()
    await user.updateComplete
    expect(user.shadowRoot!.querySelector('.lintje-user-menu__sheet')).not.toBeNull()
    expect(user.shadowRoot!.querySelector('lintje-popover')).toBeNull()
  })

  it('draws Terug before the title on a page deeper', async () => {
    viewport(390)
    const shell = await mount({}, { back: { href: '/zaken', label: 'Terug naar Zaken' } })
    const back = root(shell).querySelector<HTMLAnchorElement>('.lintje-mobile-header__back')!
    expect(back.getAttribute('href')).toBe('/zaken')
    expect(back.getAttribute('aria-label')).toBe('Terug naar Zaken')
    const heard = vi.fn()
    shell.addEventListener('lintje-navigate', (event) => {
      event.preventDefault()
      heard((event as CustomEvent).detail)
    })
    back.click()
    expect(heard).toHaveBeenCalledWith({ href: '/zaken' })
  })

  it('shows the page’s name above the small name once the page’s head has scrolled away', async () => {
    viewport(390)
    const shell = await mount({}, { pageName: 'Zaken' })
    const titles = () => root(shell).querySelector('.lintje-mobile-header__titles')!
    expect(titles().querySelector('.lintje-mobile-header__page')).toBeNull()
    setFrameState({ titleHidden: true })
    await shell.updateComplete
    expect(titles().querySelector('.lintje-mobile-header__page')?.textContent).toBe('Zaken')
    const h1 = titles().querySelector('h1')!
    expect(h1.textContent).toBe('Zaaksysteem')
    expect(h1.classList.contains('is-small')).toBe(true)
    setFrameState({ titleHidden: false })
  })
})

describe('a toast with the tabs', () => {
  it('stands above the tabs, and at the edge while a sheet covers them', async () => {
    viewport(390)
    const shell = await mount({ 'mobile-tabs': '' })
    const toast = () => document.documentElement.style.getPropertyValue('--lintje-toast-bottom')
    expect(toast()).toContain('--h-tab-bar')
    // The menu's panel stops on the tabs: the toast stays above them.
    shell.menuOpen = true
    await shell.updateComplete
    expect(toast()).toContain('--h-tab-bar')
    shell.menuOpen = false
    await shell.updateComplete
    // Any other overlay that holds the page covers the tabs.
    const release = lockScroll()
    expect(toast()).toBe('')
    release()
    expect(toast()).toContain('--h-tab-bar')
    shell.remove()
    expect(toast()).toBe('')
  })
})

describe('what opens from a tab', () => {
  const NOTICES = [{ id: 'n1', title: 'Rapport klaar', when: 'zojuist', unread: true }]

  it('closes when another tab is tapped, and leaves the toast above the tabs', async () => {
    viewport(390)
    const shell = await mount(
      { 'mobile-tabs': '', 'tab-parts': 'notifications menu' },
      { notifications: NOTICES },
    )
    const bell = root(shell).querySelector(
      '.lintje-tab-bar lintje-notifications',
    ) as HTMLElement & {
      open: boolean
      updateComplete: Promise<unknown>
    }
    await bell.updateComplete
    bell.shadowRoot!.querySelector<HTMLButtonElement>('.lintje-tab-bar__tab')!.click()
    await bell.updateComplete
    expect(bell.open).toBe(true)
    // The bell's sheet is opened from a tab: the tabs stay, so the toast stays above them.
    await shell.updateComplete
    expect(document.documentElement.style.getPropertyValue('--lintje-toast-bottom')).toContain(
      '--h-tab-bar',
    )

    // Menu takes over: the bell's sheet closes.
    tabs(shell).at(-1)!.click()
    await shell.updateComplete
    expect(shell.menuOpen).toBe(true)
    expect(bell.open).toBe(false)

    // The bell takes over from Menu.
    bell.shadowRoot!.querySelector<HTMLButtonElement>('.lintje-tab-bar__tab')!.click()
    await shell.updateComplete
    expect(bell.open).toBe(true)
    expect(shell.menuOpen).toBe(false)

    // A page closes it and goes.
    shell.addEventListener('lintje-navigate', (event) => event.preventDefault())
    tabs(shell)[1]!.click()
    await shell.updateComplete
    expect(bell.open).toBe(false)
  })
})
