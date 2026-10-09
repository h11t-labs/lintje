/** The description list: real dt/dd, a dash for a missing value, the change link's name. */
import { describe, expect, it } from 'vitest'
import './description-list'
import type { DescriptionItem, LintjeDescriptionList } from './description-list'

async function mount(items: DescriptionItem[]): Promise<LintjeDescriptionList> {
  const element = document.createElement('lintje-description-list')
  element.items = items
  document.body.append(element)
  await element.updateComplete
  return element
}

describe('lintje-description-list', () => {
  it('draws one dt and one dd per pair', async () => {
    const element = await mount([
      { label: 'Categorie', value: 'Veiligheid' },
      { label: 'Datum', value: '3 oktober 2026, 14:35' },
    ])
    const root = element.shadowRoot!
    expect(root.querySelector('dl')).not.toBeNull()
    expect([...root.querySelectorAll('dt')].map((node) => node.textContent)).toEqual([
      'Categorie',
      'Datum',
    ])
    expect(root.querySelectorAll('dd')[0]!.textContent).toContain('Veiligheid')
  })

  it('shows a missing value as a dash, and a 0 as 0', async () => {
    const element = await mount([
      { label: 'Toelichting', value: null },
      { label: 'Bijlagen', value: 0 },
    ])
    const values = element.shadowRoot!.querySelectorAll('dd')
    expect(values[0]!.querySelector('.lintje-description-list__missing')!.textContent).toContain(
      '—',
    )
    expect(values[1]!.querySelector('.lintje-description-list__missing')).toBeNull()
    expect(values[1]!.textContent).toContain('0')
  })

  it('names the change link after its label and hands a plain click to the host', async () => {
    const element = await mount([
      { label: 'Locatie', value: 'Vergaderzaal 2', action: { href: '?stap=2#locatie' } },
    ])
    const link = element.shadowRoot!.querySelector<HTMLAnchorElement>(
      '.lintje-description-list__action',
    )!
    expect(link.textContent).toBe('Wijzigen')
    expect(link.getAttribute('aria-label')).toBe('Locatie wijzigen')
    expect(link.getAttribute('href')).toBe('?stap=2#locatie')

    const details: unknown[] = []
    element.addEventListener('lintje-navigate', (event) =>
      details.push((event as CustomEvent).detail),
    )
    const click = new MouseEvent('click', { bubbles: true, composed: true, cancelable: true })
    link.dispatchEvent(click)
    expect(details).toEqual([{ href: '?stap=2#locatie' }])
    expect(click.defaultPrevented).toBe(false)

    const newTab = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true })
    link.dispatchEvent(newTab)
    expect(details).toHaveLength(1)
  })

  it('stands the label above the value with layout="column", and is a grid item', async () => {
    const element = await mount([{ label: 'Categorie', value: 'Veiligheid' }])
    const list = element.shadowRoot!.querySelector('dl')!
    expect(element.layout).toBe('row')
    expect(list.classList.contains('lintje-description-list--column')).toBe(false)

    element.layout = 'column'
    element.span = 4
    await element.updateComplete
    expect(element.getAttribute('layout')).toBe('column')
    expect(list.classList.contains('lintje-description-list--column')).toBe(true)
    expect(element.getAttribute('span')).toBe('4')
    expect(element.style.getPropertyValue('--lintje-span')).toBe('4')
  })

  it('sets the pairs as cells with layout="grid": two columns wide, a tone, tags and a slot', async () => {
    const element = await mount([
      { label: 'Sprekers', value: '3, vast', tone: 'changed' },
      { label: 'Microfoon', value: 'Vergaderset (USB)', tone: 'warning', span: 2, slot: 'mic' },
      {
        label: 'Woordenlijsten',
        tags: ['Afkortingen Rijksoverheid', 'Namen team Planning'],
        span: 2,
      },
    ])
    element.layout = 'grid'
    await element.updateComplete
    const root = element.shadowRoot!
    expect(root.querySelector('dl')!.classList.contains('lintje-description-list--grid')).toBe(true)
    const [speakers, mic, lists] = [...root.querySelectorAll('.lintje-description-list__row')]
    expect(speakers!.classList.contains('is-changed')).toBe(true)
    expect(speakers!.textContent).toContain('Aangepast')
    expect(mic!.classList.contains('is-wide')).toBe(true)
    expect(mic!.classList.contains('is-warning')).toBe(true)
    expect(mic!.querySelector('slot[name="mic"]')).not.toBeNull()
    expect([...lists!.querySelectorAll('li')].map((tag) => tag.textContent)).toEqual([
      'Afkortingen Rijksoverheid',
      'Namen team Planning',
    ])
  })
})
