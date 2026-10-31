// The tables category (Tabellen en lijsten): the specimens of its elements.
import { linkLog, log } from '../shared.js'
import { desks, meta, regions } from '../../_data/load.js'

// The worksheet specimens of `lintje-data-table` play the host: each listens for the table's
// request, does the work on its own copy of the rows, and answers with new `data`. The rows are
// fictional.
const ROWS = [
  { id: 'm1', title: 'Onbeheerde tas, ontvangsthal', category: 'Veiligheid', severity: 'Midden', status: 'In behandeling', date: '03-10-2026' },
  { id: 'm2', title: 'Verloren toegangspas', category: 'Overig', severity: 'Laag', status: 'Concept', date: '03-10-2026' },
  { id: 'm3', title: 'Wachtrij bij de bezoekersbalie', category: 'Verkeer', severity: 'Hoog', status: 'Afgehandeld', date: '02-10-2026' },
  { id: 'm4', title: 'Storing lift 4', category: 'Overig', severity: 'Laag', status: 'In behandeling', date: '02-10-2026' },
  { id: 'm5', title: 'Geluid bij de taxistandplaats', category: 'Overlast', severity: 'Laag', status: 'Concept', date: '01-10-2026' },
  { id: 'm6', title: 'Drone boven parkeerterrein P3', category: 'Veiligheid', severity: 'Hoog', status: 'In behandeling', date: '01-10-2026' },
]

const rows = () => ROWS.map((row) => ({ ...row }))

const options = (values) => values.map((value) => ({ value }))

const EDIT_COLUMNS = [
  { key: 'title', header: 'Titel', editor: { kind: 'text' } },
  {
    key: 'category',
    header: 'Categorie',
    editor: { kind: 'select', options: options(['Veiligheid', 'Verkeer', 'Overlast', 'Overig']) },
  },
  { key: 'severity', header: 'Ernst', editor: { kind: 'select', options: options(['Laag', 'Midden', 'Hoog']) } },
  { key: 'date', header: 'Datum', editor: { kind: 'date' } },
]

const PLAIN_COLUMNS = [
  { key: 'title', header: 'Titel' },
  { key: 'status', header: 'Status' },
  { key: 'date', header: 'Datum' },
]

// The title opens the row (`openable`); the menu holds what else a row can do.
const ROW_ACTIONS = [
  { value: 'toewijzen', label: 'Toewijzen' },
  'separator',
  { value: 'verwijderen', label: 'Verwijderen', icon: 'functioneel-verwijderen', danger: true },
]

const BULK_ACTIONS = [
  { value: 'toewijzen', label: 'Toewijzen' },
  { value: 'exporteren', label: 'Exporteren' },
  { value: 'verwijderen', label: 'Verwijderen', danger: true },
]

function base(caption, extra) {
  return { caption, title: caption, rowKey: 'id', rows: rows(), pageSize: 25, ...extra }
}

function table(stage, data) {
  const element = stage.querySelector('lintje-data-table')
  element.data = data
  return element
}

/** A date the host accepts: dd-mm-jjjj that exists. */
function realDate(text) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(text)
  if (!match) return false
  const [, day, month, year] = match.map(Number)
  const date = new Date(year, month - 1, day)
  return date.getDate() === day && date.getMonth() === month - 1
}

/* --- The dashboard table ---------------------------------------------------- */
const tableData = {
  caption: 'Loketten met aanvragen, wachttijd, afwijzingen en gegevensstatus',
  title: 'Loketten',
  subtitle: 'Vandaag · klik op een rij voor het loket',
  mobileSubtitle: 'Vandaag · tik op een rij',
  columns: [
    { key: 'name', header: 'Loket' },
    { key: 'requests', header: 'Aanvragen', align: 'right' },
    {
      key: 'waitTime', header: 'Wachttijd (min)', align: 'right', mobileMeasure: true,
      threshold: { value: meta.thresholds.wait_time_threshold, caution: meta.thresholds.wait_time_caution },
    },
    { key: 'change', header: 'T.o.v. vorige week', align: 'right', format: 'change' },
    { key: 'rejections', header: 'Afwijzingen', align: 'right' },
    { key: 'dataStatus', header: 'Gegevens', format: 'status' },
  ],
  rows: desks.map((point) => ({
    id: point.id,
    name: point.name,
    requests: point.requests,
    waitTime: point.wait_time,
    change: point.change,
    rejections: point.rejections,
    dataStatus: point.data_status,
  })),
  rowKey: 'id',
  defaultSort: { key: 'waitTime', direction: 'desc' },
  mobileSublineTemplate: '{requests} aanvragen',
  clickable: true,
  pageSize: 10,
  expandable: true,
  download: { filename: 'loketten' },
}

/* --- Labels, totals, a row's detail and groups ------------------------------------ */

// The host computes every total; the table only draws them. Fictional figures.
const regionName = (id) => regions.find((region) => region.id === id)?.name ?? id
const sum = (list, key) => list.reduce((total, row) => total + (row[key] ?? 0), 0)
const mean = (list, key) => Math.round(sum(list, key) / list.length)

const KIND_LABELS = {
  counter: { label: 'Balie', tone: 'neutral' },
  service: { label: 'Servicepunt', tone: 'subtle' },
}
const STATUS_LABELS = {
  complete: { label: 'Compleet', tone: 'success', icon: 'functioneel-vinkje' },
  delayed: { label: 'Vertraagd', tone: 'warning', icon: 'functioneel-klok' },
}

const deskRows = desks.map((point) => ({
  id: point.id,
  name: point.name,
  region: regionName(point.region_id),
  kind: point.kind,
  requests: point.requests,
  waitTime: point.wait_time,
  change: point.change,
  staffing: point.staffing,
  positions: point.positions,
  dataStatus: point.data_status,
}))

const sheetColumns = [
  { key: 'name', header: 'Loket' },
  { key: 'region', header: 'Regio' },
  { key: 'kind', header: 'Soort', format: 'label', labels: KIND_LABELS },
  { key: 'requests', header: 'Aanvragen', align: 'right' },
  {
    key: 'waitTime', header: 'Wachttijd', align: 'right', unit: 'min', mobileMeasure: true,
    threshold: { value: meta.thresholds.wait_time_threshold, caution: meta.thresholds.wait_time_caution },
  },
  { key: 'change', header: 'Trend', align: 'right', format: 'change' },
  { key: 'dataStatus', header: 'Gegevens', format: 'label', labels: STATUS_LABELS },
]

const totalsOf = (list) => ({
  requests: sum(list, 'requests'),
  waitTime: { value: mean(list, 'waitTime'), how: 'gem.' },
})

const sheetData = {
  caption: 'Loketten met soort, aanvragen, wachttijd, trend en gegevensstatus, met totalen',
  title: 'Loketten',
  subtitle: 'Vandaag · de totalen rekent de bron uit',
  columns: sheetColumns,
  rows: deskRows,
  rowKey: 'id',
  defaultSort: { key: 'requests', direction: 'desc' },
  totals: totalsOf(deskRows),
  totalsLabel: 'Alle loketten',
  pageSize: 15,
  download: { filename: 'loketten-totaal' },
}

// The worksheet: every extension at once. The host filters, recounts the totals over what is left
// and keeps the checked rows; the table only asks.
const REGIONS = [...new Set(deskRows.map((row) => row.region))]

const worksheetColumns = [
  { key: 'name', header: 'Loket', filter: { kind: 'text' } },
  {
    key: 'region',
    header: 'Regio',
    filter: {
      kind: 'options',
      options: REGIONS.map((value) => ({
        value,
        count: deskRows.filter((row) => row.region === value).length,
      })),
    },
  },
  ...sheetColumns.slice(2, 6),
  {
    ...sheetColumns[6],
    filter: { kind: 'options', options: Object.entries(STATUS_LABELS).map(([value, { label }]) => ({ value, label })) },
  },
]

function deskFiltered(active) {
  return deskRows.filter((row) =>
    Object.entries(active).every(([key, value]) =>
      Array.isArray(value)
        ? value.includes(row[key])
        : String(row[key]).toLowerCase().includes(value.toLowerCase()),
    ),
  )
}

function worksheet(stage) {
  const start = { region: ['Regio Noordwest', 'Regio Zuidwest'] }
  const shown = deskFiltered(start)
  const element = table(stage, {
    ...sheetData,
    title: 'Loketten',
    subtitle: 'Vandaag · open een loket via zijn naam',
    caption: 'Loketten met regio, soort, aanvragen, wachttijd, trend en gegevensstatus',
    columns: worksheetColumns,
    rows: shown,
    totals: totalsOf(shown),
    totalRows: deskRows.length,
    filters: start,
    selectable: true,
    openable: true,
    checkedIds: [shown[0].id, shown[1].id],
    rowActions: [
      { value: 'toewijzen', label: 'Toewijzen' },
      'separator',
      { value: 'sluiten', label: 'Loket sluiten', danger: true },
    ],
    bulkActions: [
      { value: 'toewijzen', label: 'Toewijzen' },
      { value: 'exporteren', label: 'Exporteren' },
    ],
    columnChooser: true,
    hiddenColumns: ['change'],
    detailFields: [{ key: 'staffing', label: 'Bezetting', format: 'percent' }],
    pageSize: 5,
    expandable: true,
  })
  const say = log(stage)
  element.addEventListener('lintje-filter-change', (event) => {
    say(`lintje-filter-change ${JSON.stringify(event.detail)}`)
    const next = { ...element.data.filters }
    if (event.detail.value == null) delete next[event.detail.column]
    else next[event.detail.column] = event.detail.value
    const left = deskFiltered(next)
    element.data = { ...element.data, filters: next, rows: left, totals: totalsOf(left) }
  })
  element.addEventListener('lintje-columns-change', (event) => {
    say(`lintje-columns-change ${JSON.stringify(event.detail)}`)
    const { order, hidden } = event.detail
    const columns = order.map((key) => element.data.columns.find((column) => column.key === key))
    element.data = { ...element.data, columns, hiddenColumns: hidden }
  })
  element.addEventListener('lintje-checked-change', (event) => {
    element.data = { ...element.data, checkedIds: event.detail }
  })
  for (const name of ['lintje-row-open', 'lintje-row-action', 'lintje-bulk-action', 'lintje-sort-change']) {
    element.addEventListener(name, (event) => say(`${name} ${JSON.stringify(event.detail)}`))
  }
}

const groupTotals = Object.fromEntries(
  [...new Set(deskRows.map((row) => row.region))].map((region) => [
    region,
    totalsOf(deskRows.filter((row) => row.region === region)),
  ]),
)

/* --- Truncated and compact ---------------------------------------------------- */

// A note per desk, some longer than the column may grow; fictional.
const NOTES = [
  'Twee balies dicht wegens scholing van nieuwe medewerkers tot en met vrijdag',
  'Normale bezetting',
  'Wachtrij loopt op na de storing in het afsprakensysteem van vanochtend',
  'Normale bezetting',
  'Extra balie open voor aanvragen met spoed',
]

const compactData = {
  caption: 'Loketten met een toelichting en de trend tegenover vorige week',
  title: 'Loketten met toelichting',
  subtitle: 'De toelichting op één regel, de trend als pijltje met de cijfers in de tooltip',
  columns: [
    { key: 'name', header: 'Loket' },
    { key: 'note', header: 'Toelichting', truncate: true },
    { key: 'requests', header: 'Aanvragen', align: 'right', mobileMeasure: true },
    {
      key: 'change', header: 'Trend', align: 'right', format: 'change-compact',
      tooltip: '{change} tegenover vorige week · {previous} aanvragen toen',
    },
  ],
  rows: desks.slice(0, NOTES.length).map((point, index) => ({
    id: point.id,
    name: point.name,
    note: NOTES[index],
    requests: point.requests,
    change: point.change,
    // Carried for the trend's tooltip, not drawn: last week's figure.
    previous: Math.round(point.requests / (1 + point.change / 100)),
  })),
  rowKey: 'id',
  clickable: true,
  expandable: true,
  download: { filename: 'loketten-toelichting' },
}

function dashboard(stage, data = tableData) {
  const element = table(stage, data)
  const say = log(stage)
  for (const name of ['lintje-row-click', 'lintje-sort-change']) {
    element.addEventListener(name, (event) => say(`${name} ${JSON.stringify(event.detail)}`))
  }
  element.addEventListener('lintje-checked-change', (event) => {
    element.data = { ...element.data, checkedIds: event.detail }
  })
  element.addEventListener('lintje-columns-change', (event) => {
    say(`lintje-columns-change ${JSON.stringify(event.detail)}`)
    const { order, hidden } = event.detail
    const columns = order.map((key) => element.data.columns.find((column) => column.key === key))
    element.data = { ...element.data, columns, hiddenColumns: hidden }
  })
}

/* --- Editing --------------------------------------------------------------- */
function editable(stage) {
  const element = table(stage, base('Meldingen, bewerkbaar', { columns: EDIT_COLUMNS }))
  const say = log(stage)
  element.addEventListener('lintje-cell-edit', (event) => {
    const { id, column, value } = event.detail
    const cell = { id, column }
    const others = (list) => (list ?? []).filter((entry) => entry.id !== id || entry.column !== column)
    say(`lintje-cell-edit ${JSON.stringify(event.detail)}`)
    element.data = { ...element.data, busyCells: [...others(element.data.busyCells), cell], cellErrors: others(element.data.cellErrors) }
    setTimeout(() => {
      const data = element.data
      const busyCells = others(data.busyCells)
      if (column === 'date' && !realDate(value)) {
        element.data = { ...data, busyCells, cellErrors: [...others(data.cellErrors), { ...cell, message: 'Deze datum bestaat niet' }] }
        return
      }
      const next = data.rows.map((row) => (row.id === id ? { ...row, [column]: value } : row))
      element.data = { ...data, rows: next, busyCells }
    }, 900)
  })
}

/* --- Actions --------------------------------------------------------------- */
function actions(stage, extra = {}) {
  const element = table(
    stage,
    base('Meldingen, met acties', {
      columns: PLAIN_COLUMNS,
      selectable: true,
      openable: true,
      rowActions: ROW_ACTIONS,
      bulkActions: BULK_ACTIONS,
      ...extra,
    }),
  )
  const say = log(stage)
  element.addEventListener('lintje-checked-change', (event) => {
    element.data = { ...element.data, checkedIds: event.detail }
  })
  for (const name of ['lintje-row-open', 'lintje-row-action']) {
    element.addEventListener(name, (event) => say(`${name} ${JSON.stringify(event.detail)}`))
  }
  element.addEventListener('lintje-bulk-action', (event) => {
    say(`lintje-bulk-action ${JSON.stringify(event.detail)}`)
    if (event.detail.action !== 'verwijderen') return
    // The table does not confirm: the host does, with the count in the title.
    const dialog = document.createElement('lintje-dialog')
    const count = event.detail.ids.length
    dialog.alert = true
    dialog.heading = `${count} ${count === 1 ? 'melding' : 'meldingen'} verwijderen?`
    dialog.innerHTML = `De gekozen meldingen worden verwijderd. Dit kun je niet terugdraaien.
      <lintje-button slot="actions" variant="secondary" autofocus>Annuleren</lintje-button>
      <lintje-button slot="actions" variant="danger">Verwijderen</lintje-button>`
    dialog.open = true
    const close = () => dialog.remove()
    const [cancel, confirm] = dialog.querySelectorAll('lintje-button')
    dialog.addEventListener('lintje-close', close)
    cancel.addEventListener('click', close)
    confirm.addEventListener('click', () => {
      const gone = new Set(event.detail.ids)
      element.data = { ...element.data, rows: element.data.rows.filter((row) => !gone.has(row.id)), checkedIds: [] }
      close()
    })
    stage.append(dialog)
  })
}

/* --- Filters --------------------------------------------------------------- */
const FILTER_COLUMNS = [
  { key: 'title', header: 'Titel', filter: { kind: 'text' } },
  {
    key: 'category',
    header: 'Categorie',
    filter: {
      kind: 'options',
      options: ['Veiligheid', 'Verkeer', 'Overlast', 'Overig'].map((value) => ({
        value,
        count: ROWS.filter((row) => row.category === value).length,
      })),
    },
  },
  { key: 'severity', header: 'Ernst' },
  { key: 'date', header: 'Datum' },
]

/** The host's filtering: the table only shows what it gets. */
function filtered(active) {
  return rows().filter((row) =>
    Object.entries(active).every(([key, value]) =>
      Array.isArray(value)
        ? value.includes(row[key])
        : String(row[key]).toLowerCase().includes(value.toLowerCase()),
    ),
  )
}

function filters(stage, extra = {}) {
  const start = extra.filters ?? {}
  const element = table(
    stage,
    base('Meldingen, gefilterd', { columns: FILTER_COLUMNS, totalRows: ROWS.length, rows: filtered(start), ...extra }),
  )
  const say = log(stage)
  element.addEventListener('lintje-filter-change', (event) => {
    say(`lintje-filter-change ${JSON.stringify(event.detail)}`)
    const next = { ...element.data.filters }
    if (event.detail.value == null) delete next[event.detail.column]
    else next[event.detail.column] = event.detail.value
    element.data = { ...element.data, filters: next, rows: filtered(next) }
  })
  element.addEventListener('lintje-columns-change', (event) => {
    say(`lintje-columns-change ${JSON.stringify(event.detail)}`)
    const { order, hidden } = event.detail
    const columns = order.map((key) => element.data.columns.find((column) => column.key === key))
    element.data = { ...element.data, columns, hiddenColumns: hidden }
  })
}

const RECORDINGS = [
  {
    id: 'r1',
    title: 'Teamoverleg 2 oktober',
    sub: '47:12 · 3 sprekers',
    meta: 'vandaag',
    href: '#el-list',
    actions: [
      { value: 'hernoemen', label: 'Hernoemen', icon: 'functioneel-bewerken' },
      { value: 'downloaden', label: 'Downloaden', icon: 'functioneel-downloaden' },
      'separator',
      { value: 'verwijderen', label: 'Verwijderen', icon: 'functioneel-verwijderen', danger: true },
    ],
  },
  {
    id: 'r2',
    title: 'Briefing ochtenddienst',
    sub: '18:40 · 2 sprekers',
    meta: 'vandaag',
    href: '#el-list',
    actions: [{ value: 'hernoemen', label: 'Hernoemen', icon: 'functioneel-bewerken' }],
  },
  {
    id: 'r3',
    title: 'Overdracht nachtdienst',
    sub: '09:55 · 2 sprekers',
    meta: 'gisteren',
    href: '#el-list',
    actions: [{ value: 'hernoemen', label: 'Hernoemen', icon: 'functioneel-bewerken' }],
  },
]

const UNITS = [
  {
    id: 'dh',
    label: 'Den Haag',
    children: [
      {
        id: 'verdiepingen',
        label: 'Verdiepingen',
        children: [
          { id: 'v1', label: 'Verdieping 1' },
          { id: 'v2', label: 'Verdieping 2' },
          { id: 'v3', label: 'Verdieping 3' },
        ],
      },
      { id: 'zalen', label: 'Zalen', count: 4 },
    ],
  },
  {
    id: 'ut',
    label: 'Utrecht',
    children: [
      { id: 'ut-v', label: 'Verdiepingen' },
      { id: 'ut-z', label: 'Zalen' },
    ],
  },
]

/** The children Zalen gets once the "server" answered. */
const ROOMS = [
  { id: 'z1', label: 'Vergaderzaal 1' },
  { id: 'z2', label: 'Vergaderzaal 2' },
  { id: 'z3', label: 'Vergaderzaal 3' },
  { id: 'z4', label: 'Vergaderzaal 4' },
]

/** Answers a fold of Zalen the way a host that loads on demand would. */
function lazyArrivals(tree) {
  tree.addEventListener('lintje-node-toggle', (event) => {
    if (event.detail.id !== 'zalen' || !event.detail.open) return
    const node = tree.nodes[0].children[1]
    if (node.children) return
    node.loading = true
    tree.nodes = [...tree.nodes]
    setTimeout(() => {
      node.loading = false
      node.children = ROOMS
      tree.nodes = [...tree.nodes]
    }, 1200)
  })
}

const COLUMNS = [
  { id: 'titel', label: 'Titel', checked: true },
  { id: 'categorie', label: 'Categorie', checked: true },
  { id: 'ernst', label: 'Ernst', checked: true },
  { id: 'datum', label: 'Datum', checked: false },
]

const DETAILS = [
  { label: 'Categorie', value: 'Veiligheid' },
  { label: 'Datum', value: '3 oktober 2026, 14:35' },
  { label: 'Locatie', value: 'Verdieping 2', action: { href: '#el-description-list' } },
  { label: 'Bijlagen', value: 2 },
  { label: 'Toelichting', value: null },
]

/* --- People ----------------------------------------------------------------- */

// Fictional colleagues; the photo is the gallery's grey stand-in, never a face.
const PEOPLE = {
  jv: { name: 'J. de Vries', initials: 'JV', role: 'Senior behandelaar' },
  ab: { name: 'A. Bakker', initials: 'AB', role: 'Behandelaar' },
  sy: { name: 'S. Yılmaz', initials: 'SY', role: 'Jurist', photo: 'media/afbeelding.svg' },
  mj: { name: 'M. Jansen', initials: 'MJ', role: 'Teamleider' },
  rv: { name: 'R. Visser', initials: 'RV', role: 'Adviseur' },
  ld: { name: 'L. de Boer', role: 'Extern adviseur' },
}
const READERS = ['ab', 'sy', 'mj', 'rv', 'ld', 'jv'].map((id) => PEOPLE[id])

const REQUESTS = [
  { id: 'a1', name: 'Omgevingsvergunning Dorpsstraat 4', kind: 'Bouwen', handler: 'jv', days: 12 },
  { id: 'a2', name: 'Kapvergunning Parklaan', kind: 'Kappen', handler: null, days: 3 },
  { id: 'a3', name: 'Evenement Koningsdag', kind: 'Evenement', handler: 'ab', days: 28 },
  { id: 'a4', name: 'Uitrit Molenweg 17', kind: 'Uitrit', handler: 'sy', days: 6 },
  { id: 'a5', name: 'Terras Marktplein', kind: 'Terras', handler: 'ab', days: 9 },
]

const handlerColumn = {
  key: 'handler',
  header: 'Behandelaar',
  format: 'person',
  people: PEOPLE,
  filter: { kind: 'options', options: ['jv', 'ab', 'sy'].map((value) => ({ value })) },
}

const requestsData = {
  caption: 'Aanvragen met soort, behandelaar en dagen in behandeling',
  title: 'Aanvragen',
  subtitle: 'Gesorteerd op behandelaar',
  columns: [
    { key: 'name', header: 'Aanvraag' },
    { key: 'kind', header: 'Soort' },
    handlerColumn,
    { key: 'days', header: 'Dagen', align: 'right', mobileMeasure: true },
  ],
  rows: REQUESTS,
  rowKey: 'id',
  sort: { key: 'handler', direction: 'asc' },
  clickable: true,
  expandable: true,
}

/** The worksheet of requests: a chosen handler stands once the host sets it. */
function assigning(stage) {
  const element = table(stage, {
    ...requestsData,
    title: 'Aanvragen toewijzen',
    subtitle: 'Kies een behandelaar in de cel',
    clickable: false,
    columns: requestsData.columns.map((column) =>
      column.key === 'handler' ? { ...column, filter: undefined, editor: { kind: 'select' } } : column,
    ),
    rows: REQUESTS.map((row) => ({ ...row })),
  })
  const say = log(stage)
  element.addEventListener('lintje-cell-edit', (event) => {
    const { id, column, value } = event.detail
    say(`lintje-cell-edit ${JSON.stringify(event.detail)}`)
    const rows = element.data.rows.map((row) => (row.id === id ? { ...row, [column]: value } : row))
    element.data = { ...element.data, rows }
  })
}

/** What happened to an application, the newest first: who did what, a person with a circle. */
const HISTORY = [
  { who: { ...PEOPLE.jv, role: undefined, href: '#el-timeline' }, title: 'wees de aanvraag toe aan A. Bakker', when: 'vandaag om 10:42', at: '2026-10-04T10:42:00+02:00' },
  { who: 'Systeem', title: 'stuurde de ontvangstbevestiging', when: 'vandaag om 09:31', at: '2026-10-04T09:31:00+02:00' },
  { who: PEOPLE.sy, title: 'voegde een advies toe', when: 'gisteren om 16:05', at: '2026-10-03T16:05:00+02:00' },
  { who: PEOPLE.ld, title: 'maakte de aanvraag aan', when: 'gisteren om 15:48', at: '2026-10-03T15:48:00+02:00' },
]

/** A report over three weeks, the days on the rail and only the time beside each moment. */
const LONG_HISTORY = [
  { group: 'Vandaag', when: '10:42', at: '2026-10-04T10:42:00+02:00', who: PEOPLE.ab, title: 'sloot de melding' },
  { group: 'Vandaag', when: '09:31', at: '2026-10-04T09:31:00+02:00', who: 'Systeem', title: 'stuurde de bevestiging aan de melder' },
  { group: 'Gisteren', when: '16:05', at: '2026-10-03T16:05:00+02:00', who: PEOPLE.sy, title: 'voegde een advies toe' },
  ...Array.from({ length: 13 }, (_, index) => ({
    group: `${30 - Math.floor(index / 2) * 2} september`,
    when: index % 2 ? '11:20' : '15:48',
    at: `2026-09-${String(30 - Math.floor(index / 2) * 2).padStart(2, '0')}T${index % 2 ? '11:20' : '15:48'}:00+02:00`,
    who: index % 2 ? 'Systeem' : PEOPLE.ab,
    title: index % 2 ? 'stuurde een herinnering' : 'vroeg om een aanvulling',
  })),
]

/** How a renovation went, one moment every two years, the latest with a link. */
const TIMELINE_PROJECT = [
  { when: '2019', at: '2019', title: 'Verkenning', text: 'We onderzochten of het gebouw nog dertig jaar mee kan.' },
  { when: '2021', at: '2021', title: 'Besluit', text: 'De minister koos voor verbouwen in plaats van nieuwbouw.', link: { label: 'Lees het besluit', href: '#el-timeline' } },
  { when: '2023', at: '2023', title: 'Start van de verbouwing', text: 'De medewerkers verhuisden tijdelijk naar een ander pand.' },
  { when: '2025', at: '2025', title: 'Oplevering', text: 'Het gebouw ging weer open, met de helft minder energieverbruik.' },
]

/** An application: what the applicant did on one side, the organisation on the other. */
const TIMELINE_APPLICATION = [
  { when: '3 augustus 2026', at: '2026-08-03', title: 'Aanvraag ingediend', text: 'U ontving een ontvangstbevestiging per e-mail.', side: 'start' },
  { when: '20 augustus 2026', at: '2026-08-20', title: 'Aanvulling gevraagd', text: 'We vroegen om de begroting van het project.', side: 'end' },
  { when: '9 september 2026', at: '2026-09-09', title: 'Aanvulling gestuurd', text: 'Uw aanvraag is compleet en wordt beoordeeld.', side: 'start' },
  { when: 'Verwacht vóór 1 december 2026', title: 'Besluit', text: 'U krijgt het besluit per post en in Mijn omgeving.', planned: true, side: 'end' },
  { when: 'Nog niet bekend', title: 'Uitbetaling', text: 'Zes weken na een positief besluit.', planned: true, side: 'end' },
]

/** The same kind of application over most of a year, spread enough to lie along a rail. */
const TIMELINE_YEAR = [
  { when: '3 februari 2026', at: '2026-02-03', title: 'Aanvraag ingediend', text: 'U ontving een ontvangstbevestiging.', side: 'start' },
  { when: '2 april 2026', at: '2026-04-02', title: 'Aanvulling gevraagd', text: 'We vroegen om de begroting.', side: 'end' },
  { when: '28 mei 2026', at: '2026-05-28', title: 'Aanvulling gestuurd', side: 'start' },
  { when: '31 juli 2026', at: '2026-07-31', title: 'Besluit', text: 'De subsidie is toegekend.', side: 'end' },
  { when: 'Verwacht 1 december 2026', at: '2026-12-01', title: 'Uitbetaling', planned: true, side: 'end' },
]

/** One morning of an outage, by the minute. */
const TIMELINE_OUTAGE = [
  { when: '08:12', at: '2026-10-21T08:12', title: 'Storing gemeld', text: 'Inloggen lukt niet voor een deel van de gebruikers.' },
  { when: '08:30', at: '2026-10-21T08:30', title: 'Oorzaak gevonden', text: 'Een verlopen certificaat.' },
  { when: '09:05', at: '2026-10-21T09:05', title: 'Herstel gestart' },
  { when: '10:40', at: '2026-10-21T10:40', title: 'Opgelost', text: 'Iedereen kan weer inloggen.' },
]

/** The same outage with who acted above each title, and a badge in the slot of two moments. */
const TIMELINE_OUTAGE_LABELLED = [
  { when: '08:12', at: '2026-10-21T08:12', label: 'Systeem', title: 'Storing gemeld', text: 'Inloggen lukt niet voor een deel van de gebruikers.', value: 'ernst' },
  { when: '08:30', at: '2026-10-21T08:30', label: 'Storingsdienst', title: 'Oorzaak gevonden', text: 'Een verlopen certificaat.', link: { label: 'Bekijk het incident', href: '#el-timeline' } },
  { when: '09:05', at: '2026-10-21T09:05', label: 'Storingsdienst', title: 'Herstel gestart' },
  { when: '10:40', at: '2026-10-21T10:40', label: 'Storingsdienst', title: 'Opgelost', text: 'Iedereen kan weer inloggen.', value: 'opgelost' },
]

/** A bill from its first exploration to the day it applies: years on the rail, one still to come. */
const TIMELINE_BILL = [
  { when: '11 maart', at: '2024-03-11', group: '2024', title: 'Verkenning gestart', text: 'Het ministerie vroeg uitvoerders wat er aan de oude regeling schortte.' },
  { when: '8 juli', at: '2024-07-08', group: '2024', title: 'Rondetafelgesprekken' },
  { when: '30 september', at: '2024-09-30', group: '2024', title: 'Eerste versie van het voorstel' },
  { when: '2 december', at: '2024-12-02', group: '2024', title: 'Uitvoeringstoetsen aangevraagd' },
  { when: '14 januari', at: '2025-01-14', group: '2025', title: 'Internetconsultatie geopend', text: 'Iedereen kon tot 1 maart reageren op het voorstel.' },
  { when: '2 april', at: '2025-04-02', group: '2025', title: 'Reacties verwerkt', text: 'De belangrijkste reacties staan in de toelichting bij het voorstel.', link: { label: 'Lees de toelichting', href: '#el-timeline' } },
  { when: '23 september', at: '2025-09-23', group: '2025', title: 'Advies van de Raad van State' },
  { when: '10 februari', at: '2026-02-10', group: '2026', title: 'Aangenomen door de Tweede Kamer' },
  { when: '16 juni', at: '2026-06-16', group: '2026', title: 'Aangenomen door de Eerste Kamer', text: 'Het voorstel is nu wet en wacht op publicatie.' },
  { when: 'Verwacht 1 januari', group: '2027', title: 'Inwerkingtreding', text: 'De regeling geldt voor aanvragen vanaf die dag.', planned: true },
]

/** Products of a catalogue: every kind of card, with fictional owners and grey stand-in pictures. */
const PRODUCTS = [
  {
    id: 'vertalen',
    title: 'Vertalen',
    href: '#el-card',
    meta: ['AI-dienst', 'Team AI-diensten'],
    description: 'Vertaalt teksten en documenten tussen het Nederlands en andere talen, met behoud van opmaak.',
    media: { src: 'media/afbeelding.svg', alt: '' },
    status: { label: 'Je hebt toegang', tone: 'success' },
    actions: [
      { label: 'Openen', href: '#el-card', variant: 'primary', external: true },
      { label: 'Details', href: '#el-card', variant: 'link' },
    ],
  },
  {
    id: 'dashboard',
    title: 'Dashboard Vergunningen',
    href: '#el-card',
    meta: ['Dashboard', 'Dienst Vergunningen'],
    description: 'Aanvragen, wachttijden en afwijzingen bij de loketten, per regio en loket.',
    media: { src: 'media/logo.svg', alt: '', kind: 'logo' },
    status: { label: 'Geen toegang', icon: 'gebruiksvoorwerpen-hangslot-dicht' },
    actions: [
      { label: 'Toegang aanvragen', href: '#el-card' },
      { label: 'Details', href: '#el-card', variant: 'link' },
    ],
  },
  {
    id: 'locaties',
    title: 'Locaties en gebouwen',
    href: '#el-card',
    meta: ['Dataproduct', 'Team Vastgoed'],
    description: 'Adressen, functies en gebruik van locaties en gebouwen.',
    facts: [
      { label: 'Verversing', value: 'Dagelijks' },
      { label: 'Rijen', value: '48.210' },
      { label: 'Laatst bijgewerkt', value: null },
    ],
    status: { label: 'Tijdelijk niet beschikbaar', tone: 'error' },
  },
]

/** A case as a card: who handles it and who reads along. */
const CASE = {
  id: 'zaak-2026-118',
  title: 'Omgevingsvergunning Dorpsstraat 4',
  href: '#el-card',
  meta: ['Zaak 2026-118', 'Bouwen'],
  description: 'Verbouwing van een woning met een dakkapel aan de voorkant.',
  facts: [
    { label: 'Behandelaar', person: PEOPLE.jv },
    { label: 'Meelezers', people: READERS },
    { label: 'Termijn', value: '8 weken' },
  ],
  status: { label: 'In behandeling', tone: 'busy' },
}

/** The kinds of a catalogue as link cards: the whole card is the way in. */
const KINDS = [
  { id: 'data', title: 'Dataproducten', href: '#el-card-list', meta: ['5 producten'], description: 'Gegevens om zelf mee te analyseren, met afspraken over het gebruik.' },
  { id: 'ai', title: 'AI-diensten', href: '#el-card-list', meta: ['4 producten'], description: 'Diensten die tekst, spraak en documenten voor je verwerken.' },
  { id: 'dash', title: 'Dashboards', href: '#el-card-list', meta: ['3 producten'], description: 'Stuurinformatie per organisatie.' },
]

/** A card that reports its link and its actions instead of leaving the page. */
function listen(stage) {
  const write = log(stage)
  stage.addEventListener('lintje-navigate', (event) => {
    event.preventDefault()
    write(`lintje-navigate ${JSON.stringify(event.detail)}`)
  })
  stage.addEventListener('lintje-card-action', (event) => write(`lintje-card-action ${JSON.stringify(event.detail)}`))
}

/** Reports a card's events and plays the host for its switches: it keeps the new `pressed`
    and hands it back. */
function hostIconActions(stage) {
  listen(stage)
  stage.addEventListener('lintje-card-action', (event) => {
    const { id, value, pressed } = event.detail
    if (pressed === undefined) return
    const card = [...stage.querySelectorAll('lintje-card')].find((item) => item.data.id === id)
    card.data = {
      ...card.data,
      iconActions: card.data.iconActions.map((action) => (action.value === value ? { ...action, pressed } : action)),
    }
  })
}

/** A pagination that follows its own choice, as a host would confirm it. */
function follow(stage) {
  for (const pager of stage.querySelectorAll('lintje-pagination')) {
    pager.addEventListener('lintje-page-change', (event) => (pager.page = event.detail.page))
    pager.addEventListener('lintje-page-size-change', (event) => {
      pager.pageSize = event.detail.pageSize
      pager.page = event.detail.page
    })
  }
}

export default {
  elements: [
{
      tag: 'lintje-data-table',
      wide: true,
      title: 'De tabel: dashboardtabel, kiesbaar, laden en fout, en als werkblad met bewerken, acties, filters, labels, totalen, open rijen en groepen, ook op een applicatiepagina',
      specimens: [
        {
          label: 'Werkblad',
          note:
            'Alles staat tegelijk aan: filters, kolommen kiezen, selectie, labels, drempels, ' +
            'een open rij en totalen.',
          html: '<lintje-data-table></lintje-data-table>',
          setup: worksheet,
        },
        {
          label: 'Dashboard',
          note: 'De tabel heeft drempels, een statuskolom en rijen die je aanklikt.',
          html: '<lintje-data-table></lintje-data-table>',
          setup: (stage) => dashboard(stage),
        },
        {
          label: 'Afgekapt en compact',
          note: 'Een lange toelichting blijft op één regel, en de trend is alleen een pijltje.',
          html: '<lintje-data-table></lintje-data-table>',
          setup: (stage) => dashboard(stage, compactData),
        },
        {
          label: 'Behandelaar',
          note:
            'Een kolom met `format: \'person\'` toont de persoon uit `people`, gesorteerd op ' +
            'de naam; een lege cel is "Niet toegewezen". De naam is geen link: de rij opent.',
          html: '<lintje-data-table></lintje-data-table>',
          setup: (stage) => dashboard(stage, requestsData),
        },
        {
          label: 'Behandelaar kiezen',
          note: 'In het werkblad biedt de keuzelijst "Niet toegewezen" en de personen.',
          html: '<lintje-data-table></lintje-data-table>',
          setup: assigning,
        },
        {
          label: 'Compact zonder rijactie',
          note: 'Tab bereikt elke rij om de trend met zijn uitleg te lezen; Enter opent niets.',
          html: '<lintje-data-table></lintje-data-table>',
          setup: (stage) => table(stage, {
            ...compactData,
            title: 'Loketten met een leesbare trend',
            clickable: false,
            expandable: false,
          }),
        },
        {
          label: 'Kiesbaar',
          note: 'Vink loketten aan om ze te vergelijken.',
          html: '<lintje-data-table></lintje-data-table>',
          setup: (stage) =>
            dashboard(stage, {
              ...tableData,
              title: 'Loketten vergelijken',
              subtitle: 'Vink loketten aan om ze te vergelijken',
              clickable: false,
              selectable: true,
              checkedIds: [],
              pageSize: 5,
            }),
        },
        {
          label: 'Rijen met een link',
          note: 'Elke rij heeft een `href`. Een klik of Enter gaat erheen als de host het event niet annuleert; Cmd- of Ctrl-klik opent een nieuw tabblad.',
          html: '<lintje-data-table></lintje-data-table>',
          setup: (stage) => {
            const element = table(stage, {
              ...tableData,
              title: 'Loketten',
              subtitle: 'Elke rij met een link',
              rows: tableData.rows.slice(0, 4).map((row) => ({ ...row, href: `?loket=${row.id}` })),
              pageSize: undefined,
              expandable: false,
            })
            linkLog(stage, element, ['lintje-row-click'])
          },
        },
        {
          label: 'Gekozen en aangevinkt',
          note:
            'Eén rij is gekozen en heeft de balk, twee zijn aangevinkt en hebben alleen het vlak.',
          html: '<lintje-data-table></lintje-data-table>',
          setup: (stage) =>
            dashboard(stage, {
              ...tableData,
              title: 'Loketten',
              subtitle: 'Een gekozen rij en twee aangevinkte',
              selectable: true,
              rows: tableData.rows.slice(0, 4),
              selectedId: tableData.rows[0].id,
              checkedIds: [tableData.rows[1].id, tableData.rows[2].id],
            }),
        },
        {
          label: 'Laden',
          html: '<lintje-data-table></lintje-data-table>',
          setup: (stage) => table(stage, { ...tableData, title: 'Loketten', subtitle: 'Laden', state: 'loading', rows: [] }),
        },
        {
          label: 'Fout',
          html: '<lintje-data-table></lintje-data-table>',
          setup: (stage) =>
            table(stage, {
              ...tableData,
              title: 'Loketten',
              subtitle: 'Fout',
              state: 'error',
              message: 'De bron reageerde niet. De cijfers van vandaag ontbreken.',
              lastKnown: 'Laatst bekend: 11 min, gemeten om 07:45.',
              rows: [],
            }),
        },
        {
          label: 'Bewerkbare cellen',
          note: 'Enter, F2 of dubbelklik opent een cel om te wijzigen.',
          html: '<lintje-data-table></lintje-data-table>',
          setup: editable,
        },
        {
          label: 'Cel wordt opgeslagen',
          html: '<lintje-data-table></lintje-data-table>',
          setup: (stage) =>
            table(
              stage,
              base('Meldingen, bewerkbaar', {
                columns: EDIT_COLUMNS,
                rows: rows().slice(0, 3),
                busyCells: [{ id: 'm3', column: 'category' }],
              }),
            ),
        },
        {
          label: 'Cel geweigerd',
          note: 'De server weigert de waarde, en de cel zegt waarom.',
          html: '<lintje-data-table></lintje-data-table>',
          setup: (stage) =>
            table(
              stage,
              base('Meldingen, bewerkbaar', {
                columns: EDIT_COLUMNS,
                rows: rows().slice(0, 4),
                cellErrors: [{ id: 'm4', column: 'date', message: 'Deze datum bestaat niet', value: '32-10-2026' }],
              }),
            ),
        },
        {
          label: 'Acties per rij',
          note: 'De titel opent de rij.',
          html: '<lintje-data-table></lintje-data-table>',
          setup: (stage) => actions(stage),
        },
        {
          label: 'Op een telefoon',
          note: 'De andere kolommen van een rij staan open, met het rijmenu en Sorteren.',
          html: '<lintje-data-table></lintje-data-table>',
          setup: (stage) => {
            actions(stage, { selectable: false })
            const element = stage.querySelector('lintje-data-table')
            void element.updateComplete.then(() =>
              element.shadowRoot.querySelector('.lintje-data-table__mobile-toggle')?.click(),
            )
          },
        },
        {
          label: 'Op een applicatiepagina',
          note:
            'Het attribuut `plain` laat de tegel weg. De kop of tab van de pagina noemt de tabel.',
          html: '<lintje-data-table plain></lintje-data-table>',
          setup: (stage) => actions(stage, { title: undefined }),
        },
        {
          label: 'Selectiebalk',
          note: 'Twee rijen zijn gekozen. Shift+klik kiest een reeks.',
          html: '<lintje-data-table></lintje-data-table>',
          setup: (stage) => actions(stage, { checkedIds: ['m1', 'm3'] }),
        },
        {
          label: 'Uitgeschakelde rij',
          note: 'De derde rij kun je niet kiezen.',
          html: '<lintje-data-table></lintje-data-table>',
          setup: (stage) => actions(stage, { rows: rows().slice(0, 3), uncheckableIds: ['m3'], checkedIds: ['m1'] }),
        },
        {
          label: 'Kolomfilters',
          html: '<lintje-data-table></lintje-data-table>',
          setup: (stage) => filters(stage),
        },
        {
          label: 'Gefilterd',
          note: 'De gekozen filters staan erbij als chips.',
          html: '<lintje-data-table></lintje-data-table>',
          setup: (stage) => filters(stage, { filters: { category: ['Veiligheid', 'Overlast'] } }),
        },
        {
          label: 'Een lange filterchip',
          note: 'Een chip die niet op de regel past, loopt door en blijft binnen de tabel.',
          html: '<lintje-data-table></lintje-data-table>',
          setup: (stage) =>
            filters(stage, {
              filters: {
                title: 'wachtrij bij de bezoekersbalie',
                category: ['Veiligheid', 'Verkeer', 'Overlast', 'Overig'],
              },
            }),
        },
        {
          label: 'Kolommen kiezen',
          note:
            'Het icoon in de kop van de laatste kolom kiest de kolommen. Een verborgen kolom ' +
            'staat onder de rij.',
          html: '<lintje-data-table></lintje-data-table>',
          setup: (stage) => filters(stage, { columnChooser: true, hiddenColumns: ['severity'] }),
        },
        {
          label: 'Labels en totalen',
          note: 'Een waarde staat als badge in de cel. De totaalrij komt van de host.',
          html: '<lintje-data-table></lintje-data-table>',
          setup: (stage) => dashboard(stage, { ...sheetData, columnChooser: true }),
        },
        {
          label: 'Een rij open',
          note: 'Onder de rij staan de verborgen kolommen en de extra velden.',
          html: '<lintje-data-table></lintje-data-table>',
          setup: (stage) => {
            dashboard(stage, {
              ...sheetData,
              title: 'Loketten, met details',
              subtitle: 'Open een rij voor de bezetting',
              columnChooser: true,
              hiddenColumns: ['change'],
              detailFields: [
                { key: 'positions', label: 'Loketplaatsen' },
                { key: 'staffing', label: 'Bezetting', format: 'percent' },
              ],
              totals: undefined,
              pageSize: 5,
            })
            const element = stage.querySelector('lintje-data-table')
            void element.updateComplete.then(() =>
              element.shadowRoot.querySelector('.lintje-data-table__detail-toggle')?.click(),
            )
          },
        },
        {
          label: 'Groepen',
          note: 'De rijen staan per regio, met subtotalen. De eerste groep is ingeklapt.',
          html: '<lintje-data-table></lintje-data-table>',
          setup: (stage) => {
            dashboard(stage, {
              ...sheetData,
              title: 'Loketten per regio',
              subtitle: 'Gesorteerd binnen elke regio',
              columnChooser: true,
              groupBy: 'region',
              groupTotals,
              groupsPerPage: 3,
            })
            const element = stage.querySelector('lintje-data-table')
            void element.updateComplete.then(() =>
              element.shadowRoot.querySelector('.lintje-data-table__full .lintje-data-table__group-toggle')?.click(),
            )
          },
        },
        {
          label: 'Groepen kiezen',
          note: 'Elke groepskop heeft een vinkje voor haar rijen. De eerste regio is gekozen, de tweede half.',
          html: '<lintje-data-table></lintje-data-table>',
          setup: (stage) => {
            const [first, second] = REGIONS.map((region) => deskRows.filter((row) => row.region === region))
            dashboard(stage, {
              ...sheetData,
              title: 'Loketten per regio',
              subtitle: 'Kies een regio in haar kop',
              groupBy: 'region',
              groupTotals,
              groupsPerPage: 3,
              selectable: true,
              checkedIds: [...first.map((row) => row.id), second[0].id],
            })
          },
        },
      ],
    },
{
      tag: 'lintje-pagination',
      title: 'Bladeren door pagina’s — ook onder de tabel',
      specimens: [
        {
          label: 'Met de telling',
          html: '<lintje-pagination page="2" page-count="7" total="131" page-size="20"></lintje-pagination>',
          setup: follow,
        },
        {
          label: 'Met eenheid en keuze per pagina',
          html: '<lintje-pagination page="2" total="14" page-size="5" page-sizes="5, 10, 20" unit="documenten" unit-one="document"></lintje-pagination>',
          setup: follow,
        },
        {
          label: 'Alles op één pagina',
          html: '<lintje-pagination page="1" total="14" page-size="20" page-sizes="5, 10, 20" unit="documenten" unit-one="document"></lintje-pagination>',
          setup: follow,
        },
        {
          label: 'Op de eerste pagina',
          note: 'De knop naar de vorige pagina is uitgeschakeld.',
          html: '<lintje-pagination page="1" page-count="3"></lintje-pagination>',
          setup: follow,
        },
        {
          label: 'Op de laatste pagina',
          html: '<lintje-pagination page="3" page-count="3"></lintje-pagination>',
          setup: follow,
        },
        {
          label: 'Reeks met “…”',
          html: '<lintje-pagination page="10" page-count="20" total="398" page-size="20"></lintje-pagination>',
          setup: follow,
        },
        {
          label: 'Als links',
          note:
            'Met `href-template` is elke pagina een link met het nummer in het adres, zoals ' +
            '`?pagina=4`.',
          html: '<lintje-pagination page="4" page-count="12" href-template="#pagina={page}"></lintje-pagination>',
          setup: follow,
        },
      ],
    },
    {
      tag: 'lintje-list',
      wide: true,
      title: 'Rijen voor wat geen kolommen nodig heeft',
      specimens: [
        {
          label: 'Rust',
          note: 'Wijs een rij aan om de actie te zien.',
          html: '<lintje-list label="Opnames"></lintje-list>',
          setup(stage) {
            const list = stage.querySelector('lintje-list')
            list.items = RECORDINGS
            list.addEventListener('lintje-row-click', (event) => (list.selectedId = event.detail.id))
          },
        },
        {
          label: 'Gekozen',
          note: 'Wijs een andere rij aan: onder de muis krijgt ze het vlak, de gekozen rij ook de balk.',
          html: '<lintje-list label="Opnames" selected-id="r2"></lintje-list>',
          setup(stage) {
            const list = stage.querySelector('lintje-list')
            list.items = RECORDINGS
            list.addEventListener('lintje-row-click', (event) => (list.selectedId = event.detail.id))
          },
        },
        {
          label: 'Werklijst',
          note:
            'Elke rij toont de soort, de status als woord, de voortgang en één zichtbare actie. ' +
            'De rijen staan in groepen per moment.',
          html: '<lintje-list label="Werk"></lintje-list>',
          setup(stage) {
            stage.querySelector('lintje-list').items = [
              { id: 'w1', icon: 'op-kantoor-document-blanco', title: 'Brief-aan-bewoners.pdf', sub: 'Duits → Nederlands · pagina 4 van 5', status: { label: 'Bezig', tone: 'busy' }, progress: 80, meta: 'nu', action: { label: 'Annuleren', value: 'annuleren' }, group: 'Vandaag' },
              { id: 'w2', icon: 'communicatie-tekstballon-met-potlood', title: 'Uw aanvraag is ontvangen. Binnen acht weken krijgt u een besluit, en bij vragen kunt u bellen.', sub: 'Nederlands → Engels · 132 tekens', meta: '10:12', actions: [{ value: 'verwijderen', label: 'Verwijderen' }], group: 'Vandaag' },
              { id: 'w3', icon: 'op-kantoor-document-blanco', title: 'Scan-formulier.pdf', sub: 'Het bestand is beveiligd; open het en sla het opnieuw op', status: { label: 'Mislukt', tone: 'error' }, meta: '09:40', action: { label: 'Opnieuw', value: 'opnieuw' }, group: 'Vandaag' },
              { id: 'w4', icon: 'beeld-en-geluid-microfoon', title: 'Spreekuur wijkteam', sub: '1:02:30 · 4 sprekers', meta: '16:05', actions: [{ value: 'verwijderen', label: 'Verwijderen' }], group: 'Gisteren' },
            ]
          },
        },
        {
          label: 'Met een behandelaar',
          note: 'De persoon staat bij de feiten, vóór de status; zonder persoon "Niet toegewezen".',
          html: '<lintje-list label="Aanvragen"></lintje-list>',
          setup(stage) {
            stage.querySelector('lintje-list').items = [
              { id: 'a1', title: 'Omgevingsvergunning Dorpsstraat 4', sub: 'Bouwen · 12 dagen', person: PEOPLE.jv, status: { label: 'In behandeling', tone: 'busy' }, meta: '10:42' },
              { id: 'a2', title: 'Kapvergunning Parklaan', sub: 'Kappen · 3 dagen', person: null, status: { label: 'Nieuw', tone: 'info' }, meta: '09:15' },
              { id: 'a3', title: 'Evenement Koningsdag', sub: 'Evenement · 28 dagen', person: PEOPLE.sy, meta: 'gisteren' },
            ]
          },
        },
        {
          label: 'Sprekers',
          note: 'Elke spreker heeft zijn cirkel in de kleur die hij in de speler en het transcript heeft, en een menu.',
          html: '<lintje-list label="Sprekers"></lintje-list>',
          setup(stage) {
            const actions = [
              { value: 'naam', label: 'Naam wijzigen' },
              { value: 'samenvoegen', label: 'Samenvoegen met…' },
              { value: 'alleen', label: 'Alleen deze spreker tonen', checked: false },
            ]
            stage.querySelector('lintje-list').items = [
              { id: 'p1', avatar: { name: 'Ploegleider' }, swatch: 'sky-blue', title: 'Ploegleider', sub: '5 fragmenten · 2:12', actions, clickable: false },
              { id: 'p2', avatar: { name: 'Spreker 2' }, swatch: 'dark-yellow', title: 'Spreker 2', sub: '3 fragmenten · 1:05', actions, clickable: false },
              { id: 'p3', avatar: { name: 'Spreker 3' }, swatch: 'pink', title: 'Spreker 3', sub: '3 fragmenten · 0:52', actions, clickable: false },
            ]
          },
        },
        {
          label: 'Hernoemen in de rij',
          note: 'Met `rename` staat in de rij een veld met opslaan en annuleren.',
          html: '<lintje-list label="Sprekers"></lintje-list>',
          setup(stage) {
            const list = stage.querySelector('lintje-list')
            list.items = [
              { id: 'p1', swatch: 'sky-blue', title: 'Ploegleider', sub: '5 fragmenten', clickable: false },
              { id: 'p2', swatch: 'dark-yellow', title: 'Spreker 2', sub: '3 fragmenten', clickable: false, rename: { save: 'Overal wijzigen (3)' } },
            ]
          },
        },
        {
          label: 'Leeg',
          html: '<lintje-list empty-text="Nog geen opnames."><lintje-button slot="empty" variant="link">Opname uploaden</lintje-button></lintje-list>',
        },
      ],
    },
    {
      tag: 'lintje-card',
      wide: true,
      title: 'Eén item uit een verzameling: een grijze regel, titel, tekst, status en hoogstens twee acties',
      specimens: [
        {
          label: 'Met schermafbeelding',
          note: 'Een kaart met een schermafbeelding, een status en twee acties.',
          html: '<lintje-card></lintje-card>',
          setup(stage) {
            stage.querySelector('lintje-card').data = PRODUCTS[0]
            listen(stage)
          },
        },
        {
          label: 'Met behandelaar en meelezers',
          note:
            'Een persoon en een rijtje personen als feit. Op een kaart die een link is, is het ' +
            'rijtje een eigen knop: het opent de lijst en niet de kaart.',
          html: '<lintje-card></lintje-card>',
          setup(stage) {
            stage.querySelector('lintje-card').data = CASE
            listen(stage)
          },
        },
        {
          label: 'Zonder toegang',
          note: 'Het logo staat naast de titel. De status zegt dat je geen toegang hebt.',
          html: '<lintje-card></lintje-card>',
          setup(stage) {
            stage.querySelector('lintje-card').data = PRODUCTS[1]
            listen(stage)
          },
        },
        {
          label: 'Als link',
          note: 'De hele kaart is een link. De titel is de tabstop.',
          html: '<lintje-card></lintje-card>',
          setup(stage) {
            stage.querySelector('lintje-card').data = KINDS[0]
            listen(stage)
          },
        },
        {
          label: 'Favoriet als icoonactie',
          note: 'Het hartje gaat aan en uit.',
          html: '<div class="guide__pair"><lintje-card></lintje-card><lintje-card></lintje-card></div>',
          setup(stage) {
            const heart = (pressed) => [
              { value: 'favoriet', label: 'Favoriet', icon: 'functioneel-favoriet-outline', iconPressed: 'functioneel-favoriet', pressed },
            ]
            const [first, second] = stage.querySelectorAll('lintje-card')
            first.data = { ...PRODUCTS[0], iconActions: heart(true) }
            second.data = { ...PRODUCTS[1], iconActions: heart(false) }
            hostIconActions(stage)
          },
        },
        {
          label: 'Twee icoonacties',
          note: 'Vastzetten gaat aan en uit. Delen is een gewone actie.',
          html: '<div class="guide__pair"><lintje-card></lintje-card><lintje-card></lintje-card></div>',
          setup(stage) {
            const pinAndShare = (pressed) => [
              { value: 'vastzetten', label: 'Vastzetten', icon: 'functioneel-punaise-outline', iconPressed: 'functioneel-punaise', pressed },
              { value: 'delen', label: 'Delen', icon: 'functioneel-delen' },
            ]
            const [first, second] = stage.querySelectorAll('lintje-card')
            first.data = { ...KINDS[0], iconActions: pinAndShare(true) }
            second.data = { ...KINDS[1], iconActions: pinAndShare(false) }
            hostIconActions(stage)
          },
        },
        {
          label: 'Horizontaal',
          note:
            'Met `layout="horizontal"` staat het beeld in een kolom links. Onder 768 px staat de ' +
            'kaart weer rechtop.',
          html: '<div class="guide__pair"><lintje-card layout="horizontal"></lintje-card><lintje-card layout="horizontal"></lintje-card></div>',
          setup(stage) {
            const [first, second] = stage.querySelectorAll('lintje-card')
            first.data = PRODUCTS[0]
            second.data = PRODUCTS[1]
            listen(stage)
          },
        },
        {
          label: 'Met gegevens',
          note:
            'De gegevens staan in een tabelletje uit `facts`. Een ontbrekende waarde is een ' +
            'streep.',
          html: '<lintje-card></lintje-card>',
          setup(stage) {
            stage.querySelector('lintje-card').data = PRODUCTS[2]
            listen(stage)
          },
        },
        {
          label: 'Compact',
          note: 'De kaart toont alleen de grijze regel, de titel, de status en één actie.',
          html: '<lintje-card compact></lintje-card>',
          setup(stage) {
            stage.querySelector('lintje-card').data = PRODUCTS[1]
            listen(stage)
          },
        },
        {
          label: 'Laden',
          html: '<lintje-card loading></lintje-card>',
        },
      ],
    },
    {
      tag: 'lintje-card-list',
      wide: true,
      title: 'Een verzameling als kaarten: hoogstens drie naast elkaar, elke rij even hoog',
      specimens: [
        {
          label: 'Producten met acties',
          html: '<lintje-card-list label="Producten"></lintje-card-list>',
          setup(stage) {
            stage.querySelector('lintje-card-list').items = PRODUCTS
            listen(stage)
          },
        },
        {
          label: 'Horizontaal',
          note: 'Voor een lange lijst staan twee kaarten naast elkaar.',
          html: '<lintje-card-list label="Producten" layout="horizontal"></lintje-card-list>',
          setup(stage) {
            stage.querySelector('lintje-card-list').items = PRODUCTS
            listen(stage)
          },
        },
        {
          label: 'Als links',
          html: '<lintje-card-list label="Bladeren per soort"></lintje-card-list>',
          setup(stage) {
            stage.querySelector('lintje-card-list').items = KINDS
            listen(stage)
          },
        },
        {
          label: 'Laden',
          html: '<lintje-card-list loading loading-count="3"></lintje-card-list>',
        },
        {
          label: 'Leeg',
          html: '<lintje-card-list empty-text="Geen producten gevonden."></lintje-card-list>',
        },
      ],
    },
    {
      tag: 'lintje-description-list',
      wide: true,
      title: 'Label-waardeparen voor een detail of controlescherm',
      specimens: [
        {
          label: 'Rust',
          note: 'Er is een lege waarde, en een waarde die je kunt wijzigen.',
          html: '<lintje-description-list></lintje-description-list>',
          setup(stage) {
            stage.querySelector('lintje-description-list').items = DETAILS
          },
        },
        {
          label: 'Kolom',
          note: 'Met `layout="column"` staat het label boven de waarde, voor een smalle houder.',
          html: '<lintje-description-list layout="column"></lintje-description-list>',
          setup(stage) {
            stage.querySelector('lintje-description-list').items = DETAILS
          },
        },
        {
          label: 'Vakken',
          note:
            'Met `layout="grid"` staat elk paar in een vak: breed, aangepast, een waarschuwing ' +
            'met inhoud in een slot, en labels.',
          html: `<lintje-description-list layout="grid">
              <span slot="mic"><lintje-button variant="secondary" size="compact">Andere microfoon</lintje-button></span>
            </lintje-description-list>`,
          setup(stage) {
            stage.querySelector('lintje-description-list').items = [
              { label: 'Naam', value: 'Wordt voorgesteld uit het gesprek', span: 2, icon: 'functioneel-bewerken' },
              { label: 'Taal', value: 'Automatisch', icon: 'internationaal-tekstballon-met-wereldbol' },
              { label: 'Sprekers', value: '3, vast', tone: 'changed', action: { href: '#el-description-list', label: 'Terugzetten' } },
              { label: 'Microfoon', value: 'Vergaderset (USB): we horen niets', tone: 'warning', span: 2, slot: 'mic', icon: 'beeld-en-geluid-microfoon' },
              { label: 'Woordenlijsten', tags: ['Afkortingen Rijksoverheid', 'Namen team Planning'], span: 2 },
            ]
          },
        },
        {
          label: 'Link in een getint vak',
          note:
            'Een link en een actie op een statustint nemen `--color-link-on-status`: in donker ' +
            'wit, in licht de primaire kleur.',
          html: '<lintje-description-list layout="grid"></lintje-description-list>',
          setup(stage) {
            stage.querySelector('lintje-description-list').items = [
              { label: 'Verlopen', value: 'Bewijs van inschrijving', href: '#el-description-list', tone: 'warning', action: { href: '#el-description-list', label: 'Vernieuwen' }, span: 2 },
              { label: 'Geldig', value: 'Identiteitsbewijs', href: '#el-description-list', tone: 'success', action: { href: '#el-description-list' }, span: 2 },
            ]
          },
        },
        {
          label: 'Toetsen',
          note: 'Met `keys` is de waarde een rij toetsen, zoals in het overzicht van de sneltoetsen.',
          html: '<lintje-description-list></lintje-description-list>',
          setup(stage) {
            stage.querySelector('lintje-description-list').items = [
              { label: 'Zoeken', keys: ['/'] },
              { label: 'Opslaan', keys: ['Ctrl', 'S'] },
              { label: 'Vorige regel', keys: ['↑'] },
            ]
          },
        },
        {
          label: 'In het raster',
          note: 'De twee lijsten nemen `span="8"` en `span="4"` van het raster.',
          html: `<lintje-grid>
              <lintje-description-list span="8"></lintje-description-list>
              <lintje-description-list span="4" layout="column"></lintje-description-list>
            </lintje-grid>`,
          setup(stage) {
            for (const list of stage.querySelectorAll('lintje-description-list')) list.items = DETAILS
          },
        },
      ],
    },
    {
      tag: 'lintje-tree-view',
      title: 'Een hiërarchie die in- en uitklapt',
      specimens: [
        {
          label: 'Rust',
          note: 'Eén knoop is gekozen, en er zijn open en dichte takken.',
          html: '<lintje-tree-view label="Locaties" name="locatie" selected-id="v2"></lintje-tree-view>',
          setup(stage) {
            const tree = stage.querySelector('lintje-tree-view')
            tree.nodes = structuredClone(UNITS)
            tree.expanded = ['dh', 'verdiepingen']
            lazyArrivals(tree)
          },
        },
        {
          label: 'Een lange naam',
          note:
            'Met een aanwijzer staat de naam op één regel, met de hele naam in de tooltip. Onder ' +
            'de focus van het toetsenbord, zonder hover en op een telefoon loopt hij door.',
          html: '<div style="max-width: 240px"><lintje-tree-view label="Eenheden"></lintje-tree-view></div>',
          setup(stage) {
            stage.querySelector('lintje-tree-view').nodes = [
              { id: 'lang', label: 'Vergaderzalen op de derde verdieping van het oostelijke gebouw', count: 4 },
              { id: 'kort', label: 'Vertrek', count: 3 },
            ]
          },
        },
        {
          label: 'Bezig',
          html: '<lintje-tree-view label="Eenheden"></lintje-tree-view>',
          setup(stage) {
            const tree = stage.querySelector('lintje-tree-view')
            tree.nodes = [
              { id: 'zalen', label: 'Zalen', count: 4, loading: true },
              { id: 'verdiepingen', label: 'Vertrek', count: 3 },
            ]
          },
        },
      ],
    },
    {
      tag: 'lintje-sortable-list',
      title: 'De volgorde wijzigen, met slepen of het toetsenbord',
      specimens: [
        {
          label: 'Rust',
          note: 'Met de spatie pak je een rij op.',
          html: '<lintje-sortable-list label="Volgorde van de kolommen" name="kolommen"></lintje-sortable-list>',
          setup(stage) {
            stage.querySelector('lintje-sortable-list').items = COLUMNS.map(({ id, label }) => ({
              id,
              label,
            }))
          },
        },
        {
          label: 'Met vinkjes',
          note: 'Het attribuut `checkable` zet vinkjes, zoals in de kolomkiezer.',
          html: '<lintje-sortable-list label="Kolommen" checkable></lintje-sortable-list>',
          setup(stage) {
            stage.querySelector('lintje-sortable-list').items = COLUMNS
          },
        },
      ],
    },
    {
      tag: 'lintje-timeline',
      title: 'Momenten langs een rail: hoe iets in de tijd verliep',
      specimens: [
        {
          label: 'Aan één kant',
          note: 'De tijden staan vóór de rail, in een kolom zo breed als de langste.',
          html: '<lintje-timeline heading="Storing inlogdienst, 21 oktober 2026"></lintje-timeline>',
          setup(stage) {
            stage.querySelector('lintje-timeline').moments = TIMELINE_OUTAGE
          },
        },
        {
          label: 'Een label en eigen inhoud',
          note:
            'Boven de kop de tijd en een label, onder de zin de link en een badge die de host ' +
            'per moment in een slot zet.',
          html:
            '<lintje-timeline heading="Storing inlogdienst, 21 oktober 2026" placement="alternate">' +
            '<lintje-badge slot="ernst" tone="error">Ernst hoog</lintje-badge>' +
            '<lintje-badge slot="opgelost" tone="success">Opgelost</lintje-badge>' +
            '</lintje-timeline>',
          setup(stage) {
            stage.querySelector('lintje-timeline').moments = TIMELINE_OUTAGE_LABELLED
            listen(stage)
          },
        },
        {
          label: 'Een lange reeks',
          note:
            'De jaren staan op de rail. Eerst de laatste momenten; "Toon eerdere" toont de rest. ' +
            'Vandaag staat tussen wat geweest is en wat nog komt.',
          html:
            '<lintje-timeline heading="Zo komt de nieuwe regeling tot stand" limit="6" ' +
            'today="Vandaag, 21 oktober"></lintje-timeline>',
          setup(stage) {
            stage.querySelector('lintje-timeline').moments = TIMELINE_BILL
            listen(stage)
          },
        },
        {
          label: 'Om en om',
          note: 'De momenten schuiven in elkaar: een moment begint naast het vorige, nooit ervoor.',
          html:
            '<lintje-timeline heading="Zo verliep de verbouwing van het kantoor" ' +
            'placement="alternate"></lintje-timeline>',
          setup(stage) {
            stage.querySelector('lintje-timeline').moments = TIMELINE_PROJECT
            listen(stage)
          },
        },
        {
          label: 'Per kant',
          note:
            'Wat u deed links, wat wij deden rechts. Op een telefoon staat alles aan één kant en ' +
            'gaat de naam voor de datum.',
          html:
            '<lintje-timeline heading="Uw aanvraag voor een subsidie" placement="sides" ' +
            'today="Vandaag, 21 oktober"></lintje-timeline>',
          setup(stage) {
            const timeline = stage.querySelector('lintje-timeline')
            timeline.sides = ['U', 'Wij']
            timeline.moments = TIMELINE_APPLICATION
          },
        },
        {
          label: 'Liggend aan één kant',
          wide: true,
          note:
            'Elk moment op zijn plek in de tijd, de jaren onder de rail. Past de rij niet, of op ' +
            'een telefoon, dan staat de tijdlijn.',
          html:
            '<lintje-timeline heading="Zo verliep de verbouwing van het kantoor" ' +
            'orientation="horizontal"></lintje-timeline>',
          setup(stage) {
            stage.querySelector('lintje-timeline').moments = TIMELINE_PROJECT
            listen(stage)
          },
        },
        {
          label: 'Liggend om en om',
          wide: true,
          note: 'Momenten die dicht op elkaar vallen, staan aan weerskanten van de rail.',
          html:
            '<lintje-timeline heading="Storing inlogdienst, 21 oktober 2026" ' +
            'orientation="horizontal" placement="alternate"></lintje-timeline>',
          setup(stage) {
            stage.querySelector('lintje-timeline').moments = TIMELINE_OUTAGE
          },
        },
        {
          label: 'Liggend per kant',
          wide: true,
          note:
            'U boven, wij onder, met vandaag op de rail. Wat nog geen datum heeft, staat los ' +
            'achter het eind van de rail.',
          html:
            '<lintje-timeline heading="Uw aanvraag voor een subsidie" orientation="horizontal" ' +
            'placement="sides" today="Vandaag" today-at="2026-10-21"></lintje-timeline>',
          setup(stage) {
            const timeline = stage.querySelector('lintje-timeline')
            timeline.sides = ['U', 'Wij']
            timeline.moments = TIMELINE_YEAR
          },
        },
        {
          label: 'Een geschiedenis',
          note:
            'Wie deed wat, het nieuwste boven: de host geeft die volgorde. Een persoon heeft het ' +
            'rondje vóór de naam; "Systeem" is geen persoon en krijgt een rondje met een icoon.',
          html: '<lintje-timeline heading="Geschiedenis"></lintje-timeline>',
          setup(stage) {
            stage.querySelector('lintje-timeline').moments = HISTORY
            listen(stage)
          },
        },
        {
          label: 'Een lange geschiedenis',
          note:
            'De dagen staan op de rail, naast elk moment alleen de tijd. "Toon eerdere" onder de ' +
            'lijst laat er telkens tien meer zien.',
          html: '<lintje-timeline heading="Geschiedenis" limit="5" step="10"></lintje-timeline>',
          setup(stage) {
            stage.querySelector('lintje-timeline').moments = LONG_HISTORY
          },
        },
        {
          label: 'Zonder momenten',
          note: 'Geen lege rail: één zin, die de host meegeeft.',
          html:
            '<lintje-timeline heading="Uw aanvraag voor een subsidie" ' +
            'empty="Er is nog niets gebeurd met deze aanvraag."></lintje-timeline>',
        },
      ],
    },
    {
      tag: 'lintje-person',
      title: 'Eén persoon: een rondje met foto, initialen of icoon, met de naam ernaast',
      specimens: [
        {
          label: 'Drie maten',
          note: 'Klein voor een cel of rij, gewoon, en groot zo hoog als twee regels.',
          html:
            '<div class="guide__stack"><lintje-person size="small"></lintje-person>' +
            '<lintje-person></lintje-person><lintje-person size="large"></lintje-person></div>',
          setup(stage) {
            for (const person of stage.querySelectorAll('lintje-person')) person.person = PEOPLE.jv
          },
        },
        {
          label: 'Foto of initialen of icoon of leeg',
          note:
            'De vorm volgt wat er is. Zonder initialen en foto het icoon; zonder persoon het ' +
            'gestreepte rondje met het woord.',
          html:
            '<div class="guide__stack"><lintje-person data-id="sy"></lintje-person>' +
            '<lintje-person data-id="ab"></lintje-person><lintje-person data-id="ld"></lintje-person>' +
            '<lintje-person></lintje-person><lintje-person empty="Nog niemand"></lintje-person></div>',
          setup(stage) {
            for (const person of stage.querySelectorAll('lintje-person[data-id]')) {
              person.person = PEOPLE[person.dataset.id]
            }
          },
        },
        {
          label: 'Zonder tweede regel',
          note: 'Alleen de naam, in het gewicht van waar hij staat.',
          html: '<lintje-person></lintje-person>',
          setup(stage) {
            stage.querySelector('lintje-person').person = { ...PEOPLE.mj, role: undefined }
          },
        },
        {
          label: 'Naam als link',
          note: 'Met `href` zijn rondje en naam één link; de naam onderstreept onder de aanwijzer.',
          html: '<lintje-person></lintje-person>',
          setup(stage) {
            stage.querySelector('lintje-person').person = { ...PEOPLE.jv, href: '#el-person' }
            listen(stage)
          },
        },
        {
          label: 'Sprekerskleur',
          note: 'Alleen waar de personen de variabele zijn, zoals de sprekers van een opname.',
          html:
            '<div class="guide__stack"><lintje-person color="sky-blue"></lintje-person>' +
            '<lintje-person color="dark-yellow"></lintje-person><lintje-person color="pink"></lintje-person></div>',
          setup(stage) {
            const speakers = [
              { name: 'Spreker 1', initials: 'S1' },
              { name: 'Spreker 2', initials: 'S2' },
              { name: 'Spreker 3', initials: 'S3' },
            ]
            stage.querySelectorAll('lintje-person').forEach((person, index) => (person.person = speakers[index]))
          },
        },
      ],
    },
    {
      tag: 'lintje-person-group',
      title: 'Een rijtje overlappende rondjes dat een lijst van iedereen opent',
      specimens: [
        {
          label: 'Zes personen',
          note: 'Drie rondjes en "+3"; een klik opent de lijst met naam en functie.',
          html: '<lintje-person-group label="Meelezers"></lintje-person-group>',
          setup(stage) {
            stage.querySelector('lintje-person-group').people = READERS.map((person, index) =>
              index === 0 ? { ...person, href: '#el-person-group' } : person,
            )
            listen(stage)
          },
        },
        {
          label: 'Lijst open',
          note: 'Met `open` staat de lijst met naam en functie van iedereen open, de eerste naam als link.',
          html: '<lintje-person-group label="Meelezers" open></lintje-person-group>',
          setup(stage) {
            // The list hangs below the row: room for it, so it does not cover the log.
            stage.style.minHeight = 'calc(10 * var(--space-10))'
            stage.querySelector('lintje-person-group').people = READERS.map((person, index) =>
              index === 0 ? { ...person, href: '#el-person-group' } : person,
            )
            listen(stage)
          },
        },
        {
          label: 'Twee personen',
          html: '<lintje-person-group label="Behandelaars" size="medium"></lintje-person-group>',
          setup(stage) {
            stage.querySelector('lintje-person-group').people = [PEOPLE.jv, PEOPLE.ab]
          },
        },
        {
          label: 'Leeg',
          html: '<lintje-person-group label="Meelezers"></lintje-person-group>',
        },
      ],
    },
  ],
}
