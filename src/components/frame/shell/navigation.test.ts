/**
 * A row of the side menu: the page the host marks active, a row without a page, and the menu
 * badge as a screen reader hears it: with a `label` the figure is only seen and the label only
 * heard; without one, the badge is unchanged.
 */
import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { render } from 'lit'
import { beforeEach, describe, expect, it } from 'vitest'
import { navRow } from './navigation'
import type { LintjeShell } from './shell'
import type { ShellLink } from '../../../types'

/** The one thing `navRow` asks of the shell. */
const shell = { follow: () => {} } as unknown as LintjeShell

function badge(item: Partial<ShellLink>): HTMLElement {
  const host = document.createElement('div')
  document.body.append(host)
  render(
    navRow(
      shell,
      { label: 'Herkomst', icon: 'functioneel-locatiemarker', href: '/h', ...item },
      true,
    ),
    host,
  )
  return host.querySelector('.lintje-nav__badge') as HTMLElement
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('the menu badge', () => {
  it('hides the bare figure and speaks the label', () => {
    const element = badge({ badge: { value: 3, tone: 'action', label: '3 nieuwe meldingen' } })
    expect(element.querySelector('[aria-hidden="true"]')?.textContent).toBe('3')
    expect(element.querySelector('.visually-hidden')?.textContent).toBe('3 nieuwe meldingen')
  })

  it('draws the value as it stands without a label', () => {
    const element = badge({ badge: { value: 3, tone: 'action' } })
    expect(element.textContent?.trim()).toBe('3')
    expect(element.querySelector('[aria-hidden], .visually-hidden')).toBeNull()
  })

  it('is muted on an entry without a page', () => {
    const element = badge({ href: undefined, badge: { value: 3, tone: 'action' } })
    expect(element.classList.contains('lintje-badge')).toBe(true)
    expect(element.classList.contains('lintje-badge--nav')).toBe(true)
    expect(element.classList.contains('is-muted')).toBe(true)
  })

  it('draws through the primitive badge, on the menu surface for a count and a word', () => {
    const action = badge({ badge: { value: 3, tone: 'action' } })
    expect([...action.classList]).toEqual(
      expect.arrayContaining(['lintje-badge', 'lintje-badge--unread', 'lintje-nav__badge']),
    )
    expect(action.classList.contains('lintje-badge--nav')).toBe(false)
    const count = badge({ badge: { value: 12, tone: 'count' } })
    expect([...count.classList]).toEqual(
      expect.arrayContaining(['lintje-badge--unread', 'lintje-badge--nav']),
    )
    const word = badge({ badge: { value: 'NIEUW', tone: 'new' } })
    expect([...word.classList]).toEqual(
      expect.arrayContaining([
        'lintje-badge--label',
        'lintje-badge--nav',
        'lintje-nav__badge--new',
      ]),
    )
    expect(word.classList.contains('lintje-badge--neutral')).toBe(false)
  })
})

describe('a row in the side menu', () => {
  function row(item: ShellLink, follow: (href: string) => void = () => {}): HTMLElement {
    const host = document.createElement('div')
    document.body.append(host)
    render(navRow({ follow } as unknown as LintjeShell, item, true), host)
    return host.querySelector('.lintje-nav__item') as HTMLElement
  }

  it('is the page the host marks active, and hands a plain click to the shell with its href', () => {
    const followed: string[] = []
    const active = row({ label: 'Herkomst', href: '/h', active: true }, (href) =>
      followed.push(href),
    )
    expect(active.tagName).toBe('A')
    expect(active.getAttribute('aria-current')).toBe('page')
    expect(active.classList.contains('is-active')).toBe(true)
    active.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))
    active.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, metaKey: true }),
    )
    expect(followed).toEqual(['/h'])

    const other = row({ label: 'Bestemming', href: '/b' })
    expect(other.hasAttribute('aria-current')).toBe(false)
  })

  it('keeps its label for a screen reader in the rail, where only the icon shows', () => {
    const host = document.createElement('div')
    document.body.append(host)
    render(navRow(shell, { label: 'Herkomst', icon: 'functioneel-home', href: '/h' }, false), host)
    const link = host.querySelector('a')!
    expect(link.querySelector('.lintje-nav__label')).toBeNull()
    expect(link.querySelector('.visually-hidden')?.textContent).toBe('Herkomst')
  })

  it('says in words why a row cannot be opened, not by its colour alone', () => {
    expect(row({ label: 'Herkomst' }).querySelector('.visually-hidden')?.textContent).toBe(
      ', niet beschikbaar',
    )
    // Expanded, the lock says it; in the rail the words do.
    const host = document.createElement('div')
    document.body.append(host)
    render(navRow(shell, { label: 'Herkomst', href: '/h', noAccess: true }, false), host)
    expect(host.textContent).toContain(', geen toegang')
  })

  it('is muted without an href, and struck through with a lock without access', () => {
    const none = row({ label: 'Herkomst' })
    expect(none.tagName).toBe('SPAN')
    expect(none.getAttribute('aria-disabled')).toBe('true')
    expect(none.classList.contains('is-no-page')).toBe(true)
    const locked = row({ label: 'Herkomst', href: '/h', noAccess: true })
    expect(locked.tagName).toBe('SPAN')
    expect(locked.classList.contains('is-no-access')).toBe(true)
  })
})

// Read from disk, not imported: vitest does not run the CSS pipeline.
const navigationCss = readFileSync(resolvePath('src/components/frame/shell/navigation.css'), 'utf8')

describe('the badge in the rail', () => {
  it("stands at the icon's top right, --space-1 from the rail's edge", () => {
    const rule =
      /\.lintje-nav--rail:not\(\.is-expanded\) \.lintje-nav__badge\s*\{([^}]*)\}/.exec(
        navigationCss,
      )?.[1] ?? ''
    expect(rule).toMatch(/right:\s*var\(--space-1\)/)
  })
})
