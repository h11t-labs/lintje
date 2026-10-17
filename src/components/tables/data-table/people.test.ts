/**
 * A `person` column: the cell holds an id, the table draws the person from `people` and reads the
 * name everywhere it reads a word — sorting, filters, groups, the CSV, the worksheet and the phone.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from 'lit'
import './data-table'
import { chipText, renderFilterField } from './filters'
import type { LintjePerson } from '../person/person'
import type { DataTableData, TableCellRef, TableColumnData } from '../../../types'

type TableElement = HTMLElement & { data: DataTableData; updateComplete: Promise<unknown> }

const handler: TableColumnData = {
  key: 'handler',
  header: 'Behandelaar',
  format: 'person',
  people: {
    jv: { name: 'J. de Vries', initials: 'JV', href: '/mensen/jv' },
    ab: { name: 'A. Bakker', initials: 'AB' },
  },
}

const data: DataTableData = {
  caption: 'Aanvragen',
  rowKey: 'id',
  columns: [{ key: 'name', header: 'Aanvraag' }, handler],
  rows: [
    { id: '1', name: 'Bouwvergunning', handler: 'jv' },
    { id: '2', name: 'Kapvergunning', handler: null },
    { id: '3', name: 'Evenement', handler: 'ab' },
    { id: '4', name: 'Uitrit', handler: 'onbekend' },
  ],
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

async function mount(extra: Partial<DataTableData> = {}): Promise<TableElement> {
  const element = document.createElement('lintje-data-table') as TableElement
  element.data = { ...structuredClone(data), ...extra }
  document.body.append(element)
  await element.updateComplete
  return element
}

const shadow = (element: TableElement): ShadowRoot => element.shadowRoot as ShadowRoot

/** The desktop rows as [name, handler cell]. */
function rows(element: TableElement): HTMLElement[][] {
  return [
    ...shadow(element).querySelectorAll<HTMLElement>(
      '.lintje-data-table__full tbody .lintje-data-table__row:not(.lintje-data-table__row--filler)',
    ),
  ].map((row) => [...row.querySelectorAll<HTMLElement>('th, td')])
}

const names = (element: TableElement): string[] =>
  rows(element).map(([name]) => name!.textContent!.trim())

describe('a person column', () => {
  it('draws lintje-person at 24 px from `people`, never as a link, and an unknown id as text', async () => {
    const element = await mount()
    const byName = new Map(rows(element).map(([name, cell]) => [name!.textContent!.trim(), cell!]))
    const jv = byName.get('Bouwvergunning')!.querySelector<LintjePerson>('lintje-person')!
    expect(jv.getAttribute('size')).toBe('small')
    expect(jv.person?.name).toBe('J. de Vries')
    expect(jv.person?.href).toBeUndefined()
    const nobody = byName.get('Kapvergunning')!.querySelector<LintjePerson>('lintje-person')!
    expect(nobody.person).toBeNull()
    expect(nobody.getAttribute('empty')).toBe('Niet toegewezen')
    const unknown = byName.get('Uitrit')!
    expect(unknown.querySelector('lintje-person')).toBeNull()
    expect(unknown.textContent!.trim()).toBe('onbekend')
  })

  it('names nobody with the column’s `empty`', async () => {
    const element = await mount({
      columns: [data.columns[0]!, { ...handler, empty: 'Nog niemand' }],
    })
    const empty = shadow(element).querySelector<LintjePerson>('lintje-person[empty]')!
    expect(empty.getAttribute('empty')).toBe('Nog niemand')
  })

  it('sorts by the name as written, nobody lowest', async () => {
    const element = await mount({ sort: { key: 'handler', direction: 'asc' } })
    // Nobody, A. Bakker, J. de Vries, onbekend.
    expect(names(element)).toEqual(['Kapvergunning', 'Evenement', 'Bouwvergunning', 'Uitrit'])
  })

  it('heads a group with the person, circle and all', async () => {
    const element = await mount({ groupBy: 'handler' })
    const heads = [
      ...shadow(element).querySelectorAll(
        '.lintje-data-table__full .lintje-data-table__group-name',
      ),
    ]
    const people = heads.map(
      (head) => head.querySelector<LintjePerson>('lintje-person')?.person?.name,
    )
    expect(people).toContain('J. de Vries')
    expect(people).toContain('A. Bakker')
  })

  it('writes the name in the CSV, and nobody as `empty`', async () => {
    const element = await mount({ download: { filename: 'aanvragen' } })
    // The unit files share one module graph, so the file is caught where it leaves, not mocked.
    let file: Blob | undefined
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      file = blob as Blob
      return 'blob:aanvragen'
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    ;(element as unknown as { csv(): void }).csv()
    const text = (await file!.text()).replace(/^\uFEFF/, '')
    expect(text.split('\r\n').map((line) => line.split(';'))).toEqual([
      ['Aanvraag', 'Behandelaar'],
      ['Bouwvergunning', 'J. de Vries'],
      ['Kapvergunning', 'Niet toegewezen'],
      ['Evenement', 'A. Bakker'],
      ['Uitrit', 'onbekend'],
    ])
  })
})

describe('a person column’s filter', () => {
  const filtered: TableColumnData = {
    ...handler,
    filter: { kind: 'options', options: [{ value: 'jv' }, { value: 'ab', label: 'Bakker' }] },
  }

  it('gives an option without a label the person’s name, in the field and the chip', () => {
    const host = document.createElement('div')
    render(
      renderFilterField(filtered, [], () => {}),
      host,
    )
    const labels = [...host.querySelectorAll('.lintje-choice__label')].map(
      (label) => label.textContent,
    )
    expect(labels).toEqual(['J. de Vries', 'Bakker'])
    expect(chipText(filtered, ['jv', 'ab'])).toBe('Behandelaar: J. de Vries, Bakker')
  })
})

describe('a person column in the worksheet', () => {
  const editable: TableColumnData = { ...handler, editor: { kind: 'select' } }

  function cell(element: TableElement, id: string): HTMLElement {
    return [
      ...shadow(element).querySelectorAll<HTMLElement>('.lintje-data-table__full [data-cell]'),
    ].find((candidate) => candidate.dataset.cell === `${id}\u001fhandler`)!
  }

  it('offers `empty` first, then the people; sends the id, and null for nobody', async () => {
    const element = await mount({ columns: [data.columns[0]!, editable] })
    const edits: (TableCellRef & { value: string | null })[] = []
    element.addEventListener('lintje-cell-edit', (event) =>
      edits.push((event as CustomEvent).detail),
    )

    cell(element, '1').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await element.updateComplete
    const select = cell(element, '1').querySelector('select')!
    const options = [...select.options].map((option) => [option.value, option.textContent!.trim()])
    expect(options).toEqual([
      ['', 'Niet toegewezen'],
      ['jv', 'J. de Vries'],
      ['ab', 'A. Bakker'],
    ])
    expect(select.value).toBe('jv')
    select.value = ''
    select.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await element.updateComplete
    expect(edits).toEqual([{ id: '1', column: 'handler', value: null }])
    // Saving, the choice stands by its word.
    expect(cell(element, '1').textContent).toContain('Niet toegewezen')

    cell(element, '2').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await element.updateComplete
    const next = cell(element, '2').querySelector('select')!
    expect(next.value).toBe('')
    next.value = 'ab'
    next.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(edits.at(-1)).toEqual({ id: '2', column: 'handler', value: 'ab' })
  })

  it('keeps the host’s own options', async () => {
    const own: TableColumnData = {
      ...handler,
      editor: { kind: 'select', options: [{ value: 'jv', label: 'Jan' }] },
    }
    const element = await mount({ columns: [data.columns[0]!, own] })
    cell(element, '1').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await element.updateComplete
    const select = cell(element, '1').querySelector('select')!
    expect([...select.options].map((option) => option.textContent!.trim())).toEqual(['Jan'])
  })
})

describe('a person column below 768 px', () => {
  const mobile = (element: TableElement): HTMLElement =>
    shadow(element).querySelector<HTMLElement>('.lintje-data-table__mobile')!

  it('stands as the measure at 24 px', async () => {
    const element = await mount({
      columns: [
        data.columns[0]!,
        { ...handler, mobileMeasure: true },
        { key: 'kind', header: 'Soort' },
      ],
    })
    const measure = mobile(element).querySelector('.lintje-data-table__mobile-measure')!
    const person = measure.querySelector<LintjePerson>('lintje-person')!
    expect(person.getAttribute('size')).toBe('small')
  })

  it('keeps the circle in the rest under the row, and only the name in the subline', async () => {
    const element = await mount({
      columns: [
        data.columns[0]!,
        { key: 'kind', header: 'Soort', mobileMeasure: true },
        { ...handler, mobileSubline: true },
      ],
      rows: data.rows.map((row) => ({ ...row, kind: 'Vergunning' })),
    })
    const subs = [...mobile(element).querySelectorAll('.lintje-data-table__mobile-sub')].map(
      (sub) => sub.textContent,
    )
    expect(subs).toContain('J. de Vries')
    expect(subs).toContain('Niet toegewezen')
    expect(mobile(element).querySelector('.lintje-data-table__mobile-sub lintje-person')).toBeNull()

    mobile(element).querySelector<HTMLButtonElement>('.lintje-data-table__mobile-toggle')!.click()
    await element.updateComplete
    const list = mobile(element).querySelector('lintje-description-list') as HTMLElement & {
      items: { label: string; slot?: string }[]
    }
    const item = list.items.find((entry) => entry.label === 'Behandelaar')!
    const slotted = list.querySelector(`[slot="${item.slot}"] lintje-person`)
    expect(slotted).not.toBeNull()
  })
})
