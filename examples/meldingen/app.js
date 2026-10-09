/**
 * "Meldingen": a register of reports as a worksheet, and a new report in three steps, with the
 * page as the server.
 *
 * The page composes: it sets `data` and properties on Lintje's tags and answers their events —
 * a cell edit, a filter, a column choice, a row or bulk action, a step of the form — with new
 * `data`. The table never keeps, filters or saves anything itself. Everything a reader can
 * share is in the URL (`?tab=`, `?pagina=nieuw`, `?stap=`, `?theme=`, `?mode=`); the draft is
 * `lintje-form`'s, kept in localStorage under `draft-key`, never in the URL. The "server" is a
 * few timers: it takes a moment per answer, refuses what it cannot accept and lets the uploads
 * run.
 *
 * Demo states for a screenshot. The overview: `?demo=selectie` (three rows chosen), `?demo=fout`
 * (a cell the server refused), `?demo=filters` (two column filters and a hidden column),
 * `?demo=lade` (a row open in the drawer), `?demo=zoeken` (the search with a term),
 * `?demo=sneltoetsen` and `?demo=leeg` (no reports). The form: `?demo=fouten` (its errors, as
 * in the design), `?demo=concept` (a restored draft) and `?demo=controleren` (filled in; with
 * `&stap=3` the review). A form demo uses its own draft key, so it never touches yours.
 */
// This page loads what it uses instead of the whole bundle (`docs/guides/loading.md`): the host
// API, five categories (the forms bring the inputs), and the other tags one by one.
import { registerShortcut, setIconSource } from '../../dist-elements/core.js'
import '../../dist-elements/frame.js'
import '../../dist-elements/layout.js'
import '../../dist-elements/forms.js'
import '../../dist-elements/tables.js'
import '../../dist-elements/tag/announcement.js'
import '../../dist-elements/tag/button.js'
import '../../dist-elements/tag/confirm-dialog.js'
import '../../dist-elements/tag/drawer.js'
import '../../dist-elements/tag/menu-button.js'
import '../../dist-elements/tag/prose.js'
import '../../dist-elements/tag/toast.js'
import { plural, toast } from '../_shared/page.js'
import {
  CARRIED_TO_APPS,
  carry,
  emblem,
  modeOf,
  searchWith,
  shellSettingsOf,
  themeOf,
} from '../_shared/settings.js'

setIconSource({ base: '../../dist-icons/' })

/* --- The settings: theme and mode, from the URL ------------------------------------------ */

const query = () => new URLSearchParams(location.search)
const theme = () => themeOf(location.search)
const demo = () => query().get('demo') ?? ''

const FORM_DEMOS = ['fouten', 'concept', 'controleren']
const page = () => (query().get('pagina') === 'nieuw' || FORM_DEMOS.includes(demo()) ? 'nieuw' : 'overzicht')

/** An address on this page with `next` in its query; the reader's settings stay. */
function link(next = {}, hash = '') {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(next)) if (value != null) params.set(key, String(value))
  return carry(`${location.pathname}?${params}${hash}`, location.search, CARRIED_TO_APPS)
}

/** A step of the new report. */
const formLink = (stap = 1, hash = '') => link({ pagina: 'nieuw', stap: stap > 1 ? stap : null }, hash)

/* --- Fictional reference data ------------------------------------------------------------- */

const CATEGORY_OPTIONS = [
  { value: '', label: 'Kies een categorie' },
  { value: 'veiligheid', label: 'Veiligheid' },
  { value: 'verkeer', label: 'Verkeer' },
  { value: 'overlast', label: 'Overlast' },
  { value: 'gevonden', label: 'Gevonden voorwerp' },
  { value: 'overig', label: 'Overig' },
]

const LOCATIONS = [
  { value: 'ingang', label: 'Hoofdingang' },
  { value: 'ontvangst', label: 'Ontvangsthal' },
  { value: 'balie', label: 'Bezoekersbalie' },
  { value: 'vergader', label: 'Vergadercentrum' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'v3', label: 'Verdieping 3' },
  { value: 'v7', label: 'Verdieping 7' },
  { value: 'stalling', label: 'Fietsenstalling' },
  { value: 'p3', label: 'Parkeerterrein P3' },
]

const SEVERITY_OPTIONS = [
  { value: 'laag', label: 'Laag' },
  { value: 'midden', label: 'Midden' },
  { value: 'hoog', label: 'Hoog' },
]

const ROLES = [
  { value: 'melder', label: 'Melder' },
  { value: 'getuige', label: 'Getuige' },
  { value: 'eigenaar', label: 'Eigenaar' },
  { value: 'betrokkene', label: 'Betrokkene' },
]

const FOLLOW_UP = [
  { value: 'geen', label: 'Geen opvolging nodig' },
  { value: 'eigen', label: 'Opvolging door het eigen team' },
  { value: 'overdragen', label: 'Overdragen aan een andere dienst' },
]

const TEAMS = [
  { value: '', label: 'Kies een team' },
  { value: 'facilitair', label: 'Team Facilitair' },
  { value: 'beveiliging', label: 'Team Beveiliging' },
  { value: 'huisvesting', label: 'Team Huisvesting' },
  { value: 'bhv', label: 'Bedrijfshulpverlening' },
]

const label = (list, value) => list.find((item) => item.value === value)?.label ?? null

/* --- The register: fictional reports ------------------------------------------------------ */

// The table holds the labels the form's options show.
const CATEGORIES = CATEGORY_OPTIONS.filter((option) => option.value).map((option) => option.label)
const SEVERITIES = SEVERITY_OPTIONS.map((option) => option.label)
const STATUSES = ['Nieuw', 'In behandeling', 'Afgehandeld']
const OWNERS = ['Niet toegewezen', 'R. Verbeek', 'A. Bakker', 'M. Smit', 'S. Yilmaz', 'L. de Graaf']
const ME = 'R. Verbeek'

const TITLES = [
  'Onbeheerde tas, ontvangsthal',
  'Verloren toegangspas',
  'Wachtrij bij de bezoekersbalie',
  'Storing lift 4',
  'Geluid bij de taxistandplaats',
  'Drone boven parkeerterrein P3',
  'Deur nooduitgang staat open',
  'Bezoeker onwel in vergaderzaal 7',
  'Gevonden portemonnee, restaurant',
  'Fout geparkeerde bus bij de hoofdingang',
  'Kapotte camera fietsenstalling',
  'Woordenwisseling bij de slagboom',
  'Brandalarm zonder oorzaak, verdieping 5',
  'Achtergelaten kinderwagen',
  'Verdachte situatie bij de kluisjes',
  'Lekkage in de ontvangsthal',
  'Taxi zonder vergunning',
  'Gevonden sleutelbos, verdieping 3',
  'Hinderlijk gedrag in het restaurant',
  'Defecte draaideur, ingang west',
  'Rookmelder piept in vergaderzaal 4',
  'Gevonden telefoon, bezoekersbalie',
  'Opstopping bij de slagboom',
  'Onbemande vrachtwagen bij laadperron',
  'Glasscherf op de roltrap',
  'Laserlicht gericht op het gebouw',
  'Vergeten jas in de garderobe',
  'Ruzie bij de receptie',
  'Verlaten fiets bij ingang oost',
  'Gevonden rugzak, fietsenstalling',
  'Kind kwijt tijdens de open dag',
  'Uitgevallen verlichting P1',
]

const pad = (number) => String(number).padStart(2, '0')

const reportId = (number) => `M-${2026_0400 + number}`
let lastNumber = TITLES.length

/**
 * The table sorts a `dd-mm-jjjj` date as text, so the register keeps to October 2026; a report
 * the reader sends in another month sorts out of place.
 */
let ROWS =
  demo() === 'leeg'
    ? []
    : TITLES.map((title, index) => ({
        id: reportId(index + 1),
        title,
        category: CATEGORIES[(index * 3) % CATEGORIES.length],
        severity: SEVERITIES[(index * 7) % SEVERITIES.length],
        status: STATUSES[(index * 5 + 1) % STATUSES.length],
        owner: OWNERS[(index * 4) % OWNERS.length],
        date: `${pad(4 - (index % 4))}-10-2026`,
        note: '',
      }))

const options = (values) => values.map((value) => ({ value }))
const counted = (key, values, rows) =>
  values.map((value) => ({ value, count: rows.filter((row) => row[key] === value).length }))

/* --- Small helpers ------------------------------------------------------------------------ */

const isoDay = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const TODAY = isoDay(new Date())

const longDay = (iso) =>
  iso
    ? new Date(`${iso}T12:00:00`).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

const clock = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`

const blank = (value) => value == null || String(value).trim() === ''

function element(name, attributes = {}, text = '') {
  const node = document.createElement(name)
  for (const [key, value] of Object.entries(attributes)) {
    if (value === true) node.setAttribute(key, '')
    else if (value != null && value !== false) node.setAttribute(key, String(value))
  }
  if (text) node.textContent = text
  return node
}

/* --- Elements ----------------------------------------------------------------------------- */

const shell = document.getElementById('shell')
const crumbs = document.getElementById('crumbs')
const pageHeader = document.getElementById('page-header')
const exportMenu = document.getElementById('export')
const newButton = document.getElementById('new')
const overview = document.getElementById('overview')
const draftNotice = document.getElementById('draft')
const tabs = document.getElementById('tabs')
const panel = document.getElementById('panel')
const table = document.getElementById('table')
const newPage = document.getElementById('new-report')
const drawer = document.getElementById('drawer')
const edit = document.getElementById('edit')
const facts = document.getElementById('facts')
const confirmDialog = document.getElementById('confirm')
const discardDialog = document.getElementById('discard')
const leave = document.getElementById('leave')
const search = document.getElementById('search')
const shortcuts = document.getElementById('shortcuts')

/* --- The frame ---------------------------------------------------------------------------- */

function renderShell() {
  const root = document.documentElement
  root.dataset.mode = modeOf(location.search)
  root.dataset.theme = theme()
  shell.data = {
    name: 'Meldingen',
    emblem: emblem(theme()),
    // "Nieuwe melding" is the overview's own button, so the menu holds the overview only.
    navigation: [{ label: 'Overzicht', href: link(), active: true }],
    user: { name: ME, role: 'Teamleider · Facilitair Bedrijf', initials: 'RV' },
    userMenu: [
      { value: 'sneltoetsen', label: 'Sneltoetsen', hint: '?' },
      { value: 'start', label: 'Lintje-startpagina' },
    ],
    // "Weergave": mode and theme; an application's menu always stands above the page.
    view: shellSettingsOf(location.search).view,
    version: '1.0.0',
    search: true,
  }
  const start = { label: 'Start', href: carry('../') }
  crumbs.items =
    page() === 'nieuw'
      ? [start, { label: 'Meldingen', href: link() }, { label: 'Nieuwe melding' }]
      : [start, { label: 'Meldingen' }]
}

shell.addEventListener('lintje-action', (event) => {
  if (event.target !== shell && event.target.localName !== 'lintje-user-menu') return
  // The start page opens the way this one looks.
  if (event.detail === 'start') location.href = carry('../')
  if (event.detail === 'sneltoetsen') shortcuts.open = true
})

shell.addEventListener('lintje-view-change', (event) => {
  history.replaceState(null, '', `${location.pathname}${searchWith(location.search, event.detail)}`)
  renderShell()
})

/* --- The overview: tabs Alle / Open / Afgehandeld, kept in the URL ------------------------ */

const TABS = [
  { value: 'alle', label: 'Alle', keep: () => true },
  { value: 'open', label: 'Open', keep: (row) => row.status !== 'Afgehandeld' },
  { value: 'afgehandeld', label: 'Afgehandeld', keep: (row) => row.status === 'Afgehandeld' },
]
const tab = () => TABS.find((item) => item.value === query().get('tab')) ?? TABS[0]
const tabLink = (value) => link({ tab: value === 'alle' ? null : value })

function renderTabs() {
  tabs.tabs = TABS.map((item) => ({
    value: item.value,
    label: item.label,
    href: tabLink(item.value),
    count: ROWS.filter(item.keep).length,
  }))
  tabs.value = tab().value
  // One table for every tab: its panel moves into the chosen tab's slot.
  panel.slot = tab().value
}

tabs.addEventListener('lintje-navigate', (event) => {
  event.preventDefault()
  event.stopPropagation()
  view.checkedIds = []
  navigate(event.detail.href)
})

/** A draft the reader kept stands above the table until it is sent or thrown away. */
function renderDraft() {
  const draft = demo() ? null : storedDraft('meldingen-nieuw')
  draftNotice.hidden = !draft
  if (!draft) return
  draftNotice.data = {
    kind: 'info',
    title: 'Concept',
    text: `“${draft.values.titel || 'Melding zonder titel'}” is nog niet verstuurd.`,
    meta: `bewaard om ${clock(new Date(draft.savedAt))}`,
  }
}

document.getElementById('draft-continue').addEventListener('click', () => navigate(formLink()))

/* --- The table: what the page shows, and its answers -------------------------------------- */

const COLUMNS = [
  { key: 'title', header: 'Titel', filter: { kind: 'text' } },
  { key: 'id', header: 'Nummer' },
  { key: 'category', header: 'Categorie', editor: { kind: 'select', options: options(CATEGORIES) }, filter: { kind: 'options' } },
  { key: 'severity', header: 'Ernst', editor: { kind: 'select', options: options(SEVERITIES) }, filter: { kind: 'options' } },
  { key: 'status', header: 'Status', filter: { kind: 'options' }, mobileMeasure: true },
  { key: 'owner', header: 'Behandelaar', editor: { kind: 'select', options: options(OWNERS) }, filter: { kind: 'options' } },
  { key: 'date', header: 'Datum', editor: { kind: 'date' } },
]

const FILTER_VALUES = { category: CATEGORIES, severity: SEVERITIES, status: STATUSES, owner: OWNERS }

// The title opens a report; the menu holds what else a row can do.
const ROW_ACTIONS = [
  { value: 'toewijzen', label: 'Aan mij toewijzen' },
  'separator',
  { value: 'verwijderen', label: 'Verwijderen', icon: 'functioneel-verwijderen', danger: true },
]

const BULK_ACTIONS = [
  { value: 'toewijzen', label: 'Toewijzen' },
  { value: 'exporteren', label: 'Exporteren' },
  { value: 'verwijderen', label: 'Verwijderen', danger: true },
]

/** What the page holds about the table besides the rows: the reader's choices. */
const view = {
  filters: {},
  order: COLUMNS.map((column) => column.key),
  hidden: [],
  sort: null,
  checkedIds: [],
  busyCells: [],
  cellErrors: [],
}

function matches(row) {
  return Object.entries(view.filters).every(([key, value]) =>
    Array.isArray(value) ? value.includes(row[key]) : String(row[key]).toLowerCase().includes(value.toLowerCase()),
  )
}

function renderTable() {
  const inTab = ROWS.filter(tab().keep)
  const rows = inTab.filter(matches)
  const columns = view.order
    .map((key) => COLUMNS.find((column) => column.key === key))
    .map((column) =>
      column.filter?.kind === 'options'
        ? { ...column, filter: { kind: 'options', options: counted(column.key, FILTER_VALUES[column.key], inTab) } }
        : column,
    )
  const visible = new Set(rows.map((row) => row.id))
  table.data = {
    // The tab already names the set; the caption names it for a screen reader.
    caption: `${tab().label} meldingen, met bewerkbare cellen`,
    state: ROWS.length ? 'ready' : 'empty',
    message: 'Nog geen meldingen. Wat je meldt, staat hier.',
    columns,
    rows,
    rowKey: 'id',
    pageSize: 10,
    sort: view.sort,
    defaultSort: { key: 'date', direction: 'desc' },
    mobileSublineTemplate: '{owner} · {date}',
    selectable: true,
    openable: true,
    checkedIds: view.checkedIds.filter((id) => visible.has(id)),
    rowActions: ROW_ACTIONS,
    bulkActions: BULK_ACTIONS,
    filters: view.filters,
    totalRows: inTab.length,
    columnChooser: true,
    hiddenColumns: view.hidden,
    busyCells: view.busyCells,
    cellErrors: view.cellErrors,
  }
}

table.addEventListener('lintje-sort-change', (event) => {
  view.sort = event.detail
  renderTable()
})

table.addEventListener('lintje-checked-change', (event) => {
  view.checkedIds = event.detail
  renderTable()
})

table.addEventListener('lintje-filter-change', (event) => {
  const { column, value } = event.detail
  if (value == null || (Array.isArray(value) && !value.length) || value === '') delete view.filters[column]
  else view.filters[column] = value
  renderTable()
})

table.addEventListener('lintje-columns-change', (event) => {
  view.order = event.detail.order
  view.hidden = event.detail.hidden
  renderTable()
})

/* --- Editing a cell: the server takes 0,7 s and refuses what it cannot accept ------------- */

const sameCell = (id, column) => (cell) => cell.id === id && cell.column === column
const without = (list, id, column) => list.filter((cell) => !sameCell(id, column)(cell))

/** A date that exists, as `dd-mm-jjjj`. */
function realDate(text) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(text)
  if (!match) return false
  const [day, month, year] = match.slice(1).map(Number)
  const date = new Date(year, month - 1, day)
  return date.getDate() === day && date.getMonth() === month - 1
}

/** The server's verdict on one value: a message, or null when it is accepted. */
function refuse(column, value, row) {
  if (column === 'title' && !String(value).trim()) return 'Een melding heeft een titel nodig'
  if (column === 'date' && !realDate(value)) return 'Deze datum bestaat niet'
  if (column === 'owner' && value === 'M. Smit') return 'M. Smit is met verlof tot 14 oktober'
  if (column === 'owner' && row.status === 'Afgehandeld' && value === 'Niet toegewezen') {
    return 'Een afgehandelde melding houdt haar behandelaar'
  }
  return null
}

table.addEventListener('lintje-cell-edit', (event) => {
  const { id, column, value } = event.detail
  view.busyCells = [...without(view.busyCells, id, column), { id, column }]
  view.cellErrors = without(view.cellErrors, id, column)
  renderTable()
  setTimeout(() => {
    view.busyCells = without(view.busyCells, id, column)
    const row = ROWS.find((candidate) => candidate.id === id)
    const message = row ? refuse(column, value, row) : 'Deze melding bestaat niet meer'
    if (message) view.cellErrors = [...view.cellErrors, { id, column, message, value: String(value) }]
    else ROWS = ROWS.map((candidate) => (candidate.id === id ? { ...candidate, [column]: value } : candidate))
    render()
  }, 700)
})

/* --- Actions on a row and on the selection ------------------------------------------------ */

function assign(ids) {
  ROWS = ROWS.map((row) => (ids.includes(row.id) ? { ...row, owner: ME, status: row.status === 'Nieuw' ? 'In behandeling' : row.status } : row))
  render()
  toast(`${plural(ids.length, 'melding', 'meldingen')} aan jou toegewezen`)
}

function exportRows(ids, kind = 'CSV') {
  toast(`${plural(ids.length, 'melding', 'meldingen')} geëxporteerd als ${kind}`)
}

/** Deleting asks first: the heading names how many, the text names what goes. */
let pendingDelete = []

function askDelete(ids) {
  pendingDelete = ids
  const first = ROWS.find((row) => row.id === ids[0])
  confirmDialog.heading = ids.length === 1 ? 'Melding verwijderen?' : `${ids.length} meldingen verwijderen?`
  confirmDialog.textContent =
    ids.length === 1
      ? `“${first?.title}” wordt verwijderd. Dit kun je niet terugdraaien.`
      : 'De gekozen meldingen worden verwijderd. Dit kun je niet terugdraaien.'
  confirmDialog.open = true
}

confirmDialog.addEventListener('lintje-close', () => (confirmDialog.open = false))
confirmDialog.addEventListener('lintje-confirm', () => {
  confirmDialog.busy = true
  setTimeout(() => {
    const gone = new Set(pendingDelete)
    ROWS = ROWS.filter((row) => !gone.has(row.id))
    view.checkedIds = view.checkedIds.filter((id) => !gone.has(id))
    confirmDialog.busy = false
    confirmDialog.open = false
    render()
    toast(`${plural(gone.size, 'melding', 'meldingen')} verwijderd`)
  }, 900)
})

table.addEventListener('lintje-row-open', (event) => openDrawer(event.detail.id))

table.addEventListener('lintje-row-action', (event) => {
  const { id, action } = event.detail
  if (action === 'toewijzen') assign([id])
  if (action === 'verwijderen') askDelete([id])
})

table.addEventListener('lintje-bulk-action', (event) => {
  const { ids, action } = event.detail
  if (action === 'toewijzen') assign(ids)
  if (action === 'exporteren') exportRows(ids)
  if (action === 'verwijderen') askDelete(ids)
})

exportMenu.items = [
  { value: 'csv', label: 'Tabel als CSV', icon: 'functioneel-downloaden', hint: '.csv' },
  { value: 'pdf', label: 'Overzicht als PDF', icon: 'op-kantoor-document-blanco', hint: '.pdf' },
]
exportMenu.addEventListener('lintje-action', (event) => {
  event.stopPropagation()
  const rows = ROWS.filter(tab().keep).filter(matches)
  exportRows(
    rows.map((row) => row.id),
    event.detail === 'pdf' ? 'PDF' : 'CSV',
  )
})

/* --- The drawer: one report in a small form ----------------------------------------------- */

edit.querySelector('[name=category]').options = CATEGORIES.map((value) => ({ value, label: value }))
edit.querySelector('[name=severity]').options = SEVERITIES.map((value) => ({ value, label: value }))
edit.querySelector('[name=status]').options = STATUSES.map((value) => ({ value, label: value }))
edit.querySelector('[name=owner]').options = OWNERS.map((value) => ({ value, label: value }))

let openId = null
const saveButton = document.getElementById('drawer-save')
const cancelButton = document.getElementById('drawer-cancel')

function openDrawer(id) {
  const row = ROWS.find((candidate) => candidate.id === id)
  if (!row) return
  openId = id
  drawer.heading = row.title
  facts.items = [
    { label: 'Nummer', value: row.id },
    { label: 'Gemeld op', value: row.date },
  ]
  edit.errors = undefined
  edit.discardDraft()
  edit.values = { title: row.title, category: row.category, severity: row.severity, status: row.status, owner: row.owner, note: row.note }
  drawer.open = true
}

function closeDrawer() {
  drawer.open = false
  openId = null
}

/** Closing with unsaved input asks first; otherwise it closes. */
function askClose() {
  if (drawer.busy) return
  if (edit.dirty) discardDialog.open = true
  else closeDrawer()
}

drawer.addEventListener('lintje-close', askClose)
cancelButton.addEventListener('click', askClose)
saveButton.addEventListener('click', () => edit.submit())
discardDialog.addEventListener('lintje-close', () => (discardDialog.open = false))
discardDialog.addEventListener('lintje-confirm', () => {
  discardDialog.open = false
  edit.discardDraft()
  closeDrawer()
})

edit.addEventListener('lintje-submit', ({ detail }) => {
  const row = ROWS.find((candidate) => candidate.id === openId)
  if (!row) return
  const fields = {}
  for (const column of ['title', 'owner']) {
    const message = refuse(column, detail.values[column], { ...row, ...detail.values })
    if (message) fields[column] = message
  }
  if (Object.keys(fields).length) {
    edit.errors = { fields }
    return
  }
  drawer.busy = edit.busy = saveButton.busy = cancelButton.disabled = true
  setTimeout(() => {
    drawer.busy = edit.busy = saveButton.busy = cancelButton.disabled = false
    ROWS = ROWS.map((candidate) => (candidate.id === openId ? { ...candidate, ...detail.values } : candidate))
    edit.saved()
    closeDrawer()
    render()
    toast(`“${detail.values.title}” is opgeslagen`)
  }, 900)
})

/* --- The new report: uploads the "server" receives ---------------------------------------- */

/** The page's uploads; they belong to the report being written, not to the draft. */
let uploads = []
let uploadId = 0

function setUploads(rows) {
  uploads = rows
  const upload = newPage.querySelector('lintje-file-upload')
  if (upload) upload.files = uploads
  renderSummary()
}

function startUpload(file) {
  const id = `u${(uploadId += 1)}`
  setUploads([...uploads, { id, name: file.name, size: file.size, state: 'busy', progress: 0 }])
  const timer = setInterval(() => {
    const row = uploads.find((candidate) => candidate.id === id)
    if (!row || row.state !== 'busy') return clearInterval(timer)
    const progress = Math.min(100, (row.progress ?? 0) + 15)
    const next = progress >= 100 ? { ...row, state: 'done', progress: 100 } : { ...row, progress }
    setUploads(uploads.map((candidate) => (candidate.id === id ? next : candidate)))
  }, 350)
}

/* --- The people involved: rows of the repeater, named by a stable row id ------------------ */

let rowId = 0

function personRow(id, person = {}) {
  const row = element('lintje-repeater-row', { 'data-id': id })
  const name = element('lintje-text-input', {
    name: `betrokkene-${id}-naam`,
    'hide-label': true,
    commit: 'input',
    placeholder: 'Voorletters en achternaam',
  })
  const role = element('lintje-select', { name: `betrokkene-${id}-rol`, 'hide-label': true })
  role.options = ROLES
  if (person.naam != null) name.value = person.naam
  role.value = person.rol ?? 'getuige'
  row.append(name, role)
  return row
}

/** The rows' fields name the row they stand in: "Naam van betrokkene 2". */
function renumber(repeater) {
  ;[...repeater.children].forEach((row, index) => {
    const [name, role] = row.children
    name.label = `Naam van betrokkene ${index + 1}`
    role.label = `Rol van betrokkene ${index + 1}`
  })
}

function people(values) {
  return [...newPage.querySelectorAll('lintje-repeater-row')].map((row) => ({
    naam: values[`betrokkene-${row.dataset.id}-naam`] ?? '',
    rol: values[`betrokkene-${row.dataset.id}-rol`] ?? 'getuige',
  }))
}

/* --- The new report: the form ------------------------------------------------------------- */

const STEPS = ['Melding', 'Opvolging', 'Controleren en versturen']

/** What a new report starts with: what is "saved" before anything is typed. */
const START = {
  datum: TODAY,
  ernst: 'midden',
  'betrokkene-p1-rol': 'melder',
  opvolging: 'eigen',
  informeren: true,
}

/** The report of the design: the state `?demo=fouten` and `?demo=controleren` start from. */
const FILLED = {
  titel: 'Onbeheerde tas in de ontvangsthal',
  categorie: 'veiligheid',
  omschrijving: '',
  datum: TODAY,
  tijdstip: '23:50',
  locatie: 'ontvangst',
  ernst: 'midden',
  'betrokkene-p1-naam': 'J. de Vries',
  'betrokkene-p1-rol': 'melder',
  'betrokkene-p2-naam': '',
  'betrokkene-p2-rol': 'getuige',
  opvolging: 'eigen',
  team: 'beveiliging',
  informeren: true,
}

const FILLED_UPLOADS = [
  { id: 'd1', name: 'foto-ontvangsthal.jpg', size: 2.4 * 1024 * 1024, state: 'done', progress: 100 },
  { id: 'd2', name: 'verklaring.pdf', size: 310 * 1024, state: 'busy', progress: 45 },
]

const DRAFT_PREFIX = 'lintje-draft:'
const draftKey = () => (demo() ? `meldingen-demo-${demo()}` : 'meldingen-nieuw')

/** The draft `lintje-form` keeps, in its documented shape `{ savedAt, values }`; or null. */
function storedDraft(key) {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_PREFIX + key) ?? 'null')
  } catch {
    return null
  }
}

const FORM = `
  <lintje-session-expiry hidden></lintje-session-expiry>
  <lintje-form>
    <div class="stack stack--wide" data-step="1">
      <lintje-form-section variant="tile" heading="Wat en waar"
        description="Beschrijf wat je zag. Namen van betrokkenen vul je in de volgende sectie in.">
        <lintje-grid>
          <lintje-text-input span="8" name="titel" label="Titel" commit="input"></lintje-text-input>
          <lintje-select span="4" name="categorie" label="Categorie"></lintje-select>
        </lintje-grid>
        <lintje-textarea name="omschrijving" label="Omschrijving" maxlength="2000" commit="input"
          placeholder="Wat heb je gezien of gehoord?"></lintje-textarea>
        <lintje-grid>
          <lintje-date-input span="4" name="datum" label="Datum" hint="dd-mm-jjjj"></lintje-date-input>
          <lintje-time-input span="2" name="tijdstip" label="Tijdstip" hint="uu:mm"></lintje-time-input>
          <lintje-combobox span="6" name="locatie" label="Locatie" placeholder="Typ om te zoeken"
            empty-label="Geen locatie gevonden voor"></lintje-combobox>
        </lintje-grid>
        <lintje-radio-group name="ernst" label="Ernst"></lintje-radio-group>
      </lintje-form-section>
      <lintje-form-section variant="tile" heading="Betrokkenen"
        description="Alleen wie je zelf hebt gesproken. De melder staat bovenaan.">
        <lintje-repeater legend="Naam en rol" item-label="Betrokkene" min="1" max="10"></lintje-repeater>
      </lintje-form-section>
      <lintje-form-section variant="tile" heading="Bijlagen" description="Foto's of een verklaring. Niet verplicht.">
        <lintje-file-upload label="Bijlagen" hide-label accept=".pdf,.jpg,.png" max-size="10485760"></lintje-file-upload>
      </lintje-form-section>
    </div>
    <div class="stack stack--wide" data-step="2" hidden>
      <lintje-form-section variant="tile" heading="Opvolging"
        description="Wie pakt de melding op, en wat is er al afgesproken?">
        <lintje-radio-group name="opvolging" label="Opvolging"></lintje-radio-group>
        <lintje-grid>
          <lintje-select span="6" name="team" label="Team"></lintje-select>
          <lintje-date-input span="6" name="deadline" label="Uiterlijk afgehandeld op" optional hint="dd-mm-jjjj"></lintje-date-input>
        </lintje-grid>
        <lintje-textarea name="afspraken" label="Afspraken en overdracht" optional maxlength="1000" commit="input"></lintje-textarea>
        <lintje-checkbox name="informeren" label="De melder op de hoogte houden van de afhandeling"></lintje-checkbox>
      </lintje-form-section>
    </div>
    <div class="stack stack--wide" data-step="3" hidden>
      <lintje-tile heading="Melding">
        <lintje-description-list data-review="melding"></lintje-description-list>
      </lintje-tile>
      <lintje-tile heading="Opvolging">
        <lintje-description-list data-review="opvolging"></lintje-description-list>
      </lintje-tile>
      <lintje-checkbox name="gecontroleerd" label="Ik heb de gegevens gecontroleerd"></lintje-checkbox>
    </div>
    <lintje-form-actions>
      <lintje-button variant="tertiary" data-action="cancel">Annuleren</lintje-button>
      <lintje-button variant="secondary" data-action="draft">Concept opslaan</lintje-button>
      <lintje-button variant="primary" type="submit" data-action="next">Volgende stap</lintje-button>
    </lintje-form-actions>
  </lintje-form>`

/** The current form, while the "Nieuwe melding" page stands. */
let form = null

const step = () => Math.min(3, Math.max(1, Number(query().get('stap')) || 1))

async function renderForm() {
  const stepper = element('lintje-stepper')
  const columns = element('div', { class: 'page__columns' })
  const main = element('div', { class: 'page__main stack' })
  main.innerHTML = FORM
  const aside = element('aside', { class: 'page__aside' })
  aside.innerHTML = `<lintje-tile heading="Samenvatting">
      <div class="stack">
        <lintje-description-list data-summary></lintje-description-list>
        <lintje-prose text="Het concept wordt bewaard terwijl je typt. Je verstuurt de melding pas in stap 3."></lintje-prose>
      </div>
    </lintje-tile>`
  columns.append(main, aside)
  newPage.replaceChildren(stepper, columns)

  form = main.querySelector('lintje-form')
  const key = draftKey()
  if (demo() === 'concept') {
    // The demo plays a reader who typed a quarter of an hour ago and then reloaded.
    const savedAt = Date.now() - 15 * 60_000
    const values = { ...FILLED, omschrijving: 'Zwarte tas zonder label, al 20 minuten zonder eigenaar bij de bezoekersbalie.' }
    localStorage.setItem(DRAFT_PREFIX + key, JSON.stringify({ savedAt, values }))
  }
  const draft = storedDraft(key)
  form.draftKey = key

  // The options and the starting rows, before the form writes its values into the fields.
  form.querySelector('[name=categorie]').options = CATEGORY_OPTIONS
  form.querySelector('[name=locatie]').options = LOCATIONS
  form.querySelector('[name=ernst]').options = SEVERITY_OPTIONS
  form.querySelector('[name=opvolging]').options = FOLLOW_UP
  form.querySelector('[name=team]').options = TEAMS
  form.querySelector('[name=datum]').max = TODAY

  const filled = demo() === 'fouten' || demo() === 'controleren'
  const repeater = form.querySelector('lintje-repeater')
  const ids = filled ? ['p1', 'p2'] : ['p1']
  rowId = ids.length
  for (const id of ids) repeater.append(personRow(id))
  renumber(repeater)
  form.values = filled
    ? { ...FILLED, ...(demo() === 'controleren' ? { omschrijving: 'Zwarte tas zonder label bij de bezoekersbalie.', tijdstip: '09:40' } : {}) }
    : START
  if (filled) uploads = FILLED_UPLOADS.map((row) => ({ ...row }))

  wireForm(form, repeater)
  await form.updateComplete

  // The restored draft can name rows the page has not drawn: add them, with their values.
  const values = form.collect()
  const known = new Set(ids)
  for (const name of Object.keys(values)) {
    const match = /^betrokkene-(p\d+)-(naam|rol)$/.exec(name)
    if (!match || known.has(match[1])) continue
    known.add(match[1])
    rowId = Math.max(rowId, Number(match[1].slice(1)))
    repeater.append(personRow(match[1], { naam: values[`betrokkene-${match[1]}-naam`], rol: values[`betrokkene-${match[1]}-rol`] }))
  }
  renumber(repeater)

  // "Je concept is teruggezet", with the moment it was written.
  const notice = main.querySelector('lintje-session-expiry')
  if (draft && form.dirty) {
    notice.setAttribute('restored-at', new Date(draft.savedAt).toISOString())
    notice.hidden = false
  }
  notice.addEventListener('lintje-draft-discard', () => {
    discard()
    notice.hidden = true
    renderForm()
  })

  const upload = form.querySelector('lintje-file-upload')
  upload.files = uploads
  upload.addEventListener('lintje-files-add', (event) => event.detail.forEach(startUpload))
  const drop = (event) => setUploads(uploads.filter((row) => row.id !== event.detail.id))
  upload.addEventListener('lintje-file-remove', drop)
  upload.addEventListener('lintje-file-cancel', drop)

  if (demo() === 'fouten') {
    form.errors = { fields: { omschrijving: 'Vul een omschrijving in', tijdstip: 'Dit tijdstip ligt in de toekomst' } }
  }
  renderStep()
}

function wireForm(keeper, repeater) {
  repeater.addEventListener('lintje-row-add', () => {
    rowId += 1
    repeater.append(personRow(`p${rowId}`))
    renumber(repeater)
    renderSummary()
  })
  repeater.addEventListener('lintje-row-remove', (event) => {
    event.target.closest('lintje-repeater-row')?.remove()
    renumber(repeater)
    renderSummary()
  })

  keeper.addEventListener('lintje-change', () => requestAnimationFrame(renderSummary))

  keeper.querySelector('[data-action=cancel]').addEventListener('click', () => leaveForm(link()))
  keeper.querySelector('[data-action=draft]').addEventListener('click', () => {
    if (keeper.dirty) keeper.saveDraft()
    else toast('Er is nog niets om op te slaan')
  })

  keeper.addEventListener('lintje-submit', ({ detail }) => {
    const current = step()
    const fields = check(current, detail.values)
    if (Object.keys(fields).length) {
      keeper.errors = { fields }
      return
    }
    keeper.busy = true
    setTimeout(() => {
      keeper.busy = false
      const refused = serverCheck(current, detail.values)
      if (refused) {
        keeper.errors = { fields: refused }
        return
      }
      keeper.errors = undefined
      if (current < 3) {
        navigate(formLink(current + 1))
        window.scrollTo(0, 0)
      } else send(detail.values)
    }, current < 3 ? 900 : 1400)
  })
}

/** The page's own checks, per step: what must be there before the server is asked. */
function check(current, values) {
  const fields = {}
  if (current === 1) {
    if (blank(values.titel)) fields.titel = 'Vul een titel in'
    if (blank(values.categorie)) fields.categorie = 'Kies een categorie'
    if (blank(values.omschrijving)) fields.omschrijving = 'Vul een omschrijving in'
    else if (values.omschrijving.length > 2000) fields.omschrijving = 'Maak de omschrijving korter dan 2.000 tekens'
    if (blank(values.datum)) fields.datum = 'Vul de datum in'
    if (blank(values.tijdstip)) fields.tijdstip = 'Vul het tijdstip in'
    if (blank(values.locatie)) fields.locatie = 'Kies een locatie'
    const first = newPage.querySelector('lintje-repeater-row')
    if (first && blank(values[`betrokkene-${first.dataset.id}-naam`])) {
      fields[`betrokkene-${first.dataset.id}-naam`] = 'Vul de naam van de melder in'
    }
  }
  if (current === 2) {
    if (values.opvolging === 'overdragen' && blank(values.afspraken)) {
      fields.afspraken = 'Beschrijf aan wie je de melding overdraagt'
    }
    if (values.opvolging !== 'geen' && blank(values.team)) fields.team = 'Kies het team dat de melding oppakt'
  }
  if (current === 3 && !values.gecontroleerd) fields.gecontroleerd = 'Bevestig dat je de gegevens hebt gecontroleerd'
  return fields
}

/** The server's word: it knows the time, and a report from the future does not exist. */
function serverCheck(current, values) {
  if (current !== 1 || blank(values.datum) || blank(values.tijdstip)) return null
  const moment = new Date(`${values.datum}T${values.tijdstip}:00`)
  return moment > new Date() ? { tijdstip: 'Dit tijdstip ligt in de toekomst' } : null
}

/** The sent report becomes a row of the register, at the top. */
function send(values) {
  form.saved()
  const [year, month, day] = values.datum.split('-')
  lastNumber += 1
  ROWS = [
    {
      id: reportId(lastNumber),
      title: values.titel,
      category: label(CATEGORY_OPTIONS, values.categorie),
      severity: label(SEVERITY_OPTIONS, values.ernst),
      status: 'Nieuw',
      owner: 'Niet toegewezen',
      date: `${day}-${month}-${year}`,
      note: '',
    },
    ...ROWS,
  ]
  uploads = []
  form = null
  toast(`Melding “${values.titel}” is verstuurd`)
  navigate(link(), { force: true })
}

function discard() {
  form?.discardDraft()
  uploads = []
}

/* --- The summary beside the form, and the review on step 3 -------------------------------- */

function personText(person) {
  const role = label(ROLES, person.rol)
  return person.naam ? `${person.naam} (${role?.toLowerCase()})` : null
}

function renderSummary() {
  if (!form) return
  const values = form.collect()
  const done = uploads.filter((row) => row.state === 'done')
  const named = people(values).filter((person) => !blank(person.naam))
  const summary = newPage.querySelector('[data-summary]')
  if (summary) {
    summary.items = [
      { label: 'Categorie', value: blank(values.categorie) ? null : label(CATEGORY_OPTIONS, values.categorie) },
      { label: 'Ernst', value: label(SEVERITY_OPTIONS, values.ernst) },
      { label: 'Datum', value: longDay(values.datum) },
      { label: 'Locatie', value: label(LOCATIONS, values.locatie) ?? 'Nog niet gekozen' },
      { label: 'Betrokkenen', value: named.length },
      { label: 'Bijlagen', value: done.length },
    ]
  }

  const at = (stap, field) => ({ href: formLink(stap, `#${field}`) })
  const melding = newPage.querySelector('[data-review=melding]')
  if (melding) {
    melding.items = [
      { label: 'Titel', value: values.titel, action: at(1, 'titel') },
      { label: 'Categorie', value: blank(values.categorie) ? null : label(CATEGORY_OPTIONS, values.categorie), action: at(1, 'categorie') },
      { label: 'Omschrijving', value: values.omschrijving, action: at(1, 'omschrijving') },
      {
        label: 'Datum en tijdstip',
        value: values.datum ? [longDay(values.datum), values.tijdstip && `om ${values.tijdstip}`].filter(Boolean).join(' ') : null,
        action: at(1, 'datum'),
      },
      { label: 'Locatie', value: label(LOCATIONS, values.locatie), action: at(1, 'locatie') },
      { label: 'Ernst', value: label(SEVERITY_OPTIONS, values.ernst), action: at(1, 'ernst') },
      { label: 'Betrokkenen', value: named.map(personText).join(', '), action: at(1, 'betrokkene-p1-naam') },
      { label: 'Bijlagen', value: done.map((row) => row.name).join(', '), action: at(1, 'bijlagen') },
    ]
  }
  const opvolging = newPage.querySelector('[data-review=opvolging]')
  if (opvolging) {
    opvolging.items = [
      { label: 'Opvolging', value: label(FOLLOW_UP, values.opvolging), action: at(2, 'opvolging') },
      { label: 'Team', value: blank(values.team) ? null : label(TEAMS, values.team), action: at(2, 'team') },
      { label: 'Uiterlijk afgehandeld op', value: longDay(values.deadline), action: at(2, 'deadline') },
      { label: 'Afspraken', value: values.afspraken, action: at(2, 'afspraken') },
      { label: 'Melder op de hoogte houden', value: values.informeren ? 'Ja' : 'Nee', action: at(2, 'informeren') },
    ]
  }
}

/** Shows the current step: the stepper, the step's fields and the action bar's words. */
function renderStep() {
  const current = step()
  const stepper = newPage.querySelector('lintje-stepper')
  stepper.steps = STEPS.map((name, index) => {
    const number = index + 1
    if (number < current) return { label: name, href: formLink(number), state: 'done' }
    return { label: name, state: number === current ? 'current' : 'next' }
  })
  for (const part of newPage.querySelectorAll('[data-step]')) part.hidden = Number(part.dataset.step) !== current
  newPage.querySelector('.page__aside').hidden = current === 3
  newPage.querySelector('[data-action=next]').textContent = current === 3 ? 'Versturen' : 'Volgende stap'
  renderSummary()

  // `?stap=1#locatie`: "Wijzigen" on the review points at the step and the field.
  const field = location.hash ? form.querySelector(`[name="${location.hash.slice(1)}"]`) : null
  if (field) {
    requestAnimationFrame(() => {
      field.scrollIntoView({ block: 'center' })
      const inner = field.shadowRoot?.querySelector('input, textarea, button, [tabindex]')
      inner?.focus()
    })
  }
}

/* --- The router: every element's `lintje-navigate`, and Back ------------------------------ */

let shown = ''

function render() {
  renderShell()
  const current = page()
  overview.hidden = exportMenu.hidden = newButton.hidden = current !== 'overzicht'
  newPage.hidden = current !== 'nieuw'
  pageHeader.data =
    current === 'nieuw'
      ? { title: 'Nieuwe melding', description: 'Registreer een melding in drie stappen. Je concept blijft bewaard tot je het verstuurt.' }
      : { title: 'Overzicht', description: 'Alle meldingen van het rijkskantoor. Open een melding via de titel, of pas een cel direct aan.' }
  if (current === 'overzicht') {
    if (shown === 'nieuw') {
      form = null
      newPage.replaceChildren()
    }
    shown = current
    renderDraft()
    renderTabs()
    renderTable()
  } else if (shown !== 'nieuw' || !form) {
    shown = current
    renderForm()
  } else renderStep()
}

/** Goes to `href`; leaving the form with unsaved input asks first. */
function navigate(href, { force = false } = {}) {
  const url = new URL(href, location.href)
  if (url.pathname !== location.pathname) {
    location.href = url.href
    return
  }
  const leaving = shown === 'nieuw' && url.searchParams.get('pagina') !== 'nieuw'
  if (leaving && !force && form?.dirty) return leaveForm(href)
  history.pushState(null, '', url.search ? `${url.search}${url.hash}` : `${url.pathname}${url.hash}`)
  render()
}

document.addEventListener('lintje-navigate', (event) => {
  event.preventDefault()
  if (event.detail?.href) navigate(event.detail.href)
})
window.addEventListener('popstate', render)
newButton.addEventListener('click', () => navigate(formLink()))

/* --- Leaving the form with unsaved input -------------------------------------------------- */

let target = ''

function leaveForm(href) {
  if (!form?.dirty) return navigate(href, { force: true })
  target = href
  leave.open = true
}

leave.addEventListener('lintje-close', () => (leave.open = false))
leave.addEventListener('lintje-confirm', () => {
  form.saveDraft()
  leave.open = false
  toast('Het concept is bewaard. Je vindt het bovenaan het overzicht.')
  navigate(target, { force: true })
})
leave.addEventListener('lintje-action', () => {
  discard()
  leave.open = false
  navigate(target, { force: true })
})

/* --- Search: one field over the register, behind the shell's button and "/" --------------- */

const RECENT = () => [{ label: 'Recent', items: ROWS.slice(0, 3).map(result) }]

function result(row) {
  return { id: row.id, label: row.title, meta: `${row.id} · ${row.status}` }
}

function answer(term) {
  const wanted = term.trim().toLowerCase()
  if (!wanted) return RECENT()
  const found = ROWS.filter((row) => row.title.toLowerCase().includes(wanted) || row.id.toLowerCase().includes(wanted))
  const groups = found.length ? [{ label: 'Meldingen', items: found.slice(0, 6).map(result) }] : []
  if ('nieuwe melding'.includes(wanted) || wanted.startsWith('nieuw')) {
    groups.push({ label: 'Acties', items: [{ id: 'nieuw', label: 'Nieuwe melding maken', href: formLink() }] })
  }
  return groups
}

search.groups = RECENT()
shell.addEventListener('lintje-search-open', () => (search.open = true))
search.addEventListener('lintje-open', () => (search.open = true))
search.addEventListener('lintje-close', () => (search.open = false))
search.addEventListener('lintje-search', (event) => {
  search.loading = true
  clearTimeout(search.timer)
  search.timer = setTimeout(() => {
    search.groups = answer(event.detail)
    search.loading = false
  }, 300)
})
search.addEventListener('lintje-action', (event) => {
  event.stopPropagation()
  openDrawer(event.detail)
})

/* --- Shortcuts: what this page adds, shown by "?" ----------------------------------------- */

shortcuts.addEventListener('lintje-open', () => (shortcuts.open = true))
shortcuts.addEventListener('lintje-close', () => (shortcuts.open = false))

const goTab = (value) => () => navigate(tabLink(value))
registerShortcut({ keys: '1', description: 'Naar Alle meldingen', handler: goTab('alle') })
registerShortcut({ keys: '2', description: 'Naar Open meldingen', handler: goTab('open') })
registerShortcut({ keys: '3', description: 'Naar Afgehandelde meldingen', handler: goTab('afgehandeld') })
registerShortcut({ keys: 'n', description: 'Nieuwe melding', handler: () => navigate(formLink()) })

/* --- Start, and the demo states ----------------------------------------------------------- */

/** The first rows the table shows, newest first. */
const firstIds = () =>
  ROWS.filter(tab().keep)
    .filter((row) => row.date === ROWS[0].date)
    .slice(0, 3)
    .map((row) => row.id)

if (demo() === 'selectie') view.checkedIds = firstIds()
if (demo() === 'fout') {
  const [row] = ROWS
  view.cellErrors = [{ id: row.id, column: 'owner', message: 'M. Smit is met verlof tot 14 oktober', value: 'M. Smit' }]
}
if (demo() === 'filters') {
  view.filters = { category: ['Veiligheid', 'Overlast'], title: 'bij' }
  view.hidden = ['id']
}
render()
if (demo() === 'lade') openDrawer(ROWS[2].id)
if (demo() === 'zoeken') {
  search.open = true
  search.query = 'gevonden'
  search.groups = answer('gevonden')
}
if (demo() === 'sneltoetsen') shortcuts.open = true
