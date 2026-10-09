// The frame category (Paginakader): the specimens of its elements.
import { meta } from '../../_data/load.js'
import * as lintje from '../../../dist-elements/lintje.js'

/** The navigation bar's own surface, so a part that lives there is seen on it. */
const BAR = 'display: inline-flex; align-items: center; height: 48px; padding: 0 2px; background: var(--color-nav-bg); color: var(--color-nav-text)'

const USER = { name: 'J. de Vries', role: 'Teamleider · Dienst Vergunningen', initials: 'JV' }

const USER_MENU = [
  { value: 'weergave', label: 'Weergave' },
  { value: 'sneltoetsen', label: 'Sneltoetsen', hint: '?' },
  { value: 'feedback', label: 'Vragen of feedback', href: '#el-user-menu' },
]

const NOTIFICATIONS = [
  {
    id: 'n1',
    title: 'Transcriptie klaar',
    text: 'Teamoverleg 2 oktober.m4a',
    when: '2 minuten geleden',
    href: '#el-notifications',
    unread: true,
  },
  {
    id: 'n2',
    title: 'Vertaling mislukt',
    text: 'Brief gemeente.pdf · het bestand is beveiligd',
    when: '14 minuten geleden',
    href: '#el-notifications',
    unread: true,
  },
  { id: 'n3', title: 'Export klaar', text: 'Teamoverleg 30 september.docx', when: 'gisteren om 16:05' },
]

const NAVIGATION = [
  { label: 'Opnames', href: '#opnames', active: true },
  { label: 'Wachtrij', href: '#wachtrij' },
  { label: 'Woordenlijst', href: '#woordenlijst' },
]

/** The same application with a group: "Beheer" opens a submenu with its pages. */
const GROUPED = [
  { label: 'Opnames', href: '#opnames' },
  { label: 'Wachtrij', href: '#wachtrij' },
  {
    label: 'Beheer',
    links: [
      { label: 'Woordenlijst', href: '#woordenlijst', icon: 'op-kantoor-boek', active: true },
      { label: 'Sjablonen', href: '#sjablonen', icon: 'op-kantoor-document-blanco', badge: { value: 'Nieuw', tone: 'new' } },
      { label: 'Instellingen', href: '#instellingen', icon: 'functioneel-instellingen', badge: { value: 3, tone: 'action' } },
    ],
  },
]

/** The emblem of the page's theme, with the organisation's name beside it as text. */
const EMBLEM_LABELS = {
  marechaussee: 'Koninklijke Marechaussee',
  landmacht: 'Koninklijke Landmacht',
  marine: 'Koninklijke Marine',
  luchtmacht: 'Koninklijke Luchtmacht',
  defensie: 'Ministerie van Defensie',
}

function emblem() {
  const theme = document.documentElement.dataset.theme
  const label = EMBLEM_LABELS[theme]
  return label
    ? { name: `embleem-${theme}`, label }
    : { name: 'embleem-rijksoverheid', label: 'Rijksoverheid' }
}

/** What the host's one search endpoint would know. */
const INDEX = [
  { kind: 'Opnames', id: 'o-481', label: 'Teamoverleg 2 oktober', meta: '47:12', href: '#el-app-search' },
  { kind: 'Opnames', id: 'o-470', label: 'Teamoverleg 30 september', meta: '39:05', href: '#el-app-search' },
  { kind: 'Opnames', id: 'o-455', label: 'Overdracht nachtdienst', meta: '12:40', href: '#el-app-search' },
  { kind: 'Woordenlijst', id: 'w-12', label: 'Verblijfsvergunning', meta: 'residence permit', href: '#el-app-search' },
  { kind: 'Acties', id: 'upload', label: 'Nieuwe opname uploaden' },
]

const RECENT = [{ label: 'Recent', items: INDEX.slice(0, 3).map(({ kind: _kind, ...item }) => item) }]

/** The host's half of a search: 400 ms of "server", then the matches per kind. */
function answer(term) {
  const wanted = term.trim().toLowerCase()
  if (!wanted) return RECENT
  const groups = new Map()
  for (const { kind, ...item } of INDEX) {
    if (!item.label.toLowerCase().includes(wanted)) continue
    if (!groups.has(kind)) groups.set(kind, [])
    groups.get(kind).push(item)
  }
  return [...groups].map(([label, items]) => ({ label, items }))
}

function wireSearch(search) {
  search.groups = RECENT
  // `/` is the guide's own search; a specimen opens with its button.
  search.addEventListener('lintje-close', () => (search.open = false))
  search.addEventListener('lintje-search', (event) => {
    search.loading = true
    clearTimeout(search._demoTimer)
    search._demoTimer = setTimeout(() => {
      search.groups = answer(event.detail)
      search.loading = false
    }, 400)
  })
}

/** Two demo shortcuts, registered once for the page (the style guide draws every specimen twice). */
let demoKeys = false

function registerDemoKeys() {
  if (demoKeys) return
  demoKeys = true
  const register = lintje.registerShortcut
  register?.({ keys: 'Ctrl+S', description: 'Opslaan', handler: () => {}, inFields: true })
  register?.({ keys: 'ArrowLeft', description: '5 seconden terug', handler: () => {} })
}

function wireSession(session) {
  session.addEventListener('lintje-session-extend', () => {
    session.busy = true
    setTimeout(() => {
      session.busy = false
      session.setAttribute('expires-at', new Date(Date.now() + 30 * 60_000).toISOString())
    }, 1200)
  })
  for (const name of ['lintje-logout', 'lintje-login']) {
    session.addEventListener(name, () => {
      session.removeAttribute('expires-at')
      session.removeAttribute('expired')
    })
  }
}

const CRUMBS = [
  { label: 'Opnames', href: '#opnames' },
  { label: 'Oktober 2026', href: '#oktober' },
  { label: 'Teamoverleg 2 oktober' },
]

const LONG_CRUMBS = [
  { label: 'Opnames', href: '#opnames' },
  { label: '2026', href: '#2026' },
  { label: 'Oktober', href: '#oktober' },
  { label: 'Week 40', href: '#week-40' },
  { label: 'Teamoverleg 2 oktober' },
]

function crumbs(stage, items) {
  const element = stage.querySelector('lintje-breadcrumbs')
  element.items = items
  element.addEventListener('lintje-navigate', (event) => {
    event.preventDefault()
    event.stopPropagation()
  })
}

const SUB_NAV = [
  { label: 'Voor al je opnames', items: [{ label: 'Algemeen', href: '#algemeen', active: true }] },
  {
    label: 'Soorten gesprek',
    items: [
      { label: 'Vergadering', href: '#vergadering' },
      { label: 'Hoorzitting', href: '#hoorzitting' },
      { label: 'Briefing', href: '#briefing' },
      { label: 'Interview', href: '#interview' },
      { label: 'Dictaat', href: '#dictaat' },
    ],
  },
]

const SUB_NAV_KINDS = [
  { items: [{ label: 'Overzicht', href: '#overzicht', icon: 'functioneel-tegelweergave', active: true }] },
  {
    items: [
      {
        label: 'Berichten van je behandelaar en de organisatie',
        href: '#berichten',
        icon: 'functioneel-mail',
        badge: { value: 2, label: '2 ongelezen' },
      },
      { label: 'Instellingen', href: '#instellingen', icon: 'functioneel-instellingen' },
      { label: 'Archief', href: '#archief', icon: 'op-kantoor-lade-archiefkast', noAccess: true },
      { label: 'Rapportages', icon: 'op-kantoor-grafiek' },
    ],
  },
]

const SUB_NAV_NESTED = [
  {
    items: [
      { label: 'Algemeen', href: '#algemeen' },
      {
        label: 'Soorten gesprek',
        href: '#soorten',
        items: [
          { label: 'Vergadering', href: '#vergadering' },
          { label: 'Hoorzitting', href: '#hoorzitting', active: true },
          { label: 'Briefing', href: '#briefing' },
        ],
      },
      { label: 'Woordenlijsten', href: '#woordenlijsten' },
    ],
  },
]

/** The host holds the reader's page: a click makes the chosen entry the active one. */
function subNav(stage, groups, action) {
  const element = stage.querySelector('lintje-sub-nav')
  element.style.maxWidth = '288px'
  element.label = 'Instellingen'
  element.groups = groups
  element.action = action
  const mark = (items, href) =>
    items.map((item) => ({
      ...item,
      active: item.href === href,
      ...(item.items ? { items: mark(item.items, href) } : {}),
    }))
  element.addEventListener('lintje-navigate', (event) => {
    event.preventDefault()
    event.stopPropagation()
    element.groups = element.groups.map((group) => ({ ...group, items: mark(group.items, event.detail.href) }))
  })
  element.addEventListener('lintje-action', (event) => event.stopPropagation())
}

export default {
  elements: [
{
      tag: 'lintje-shell',
      title: 'De schil om een pagina: het menu erboven of ernaast, de naam als h1, paginakop en inhoud',
      specimens: [
        {
          label: 'Het menu naast de pagina: de schil om deze pagina',
          wide: true,
          html: '<lintje-prose></lintje-prose>',
          setup(stage) {
            stage.querySelector('lintje-prose').html = `
              <p>Met <code>layout: 'side'</code> staat het menu naast de pagina, vast of als smalle balk, met boven de pagina een balk met de naam, “Weergave” en “Delen”. Die schil staat om deze stijlgids zelf; “Weergave” zet het menu ook boven de pagina.</p>
              <p>Met een filterbalk en een menu met cijfers zie je het in <a href="../dashboard/">het dashboard-voorbeeld</a>.</p>`
          },
        },
        {
          label: 'Rust, actieve pagina, rechts in de balk',
          wide: true,
          html: `<lintje-shell>
            <lintje-page-header slot="header">
              <lintje-breadcrumbs slot="breadcrumbs"></lintje-breadcrumbs>
              <lintje-button slot="actions" variant="primary">Opslaan</lintje-button>
            </lintje-page-header>
            <p>Hier staat de inhoud van de app, hoogstens 1360 px breed.</p>
          </lintje-shell>`,
          setup(stage) {
            const shell = stage.querySelector('lintje-shell')
            // Room for the open user menu: below the stage the next shell's logo bar covers it.
            shell.style.minHeight = '496px'
            const data = {
              name: 'Transcriptie',
              emblem: emblem(),
              navigation: NAVIGATION,
              user: USER,
              userMenu: USER_MENU,
              version: '2.4.1',
              search: true,
              notifications: NOTIFICATIONS,
            }
            shell.data = data
            stage.querySelector('lintje-page-header').data = {
              title: 'Teamoverleg 2 oktober',
              description: '4:12 · 3 sprekers · geüpload vandaag om 09:14',
            }
            const crumbs = stage.querySelector('lintje-breadcrumbs')
            crumbs.items = [{ label: 'Opnames', href: '#opnames' }, { label: 'Teamoverleg 2 oktober' }]
            // The host decides: the clicked page becomes the active one.
            shell.addEventListener('lintje-navigate', (event) => {
              event.preventDefault()
              shell.data = {
                ...data,
                navigation: NAVIGATION.map((link) => ({ ...link, active: link.href === event.detail.href })),
              }
            })
          },
        },
        {
          label: 'Groep met submenu (klik of wijs aan) en de omgeving buiten productie',
          wide: true,
          html: `<lintje-shell>
            <lintje-page-header slot="header"></lintje-page-header>
            <p>Het submenu ligt over de pagina; Escape of een klik hierbuiten sluit het.</p>
          </lintje-shell>`,
          setup(stage) {
            const shell = stage.querySelector('lintje-shell')
            shell.style.minHeight = '496px'
            const data = {
              name: 'Transcriptie',
              emblem: emblem(),
              environment: 'Acceptatie',
              navigation: GROUPED,
              user: USER,
              userMenu: USER_MENU,
              version: '2.4.1',
            }
            shell.data = data
            stage.querySelector('lintje-page-header').data = { title: 'Woordenlijst' }
            const mark = (entry, href) =>
              entry.links
                ? { ...entry, links: entry.links.map((link) => mark(link, href)) }
                : { ...entry, active: entry.href === href }
            shell.addEventListener('lintje-navigate', (event) => {
              event.preventDefault()
              shell.data = { ...data, navigation: GROUPED.map((entry) => mark(entry, event.detail.href)) }
            })
          },
        },
        {
          label: 'Met “Weergave” en “Delen”: de instellingen van de lezer, bij de host',
          wide: true,
          html: `<lintje-shell>
            <lintje-page-header slot="header"></lintje-page-header>
            <p>Een keuze in “Weergave” stuurt <code>lintje-view-change</code>; de host bewaart hem en geeft hem terug in <code>view</code>.</p>
          </lintje-shell>`,
          setup(stage) {
            const shell = stage.querySelector('lintje-shell')
            shell.style.minHeight = '420px'
            const data = {
              name: 'Transcriptie',
              emblem: emblem(),
              navigation: NAVIGATION,
              view: { mode: 'system' },
              share: true,
              user: USER,
            }
            shell.data = data
            stage.querySelector('lintje-page-header').data = { title: 'Opnames' }
            // The host holds the setting; here it only marks the choice, the page keeps its own mode.
            shell.addEventListener('lintje-view-change', (event) => {
              shell.data = { ...shell.data, view: { ...shell.data.view, ...event.detail } }
            })
          },
        },
        {
          label: 'Met een hero in het slot full: van rand tot rand, de inhoud in de kolom',
          wide: true,
          html: `<lintje-shell>
            <lintje-hero slot="full" heading="Wat wil je vertalen?" description="Typ een tekst, upload een document of voer een live gesprek."></lintje-hero>
            <p>De inhoud staat onder de hero, in de kolom van hoogstens 1360 px.</p>
          </lintje-shell>`,
          setup(stage) {
            const shell = stage.querySelector('lintje-shell')
            shell.style.minHeight = '0'
            shell.data = { name: 'Vertalen', emblem: emblem(), navigation: [], user: USER, userMenu: USER_MENU }
          },
        },
        {
          label: 'Zonder zoeken, meldingen en gebruiker; een lange naam wordt afgekapt',
          wide: true,
          html: '<lintje-shell><p>Een app zonder de onderdelen rechts in de balk.</p></lintje-shell>',
          setup(stage) {
            const shell = stage.querySelector('lintje-shell')
            shell.style.minHeight = '0'
            shell.data = { name: 'Registratie en afhandeling van meldingen in de openbare ruimte', navigation: NAVIGATION }
          },
        },
      ],
    },
{
      tag: 'lintje-page-header',
      title: 'Kop van een pagina: titel, toelichting, peilmoment en bron, kruimelpad en acties',
      specimens: [
        {
          label: 'Met toelichting en meer-link',
          html: '<lintje-page-header></lintje-page-header>',
          wide: true,
          setup: (stage) => {
            stage.querySelector('lintje-page-header').data = {
              kicker: 'Dashboard Vergunningen',
              title: 'Overzicht',
              description: 'Aanvragen, wachttijden en afwijzingen bij de loketten, per regio en loket.',
              asOf: `${meta.as_of.date} ${meta.as_of.time}`,
              source: meta.as_of.source,
              more: { href: '#uitleg' },
            }
          },
        },
        {
          label: 'Met een potlood bij de titel (editable): naam wijzigen bij aanwijzen of focus',
          html: '<lintje-page-header editable></lintje-page-header>',
          wide: true,
          setup: (stage) => {
            stage.querySelector('lintje-page-header').data = { title: 'Teamoverleg 2 oktober', description: 'Vergadering · 4:12 · 3 sprekers' }
          },
        },
        {
          label: 'Met kruimelpad en acties (in de app-schil staat de kop zonder vlak)',
          html: `<lintje-page-header>
            <lintje-breadcrumbs slot="breadcrumbs"></lintje-breadcrumbs>
            <lintje-button slot="actions" variant="secondary">Exporteren</lintje-button>
            <lintje-button slot="actions" variant="primary">Opslaan</lintje-button>
          </lintje-page-header>`,
          wide: true,
          setup: (stage) => {
            stage.querySelector('lintje-breadcrumbs').items = [
              { label: 'Opnames', href: '#opnames' },
              { label: 'Teamoverleg 2 oktober' },
            ]
            stage.querySelector('lintje-page-header').data = {
              title: 'Teamoverleg 2 oktober',
              description: '4:12 · 3 sprekers · geüpload vandaag om 09:14',
            }
          },
        },
      ],
    },
    {
      tag: 'lintje-breadcrumbs',
      title: 'Het kruimelpad, los van de paginakop',
      specimens: [
        {
          label: 'Rust, hover, focus',
          html: '<lintje-breadcrumbs></lintje-breadcrumbs>',
          setup: (stage) => crumbs(stage, CRUMBS),
        },
        {
          label: 'Ingekort bij meer dan vier niveaus',
          html: '<lintje-breadcrumbs></lintje-breadcrumbs>',
          setup: (stage) => crumbs(stage, LONG_CRUMBS),
        },
      ],
    },
    {
      tag: 'lintje-sub-nav',
      title: 'Het submenu naast de inhoud, onder 768 px één knop die de lijst openklapt',
      specimens: [
        {
          label: 'Groepen met een label, de huidige pagina en een actie',
          html: '<lintje-sub-nav></lintje-sub-nav>',
          setup: (stage) => subNav(stage, SUB_NAV, { label: 'Nieuw soort gesprek', value: 'nieuw' }),
        },
        {
          label: 'Icoon, teller, lange tekst, geen toegang en geen pagina',
          html: '<lintje-sub-nav></lintje-sub-nav>',
          setup: (stage) => subNav(stage, SUB_NAV_KINDS),
        },
        {
          label: 'Tweede laag, open op het pad van de huidige pagina',
          html: '<lintje-sub-nav></lintje-sub-nav>',
          setup: (stage) => subNav(stage, SUB_NAV_NESTED),
        },
      ],
    },
    {
      tag: 'lintje-hero',
      title: 'De openingsband van een startpagina: grote titel, inleiding en één weg verder',
      specimens: [
        {
          label: 'Rust: titel, inleiding en een link verder',
          wide: true,
          html: `<lintje-hero heading="Wat wil je vertalen?" description="Typ of spreek een tekst in, upload een document, of voer een gesprek dat live wordt vertaald." action="Of start een live gesprek" href="#live"></lintje-hero>`,
          setup(stage) {
            stage.querySelector('lintje-hero').addEventListener('lintje-navigate', (event) => event.preventDefault())
          },
        },
        {
          label: 'Een opname die loopt: de status boven de titel, wat er gezegd wordt ernaast (slots status en panel)',
          wide: true,
          html: `<lintje-hero heading="Weekendbezetting en sleutels" description="Op je telefoon · Vergadering · gestart om 14:02">
            <lintje-badge slot="status" tone="live">Neemt op</lintje-badge>
            <lintje-recording-status elapsed="724" level="0.6" connection="good" delay="1"></lintje-recording-status>
            <lintje-button variant="primary">Meelezen</lintje-button>
            <lintje-tile slot="panel" heading="Wat er nu gezegd wordt"><p>Die haal ik vrijdag op, dan liggen ze zaterdag klaar.</p></lintje-tile>
          </lintje-hero>`,
        },
        {
          label: 'Met een beeld naast de tekst (slot aside); onder 1024 px valt het weg',
          wide: true,
          html: `<lintje-hero heading="Wat zoek je?" description="Stel je vraag in gewone taal. De catalogus zoekt in alle producten, ook die waar je nog geen toegang toe hebt." action="Of blader door de hele catalogus" href="#catalogus">
            <lintje-icon slot="aside" name="communicatie-tekstballonnen-met-vraagteken" size="160"></lintje-icon>
          </lintje-hero>`,
          setup(stage) {
            stage.querySelector('lintje-hero').addEventListener('lintje-navigate', (event) => event.preventDefault())
          },
        },
        {
          label: 'Met grote tabs half over de onderrand (slot overlap)',
          wide: true,
          html: `<lintje-hero heading="Wat wil je vertalen?" description="Je ziet de vertaling meteen.">
            <lintje-tabs slot="overlap" variant="panel" label="Wat wil je vertalen?">
              <p slot="tekst">Het tekstvak en de vertaling.</p>
              <p slot="document">Sleep een document hierheen.</p>
              <p slot="live">Druk op de knop van je taal.</p>
            </lintje-tabs>
          </lintje-hero>`,
          setup(stage) {
            const element = stage.querySelector('lintje-tabs')
            element.tabs = [
              { value: 'tekst', label: 'Tekst', icon: 'communicatie-tekstballon-met-potlood', hint: 'Typ, plak of spreek in' },
              { value: 'document', label: 'Document', icon: 'op-kantoor-document-blanco', hint: 'PDF, Word of tekst' },
              { value: 'live', label: 'Live gesprek', icon: 'beeld-en-geluid-microfoon', hint: 'Praat met elkaar', badge: 'Nieuw' },
            ]
            element.addEventListener('lintje-tab-change', (event) => (element.value = event.detail))
          },
        },
      ],
    },
    {
      tag: 'lintje-footer',
      title: 'De voet van een site of applicatie: wat het is, kolommen met links en de vaste links',
      specimens: [
        {
          label: 'Met regel, kolommen en vaste links',
          wide: true,
          html: '<lintje-footer></lintje-footer>',
          setup(stage) {
            const footer = stage.querySelector('lintje-footer')
            footer.data = {
              tagline: 'Datacatalogus — het dataplatform van de organisatie',
              columns: [
                { heading: 'Catalogus', links: [{ label: 'Dataproducten', href: '#el-footer' }, { label: 'AI-diensten', href: '#el-footer' }, { label: 'Dashboards', href: '#el-footer' }] },
                { heading: 'Over het platform', links: [{ label: 'Wat is het dataplatform?', href: '#el-footer' }, { label: 'Een product aanmelden', href: '#el-footer' }] },
                { heading: 'Hulp', links: [{ label: 'Contact', href: '#el-footer' }, { label: 'Storingen', href: '#el-footer' }] },
              ],
              links: [{ label: 'Privacy', href: '#el-footer' }, { label: 'Toegankelijkheid', href: '#el-footer' }, { label: 'Cookies', href: '#el-footer' }],
              note: 'Versie 1.0.0',
            }
            footer.addEventListener('lintje-navigate', (event) => event.preventDefault())
          },
        },
        {
          label: 'Alleen de vaste links',
          wide: true,
          html: '<lintje-footer></lintje-footer>',
          setup(stage) {
            const footer = stage.querySelector('lintje-footer')
            footer.data = { links: [{ label: 'Privacy', href: '#el-footer' }, { label: 'Toegankelijkheid', href: '#el-footer' }] }
            footer.addEventListener('lintje-navigate', (event) => event.preventDefault())
          },
        },
      ],
    },
    {
      tag: 'lintje-user-menu',
      title: 'De avatar met het menu van de gebruiker',
      specimens: [
        {
          label: 'Rust, menu (klik)',
          html: `<span style="${BAR}"><lintje-user-menu version="2.4.1"></lintje-user-menu></span>`,
          setup(stage) {
            const menu = stage.querySelector('lintje-user-menu')
            menu.user = USER
            menu.items = USER_MENU
          },
        },
        {
          label: 'Afmelden als formulier',
          html: `<span style="${BAR}"><lintje-user-menu version="2.4.1" logout-action="#el-user-menu" csrf="demo-token"></lintje-user-menu></span>`,
          setup(stage) {
            const menu = stage.querySelector('lintje-user-menu')
            menu.user = USER
            menu.items = USER_MENU
          },
        },
        {
          label: 'Telefoon: onderaan de mobiele navigatie',
          html: `<div style="background: var(--color-nav-bg); max-width: 360px"><lintje-user-menu inline version="2.4.1"></lintje-user-menu></div>`,
          setup(stage) {
            const menu = stage.querySelector('lintje-user-menu')
            menu.user = USER
            menu.items = USER_MENU
          },
        },
      ],
    },
    {
      tag: 'lintje-app-search',
      title: 'Eén zoekveld over alles in de app',
      specimens: [
        {
          label: 'Rust, gekozen met de pijltjes (of druk /)',
          html: '<lintje-button variant="secondary" data-open>Zoeken openen</lintje-button><lintje-app-search label="Zoeken in Transcriptie"></lintje-app-search>',
          setup(stage) {
            const search = stage.querySelector('lintje-app-search')
            wireSearch(search)
            stage.querySelector('[data-open]').addEventListener('click', () => (search.open = true))
          },
        },
        {
          label: 'Bezig',
          html: '<lintje-button variant="secondary" data-open>Zoeken terwijl de server antwoordt</lintje-button><lintje-app-search label="Zoeken in Transcriptie"></lintje-app-search>',
          setup(stage) {
            const search = stage.querySelector('lintje-app-search')
            search.addEventListener('lintje-close', () => (search.open = false))
            stage.querySelector('[data-open]').addEventListener('click', () => {
              search.query = 'team'
              search.loading = true
              search.open = true
            })
          },
        },
        {
          label: 'Geen resultaat',
          html: '<lintje-button variant="secondary" data-open>Zoeken zonder resultaat</lintje-button><lintje-app-search label="Zoeken in Transcriptie"></lintje-app-search>',
          setup(stage) {
            const search = stage.querySelector('lintje-app-search')
            search.addEventListener('lintje-close', () => (search.open = false))
            stage.querySelector('[data-open]').addEventListener('click', () => {
              search.query = 'teamoverlg'
              search.groups = []
              search.open = true
            })
          },
        },
      ],
    },
    {
      tag: 'lintje-notifications',
      title: 'Wat klaar is of aandacht vraagt',
      specimens: [
        {
          label: 'Rust, paneel, ongelezen (klik)',
          html: `<span style="${BAR}"><lintje-notifications></lintje-notifications></span>`,
          setup(stage) {
            const bell = stage.querySelector('lintje-notifications')
            bell.items = NOTIFICATIONS
            bell.addEventListener('lintje-notifications-read', () => {
              bell.items = bell.items.map((item) => ({ ...item, unread: false }))
            })
            bell.addEventListener('lintje-notification-open', (event) => {
              event.preventDefault()
              bell.items = bell.items.map((item) => (item.id === event.detail.id ? { ...item, unread: false } : item))
            })
          },
        },
        {
          // The first one pops in; every figure after it rises in where the last one stood.
          label: 'Erbij (klik op +)',
          html: `<span style="display: inline-flex; align-items: center; gap: var(--space-3)">
              <span style="${BAR}"><lintje-notifications></lintje-notifications></span>
              <lintje-button variant="secondary" icon="functioneel-plus">Melding</lintje-button>
            </span>`,
          setup(stage) {
            const bell = stage.querySelector('lintje-notifications')
            bell.items = []
            stage.querySelector('lintje-button').addEventListener('click', () => {
              const n = bell.items.length + 1
              bell.items = [{ id: `e${n}`, title: `Export ${n} klaar`, when: 'zojuist', unread: true }, ...bell.items]
            })
            bell.addEventListener('lintje-notifications-read', () => (bell.items = []))
          },
        },
        {
          label: 'Meer dan negen',
          html: `<span style="${BAR}"><lintje-notifications></lintje-notifications></span>`,
          setup(stage) {
            stage.querySelector('lintje-notifications').items = Array.from({ length: 12 }, (_, index) => ({
              id: `m${index}`,
              title: `Export ${index + 1} klaar`,
              when: `${index + 1} minuten geleden`,
              unread: true,
            }))
          },
        },
        {
          label: 'Eigen maximum (max="99")',
          html: `<span style="${BAR}"><lintje-notifications max="99"></lintje-notifications></span>`,
          setup(stage) {
            stage.querySelector('lintje-notifications').items = Array.from({ length: 120 }, (_, index) => ({
              id: `p${index}`,
              title: `Export ${index + 1} klaar`,
              when: `${index + 1} minuten geleden`,
              unread: true,
            }))
          },
        },
        {
          label: 'Leeg',
          html: `<span style="${BAR}"><lintje-notifications></lintje-notifications></span>`,
          setup(stage) {
            stage.querySelector('lintje-notifications').items = []
          },
        },
      ],
    },
    {
      tag: 'lintje-shortcuts',
      title: 'Het overzicht van de sneltoetsen op deze pagina',
      specimens: [
        {
          label: 'Rust (of druk ?)',
          html: '<lintje-button variant="secondary" data-open aria-keyshortcuts="?">Sneltoetsen</lintje-button><lintje-shortcuts></lintje-shortcuts>',
          setup(stage) {
            const shortcuts = stage.querySelector('lintje-shortcuts')
            registerDemoKeys()
            shortcuts.addEventListener('lintje-open', () => (shortcuts.open = true))
            shortcuts.addEventListener('lintje-close', () => (shortcuts.open = false))
            stage.querySelector('[data-open]').addEventListener('click', () => (shortcuts.open = true))
          },
        },
      ],
    },
    {
      tag: 'lintje-session-expiry',
      title: 'Waarschuwen voordat de sessie verloopt, en het concept terugzetten',
      specimens: [
        {
          label: 'Vooraf, bezig',
          html: '<lintje-button variant="secondary" data-open>Sessie verloopt over 2 minuten</lintje-button><lintje-session-expiry></lintje-session-expiry>',
          setup(stage) {
            const session = stage.querySelector('lintje-session-expiry')
            wireSession(session)
            stage.querySelector('[data-open]').addEventListener('click', () =>
              session.setAttribute('expires-at', new Date(Date.now() + 2 * 60_000).toISOString()),
            )
          },
        },
        {
          label: 'Fout: afgemeld',
          html: '<lintje-button variant="secondary" data-open>Verlengen mislukt</lintje-button><lintje-session-expiry></lintje-session-expiry>',
          setup(stage) {
            const session = stage.querySelector('lintje-session-expiry')
            wireSession(session)
            stage.querySelector('[data-open]').addEventListener('click', () => session.setAttribute('expired', ''))
          },
        },
        {
          label: 'Terugzetten',
          html: '<lintje-session-expiry restored-at="2026-10-04T10:42:00"></lintje-session-expiry>',
          setup(stage) {
            const session = stage.querySelector('lintje-session-expiry')
            session.addEventListener('lintje-draft-discard', () => session.removeAttribute('restored-at'))
          },
        },
      ],
    },
  ],
}
