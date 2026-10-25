/** The hero: its title and introduction, the one action, and the room it keeps for what overlaps. */
import { afterEach, describe, expect, it } from 'vitest'
import './hero'
import '../shell/shell'
import type { LintjeHero } from './hero'

async function mount(props: Partial<LintjeHero>, inner = ''): Promise<LintjeHero> {
  const element = Object.assign(document.createElement('lintje-hero'), props)
  element.innerHTML = inner
  document.body.append(element)
  await element.updateComplete
  return element
}

afterEach(() => document.body.replaceChildren())

describe('lintje-hero in a shell with a light menu', () => {
  const primary = (hero: LintjeHero): boolean =>
    hero.shadowRoot!.querySelector('.lintje-hero')!.classList.contains('lintje-hero--primary')

  it("is primary by itself, follows the menu's tone, and leaves a chosen tone alone", async () => {
    const shell = document.createElement('div')
    // The shell mirrors its effective tone as `data-tone`; its rendering plays no part here.
    const host = document.createElement('lintje-shell')
    host.setAttribute('nav-tone', 'light')
    document.body.append(shell)
    shell.append(host)
    const hero = Object.assign(document.createElement('lintje-hero'), { heading: 'Start' })
    const washed = Object.assign(document.createElement('lintje-hero'), { heading: 'Start' })
    washed.setAttribute('tone', 'wash')
    host.append(hero, washed)
    await hero.updateComplete
    await washed.updateComplete
    expect(primary(hero)).toBe(true)
    expect(primary(washed)).toBe(false)

    host.setAttribute('nav-tone', 'filled')
    await new Promise((resolve) => setTimeout(resolve, 0))
    await hero.updateComplete
    expect(primary(hero)).toBe(false)
  })
})

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
    const slots = [...body.querySelectorAll(':scope > slot')].map((slot) =>
      slot.getAttribute('name'),
    )
    expect(slots.slice(0, 2)).toEqual(['breadcrumbs', 'status'])
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

describe('lintje-hero as the page’s head', () => {
  it('draws the primary band with the trail before the title', async () => {
    const element = await mount(
      { heading: 'Resultaten', tone: 'primary' },
      '<nav slot="breadcrumbs">Home</nav>',
    )
    const root = element.shadowRoot!
    expect(root.querySelector('.lintje-hero')!.classList.contains('lintje-hero--primary')).toBe(
      true,
    )
    const body = root.querySelector('.lintje-hero__body')!
    const order = [...body.children].map((child) =>
      child.localName === 'slot' ? `slot:${child.getAttribute('name') ?? ''}` : child.className,
    )
    expect(order.indexOf('slot:breadcrumbs')).toBeLessThan(order.indexOf('lintje-hero__heading'))
    expect(element.getAttribute('tone')).toBe('primary')
  })
})
