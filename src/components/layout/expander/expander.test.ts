/**
 * The disclosure, and the icon a tile, a KPI and an expander may carry.
 *
 * happy-dom has no layout and adopts no stylesheet, so the unfold itself — the
 * grid row growing from `0fr` to `1fr`, and `visibility: hidden` taking the
 * closed content out of the tab order — is checked where it runs, in headless
 * Chrome. What is structural is checked here: the content is in the DOM in both
 * states, the header says what it controls, and the state lives on the block's
 * `is-open` class rather than on a swapped glyph.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import './expander'
import '../../charts/kpi-row/kpi-row'
import '../../../primitives/tile/tile'
import { putIcons } from '../../../icons/loader'
import type { KpiRowData } from '../../../types'

/** The names below come from data, so the loader would fetch them; here they are given. */
const ICONS = [
  'gereedschap-moersleutel-en-schroevendraaier',
  'activiteiten-lopende-personen-met-koffer',
  'functioneel-klok',
]

beforeAll(() => {
  putIcons(
    ICONS.map((name) => [
      name,
      { viewBox: '0 0 24 24', attributes: {}, body: '<path d="M0 0h1v1z"/>' },
    ]),
  )
})

type Expander = HTMLElement & { open: boolean; heading: string; updateComplete: Promise<unknown> }
type Tile = HTMLElement & { heading?: string; icon?: string; updateComplete: Promise<unknown> }
type KpiRow = HTMLElement & { data: KpiRowData; updateComplete: Promise<unknown> }

async function expander(open: boolean, extra: Partial<Expander> = {}): Promise<Expander> {
  const element = document.createElement('lintje-expander') as Expander
  element.heading = 'Toelichting op de meting'
  element.open = open
  Object.assign(element, extra)
  element.innerHTML = '<p id="slotted">De wachttijd is de mediaan per kwartier.</p>'
  document.body.append(element)
  await element.updateComplete
  return element
}

const section = (element: HTMLElement): HTMLElement => element.shadowRoot!.querySelector('section')!

describe('lintje-expander', () => {
  it('keeps its content in the DOM while it is closed', async () => {
    const closed = await expander(false)
    const body = closed.shadowRoot!.querySelector('.lintje-disclosure__body')
    expect(body).not.toBeNull()
    expect(body!.querySelector('slot')).not.toBeNull()
    // The slotted child is never taken away either: it is the same node before
    // and after opening, so a chart inside an expander is not rebuilt.
    expect(closed.querySelector('#slotted')).not.toBeNull()
  })

  it('says what it controls, and the id is the body it opens', async () => {
    const element = await expander(false)
    const button = element.shadowRoot!.querySelector('button')!
    const body = element.shadowRoot!.querySelector('.lintje-disclosure__body')!
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(button.getAttribute('aria-controls')).toBe(body.id)
    expect(body.id).not.toBe('')
  })

  it('gives two expanders on one page two different body ids', async () => {
    const first = await expander(false)
    const second = await expander(false)
    const id = (element: HTMLElement) =>
      element.shadowRoot!.querySelector('.lintje-disclosure__body')!.id
    expect(id(first)).not.toBe(id(second))
  })

  it('carries the open state on the block, with one chevron in both states', async () => {
    const element = await expander(false)
    expect(section(element).classList.contains('is-open')).toBe(false)
    const chevrons = () => element.shadowRoot!.querySelectorAll('.lintje-disclosure__chevron')
    expect(chevrons()).toHaveLength(1)

    element.shadowRoot!.querySelector('button')!.click()
    await element.updateComplete
    expect(element.open).toBe(true)
    expect(section(element).classList.contains('is-open')).toBe(true)
    expect(section(element).getAttribute('aria-expanded')).toBeNull()
    expect(element.shadowRoot!.querySelector('button')!.getAttribute('aria-expanded')).toBe('true')
    // Still one glyph: the chevron turns, it is not swapped for another file.
    expect(chevrons()).toHaveLength(1)
  })

  it('draws the label block only when there is an icon or a subtitle', async () => {
    const plain = await expander(true)
    expect(plain.shadowRoot!.querySelector('.lintje-disclosure__icon')).toBeNull()
    expect(plain.shadowRoot!.querySelector('.lintje-disclosure__sub')).toBeNull()
    expect(
      plain
        .shadowRoot!.querySelector('.lintje-disclosure__label')!
        .classList.contains('lintje-disclosure__label--plain'),
    ).toBe(true)

    const dressed = await expander(true, {
      icon: 'gereedschap-moersleutel-en-schroevendraaier',
      subtitle: 'Alleen zichtbaar in ontwikkeling en acceptatie',
    } as Partial<Expander>)
    expect(dressed.shadowRoot!.querySelector('.lintje-disclosure__icon')).not.toBeNull()
    expect(dressed.shadowRoot!.querySelector('.lintje-disclosure__sub')!.textContent).toContain(
      'ontwikkeling',
    )
  })
})

describe('the icon a heading may carry', () => {
  it('is absent from a tile that was given no name', async () => {
    const tile = document.createElement('lintje-tile') as Tile
    tile.heading = 'Aanvragen per uur'
    document.body.append(tile)
    await tile.updateComplete
    expect(tile.shadowRoot!.querySelector('.lintje-tile__icon')).toBeNull()
    expect(
      tile
        .shadowRoot!.querySelector('.lintje-tile__heading')!
        .classList.contains('lintje-tile__heading--icon'),
    ).toBe(false)

    tile.icon = 'activiteiten-lopende-personen-met-koffer'
    await tile.updateComplete
    expect(tile.shadowRoot!.querySelector('.lintje-tile__icon')).not.toBeNull()
    expect(
      tile
        .shadowRoot!.querySelector('.lintje-tile__heading')!
        .classList.contains('lintje-tile__heading--icon'),
    ).toBe(true)
  })

  it('reaches the KPI that asked for one, and only that one', async () => {
    const row = document.createElement('lintje-kpi-row') as KpiRow
    row.data = {
      kpis: [
        { label: 'Gemiddelde wachttijd', icon: 'functioneel-klok', value: '11 min' },
        { label: 'Weigeringen', value: '37' },
      ],
      columns: 2,
    }
    document.body.append(row)
    await row.updateComplete
    const kpis = [...row.shadowRoot!.querySelectorAll('lintje-kpi')]
    expect(kpis).toHaveLength(2)
    await Promise.all(kpis.map((kpi) => (kpi as Tile).updateComplete))
    expect(kpis[0].getAttribute('icon')).toBe('functioneel-klok')
    expect(kpis[1].hasAttribute('icon')).toBe(false)
    expect(
      kpis[0].shadowRoot!.querySelector('.lintje-kpi--icon > .lintje-kpi__icon'),
    ).not.toBeNull()
    expect(kpis[1].shadowRoot!.querySelector('.lintje-kpi__icon')).toBeNull()
  })
})

describe('the expander title', () => {
  it('is an h3 that holds the button: a disclosure sits in a section, under the page title', async () => {
    const element = await expander(false)
    // The heading holds the button, never the other way round: the children of a
    // button are presentational, so a heading inside one is in no outline.
    const heading = element.shadowRoot!.querySelector('h3')!
    expect(heading.classList.contains('lintje-disclosure__heading')).toBe(true)
    expect(heading.textContent!.trim()).toBe('Toelichting op de meting')
    const button = heading.querySelector(':scope > button.lintje-disclosure__header')!
    expect(button).not.toBeNull()
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(button.querySelector('h1, h2, h3, h4, h5, h6, p, div')).toBeNull()
    expect(button.querySelector('.lintje-disclosure__title')!.textContent).toBe(
      'Toelichting op de meting',
    )
  })
})
