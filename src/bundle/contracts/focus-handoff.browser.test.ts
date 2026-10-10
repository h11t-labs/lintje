/** Focus handoff: when the control with the focus goes, the focus lands on a stated neighbour, never on `body`. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import '../../components/tables/activity-log/activity-log'
import '../../components/feedback/announcement/announcement'
import '../../components/content/audio-player/audio-player'
import '../../components/charts/chart/chart'
import '../../components/chat/chat/chat'
import '../../components/chat/chat-answer/chat-answer'
import '../../components/chat/chat-composer/chat-composer'
import '../../components/chat/chat-message/chat-message'
import '../../components/feedback/conflict-alert/conflict-alert'
import '../../components/tables/data-table/data-table'
import '../../components/filters/filter-zone/filter-zone'
import '../../components/forms/form/form'
import '../../components/inputs/date-input/date-input'
import '../../components/inputs/time-input/time-input'
import '../../components/inputs/date-range/date-range'
import '../../components/inputs/file-upload/file-upload'
import '../../components/inputs/segmented/segmented'
import '../../components/inputs/select/select'
import '../../components/inputs/tag-input/tag-input'
import '../../components/inputs/text-input/text-input'
import '../../components/inputs/toggle/toggle'
import '../../components/feedback/job-list/job-list'
import '../../components/tables/list/list'
import '../../components/map/map/map'
import '../../components/frame/notifications/notifications'
import '../../components/tables/pagination/pagination'
import '../../components/forms/repeater/repeater'
import '../../components/tables/sortable-list/sortable-list'
import '../../components/feedback/streaming-text/streaming-text'
import '../../components/frame/sub-nav/sub-nav'
import '../../components/feedback/toast/toast'
import '../../components/content/transcript/transcript'
import '../../components/content/translator/translator'
import '../../components/content/video-player/video-player'
import '../../components/frame/shell/shell'
import { holdsFocus } from '../../core/focus'
import type { UploadFile } from '../../components/inputs/file-upload/file-upload'
import type { LintjeList, ListItem } from '../../components/tables/list/list'
import type { LintjePagination } from '../../components/tables/pagination/pagination'
import type {
  LintjeTranscript,
  TranscriptSegment,
} from '../../components/content/transcript/transcript'
import type { DataTableData } from '../../types'

/** One element's case: it builds, puts the focus on a control and makes it go; then says where the focus belongs. */
interface Row {
  name: string
  run: () => Promise<() => Element | null>
}

/**
 * Rows that fail today: each entry is a line in `docs/OPEN_ISSUES.md` and matches a row's name.
 * An entry whose row passes fails the last test, so the fix takes its entry out.
 */
const KNOWN: RegExp[] = []
const seen = new Set<RegExp>()
let ran = 0

type Updating = HTMLElement & { updateComplete: Promise<unknown> }

/** The focused element through every shadow root; an SVG mark counts too. */
function active(): Element | null {
  let element = document.activeElement
  while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement
  return element
}

function label(element: Element | null): string {
  if (!element) return 'nothing'
  const text = element.textContent?.trim().slice(0, 30)
  return `<${element.localName}${element.className ? ` class="${element.className}"` : ''}>${text ? ` "${text}"` : ''}`
}

async function mount<T extends HTMLElement>(tag: string, props: object = {}): Promise<T> {
  const element = Object.assign(document.createElement(tag), props) as unknown as T
  document.body.append(element)
  await (element as unknown as Updating).updateComplete
  return element
}

/** Into a shadow root, step by step: `inside(host, 'lintje-button', 'button')`. */
function inside(root: Element | null | undefined, ...selectors: string[]): HTMLElement | null {
  let at: Element | null | undefined = root
  for (const selector of selectors) at = (at?.shadowRoot ?? at)?.querySelector(selector)
  return (at as HTMLElement | null) ?? null
}

/** The `<button>` a `lintje-button` or `lintje-icon-button` draws. */
const button = (host: Element | null | undefined): HTMLElement | null =>
  host?.shadowRoot?.querySelector<HTMLElement>('button, a') ?? null

/** Waits until a control is on the screen: a slotted one is drawn a frame after its slot. */
async function drawn(control: () => Element | null): Promise<void> {
  await expect.poll(() => (control()?.getClientRects().length ?? 0) > 0).toBe(true)
}

async function phone(): Promise<void> {
  await page.viewport(390, 844)
  // WebKit resizes the frame after `viewport()` resolves; a media query's `change` comes a frame later.
  await expect.poll(() => window.innerWidth).toBe(390)
  await new Promise(requestAnimationFrame)
  await new Promise(requestAnimationFrame)
}

/* --- lintje-list ----------------------------------------------------------- */

const LIST: ListItem[] = [
  { id: 'a', title: 'Eerste', actions: [{ value: 'weg', label: 'Verwijderen' }] },
  { id: 'b', title: 'Tweede', actions: [{ value: 'weg', label: 'Verwijderen' }] },
  { id: 'c', title: 'Derde', actions: [{ value: 'weg', label: 'Verwijderen' }] },
]

const listRows = (list: LintjeList): HTMLElement[] => [
  ...list.shadowRoot!.querySelectorAll<HTMLElement>('.lintje-list__row'),
]
const listTitle = (list: LintjeList, index: number): HTMLElement | null =>
  listRows(list)[index]?.querySelector('.lintje-list__title') ?? null
const listMenu = (list: LintjeList, index: number): HTMLElement | null =>
  inside(listRows(list)[index], 'lintje-menu-button', 'button')

async function listWith(items: ListItem[]): Promise<LintjeList> {
  const list = await mount<LintjeList>('lintje-list', { items })
  // A row's menu button draws its own root an update later.
  await expect
    .poll(() => listMenu(list, 0) ?? button(listRows(list)[0]?.querySelector('lintje-button')))
    .toBeTruthy()
  return list
}

const RENAME = { save: 'Opslaan' }
const renameField = (list: LintjeList): HTMLElement | null =>
  inside(list, '.lintje-list__rename lintje-text-input', 'input')

/** The second row renamed in place: its field takes the focus. */
async function renamingList(): Promise<LintjeList> {
  const list = await mount<LintjeList>('lintje-list', {
    items: LIST.map((item) => (item.id === 'b' ? { ...item, rename: RENAME } : item)),
  })
  await expect.poll(() => renameField(list) !== null && active() === renameField(list)).toBe(true)
  return list
}

const LIST_ROWS: Row[] = [
  {
    name: 'lintje-list :: a removed row hands its focus to the next row’s title',
    run: async () => {
      const list = await listWith(LIST)
      listMenu(list, 1)!.focus()
      list.items = LIST.filter((item) => item.id !== 'b')
      return () => listTitle(list, 1)
    },
  },
  {
    name: 'lintje-list :: the last row removed hands its focus to the row before',
    run: async () => {
      const list = await listWith(LIST)
      listMenu(list, 2)!.focus()
      list.items = LIST.slice(0, 2)
      return () => listTitle(list, 1)
    },
  },
  {
    name: 'lintje-list :: the only row removed hands its focus to the empty state',
    run: async () => {
      const list = await listWith(LIST.slice(0, 1))
      listMenu(list, 0)!.focus()
      list.items = []
      return () => list.shadowRoot!.querySelector('lintje-empty-state')
    },
  },
  {
    name: 'lintje-list :: an action replaced by a menu hands its focus to the menu',
    run: async () => {
      const list = await listWith([
        {
          id: 'w',
          title: 'Rapport.docx',
          clickable: false,
          action: { label: 'Annuleren', value: 'annuleren' },
        },
      ])
      button(listRows(list)[0]!.querySelector('lintje-button'))!.focus()
      list.items = [
        { id: 'w', title: 'Rapport.docx', actions: [{ value: 'weg', label: 'Verwijderen' }] },
      ]
      return () => listMenu(list, 0)
    },
  },
  {
    name: 'lintje-list :: a control that stays keeps its focus when another row goes',
    run: async () => {
      const list = await listWith(LIST)
      const kept = listMenu(list, 0)!
      kept.focus()
      list.items = LIST.filter((item) => item.id !== 'c')
      await list.updateComplete
      return () => kept
    },
  },
  {
    name: 'lintje-list :: a rename cancelled with Escape hands its focus to the row’s title',
    run: async () => {
      const list = await renamingList()
      list.addEventListener('lintje-row-rename-cancel', () => (list.items = LIST))
      await userEvent.keyboard('{Escape}')
      return () => listTitle(list, 1)
    },
  },
  {
    name: 'lintje-list :: a rename saved under a new id hands its focus to the row in the same place',
    run: async () => {
      const list = await renamingList()
      list.addEventListener('lintje-row-rename', (event) => {
        const { value } = (event as CustomEvent<{ value: string }>).detail
        list.items = LIST.map((item) =>
          item.id === 'b' ? { ...item, id: 'b2', title: value } : item,
        )
      })
      await userEvent.keyboard('Tweede versie{Enter}')
      await expect.poll(() => listTitle(list, 1)?.textContent?.trim()).toBe('Tweede versie')
      return () => listTitle(list, 1)
    },
  },
  {
    name: 'lintje-list :: a rename that goes on, with an error, keeps the focus in its field',
    run: async () => {
      const list = await renamingList()
      list.items = LIST.map((item) =>
        item.id === 'b' ? { ...item, rename: { ...RENAME, error: 'Geef een naam.' } } : item,
      )
      await expect
        .poll(() => inside(list, '.lintje-list__rename lintje-text-input')?.getAttribute('error'))
        .toBe('Geef een naam.')
      return () => renameField(list)
    },
  },
]

/* --- lintje-data-table ----------------------------------------------------- */

type TableElement = HTMLElement & { data: DataTableData; updateComplete: Promise<unknown> }

const tablePart = (table: Element, selector: string): HTMLElement | null =>
  table.shadowRoot!.querySelector<HTMLElement>(selector)

const FILTERED: DataTableData = {
  caption: 'Loketten',
  rowKey: 'name',
  columns: [
    { key: 'name', header: 'Loket', filter: { kind: 'text' } },
    { key: 'region', header: 'Regio', filter: { kind: 'text' } },
    { key: 'requests', header: 'Aanvragen' },
  ],
  rows: [{ name: 'Utrecht', region: 'Midden', requests: 12 }],
  filters: { name: 'Utr' },
}

const SELECTED: DataTableData = {
  caption: 'Loketten',
  rowKey: 'name',
  selectable: true,
  checkedIds: ['Utrecht'],
  bulkActions: [{ value: 'toewijzen', label: 'Toewijzen' }],
  columns: [
    { key: 'name', header: 'Loket' },
    { key: 'requests', header: 'Aanvragen' },
  ],
  rows: [{ name: 'Utrecht', requests: 12 }],
}

/** A selection and a row menu the host answers. */
const ANSWERED: DataTableData = {
  ...SELECTED,
  rowActions: [{ value: 'weg', label: 'Verwijderen' }],
  rows: [
    { name: 'Utrecht', requests: 12 },
    { name: 'Zwolle', requests: 4 },
  ],
}

/** The first of the matching controls that is on the screen: the table draws its wide and its phone layout. */
const visible = (table: Element, selector: string): HTMLElement | null =>
  [...table.shadowRoot!.querySelectorAll<HTMLElement>(selector)].find(
    (candidate) => candidate.getClientRects().length > 0,
  ) ?? null

const DATA_TABLE_ROWS: Row[] = [
  {
    name: 'lintje-data-table :: the last chip’s cross hands its focus to its column’s funnel',
    run: async () => {
      const table = await mount<TableElement>('lintje-data-table', { data: FILTERED })
      const cross = tablePart(table, '.lintje-data-table__chip-clear')!
      cross.focus()
      cross.click()
      return () => tablePart(table, '.lintje-data-table__funnel[data-column="name"]')
    },
  },
  {
    name: 'lintje-data-table :: a chip’s cross hands its focus to the next chip',
    run: async () => {
      const table = await mount<TableElement>('lintje-data-table', {
        data: { ...FILTERED, filters: { name: 'Utr', region: 'Mid' } },
      })
      const cross = tablePart(table, '.lintje-data-table__chip-clear')!
      cross.focus()
      cross.click()
      return () => tablePart(table, '.lintje-data-table__chip-clear')
    },
  },
  {
    name: 'lintje-data-table :: "Selectie opheffen" hands its focus to "Alles selecteren"',
    run: async () => {
      const table = await mount<TableElement>('lintje-data-table', { data: SELECTED })
      const clear = tablePart(table, '.lintje-data-table__selection-clear') as Updating
      await clear.updateComplete
      button(clear)!.focus()
      button(clear)!.click()
      return () => tablePart(table, '.lintje-data-table__full thead .lintje-choice__input')
    },
  },
  {
    name: 'lintje-data-table :: the last chip’s cross at 390 px hands its focus to "Filters"',
    run: async () => {
      const table = await mount<TableElement>('lintje-data-table', { data: FILTERED })
      await phone()
      await drawn(() => visible(table, '.lintje-data-table__chip-clear'))
      const cross = visible(table, '.lintje-data-table__chip-clear')!
      cross.focus()
      await userEvent.keyboard('{Enter}')
      return () => button(visible(table, '.lintje-data-table__sheet-button'))
    },
  },
  {
    name: 'lintje-data-table :: "Selectie opheffen" at 390 px hands its focus to "Alles selecteren"',
    run: async () => {
      const table = await mount<TableElement>('lintje-data-table', { data: SELECTED })
      await phone()
      const clear = (): HTMLElement | null =>
        button(visible(table, '.lintje-data-table__selection-clear'))
      await drawn(clear)
      clear()!.focus()
      await userEvent.keyboard('{Enter}')
      return () => tablePart(table, '.lintje-data-table__mobile thead .lintje-choice__input')
    },
  },
  {
    name: 'lintje-data-table :: a bulk action, gone when the host clears the selection, hands its focus to "Alles selecteren"',
    run: async () => {
      const table = await mount<TableElement>('lintje-data-table', { data: ANSWERED })
      table.addEventListener('lintje-bulk-action', () => {
        table.data = { ...table.data, checkedIds: [] }
      })
      const action = tablePart(table, '.lintje-data-table__selection lintje-button') as Updating
      await action.updateComplete
      button(action)!.focus()
      await userEvent.keyboard('{Enter}')
      return () => tablePart(table, '.lintje-data-table__full thead .lintje-choice__input')
    },
  },
  {
    name: 'lintje-data-table :: the menu of a removed last row hands its focus to the same menu in the row before',
    run: async () => {
      const table = await mount<TableElement>('lintje-data-table', { data: ANSWERED })
      table.addEventListener('lintje-row-action', (event) => {
        const { id } = (event as CustomEvent<{ id: string }>).detail
        table.data = { ...table.data, rows: table.data.rows.filter((row) => row.name !== id) }
      })
      const menus = (): Element[] => [
        ...table.shadowRoot!.querySelectorAll('.lintje-data-table__full tbody lintje-menu-button'),
      ]
      const last = menus()[1] as Updating
      await last.updateComplete
      inside(last, '.lintje-menu-button__trigger')!.focus()
      // The menu's choice, as the menu sends it once it has closed.
      last.dispatchEvent(new CustomEvent('lintje-action', { detail: 'weg', bubbles: true }))
      await expect.poll(() => menus().length).toBe(1)
      return () => inside(menus()[0], '.lintje-menu-button__trigger')
    },
  },
]

/* --- lintje-pagination ----------------------------------------------------- */

const step = (pagination: LintjePagination, which: 'previous' | 'next'): HTMLElement =>
  pagination.shadowRoot!.querySelector<HTMLElement>(`[data-step="${which}"]`)!

/** Below 768 px the numbers are hidden: a step that turns disabled has no current page to fall back to. */
async function paginationOnPhone(at: number): Promise<LintjePagination> {
  const pagination = await mount<LintjePagination>('lintje-pagination', { page: at, pageCount: 20 })
  await phone()
  return pagination
}

const PAGINATION_ROWS: Row[] = [
  {
    name: 'lintje-pagination :: Volgende, disabled on the last page at 390 px, hands its focus to Vorige',
    run: async () => {
      const pagination = await paginationOnPhone(19)
      step(pagination, 'next').focus()
      await userEvent.keyboard('{Enter}')
      await expect.poll(() => pagination.page).toBe(20)
      return () => step(pagination, 'previous')
    },
  },
  {
    name: 'lintje-pagination :: Vorige, disabled on the first page at 390 px, hands its focus to Volgende',
    run: async () => {
      const pagination = await paginationOnPhone(2)
      step(pagination, 'previous').focus()
      await userEvent.keyboard('{Enter}')
      await expect.poll(() => pagination.page).toBe(1)
      return () => step(pagination, 'next')
    },
  },
  {
    name: 'lintje-pagination :: a step that can still be used keeps its focus at 390 px',
    run: async () => {
      const pagination = await paginationOnPhone(5)
      step(pagination, 'next').focus()
      await userEvent.keyboard('{Enter}')
      await expect.poll(() => pagination.page).toBe(6)
      await pagination.updateComplete
      return () => step(pagination, 'next')
    },
  },
]

/* --- lintje-file-upload ---------------------------------------------------- */

const FILES: UploadFile[] = [
  { id: 'f1', name: 'verslag.pdf', size: 120_000, state: 'done' },
  { id: 'f2', name: 'bijlage.pdf', size: 80_000, state: 'done' },
]

/** A host as a page has it: a removed file leaves its `files`. */
async function uploadWith(files: UploadFile[]): Promise<HTMLElement & { files: UploadFile[] }> {
  const upload = await mount<HTMLElement & { files: UploadFile[] }>('lintje-file-upload', {
    label: 'Bijlagen',
    files,
  })
  upload.addEventListener('lintje-file-remove', (event) => {
    const { id } = (event as CustomEvent<{ id: string }>).detail
    upload.files = upload.files.filter((file) => file.id !== id)
  })
  return upload
}

const fileRemove = (upload: Element, index: number): HTMLElement | null =>
  button(upload.shadowRoot!.querySelectorAll('.lintje-file-upload__row lintje-button')[index])

const FILE_UPLOAD_ROWS: Row[] = [
  {
    name: 'lintje-file-upload :: a file’s Verwijderen hands its focus to the next file’s',
    run: async () => {
      const upload = await uploadWith(FILES)
      await expect.poll(() => fileRemove(upload, 0)).toBeTruthy()
      fileRemove(upload, 0)!.focus()
      await userEvent.keyboard('{Enter}')
      return () => fileRemove(upload, 0)
    },
  },
  {
    name: 'lintje-file-upload :: the only file’s Verwijderen hands its focus to "Bestanden kiezen"',
    run: async () => {
      const upload = await uploadWith(FILES.slice(0, 1))
      await expect.poll(() => fileRemove(upload, 0)).toBeTruthy()
      fileRemove(upload, 0)!.focus()
      await userEvent.keyboard('{Enter}')
      return () => button(upload.shadowRoot!.querySelector('.lintje-file-upload__button'))
    },
  },
]

/* --- lintje-transcript ----------------------------------------------------- */

const SEGMENTS: TranscriptSegment[] = [
  { id: 's1', start: 702, speaker: 'Spreker 1', text: 'Dan de planning voor volgende week.' },
  { id: 's2', start: 724, speaker: 'Spreker 2', text: 'Is dat afgestemd met het team?' },
  { id: 's3', start: 739, speaker: 'Spreker 1', text: 'Nog niet. Ik stuur vandaag een bericht.' },
]

/** A host as a page has it: it holds `editingId` and the text, and answers every request. */
async function transcript(): Promise<LintjeTranscript> {
  const element = await mount<LintjeTranscript>('lintje-transcript', { segments: SEGMENTS })
  element.addEventListener('lintje-segment-edit', (event) => {
    element.editingId = (event as CustomEvent<string>).detail
  })
  element.addEventListener('lintje-segment-cancel', () => {
    element.editingId = null
  })
  element.addEventListener('lintje-segment-save', (event) => {
    const { id, text } = (event as CustomEvent<{ id: string; text: string }>).detail
    element.segments = element.segments.map((item) => (item.id === id ? { ...item, text } : item))
    element.editingId = null
  })
  return element
}

const segment = (element: LintjeTranscript, id: string): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>(`.lintje-transcript__segment[data-id="${id}"]`)!
const pencil = (element: LintjeTranscript, id: string): HTMLElement | null =>
  button(segment(element, id).querySelector('.lintje-transcript__edit'))
const segmentField = (element: LintjeTranscript, id: string): HTMLElement | null =>
  inside(segment(element, id).querySelector('lintje-textarea'), 'textarea')
const segmentText = (element: LintjeTranscript, id: string): HTMLElement =>
  segment(element, id).querySelector<HTMLElement>('.lintje-transcript__text')!

/** From the pencil, by the keyboard: the way a reader without a pointer starts an edit. */
async function editFromPencil(element: LintjeTranscript, id: string): Promise<void> {
  pencil(element, id)!.focus()
  await userEvent.keyboard('{Enter}')
  await expect.poll(active).toBe(segmentField(element, id))
}

/** A save from the field, which the host holds busy: the field is disabled until it answers. */
async function savingFromField(): Promise<LintjeTranscript> {
  const element = await mount<LintjeTranscript>('lintje-transcript', {
    segments: SEGMENTS,
    editingId: 's2',
  })
  element.addEventListener('lintje-segment-save', (event) => {
    element.busyId = (event as CustomEvent<{ id: string }>).detail.id
  })
  await expect.poll(() => segmentField(element, 's2')).toBeTruthy()
  segmentField(element, 's2')!.focus()
  await userEvent.keyboard('{Control>}{Enter}{/Control}')
  await expect.poll(() => element.busyId).toBe('s2')
  return element
}

const TRANSCRIPT_ROWS: Row[] = [
  {
    name: 'lintje-transcript :: the pencil hands its focus to the fragment’s field',
    run: async () => {
      const element = await transcript()
      pencil(element, 's2')!.focus()
      await userEvent.keyboard('{Enter}')
      return () => segmentField(element, 's2')
    },
  },
  {
    name: 'lintje-transcript :: a double click on the text puts the focus in the fragment’s field',
    run: async () => {
      const element = await transcript()
      await userEvent.dblClick(segmentText(element, 's3'))
      return () => segmentField(element, 's3')
    },
  },
  {
    name: 'lintje-transcript :: the field, closed with Escape, hands its focus to the pencil',
    run: async () => {
      const element = await transcript()
      await editFromPencil(element, 's2')
      await userEvent.keyboard('{Escape}')
      return () => pencil(element, 's2')
    },
  },
  {
    name: 'lintje-transcript :: the field, saved with Ctrl+Enter, hands its focus to the pencil',
    run: async () => {
      const element = await transcript()
      await editFromPencil(element, 's1')
      await userEvent.keyboard(' Graag.{Control>}{Enter}{/Control}')
      await expect
        .poll(() => element.segments[0]!.text)
        .toBe('Dan de planning voor volgende week. Graag.')
      return () => pencil(element, 's1')
    },
  },
  {
    name: 'lintje-transcript :: "Annuleren" hands its focus to the pencil',
    run: async () => {
      const element = await transcript()
      await editFromPencil(element, 's3')
      await userEvent.click(segment(element, 's3').querySelectorAll('lintje-button')[1]!)
      return () => pencil(element, 's3')
    },
  },
  {
    name: 'lintje-transcript :: an edit a double click started hands its focus to the pencil on Escape',
    run: async () => {
      const element = await transcript()
      await userEvent.dblClick(segmentText(element, 's1'))
      await expect.poll(active).toBe(segmentField(element, 's1'))
      await userEvent.keyboard('{Escape}')
      return () => pencil(element, 's1')
    },
  },
  {
    name: 'lintje-transcript :: the field, disabled while its save runs, hands its focus to "Opslaan"',
    run: async () => {
      const element = await savingFromField()
      return () => button(segment(element, 's2').querySelector('lintje-button'))
    },
  },
  {
    name: 'lintje-transcript :: "Opslaan", when the save fails, hands its focus back to the field',
    run: async () => {
      const element = await savingFromField()
      const save = (): HTMLElement | null =>
        button(segment(element, 's2').querySelector('lintje-button'))
      await expect.poll(active).toBe(save())
      Object.assign(element, {
        busyId: null,
        errors: { s2: 'Opslaan is niet gelukt. Probeer het opnieuw.' },
      })
      return () => segmentField(element, 's2')
    },
  },
]

/* --- Inputs ---------------------------------------------------------------- */

const tagRemove = (tags: Element, index: number): HTMLElement | null =>
  tags.shadowRoot!.querySelector<HTMLElement>(`.lintje-tag-input__remove[data-index="${index}"]`)
const tagField = (tags: Element): HTMLElement | null =>
  tags.shadowRoot!.querySelector<HTMLElement>('.lintje-tag-input__input')

async function tagInput(): Promise<HTMLElement> {
  return mount('lintje-tag-input', {
    label: 'Trefwoorden',
    value: ['subsidie', 'vergunning', 'melding'],
  })
}

const INPUT_ROWS: Row[] = [
  {
    name: 'lintje-tag-input :: a chip’s cross, clicked, hands its focus to the field',
    run: async () => {
      const tags = await tagInput()
      tagRemove(tags, 0)!.focus()
      tagRemove(tags, 0)!.click()
      return () => tagField(tags)
    },
  },
  {
    name: 'lintje-tag-input :: a chip removed with Delete hands its focus to the next chip',
    run: async () => {
      const tags = await tagInput()
      tagRemove(tags, 1)!.focus()
      await userEvent.keyboard('{Delete}')
      await expect
        .poll(() => tags.shadowRoot!.querySelectorAll('.lintje-tag-input__remove').length)
        .toBe(2)
      return () => tagRemove(tags, 1)
    },
  },
  {
    name: 'lintje-tag-input :: the last chip removed with Delete hands its focus to the field',
    run: async () => {
      const tags = await tagInput()
      tagRemove(tags, 2)!.focus()
      await userEvent.keyboard('{Delete}')
      return () => tagField(tags)
    },
  },
  {
    name: 'lintje-tag-input :: a chip removed with Backspace hands its focus to the field',
    run: async () => {
      const tags = await tagInput()
      tagRemove(tags, 0)!.focus()
      await userEvent.keyboard('{Backspace}')
      return () => tagField(tags)
    },
  },
  {
    name: 'lintje-date-input :: a day picked closes the calendar and hands its focus to the field',
    run: async () => {
      const date = await mount<HTMLElement & { value: string | null }>('lintje-date-input', {
        label: 'Datum',
        value: '2026-03-12',
      })
      date.shadowRoot!.querySelector<HTMLElement>('.lintje-date-input__toggle')!.focus()
      await userEvent.keyboard('{Enter}')
      await expect.poll(() => active()?.classList.contains('lintje-date-input__day')).toBe(true)
      await userEvent.keyboard('{Enter}')
      return () => date.shadowRoot!.querySelector('.lintje-date-input__control')
    },
  },
  {
    name: 'lintje-time-input :: a time picked closes the list and hands its focus to the field',
    run: async () => {
      const time = await mount<HTMLElement & { value: string | null }>('lintje-time-input', {
        label: 'Aanvang',
        value: '09:00',
      })
      time.shadowRoot!.querySelector<HTMLElement>('.lintje-time-input__toggle')!.focus()
      await userEvent.keyboard('{Enter}')
      await expect.poll(() => active()?.classList.contains('lintje-time-input__option')).toBe(true)
      await userEvent.keyboard('{Enter}')
      return () => time.shadowRoot!.querySelector('.lintje-time-input__control')
    },
  },
  {
    name: 'lintje-date-range :: "Toepassen" closes the calendar and hands its focus to the field',
    run: async () => {
      const range = await mount<HTMLElement>('lintje-date-range', {
        label: 'Periode',
        range: { from: '02-03-2026', to: '13-03-2026' },
      })
      const field = range.shadowRoot!.querySelector<HTMLElement>(
        '.lintje-date-range-picker__field',
      )!
      field.focus()
      await userEvent.keyboard('{Enter}')
      const apply = (): HTMLElement | null =>
        button(
          range.shadowRoot!.querySelectorAll('.lintje-date-range-picker__actions lintje-button')[1],
        )
      await expect.poll(apply).toBeTruthy()
      apply()!.focus()
      await userEvent.keyboard('{Enter}')
      return () => field
    },
  },
  {
    name: 'lintje-translator :: "Tekst wissen" goes with the text and hands its focus to the field',
    run: async () => {
      const translator = await mount<HTMLElement & { value: string }>('lintje-translator', {
        value: 'Goedemorgen',
      })
      const clear = (): HTMLElement | null =>
        button(translator.shadowRoot!.querySelector('.lintje-translator__clear'))
      await expect.poll(clear).toBeTruthy()
      clear()!.focus()
      await userEvent.keyboard('{Enter}')
      return () => inside(translator.shadowRoot!.querySelector('lintje-textarea'), 'textarea')
    },
  },
  ...(
    [
      ['lintje-select', 'select'],
      ['lintje-segmented', '.lintje-segmented__option'],
      ['lintje-toggle', '.lintje-choice__input'],
    ] as const
  ).map(([tag, control]): Row => ({
    name: `${tag} :: the reset link, gone when the host resets, hands its focus to the control`,
    run: async () => {
      const field = await mount<HTMLElement & { modified: boolean }>(tag, {
        label: 'Periode',
        options: [
          { value: 'dag', label: 'Dag' },
          { value: 'week', label: 'Week' },
        ],
        value: 'week',
        resetLabel: 'Terugzetten naar Dag',
        modified: true,
      })
      field.addEventListener('lintje-reset', () => (field.modified = false))
      const reset = (): HTMLElement | null => inside(field, '.lintje-field__reset')
      await drawn(reset)
      reset()!.focus()
      await userEvent.keyboard('{Enter}')
      await expect.poll(reset).toBeNull()
      return () => inside(field, control)
    },
  })),
]

/* --- Rows that go: repeater, activity log, job list, notifications -------- */

/** A host as a page has it: it removes the row the repeater asks for. */
async function repeater(count: number): Promise<HTMLElement> {
  const element = document.createElement('lintje-repeater')
  Object.assign(element, { legend: 'Betrokkenen', itemLabel: 'Betrokkene' })
  for (let index = 0; index < count; index++) {
    const row = document.createElement('lintje-repeater-row')
    row.innerHTML = `<input aria-label="Naam ${index + 1}" />`
    element.append(row)
  }
  element.addEventListener('lintje-row-remove', (event) => {
    element.children[(event as CustomEvent<number>).detail]?.remove()
  })
  document.body.append(element)
  await (element as Updating).updateComplete
  return element
}

const repeaterRemove = (row: Element | null | undefined): HTMLElement | null =>
  inside(row, 'lintje-icon-button', 'button')

const ENTRIES = Array.from({ length: 14 }, (_, index) => ({
  who: index % 2 ? 'A. de Vries' : 'M. Jansen',
  what: `Stap ${14 - index} afgerond`,
  when: `${index + 1} maart`,
}))

const NOTIFICATIONS = [
  { id: 'n1', title: 'Nieuwe aanvraag', when: '10:12', unread: true },
  { id: 'n2', title: 'Besluit verstuurd', when: '09:40', unread: true },
]

const COLLECTION_ROWS: Row[] = [
  {
    name: 'lintje-repeater :: a removed row hands its focus to the remove button of the row above',
    run: async () => {
      const element = await repeater(3)
      await expect.poll(() => repeaterRemove(element.children[2])).toBeTruthy()
      repeaterRemove(element.children[2])!.focus()
      await userEvent.keyboard('{Enter}')
      return () => repeaterRemove(element.children[1])
    },
  },
  {
    name: 'lintje-repeater :: the only row removed hands its focus to the add button',
    run: async () => {
      const element = await repeater(1)
      await expect.poll(() => repeaterRemove(element.children[0])).toBeTruthy()
      repeaterRemove(element.children[0])!.focus()
      await userEvent.keyboard('{Enter}')
      return () => button(element.shadowRoot!.querySelector('.lintje-repeater__foot lintje-button'))
    },
  },
  {
    name: 'lintje-activity-log :: "Toon eerdere", gone with the last entries, hands its focus to the first new entry',
    run: async () => {
      const log = await mount<HTMLElement>('lintje-activity-log', { entries: ENTRIES })
      const more = (): HTMLElement | null =>
        button(log.shadowRoot!.querySelector('.lintje-activity-log__more'))
      await expect.poll(more).toBeTruthy()
      more()!.focus()
      await userEvent.keyboard('{Enter}')
      return () => log.shadowRoot!.querySelectorAll('.lintje-activity-log__entry')[10] ?? null
    },
  },
  {
    name: 'lintje-activity-log :: "Toon eerdere" that stays keeps its focus',
    run: async () => {
      const log = await mount<HTMLElement>('lintje-activity-log', {
        entries: [...ENTRIES, ...ENTRIES],
      })
      const more = (): HTMLElement | null =>
        button(log.shadowRoot!.querySelector('.lintje-activity-log__more'))
      await expect.poll(more).toBeTruthy()
      const kept = more()!
      kept.focus()
      await userEvent.keyboard('{Enter}')
      await expect
        .poll(() => log.shadowRoot!.querySelectorAll('.lintje-activity-log__entry').length)
        .toBe(20)
      return () => kept
    },
  },
  {
    name: 'lintje-job-list :: the last job gone hands its focus to the status region',
    run: async () => {
      const jobs = await mount<HTMLElement & { jobs: unknown[] }>('lintje-job-list', {
        jobs: [
          { id: 'j1', name: 'Rapport.docx', state: 'error', detail: 'Het bestand is beschadigd.' },
        ],
      })
      const list = (): Element | null => jobs.shadowRoot!.querySelector('lintje-list')
      const action = (): HTMLElement | null =>
        button(inside(list(), '.lintje-list__row lintje-button'))
      await expect.poll(action).toBeTruthy()
      action()!.focus()
      jobs.jobs = []
      return () => jobs.shadowRoot!.querySelector('[role="status"]')
    },
  },
  {
    name: 'lintje-notifications :: "Alles gelezen", gone at nought unread, hands its focus to the first item',
    run: async () => {
      const bell = await mount<HTMLElement & { items: typeof NOTIFICATIONS }>(
        'lintje-notifications',
        {
          items: NOTIFICATIONS,
          open: true,
        },
      )
      bell.addEventListener('lintje-notifications-read', () => {
        bell.items = bell.items.map((item) => ({ ...item, unread: false }))
      })
      const read = (): HTMLElement | null => inside(bell, '.lintje-notifications__read')
      await expect.poll(read).toBeTruthy()
      read()!.focus()
      await userEvent.keyboard('{Enter}')
      return () => inside(bell, '.lintje-notifications__title')
    },
  },
]

/* --- Messages: toast, announcement, conflict alert ------------------------- */

const MESSAGE_ROWS: Row[] = [
  {
    name: 'lintje-toast :: closed with the focus inside, it hands the focus back to where it was',
    run: async () => {
      const before = Object.assign(document.createElement('button'), { textContent: 'Opslaan' })
      document.body.append(before)
      before.focus()
      const toast = await mount<HTMLElement>('lintje-toast', {
        kind: 'error',
        textContent: 'Opslaan is mislukt.',
      })
      const close = (): HTMLElement | null => inside(toast, '.lintje-toast__close')
      await expect.poll(close).toBeTruthy()
      close()!.focus()
      await userEvent.keyboard('{Enter}')
      return () => before
    },
  },
  {
    name: 'lintje-toast :: closed with the focus inside and nowhere to go back to, it hands the focus to <main>',
    run: async () => {
      const main = Object.assign(document.createElement('main'), { tabIndex: -1 })
      document.body.append(main)
      const toast = document.createElement('lintje-toast')
      Object.assign(toast, { kind: 'error', textContent: 'Opslaan is mislukt.' })
      main.append(toast)
      await (toast as Updating).updateComplete
      const close = (): HTMLElement | null => inside(toast, '.lintje-toast__close')
      await expect.poll(close).toBeTruthy()
      close()!.focus()
      await userEvent.keyboard('{Enter}')
      return () => main
    },
  },
  {
    name: 'lintje-announcement :: closed, it hands its focus to the next stop on the page',
    run: async () => {
      const announcement = await mount<HTMLElement>('lintje-announcement', {
        data: { kind: 'info', title: 'Onderhoud vanavond', dismissible: true },
      })
      const after = Object.assign(document.createElement('button'), { textContent: 'Verder' })
      document.body.append(after)
      const close = (): HTMLElement | null => inside(announcement, '.lintje-announcement__close')
      await expect.poll(close).toBeTruthy()
      close()!.focus()
      await userEvent.keyboard('{Enter}')
      await expect.poll(close).toBeNull()
      return () => after
    },
  },
  {
    name: 'lintje-announcement :: closed with nothing after it, it hands its focus to the stop before',
    run: async () => {
      const before = Object.assign(document.createElement('button'), { textContent: 'Terug' })
      document.body.append(before)
      const announcement = await mount<HTMLElement>('lintje-announcement', {
        data: { kind: 'info', title: 'Onderhoud vanavond', dismissible: true },
      })
      const close = (): HTMLElement | null => inside(announcement, '.lintje-announcement__close')
      await expect.poll(close).toBeTruthy()
      close()!.focus()
      await userEvent.keyboard('{Enter}')
      await expect.poll(close).toBeNull()
      return () => before
    },
  },
  {
    name: 'lintje-conflict-alert :: the chosen version, busy, keeps its focus',
    run: async () => {
      const alert = await mount<HTMLElement & { busy: string }>('lintje-conflict-alert', {
        who: 'M. Jansen',
        when: '10:40',
      })
      alert.addEventListener('lintje-conflict-keep-mine', () => (alert.busy = 'mine'))
      const mine = (): HTMLElement | null =>
        button(alert.shadowRoot!.querySelectorAll('lintje-button')[1])
      await drawn(mine)
      const kept = mine()!
      kept.focus()
      await userEvent.keyboard('{Enter}')
      await expect.poll(() => kept.getAttribute('aria-busy')).toBe('true')
      return () => kept
    },
  },
  {
    name: 'lintje-conflict-alert :: "Verschillen bekijken", disabled while a version saves, keeps its focus',
    run: async () => {
      const alert = await mount<HTMLElement & { busy: string }>('lintje-conflict-alert', {
        who: 'M. Jansen',
      })
      const compare = (): HTMLElement | null =>
        button(alert.shadowRoot!.querySelector('lintje-button'))
      await drawn(compare)
      const kept = compare()!
      kept.focus()
      alert.busy = 'theirs'
      await expect.poll(() => kept.getAttribute('aria-disabled')).toBe('true')
      return () => kept
    },
  },
]

/* --- Streams and conversation ---------------------------------------------- */

type Stream = HTMLElement & { state: string; text: string }

/** "Stoppen" with the focus, while the text streams in. */
async function streaming(): Promise<Stream> {
  const stream = await mount<Stream>('lintje-streaming-text', {
    text: 'De aanvraag is',
    state: 'streaming',
  })
  const stop = (): HTMLElement | null =>
    button(stream.shadowRoot!.querySelector('.lintje-streaming-text__stop'))
  await expect.poll(stop).toBeTruthy()
  stop()!.focus()
  return stream
}

const streamRetry = (stream: Stream): HTMLElement | null =>
  button(stream.shadowRoot!.querySelector('.lintje-streaming-text__retry'))

type Composer = HTMLElement & { busy: boolean; text: string }
const composerField = (composer: Element | null): HTMLElement | null =>
  inside(composer, '.lintje-chat-composer__input')

async function chatComposer(): Promise<Composer> {
  // The first `busy` the composer gets is its start, not a change.
  return mount<Composer>('lintje-chat-composer', { busy: false, text: 'Hoeveel aanvragen?' })
}

const CONVERSATION_ROWS: Row[] = [
  {
    name: 'lintje-streaming-text :: "Stoppen", gone when the stream ends, hands its focus to the text',
    run: async () => {
      const stream = await streaming()
      Object.assign(stream, { text: 'De aanvraag is goedgekeurd.', state: 'done' })
      return () => stream.shadowRoot!.querySelector('.lintje-streaming-text__box')
    },
  },
  {
    name: 'lintje-streaming-text :: "Stoppen", pressed, hands its focus to "Opnieuw"',
    run: async () => {
      const stream = await streaming()
      stream.addEventListener('lintje-stop', () => (stream.state = 'stopped'))
      await userEvent.keyboard('{Enter}')
      return () => streamRetry(stream)
    },
  },
  {
    name: 'lintje-streaming-text :: "Stoppen", gone when the stream breaks, hands its focus to "Opnieuw"',
    run: async () => {
      const stream = await streaming()
      stream.state = 'error'
      return () => streamRetry(stream)
    },
  },
  {
    name: 'lintje-chat-composer :: "Versturen", gone while the answer comes, hands its focus to the field',
    run: async () => {
      const element = await chatComposer()
      const send = (): HTMLElement | null =>
        button(inside(element, '.lintje-chat-composer__send lintje-button'))
      await expect.poll(send).toBeTruthy()
      send()!.focus()
      element.busy = true
      return () => composerField(element)
    },
  },
  {
    name: 'lintje-chat-composer :: "Stoppen", gone when the answer is in, hands its focus to the field',
    run: async () => {
      const element = await chatComposer()
      element.busy = true
      const stop = (): HTMLElement | null => button(inside(element, '.lintje-chat-composer__stop'))
      await expect.poll(stop).toBeTruthy()
      stop()!.focus()
      element.busy = false
      return () => composerField(element)
    },
  },
  {
    name: 'lintje-chat-message :: "Vraag bewerken" hands its focus to the question’s field',
    run: async () => {
      const message = await mount<HTMLElement>('lintje-chat-message', {
        text: 'Hoeveel aanvragen kwamen er in maart binnen?',
        editable: true,
      })
      const edit = (): HTMLElement | null => button(inside(message, '.lintje-chat-message__edit'))
      await expect.poll(edit).toBeTruthy()
      edit()!.focus()
      await userEvent.keyboard('{Enter}')
      return () => composerField(inside(message, 'lintje-chat-composer'))
    },
  },
  {
    name: 'lintje-chat-message :: the edit, cancelled with Escape, hands its focus to "Vraag bewerken"',
    run: async () => {
      const message = await mount<HTMLElement>('lintje-chat-message', {
        text: 'Hoeveel aanvragen kwamen er in maart binnen?',
        editable: true,
      })
      const edit = (): HTMLElement | null => button(inside(message, '.lintje-chat-message__edit'))
      await expect.poll(edit).toBeTruthy()
      edit()!.focus()
      await userEvent.keyboard('{Enter}')
      await expect.poll(active).toBe(composerField(inside(message, 'lintje-chat-composer')))
      await userEvent.keyboard('{Escape}')
      return edit
    },
  },
  {
    name: 'lintje-chat-composer :: the send options, closed with Escape, hand their focus to their toggle',
    run: async () => {
      const element = await chatComposer()
      const toggle = (): HTMLElement | null =>
        button(inside(element, '.lintje-chat-composer__options-toggle'))
      await drawn(toggle)
      toggle()!.focus()
      await userEvent.keyboard('{Enter}')
      const options = (): HTMLElement | null => inside(element, '.lintje-chat-composer__options')
      await expect.poll(() => options() !== null && holdsFocus(options()!)).toBe(true)
      await userEvent.keyboard('{Escape}')
      return toggle
    },
  },
  {
    name: 'lintje-chat-answer :: a reason chosen, gone with the reasons, hands its focus to "Slecht antwoord"',
    run: async () => {
      const answer = await mount<HTMLElement>('lintje-chat-answer', {
        lead: 'Het zijn er 148.230.',
        text: 'Dat is meer dan vorige week.',
      })
      const down = (): HTMLElement | null => button(inside(answer, '[label="Slecht antwoord"]'))
      await drawn(down)
      down()!.focus()
      await userEvent.keyboard('{Enter}')
      const reason = (): HTMLElement | null =>
        button(inside(answer, '.lintje-chat-answer__reasons lintje-button'))
      await drawn(reason)
      reason()!.focus()
      await userEvent.keyboard('{Enter}')
      await expect.poll(() => inside(answer, '.lintje-chat-answer__reasons')).toBeNull()
      return down
    },
  },
]

/* --- Media ----------------------------------------------------------------- */

/** A silent 8-bit mono WAV: real media that loads without the network. */
function silence(seconds = 10): string {
  const rate = 8000
  const samples = rate * seconds
  const view = new DataView(new ArrayBuffer(44 + samples))
  const text = (at: number, value: string): void =>
    [...value].forEach((char, index) => view.setUint8(at + index, char.charCodeAt(0)))
  text(0, 'RIFF')
  view.setUint32(4, 36 + samples, true)
  text(8, 'WAVEfmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, rate, true)
  view.setUint32(28, rate, true)
  view.setUint16(32, 1, true)
  view.setUint16(34, 8, true)
  text(36, 'data')
  view.setUint32(40, samples, true)
  new Uint8Array(view.buffer, 44).fill(128)
  return URL.createObjectURL(new Blob([view.buffer], { type: 'audio/wav' }))
}

type Player = HTMLElement & { src: string }

async function player(tag: string): Promise<Player> {
  const element = await mount<Player>(tag, { name: 'Hoorzitting', src: silence() })
  element.style.width = '640px'
  const play = (): HTMLElement | null => inside(element, '.lintje-player__play')
  await expect.poll(() => play()?.getAttribute('aria-disabled'), { timeout: 5000 }).toBe(null)
  return element
}

/** A load that breaks, as the `<video>` or `<audio>` reports it. */
async function breakLoad(element: Player): Promise<HTMLElement> {
  element.shadowRoot!.querySelector('video, audio')!.dispatchEvent(new Event('error'))
  const retry = (): HTMLElement | null =>
    inside(element, '.lintje-video-player__retry') ??
    button(inside(element, '.lintje-audio-player__alert lintje-button'))
  await expect.poll(retry).toBeTruthy()
  // The audio player's button sits in the slot of an announcement, drawn a frame after it.
  await drawn(retry)
  return retry()!
}

const MEDIA_ROWS: Row[] = [
  {
    name: 'lintje-video-player :: the big play button, gone once it plays, hands its focus to the play button',
    run: async () => {
      const video = await player('lintje-video-player')
      inside(video, '.lintje-video-player__big-play')!.focus()
      await userEvent.keyboard('{Enter}')
      return () => inside(video, '.lintje-player__play')
    },
  },
  {
    name: 'lintje-video-player :: "Opnieuw proberen", gone with the failure, hands its focus to the play button',
    run: async () => {
      const video = await player('lintje-video-player')
      ;(await breakLoad(video)).focus()
      await userEvent.keyboard('{Enter}')
      return () => inside(video, '.lintje-video-player__big-play')
    },
  },
  {
    name: 'lintje-audio-player :: "Opnieuw proberen", gone with the failure, hands its focus to the play button',
    run: async () => {
      const audio = await player('lintje-audio-player')
      ;(await breakLoad(audio)).focus()
      await userEvent.keyboard('{Enter}')
      return () => inside(audio, '.lintje-player__play')
    },
  },
]

/* --- Redrawn in place: sortable list, table cells and panels, charts ------- */

const grip = (sortable: Element, id: string): HTMLElement | null =>
  sortable.shadowRoot!.querySelector<HTMLElement>(`.lintje-sortable-list__grip[data-id="${id}"]`)

/** A lifted row, by the keyboard. */
async function lifted(): Promise<HTMLElement> {
  const sortable = await mount<HTMLElement>('lintje-sortable-list', {
    label: 'Volgorde',
    items: [
      { id: 'a', label: 'Aanvragen' },
      { id: 'b', label: 'Besluiten' },
      { id: 'c', label: 'Bezwaren' },
    ],
  })
  grip(sortable, 'a')!.focus()
  await userEvent.keyboard(' ')
  return sortable
}

const EDITABLE: DataTableData = {
  caption: 'Loketten',
  rowKey: 'name',
  columns: [
    { key: 'name', header: 'Loket' },
    { key: 'requests', header: 'Aanvragen', editor: { kind: 'number' } },
  ],
  rows: [
    { name: 'Utrecht', requests: 12 },
    { name: 'Zwolle', requests: 8 },
  ],
}

/** The "Aanvragen" cell of a row; a cell's key is its row and column, apart by U+001F. */
const cell = (table: Element, id: string): HTMLElement | null =>
  [...table.shadowRoot!.querySelectorAll<HTMLElement>('.lintje-data-table__full [data-cell]')].find(
    (candidate) => candidate.dataset.cell === `${id}\u001frequests`,
  ) ?? null

/** The cell's field, opened from the keyboard. */
async function editing(id: string): Promise<TableElement> {
  const table = await mount<TableElement>('lintje-data-table', { data: EDITABLE })
  cell(table, id)!.focus()
  await userEvent.keyboard('{Enter}')
  await expect.poll(() => active()?.classList.contains('lintje-data-table__editor')).toBe(true)
  return table
}

/** The funnel's panel, opened from the keyboard, with the focus on one of its two buttons. */
async function filterPanel(which: 0 | 1): Promise<TableElement> {
  const table = await mount<TableElement>('lintje-data-table', {
    data: { ...FILTERED, filters: {} },
  })
  tablePart(table, '.lintje-data-table__funnel[data-column="name"]')!.focus()
  await userEvent.keyboard('{Enter}')
  const control = (): HTMLElement | null =>
    button(
      table.shadowRoot!.querySelectorAll('.lintje-data-table__filter-actions lintje-button')[which],
    )
  await drawn(control)
  control()!.focus()
  return table
}

type ChartElement = HTMLElement & { data: Record<string, unknown> }

const SLICES = [
  { label: 'Noord', value: 12, id: 'noord', href: '/p?r=noord' },
  { label: 'Zuid', value: 8, id: 'zuid', href: '/p?r=zuid' },
]

/** The chosen slice, focused; the host answers its clear with `answer`. */
async function chosenSlice(
  answer: (data: Record<string, unknown>) => Record<string, unknown>,
): Promise<ChartElement> {
  const data = {
    title: 'Aanvragen per regio',
    description: 'Noord 12, Zuid 8.',
    chart: { kind: 'pie', segments: SLICES },
    selectedId: 'noord',
    clearHref: '/p',
  }
  const tile = await mount<ChartElement>('lintje-chart', { data })
  tile.addEventListener('lintje-mark-select', (event) => {
    if ((event as CustomEvent<{ id: string | null }>).detail.id === null) tile.data = answer(data)
  })
  const mark = (): HTMLElement | null =>
    tile.shadowRoot!.querySelector<HTMLElement>('[data-mark-id="noord"]')
  await drawn(mark)
  mark()!.focus()
  await userEvent.keyboard('{Enter}')
  return tile
}

const POINTS = [
  { id: 'utr', label: 'Loket Utrecht', value: 12, lon: 5.12, lat: 52.09, href: '/m?loket=utr' },
  { id: 'zwo', label: 'Loket Zwolle', value: 8, lon: 6.09, lat: 52.51, href: '/m?loket=zwo' },
]

const REDRAWN_ROWS: Row[] = [
  {
    name: 'lintje-sortable-list :: a lifted row moved with the arrows keeps the focus on its grip',
    run: async () => {
      const sortable = await lifted()
      await userEvent.keyboard('{ArrowDown}')
      return () => grip(sortable, 'a')
    },
  },
  {
    name: 'lintje-sortable-list :: a lifted row put back with Escape keeps the focus on its grip',
    run: async () => {
      const sortable = await lifted()
      await userEvent.keyboard('{ArrowDown}{Escape}')
      return () => grip(sortable, 'a')
    },
  },
  {
    name: 'lintje-data-table :: a cell’s field, closed with Escape, hands its focus to the cell',
    run: async () => {
      const table = await editing('Zwolle')
      await userEvent.keyboard('{Escape}')
      return () => cell(table, 'Zwolle')
    },
  },
  {
    name: 'lintje-data-table :: a cell’s field, saved with Enter in the last row, hands its focus to the cell',
    run: async () => {
      const table = await editing('Zwolle')
      await userEvent.keyboard('9{Enter}')
      return () => cell(table, 'Zwolle')
    },
  },
  {
    name: 'lintje-data-table :: a column filter’s "Toepassen" hands its focus to the funnel',
    run: async () => {
      const table = await filterPanel(1)
      await userEvent.keyboard('{Enter}')
      return () => tablePart(table, '.lintje-data-table__funnel[data-column="name"]')
    },
  },
  {
    name: 'lintje-data-table :: a column filter’s "Wissen" hands its focus to the funnel',
    run: async () => {
      const table = await filterPanel(0)
      await userEvent.keyboard('{Enter}')
      return () => tablePart(table, '.lintje-data-table__funnel[data-column="name"]')
    },
  },
  {
    name: 'lintje-chart :: the chosen mark, cleared, keeps the focus on that mark',
    run: async () => {
      const tile = await chosenSlice((data) => ({ ...data, selectedId: null }))
      return () => tile.shadowRoot!.querySelector('[data-mark-id="noord"]')
    },
  },
  {
    name: 'lintje-chart :: the chosen mark, cleared and gone, hands its focus to the drawing',
    run: async () => {
      const tile = await chosenSlice((data) => ({
        ...data,
        selectedId: null,
        chart: {
          kind: 'pie',
          segments: [
            { label: 'Noord', value: 12 },
            { label: 'Zuid', value: 8 },
          ],
        },
      }))
      return () => tile.shadowRoot!.querySelector('.lintje-pie-chart__svg')
    },
  },
  {
    name: 'lintje-map :: the selection’s "Selectie opheffen" hands its focus to the chosen mark',
    run: async () => {
      const tile = await mount<HTMLElement & { data: unknown }>('lintje-map', {
        data: {
          variant: 'points',
          geo: 'netherlands',
          values: POINTS,
          unit: 'aanvragen',
          description: 'Loketten in Nederland.',
          selectedId: 'zwo',
        },
      })
      const close = (): HTMLElement | null =>
        tile.shadowRoot!.querySelector<HTMLElement>('.lintje-map-chart__selection-close')
      await drawn(close)
      // The marks come a frame after the panel: the map draws once its box is measured.
      await drawn(() => tile.shadowRoot!.querySelector('[data-mark-id="zwo"]'))
      close()!.focus()
      await userEvent.keyboard('{Enter}')
      return () => tile.shadowRoot!.querySelector('[data-mark-id="zwo"]')
    },
  },
]

/* --- Views: chat, filter zone, form ---------------------------------------- */

const TURN = { id: 't1', message: { text: 'Hoeveel aanvragen kwamen er binnen?', time: '10:12' } }

type Zone = HTMLElement & { open: boolean; modified: number }

/** A host as a page has it: it holds `open` and `modified`, and answers both events. */
async function zone(open: boolean, modified: number): Promise<Zone> {
  const element = document.createElement('lintje-filter-zone') as Zone
  Object.assign(element, { total: 3, modified, open, stick: 'fixed', sentence: [] })
  element.innerHTML = '<label>Regio <select><option>Alle</option></select></label>'
  element.addEventListener('lintje-zone-open-change', (event) => {
    element.open = (event as CustomEvent<boolean>).detail
  })
  element.addEventListener('lintje-filters-reset', () => (element.modified = 0))
  document.body.append(element)
  await (element as unknown as Updating).updateComplete
  return element
}

const zoneToggle = (element: Zone): HTMLElement | null => inside(element, '.lintje-filter-toggle')

/** Presses a control of the zone's row from the keyboard. */
async function pressInZone(element: Zone, selector: string): Promise<void> {
  const control = (): HTMLElement | null => inside(element, selector)
  await drawn(control)
  control()!.focus()
  await userEvent.keyboard('{Enter}')
}

const VIEW_ROWS: Row[] = [
  {
    name: 'lintje-chat :: "Vraag bewerken", gone when an answer starts, hands its focus to the question box',
    run: async () => {
      const chat = await mount<HTMLElement & { data: unknown }>('lintje-chat', {
        data: { turns: [TURN] },
      })
      const edit = (): HTMLElement | null =>
        button(inside(chat, 'lintje-chat-message', '.lintje-chat-message__edit'))
      await drawn(edit)
      edit()!.focus()
      chat.data = {
        turns: [{ ...TURN, answer: { state: 'streaming', status: 'Cijfers ophalen' } }],
      }
      return () => composerField(inside(chat, '.lintje-chat__composer'))
    },
  },
  {
    name: 'lintje-chat :: "Naar nieuwste", gone at the end, hands its focus to the question box',
    run: async () => {
      const box = document.createElement('div')
      box.style.cssText = 'height: 400px; overflow: auto'
      document.body.append(box)
      const chat = document.createElement('lintje-chat') as HTMLElement & { data: unknown }
      chat.data = {
        turns: Array.from({ length: 6 }, (_, index) => ({
          id: `t${index}`,
          message: { text: `Vraag ${index + 1}` },
          answer: { state: 'ready', text: 'Een lang antwoord. '.repeat(30) },
        })),
      }
      box.append(chat)
      await (chat as unknown as Updating).updateComplete
      await expect.poll(() => box.scrollTop).toBeGreaterThan(0)
      // A conversation that still grows keeps its reader at the end: scroll up once it stands.
      await document.fonts.ready
      for (let frame = 0; frame < 3; frame++) await new Promise(requestAnimationFrame)
      box.scrollTop = 0
      const latest = (): HTMLElement | null =>
        button(inside(chat, '.lintje-chat__latest lintje-button'))
      await drawn(latest)
      latest()!.focus()
      await userEvent.keyboard('{Enter}')
      return () => composerField(inside(chat, '.lintje-chat__composer'))
    },
  },
  {
    name: 'lintje-filter-zone :: "Filters tonen" hands its focus to "Filters verbergen"',
    run: async () => {
      const element = await zone(false, 0)
      await pressInZone(element, '.lintje-filter-toggle')
      await expect.poll(() => zoneToggle(element)?.getAttribute('aria-expanded')).toBe('true')
      return () => zoneToggle(element)
    },
  },
  {
    name: 'lintje-filter-zone :: the sentence, pressed, hands its focus to "Filters verbergen"',
    run: async () => {
      const element = await zone(false, 0)
      await pressInZone(element, '.lintje-summary-bar__sentence')
      await expect.poll(() => element.open).toBe(true)
      return () => zoneToggle(element)
    },
  },
  {
    name: 'lintje-filter-zone :: "Herstel standaard", gone with its count, hands its focus to the toggle',
    run: async () => {
      const element = await zone(true, 2)
      await pressInZone(element, '.lintje-filter-bar__reset')
      await expect.poll(() => element.modified).toBe(0)
      return () => zoneToggle(element)
    },
  },
  {
    name: 'lintje-filter-zone :: "herstel" in the closed bar, gone with its count, hands its focus to the toggle',
    run: async () => {
      const element = await zone(false, 2)
      await pressInZone(element, '.lintje-summary-bar__reset')
      await expect.poll(() => element.modified).toBe(0)
      return () => zoneToggle(element)
    },
  },
  {
    name: 'lintje-form :: a field, disabled while the form saves, gets its focus back after',
    run: async () => {
      const form = document.createElement('lintje-form') as HTMLElement & { busy: boolean }
      form.innerHTML = '<lintje-text-input name="naam" label="Naam"></lintje-text-input>'
      document.body.append(form)
      await (form as unknown as Updating).updateComplete
      const field = (): HTMLElement | null =>
        inside(form.querySelector('lintje-text-input'), 'input')
      await drawn(field)
      field()!.focus()
      form.busy = true
      await expect.poll(() => (field() as HTMLInputElement | null)?.disabled).toBe(true)
      form.busy = false
      return field
    },
  },
]

/* --- lintje-sub-nav -------------------------------------------------------- */

/** The phone's list, opened from its button, with the focus on `selector` in it. */
async function subNavOpenOn(selector: string): Promise<HTMLElement> {
  const element = await mount<HTMLElement>('lintje-sub-nav', {
    label: 'Instellingen',
    groups: [
      {
        label: 'Soorten gesprek',
        items: [
          { label: 'Vergadering', href: '#vergadering', active: true },
          { label: 'Hoorzitting', href: '#hoorzitting' },
        ],
      },
    ],
    action: { label: 'Nieuw soort gesprek', value: 'nieuw' },
  })
  // The host routes the page itself, so the browser does not leave it.
  element.addEventListener('lintje-navigate', (event) => event.preventDefault())
  await phone()
  await drawn(() => subNavToggle(element))
  subNavToggle(element)!.focus()
  await userEvent.keyboard('{Enter}')
  const control = (): HTMLElement | null => inside(element, selector)
  await drawn(control)
  control()!.focus()
  return element
}

const subNavToggle = (element: Element): HTMLElement | null =>
  inside(element, '.lintje-sub-nav__toggle')

const SUB_NAV_ROWS: Row[] = [
  {
    name: 'lintje-sub-nav :: a page chosen in the phone’s list closes it and hands its focus to its button',
    run: async () => {
      const element = await subNavOpenOn('a[href="#hoorzitting"]')
      await userEvent.keyboard('{Enter}')
      return () => subNavToggle(element)
    },
  },
  {
    name: 'lintje-sub-nav :: the action chosen in the phone’s list closes it and hands its focus to its button',
    run: async () => {
      const element = await subNavOpenOn('.lintje-sub-nav__link--action')
      await userEvent.keyboard('{Enter}')
      return () => subNavToggle(element)
    },
  },
  {
    name: 'lintje-sub-nav :: the phone’s list, closed with Escape, hands its focus to its button',
    run: async () => {
      const element = await subNavOpenOn('a[href="#hoorzitting"]')
      await userEvent.keyboard('{Escape}')
      return () => subNavToggle(element)
    },
  },
]

/* --- The shell ------------------------------------------------------------- */

const NAVIGATION = [
  { label: 'Overzicht', href: '#overzicht', active: true },
  { label: 'Archief', href: '#archief' },
]

async function shell(data: Record<string, unknown>): Promise<HTMLElement> {
  const element = await mount<HTMLElement>('lintje-shell', {
    data: { name: 'Aanvragen', navigation: NAVIGATION, ...data },
  })
  element.innerHTML = '<p>Inhoud</p>'
  return element
}

/** The side layout's rail, expanded around the keyboard focus on `selector`. */
async function railWithFocusOn(
  data: Record<string, unknown>,
  selector: string,
): Promise<HTMLElement> {
  const element = await shell({ layout: 'side', menu: 'unpinned', ...data })
  const first = (): HTMLElement | null => inside(element, '.lintje-nav__list a')
  await drawn(first)
  first()!.focus()
  const control = (): HTMLElement | null => inside(element, selector)
  await drawn(control)
  control()!.focus()
  return element
}

const shareButton = (element: Element): HTMLElement | null => {
  const found = [
    ...element.shadowRoot!.querySelectorAll<HTMLElement>('.lintje-share__button'),
  ].find((candidate) => candidate.getClientRects().length > 0)
  return button(found) ?? found ?? null
}

/** "Delen" opened from the keyboard. */
async function sharing(): Promise<HTMLElement> {
  const element = await shell({ share: true })
  await drawn(() => shareButton(element))
  shareButton(element)!.focus()
  await userEvent.keyboard('{Enter}')
  await drawn(() => inside(element, '.lintje-share__phone'))
  return element
}

const SHELL_ROWS: Row[] = [
  {
    name: 'lintje-shell :: the rail’s pin, gone on Escape, hands its focus to the logo before it',
    run: async () => {
      const element = await railWithFocusOn({ home: '/' }, '.lintje-nav__pin')
      await userEvent.keyboard('{Escape}')
      return () => inside(element, '.lintje-nav__home')
    },
  },
  {
    name: 'lintje-shell :: the rail’s pin, gone on Escape with no logo link, hands its focus to the first menu item',
    run: async () => {
      const element = await railWithFocusOn({}, '.lintje-nav__pin')
      await userEvent.keyboard('{Escape}')
      return () => inside(element, '.lintje-nav__list a')
    },
  },
  {
    name: 'lintje-shell :: the rail’s "Afmelden", gone on Escape, hands its focus to the menu item before it',
    run: async () => {
      const element = await railWithFocusOn(
        {
          user: { name: 'M. Jansen', initials: 'MJ' },
          logout: { href: '/afmelden', token: 'proef' },
        },
        '.lintje-nav__logout-button',
      )
      await userEvent.keyboard('{Escape}')
      return () => [...element.shadowRoot!.querySelectorAll('.lintje-nav__list a')].at(-1) ?? null
    },
  },
  {
    name: 'lintje-shell :: "Open op mijn telefoon" hands its focus to "Terug" by the QR code',
    run: async () => {
      const element = await sharing()
      inside(element, '.lintje-share__phone')!.focus()
      await userEvent.keyboard('{Enter}')
      return () => inside(element, '.lintje-share__back')
    },
  },
  {
    name: 'lintje-shell :: "Terug" by the QR code hands its focus to "Open op mijn telefoon"',
    run: async () => {
      const element = await sharing()
      inside(element, '.lintje-share__phone')!.focus()
      await userEvent.keyboard('{Enter}')
      await drawn(() => inside(element, '.lintje-share__back'))
      inside(element, '.lintje-share__back')!.focus()
      await userEvent.keyboard('{Enter}')
      return () => inside(element, '.lintje-share__phone')
    },
  },
  {
    name: 'lintje-shell :: a done item of "Delen" closes it and hands its focus to "Delen"',
    run: async () => {
      const element = await sharing()
      // Copying asks the system's clipboard, which a test page may not have.
      vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
      const copy = inside(element, '.lintje-share__item')!
      copy.focus()
      await userEvent.keyboard('{Enter}')
      return () => shareButton(element)
    },
  },
  {
    name: 'lintje-shell :: a page chosen in the phone’s menu closes it and hands its focus to the menu button',
    run: async () => {
      const element = await shell({})
      element.addEventListener('lintje-navigate', (event) => event.preventDefault())
      await phone()
      const menu = (): HTMLElement | null =>
        inside(element, '[aria-controls="lintje-mobile-menu-panel"]')
      await drawn(menu)
      menu()!.focus()
      await userEvent.keyboard('{Enter}')
      const item = (): HTMLElement | null =>
        inside(element, '.lintje-mobile-menu__item[href="#archief"]')
      await drawn(item)
      item()!.focus()
      await userEvent.keyboard('{Enter}')
      return menu
    },
  },
  {
    name: 'lintje-shell :: a submenu of the bar, closed with Escape, hands its focus to its entry',
    run: async () => {
      const element = await shell({
        navigation: [
          { label: 'Overzicht', href: '#overzicht', active: true },
          {
            label: 'Archief',
            links: [
              { label: 'Besluiten', href: '#besluiten' },
              { label: 'Bezwaren', href: '#bezwaren' },
            ],
          },
        ],
      })
      const entry = (): HTMLElement | null =>
        inside(element, '.lintje-navbar__entry--group:not(.lintje-navbar__entry--menu)')
      await drawn(entry)
      entry()!.focus()
      await userEvent.keyboard('{Enter}')
      const link = (): HTMLElement | null => inside(element, '.lintje-navbar__submenu a')
      await drawn(link)
      link()!.focus()
      await userEvent.keyboard('{Escape}')
      await expect.poll(() => inside(element, '.lintje-navbar__submenu')).toBeNull()
      return entry
    },
  },
]

/* --- The contract ---------------------------------------------------------- */

const ROWS: Row[] = [
  ...LIST_ROWS,
  ...DATA_TABLE_ROWS,
  ...PAGINATION_ROWS,
  ...FILE_UPLOAD_ROWS,
  ...TRANSCRIPT_ROWS,
  ...INPUT_ROWS,
  ...COLLECTION_ROWS,
  ...MESSAGE_ROWS,
  ...CONVERSATION_ROWS,
  ...MEDIA_ROWS,
  ...REDRAWN_ROWS,
  ...VIEW_ROWS,
  ...SUB_NAV_ROWS,
  ...SHELL_ROWS,
]

afterEach(async () => {
  // The viewport goes back while the element is still on the page.
  await page.viewport(1440, 900)
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

describe('the focus when its control goes', () => {
  it.each(ROWS.map((row) => [row.name, row] as const))('%s', async (name, row) => {
    ran++
    const known = KNOWN.find((entry) => entry.test(name))
    try {
      const want = await row.run()
      await expect
        .poll(() => {
          const target = want()
          return target !== null && active() === target
        })
        .toBe(true)
        .catch(() => {
          throw new Error(`the focus is on ${label(active())}, not on ${label(want())}`)
        })
      expect(active()).not.toBe(document.body)
    } catch (error) {
      if (!known) throw error
      seen.add(known)
    }
  })
})

describe('the known handoffs', () => {
  it('all still fail', ({ skip }) => {
    // A run of part of the table cannot say what is fixed.
    if (ran < ROWS.length) skip()
    const fixed = KNOWN.filter((entry) => !seen.has(entry)).map(String)
    expect(
      fixed,
      `fixed, so take out of KNOWN and docs/OPEN_ISSUES.md:\n${fixed.join('\n')}`,
    ).toHaveLength(0)
  })
})
