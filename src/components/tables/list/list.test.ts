/** The list: rows, the chosen one, the row click, the action, and the empty list. */
import { describe, expect, it } from 'vitest'
import './list'
import { groupRuns, type LintjeList, type ListItem } from './list'

const ITEMS: ListItem[] = [
  {
    id: 'a',
    title: 'Teamoverleg 2 oktober',
    sub: '47:12 · 3 sprekers',
    meta: 'vandaag',
    href: '/opnames/a',
  },
  { id: 'b', title: 'Briefing ochtenddienst', sub: '18:40 · 2 sprekers', meta: 'vandaag' },
  {
    id: 'c',
    title: 'Overdracht nachtdienst',
    sub: '09:55 · 2 sprekers',
    actions: [{ value: 'verwijderen', label: 'Verwijderen' }],
  },
]

async function mount(props: Partial<LintjeList>): Promise<LintjeList> {
  const element = Object.assign(document.createElement('lintje-list'), props)
  document.body.append(element)
  await element.updateComplete
  return element
}

const rows = (element: LintjeList): HTMLElement[] => [
  ...element.shadowRoot!.querySelectorAll<HTMLElement>('.lintje-list__row'),
]

function collect(element: LintjeList, name: string): unknown[] {
  const details: unknown[] = []
  element.addEventListener(name, (event) => details.push((event as CustomEvent).detail))
  return details
}

describe('lintje-list', () => {
  it('turns a row with rename into a field in place, and sends the name or the cancel', async () => {
    const element = await mount({
      items: [
        {
          id: 'p2',
          title: 'Spreker 2',
          swatch: 'dark-yellow',
          rename: { save: 'Overal wijzigen (3)', error: 'Een spreker heeft een naam.' },
        },
      ],
    })
    const root = element.shadowRoot!
    const field = root.querySelector('lintje-text-input')!
    expect(field.value).toBe('Spreker 2')
    expect(field.error).toBe('Een spreker heeft een naam.')
    const renames: unknown[] = []
    const cancels: unknown[] = []
    element.addEventListener('lintje-row-rename', (event) =>
      renames.push((event as CustomEvent).detail),
    )
    element.addEventListener('lintje-row-rename-cancel', (event) =>
      cancels.push((event as CustomEvent).detail),
    )
    field.value = ' Planner '
    const [save, cancel] = root.querySelectorAll('lintje-button')
    save!.click()
    cancel!.click()
    const outside: string[] = []
    document.addEventListener('keydown', (event) => outside.push(event.key))
    const key = (target: EventTarget, name: string): void => {
      target.dispatchEvent(
        new KeyboardEvent('keydown', { key: name, bubbles: true, composed: true }),
      )
    }
    const input = field.shadowRoot!.querySelector('input')!
    input.value = ' Planner '
    key(input, 'Escape')
    key(input, 'Enter')
    // Enter and Escape on the buttons are theirs: Enter on "Annuleren" saves nothing.
    key(cancel!, 'Enter')
    key(save!, 'Escape')
    expect(renames).toEqual([
      { id: 'p2', value: 'Planner' },
      { id: 'p2', value: 'Planner' },
    ])
    expect(cancels).toEqual([{ id: 'p2' }, { id: 'p2' }])
    // The field's Escape cancels the rename and goes no further: a dialog around it stays open.
    expect(outside).toEqual(['Enter', 'Enter', 'Escape'])
    expect(save!.textContent!.trim()).toBe('Overal wijzigen (3)')
  })

  it('draws a ul with one row per item and marks the chosen one', async () => {
    const element = await mount({ items: ITEMS, selectedId: 'b' })
    expect(element.shadowRoot!.querySelector('ul')).not.toBeNull()
    const [first, second] = rows(element)
    expect(rows(element)).toHaveLength(3)
    // Said on the title, where the focus lands, not on the row.
    expect(second!.querySelector('.lintje-list__title')!.getAttribute('aria-current')).toBe('true')
    expect(second!.hasAttribute('aria-current')).toBe(false)
    expect(second!.classList.contains('is-selected')).toBe(true)
    expect(first!.querySelector('[aria-current]')).toBeNull()
    // The title is the tab stop: a link with href, a button without.
    expect(first!.querySelector('.lintje-list__title')!.tagName).toBe('A')
    expect(second!.querySelector('.lintje-list__title')!.tagName).toBe('BUTTON')
  })

  it('sends lintje-row-click for a click anywhere on the row and leaves the link to the browser', async () => {
    const element = await mount({ items: ITEMS })
    const clicks = collect(element, 'lintje-row-click')
    rows(element)[1]!.querySelector<HTMLElement>('.lintje-list__sub')!.click()

    const link = rows(element)[0]!.querySelector('a')!
    const click = new MouseEvent('click', { bubbles: true, composed: true, cancelable: true })
    link.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(false)
    expect(clicks).toEqual([
      { id: 'b', label: 'Briefing ochtenddienst' },
      { id: 'a', label: 'Teamoverleg 2 oktober', href: '/opnames/a' },
    ])

    const newTab = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true })
    link.dispatchEvent(newTab)
    expect(newTab.defaultPrevented).toBe(false)
    expect(clicks).toHaveLength(2)
  })

  it('gives a row with actions an icon menu named after it, and tells the choice with its row', async () => {
    const element = await mount({ items: ITEMS })
    const clicks = collect(element, 'lintje-row-click')
    const actions = collect(element, 'lintje-row-action')
    const plain = collect(element, 'lintje-action')
    const menu = rows(element)[2]!.querySelector('lintje-menu-button')!
    expect(menu.getAttribute('label')).toBe('Acties voor Overdracht nachtdienst')
    expect(menu.hasAttribute('icon')).toBe(true)
    expect(menu.items).toEqual([{ value: 'verwijderen', label: 'Verwijderen' }])
    expect(rows(element)[0]!.querySelector('lintje-menu-button')).toBeNull()

    // The menu's own choice, as the menu sends it: composed, from inside the row.
    menu.dispatchEvent(
      new CustomEvent('lintje-action', { detail: 'verwijderen', bubbles: true, composed: true }),
    )
    expect(actions).toEqual([{ id: 'c', label: 'Overdracht nachtdienst', value: 'verwijderen' }])
    expect(plain).toEqual([])

    menu.click()
    expect(clicks).toEqual([])
  })

  it('is the compact empty state without rows', async () => {
    const element = await mount({ items: [], emptyText: 'Nog geen opnames.' })
    const empty = element.shadowRoot!.querySelector('lintje-empty-state')!
    expect(empty.hasAttribute('compact')).toBe(true)
    expect(empty.getAttribute('text')).toBe('Nog geen opnames.')
    expect(element.shadowRoot!.querySelector('ul')).toBeNull()
  })
})

describe('lintje-list as a work list', () => {
  const WORK: ListItem[] = [
    {
      id: 'b',
      title: 'Brief-aan-bewoners.pdf',
      sub: 'Duits → Nederlands · pagina 4 van 5',
      icon: 'op-kantoor-document-blanco',
      status: { label: 'Bezig', tone: 'busy' },
      progress: 80,
      action: { label: 'Annuleren', value: 'annuleren' },
      group: 'Vandaag',
    },
    { id: 'k', title: 'Brief aanvrager.docx', meta: '10:12', group: 'Vandaag' },
    {
      id: 'g',
      title: 'Where can I collect my residence permit?',
      meta: '16:05',
      group: 'Gisteren',
    },
  ]

  it('draws the kind, the state as a word and the bar of a running row', async () => {
    const element = await mount({ items: WORK })
    const row = rows(element)[0]!
    expect(row.classList.contains('has-icon')).toBe(true)
    expect(row.querySelector('.lintje-list__icon')).not.toBeNull()
    const badge = row.querySelector('lintje-badge')!
    expect(`${badge.getAttribute('tone')}:${badge.textContent}`).toBe('busy:Bezig')
    expect(row.querySelector('lintje-progress-bar')!.value).toBe(80)
    expect(rows(element)[1]!.querySelector('lintje-progress-bar, lintje-badge')).toBeNull()
  })

  it('keeps the whole title in the tooltip where it is cut to one line', async () => {
    const element = await mount({ items: WORK })
    const title = rows(element)[2]!.querySelector('.lintje-list__title')!
    expect(title.getAttribute('title')).toBe('Where can I collect my residence permit?')
  })

  it('sends the row’s own action as lintje-row-action', async () => {
    const element = await mount({ items: WORK })
    const heard: unknown[] = []
    element.addEventListener('lintje-row-action', (event) =>
      heard.push((event as CustomEvent).detail),
    )
    let clicked = false
    element.addEventListener('lintje-row-click', () => (clicked = true))
    rows(element)[0]!.querySelector<HTMLElement>('lintje-button')!.click()
    expect(heard).toEqual([{ id: 'b', label: 'Brief-aan-bewoners.pdf', value: 'annuleren' }])
    expect(clicked).toBe(false)
  })

  it('stands consecutive rows of one group under its heading', async () => {
    const element = await mount({ items: WORK })
    const root = element.shadowRoot!
    const headings = [...root.querySelectorAll('.lintje-list__group')].map(
      (node) => node.textContent,
    )
    expect(headings).toEqual(['Vandaag', 'Gisteren'])
    const lists = [...root.querySelectorAll('ul')]
    expect(lists.map((list) => list.querySelectorAll('li').length)).toEqual([2, 1])
    expect(lists[0]!.getAttribute('aria-labelledby')).toBe(
      root.querySelector('.lintje-list__group')!.id,
    )
  })

  it('makes a group’s moment a heading, at the level the host gives', async () => {
    const element = await mount({ items: WORK })
    const levels = (): (string | null)[] =>
      [...element.shadowRoot!.querySelectorAll('.lintje-list__group')].map((node) =>
        node.getAttribute('role') === 'heading' ? node.getAttribute('aria-level') : null,
      )
    expect(levels()).toEqual(['3', '3'])
    element.headingLevel = 4
    await element.updateComplete
    expect(levels()).toEqual(['4', '4'])
  })

  it('keeps the host’s label on the whole of a grouped list', async () => {
    const element = await mount({ items: WORK, label: 'Eerder vertaald' })
    const group = element.shadowRoot!.querySelector('[role="group"]')!
    expect(group.getAttribute('aria-label')).toBe('Eerder vertaald')
    expect(group.querySelectorAll('ul')).toHaveLength(2)
  })

  it('draws a row that opens nothing without a row click', async () => {
    const element = await mount({
      items: [
        { id: 'x', title: 'Huurcontract.pdf', clickable: false },
        { id: 'y', title: 'Verklaring.docx', href: '/v', clickable: false },
      ],
    })
    const clicks = collect(element, 'lintje-row-click')
    const [plain, linked] = rows(element)
    expect(plain!.classList.contains('is-static')).toBe(true)
    expect(plain!.querySelector('.lintje-list__title')!.tagName).toBe('SPAN')
    expect(linked!.querySelector('.lintje-list__title')!.tagName).toBe('A')
    plain!.click()
    expect(clicks).toEqual([])
  })

  it('groups only consecutive runs, and items without a group as one run', () => {
    const runs = groupRuns([
      { id: '1', title: 'a' },
      { id: '2', title: 'b', group: 'Vandaag' },
      { id: '3', title: 'c', group: 'Vandaag' },
      { id: '4', title: 'd', group: 'Eerder' },
      { id: '5', title: 'e', group: 'Vandaag' },
    ])
    expect(runs.map((run) => `${run.label}:${run.items.length}`)).toEqual([
      ':1',
      'Vandaag:2',
      'Eerder:1',
      'Vandaag:1',
    ])
  })
})
