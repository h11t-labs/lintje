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

  it('draws the content without button and popover when inline', async () => {
    const element = await mount({ inline: true })
    const root = element.shadowRoot!
    expect(root.querySelector('.lintje-user-menu__trigger')).toBeNull()
    expect(root.querySelector('lintje-popover')).toBeNull()
    expect(root.querySelector('[role="menuitem"]')).toBeNull()
    expect(root.querySelectorAll('.lintje-menu__row')).toHaveLength(4)
  })
})
