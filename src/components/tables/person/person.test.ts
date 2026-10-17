/** One person: the name beside the circle, as text or one link, and the empty place as its word. */
import { afterEach, describe, expect, it } from 'vitest'
import './person'
import type { LintjePerson } from './person'

afterEach(() => {
  document.body.innerHTML = ''
})

async function mount(props: Partial<LintjePerson> = {}): Promise<LintjePerson> {
  const element = Object.assign(document.createElement('lintje-person'), props)
  document.body.append(element)
  await element.updateComplete
  return element
}

const JV = { name: 'J. de Vries', initials: 'JV', role: 'Senior behandelaar' }

describe('lintje-person', () => {
  it('shows the name beside the circle, bold with the role under it', async () => {
    const root = (await mount({ person: JV })).shadowRoot!
    expect(root.querySelector('.lintje-avatar__initials')!.textContent).toBe('JV')
    const name = root.querySelector('.lintje-person__name')!
    expect(name.textContent).toBe('J. de Vries')
    expect(name.classList.contains('is-strong')).toBe(true)
    expect(root.querySelector('.lintje-person__role')!.textContent).toBe('Senior behandelaar')
    expect(root.querySelector('a')).toBeNull()
  })

  it('has no second line at `small`, and the name the weight of where it stands', async () => {
    const root = (await mount({ person: JV, size: 'small' })).shadowRoot!
    expect(root.querySelector('.lintje-person__role')).toBeNull()
    expect(root.querySelector('.lintje-person__name')!.classList.contains('is-strong')).toBe(false)
    expect(root.querySelector('.lintje-avatar--small')).not.toBeNull()
  })

  it('reads as its word without a person, never as nothing', async () => {
    const element = await mount({ person: null })
    const root = element.shadowRoot!
    expect(root.querySelector('.lintje-avatar.is-empty')).not.toBeNull()
    expect(root.querySelector('.lintje-person__name')!.textContent).toBe('Niet toegewezen')
    element.empty = 'Nog niemand'
    await element.updateComplete
    expect(root.querySelector('.lintje-person__name')!.textContent).toBe('Nog niemand')
  })

  it('makes circle and name one link with `href`, and a plain click sends lintje-navigate', async () => {
    const element = await mount({ person: { ...JV, href: '/mensen/jv' } })
    const links = element.shadowRoot!.querySelectorAll('a')
    expect(links).toHaveLength(1)
    const link = links[0]!
    expect(link.getAttribute('href')).toBe('/mensen/jv')
    expect(link.querySelector('.lintje-avatar')).not.toBeNull()
    expect(link.querySelector('.lintje-person__name')).not.toBeNull()
    const hrefs: unknown[] = []
    element.addEventListener('lintje-navigate', (event) => {
      hrefs.push((event as CustomEvent).detail)
      event.preventDefault()
    })
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }))
    expect(hrefs).toEqual([])
    const plain = new MouseEvent('click', { bubbles: true, cancelable: true })
    link.dispatchEvent(plain)
    expect(hrefs).toEqual([{ href: '/mensen/jv' }])
    expect(plain.defaultPrevented).toBe(true)
  })

  it('takes a speaker’s colour on the circle, with the name beside it', async () => {
    const root = (await mount({ person: JV, color: 'violet' })).shadowRoot!
    expect(root.querySelector('.lintje-avatar--violet')).not.toBeNull()
    expect(root.querySelector('.lintje-person__name')!.textContent).toBe('J. de Vries')
  })
})
