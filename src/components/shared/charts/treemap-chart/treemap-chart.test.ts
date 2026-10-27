/**
 * The treemap: parts under 1 % of the whole fold into one grey "Overig" that is not a button, also
 * inside a part; sub-parts share their part's tint; a missing value draws no area and is named in
 * the legend and the total line; with two levels the part is what a click, Enter and the table
 * choose. happy-dom has no layout or fonts, so what is checked is the markup.
 */
import { render } from 'lit'
import { afterEach, describe, expect, it } from 'vitest'
import '../../../charts/chart/chart'
import type { LintjeChart } from '../../../charts/chart/chart'
import { ChartController, type ChartOptions } from '../shared/controller'
import type { ChartSelection } from '../shared/mark-select'
import type { ChartSpec, TreemapPart } from '../shared/types'
import { renderTreemapChart, thinPartAt } from './treemap-chart'
import { fitLabel, type Measure } from './treemap-labels'
import { treemapModel, treemapRows } from './treemap-parts'

type TreemapSpec = Extract<ChartSpec, { kind: 'treemap' }>

const TINT = (n: number) => `var(--color-chart-tint-${n})`
const OTHER = 'var(--color-chart-other)'

function draw(spec: TreemapSpec, extra: Partial<ChartOptions> = {}) {
  const host = document.createElement('div')
  document.body.append(host)
  const chosen: (ChartSelection | null)[] = []
  const options: ChartOptions = {
    controller: new ChartController(() => render(renderTreemapChart(spec, options), host)),
    description: 'Een geheel en zijn delen.',
    onSelect: (mark) => chosen.push(mark),
    onClear: () => chosen.push(null),
    ...extra,
  }
  render(renderTreemapChart(spec, options), host)
  options.controller.requestUpdate()
  return { host, controller: options.controller, chosen }
}

afterEach(() => document.body.replaceChildren())

// Ten parts of a fictional budget, in mld euro; two are under 1 % of the whole (3,7).
const FLAT: TreemapPart[] = [
  { label: 'Onderwijs', value: 48.6, id: 'onderwijs', href: '?deel=onderwijs' },
  { label: 'Sociale zekerheid', value: 110.7, id: 'sz', href: '?deel=sz' },
  { label: 'Zorg', value: 98.4, id: 'zorg', href: '?deel=zorg' },
  { label: 'Gemeenten', value: 38.2 },
  { label: 'Economie', value: 22.3 },
  { label: 'Infrastructuur', value: 16.9 },
  { label: 'Klimaat', value: 12.5 },
  { label: 'Wonen', value: 10.3 },
  { label: 'Cultuur', value: 3 },
  { label: 'Sport', value: 1.2 },
]

const NESTED: TreemapPart[] = [
  {
    label: 'Zorg',
    id: 'zorg',
    href: '?deel=zorg',
    parts: [
      { label: 'Langdurige zorg', value: 29.5 },
      { label: 'Ziekenhuiszorg', value: 31.2 },
      { label: 'Preventie', value: 1 },
      { label: 'Opleidingen', value: 0.5 },
    ],
  },
  {
    label: 'Onderwijs',
    id: 'onderwijs',
    href: '?deel=onderwijs',
    parts: [
      { label: 'Primair', value: 14.9 },
      { label: 'Voortgezet', value: 11.2 },
    ],
  },
  { label: 'Gemeenten', value: 38.2, id: 'gemeenten', href: '?deel=gemeenten' },
]

const spec = (parts: TreemapPart[], extra: Partial<TreemapSpec> = {}): TreemapSpec => ({
  kind: 'treemap',
  parts,
  label: 'Uitgaven',
  unit: 'mld euro',
  ...extra,
})

const groups = (host: Element) => [...host.querySelectorAll('.lintje-treemap__group')]
const areas = (group: Element) => [...group.querySelectorAll('.lintje-treemap__area')]
const svgOf = (host: Element) => host.querySelector<SVGSVGElement>('.lintje-treemap__svg')!
const tooltip = (host: Element) =>
  host.querySelector('.lintje-chart-tooltip__title')?.textContent?.trim() ?? null
const total = (host: Element) =>
  host.querySelector('.lintje-treemap__total')?.textContent?.replace(/\s+/g, ' ').trim()
/** The first label line that starts with this text. */
const label = (host: Element, start: string) =>
  [...host.querySelectorAll('.lintje-treemap__label')].find((text) =>
    text.textContent?.trim().startsWith(start),
  )
const legend = (host: Element) =>
  [...host.querySelectorAll('.lintje-legend__label')].map((label) => label.textContent?.trim())

function key(host: Element, name: string) {
  svgOf(host).dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }))
}

describe('the treemap', () => {
  it('draws the parts largest first, darkest first, and folds those under 1 % into "Overig"', () => {
    const { host } = draw(spec(FLAT))
    const drawn = groups(host)
    const names = drawn.map((group) => group.getAttribute('data-part-id'))
    expect(names).toEqual([
      'sz',
      'zorg',
      'onderwijs',
      'Gemeenten',
      'Economie',
      'Infrastructuur',
      'Klimaat',
      'Wonen',
      'Overig',
    ])
    expect(areas(drawn[0])[0].getAttribute('fill')).toBe(TINT(1))
    // Past five parts the smallest keep the lightest tint.
    expect(areas(drawn[7])[0].getAttribute('fill')).toBe(TINT(5))
    const other = drawn.at(-1)!
    expect(areas(other)[0].getAttribute('fill')).toBe(OTHER)
    expect(other.getAttribute('role')).toBeNull()
    expect(label(host, 'Overig')).toBeUndefined()
    expect(legend(host)).toEqual(['Overig: posten onder 1 % samen'])
  })

  it('keeps one small part itself', () => {
    const { host } = draw(spec(FLAT.filter((part) => part.label !== 'Sport')))
    expect(groups(host).at(-1)!.getAttribute('data-part-id')).toBe('Cultuur')
    expect(host.querySelector('.lintje-legend')).toBeNull()
  })

  it('folds small sub-parts inside a part too, and gives the sub-parts their part’s tint', () => {
    const { host } = draw(spec(NESTED))
    const [zorg, gemeenten, onderwijs] = groups(host)
    expect(gemeenten.getAttribute('data-part-id')).toBe('gemeenten')
    expect(areas(zorg).map((area) => area.getAttribute('fill'))).toEqual([TINT(1), TINT(1), OTHER])
    expect(areas(onderwijs).map((area) => area.getAttribute('fill'))).toEqual([TINT(4), TINT(4)])
    expect(legend(host)).toEqual(['Overig: posten onder 1 % samen'])
  })

  it('draws no area for a missing value and names it in the legend and the total line', () => {
    const parts = FLAT.map((part) =>
      part.label === 'Wonen' || part.label === 'Economie' ? { ...part, value: null } : part,
    )
    const { host } = draw(spec(parts))
    expect(groups(host).map((group) => group.getAttribute('data-part-id'))).not.toContain('Wonen')
    expect(legend(host)).toContain('Geen gegevens: Economie, Wonen')
    expect(host.querySelector('.lintje-legend__marker--hatch')).not.toBeNull()
    expect(total(host)).toBe('totaal 329,5 mld euro, zonder Economie, Wonen')
  })

  it('says a missing sub-part by its own name, and a part whose every sub-part is missing by its', () => {
    const parts: TreemapPart[] = [
      {
        ...NESTED[0],
        parts: [
          { label: 'Ziekenhuiszorg', value: 31.2 },
          { label: 'Jeugdzorg', value: null },
        ],
      },
      { label: 'Cultuur', parts: [{ label: 'Musea', value: null }] },
      NESTED[2],
    ]
    const { host } = draw(spec(parts))
    expect(total(host)).toBe('totaal 69,4 mld euro, zonder Jeugdzorg, Cultuur')
  })

  it('writes the total line with the decimals of the most precise value, without a unit too', () => {
    const { host } = draw(spec(FLAT, { unit: undefined }))
    expect(total(host)).toBe('totaal 362,1')
  })

  it('writes the same total line on a phone', () => {
    const parts = FLAT.map((part) => (part.label === 'Wonen' ? { ...part, value: null } : part))
    const wide = total(draw(spec(parts)).host)
    const phone = total(draw(spec(parts), { mobile: true }).host)
    expect(phone).toBe(wide)
  })

  it('walks the areas in the drawn order with the arrow keys, and hides the tooltip on Escape', () => {
    const { host } = draw(spec(NESTED))
    key(host, 'ArrowRight')
    expect(tooltip(host)).toBe('Ziekenhuiszorg')
    expect(host.querySelector('.lintje-chart-tooltip__kicker')?.textContent).toBe('Zorg')
    key(host, 'ArrowRight')
    expect(tooltip(host)).toBe('Langdurige zorg')
    key(host, 'ArrowRight')
    expect(tooltip(host)).toBe('Overig')
    expect(host.querySelector('.lintje-chart-tooltip')?.textContent).toContain('Samen')
    key(host, 'End')
    expect(tooltip(host)).toBe('Voortgezet')
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Onderwijs, Voortgezet')
    host
      .querySelector('.lintje-treemap')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(tooltip(host)).toBeNull()
  })

  it('chooses the part with Enter on a sub-part, and keeps the keys on that sub-part', () => {
    const { host, controller, chosen } = draw(spec(NESTED))
    key(host, 'ArrowRight')
    key(host, 'ArrowRight')
    key(host, 'Enter')
    expect(chosen).toEqual([{ id: 'zorg', label: 'Zorg', href: '?deel=zorg' }])
    expect(controller.hoverIndex).toBe(1)
  })

  it('chooses the part with a click in a sub-part, its "Overig" too', () => {
    const { host, chosen } = draw(spec(NESTED))
    const [zorg] = groups(host)
    expect(zorg.getAttribute('role')).toBe('link')
    expect(zorg.hasAttribute('aria-pressed')).toBe(false)
    for (const area of areas(zorg)) area.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(chosen.map((mark) => mark?.id)).toEqual(['zorg', 'zorg', 'zorg'])
  })

  it('ignores a href on a sub-part', () => {
    const parts = [
      {
        label: 'Onderwijs',
        parts: [
          { label: 'Primair', value: 14.9, href: '?deel=primair' },
          { label: 'Voortgezet', value: 11.2 },
        ],
      },
    ] as TreemapPart[]
    const { host, chosen } = draw(spec(parts))
    const [onderwijs] = groups(host)
    expect(onderwijs.getAttribute('role')).toBeNull()
    areas(onderwijs)[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    key(host, 'ArrowRight')
    key(host, 'Enter')
    expect(chosen).toEqual([])
  })

  it('outlines the chosen part and dims the others, its sub-parts staying full', () => {
    const { host } = draw(spec(NESTED), { selectedId: 'zorg' })
    const [zorg, gemeenten] = groups(host)
    expect(zorg.getAttribute('aria-pressed')).toBe('true')
    expect(zorg.classList.contains('is-muted')).toBe(false)
    expect(gemeenten.classList.contains('is-muted')).toBe(true)
    expect(host.querySelector('.lintje-treemap__outline.is-selected')).not.toBeNull()
  })

  it('draws no label at all with dataLabels off', () => {
    const { host } = draw(spec(FLAT, { dataLabels: false }))
    expect(host.querySelector('.lintje-treemap__label')).toBeNull()
  })

  it('labels the large areas in their ink: white on the darkest step, ink on the lighter', () => {
    const { host } = draw(spec(FLAT))
    expect(label(host, 'Sociale')?.classList.contains('lintje-chart__data-label--inside')).toBe(
      true,
    )
    expect(label(host, 'Zorg')?.classList.contains('lintje-chart__data-label--inside-light')).toBe(
      true,
    )
  })

  it('draws no label on a step where neither ink reaches 4.5:1', () => {
    // Purple's third step: five parts spread over the whole ladder.
    const parts = FLAT.slice(0, 5)
    const { host } = draw(spec(parts, { color: 'purple' }))
    expect(label(host, 'Onderw')).toBeUndefined()
    expect(label(host, 'Sociale')).toBeDefined()
  })
})

describe('the treemap below 768 px', () => {
  it('draws the whole as one strip and a row per part, "Overig" last with its count', () => {
    const { host } = draw(spec(FLAT), { mobile: true })
    expect(host.querySelector('.lintje-treemap__strip')).not.toBeNull()
    expect(host.querySelector('.lintje-treemap__group')).toBeNull()
    const rows = [...host.querySelectorAll('.lintje-treemap__row')]
    expect(rows).toHaveLength(9)
    expect(rows.at(-1)!.textContent).toContain('2 posten')
    expect(host.querySelectorAll('.lintje-treemap__piece')).toHaveLength(9)
  })

  it('opens a part to its sub-parts and keeps which ones in the controller', () => {
    const { host, controller } = draw(spec(NESTED), { mobile: true })
    const toggle = host.querySelector<HTMLButtonElement>('.lintje-treemap__toggle')!
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(host.querySelector('.lintje-treemap__subs')).toBeNull()
    toggle.click()
    expect(controller.openParts).toEqual(['zorg'])
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    const subs = [...host.querySelectorAll('.lintje-treemap__sub')].map((sub) =>
      sub.querySelector('.lintje-treemap__name')?.textContent?.trim(),
    )
    expect(subs).toEqual(['Ziekenhuiszorg', 'Langdurige zorg', 'Overig · 2 posten'])
  })

  it('chooses a part from its row, never from a sub-part', () => {
    const { host, chosen } = draw(spec(NESTED), { mobile: true })
    host.querySelector<HTMLButtonElement>('.lintje-treemap__toggle')!.click()
    const choice = host.querySelector<HTMLButtonElement>('.lintje-treemap__part--button')!
    expect(choice.getAttribute('role')).toBe('link')
    choice.click()
    expect(chosen.map((mark) => mark?.id)).toEqual(['zorg'])
    expect(host.querySelector('.lintje-treemap__sub button')).toBeNull()
  })

  it('lists a missing part with a hatched swatch and no bar', () => {
    const parts = FLAT.map((part) => (part.label === 'Wonen' ? { ...part, value: null } : part))
    const { host } = draw(spec(parts), { mobile: true })
    const missing = host.querySelector('.lintje-treemap__row--missing')!
    expect(missing.textContent).toContain('geen gegevens')
    expect(missing.querySelector('.lintje-treemap__swatch--hatch')).not.toBeNull()
    expect(missing.querySelector('.lintje-treemap__bar')).toBeNull()
  })
})

describe('treemapModel', () => {
  it('counts what is drawn: no area for 0, a negative value or a missing one', () => {
    const model = treemapModel({
      parts: [
        { label: 'A', value: 60 },
        { label: 'B', value: 40 },
        { label: 'Nul', value: 0 },
        { label: 'Min', value: -5 },
        { label: 'Leeg', value: null },
      ],
    })
    expect(model.groups.map((group) => group.label)).toEqual(['A', 'B'])
    expect(model.total).toBe(100)
    expect(model.missing).toEqual(['Leeg'])
  })

  it('keeps the host’s order between equal values', () => {
    const model = treemapModel({
      parts: [
        { label: 'Eerste', value: 5 },
        { label: 'Tweede', value: 5 },
      ],
    })
    expect(model.groups.map((group) => group.label)).toEqual(['Eerste', 'Tweede'])
  })

  it('ignores the value of a part with sub-parts', () => {
    const model = treemapModel({
      parts: [
        {
          label: 'A',
          value: 999,
          parts: [
            { label: 'a', value: 3 },
            { label: 'b', value: 2 },
          ],
        },
      ],
    })
    expect(model.total).toBe(5)
  })
})

describe('treemapRows', () => {
  it('writes a row per sub-part, the folded ones apart, and keeps a missing value missing', () => {
    const parts: TreemapPart[] = [
      NESTED[0],
      { label: 'Gemeenten', value: 38.2 },
      { label: 'Wonen', value: null },
    ]
    const rows = treemapRows(spec(parts, { labelHeader: 'Beleidsterrein' }))
    expect(rows[0]).toEqual([
      'Beleidsterrein',
      'Onderdeel',
      'Uitgaven (mld euro)',
      'Aandeel in het totaal (%)',
    ])
    expect(rows.slice(1).map((row) => row.slice(0, 3))).toEqual([
      ['Zorg', 'Ziekenhuiszorg', 31.2],
      ['Zorg', 'Langdurige zorg', 29.5],
      ['Zorg', 'Preventie', 1],
      ['Zorg', 'Opleidingen', 0.5],
      ['Gemeenten', '', 38.2],
      ['Wonen', '', null],
    ])
    expect(rows[1][3]).toBe(31.1)
    expect(rows.at(-1)![3]).toBeNull()
  })

  it('leaves the column of sub-parts out when no part has any', () => {
    const [header] = treemapRows(spec(FLAT))
    expect(header).toEqual(['Deel', 'Uitgaven (mld euro)', 'Aandeel in het totaal (%)'])
  })
})

describe('fitLabel', () => {
  // 7 px per character at 12 px, in proportion at 14 px: a font without a canvas.
  const measure: Measure = (text, size) => (text.length * 7 * size) / 12
  const part = { name: 'Sociale zekerheid', amount: '110,7', share: '29,8%' }

  it('says name, amount and share in a large area, the name in 14 px over up to three lines', () => {
    const lines = fitLabel(part, { width: 300, height: 200 }, measure)
    expect(lines.map((line) => line.text)).toEqual(['Sociale zekerheid', '110,7 · 29,8%'])
    expect(lines[0]).toMatchObject({ size: 14, bold: true })
    const wrapped = fitLabel(part, { width: 16 + 125, height: 200 }, measure)
    expect(wrapped.map((line) => line.text)).toEqual(['Sociale', 'zekerheid', '110,7 · 29,8%'])
  })

  it('falls back to 12 px, then without the share, then the name alone', () => {
    // One word of 17 characters: 139 px at 14 px, 119 px at 12 px.
    const word = { ...part, name: 'Zekerheidsstelsel' }
    const at12 = fitLabel(word, { width: 16 + 125, height: 200 }, measure)
    expect(at12[0]).toMatchObject({ text: 'Zekerheidsstelsel', size: 12, bold: true })
    expect(at12.at(-1)!.text).toBe('110,7 · 29,8%')
    const narrow = fitLabel(part, { width: 16 + 70, height: 200 }, measure)
    expect(narrow.map((line) => line.text)).toEqual(['Sociale', 'zekerheid', '110,7'])
    const low = fitLabel(part, { width: 16 + 70, height: 16 + 32 }, measure)
    expect(low.map((line) => line.text)).toEqual(['Sociale', 'zekerheid'])
  })

  it('cuts the name short as a last step, with the amount if it fits', () => {
    const lines = fitLabel(part, { width: 16 + 50, height: 16 + 32 }, measure)
    expect(lines.map((line) => line.text)).toEqual(['Social…', '110,7'])
  })

  it('leaves an area empty where four letters do not fit', () => {
    expect(fitLabel(part, { width: 16 + 30, height: 100 }, measure)).toEqual([])
    expect(fitLabel(part, { width: 200, height: 20 }, measure)).toEqual([])
  })

  it('writes a sub-part’s name in 12 px and its amount in bold, without a share', () => {
    const lines = fitLabel({ name: 'AOW', amount: '55,2' }, { width: 100, height: 100 }, measure)
    expect(lines).toEqual([
      { text: 'AOW', size: 12, bold: false },
      { text: '55,2', size: 12, bold: true },
    ])
  })
})

describe('the treemap in its tile', () => {
  it('keeps the host’s subtitle and makes a table of it', async () => {
    const element = document.createElement('lintje-chart') as LintjeChart
    element.data = {
      title: 'Uitgaven',
      subtitle: 'Per beleidsterrein',
      description: 'Uitgaven per beleidsterrein.',
      chart: spec(NESTED),
    }
    document.body.append(element)
    await element.updateComplete
    expect(element.renderRoot.querySelector('lintje-tile')?.getAttribute('subtitle')).toBe(
      'Per beleidsterrein',
    )
    expect(element.renderRoot.querySelector('.lintje-treemap__total')?.textContent).toContain(
      'totaal',
    )
  })
})

describe('a thin part that drills', () => {
  // A wide part, a strip of 10 px beside it, and a part that does not drill.
  const boxes = [
    { x: 0, y: 0, width: 200, height: 100 },
    { x: 200, y: 0, width: 10, height: 100 },
    { x: 210, y: 0, width: 90, height: 100 },
  ]

  it('takes 24 px across its thin side, over its neighbours', () => {
    expect(thinPartAt(boxes, [true, true, true], 195, 50, 24)).toBe(1)
    expect(thinPartAt(boxes, [true, true, true], 216, 50, 24)).toBe(1)
    // Past 12 px from its middle the neighbour keeps its own click.
    expect(thinPartAt(boxes, [true, true, true], 190, 50, 24)).toBeNull()
    expect(thinPartAt(boxes, [true, true, true], 220, 50, 24)).toBeNull()
  })

  it('takes nothing when it does not drill, and leaves a wide part to itself', () => {
    expect(thinPartAt(boxes, [true, false, true], 195, 50, 24)).toBeNull()
    expect(thinPartAt(boxes, [true, true, true], 100, 50, 24)).toBeNull()
  })
})
