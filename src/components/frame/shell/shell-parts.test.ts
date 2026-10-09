/**
 * The shell's parts: the mobile header in its two states and the menu under it, the side menu
 * and its pin, "Weergave" and "Delen", the top layout's navigation bar, the skip link, the focus
 * trap and the scroll lock, and when the content box gives its room to the `full` slot.
 *
 * The shell changes no setting itself: a choice goes out as `lintje-view-change` and stands once
 * the host sets `data` again. happy-dom has no layout, so in the side layout both the top bar
 * and the mobile header are in the tree; that the pair fits beside "Sluiten" is proven where it
 * runs, in headless Chrome.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import './shell'
import type { LintjeShell } from './shell'
import type { LintjeRadioGroup } from '../../inputs/radio-group/radio-group'
import type { ShellData, ShellView, ShellViewChange } from '../../../types'
import { clearFilterZone, setFrameState } from '../../../core/frame-state'
import { deepActiveElement, tabbables } from '../../shared/focus-trap'
import { mailSubject, phoneLink } from './top-bar'
import type { LintjeButton } from '../../../primitives/button/button'

beforeAll(() => {
  // The shell observes its navigation bar; happy-dom has no observer.
  globalThis.ResizeObserver ??= class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver
})

const VIEW: ShellView = { mode: 'system' }

const DATA: ShellData = {
  name: 'Dashboard Vergunningen',
  layout: 'side',
  navigation: [
    {
      label: 'Overzicht',
      links: [{ label: 'Overzicht', icon: 'functioneel-home', href: '/', active: true }],
    },
  ],
  user: { initials: 'HP', name: 'H. van Pelt', role: 'Analist' },
  pageName: 'Overzicht',
  view: VIEW,
  share: true,
}

const mounted: LintjeShell[] = []

async function mount(extra: Partial<ShellData> = {}): Promise<LintjeShell> {
  const element = document.createElement('lintje-shell')
  element.data = { ...DATA, ...extra }
  document.body.append(element)
  mounted.push(element)
  await element.updateComplete
  return element
}

// A shell left open keeps its focus trap on the document; every test starts without one.
afterEach(() => {
  for (const shell of mounted.splice(0)) shell.remove()
})

const root = (shell: LintjeShell): ShadowRoot => shell.shadowRoot as ShadowRoot

const viewport = (width: number): void =>
  (
    window as unknown as { happyDOM: { setViewport(size: { width: number }): void } }
  ).happyDOM.setViewport({ width })

/** `node` stands in `container`, also from inside a shadow root below it. */
function inside(container: Element, node: Node | null): boolean {
  for (let at = node; at; at = (at.getRootNode() as ShadowRoot).host ?? null) {
    if (container.contains(at)) return true
  }
  return false
}

/** The mode group stands in the panel of "Weergave": open it first. */
async function view(shell: LintjeShell): Promise<LintjeShell> {
  shell.viewOpen = true
  await shell.updateComplete
  return shell
}

const buttons = (shell: LintjeShell): HTMLButtonElement[] =>
  Array.from(root(shell).querySelectorAll<HTMLButtonElement>('.lintje-mobile-header__button'))

const menuButton = (shell: LintjeShell): HTMLButtonElement =>
  buttons(shell).find((button) => button.hasAttribute('aria-controls')) as HTMLButtonElement

const panel = (shell: LintjeShell): Element | null =>
  root(shell).querySelector('.lintje-mobile-menu')

/** The toggles in the panel of "Weergave", in order: three for the mode first. */
const options = (shell: LintjeShell): HTMLButtonElement[] =>
  Array.from(root(shell).querySelectorAll<HTMLButtonElement>('.lintje-toggle-group__option'))

const pressed = (toggles: HTMLButtonElement[]): string[] =>
  toggles
    .filter((button) => button.getAttribute('aria-pressed') === 'true')
    .map((button) => button.getAttribute('aria-label') ?? '')

/**
 * What the button holds, in the order it holds it: `['icon', 'text']` or the
 * other way round. The word is a text node, so `firstElementChild` cannot tell
 * the two apart — the button has one element child either way.
 */
const contentOrder = (button: HTMLButtonElement): Array<'icon' | 'text'> =>
  Array.from(button.childNodes)
    .map((node) => {
      if (node instanceof Element) {
        if (node.classList.contains('lintje-mobile-header__word')) return 'text'
        return node.tagName.toLowerCase() === 'svg' ? 'icon' : null
      }
      // Only real text: lit's own markers are comments, and happy-dom hands out
      // their body as `textContent` too.
      return node.nodeType === 3 && node.textContent?.trim() ? 'text' : null
    })
    .filter((part): part is 'icon' | 'text' => part !== null)

/** Every `lintje-view-change` a click asks for. */
async function changesAfter(shell: LintjeShell, click: () => void): Promise<ShellViewChange[]> {
  const asked: ShellViewChange[] = []
  const listen = (event: Event): void => {
    asked.push((event as CustomEvent<ShellViewChange>).detail)
  }
  shell.addEventListener('lintje-view-change', listen)
  click()
  await shell.updateComplete
  shell.removeEventListener('lintje-view-change', listen)
  return asked
}

/** The host's answer to a change: the same data with the new view. */
async function hostSets(shell: LintjeShell, change: Partial<ShellView>): Promise<void> {
  shell.data = { ...shell.data!, view: { ...VIEW, ...change } }
  await shell.updateComplete
}

async function open(shell: LintjeShell): Promise<void> {
  menuButton(shell).click()
  await shell.updateComplete
}

describe('the closed mobile header', () => {
  it('carries Filters and Menu', async () => {
    setFrameState({ hasFilters: true }) // a filter zone stands on this page
    const shell = await mount()
    expect(buttons(shell).map((button) => button.textContent?.trim())).toEqual(['Filters', 'Menu'])
    expect(panel(shell)).toBeNull()
  })

  it('carries "Weergave" and "Delen" as icons that open their panel', async () => {
    viewport(390)
    const shell = await mount()
    const actions = root(shell).querySelector('.lintje-mobile-header__actions')!
    const tools = [...actions.querySelectorAll<HTMLButtonElement>('.lintje-shell__tool')]
    expect(tools.map((tool) => tool.getAttribute('aria-label'))).toEqual(['Weergave', 'Delen'])
    tools[1]!.click()
    await shell.updateComplete
    // A sheet with the filter sheet's head: its name and a close button.
    const sheet = actions.querySelector('.lintje-share__popover')!
    expect(sheet.getAttribute('role')).toBe('dialog')
    expect(sheet.querySelector('.lintje-share__title')!.textContent).toBe('Delen')
    expect(sheet.querySelector('[role="menuitem"]')).toBeNull()
    sheet.querySelector<HTMLButtonElement>('.lintje-share__close')!.click()
    await shell.updateComplete
    expect(shell.shareOpen).toBe(false)
    tools[0]!.click()
    await shell.updateComplete
    expect(actions.querySelector('.lintje-view__popover .lintje-share__title')!.textContent).toBe(
      'Weergave',
    )
    viewport(1024)
  })

  it('keeps the words of Filters and Menu for the reader when only their glyphs fit', async () => {
    setFrameState({ hasFilters: true })
    const shell = await mount()
    shell.headerCompact = true
    await shell.updateComplete
    expect(
      root(shell).querySelector('.lintje-mobile-header')!.classList.contains('is-compact'),
    ).toBe(true)
    expect(buttons(shell).map((button) => button.textContent?.trim())).toEqual(['Filters', 'Menu'])
  })

  it('has no Filters button on a page without a filter zone', async () => {
    clearFilterZone()
    const shell = await mount()
    expect(buttons(shell).map((button) => button.textContent?.trim())).toEqual(['Menu'])
    setFrameState({ hasFilters: true })
  })

  it('carries search and the bell when the data asks for them, and gives their place up when open', async () => {
    const shell = await mount({
      search: true,
      notifications: [{ id: 'n1', title: 'Rapport klaar', when: 'zojuist', unread: true }],
    })
    const actions = root(shell).querySelector('.lintje-mobile-header__actions')!
    expect(actions.querySelector('button[aria-label="Zoeken"]')).not.toBeNull()
    expect(actions.querySelector('lintje-notifications')).not.toBeNull()
    await open(shell)
    expect(actions.querySelector('button[aria-label="Zoeken"]')).toBeNull()
    expect(actions.querySelector('lintje-notifications')).toBeNull()
  })

  it('draws the menu glyph before its word', async () => {
    const shell = await mount()
    expect(contentOrder(menuButton(shell))).toEqual(['icon', 'text'])
  })

  it('counts the modified filters in the header badge', async () => {
    setFrameState({ hasFilters: true, modifiedCount: 3 })
    const shell = await mount()
    const filters = buttons(shell)[0]!
    const badge = filters.querySelector('.lintje-mobile-header__badge')!
    // The figure is seen, the sentence heard.
    expect(badge.querySelector('[aria-hidden="true"]')?.textContent).toBe('3')
    expect(badge.querySelector('.visually-hidden')?.textContent).toBe('3 aangepast')
    // It opens the filter sheet, a modal dialog, and says whether it is open.
    expect(filters.getAttribute('aria-haspopup')).toBe('dialog')
    expect(filters.getAttribute('aria-expanded')).toBe('false')
    setFrameState({ sheetOpen: true })
    await shell.updateComplete
    expect(filters.getAttribute('aria-expanded')).toBe('true')
    setFrameState({ modifiedCount: 0, sheetOpen: false })
  })
})

describe('the open mobile header', () => {
  it('carries only "Sluiten": "Weergave" is a tool of the closed header', async () => {
    const shell = await mount()
    await open(shell)
    const actions = root(shell).querySelector('.lintje-mobile-header__actions')!
    expect(buttons(shell).map((button) => button.textContent?.trim())).toEqual(['Sluiten'])
    expect(actions.querySelectorAll('button')).toHaveLength(1)
    expect(panel(shell)).not.toBeNull()
  })

  it('puts the cross after the word, and keeps one and the same button', async () => {
    const shell = await mount()
    const before = menuButton(shell)
    await open(shell)
    expect(menuButton(shell)).toBe(before)
    expect(contentOrder(menuButton(shell))).toEqual(['text', 'icon'])
  })
})

/**
 * The environment, the contact and the version. The desktop menu carries them below its pages;
 * below 768 px the mobile panel carries them, in the same order, above its foot: the user menu,
 * drawn inline. The version stands in that user menu, or in the panel without a user.
 */
describe('the mobile menu panel', () => {
  const META: Partial<ShellData> = {
    environment: 'ONTWIKKELING',
    feedback: { href: 'mailto:contact@voorbeeld.local' },
    version: '1.2.3',
  }

  /** The panel's direct children, by the block each one is. */
  const blocks = (shell: LintjeShell): string[] =>
    Array.from(panel(shell)?.children ?? []).map((child) =>
      child.classList.contains('lintje-shell__sheet-user')
        ? 'user'
        : (['list', 'environment', 'feedback'].find((name) =>
            child.classList.contains(`lintje-mobile-menu__${name}`),
          ) ?? child.className),
    )

  it('puts the band and the feedback row between the pages and the user menu, which has the version', async () => {
    const shell = await mount(META)
    await open(shell)
    expect(blocks(shell)).toEqual(['list', 'environment', 'feedback', 'user'])

    const band = root(shell).querySelector('.lintje-mobile-menu__environment')
    expect(band?.textContent?.trim()).toBe('ONTWIKKELING')
    const row = root(shell).querySelector('.lintje-mobile-menu__feedback') as HTMLAnchorElement
    expect(row.tagName).toBe('A')
    expect(row.getAttribute('href')).toBe('mailto:contact@voorbeeld.local')
    expect(row.querySelector('.lintje-mobile-menu__label')?.textContent?.trim()).toBe(
      'Vragen of feedback',
    )
    expect(row.querySelector('.lintje-mobile-menu__version')).toBeNull()

    const user = root(shell).querySelector('lintje-user-menu')!
    expect(user.inline).toBe(true)
    expect(user.user?.initials).toBe('HP')
    expect(user.getAttribute('version')).toBe('1.2.3')
  })

  it('keeps the version in the feedback row without a user', async () => {
    const shell = await mount({ ...META, user: undefined })
    await open(shell)
    expect(blocks(shell)).toEqual(['list', 'environment', 'feedback'])
    const row = root(shell).querySelector('.lintje-mobile-menu__feedback') as HTMLElement
    expect(row.querySelector('.lintje-mobile-menu__version')?.textContent?.trim()).toBe('v1.2.3')
  })

  it('shows the version alone, and unclickable, without a user or a contact', async () => {
    const shell = await mount({ ...META, user: undefined, feedback: undefined })
    await open(shell)
    expect(blocks(shell)).toEqual(['list', 'environment', 'feedback'])

    const row = root(shell).querySelector('.lintje-mobile-menu__feedback') as HTMLElement
    expect(row.tagName).toBe('P')
    expect(row.querySelector('.lintje-mobile-menu__label')).toBeNull()
    expect(row.textContent?.trim()).toBe('v1.2.3')
  })

  it('draws no feedback row with a user and without a contact', async () => {
    const shell = await mount({ ...META, feedback: undefined })
    await open(shell)
    expect(blocks(shell)).toEqual(['list', 'environment', 'user'])
  })

  it('leaves the band out when there is no environment', async () => {
    const shell = await mount({ ...META, environment: undefined })
    await open(shell)
    expect(blocks(shell)).toEqual(['list', 'feedback', 'user'])
  })
})

/**
 * The same decoupling in the menu the desktop draws. happy-dom answers no media
 * query, so the menu stands here as the collapsed rail — which is exactly where
 * the row must keep its place: it is present and it is not a menu item, and the
 * number itself appears with the other labels when the rail expands.
 */
describe('the menu below its pages', () => {
  it('gives the version a row of its own when there is no contact', async () => {
    const shell = await mount({ version: '1.2.3' })
    expect(root(shell).querySelector('.lintje-nav__feedback')).toBeNull()
    const row = root(shell).querySelector('.lintje-nav__version-row')
    expect(row).not.toBeNull()
    expect(row?.classList.contains('lintje-nav__item')).toBe(false)
  })

  it('keeps the version in the feedback row when there is a contact', async () => {
    const shell = await mount({
      feedback: { href: 'mailto:contact@voorbeeld.local' },
      version: '1.2.3',
    })
    expect(root(shell).querySelector('.lintje-nav__version-row')).toBeNull()
    expect(root(shell).querySelector('.lintje-nav__feedback')).not.toBeNull()
  })
})

/** The pin chooses between the pinned menu and the rail; it exists from 1440 px up. */
describe('the pin of the side menu', () => {
  const pin = (shell: LintjeShell): HTMLButtonElement | null =>
    root(shell).querySelector<HTMLButtonElement>('.lintje-nav__pin')

  afterEach(() => viewport(1024))

  it('sends unpinned from the pinned menu and pinned from the rail, and changes nothing itself', async () => {
    // happy-dom announces a media change only after a resize across the breakpoint.
    const shell = await mount()
    viewport(1600)
    await shell.updateComplete
    // One name in both states; aria-pressed says which.
    expect(pin(shell)!.getAttribute('aria-pressed')).toBe('true')
    expect(pin(shell)!.getAttribute('aria-label')).toBe('Menu vastzetten')
    expect(pin(shell)!.title).toBe('Menu vastzetten')
    expect(await changesAfter(shell, () => pin(shell)!.click())).toEqual([{ menu: 'unpinned' }])
    expect(root(shell).querySelector('.lintje-nav--rail')).toBeNull()

    shell.data = { ...shell.data!, menu: 'unpinned' }
    await shell.updateComplete
    expect(root(shell).querySelector('.lintje-shell')!.classList).toContain('is-unpinned')
    expect(root(shell).querySelector('.lintje-nav--rail')).not.toBeNull()
    expect(pin(shell)).toBeNull()

    // The rail expands under the pointer, and shows the pin there.
    root(shell).querySelector('.lintje-nav')!.dispatchEvent(new MouseEvent('mouseenter'))
    await shell.updateComplete
    expect(pin(shell)!.getAttribute('aria-pressed')).toBe('false')
    expect(pin(shell)!.getAttribute('aria-label')).toBe('Menu vastzetten')
    expect(await changesAfter(shell, () => pin(shell)!.click())).toEqual([{ menu: 'pinned' }])
    expect(shell.railExpanded).toBe(false)
  })

  it('is not there below 1440 px, where the menu is always the rail', async () => {
    const shell = await mount()
    expect(root(shell).querySelector('.lintje-nav--rail')).not.toBeNull()
    root(shell).querySelector('.lintje-nav')!.dispatchEvent(new MouseEvent('mouseenter'))
    await shell.updateComplete
    expect(shell.railExpanded).toBe(true)
    expect(pin(shell)).toBeNull()
  })
})

/** The side menu's own scrollbar: geometry and dragging run in Chromium (`shell.browser.test.ts`). */
describe('the side menu’s thumb', () => {
  it('stands right after the list, hidden from a reader and empty with nothing to scroll', async () => {
    const shell = await mount()
    const thumb = root(shell).querySelector<HTMLElement>('.lintje-nav__thumb')!
    expect(thumb.previousElementSibling?.classList.contains('lintje-nav__list')).toBe(true)
    expect(thumb.getAttribute('aria-hidden')).toBe('true')
    expect(thumb.style.height).toBe('0px')
  })
})

/** The top bar's three segments for light and dark; `system` is the default and comes first. */
describe('the top bar mode controls', () => {
  const modes = (shell: LintjeShell): HTMLButtonElement[] => options(shell).slice(0, 3)

  it('offers system, light and dark, in that order', async () => {
    const shell = await view(await mount())
    expect(modes(shell).map((button) => button.getAttribute('aria-label'))).toEqual([
      'Systeemweergave',
      'Lichte modus',
      'Donkere modus',
    ])
  })

  it("presses the one the host's view says", async () => {
    const at = async (mode: ShellView['mode']): Promise<string[]> =>
      pressed(modes(await view(await mount({ view: { ...VIEW, mode } }))))

    expect(await at('system')).toEqual(['Systeemweergave'])
    expect(await at('light')).toEqual(['Lichte modus'])
    expect(await at('dark')).toEqual(['Donkere modus'])
  })

  it('sends the chosen mode as lintje-view-change, and leaves the pressed one to the host', async () => {
    const dark = await view(await mount({ view: { ...VIEW, mode: 'dark' } }))
    expect(await changesAfter(dark, () => modes(dark)[1]?.click())).toEqual([{ mode: 'light' }])
    expect(pressed(modes(dark))).toEqual(['Donkere modus'])
    expect(await changesAfter(dark, () => modes(dark)[0]?.click())).toEqual([{ mode: 'system' }])

    await hostSets(dark, { mode: 'system' })
    expect(pressed(modes(dark))).toEqual(['Systeemweergave'])
  })

  it('stands behind "Weergave": closed at rest, beside a "Delen" of the same weight', async () => {
    const shell = await mount()
    expect(root(shell).querySelector('.lintje-toggle-group')).toBeNull()
    const actions = [...root(shell).querySelectorAll('.lintje-top-bar__actions lintje-button')]
    expect(actions.map((button) => button.textContent!.trim())).toEqual(['Weergave', 'Delen'])
    expect(actions.map((button) => button.getAttribute('variant'))).toEqual([
      'tertiary',
      'tertiary',
    ])
    // The state is on the inner button, where a screen reader reads it; the panel is a group,
    // not a menu, so there is no aria-haspopup.
    const control = (): HTMLButtonElement => actions[0].shadowRoot!.querySelector('button')!
    expect(actions[0].hasAttribute('aria-expanded')).toBe(false)
    expect(control().getAttribute('aria-expanded')).toBe('false')
    expect(control().hasAttribute('aria-haspopup')).toBe(false)

    ;(actions[0] as HTMLElement).click()
    await shell.updateComplete
    await (actions[0] as LintjeButton).updateComplete
    expect(control().getAttribute('aria-expanded')).toBe('true')
    const groups = [...root(shell).querySelectorAll('.lintje-view__popover .lintje-toggle-group')]
    expect(groups.map((group) => group.textContent!.replace(/\s+/g, ' ').trim())).toEqual([
      'Systeem Licht Donker',
    ])

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await shell.updateComplete
    expect(root(shell).querySelector('.lintje-view__popover')).toBeNull()
  })

  it('has "Weergave" only with a view from the host, and "Delen" only when it asks for it', async () => {
    const labels = async (extra: Partial<ShellData>): Promise<string[]> =>
      [...root(await mount(extra)).querySelectorAll('.lintje-top-bar__actions lintje-button')].map(
        (button) => button.textContent!.trim(),
      )
    expect(await labels({ view: undefined })).toEqual(['Delen'])
    expect(await labels({ share: undefined })).toEqual(['Weergave'])
    expect(await labels({ view: undefined, share: undefined })).toEqual([])

    const top = await mount({ layout: 'top', view: undefined, share: undefined })
    expect(root(top).querySelector('.lintje-navbar__end')).not.toBeNull()
    expect(root(top).querySelector('.lintje-view__button, .lintje-share__button')).toBeNull()
  })
})

describe('what "Weergave" offers when the host lets the reader choose', () => {
  const THEMES = [
    { value: 'rijksoverheid', label: 'Rijksoverheid' },
    { value: 'marechaussee', label: 'Marechaussee' },
  ]
  const groups = (shell: LintjeShell): string[] =>
    [...root(shell).querySelectorAll('.lintje-view__popover .lintje-share__heading')].map(
      (heading) => heading.textContent!.trim(),
    )
  const option = (shell: LintjeShell, label: string): HTMLButtonElement =>
    root(shell).querySelector<HTMLButtonElement>(`.lintje-view__popover [aria-label="${label}"]`)!

  it('has no menu and no theme to choose without the host saying so', async () => {
    const shell = await view(await mount())
    expect(groups(shell)).toEqual(['Licht of donker'])
  })

  it('presses where the menu stands, and sends the other place', async () => {
    const side = await view(await mount({ view: { ...VIEW, layoutChoice: true } }))
    expect(groups(side)).toEqual(['Licht of donker', 'Menu'])
    expect(option(side, 'Menu als zijbalk').getAttribute('aria-pressed')).toBe('true')
    expect(await changesAfter(side, () => option(side, 'Menu boven').click())).toEqual([
      { layout: 'top' },
    ])

    const top = await view(await mount({ layout: 'top', view: { ...VIEW, layoutChoice: true } }))
    expect(option(top, 'Menu boven').getAttribute('aria-pressed')).toBe('true')
    expect(await changesAfter(top, () => option(top, 'Menu als zijbalk').click())).toEqual([
      { layout: 'side' },
    ])
  })

  it('offers the themes as one radio group, the chosen one checked, and sends a choice', async () => {
    const shell = await view(
      await mount({ view: { ...VIEW, themes: THEMES, theme: 'marechaussee' } }),
    )
    expect(groups(shell)).toEqual(['Licht of donker', 'Thema'])
    const group = root(shell).querySelector<LintjeRadioGroup>(
      '.lintje-view__popover lintje-radio-group',
    )!
    expect(group.label).toBe('Thema')
    expect(group.options).toEqual(THEMES)
    expect(group.value).toBe('marechaussee')
    const changes = await changesAfter(shell, () =>
      group.dispatchEvent(new CustomEvent('lintje-change', { detail: 'rijksoverheid' })),
    )
    expect(changes).toEqual([{ theme: 'rijksoverheid' }])
  })

  it('checks the first theme when the host names none', async () => {
    const shell = await view(await mount({ view: { ...VIEW, themes: THEMES } }))
    expect(
      root(shell).querySelector<LintjeRadioGroup>('.lintje-view__popover lintje-radio-group')!
        .value,
    ).toBe('rijksoverheid')
  })
})

describe('the top layout', () => {
  const NAVIGATION: ShellData['navigation'] = [
    { label: 'Overzicht', icon: 'functioneel-home', href: '/', active: true },
    {
      label: 'Vergunningen',
      links: [
        { label: 'Aanvragen', icon: 'functioneel-mail', href: '/requests' },
        { label: 'Wachttijden', icon: 'functioneel-klok' },
      ],
    },
  ]
  const top = (extra: Partial<ShellData> = {}): Promise<LintjeShell> =>
    mount({ layout: 'top', navigation: NAVIGATION, ...extra })

  it('puts the navigation beside the page only when the data asks for the side', async () => {
    const shell = await mount({ layout: undefined })
    expect(shell.getAttribute('layout')).toBe('top')
    expect(root(shell).querySelector('.lintje-navbar')).not.toBeNull()
    expect(root(shell).querySelector('.lintje-nav')).toBeNull()

    const side = await mount()
    expect(side.getAttribute('layout')).toBe('side')
    expect(root(side).querySelector('.lintje-nav')).not.toBeNull()
    expect(root(side).querySelector('.lintje-navbar')).toBeNull()
  })

  it('ends the navigation bar with search, the bell, Weergave, Delen, feedback and the user menu', async () => {
    const shell = await top({
      search: true,
      notifications: [{ id: 'n1', title: 'Rapport klaar', when: 'zojuist', unread: true }],
      feedback: { href: 'mailto:beheer@example.org' },
      version: '2.4.1',
      logout: { href: '/auth/logout', token: 'abc' },
    })
    const end = root(shell).querySelector('.lintje-navbar__end')!
    const parts = [...end.querySelectorAll('.lintje-shell__tool, lintje-notifications')]
    expect(parts.map((part) => part.getAttribute('aria-label') ?? part.localName)).toEqual([
      'Zoeken',
      'lintje-notifications',
      'Weergave',
      'Delen',
      'Vragen of feedback',
    ])
    const feedback = end.querySelector<HTMLAnchorElement>('a.lintje-shell__tool')!
    expect(feedback.getAttribute('href')).toBe('mailto:beheer@example.org')
    const menu = end.querySelector('lintje-user-menu')!
    expect(parts.at(-1)!.compareDocumentPosition(menu) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
    expect(menu.inline).toBe(false)
    expect(menu.user?.initials).toBe('HP')
    expect(menu.getAttribute('version')).toBe('2.4.1')
    expect(menu.getAttribute('logout-action')).toBe('/auth/logout')

    const bare = await top()
    expect(root(bare).querySelector('.lintje-navbar__end a.lintje-shell__tool')).toBeNull()
  })

  it('opens the view and share panels from the bare tools, one at a time', async () => {
    const shell = await top()
    const end = root(shell).querySelector('.lintje-navbar__end')!
    const viewTool = end.querySelector<HTMLButtonElement>('button.lintje-view__button')!
    const share = end.querySelector<HTMLButtonElement>('button.lintje-share__button')!
    expect(viewTool.getAttribute('aria-expanded')).toBe('false')
    // Both panels are disclosures.
    expect(viewTool.hasAttribute('aria-haspopup')).toBe(false)
    expect(share.hasAttribute('aria-haspopup')).toBe(false)
    expect(viewTool.title).toBe('Weergave')
    expect(share.title).toBe('Delen')

    viewTool.click()
    await shell.updateComplete
    expect(viewTool.getAttribute('aria-expanded')).toBe('true')
    expect(end.querySelector('.lintje-view__popover')).not.toBeNull()

    // A submenu open under the same pointer closes when a tool is pressed.
    shell.openGroup = 1
    await shell.updateComplete
    share.click()
    await shell.updateComplete
    expect(shell.openGroup).toBeNull()
    expect(end.querySelector('.lintje-view__popover')).toBeNull()
    expect(share.getAttribute('aria-expanded')).toBe('true')
    expect(end.querySelector('.lintje-share__popover')!.getAttribute('role')).toBe('group')
    expect(end.querySelector('.lintje-share__popover [role="menuitem"]')).toBeNull()
  })

  it('swaps the share menu for the QR code of this view and back', async () => {
    const shell = await mount()
    shell.shareOpen = true
    await shell.updateComplete
    const item = root(shell).querySelector<HTMLButtonElement>('.lintje-share__phone')!
    expect(item.textContent!.trim()).toBe('Open op mijn telefoon')
    item.click()
    await shell.updateComplete
    await shell.updateComplete
    const popover = root(shell).querySelector('.lintje-share__popover')!
    expect(popover.getAttribute('role')).toBe('dialog')
    const code = popover.querySelector('lintje-qr-code')!
    expect(code.value).toBe(window.location.href)
    expect(code.src).toBe('')
    const back = root(shell).querySelector<HTMLButtonElement>('.lintje-share__back')!
    expect(root(shell).activeElement).toBe(back)
    back.click()
    await shell.updateComplete
    await shell.updateComplete
    expect(root(shell).querySelector('lintje-qr-code')).toBeNull()
    expect(root(shell).activeElement).toBe(root(shell).querySelector('.lintje-share__phone'))
  })

  it('shows the QR code of the host, and the link under its scheme', async () => {
    const shell = await mount({ qrCode: 'qr.svg', qrScheme: 'mibrowsers' })
    shell.shareOpen = true
    shell.sharePhone = true
    await shell.updateComplete
    const code = root(shell).querySelector('lintje-qr-code')!
    expect(code.src).toBe('qr.svg')
    expect(code.value).toBe(phoneLink(window.location.href, 'mibrowsers'))
  })

  it('puts the scheme of the host in place of https', () => {
    const href = 'https://dashboard.example.nl/overzicht?jaar=2025#kaart'
    expect(phoneLink(href)).toBe(href)
    for (const scheme of ['mibrowsers', 'mibrowsers:', 'mibrowsers://'])
      expect(phoneLink(href, scheme)).toBe(
        'mibrowsers://dashboard.example.nl/overzicht?jaar=2025#kaart',
      )
  })

  it('mails under the page and the application, and leaves the subject to the document without them', () => {
    expect(mailSubject({ navigation: [], name: 'Dashboard', pageName: 'Doorlooptijd' })).toBe(
      'Doorlooptijd – Dashboard',
    )
    expect(mailSubject({ navigation: [], name: 'Dashboard' })).toBe('Dashboard')
    expect(mailSubject({ navigation: [] })).toBe('')
    expect(mailSubject(null)).toBe('')
  })

  it('opens the share menu on its items again after it closed on the QR code', async () => {
    const shell = await mount()
    shell.shareOpen = true
    shell.sharePhone = true
    await shell.updateComplete
    shell.shareOpen = false
    await shell.updateComplete
    shell.shareOpen = true
    await shell.updateComplete
    expect(root(shell).querySelector('.lintje-share__phone')).not.toBeNull()
  })

  it('gives the focus back to Weergave when Escape closes its panel', async () => {
    const shell = await top()
    const viewTool = root(shell).querySelector<HTMLButtonElement>('button.lintje-view__button')!
    viewTool.focus()
    viewTool.click()
    await shell.updateComplete
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await shell.updateComplete
    expect(shell.viewOpen).toBe(false)
    expect(root(shell).activeElement).toBe(viewTool)
  })

  it('pins the navigation bar once it has scrolled away', async () => {
    const shell = await top()
    const slot = root(shell).querySelector<HTMLElement>('.lintje-shell__nav')!
    // happy-dom has no layout: the bar's place in the flow is told.
    const scrollTo = async (y: number): Promise<void> => {
      slot.getBoundingClientRect = () => ({ top: 120 - y }) as DOMRect
      shell.measureScroll()
      await shell.updateComplete
    }
    await scrollTo(100)
    expect(slot.classList.contains('is-stuck')).toBe(false)
    await scrollTo(200)
    expect(slot.classList.contains('is-stuck')).toBe(true)
    await scrollTo(110)
    expect(slot.classList.contains('is-stuck')).toBe(false)
  })

  it('leaves a shell inside another in the flow', async () => {
    const outer = await top()

    const specimen = document.createElement('lintje-shell')
    specimen.data = { ...DATA, layout: 'top' }
    outer.append(specimen)
    await specimen.updateComplete
    const slot = root(specimen).querySelector<HTMLElement>('.lintje-shell__nav')!
    slot.getBoundingClientRect = () => ({ top: -200 }) as DOMRect
    window.dispatchEvent(new Event('scroll'))
    await new Promise((done) => requestAnimationFrame(done))
    await specimen.updateComplete
    expect(slot.classList.contains('is-stuck')).toBe(false)
    expect(root(specimen).querySelector('.lintje-shell')!.classList.contains('is-nested')).toBe(
      true,
    )
    expect(root(outer).querySelector('.lintje-shell')!.classList.contains('is-nested')).toBe(false)
  })
})

describe('the skip link', () => {
  const skipLink = (shell: LintjeShell): HTMLAnchorElement =>
    root(shell).querySelector('.lintje-shell__skip') as HTMLAnchorElement

  it('is the first focusable of the shell, before the menu, and says where it goes', async () => {
    const shell = await mount()
    const first = tabbables(root(shell).querySelector('.lintje-shell') as Element)[0]
    expect(first).toBe(skipLink(shell))
    expect(first?.textContent?.trim()).toBe('Naar de inhoud')
  })

  it("moves the focus to the shell's own main, past the menu and the bars", async () => {
    const shell = await mount()
    const main = root(shell).querySelector('main')!
    expect(skipLink(shell).getAttribute('href')).toBe(`#${main.id}`)
    expect(main.getAttribute('tabindex')).toBe('-1')
    skipLink(shell).click()
    expect(root(shell).activeElement).toBe(main)
    expect(deepActiveElement()).toBe(main)
  })
})

/**
 * The open mobile menu is a modal dialog: the header and its panel together,
 * because Sluiten and the mode stand in the header. Tab stays inside that
 * region; opening leaves the focus on the Menu button, closing brings it back
 * there.
 *
 * happy-dom moves no focus on Tab, so a Tab is a dispatched `keydown`: where
 * the trap wraps, it prevents the default and moves the focus itself.
 */
describe('the open mobile menu keeps the focus', () => {
  const region = (shell: LintjeShell): HTMLElement =>
    root(shell).querySelector('.lintje-mobile-chrome') as HTMLElement

  function key(name: string, shiftKey = false): KeyboardEvent {
    const event = new KeyboardEvent('keydown', {
      key: name,
      shiftKey,
      bubbles: true,
      composed: true,
      cancelable: true,
    })
    ;(deepActiveElement() ?? document.body).dispatchEvent(event)
    return event
  }

  async function openWithFocus(shell: LintjeShell): Promise<void> {
    menuButton(shell).focus()
    await open(shell)
  }

  it('makes the header and the panel one modal dialog only while open', async () => {
    const shell = await mount()
    expect(region(shell).hasAttribute('role')).toBe(false)
    await open(shell)
    expect(region(shell).getAttribute('role')).toBe('dialog')
    expect(region(shell).getAttribute('aria-modal')).toBe('true')
    expect(region(shell).getAttribute('aria-label')).toBe('Menu')
    expect(panel(shell)?.hasAttribute('role')).toBe(false)
    expect(region(shell).contains(menuButton(shell))).toBe(true)
    expect(region(shell).contains(panel(shell))).toBe(true)
  })

  it('leaves the focus on the Menu button when it opens', async () => {
    const shell = await mount()
    await openWithFocus(shell)
    expect(deepActiveElement()).toBe(menuButton(shell))
  })

  it('wraps Tab from the last control to the first, and Shift+Tab back', async () => {
    const shell = await mount()
    await openWithFocus(shell)
    const list = tabbables(region(shell))
    expect(list).toContain(menuButton(shell))
    const first = list[0] as HTMLElement
    const last = list[list.length - 1] as HTMLElement
    // The last stop is in the panel's foot, the user menu's own shadow root.
    expect(inside(panel(shell)!, last)).toBe(true)

    last.focus()
    expect(key('Tab').defaultPrevented).toBe(true)
    expect(deepActiveElement()).toBe(first)

    expect(key('Tab', true).defaultPrevented).toBe(true)
    expect(deepActiveElement()).toBe(last)
  })

  it('pulls focus that lands outside back into the menu', async () => {
    const shell = await mount()
    await openWithFocus(shell)
    const outside = document.createElement('button')
    document.body.append(outside)
    outside.focus()
    expect(inside(region(shell), deepActiveElement())).toBe(true)
    outside.remove()
  })

  it('gives the focus back to the Menu button on Escape', async () => {
    const shell = await mount()
    await openWithFocus(shell)
    const row = panel(shell)?.querySelector<HTMLElement>('.lintje-mobile-menu__item')
    row?.focus()
    key('Escape')
    await shell.updateComplete
    expect(shell.menuOpen).toBe(false)
    expect(deepActiveElement()).toBe(menuButton(shell))
  })

  it('gives the focus back to the Menu button when a page is chosen', async () => {
    const shell = await mount()
    await openWithFocus(shell)
    const row = panel(shell)?.querySelector<HTMLAnchorElement>('a.lintje-mobile-menu__item')
    row?.focus()
    row?.click()
    await shell.updateComplete
    expect(shell.menuOpen).toBe(false)
    expect(deepActiveElement()).toBe(menuButton(shell))
  })

  it('closes, and lets the keyboard go, when the viewport becomes 768 px or wider', async () => {
    try {
      // happy-dom announces a media change only after a first resize across the
      // breakpoint, so the shell starts wide and goes narrow before the menu opens.
      const shell = await mount()
      viewport(390)
      await shell.updateComplete
      await openWithFocus(shell)
      expect(shell.menuOpen).toBe(true)
      viewport(1024)
      await shell.updateComplete
      expect(shell.menuOpen).toBe(false)
      expect(region(shell).hasAttribute('role')).toBe(false)
      const outside = document.createElement('button')
      document.body.append(outside)
      outside.focus()
      expect(deepActiveElement()).toBe(outside)
      outside.remove()
    } finally {
      viewport(1024)
    }
  })

  it('lets the focus go once it is closed', async () => {
    const shell = await mount()
    await openWithFocus(shell)
    menuButton(shell).click()
    await shell.updateComplete
    const outside = document.createElement('button')
    document.body.append(outside)
    outside.focus()
    expect(deepActiveElement()).toBe(outside)
    outside.remove()
  })
})

describe('the name is the page h1 in the side layout', () => {
  // Both bars are in the tree here; on a page `.lintje-top-bar` is `display: none`
  // below 768 px and `.lintje-mobile-header` from 768 px up, so each width shows
  // exactly one of the two h1s below.
  it('stands once in the top bar and once in the mobile header, nowhere else', async () => {
    const shell = await mount()
    const headings = Array.from(root(shell).querySelectorAll('h1'))
    expect(headings).toHaveLength(2)
    const topBar = root(shell).querySelectorAll('.lintje-top-bar h1')
    const mobile = root(shell).querySelectorAll('.lintje-mobile-header h1')
    expect(topBar).toHaveLength(1)
    expect(mobile).toHaveLength(1)
    for (const heading of [topBar[0], mobile[0]]) {
      expect(heading.textContent).toBe('Dashboard Vergunningen')
    }
    // The top bar's keeps its look; the mobile header draws no name, so its h1 is for the outline only.
    expect(topBar[0].classList.contains('lintje-top-bar__dashboard')).toBe(true)
    expect(mobile[0].classList.contains('visually-hidden')).toBe(true)
  })
})

describe('the top layout keeps the skip link first and one h1', () => {
  const NAVIGATION: ShellData['navigation'] = [
    { label: 'Overzicht', icon: 'functioneel-home', href: '/', active: true },
    {
      label: 'Vergunningen',
      links: [{ label: 'Aanvragen', icon: 'functioneel-mail', href: '/requests' }],
    },
  ]
  const top = (): Promise<LintjeShell> => mount({ layout: 'top', navigation: NAVIGATION })

  it('from 768 px up: the skip link before the logo bar, the name the one h1, in the navigation bar', async () => {
    const shell = await top()
    const frame = root(shell).querySelector('.lintje-shell--top') as Element
    const first = tabbables(frame)[0]
    expect(first?.classList.contains('lintje-shell__skip')).toBe(true)
    expect(first?.textContent?.trim()).toBe('Naar de inhoud')
    const headings = Array.from(root(shell).querySelectorAll('h1'))
    expect(headings).toHaveLength(1)
    expect(headings[0].closest('.lintje-navbar')).not.toBeNull()
    expect(headings[0].textContent).toBe('Dashboard Vergunningen')
    expect(root(shell).querySelector('.lintje-logobar h1, .lintje-top-bar')).toBeNull()
  })

  it('below 768 px: the skip link first, the name the one h1, in the mobile header, and the menu a trapped dialog', async () => {
    try {
      const shell = await top()
      viewport(390)
      await shell.updateComplete
      expect(root(shell).querySelector('.lintje-shell__mobile-bar')).not.toBeNull()
      const frame = root(shell).querySelector('.lintje-shell--top') as Element
      expect(tabbables(frame)[0]?.classList.contains('lintje-shell__skip')).toBe(true)
      const headings = Array.from(root(shell).querySelectorAll('h1'))
      expect(headings).toHaveLength(1)
      expect(headings[0].classList.contains('lintje-mobile-header__title')).toBe(true)
      expect(headings[0].textContent).toBe('Dashboard Vergunningen')

      const button = root(shell).querySelector<HTMLButtonElement>(
        '[aria-controls="lintje-mobile-menu-panel"]',
      )!
      button.focus()
      button.click()
      await shell.updateComplete
      const region = root(shell).querySelector('.lintje-mobile-chrome')!
      expect(region.getAttribute('role')).toBe('dialog')
      expect(region.getAttribute('aria-modal')).toBe('true')
      viewport(1024)
      await shell.updateComplete
      expect(shell.menuOpen).toBe(false)
    } finally {
      viewport(1024)
    }
  })
})

/** The open mobile menu locks the page behind it, as every overlay does (counted, `lockScroll`). */
describe('the open mobile menu locks the page', () => {
  const NAVIGATION: ShellData['navigation'] = [
    { label: 'Overzicht', icon: 'functioneel-home', href: '/', active: true },
    {
      label: 'Vergunningen',
      links: [{ label: 'Aanvragen', icon: 'functioneel-mail', href: '/requests' }],
    },
  ]

  afterEach(() => {
    viewport(1024)
    document.body.style.overflow = ''
  })

  for (const layout of ['side', 'top'] as const) {
    it(`in the ${layout} layout: on opening, and lets go on every way out`, async () => {
      // happy-dom announces a media change only after a resize across the breakpoint.
      const shell = await mount({ layout, navigation: NAVIGATION })
      viewport(390)
      await shell.updateComplete
      expect(document.body.style.overflow).toBe('')

      // The button.
      await open(shell)
      expect(document.body.style.overflow).toBe('hidden')
      await open(shell)
      expect(shell.menuOpen).toBe(false)
      expect(document.body.style.overflow).toBe('')

      // Escape.
      await open(shell)
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await shell.updateComplete
      expect(document.body.style.overflow).toBe('')

      // A chosen page.
      await open(shell)
      root(shell).querySelector<HTMLAnchorElement>('a.lintje-mobile-menu__item')!.click()
      await shell.updateComplete
      expect(shell.menuOpen).toBe(false)
      expect(document.body.style.overflow).toBe('')

      // A viewport of 768 px or wider.
      await open(shell)
      viewport(1024)
      await shell.updateComplete
      expect(document.body.style.overflow).toBe('')

      // The shell leaving the page.
      viewport(390)
      await shell.updateComplete
      await open(shell)
      expect(document.body.style.overflow).toBe('hidden')
      shell.remove()
      expect(document.body.style.overflow).toBe('')
    })
  }
})

/**
 * The top layout's submenu closes when it can no longer be used: the focus Tabbed out of the
 * navigation bar, or the bar gave way to the mobile header below 768 px.
 */
describe('the top layout submenu', () => {
  const NAVIGATION: ShellData['navigation'] = [
    { label: 'Overzicht', icon: 'functioneel-home', href: '/', active: true },
    {
      label: 'Vergunningen',
      links: [{ label: 'Aanvragen', icon: 'functioneel-mail', href: '/requests' }],
    },
  ]

  async function opened(): Promise<LintjeShell> {
    const shell = await mount({ layout: 'top', navigation: NAVIGATION })
    root(shell)
      .querySelector('button.lintje-navbar__entry')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, detail: 0 }))
    await shell.updateComplete
    expect(shell.openGroup).toBe(1)
    return shell
  }

  function focusOut(from: Element, to: EventTarget | null): void {
    from.dispatchEvent(
      new FocusEvent('focusout', { bubbles: true, composed: true, relatedTarget: to }),
    )
  }

  afterEach(() => viewport(1024))

  it('stays open while the focus moves inside the bar, and closes when it leaves it', async () => {
    const shell = await opened()
    const entry = root(shell).querySelector('button.lintje-navbar__entry')!
    const page = root(shell).querySelector('a.lintje-navbar__page')!
    focusOut(entry, page)
    await shell.updateComplete
    expect(shell.openGroup).toBe(1)
    // Tab past the last page: the next stop is the page's own content.
    const content = document.createElement('button')
    document.body.append(content)
    focusOut(page, content)
    await shell.updateComplete
    expect(shell.openGroup).toBeNull()
    expect(root(shell).querySelector('.lintje-navbar__submenu')).toBeNull()
    content.remove()
  })

  it('closes below 768 px, and is still closed when the viewport widens again', async () => {
    const shell = await opened()
    viewport(390)
    await shell.updateComplete
    expect(shell.openGroup).toBeNull()
    viewport(1024)
    await shell.updateComplete
    expect(root(shell).querySelector('.lintje-navbar__submenu')).toBeNull()
  })

  it('leaves Escape to a dialog opened over the bar', async () => {
    const shell = await opened()
    const dialog = document.createElement('div')
    dialog.setAttribute('aria-modal', 'true')
    dialog.innerHTML = '<button>Sluiten</button>'
    document.body.append(dialog)
    dialog.querySelector('button')!.focus()
    dialog
      .querySelector('button')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await shell.updateComplete
    expect(shell.openGroup).toBe(1)
    dialog.remove()
  })
})

/**
 * The navigation bar is one row: entries that do not fit give way to "Menu". happy-dom has no
 * layout, so the widths the fit is measured on are told.
 */
describe('the top layout when the entries do not fit', () => {
  const navigation = (active?: string): ShellData['navigation'] => [
    { label: 'Overzicht', icon: 'functioneel-home', href: '/', active: active === '/' },
    {
      label: 'Vergunningen',
      links: [
        {
          label: 'Aanvragen',
          icon: 'functioneel-mail',
          href: '/requests',
          active: active === '/requests',
        },
      ],
    },
    {
      label: 'Beheer',
      links: [
        {
          label: 'Gebruikers',
          icon: 'functioneel-gebruiker',
          href: '/users',
          active: active === '/users',
        },
      ],
    },
  ]

  /** Mounts the top layout with the entries `need` px wide in `room` px. */
  async function fitted(need: number, room: number, active = '/'): Promise<LintjeShell> {
    const shell = await mount({ layout: 'top', navigation: navigation(active) })
    const nav = root(shell).querySelector<HTMLElement>('.lintje-navbar__entries')!
    const list = root(shell).querySelector<HTMLElement>('.lintje-navbar__list')!
    nav.getBoundingClientRect = () => ({ width: room }) as DOMRect
    list.getBoundingClientRect = () => ({ width: need }) as DOMRect
    shell.submenu.measure()
    await shell.updateComplete
    return shell
  }

  const menu = (shell: LintjeShell): HTMLButtonElement | null =>
    root(shell).querySelector<HTMLButtonElement>('.lintje-navbar__entry--menu')

  async function openMenu(shell: LintjeShell): Promise<HTMLButtonElement> {
    const button = menu(shell)!
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, detail: 0 }))
    await shell.updateComplete
    return button
  }

  it('keeps the entries while they fit, and draws "Menu" in their place when they do not', async () => {
    const roomy = await fitted(400, 600)
    expect(roomy.submenu.collapsed).toBe(false)
    expect(menu(roomy)).toBeNull()

    const shell = await fitted(700, 600)
    expect(shell.submenu.collapsed).toBe(true)
    const list = root(shell).querySelector('.lintje-navbar__list')!
    expect(list.hasAttribute('inert')).toBe(true)
    expect(menu(shell)!.textContent!.trim()).toBe('Menu')

    // The same widths measured again do not flip it back: neither depends on the outcome.
    shell.submenu.measure()
    await shell.updateComplete
    expect(shell.submenu.collapsed).toBe(true)
  })

  it('opens one panel with every group, veils the page and closes on Escape', async () => {
    const shell = await fitted(700, 600)
    menu(shell)!.focus()
    const button = await openMenu(shell)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    const menuPanel = root(shell).querySelector(`#${button.getAttribute('aria-controls')}`)!
    expect(
      [...menuPanel.querySelectorAll('.lintje-navbar__heading')].map((h) => h.textContent),
    ).toEqual(['Vergunningen', 'Beheer'])
    expect(menuPanel.querySelectorAll('.lintje-navbar__page')).toHaveLength(3)
    expect(root(shell).querySelector('.lintje-header-scrim')).not.toBeNull()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await shell.updateComplete
    expect(shell.openGroup).toBeNull()
    expect(root(shell).querySelector('.lintje-navbar__submenu')).toBeNull()
    expect(root(shell).activeElement).toBe(button)
  })

  it('closes on a click outside the bar and when a page is chosen', async () => {
    const shell = await fitted(700, 600)
    await openMenu(shell)
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await shell.updateComplete
    expect(shell.openGroup).toBeNull()

    await openMenu(shell)
    root(shell)
      .querySelector<HTMLAnchorElement>('.lintje-navbar__submenu a.lintje-navbar__page')!
      .dispatchEvent(
        new MouseEvent('click', { bubbles: true, composed: true, cancelable: true, button: 0 }),
      )
    await shell.updateComplete
    expect(shell.openGroup).toBeNull()
  })

  it("never marks Menu, even with the reader's page in it", async () => {
    expect(menu(await fitted(700, 600, '/users'))!.classList).not.toContain('is-active')
  })

  it('closes what was open when the bar collapses or widens again', async () => {
    const shell = await fitted(700, 600)
    await openMenu(shell)
    const nav = root(shell).querySelector<HTMLElement>('.lintje-navbar__entries')!
    nav.getBoundingClientRect = () => ({ width: 900 }) as DOMRect
    shell.submenu.measure()
    await shell.updateComplete
    expect(shell.submenu.collapsed).toBe(false)
    expect(shell.openGroup).toBeNull()
    expect(menu(shell)).toBeNull()
  })
})

describe('"Weergave" and a dialog over it', () => {
  it('leaves Escape to the dialog that holds the focus', async () => {
    const shell = await view(await mount())
    const dialog = document.createElement('div')
    dialog.setAttribute('aria-modal', 'true')
    dialog.innerHTML = '<button>Sluiten</button>'
    document.body.append(dialog)
    dialog.querySelector('button')!.focus()
    dialog
      .querySelector('button')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await shell.updateComplete
    expect(shell.viewOpen).toBe(true)
    expect(deepActiveElement()).toBe(dialog.querySelector('button'))
    dialog.remove()
  })
})

/** Without a title or content, a page that is all `full` (a conversation) takes the whole room. */
describe('the content box', () => {
  async function mountWith(markup: string): Promise<LintjeShell> {
    const shell = document.createElement('lintje-shell')
    shell.innerHTML = markup
    shell.data = DATA
    document.body.append(shell)
    mounted.push(shell)
    await shell.updateComplete
    // happy-dom fires no `slotchange` for a slot's first assignment; a browser does.
    for (const slot of root(shell).querySelectorAll('.lintje-shell__content slot')) {
      slot.dispatchEvent(new Event('slotchange'))
    }
    await shell.updateComplete
    return shell
  }
  const main = (shell: LintjeShell): HTMLElement => root(shell).querySelector('main')!
  const box = (shell: LintjeShell): HTMLElement =>
    root(shell).querySelector('.lintje-shell__content')!

  it('is hidden, and main bare, with nothing in the header and default slots', async () => {
    const shell = await mountWith('<div slot="full">Gesprek</div>\n  ')
    expect(shell.hasContent).toBe(false)
    expect(box(shell).hidden).toBe(true)
    expect(main(shell).classList).toContain('is-bare')
  })

  it('is drawn for a title in the header slot, and for content in the default slot', async () => {
    for (const markup of ['<div slot="header">Titel</div>', '<p>Inhoud</p>']) {
      const shell = await mountWith(`<div slot="full">Filters</div>${markup}`)
      expect(shell.hasContent, markup).toBe(true)
      expect(box(shell).hidden, markup).toBe(false)
      expect(main(shell).classList, markup).not.toContain('is-bare')
    }
  })

  it('turns bare once the content leaves', async () => {
    const shell = await mountWith('<div slot="full">Gesprek</div><p>Inhoud</p>')
    expect(main(shell).classList).not.toContain('is-bare')
    shell.querySelector('p')!.remove()
    await new Promise((resolve) => setTimeout(resolve))
    await shell.updateComplete
    expect(main(shell).classList).toContain('is-bare')
  })
})

// Read from disk, not imported: vitest does not run the CSS pipeline.
describe('the name in the top layout’s phone bar', () => {
  it('is 1rem/700 at 1.2, at most two lines, then cut', async () => {
    const { readFileSync } = await import('node:fs')
    const css = readFileSync('src/components/frame/shell/shell.css', 'utf8').replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    )
    const rule = /\.lintje-mobile-header__title\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(rule).toContain('font: var(--text-dashboard);')
    expect(rule).toContain('font-size: 1rem;')
    // The shorthand resets the size, so the size comes after it.
    expect(rule.indexOf('font:')).toBeLessThan(rule.indexOf('font-size:'))
    expect(rule).toContain('-webkit-line-clamp: 2;')
    expect(rule).toContain('line-clamp: 2;')
    expect(rule).toContain('overflow: hidden;')
  })
})

describe('lintje-shell, the top bar’s tools', () => {
  it('draws search with its word and key, and the bare icons when they do not fit', async () => {
    const shell = await mount({ search: true })
    const actions = root(shell).querySelector('.lintje-top-bar__actions')!
    let opened = 0
    shell.addEventListener('lintje-search-open', () => opened++)
    const search = actions.querySelector('lintje-button[icon="functioneel-zoek"]')!
    expect(search.hasAttribute('aria-keyshortcuts')).toBe(false)
    expect(search.shadowRoot!.querySelector('button')!.getAttribute('aria-keyshortcuts')).toBe('/')
    expect(search.querySelector('kbd')!.getAttribute('aria-hidden')).toBe('true')
    search.dispatchEvent(new MouseEvent('click'))
    expect(opened).toBe(1)
    expect(actions.querySelectorAll('lintje-button')).toHaveLength(3)

    shell.toolsCompact = true
    await shell.updateComplete
    expect(actions.querySelector('lintje-button')).toBeNull()
    const tools = [...actions.querySelectorAll('.lintje-shell__tool')]
    expect(tools.map((tool) => tool.getAttribute('aria-label'))).toEqual([
      'Zoeken',
      'Weergave',
      'Delen',
    ])
  })
})

/** Below 1440 px the side menu is a rail: the keyboard reaches all of it, Escape folds it. */
describe('the rail and the keyboard', () => {
  const nav = (shell: LintjeShell): HTMLElement =>
    root(shell).querySelector<HTMLElement>('.lintje-nav')!

  it('names every row in the rail and ties a heading to its rows', async () => {
    const shell = await mount()
    const link = nav(shell).querySelector('a.lintje-nav__item')!
    expect(link.querySelector('.visually-hidden')?.textContent).toBe('Overzicht')
    const group = nav(shell).querySelector('[role="group"]')!
    const heading = root(shell).getElementById(group.getAttribute('aria-labelledby')!)!
    expect(heading.textContent!.trim()).toBe('Overzicht')
  })

  it('expands when the focus comes in, folds on Escape and when the focus leaves', async () => {
    const shell = await mount({ logout: { href: '/auth/logout', token: 't' } })
    const link = nav(shell).querySelector<HTMLAnchorElement>('a.lintje-nav__item')!
    link.focus()
    await shell.updateComplete
    expect(shell.railExpanded).toBe(true)
    // Expanded, "Afmelden" is in the tab order.
    const logout = nav(shell).querySelector<HTMLButtonElement>('.lintje-nav__logout-button')!
    expect(logout.closest('form')!.hidden).toBe(false)

    link.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await shell.updateComplete
    expect(shell.railExpanded).toBe(false)
    expect(root(shell).activeElement).toBe(link)

    shell.railExpanded = true
    await shell.updateComplete
    nav(shell).dispatchEvent(new FocusEvent('focusout', { relatedTarget: document.body }))
    await shell.updateComplete
    expect(shell.railExpanded).toBe(false)
  })

  it('hands the focus on when Escape folds away the control that had it', async () => {
    const shell = await mount({ logout: { href: '/auth/logout', token: 't' } })
    const logout = (): HTMLButtonElement =>
      nav(shell).querySelector<HTMLButtonElement>('.lintje-nav__logout-button')!
    nav(shell).querySelector<HTMLAnchorElement>('a.lintje-nav__item')!.focus()
    await shell.updateComplete
    logout().focus()
    logout().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await shell.updateComplete
    await shell.updateComplete
    expect(logout().closest('form')!.hidden).toBe(true)
    expect(root(shell).activeElement).toBe(nav(shell).querySelector('a.lintje-nav__item'))
    // The hand-on does not expand the rail again.
    expect(shell.railExpanded).toBe(false)
  })
})

describe('the mobile menu’s groups', () => {
  it('ties a heading to its rows, and says why a row without a page cannot be opened', async () => {
    const shell = await mount({
      navigation: [
        {
          label: 'Aanvragen',
          links: [{ label: 'Nieuw', href: '/nieuw', active: true }, { label: 'Wachtrij' }],
        },
      ],
    })
    await open(shell)
    const group = panel(shell)!.querySelector('[role="group"]')!
    const heading = root(shell).getElementById(group.getAttribute('aria-labelledby')!)!
    expect(heading.textContent!.trim()).toBe('Aanvragen')
    const muted = group.querySelector('.lintje-mobile-menu__item.is-muted')!
    expect(muted.querySelector('.visually-hidden')!.textContent).toBe(', niet beschikbaar')
  })
})

describe('"Weergave" and "Delen" in the side layout’s top bar', () => {
  const tool = (shell: LintjeShell, name: string): LintjeButton =>
    [...root(shell).querySelectorAll<LintjeButton>('.lintje-top-bar__actions lintje-button')].find(
      (button) => button.textContent!.trim() === name,
    )!

  it('gives the focus back to Weergave when Escape closes its panel', async () => {
    const shell = await mount()
    tool(shell, 'Weergave').focus()
    tool(shell, 'Weergave').click()
    await shell.updateComplete
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await shell.updateComplete
    expect(shell.viewOpen).toBe(false)
    expect(root(shell).activeElement).toBe(tool(shell, 'Weergave'))
  })

  it('is a disclosure: plain buttons, Escape closes it and the focus goes back to Delen', async () => {
    const shell = await mount()
    tool(shell, 'Delen').focus()
    tool(shell, 'Delen').click()
    await shell.updateComplete
    const popover = root(shell).querySelector('.lintje-top-bar .lintje-share__popover')!
    expect(popover.getAttribute('role')).toBe('group')
    expect(popover.querySelector('[role="menuitem"]')).toBeNull()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await shell.updateComplete
    expect(shell.shareOpen).toBe(false)
    expect(root(shell).activeElement).toBe(tool(shell, 'Delen'))
  })

  it('gives the focus back to Delen after an item that is done', async () => {
    const shell = await mount()
    for (const label of ['Link naar deze weergave', 'Verstuur als e-mail']) {
      tool(shell, 'Delen').click()
      await shell.updateComplete
      const item = [
        ...root(shell).querySelectorAll<HTMLButtonElement>('.lintje-top-bar .lintje-share__item'),
      ].find((button) => button.textContent!.trim() === label)!
      item.focus()
      item.click()
      await shell.updateComplete
      expect(shell.shareOpen).toBe(false)
      expect(root(shell).activeElement).toBe(tool(shell, 'Delen'))
    }
  })

  it('closes once the focus leaves the panel and its tool, and stays open inside them', async () => {
    const shell = await mount()
    for (const [name, isOpen] of [
      ['Weergave', () => shell.viewOpen],
      ['Delen', () => shell.shareOpen],
    ] as const) {
      tool(shell, name).click()
      await shell.updateComplete
      const box = tool(shell, name).parentElement!
      const inner = box.querySelector<HTMLElement>(
        '.lintje-view__popover button, .lintje-share__item',
      )!
      const leave = (from: Element, to: EventTarget | null): void => {
        from.dispatchEvent(
          new FocusEvent('focusout', { bubbles: true, composed: true, relatedTarget: to }),
        )
      }
      leave(tool(shell, name), inner)
      leave(inner, null)
      await shell.updateComplete
      expect(isOpen()).toBe(true)
      // Tab past the last item: the next stop is the page's own content.
      const content = document.createElement('button')
      document.body.append(content)
      leave(inner, content)
      await shell.updateComplete
      expect(isOpen()).toBe(false)
      content.remove()
    }
  })

  it('closes on an Escape pressed elsewhere without taking the focus from there', async () => {
    const shell = await mount()
    tool(shell, 'Delen').click()
    await shell.updateComplete
    const elsewhere = document.createElement('button')
    document.body.append(elsewhere)
    elsewhere.focus()
    elsewhere.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await shell.updateComplete
    expect(shell.shareOpen).toBe(false)
    expect(document.activeElement).toBe(elsewhere)
    elsewhere.remove()
  })
})

describe('the bars that stay at the top', () => {
  afterEach(() => {
    clearFilterZone()
  })

  it('keep their height free above a control scrolled into view', async () => {
    clearFilterZone()
    const scroller = document.scrollingElement as HTMLElement
    const shell = await mount()
    expect(scroller.style.scrollPaddingTop).toBe('56px')
    setFrameState({ hasFilters: true })
    await shell.updateComplete
    expect(scroller.style.scrollPaddingTop).toBe('104px')
    shell.remove()
    expect(scroller.style.scrollPaddingTop).toBe('')
  })

  it('give the whole name where the top layout cuts it', async () => {
    const shell = await mount({ layout: 'top' })
    const name = root(shell).querySelector('h1.lintje-shell__name')!
    expect(name.getAttribute('title')).toBe('Dashboard Vergunningen')
  })
})
