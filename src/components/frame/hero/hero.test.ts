/** The hero: its title and introduction, the one action, and the room it keeps for what overlaps. */
import { afterEach, describe, expect, it } from 'vitest'
import './hero'
import type { LintjeHero } from './hero'

async function mount(props: Partial<LintjeHero>, inner = ''): Promise<LintjeHero> {
  const element = Object.assign(document.createElement('lintje-hero'), props)
  element.innerHTML = inner
  document.body.append(element)
  await element.updateComplete
  return element
}

afterEach(() => document.body.replaceChildren())

describe('lintje-hero', () => {
  it('draws the title as an h2 with the introduction under it', async () => {
    const element = await mount({ heading: 'Wat wil je vertalen?', description: 'Typ een tekst.' })
    const root = element.shadowRoot!
    expect(root.querySelector('h2')!.textContent).toBe('Wat wil je vertalen?')
    expect(root.querySelector('.lintje-hero__description')!.textContent).toBe('Typ een tekst.')
    expect(root.querySelector('.lintje-hero__action')).toBeNull()
  })

  it('draws the action only with an href, and sends a plain click as lintje-navigate', async () => {
    const without = await mount({ heading: 'Vertalen', action: 'Start een live gesprek' })
    expect(without.shadowRoot!.querySelector('.lintje-hero__action')).toBeNull()

    const element = await mount({
      heading: 'Vertalen',
      action: 'Start een live gesprek',
      href: '?tab=live',
    })
    const heard: string[] = []
    element.addEventListener('lintje-navigate', (event) => {
      heard.push((event as CustomEvent<{ href: string }>).detail.href)
      event.preventDefault()
    })
    const link = element.shadowRoot!.querySelector<HTMLAnchorElement>('.lintje-hero__action')!
    expect(link.getAttribute('href')).toBe('?tab=live')
    expect(link.textContent!.trim()).toBe('Start een live gesprek')
    link.click()
    expect(heard).toEqual(['?tab=live'])
  })

  it('keeps room under the band only when something stands in the overlap slot', async () => {
    const plain = await mount({ heading: 'Vertalen' })
    expect(plain.shadowRoot!.querySelector('.lintje-hero.has-overlap')).toBeNull()

    const element = await mount({ heading: 'Vertalen' }, '<div slot="overlap">Paneel</div>')
    // happy-dom fires no slotchange of its own.
    element
      .shadowRoot!.querySelector('slot[name="overlap"]')!
      .dispatchEvent(new Event('slotchange'))
    await element.updateComplete
    expect(element.shadowRoot!.querySelector('.lintje-hero.has-overlap')).not.toBeNull()
  })

  it('puts a status above the title and takes two columns only with a panel', async () => {
    const element = await mount(
      { heading: 'Weekendbezetting' },
      '<span slot="status">Neemt op</span><div slot="panel">Wat er nu gezegd wordt</div>',
    )
    const root = element.shadowRoot!
    const body = root.querySelector('.lintje-hero__body')!
    expect(body.firstElementChild!.getAttribute('name')).toBe('status')
    expect(root.querySelector('.lintje-hero.has-panel')).toBeNull()
    root.querySelector('slot[name="panel"]')!.dispatchEvent(new Event('slotchange'))
    await element.updateComplete
    expect(root.querySelector('.lintje-hero.has-panel')).not.toBeNull()
  })

  it('stands the aside beside the text only when something is slotted there', async () => {
    const plain = await mount({ heading: 'Datacatalogus' })
    expect(plain.shadowRoot!.querySelector('.lintje-hero.has-aside')).toBeNull()

    const element = await mount({ heading: 'Datacatalogus' }, '<img slot="aside" alt="">')
    element.shadowRoot!.querySelector('slot[name="aside"]')!.dispatchEvent(new Event('slotchange'))
    await element.updateComplete
    expect(element.shadowRoot!.querySelector('.lintje-hero.has-aside')).not.toBeNull()
  })
})
