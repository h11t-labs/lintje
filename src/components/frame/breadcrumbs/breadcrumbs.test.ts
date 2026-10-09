/** The breadcrumbs: the trail's structure, the folded middle and the click it takes over. */
import { describe, expect, it } from 'vitest'
import './breadcrumbs'
import { trail, type Crumb, type LintjeBreadcrumbs } from './breadcrumbs'

const SHORT: Crumb[] = [
  { label: 'Opnames', href: '/opnames' },
  { label: 'Oktober 2026', href: '/opnames/2026-10' },
  { label: 'Teamoverleg 2 oktober' },
]
const LONG: Crumb[] = [
  { label: 'Opnames', href: '/opnames' },
  { label: '2026', href: '/opnames/2026' },
  { label: 'Oktober', href: '/opnames/2026-10' },
  { label: 'Week 40', href: '/opnames/2026-w40' },
  { label: 'Teamoverleg 2 oktober' },
]

async function mount(items: Crumb[]): Promise<LintjeBreadcrumbs> {
  const element = Object.assign(document.createElement('lintje-breadcrumbs'), { items })
  document.body.append(element)
  await element.updateComplete
  return element
}

describe('lintje-breadcrumbs', () => {
  it('is a named navigation with an ordered list and the current page as text', async () => {
    const element = await mount(SHORT)
    const root = element.shadowRoot!
    expect(root.querySelector('nav')!.getAttribute('aria-label')).toBe('Kruimelpad')
    expect(root.querySelectorAll('ol > li')).toHaveLength(3)
    expect(root.querySelectorAll('a')).toHaveLength(2)
    const current = root.querySelector('[aria-current="page"]')!
    expect(current.tagName).toBe('SPAN')
    expect(current.textContent).toBe('Teamoverleg 2 oktober')
    const separators = root.querySelectorAll('.lintje-breadcrumbs__separator')
    expect(separators).toHaveLength(2)
    expect(separators[0]!.getAttribute('aria-hidden')).toBe('true')
  })

  it('folds the middle into a menu beyond four levels', async () => {
    const element = await mount(LONG)
    const root = element.shadowRoot!
    expect(root.querySelectorAll('ol > li')).toHaveLength(4)
    const menu = root.querySelector('lintje-menu-button')!
    expect(menu.getAttribute('variant')).toBe('ellipsis')
    expect(
      menu.items.map((item) =>
        typeof item === 'string' || !('label' in item) ? item : item.label,
      ),
    ).toEqual(['2026', 'Oktober'])
  })

  it('sends lintje-navigate for a plain click and leaves a modified click alone', async () => {
    const element = await mount(SHORT)
    const hrefs: string[] = []
    element.addEventListener('lintje-navigate', (event) =>
      hrefs.push((event as CustomEvent<{ href: string }>).detail.href),
    )
    const link = element.shadowRoot!.querySelector('a')!
    const plain = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    link.dispatchEvent(plain)
    expect(plain.defaultPrevented).toBe(false)
    const modified = new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true })
    link.dispatchEvent(modified)
    expect(modified.defaultPrevented).toBe(false)
    expect(hrefs).toEqual(['/opnames'])
  })

  it('keeps the click from the browser when the host cancels lintje-navigate', async () => {
    const element = await mount(SHORT)
    element.addEventListener('lintje-navigate', (event) => event.preventDefault())
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    element.shadowRoot!.querySelector('a')!.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(true)
  })
})

describe('trail()', () => {
  it('keeps every level up to four', () => {
    expect(trail(SHORT)).toEqual({ head: SHORT, folded: [], tail: [] })
  })

  it('keeps the first and the last two beyond four', () => {
    const { head, folded, tail } = trail(LONG)
    expect(head.map((c) => c.label)).toEqual(['Opnames'])
    expect(folded.map((c) => c.label)).toEqual(['2026', 'Oktober'])
    expect(tail.map((c) => c.label)).toEqual(['Week 40', 'Teamoverleg 2 oktober'])
  })
})
