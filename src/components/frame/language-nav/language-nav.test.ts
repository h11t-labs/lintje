/** The language choice: the button names the page's language, the list marks it, a choice tells. */
import { afterEach, describe, expect, it } from 'vitest'
import './language-nav'
import type { LintjeLanguageNav } from './language-nav'

const LANGUAGES = [
  { code: 'nl', label: 'Nederlands', href: '/nl' },
  { code: 'en', label: 'English', href: '/en' },
  { code: 'fy', label: 'Frysk' },
]

async function mount(props: Partial<LintjeLanguageNav> = {}): Promise<LintjeLanguageNav> {
  const element = Object.assign(document.createElement('lintje-language-nav'), {
    languages: LANGUAGES,
    current: 'nl',
    ...props,
  })
  document.body.append(element)
  await element.updateComplete
  return element
}

afterEach(() => document.body.replaceChildren())

describe('lintje-language-nav', () => {
  it('names the current language on its button, in that language', async () => {
    const root = (await mount()).shadowRoot!
    const button = root.querySelector('.lintje-language-nav__button')!
    expect(button.textContent!.trim()).toBe('Nederlands')
    expect(button.getAttribute('lang')).toBe('nl')
    expect(button.getAttribute('aria-label')).toBe('Taal: Nederlands')
    expect(button.getAttribute('aria-haspopup')).toBe('menu')
    expect(button.getAttribute('aria-expanded')).toBe('false')
  })

  it('draws nothing while the current language is not among the languages', async () => {
    const element = await mount({ current: 'de' })
    expect(element.shadowRoot!.querySelector('.lintje-language-nav')).toBeNull()
  })

  it('lists every language with its own lang, the current one checked and filled', async () => {
    const element = await mount()
    element.open = true
    await element.updateComplete
    const rows = [...element.shadowRoot!.querySelectorAll('.lintje-language-nav__row')]
    expect(rows.map((row) => row.getAttribute('lang'))).toEqual(['nl', 'en', 'fy'])
    expect(rows.map((row) => row.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false'])
    expect(rows[0]!.classList.contains('is-current')).toBe(true)
    expect(rows.map((row) => row.localName)).toEqual(['a', 'a', 'button'])
    expect(rows[1]!.getAttribute('href')).toBe('/en')
  })

  it('tells the choice, follows the link as lintje-navigate, and closes', async () => {
    const element = await mount()
    element.open = true
    await element.updateComplete
    const heard: unknown[] = []
    element.addEventListener('lintje-language-change', (event) => {
      heard.push((event as CustomEvent<{ code: string }>).detail.code)
    })
    element.addEventListener('lintje-navigate', (event) => {
      heard.push((event as CustomEvent<{ href: string }>).detail.href)
      event.preventDefault()
    })
    element.shadowRoot!.querySelectorAll<HTMLElement>('.lintje-language-nav__row')[1]!.click()
    await element.updateComplete
    expect(heard).toEqual(['en', '/en'])
    expect(element.open).toBe(false)
  })
})
