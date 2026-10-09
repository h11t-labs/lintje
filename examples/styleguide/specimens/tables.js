// The tables category (Tabellen en lijsten): the specimens of its elements.
import { log } from '../shared.js'
import { desks, meta } from '../../_data/load.js'

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
  subtitle: 'De toelichting op één regel, de trend als pijltje',
  columns: [
    { key: 'name', header: 'Loket' },
    { key: 'note', header: 'Toelichting', truncate: true },
    { key: 'requests', header: 'Aanvragen', align: 'right', mobileMeasure: true },
    { key: 'change', header: 'Trend', align: 'right', format: 'change-compact' },
  ],
  rows: desks.slice(0, NOTES.length).map((point, index) => ({
    id: point.id,
    name: point.name,
    note: NOTES[index],
    requests: point.requests,
    change: point.change,
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
    const dialog = document.createElement('lintje-confirm-dialog')
    const count = event.detail.ids.length
    dialog.setAttribute('heading', `${count} ${count === 1 ? 'melding' : 'meldingen'} verwijderen?`)
    dialog.setAttribute('confirm-label', 'Verwijderen')
    dialog.textContent = 'De gekozen meldingen worden verwijderd. Dit kun je niet terugdraaien.'
    dialog.open = true
    const close = () => dialog.remove()
    dialog.addEventListener('lintje-close', close)
    dialog.addEventListener('lintje-confirm', () => {
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

const ACTIVITY = [
  {
    who: 'J. de Vries',
    what: 'wijzigde de omschrijving',
    when: 'vandaag om 10:42',
    at: '2026-10-04T10:42:00+02:00',
  },
  {
    who: 'Systeem',
    what: 'rondde het transcriberen af',
    when: 'vandaag om 09:31',
    at: '2026-10-04T09:31:00+02:00',
  },
  {
    who: 'M. Jansen',
    what: 'voegde 2 bijlagen toe',
    when: 'gisteren om 16:05',
    at: '2026-10-03T16:05:00+02:00',
  },
  {
    who: 'M. Jansen',
    what: 'maakte de melding aan',
    when: 'gisteren om 15:48',
    at: '2026-10-03T15:48:00+02:00',
  },
]

/** Twelve older entries, so "Toon eerdere" has something to show. */
const LONG_ACTIVITY = [
  ...ACTIVITY,
  ...Array.from({ length: 12 }, (_, index) => ({
    who: index % 2 ? 'A. Bakker' : 'Systeem',
    what: index % 2 ? 'bekeek de melding' : 'stuurde een herinnering',
    when: `${30 - index} september 2026, 16:05`,
    at: `2026-09-${String(30 - index).padStart(2, '0')}T16:05:00+02:00`,
  })),
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
      title: 'De tabel: dashboardtabel, kiesbaar, laden en fout, en als werkblad met bewerken, acties en filters, ook op een applicatiepagina',
      specimens: [
        {
          label: 'Het dashboard — drempels, statuskolom, klikbare rijen',
          html: '<lintje-data-table></lintje-data-table>',
          wide: true,
          setup: (stage) => dashboard(stage),
        },
        {
          label: 'Afgekapt en compact — een lange toelichting op één regel, de trend alleen als pijltje',
          html: '<lintje-data-table></lintje-data-table>',
          wide: true,
          setup: (stage) => dashboard(stage, compactData),
        },
        {
          label: 'Kiesbaar — loketten aanvinken om te vergelijken',
          html: '<lintje-data-table></lintje-data-table>',
          wide: true,
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
          label: 'Laden',
          html: '<lintje-data-table></lintje-data-table>',
          wide: true,
          setup: (stage) => table(stage, { ...tableData, title: 'Loketten', subtitle: 'Laden', state: 'loading', rows: [] }),
        },
        {
          label: 'Fout',
          html: '<lintje-data-table></lintje-data-table>',
          wide: true,
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
          label: 'Rust — bewerkbare cellen (Enter, F2 of dubbelklik)',
          html: '<lintje-data-table></lintje-data-table>',
          wide: true,
          setup: editable,
        },
        {
          label: 'Bezig — de wijziging wordt opgeslagen',
          html: '<lintje-data-table></lintje-data-table>',
          wide: true,
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
          label: 'Fout — de server weigert de waarde',
          html: '<lintje-data-table></lintje-data-table>',
          wide: true,
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
          label: 'Rust — de titel opent de rij, acties per rij',
          html: '<lintje-data-table></lintje-data-table>',
          wide: true,
          setup: (stage) => actions(stage),
        },
        {
          label: 'Telefoon — de andere kolommen van een rij open, het rijmenu en Sorteren',
          html: '<lintje-data-table></lintje-data-table>',
          wide: true,
          setup: (stage) => {
            actions(stage, { selectable: false })
            const element = stage.querySelector('lintje-data-table')
            void element.updateComplete.then(() =>
              element.shadowRoot.querySelector('.lintje-data-table__mobile-toggle')?.click(),
            )
          },
        },
        {
          label: 'Op een applicatiepagina — zonder tegel; de kop of tab van de pagina noemt de tabel',
          html: '<lintje-data-table plain></lintje-data-table>',
          wide: true,
          setup: (stage) => actions(stage, { title: undefined }),
        },
        {
          label: 'Selectiebalk — twee rijen gekozen, Shift+klik kiest een reeks',
          html: '<lintje-data-table></lintje-data-table>',
          wide: true,
          setup: (stage) => actions(stage, { checkedIds: ['m1', 'm3'] }),
        },
        {
          label: 'Uitgeschakeld — een rij die niet gekozen kan worden',
          html: '<lintje-data-table></lintje-data-table>',
          wide: true,
          setup: (stage) => actions(stage, { rows: rows().slice(0, 3), uncheckableIds: ['m3'], checkedIds: ['m1'] }),
        },
        {
          label: 'Rust — kolomfilters',
          html: '<lintje-data-table></lintje-data-table>',
          wide: true,
          setup: (stage) => filters(stage),
        },
        {
          label: 'Gefilterd — met de filters als chips',
          html: '<lintje-data-table></lintje-data-table>',
          wide: true,
          setup: (stage) => filters(stage, { filters: { category: ['Veiligheid', 'Overlast'] } }),
        },
        {
          label: 'Kolommen kiezen',
          html: '<lintje-data-table></lintje-data-table>',
          wide: true,
          setup: (stage) => filters(stage, { columnChooser: true, hiddenColumns: ['severity'] }),
        },
      ],
    },
{
      tag: 'lintje-pagination',
      title: 'Bladeren door pagina’s — ook onder de tabel',
      specimens: [
        {
          label: 'Rust, met de telling',
          wide: true,
          html: '<lintje-pagination page="2" page-count="7" total="131" page-size="20"></lintje-pagination>',
          setup: follow,
        },
        {
          label: 'Met eenheid en keuze per pagina',
          wide: true,
          html: '<lintje-pagination page="2" total="14" page-size="5" page-sizes="5, 10, 20" unit="documenten" unit-one="document"></lintje-pagination>',
          setup: follow,
        },
        {
          label: 'Alles op één pagina',
          wide: true,
          html: '<lintje-pagination page="1" total="14" page-size="20" page-sizes="5, 10, 20" unit="documenten" unit-one="document"></lintje-pagination>',
          setup: follow,
        },
        {
          label: 'Uitgeschakeld: de eerste pagina',
          html: '<lintje-pagination page="1" page-count="3"></lintje-pagination>',
          setup: follow,
        },
        {
          label: 'Huidige pagina, laatste',
          html: '<lintje-pagination page="3" page-count="3"></lintje-pagination>',
          setup: follow,
        },
        {
          label: 'Reeks met “…”',
          wide: true,
          html: '<lintje-pagination page="10" page-count="20" total="398" page-size="20"></lintje-pagination>',
          setup: follow,
        },
        {
          label: 'Als links (?pagina=…)',
          wide: true,
          html: '<lintje-pagination page="4" page-count="12" href-template="#pagina={page}"></lintje-pagination>',
          setup: follow,
        },
      ],
    },
    {
      tag: 'lintje-list',
      title: 'Rijen voor wat geen kolommen nodig heeft',
      specimens: [
        {
          label: 'Rust, hover toont de actie',
          wide: true,
          html: '<lintje-list label="Opnames"></lintje-list>',
          setup(stage) {
            const list = stage.querySelector('lintje-list')
            list.items = RECORDINGS
            list.addEventListener('lintje-row-click', (event) => (list.selectedId = event.detail.id))
          },
        },
        {
          label: 'Gekozen',
          wide: true,
          html: '<lintje-list label="Opnames" selected-id="r2"></lintje-list>',
          setup(stage) {
            const list = stage.querySelector('lintje-list')
            list.items = RECORDINGS
            list.addEventListener('lintje-row-click', (event) => (list.selectedId = event.detail.id))
          },
        },
        {
          label: 'Werklijst: soort, status als woord, voortgang, één zichtbare actie en groepen op moment',
          wide: true,
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
          label: 'Sprekers: een kleurbalk per rij, zoals in de speler en het transcript, met een menu',
          html: '<lintje-list label="Sprekers"></lintje-list>',
          setup(stage) {
            const actions = [
              { value: 'naam', label: 'Naam wijzigen' },
              { value: 'samenvoegen', label: 'Samenvoegen met…' },
              { value: 'alleen', label: 'Alleen deze spreker tonen', checked: false },
            ]
            stage.querySelector('lintje-list').items = [
              { id: 'p1', swatch: 'sky-blue', title: 'Ploegleider', sub: '5 fragmenten · 2:12', actions, clickable: false },
              { id: 'p2', swatch: 'dark-yellow', title: 'Spreker 2', sub: '3 fragmenten · 1:05', actions, clickable: false },
              { id: 'p3', swatch: 'pink', title: 'Spreker 3', sub: '3 fragmenten · 0:52', actions, clickable: false },
            ]
          },
        },
        {
          label: 'Hernoemen in de rij: het veld met opslaan en annuleren (rename)',
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
      columns: 3,
      title: 'Eén item uit een verzameling: een grijze regel, titel, tekst, status en hoogstens twee acties',
      specimens: [
        {
          label: 'Met schermafbeelding, status en acties',
          html: '<lintje-card></lintje-card>',
          setup(stage) {
            stage.querySelector('lintje-card').data = PRODUCTS[0]
            listen(stage)
          },
        },
        {
          label: 'Met logo naast de titel, zonder toegang',
          html: '<lintje-card></lintje-card>',
          setup(stage) {
            stage.querySelector('lintje-card').data = PRODUCTS[1]
            listen(stage)
          },
        },
        {
          label: 'Als link: de hele kaart, de titel is de tabstop',
          html: '<lintje-card></lintje-card>',
          setup(stage) {
            stage.querySelector('lintje-card').data = KINDS[0]
            listen(stage)
          },
        },
        {
          label: 'Icoonactie als favoriet: een hartje, aan en uit',
          wide: true,
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
          label: 'Twee icoonacties: vastzetten (aan en uit) en delen',
          wide: true,
          html: '<div class="guide__pair"><lintje-card></lintje-card><lintje-card></lintje-card></div>',
          setup(stage) {
            const pinAndShare = (pressed) => [
              { value: 'vastzetten', label: 'Vastzetten', icon: 'kantoor-label-outline', iconPressed: 'kantoor-label', pressed },
              { value: 'delen', label: 'Delen', icon: 'functioneel-delen' },
            ]
            const [first, second] = stage.querySelectorAll('lintje-card')
            first.data = { ...KINDS[0], iconActions: pinAndShare(true) }
            second.data = { ...KINDS[1], iconActions: pinAndShare(false) }
            hostIconActions(stage)
          },
        },
        {
          label: 'Horizontaal: het beeld in een kolom links (onder 768 px rechtop)',
          wide: true,
          html: '<div class="guide__pair"><lintje-card layout="horizontal"></lintje-card><lintje-card layout="horizontal"></lintje-card></div>',
          setup(stage) {
            const [first, second] = stage.querySelectorAll('lintje-card')
            first.data = PRODUCTS[0]
            second.data = PRODUCTS[1]
            listen(stage)
          },
        },
        {
          label: 'Met een tabelletje met gegevens (facts); een ontbrekende waarde is een streep',
          html: '<lintje-card></lintje-card>',
          setup(stage) {
            stage.querySelector('lintje-card').data = PRODUCTS[2]
            listen(stage)
          },
        },
        {
          label: 'Compact: grijze regel, titel, status en één actie',
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
      title: 'Een verzameling als kaarten: hoogstens drie naast elkaar, elke rij even hoog',
      specimens: [
        {
          label: 'Producten met acties',
          wide: true,
          html: '<lintje-card-list label="Producten"></lintje-card-list>',
          setup(stage) {
            stage.querySelector('lintje-card-list').items = PRODUCTS
            listen(stage)
          },
        },
        {
          label: 'Horizontaal, voor een lange lijst: twee naast elkaar',
          wide: true,
          html: '<lintje-card-list label="Producten" layout="horizontal"></lintje-card-list>',
          setup(stage) {
            stage.querySelector('lintje-card-list').items = PRODUCTS
            listen(stage)
          },
        },
        {
          label: 'Als links',
          wide: true,
          html: '<lintje-card-list label="Bladeren per soort"></lintje-card-list>',
          setup(stage) {
            stage.querySelector('lintje-card-list').items = KINDS
            listen(stage)
          },
        },
        {
          label: 'Laden',
          wide: true,
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
      title: 'Label-waardeparen voor een detail of controlescherm',
      specimens: [
        {
          label: 'Rust, lege waarde, wijzigen',
          wide: true,
          html: '<lintje-description-list></lintje-description-list>',
          setup(stage) {
            stage.querySelector('lintje-description-list').items = DETAILS
          },
        },
        {
          label: 'Kolom: label boven de waarde (smalle houder)',
          html: '<lintje-description-list layout="column"></lintje-description-list>',
          setup(stage) {
            stage.querySelector('lintje-description-list').items = DETAILS
          },
        },
        {
          label: 'Vakken (layout="grid"): breed, aangepast, waarschuwing met inhoud in een slot, labels',
          wide: true,
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
          label: 'In het raster: span 8 en span 4',
          wide: true,
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
          label: 'Rust, gekozen, open, dicht',
          html: '<lintje-tree-view label="Locaties" name="locatie" selected-id="v2"></lintje-tree-view>',
          setup(stage) {
            const tree = stage.querySelector('lintje-tree-view')
            tree.nodes = structuredClone(UNITS)
            tree.expanded = ['dh', 'verdiepingen']
            lazyArrivals(tree)
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
          label: 'Rust, opgepakt met spatie',
          html: '<lintje-sortable-list label="Volgorde van de kolommen" name="kolommen"></lintje-sortable-list>',
          setup(stage) {
            stage.querySelector('lintje-sortable-list').items = COLUMNS.map(({ id, label }) => ({
              id,
              label,
            }))
          },
        },
        {
          label: 'Met vinkjes: de kolomkiezer',
          html: '<lintje-sortable-list label="Kolommen" checkable></lintje-sortable-list>',
          setup(stage) {
            stage.querySelector('lintje-sortable-list').items = COLUMNS
          },
        },
      ],
    },
    {
      tag: 'lintje-activity-log',
      title: 'Een tijdlijn van wat er met een item is gebeurd',
      specimens: [
        {
          label: 'Rust, tijd',
          html: '<lintje-activity-log heading="Geschiedenis"></lintje-activity-log>',
          setup(stage) {
            stage.querySelector('lintje-activity-log').entries = ACTIVITY
          },
        },
        {
          label: 'Meer: toon eerdere',
          html: '<lintje-activity-log heading="Geschiedenis"></lintje-activity-log>',
          setup(stage) {
            stage.querySelector('lintje-activity-log').entries = LONG_ACTIVITY
          },
        },
      ],
    },
  ],
}
