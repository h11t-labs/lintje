/** The footer: its line, its columns of links, the fixed links, and what a click on a link sends. */
import { afterEach, describe, expect, it } from 'vitest'
import './footer'
import type { FooterData, LintjeFooter } from './footer'

const DATA: FooterData = {
  tagline: 'Datacatalogus — het dataplatform',
  columns: [
    { heading: 'Catalogus', links: [{ label: 'Dataproducten', href: '/dataproducten' }] },
    { heading: 'Hulp', links: [{ label: 'Contact', href: '/contact' }] },
  ],
  links: [{ label: 'Privacy', href: '/privacy' }],
  note: 'Versie 1.0.0',
}

async function mount(data: FooterData): Promise<LintjeFooter> {
  const element = Object.assign(document.createElement('lintje-footer'), { data })
  document.body.append(element)
  await element.updateComplete
  return element
}

afterEach(() => document.body.replaceChildren())

describe('lintje-footer', () => {
  it('is the page footer, with its line, a heading per column and the fixed links', async () => {
    const root = (await mount(DATA)).shadowRoot!
    expect(root.querySelector('footer')).not.toBeNull()
    expect(root.querySelector('.lintje-footer__tagline')!.textContent).toBe(
      'Datacatalogus — het dataplatform',
    )
    expect([...root.querySelectorAll('h2')].map((node) => node.textContent)).toEqual([
      'Catalogus',
      'Hulp',
    ])
    expect(root.querySelector('.lintje-footer__meta a')!.getAttribute('href')).toBe('/privacy')
    expect(root.querySelector('.lintje-footer__note')!.textContent).toBe('Versie 1.0.0')
  })

  it('sends a plain click on a link as lintje-navigate', async () => {
    const element = await mount(DATA)
    const heard: string[] = []
    element.addEventListener('lintje-navigate', (event) => {
      heard.push((event as CustomEvent<{ href: string }>).detail.href)
      event.preventDefault()
    })
    element.shadowRoot!.querySelector<HTMLAnchorElement>('.lintje-footer__link')!.click()
    expect(heard).toEqual(['/dataproducten'])
  })

  it('draws only what it is given', async () => {
    const root = (await mount({ links: [{ label: 'Privacy', href: '/privacy' }] })).shadowRoot!
    expect(root.querySelector('.lintje-footer__tagline')).toBeNull()
    expect(root.querySelector('.lintje-footer__columns')).toBeNull()
    expect(root.querySelector('.lintje-footer__note')).toBeNull()
    expect(root.querySelectorAll('a')).toHaveLength(1)
  })
})
