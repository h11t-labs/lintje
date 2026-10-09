/** The card list: one list item and card per item, skeletons while loading, empty without. */
import { afterEach, describe, expect, it } from 'vitest'
import './card-list'
import type { LintjeCardList } from './card-list'
import type { LintjeCard } from '../card/card'

async function mount(props: Partial<LintjeCardList>): Promise<LintjeCardList> {
  const element = Object.assign(document.createElement('lintje-card-list'), props)
  document.body.append(element)
  await element.updateComplete
  return element
}

afterEach(() => document.body.replaceChildren())

const nextFrame = (): Promise<unknown> => new Promise((resolve) => requestAnimationFrame(resolve))

describe('lintje-card-list', () => {
  it('draws a real list with a card per item, at the heading level it is given', async () => {
    const element = await mount({
      label: 'Producten',
      headingLevel: 2,
      items: [
        { id: 'a', title: 'Vertalen' },
        { id: 'b', title: 'Transcriptie' },
      ],
    })
    const list = element.shadowRoot!.querySelector('ul')!
    expect(list.getAttribute('aria-label')).toBe('Producten')
    const cards = [...list.querySelectorAll<LintjeCard>('li > lintje-card')]
    expect(cards.map((card) => card.data!.title)).toEqual(['Vertalen', 'Transcriptie'])
    expect(cards[0]!.headingLevel).toBe(2)
  })

  it('hands its layout to every card, and across it keeps to two columns', async () => {
    const element = await mount({ layout: 'horizontal', items: [{ id: 'a', title: 'Vertalen' }] })
    expect(element.shadowRoot!.querySelector<LintjeCard>('lintje-card')!.layout).toBe('horizontal')
    const list = element.shadowRoot!.querySelector<HTMLElement>('ul')!
    expect(list.style.getPropertyValue('--card-list-columns')).toBe('2')
  })

  it('holds skeleton cards while loading', async () => {
    const element = await mount({ loading: true, loadingCount: 4 })
    const list = element.shadowRoot!.querySelector('ul')!
    expect(list.getAttribute('aria-busy')).toBe('true')
    const cards = [...list.querySelectorAll<LintjeCard>('lintje-card')]
    expect(cards).toHaveLength(4)
    expect(cards.every((card) => card.loading)).toBe(true)
    // One status for the list; the skeleton cards are hidden so it is not said four times.
    expect(element.shadowRoot!.querySelectorAll('[role="status"]')).toHaveLength(1)
    expect(
      [...list.querySelectorAll('li')].every((item) => item.getAttribute('aria-hidden') === 'true'),
    ).toBe(true)
  })

  it('says it loads, and then how many it loaded, from a region that stays', async () => {
    const element = await mount({ loading: true })
    const region = element.shadowRoot!.querySelector('[role="status"]')!
    expect(region.textContent).toBe('')
    await nextFrame()
    await element.updateComplete
    expect(region.textContent).toBe('Gegevens laden…')

    element.items = [
      { id: 'a', title: 'Vertalen' },
      { id: 'b', title: 'Transcriptie' },
    ]
    element.loading = false
    await element.updateComplete
    await nextFrame()
    await element.updateComplete
    expect(element.shadowRoot!.querySelector('[role="status"]')).toBe(region)
    expect(region.textContent).toBe('Gegevens geladen: 2 items.')

    element.loading = true
    await element.updateComplete
    element.items = []
    element.loading = false
    await element.updateComplete
    await nextFrame()
    await element.updateComplete
    expect(element.shadowRoot!.querySelector('[role="status"]')).toBe(region)
    expect(region.textContent).toBe('Gegevens geladen. Er is hier nog niets.')
  })

  it('says nothing about a list that arrives whole', async () => {
    const element = await mount({ items: [{ id: 'a', title: 'Vertalen' }] })
    await nextFrame()
    expect(element.shadowRoot!.querySelector('[role="status"]')!.textContent).toBe('')
  })

  it('says it is empty in words when nothing is left', async () => {
    const element = await mount({ items: [], emptyText: 'Geen producten gevonden.' })
    const empty = element.shadowRoot!.querySelector('lintje-empty-state')!
    expect(empty.getAttribute('text')).toBe('Geen producten gevonden.')
    expect(element.shadowRoot!.querySelector('ul')).toBeNull()
  })
})
