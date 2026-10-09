/** The submenu: groups, the reader's page, the second level, the action and the phone's button. */
import { afterEach, describe, expect, it } from 'vitest'
import './sub-nav'
import { activeEntry, type LintjeSubNav, type SubNavAction, type SubNavGroup } from './sub-nav'

const GROUPS: SubNavGroup[] = [
  { label: 'Voor al je opnames', items: [{ label: 'Algemeen', href: '#algemeen', active: true }] },
  {
    label: 'Soorten gesprek',
    items: [
      { label: 'Vergadering', href: '#vergadering' },
      { label: 'Hoorzitting', href: '#hoorzitting', badge: { value: 2, label: '2 afwijkingen' } },
      { label: 'Archief', href: '#archief', noAccess: true },
    ],
  },
]
const NESTED: SubNavGroup[] = [
  {
    items: [
      { label: 'Algemeen', href: '#algemeen' },
      {
        label: 'Soorten gesprek',
        href: '#soorten',
        items: [
          { label: 'Vergadering', href: '#vergadering' },
          { label: 'Hoorzitting', href: '#hoorzitting', active: true },
        ],
      },
      { label: 'Sjablonen', href: '#sjablonen', items: [{ label: 'Notulen', href: '#notulen' }] },
    ],
  },
]
const ACTION: SubNavAction = { label: 'Nieuw soort gesprek', value: 'nieuw' }

const viewport = (width: number): void =>
  (
    window as unknown as { happyDOM: { setViewport(size: { width: number }): void } }
  ).happyDOM.setViewport({ width })

async function mount(groups: SubNavGroup[], action?: SubNavAction): Promise<LintjeSubNav> {
  const element = Object.assign(document.createElement('lintje-sub-nav'), {
    groups,
    action,
    label: 'Instellingen',
  })
  document.body.append(element)
  await element.updateComplete
  return element
}

afterEach(() => {
  document.body.replaceChildren()
  viewport(1024)
})

describe('lintje-sub-nav', () => {
  it('is a named navigation of labelled lists, with the reader’s page marked', async () => {
    const root = (await mount(GROUPS)).shadowRoot!
    expect(root.querySelector('nav')!.getAttribute('aria-label')).toBe('Instellingen')
    const lists = root.querySelectorAll('ul')
    expect(lists).toHaveLength(2)
    const heading = root.getElementById(lists[1]!.getAttribute('aria-labelledby')!)!
    expect(heading.textContent).toBe('Soorten gesprek')
    const current = root.querySelectorAll('[aria-current]')
    expect(current).toHaveLength(1)
    expect(current[0]!.getAttribute('aria-current')).toBe('page')
    expect(current[0]!.textContent!.trim()).toBe('Algemeen')
  })

  it('draws a count with its spoken label, and no access as text with a lock, not a link', async () => {
    const root = (await mount(GROUPS)).shadowRoot!
    expect(root.querySelector('a[href="#hoorzitting"] .lintje-badge')!.textContent).toContain(
      '2 afwijkingen',
    )
    const locked = root.querySelector('.is-no-access')!
    expect(locked.tagName).toBe('SPAN')
    expect(locked.getAttribute('aria-disabled')).toBe('true')
    expect(locked.textContent).toContain('Archief')
    expect(root.querySelector('a[href="#archief"]')).toBeNull()
  })

  it('says in words that an item without a page is not available', async () => {
    const root = (await mount([{ items: [{ label: 'Rapporten' }] }])).shadowRoot!
    const item = root.querySelector('.is-no-page')!
    expect(item.querySelector('.visually-hidden')!.textContent).toBe(' (niet beschikbaar)')
    expect(item.textContent!.replace(/\s+/g, ' ').trim()).toBe('Rapporten (niet beschikbaar)')
  })

  it('opens the level below only on the reader’s path, and marks its parent', async () => {
    const root = (await mount(NESTED)).shadowRoot!
    const nested = root.querySelectorAll('.lintje-sub-nav__list--nested')
    expect(nested).toHaveLength(1)
    expect(nested[0]!.querySelector('[aria-current="page"]')!.textContent!.trim()).toBe(
      'Hoorzitting',
    )
    expect(root.querySelector('a[href="#soorten"]')!.classList.contains('is-ancestor')).toBe(true)
    expect(root.querySelector('a[href="#notulen"]')).toBeNull()
  })

  it('sends lintje-navigate for a plain click and lintje-action for the action', async () => {
    const element = await mount(GROUPS, ACTION)
    const sent: [string, unknown][] = []
    for (const name of ['lintje-navigate', 'lintje-action']) {
      element.addEventListener(name, (event) => sent.push([name, (event as CustomEvent).detail]))
    }
    const link = element.shadowRoot!.querySelector<HTMLAnchorElement>('a[href="#vergadering"]')!
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true }))
    element.shadowRoot!.querySelector<HTMLButtonElement>('.lintje-sub-nav__link--action')!.click()
    expect(sent).toEqual([
      ['lintje-navigate', { href: '#vergadering' }],
      ['lintje-action', { value: 'nieuw' }],
    ])
  })

  it('is one button with the reader’s page below 768 px; Escape closes it and returns focus', async () => {
    viewport(390)
    const element = await mount(GROUPS, ACTION)
    const root = element.shadowRoot!
    const toggle = root.querySelector<HTMLButtonElement>('.lintje-sub-nav__toggle')!
    expect(toggle.textContent).toContain('Voor al je opnames')
    expect(toggle.textContent).toContain('Algemeen')
    const panel = root.getElementById(toggle.getAttribute('aria-controls')!)!
    expect(panel.hidden).toBe(true)

    toggle.click()
    await element.updateComplete
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(panel.hidden).toBe(false)

    panel
      .querySelector('a')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }))
    await element.updateComplete
    expect(element.open).toBe(false)
    expect(root.activeElement).toBe(toggle)
  })

  it('closes the phone’s list when a page is chosen', async () => {
    viewport(390)
    const element = await mount(GROUPS)
    element.open = true
    await element.updateComplete
    element.addEventListener('lintje-navigate', (event) => event.preventDefault())
    element
      .shadowRoot!.querySelector('a[href="#hoorzitting"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))
    await element.updateComplete
    expect(element.open).toBe(false)
  })

  it('hands the focus to its button when a choice in the phone’s list closes it', async () => {
    viewport(390)
    const element = await mount(GROUPS, ACTION)
    const root = element.shadowRoot!
    const toggle = root.querySelector<HTMLButtonElement>('.lintje-sub-nav__toggle')!
    // The host routes the page itself, so the browser does not leave it.
    element.addEventListener('lintje-navigate', (event) => event.preventDefault())

    element.open = true
    await element.updateComplete
    const link = root.querySelector<HTMLAnchorElement>('a[href="#hoorzitting"]')!
    link.focus()
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))
    await element.updateComplete
    expect(element.open).toBe(false)
    expect(root.activeElement).toBe(toggle)

    element.open = true
    await element.updateComplete
    const action = root.querySelector<HTMLButtonElement>('.lintje-sub-nav__link--action')!
    action.focus()
    action.click()
    await element.updateComplete
    expect(element.open).toBe(false)
    expect(root.activeElement).toBe(toggle)
  })

  it('leaves the focus where it is when the list was not where it stood', async () => {
    viewport(390)
    const element = await mount(GROUPS, ACTION)
    const outside = document.createElement('button')
    document.body.append(outside)
    element.open = true
    await element.updateComplete
    outside.focus()
    element.shadowRoot!.querySelector<HTMLButtonElement>('.lintje-sub-nav__link--action')!.click()
    await element.updateComplete
    expect(element.open).toBe(false)
    expect(document.activeElement).toBe(outside)
  })
})

describe('activeEntry()', () => {
  it('finds the active item at any depth, with its group’s label', () => {
    expect(activeEntry(GROUPS)).toEqual({ item: GROUPS[0]!.items[0], group: 'Voor al je opnames' })
    expect(activeEntry(NESTED)!.item.label).toBe('Hoorzitting')
    expect(activeEntry([{ items: [{ label: 'Los', href: '#los' }] }])).toBeNull()
  })
})
