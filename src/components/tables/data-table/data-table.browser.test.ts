/**
 * The table in a browser: Escape first for a lifted grip in its column chooser, the height of a
 * filterable head, the width a truncated column takes, and a keyboard's way into a table that
 * scrolls sideways.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { deepActiveElement } from '../../../core/focus'
import './data-table'
import type { DataTableData, TableColumnData } from '../../../types'

type TableElement = HTMLElement & { data: DataTableData; updateComplete: Promise<unknown> }

async function mount(data: DataTableData): Promise<TableElement> {
  const element = document.createElement('lintje-data-table') as TableElement
  element.data = data
  document.body.append(element)
  await element.updateComplete
  return element
}

afterEach(() => document.body.replaceChildren())

const inShadow = <T extends Element>(element: Element, selector: string): T =>
  element.shadowRoot!.querySelector<T>(selector)!

const filtered: DataTableData = {
  caption: 'Loketten',
  rowKey: 'name',
  columns: [
    { key: 'name', header: 'Loket', filter: { kind: 'text' } },
    { key: 'requests', header: 'Aanvragen' },
  ],
  rows: [{ name: 'Utrecht', requests: 12 }],
}

describe('a column panel', () => {
  it('leaves Escape to a lifted grip in the column chooser', async () => {
    const element = await mount({
      ...filtered,
      columnChooser: true,
      columns: [
        { key: 'name', header: 'Loket' },
        { key: 'requests', header: 'Aanvragen' },
        { key: 'open', header: 'Open' },
      ],
    })
    const chooser = inShadow<HTMLElement>(element, '.lintje-data-table__chooser-button')
    chooser.click()
    await expect
      .poll(() => deepActiveElement()?.classList.contains('lintje-sortable-list__grip'))
      .toBe(true)
    const grip = deepActiveElement()!
    await userEvent.keyboard(' ')
    await expect.poll(() => grip.getAttribute('aria-pressed')).toBe('true')
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => grip.getAttribute('aria-pressed')).toBe('false')
    expect(element.shadowRoot!.querySelector('lintje-popover')).not.toBeNull()

    await userEvent.keyboard('{Escape}')
    await expect.poll(() => element.shadowRoot!.querySelector('lintje-popover')).toBeNull()
    expect(deepActiveElement()).toBe(chooser)
  })
})

const OFFICES = ['Utrecht', 'Zwolle', 'Arnhem', 'Leeuwarden', 'Middelburg', 'Maastricht']

const COLUMNS: TableColumnData[] = [
  { key: 'name', header: 'Loket' },
  { key: 'region', header: 'Regio' },
  { key: 'requests', header: 'Aanvragen' },
  { key: 'handled', header: 'Afgehandeld' },
  { key: 'open', header: 'Openstaand' },
  { key: 'term', header: 'Gemiddelde doorlooptijd' },
  { key: 'status', header: 'Status van de verwerking' },
]

/** As many rows as asked, the offices over and over with a running number. */
function officeRows(count: number): DataTableData['rows'] {
  return Array.from({ length: count }, (_, index) => ({
    name: `${OFFICES[index % OFFICES.length]} ${index + 1}`,
    region: index % 2 ? 'Noord' : 'Zuid',
    requests: 100 + index,
    handled: 80 + index,
    open: 20,
    term: '12 dagen',
    status: index % 3 ? 'Op schema' : 'Achter op schema',
  }))
}

const part = (element: TableElement, selector: string): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>(selector)!

describe('the height of the table’s head', () => {
  const data = (columns: TableColumnData[]): DataTableData => ({
    caption: 'Loketten',
    rowKey: 'name',
    columns,
    rows: officeRows(3),
  })
  const headRow = (element: TableElement): number =>
    part(element, '.lintje-data-table__full thead tr').getBoundingClientRect().height
  const FUNNEL = { kind: 'options' as const, options: [{ value: 'Noord' }, { value: 'Zuid' }] }

  it('is as high with a filter as without one', async () => {
    const plain = await mount(data(COLUMNS.slice(0, 3)))
    const withFilter = await mount(
      data(
        COLUMNS.slice(0, 3).map((column) =>
          column.key === 'requests' ? column : { ...column, filter: FUNNEL },
        ),
      ),
    )
    expect(headRow(withFilter)).toBe(headRow(plain))
  })

  it('holds the funnel within its control height, sorting or not', async () => {
    const element = await mount(
      data([
        { ...COLUMNS[0]!, filter: { kind: 'text' } },
        { ...COLUMNS[1]!, sortable: false, filter: FUNNEL },
        COLUMNS[2]!,
      ]),
    )
    const cells = [
      ...element.shadowRoot!.querySelectorAll<HTMLElement>('.lintje-data-table__header-inner'),
    ]
    expect(cells).toHaveLength(2)
    for (const inner of cells) {
      expect(inner.getBoundingClientRect().height).toBe(
        parseFloat(getComputedStyle(inner).minHeight),
      )
      const funnel = inner.querySelector('.lintje-data-table__funnel')!.getBoundingClientRect()
      const box = inner.getBoundingClientRect()
      expect(funnel.top).toBeGreaterThanOrEqual(box.top)
      expect(funnel.bottom).toBeLessThanOrEqual(box.bottom)
    }
  })
})

describe('a truncated column', () => {
  const note =
    'Twee balies dicht wegens scholing van nieuwe medewerkers tot en met vrijdag '.repeat(3)

  async function mountIn(width: number): Promise<TableElement> {
    const box = document.createElement('div')
    box.style.width = `${width}px`
    document.body.append(box)
    const element = document.createElement('lintje-data-table') as TableElement
    element.data = {
      caption: 'Loketten met een toelichting',
      rowKey: 'name',
      clickable: true,
      columns: [
        { key: 'name', header: 'Loket' },
        { key: 'note', header: 'Toelichting', truncate: true },
        { key: 'short', header: 'Kort', truncate: true },
        { key: 'requests', header: 'Aanvragen' },
      ],
      rows: [{ name: 'Utrecht', note, short: 'Open', requests: 12 }],
    }
    box.append(element)
    await element.updateComplete
    return element
  }

  const texts = (element: Element): HTMLElement[] => [
    ...element.shadowRoot!.querySelectorAll<HTMLElement>(
      '.lintje-data-table__full .lintje-data-table__cell-text',
    ),
  ]

  it('cuts a long value and does not push the table past its tile', async () => {
    const element = await mountIn(900)
    const scroller = inShadow<HTMLElement>(element, '.lintje-data-table__scroller')
    const [long, short] = texts(element)
    expect(long.scrollWidth).toBeGreaterThan(long.clientWidth)
    expect(scroller.scrollWidth).toBeLessThanOrEqual(scroller.clientWidth)
    // A short value takes no surplus width: its cell is the text and the padding.
    const cell = short.closest('td')!
    expect(cell.clientWidth - short.scrollWidth).toBeLessThanOrEqual(24 + 1)
  })

  it('wraps the whole value under the keyboard focus', async () => {
    const element = await mountIn(900)
    const [long] = texts(element)
    const row = long.closest('tr')!
    const height = row.getBoundingClientRect().height
    // After a key press a focus moved by script is a keyboard focus.
    await userEvent.keyboard('{Shift}')
    row.focus()
    await expect.poll(() => row.matches(':focus-visible')).toBe(true)
    expect(getComputedStyle(long).whiteSpace).toBe('normal')
    expect(row.getBoundingClientRect().height).toBeGreaterThan(height)
  })
})

describe('a compact change column', () => {
  it.each([true, false])('shows its words through Tab with clickable=%s', async (clickable) => {
    const element = document.createElement('lintje-data-table') as TableElement
    element.data = {
      caption: 'Loketten met hun trend',
      rowKey: 'name',
      clickable,
      columns: [
        { key: 'name', header: 'Loket' },
        {
          key: 'change',
          header: 'Trend',
          format: 'change-compact',
          tooltip: '{change} tegenover vorige week',
        },
      ],
      rows: [{ name: 'Utrecht', change: 4 }],
    }
    document.body.append(element)
    await element.updateComplete
    const glyph = inShadow<HTMLElement>(
      element,
      '.lintje-data-table__full .lintje-data-table__change--compact',
    )
    const words = inShadow<HTMLElement>(
      element,
      '.lintje-data-table__full .lintje-data-table__change-words',
    )
    expect(getComputedStyle(glyph).display).not.toBe('none')
    expect(getComputedStyle(words).display).toBe('none')
    const row = glyph.closest('tr')!
    await userEvent.keyboard('{Tab}{Tab}{Tab}')
    await expect.poll(() => row.matches(':focus-visible')).toBe(true)
    expect(getComputedStyle(glyph).display).toBe('none')
    expect(getComputedStyle(words).display).not.toBe('none')
    expect(words.textContent).toBe('▲ +4% tegenover vorige week')
  })
})

describe('a table wider than its room', () => {
  const wide: DataTableData = {
    caption: 'Loketten met hun cijfers',
    rowKey: 'name',
    columns: Array.from({ length: 8 }, (_, i) => ({
      key: `c${i}`,
      header: `Kolom met een lange kop ${i}`,
    })),
    rows: [
      Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`c${i}`, `een_lange_waarde_${i}`])),
    ],
  }

  async function mountAt(width: number, data: DataTableData): Promise<TableElement> {
    const box = document.createElement('div')
    box.style.width = `${width}px`
    document.body.append(box)
    const element = document.createElement('lintje-data-table') as TableElement
    element.data = data
    box.append(element)
    await element.updateComplete
    return element
  }

  it('lets a keyboard into its scroll, named by its caption', async () => {
    const element = await mountAt(480, wide)
    const scroller = inShadow<HTMLElement>(element, '.lintje-data-table__scroller')
    await expect.poll(() => scroller.getAttribute('tabindex')).toBe('0')
    expect(scroller.getAttribute('role')).toBe('region')
    expect(scroller.getAttribute('aria-label')).toBe('Loketten met hun cijfers')
  })

  it('takes no tab stop when it fits', async () => {
    const element = await mountAt(800, { ...wide, columns: wide.columns.slice(0, 2) })
    const scroller = inShadow<HTMLElement>(element, '.lintje-data-table__scroller')
    await element.updateComplete
    expect(scroller.hasAttribute('tabindex')).toBe(false)
  })
})
