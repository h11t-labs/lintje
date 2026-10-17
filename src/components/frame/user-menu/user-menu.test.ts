/**
 * The user menu: the avatar button's ARIA, name and role outside the menu rows, the rows and
 * "Afmelden" as a request or as a real POST form, and the inline form for the mobile navigation.
 */
import { afterEach, describe, expect, it } from 'vitest'
import './user-menu'
import type { LintjeUserMenu } from './user-menu'
import type { MenuEntry } from '../../actions/menu-button/menu-button'

const ITEMS: MenuEntry[] = [
  { value: 'weergave', label: 'Weergave' },
  { value: 'sneltoetsen', label: 'Sneltoetsen', hint: '?' },
  { value: 'feedback', label: 'Vragen of feedback', href: '/feedback' },
]

afterEach(() => {
  document.body.innerHTML = ''
})

async function mount(props: Partial<LintjeUserMenu> = {}): Promise<LintjeUserMenu> {
  const element = Object.assign(document.createElement('lintje-user-menu'), {
    user: { name: 'J. de Vries', role: 'Teamleider · Dienst Vergunningen', initials: 'JV' },
    items: ITEMS,
    version: '2.4.1',
    ...props,
  })
  document.body.append(element)
  await element.updateComplete
  return element
}

const trigger = (element: LintjeUserMenu): HTMLButtonElement =>
  element.shadowRoot!.querySelector('.lintje-user-menu__trigger')!

describe('lintje-user-menu', () => {
  it('draws a heading and its rows as a named group, as the menu button does', async () => {
    const element = await mount({
      items: [{ heading: 'Account' }, { value: 'profiel', label: 'Profiel' }],
    })
    const group = element.shadowRoot!.querySelector('[role="group"][aria-labelledby]')!
    const heading = element.shadowRoot!.getElementById(group.getAttribute('aria-labelledby')!)!
    expect(heading.textContent!.trim()).toBe('Account')
    expect(group.querySelector('.lintje-menu__label')!.textContent).toBe('Profiel')
  })

  it('names the avatar button and opens the menu on a click', async () => {
    const element = await mount()
    const button = trigger(element)
    // The initials the button shows are in its name (2.5.3).
    expect(button.getAttribute('aria-label')).toBe('JV, menu van J. de Vries')
    expect(button.getAttribute('aria-haspopup')).toBe('menu')
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(button.textContent!.trim()).toBe('JV')
    const popover = element.shadowRoot!.querySelector('lintje-popover')!
    expect(button.getAttribute('aria-controls')).toBe(popover.id)

    button.click()
    await element.updateComplete
    expect(element.open).toBe(true)
    expect(popover.getAttribute('placement')).toBe('bottom-end')
  })

  it('puts name and role above the menu, the rows and Afmelden inside it, the version below', async () => {
    const element = await mount({ open: true })
    const root = element.shadowRoot!
    const menu = root.querySelector('[role="menu"]')!
    expect(menu.textContent).not.toContain('J. de Vries')
    expect(root.querySelector('.lintje-user-menu__name')!.textContent).toBe('J. de Vries')
    const rows = [...menu.querySelectorAll('[role="menuitem"]')].map(
      (row) => row.querySelector('.lintje-menu__label')!.textContent,
    )
    expect(rows).toEqual(['Weergave', 'Sneltoetsen', 'Vragen of feedback', 'Afmelden'])
    expect(root.querySelector('.lintje-user-menu__version')!.textContent).toBe('Versie 2.4.1')
  })

  it('sends a row’s value and, for a link row, lintje-navigate; it closes after a choice', async () => {
    const element = await mount({ open: true })
    const actions: unknown[] = []
    const hrefs: unknown[] = []
    element.addEventListener('lintje-action', (event) =>
      actions.push((event as CustomEvent).detail),
    )
    element.addEventListener('lintje-navigate', (event) =>
      hrefs.push((event as CustomEvent).detail),
    )
    const rows = [...element.shadowRoot!.querySelectorAll<HTMLElement>('[role="menuitem"]')]
    rows[1].click()
    rows[2].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))
    expect(actions).toEqual(['sneltoetsen', 'feedback'])
    expect(hrefs).toEqual([{ href: '/feedback' }])
    expect(element.open).toBe(false)
  })

  it('asks to log out without logout-action, and posts a form with the token with it', async () => {
    const asking = await mount({ open: true })
    let logouts = 0
    asking.addEventListener('lintje-logout', () => logouts++)
    asking.shadowRoot!.querySelector<HTMLButtonElement>('.lintje-user-menu__logout-row')!.click()
    expect(logouts).toBe(1)
    // The row leaves with the menu: the focus goes back to the avatar.
    expect(asking.shadowRoot!.activeElement).toBe(trigger(asking))

    const posting = await mount({ open: true, logoutAction: '/auth/logout', csrf: 'abc123' })
    const form = posting.shadowRoot!.querySelector('form')!
    expect(form.getAttribute('method')).toBe('post')
    expect(form.getAttribute('action')).toBe('/auth/logout')
    const token = form.querySelector<HTMLInputElement>('input[type="hidden"]')!
    expect(token.name).toBe('csrf_token')
    expect(token.value).toBe('abc123')
    expect(form.querySelector('button')!.getAttribute('type')).toBe('submit')
  })

  it('closes itself on Escape, but leaves Escape to a dialog opened over it', async () => {
    const element = await mount({ open: true })
    const dialog = document.createElement('div')
    dialog.setAttribute('aria-modal', 'true')
    dialog.innerHTML = '<button>Sluiten</button>'
    document.body.append(dialog)
    const inDialog = dialog.querySelector('button')!
    inDialog.focus()
    // The focus leaving closed it; open again to see the Escape.
    element.open = true
    await element.updateComplete
    inDialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await element.updateComplete
    expect(element.open).toBe(true)

    dialog.remove()
    trigger(element).focus()
    trigger(element).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }),
    )
    await element.updateComplete
    expect(element.open).toBe(false)
  })

  it('shows a disabled row’s reason as a tooltip, which focus reaches, not as a title', async () => {
    const element = await mount({
      open: true,
      items: [{ value: 'export', label: 'Exporteren', disabled: true, reason: 'Geen rechten' }],
    })
    const tip = element.shadowRoot!.querySelector('lintje-tooltip')!
    const row = tip.querySelector<HTMLButtonElement>('.lintje-menu__row')!
    expect(tip.getAttribute('text')).toBe('Geen rechten')
    expect(row.hasAttribute('title')).toBe(false)
    expect(row.getAttribute('aria-disabled')).toBe('true')
  })

  it.each([
    [false, 'menuitemcheckbox', 'menuitemradio'],
    [true, 'checkbox', 'radio'],
  ])(
    'draws a switch with its check and a choice with its circle, and says their state (inline: %s)',
    async (inline, switchRole, choiceRole) => {
      const element = await mount({
        inline,
        items: [
          { value: 'compact', label: 'Compacte weergave', checked: true },
          { value: 'hulp', label: 'Hulpteksten', checked: false },
          { heading: 'Taal' },
          { value: 'nl', label: 'Nederlands', checked: true, radio: true },
          { value: 'en', label: 'English', checked: false, radio: true },
        ],
      })
      const rows = [...element.shadowRoot!.querySelectorAll<HTMLElement>('button.lintje-menu__row')]
      const switched = rows.slice(0, 4)
      expect(switched.map((row) => row.getAttribute('role'))).toEqual([
        switchRole,
        switchRole,
        choiceRole,
        choiceRole,
      ])
      expect(switched.map((row) => row.getAttribute('aria-checked'))).toEqual([
        'true',
        'false',
        'true',
        'false',
      ])
      expect(switched[0].querySelector('.lintje-menu__check')).not.toBeNull()
      expect(switched[1].querySelector('.lintje-menu__slot')).not.toBeNull()
      expect(switched[2].querySelector('.lintje-menu__radio.is-checked')).not.toBeNull()
      expect(switched[3].querySelector('.lintje-menu__radio:not(.is-checked)')).not.toBeNull()
      // Afmelden is no switch.
      expect(rows.at(-1)!.hasAttribute('aria-checked')).toBe(false)
    },
  )

  it('draws the content without button and popover when inline', async () => {
    const element = await mount({ inline: true })
    const root = element.shadowRoot!
    expect(root.querySelector('.lintje-user-menu__trigger')).toBeNull()
    expect(root.querySelector('lintje-popover')).toBeNull()
    expect(root.querySelector('[role="menuitem"]')).toBeNull()
    expect(root.querySelectorAll('.lintje-menu__row')).toHaveLength(4)
  })
})

describe('the circle of lintje-user-menu', () => {
  it('names the button by the initials it shows, or by the user without them', async () => {
    const element = await mount()
    expect(trigger(element).getAttribute('aria-label')).toBe('JV, menu van J. de Vries')
    element.user = { name: 'J. de Vries', photo: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' }
    await element.updateComplete
    expect(trigger(element).getAttribute('aria-label')).toBe('Menu van J. de Vries')
    expect(trigger(element).querySelector('.lintje-avatar img')).not.toBeNull()
    element.user = { name: 'J. de Vries' }
    await element.updateComplete
    expect(trigger(element).getAttribute('aria-label')).toBe('Menu van J. de Vries')
    expect(trigger(element).querySelector('.lintje-avatar svg')).not.toBeNull()
  })

  it('draws the 2rem circle of renderAvatar() on the menu, in the button and inline', async () => {
    const button = trigger(await mount())
    const avatar = button.querySelector('.lintje-avatar')!
    expect(avatar.classList.contains('lintje-avatar--medium')).toBe(true)
    expect(avatar.classList.contains('lintje-avatar--nav')).toBe(true)
    const inline = await mount({ inline: true })
    const who = inline.shadowRoot!.querySelector('.lintje-user-menu__who')!
    expect(who.querySelector('.lintje-avatar--medium.lintje-avatar--nav')).not.toBeNull()
  })

  it('draws no link for a user with `href`', async () => {
    const element = await mount({
      inline: true,
      user: { name: 'J. de Vries', initials: 'JV', href: '/profiel' },
    })
    expect(element.shadowRoot!.querySelector('.lintje-user-menu__who a')).toBeNull()
  })
})

describe('lintje-user-menu variant="side"', () => {
  it('shows the name and role beside the avatar and opens the menu above it', async () => {
    const element = await mount({ variant: 'side' })
    const button = trigger(element)
    expect(button.classList.contains('lintje-user-menu__trigger--side')).toBe(true)
    expect(button.querySelector('.lintje-user-menu__trigger-name')!.textContent).toBe('J. de Vries')
    // The name it shows is its name; the role describes it.
    expect(button.hasAttribute('aria-label')).toBe(false)
    expect(button.getAttribute('aria-describedby')).toBeTruthy()
    const popover = element.shadowRoot!.querySelector('lintje-popover')!
    expect(popover.getAttribute('placement')).toBe('top-start')
  })

  it('says when it opens and closes, so the side menu can hold its rail', async () => {
    const element = await mount({ variant: 'side' })
    const said: boolean[] = []
    element.addEventListener('lintje-toggle', (event) =>
      said.push((event as CustomEvent<{ open: boolean }>).detail.open),
    )
    trigger(element).click()
    await element.updateComplete
    trigger(element).click()
    await element.updateComplete
    expect(said).toEqual([true, false])
  })

  it('closes on a second press of its button, though the panel hangs under the foot', async () => {
    const element = await mount({ variant: 'side' })
    // A press as the mouse makes it: down, the focus, then the click.
    const press = async (): Promise<void> => {
      const button = trigger(element)
      button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true }))
      button.focus()
      button.click()
      await element.updateComplete
    }
    await press()
    expect(element.open).toBe(true)
    await press()
    expect(element.open).toBe(false)
  })

  it('draws the 2.5rem circle of renderAvatar() on the menu', async () => {
    const avatar = trigger(await mount({ variant: 'side' })).querySelector('.lintje-avatar')!
    expect(avatar.classList.contains('lintje-avatar--large')).toBe(true)
    expect(avatar.classList.contains('lintje-avatar--nav')).toBe(true)
  })

  it('folds to the avatar in the folded rail', async () => {
    const element = await mount({ variant: 'side', folded: true })
    expect(trigger(element).classList.contains('is-folded')).toBe(true)
  })
})
