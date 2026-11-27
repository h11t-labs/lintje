/**
 * The table in a browser: Escape first for a lifted grip in its column chooser, the height of a
 * filterable head, the width a truncated column takes, a keyboard's way into a table that
 * scrolls sideways, the Tab stops of a row (its name, a cut value, its controls' rings), and the
 * phone's table within its tile with its dates whole, and the host's element in a slot column.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { deepActiveElement } from '../../../core/focus'
import { TAB } from '../../../core/test-keys'
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

describe('a right-aligned head with a hint and a funnel', () => {
  const FUNNEL = { kind: 'options' as const, options: [{ value: 'Noord' }, { value: 'Zuid' }] }

  it('keeps its label and "i" on the right, the funnel at the end, sorting or not', async () => {
    const element = await mount({
      caption: 'Loketten',
      rowKey: 'name',
      columns: [
        COLUMNS[0]!,
        { key: 'requests', header: 'Aanvr.', align: 'right', hint: 'Vandaag.', filter: FUNNEL },
        {
          key: 'open',
          header: 'Open',
          align: 'right',
          sortable: false,
          hint: 'Nog niet afgehandeld.',
          filter: FUNNEL,
        },
      ],
      rows: officeRows(3),
    })
    const heads = [
      ...element.shadowRoot!.querySelectorAll<HTMLElement>(
        '.lintje-data-table__full .lintje-data-table__header-cell--hinted',
      ),
    ]
    expect(heads).toHaveLength(2)
    for (const th of heads) {
      const inner = th.querySelector('.lintje-data-table__header-inner')!
      // What stands before the "i": the sort button, or the plain label's text.
      const button = inner.querySelector('.lintje-data-table__sort-button')
      const range = document.createRange()
      const text = [...inner.childNodes].find(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent!.trim(),
      )
      if (text) range.selectNodeContents(text)
      const before = button ? button.getBoundingClientRect() : [...range.getClientRects()][0]!
      const tip = th.querySelector('lintje-toggletip')!.getBoundingClientRect()
      const funnel = th.querySelector('.lintje-data-table__funnel')!.getBoundingClientRect()
      const gap = parseFloat(getComputedStyle(inner).columnGap)
      const end =
        inner.getBoundingClientRect().right - parseFloat(getComputedStyle(inner).paddingRight)
      expect(funnel.right).toBeCloseTo(end, 0)
      expect(funnel.left - tip.right).toBeCloseTo(gap, 0)
      // The label ends just before the "i", not at the head's start.
      expect(tip.left - before.right).toBeLessThanOrEqual(gap + 1)
    }
  })
})

describe('a sorting head with a hint', () => {
  const labelEnd = (th: Element): number => {
    const label = th.querySelector('.lintje-data-table__sort-label')
    if (label) return label.getBoundingClientRect().right
    const text = [...th.querySelector('.lintje-data-table__header-inner')!.childNodes].find(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent!.trim(),
    )!
    const range = document.createRange()
    range.selectNodeContents(text)
    return range.getBoundingClientRect().right
  }
  const glyph = (th: Element): DOMRect =>
    th.querySelector('lintje-toggletip')!.shadowRoot!.querySelector('svg')!.getBoundingClientRect()

  it('keeps its "i" near its label and in place, sorted or not', async () => {
    const element = await mount({
      caption: 'Loketten',
      rowKey: 'name',
      columns: [
        COLUMNS[0]!,
        { key: 'region', header: 'Regio', hint: 'Waar het loket staat.' },
        { key: 'requests', header: 'Aanvragen', align: 'right', hint: 'Vandaag.' },
        { key: 'open', header: 'Open', align: 'right', sortable: false, hint: 'Nog niet klaar.' },
      ],
      rows: officeRows(3),
    })
    const [left, right, plain] = [
      ...element.shadowRoot!.querySelectorAll<HTMLElement>(
        '.lintje-data-table__full .lintje-data-table__header-cell--hinted',
      ),
    ]
    const place = () =>
      [left!, right!].map((th) => ({
        gap: glyph(th).left - labelEnd(th),
        left: glyph(th).left,
        width: th.getBoundingClientRect().width,
      }))
    const resting = place()
    // The sort glyph keeps its room, but nothing more than that stands between label and "i".
    const arrow = left!
      .querySelector('.lintje-data-table__sort-icon')!
      .getBoundingClientRect().width
    const plainGap = glyph(plain!).left - labelEnd(plain!)
    for (const { gap } of resting) expect(gap - plainGap).toBeLessThanOrEqual(arrow)
    for (const th of [left!, right!]) {
      th.querySelector<HTMLElement>('.lintje-data-table__sort-button')!.click()
      await element.updateComplete
      expect(th.classList.contains('is-active')).toBe(true)
      expect(place()).toEqual(resting)
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
})

describe('a truncated value in a row without controls', () => {
  it('runs on whole under the focus, from a Tab stop of its row', async () => {
    const element = await mount({
      caption: 'Loketten met een toelichting',
      rowKey: 'name',
      columns: [
        { key: 'name', header: 'Loket' },
        { key: 'note', header: 'Toelichting', truncate: true },
      ],
      rows: [{ name: 'Utrecht', note: 'Twee balies dicht wegens scholing '.repeat(12) }],
    })
    const text = inShadow<HTMLElement>(
      element,
      '.lintje-data-table__full .lintje-data-table__cell-text',
    )
    await expect.poll(() => text.scrollWidth > text.clientWidth).toBe(true)
    const row = text.closest('tr')!
    for (let i = 0; i < 4 && !row.matches(':focus-visible'); i++) await userEvent.keyboard(TAB)
    expect(row.matches(':focus-visible')).toBe(true)
    expect(getComputedStyle(text).whiteSpace).toBe('normal')
    expect(text.scrollWidth).toBeLessThanOrEqual(text.clientWidth)
  })
})

describe('a clickable row', () => {
  it('is no Tab stop itself: its name is, a link to its href, current when chosen', async () => {
    const element = await mount({
      caption: 'Loketten',
      rowKey: 'name',
      clickable: true,
      selectedId: 'Utrecht',
      columns: [
        { key: 'name', header: 'Loket' },
        { key: 'requests', header: 'Aanvragen' },
      ],
      rows: [{ name: 'Utrecht', requests: 12, href: '?loket=utrecht' }],
    })
    const row = inShadow<HTMLElement>(element, '.lintje-data-table__full .lintje-data-table__row')
    expect(row.hasAttribute('tabindex')).toBe(false)
    expect(row.hasAttribute('aria-selected')).toBe(false)
    // Past the sort buttons of the head, Tab comes to the row's name.
    for (let i = 0; i < 4 && !row.contains(deepActiveElement()); i++) await userEvent.keyboard(TAB)
    const name = deepActiveElement()!
    expect(name.tagName).toBe('A')
    expect(name.getAttribute('href')).toBe('?loket=utrecht')
    expect(name.getAttribute('aria-current')).toBe('true')
    expect(row.contains(name)).toBe(true)
  })
})

describe('the controls in a row', () => {
  const probe = (element: Element, token: string): string => {
    const span = document.createElement('span')
    span.style.color = `var(${token})`
    element.shadowRoot!.append(span)
    const colour = getComputedStyle(span).color
    span.remove()
    return colour
  }

  it('ring the detail toggle inside it, whole beside the scroller’s edge', async () => {
    const element = await mount({
      caption: 'Loketten',
      rowKey: 'name',
      columns: [
        { key: 'name', header: 'Loket' },
        { key: 'requests', header: 'Aanvragen' },
      ],
      detailFields: [{ key: 'note', label: 'Toelichting' }],
      rows: [{ name: 'Utrecht', requests: 12, note: 'Open' }],
    })
    const toggle = inShadow<HTMLElement>(element, '.lintje-data-table__detail-toggle')
    for (let i = 0; i < 4 && deepActiveElement() !== toggle; i++) await userEvent.keyboard(TAB)
    expect(deepActiveElement()).toBe(toggle)
    const style = getComputedStyle(toggle)
    expect(style.outlineColor).toBe(probe(element, '--color-focus'))
    expect(parseFloat(style.outlineOffset)).toBeLessThanOrEqual(-parseFloat(style.outlineWidth))
    const scroller = inShadow<HTMLElement>(element, '.lintje-data-table__scroller')
    expect(toggle.getBoundingClientRect().left).toBeGreaterThanOrEqual(
      scroller.getBoundingClientRect().left,
    )
  })

  it('show the pencil of an editable cell under the focus', async () => {
    const element = await mount({
      caption: 'Loketten',
      rowKey: 'name',
      columns: [
        { key: 'name', header: 'Loket' },
        { key: 'requests', header: 'Aanvragen', editor: { kind: 'number' } },
      ],
      rows: [{ name: 'Utrecht', requests: 12 }],
    })
    const cell = inShadow<HTMLElement>(
      element,
      '.lintje-data-table__full td.lintje-data-table__cell--editable',
    )
    const pencil = cell.querySelector<HTMLElement>('.lintje-data-table__edit-icon')!
    expect(getComputedStyle(pencil).visibility).toBe('hidden')
    for (let i = 0; i < 4 && deepActiveElement() !== cell; i++) await userEvent.keyboard(TAB)
    expect(deepActiveElement()).toBe(cell)
    expect(getComputedStyle(pencil).visibility).toBe('visible')
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
    // A clickable row's stop is its name; a static row is a stop of its own.
    const row = glyph.closest('tr')!
    for (let i = 0; i < 4 && !row.matches(':focus-visible, :has(:focus-visible)'); i++)
      await userEvent.keyboard(TAB)
    expect(row.matches(':focus-visible, :has(:focus-visible)')).toBe(true)
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

describe('the phone’s table', () => {
  async function viewport(width: number): Promise<void> {
    await page.viewport(width, 844)
    // WebKit resizes the frame after `viewport()` resolves.
    await expect.poll(() => window.innerWidth).toBe(width)
  }

  afterEach(() => viewport(1440))

  /** In a tile on a page with the phone's 16 px margin. */
  async function mountOnPhone(data: DataTableData): Promise<TableElement> {
    const box = document.createElement('div')
    box.style.width = 'calc(100vw - 32px)'
    box.style.marginInline = '16px'
    document.body.append(box)
    const element = document.createElement('lintje-data-table') as TableElement
    element.data = data
    box.append(element)
    await element.updateComplete
    return element
  }

  const width = (element: Element): number => element.getBoundingClientRect().width

  // A long name with its line, a measure with its tone, and the toggle for the other columns.
  const toned: DataTableData = {
    caption: 'Loketten met hun wachttijd',
    rowKey: 'name',
    mobileSublineTemplate: '{requests} aanvragen',
    columns: [
      { key: 'name', header: 'Loket' },
      { key: 'requests', header: 'Aanvragen' },
      {
        key: 'wait',
        header: 'Wachttijd (min)',
        mobileMeasure: true,
        threshold: { value: 15, caution: 12 },
      },
    ],
    rows: [{ name: 'Klantcontactcentrum Amsterdam-Zuidoost', requests: 25090, wait: 15.7 }],
  }

  // At 320 px it depends on the house font, which the tests do not load.
  it('fits its tile with an ordinary name at 390 px', async () => {
    await viewport(390)
    const element = await mountOnPhone({
      ...toned,
      rows: [{ name: 'Loket Amsterdam Centrum', requests: 25090, wait: 15.7 }],
    })
    const mobile = part(element, '.lintje-data-table__mobile')
    await expect.poll(() => width(mobile)).toBeGreaterThan(0)
    const scroller = part(element, '.lintje-data-table__scroller')
    expect(width(mobile)).toBeLessThanOrEqual(width(element))
    expect(scroller.hasAttribute('tabindex')).toBe(false)
  })

  it('keeps a date whole as its measure and wraps the name instead', async () => {
    await viewport(390)
    const element = await mountOnPhone({
      caption: 'Meldingen',
      rowKey: 'name',
      columns: [
        { key: 'name', header: 'Melding' },
        { key: 'at', header: 'Gemeld om', format: 'datetime', mobileMeasure: true },
      ],
      rows: [{ name: 'Storing betaalautomaat in de centrale hal', at: '2025-06-30T11:20' }],
    })
    const time = part(element, '.lintje-data-table__mobile-measure time')
    const name = part(element, '.lintje-data-table__mobile-name')
    await expect.poll(() => width(time)).toBeGreaterThan(0)
    // A moment may break between its day and its time, never inside either.
    const [day, clock] = [...time.querySelectorAll('.lintje-data-table__date-part')]
    expect(day!.getClientRects()).toHaveLength(1)
    expect(clock!.getClientRects()).toHaveLength(1)
    expect(name.getClientRects()[0]!.height).toBeGreaterThan(day!.getClientRects()[0]!.height)
  })

  it('keeps its words whole and scrolls in its tile once they do not fit', async () => {
    await viewport(320)
    const element = await mountOnPhone(toned)
    const scroller = part(element, '.lintje-data-table__scroller')
    const name = part(element, '.lintje-data-table__mobile-name')
    await expect.poll(() => scroller.getAttribute('tabindex')).toBe('0')
    expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    // "Klantcontactcentrum" stands on one line: the name is as wide as that word.
    const word = document.createElement('span')
    word.textContent = 'Klantcontactcentrum'
    word.style.whiteSpace = 'nowrap'
    name.append(word)
    expect(name.clientWidth).toBeGreaterThanOrEqual(word.offsetWidth)
  })

  it('lines the "i" of a last head up with the values, sorting or not', async () => {
    await viewport(390)
    for (const sortable of [true, false]) {
      // Two columns: nothing for a row's toggle to open, so the measure's head is the last.
      const element = await mountOnPhone({
        caption: 'Loketten met hun wachttijd',
        rowKey: 'name',
        columns: [
          { key: 'name', header: 'Loket' },
          { key: 'wait', header: 'Wacht', mobileMeasure: true, sortable, hint: 'In minuten.' },
        ],
        rows: [{ name: 'Loket Amsterdam Centrum', wait: 15.7 }],
      })
      const tip = element.shadowRoot!.querySelector<HTMLElement>(
        '.lintje-data-table__mobile thead lintje-toggletip',
      )!
      await expect.poll(() => tip.getBoundingClientRect().width).toBeGreaterThan(0)
      const glyph = tip.shadowRoot!.querySelector('.lintje-toggletip__trigger svg')!
      // The value's own text, not the hidden words for its tone beside it.
      const walker = document.createTreeWalker(
        part(element, '.lintje-data-table__mobile-measure'),
        NodeFilter.SHOW_TEXT,
      )
      const value = document.createRange()
      value.selectNodeContents(walker.nextNode()!)
      expect(glyph.getBoundingClientRect().right).toBeCloseTo(
        value.getBoundingClientRect().right,
        0,
      )
      element.parentElement!.remove()
    }
  })
})

describe('a slot column', () => {
  const ordered: DataTableData = {
    caption: 'Bestellingen',
    rowKey: 'name',
    clickable: true,
    columns: [
      { key: 'name', header: 'Artikel' },
      { key: 'count', header: 'Aantal', slot: true },
    ],
    rows: [
      { name: 'Pennen', count: 12 },
      { name: 'Mappen', count: 4 },
    ],
  }

  it("shows the host's element in its cell, and a click in it never clicks the row", async () => {
    const element = await mount(structuredClone(ordered))
    const field = Object.assign(document.createElement('input'), {
      slot: 'count-Pennen',
      value: '12',
      ariaLabel: 'Aantal pennen',
    })
    element.append(field)
    const clicks: unknown[] = []
    element.addEventListener('lintje-row-click', (event) => clicks.push(event))
    await expect.element(page.getByRole('textbox', { name: 'Aantal pennen' })).toBeVisible()
    await userEvent.click(field)
    expect(clicks).toHaveLength(0)
    // The other row has no element: its value stands, and the row still clicks.
    const mappen = page.getByRole('button', { name: 'Mappen' })
    await userEvent.click(mappen)
    expect(clicks).toHaveLength(1)
  })
})

describe('a clickable row under the pointer', () => {
  /** A token's colour on this page, as the browser writes a background. */
  const colourOf = (token: string): string => {
    const probe = document.createElement('span')
    probe.style.backgroundColor = `var(${token})`
    document.body.append(probe)
    const colour = getComputedStyle(probe).backgroundColor
    probe.remove()
    return colour
  }
  const clickable: DataTableData = {
    caption: 'Loketten',
    rowKey: 'name',
    clickable: true,
    selectedId: 'Utrecht 1',
    columns: COLUMNS.slice(0, 3),
    rows: officeRows(3),
  }

  for (const style of ['classic', 'new']) {
    it(`lights up, and a selected row keeps its surface, in the ${style} house style`, async () => {
      if (style === 'new') document.documentElement.dataset.styleVersion = 'new'
      try {
        const element = await mount(structuredClone(clickable))
        const full = '.lintje-data-table__full .lintje-data-table__row'
        const rows = [
          part(element, `${full}.is-selected`),
          part(element, `${full}:not(.is-selected)`),
        ]
        await userEvent.hover(rows[1]!)
        await expect
          .poll(() => getComputedStyle(rows[1]!).backgroundColor)
          .toBe(colourOf('--color-bg-subtle'))
        await userEvent.hover(rows[0]!)
        await expect
          .poll(() => getComputedStyle(rows[0]!).backgroundColor)
          .toBe(colourOf('--color-bg-selected'))
        // The selected surface may equal the hover's; the 4 px edge is what tells them apart.
        expect(getComputedStyle(rows[0]!).boxShadow).toContain('4px 0px 0px 0px inset')
        // The light goes with the pointer, after its transition.
        await expect.poll(() => getComputedStyle(rows[1]!).backgroundColor).toBe('rgba(0, 0, 0, 0)')
      } finally {
        delete document.documentElement.dataset.styleVersion
      }
    })
  }

  it('leaves a selected and a checked row their own surface', async () => {
    const element = await mount({ ...structuredClone(clickable), checkedIds: ['Zwolle 2'] })
    // Hover and selected share a colour today: a hover in its own colour shows which one is drawn.
    const own = new CSSStyleSheet()
    own.replaceSync('.lintje-data-table__row { --color-bg-subtle: rgb(255, 0, 0); }')
    element.shadowRoot!.adoptedStyleSheets = [...element.shadowRoot!.adoptedStyleSheets, own]
    const full = '.lintje-data-table__full .lintje-data-table__row.is-clickable'
    const selected = part(element, `${full}.is-selected`)
    const checked = part(element, `${full}.is-checked`)
    const plain = part(element, `${full}:not(.is-selected, .is-checked)`)
    await userEvent.hover(plain)
    await expect.poll(() => getComputedStyle(plain).backgroundColor).toBe('rgb(255, 0, 0)')
    for (const row of [selected, checked]) {
      await userEvent.hover(row)
      await expect
        .poll(() => getComputedStyle(row).backgroundColor)
        .toBe(colourOf('--color-bg-selected'))
    }
  })

  it('stays as it is when the row does not click through', async () => {
    const element = await mount({ ...structuredClone(clickable), clickable: false })
    const row = part(element, '.lintje-data-table__full .lintje-data-table__row')
    const before = getComputedStyle(row).backgroundColor
    await userEvent.hover(row)
    expect(getComputedStyle(row).backgroundColor).toBe(before)
  })
})
