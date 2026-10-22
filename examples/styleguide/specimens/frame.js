// The frame category (Paginakader): the specimens of its elements.
import { meta } from '../../_data/load.js'

/** The navigation bar's own surface, so a part that lives there is seen on it. */
const BAR = 'display: inline-flex; align-items: center; height: 48px; padding: 0 2px; background: var(--color-nav-bg); color: var(--color-nav-text)'

const USER = { name: 'J. de Vries', role: 'Teamleider · Dienst Vergunningen', initials: 'JV' }

/** The same user with a photo: the gallery's grey stand-in, never a face. */
const USER_PHOTO = { ...USER, photo: 'media/afbeelding.svg' }

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

const SUB_NAV_PAGE = [
  {
    label: 'Op deze pagina',
    items: [
      { label: 'Wie kan een vergunning aanvragen', href: '#wie' },
      { label: 'Wat u nodig hebt', href: '#nodig' },
      {
        label: 'Zo vraagt u aan',
        href: '#aanvragen',
        items: [
          { label: 'Online aanvragen', href: '#online', active: true },
          { label: 'Op papier aanvragen', href: '#papier' },
        ],
      },
      {
        label: 'Na uw aanvraag',
        href: '#na',
        items: [
          { label: 'Hoe lang het duurt', href: '#termijn' },
          { label: 'Bezwaar maken tegen een besluit over uw aanvraag', href: '#bezwaar' },
        ],
      },
      { label: 'Vragen en contact', href: '#contact' },
    ],
  },
]

/** The host holds the reader's page: a click makes the chosen entry the active one. */
function subNav(stage, groups, action, label = 'Instellingen') {
  const element = stage.querySelector('lintje-sub-nav')
  element.style.maxWidth = '288px'
  element.label = label
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
      wide: true,
      title: 'De schil om een pagina: het menu erboven of ernaast, de naam als h1, paginakop en inhoud',
      specimens: [
        {
          label: 'Menu naast de pagina',
          note: 'Deze stijlgids staat zelf in die schil.',
          html: '<lintje-prose></lintje-prose>',
          setup(stage) {
            stage.querySelector('lintje-prose').html = `
              <p>Met <code>layout: 'side'</code> staat het menu naast de pagina, vast of als smalle balk, met boven de pagina een balk met de naam, “Weergave” en “Delen”. Die schil staat om deze stijlgids zelf; “Weergave” zet het menu ook boven de pagina.</p>
              <p>Met een filterbalk en een menu met cijfers zie je het in <a href="../dashboard/">het dashboard-voorbeeld</a>.</p>`
          },
        },
        {
          label: 'Menu boven de pagina',
          note:
            'De actieve pagina is gemarkeerd en rechts in de balk staan zoeken, ' +
            'meldingen en de gebruiker. Een klik op een pagina maakt die actief.',
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
          label: 'Lichte navigatiebalk',
          note:
            'Met `nav-tone="light"` is de balk wit met de tekst in de primaire kleur en de ' +
            'actieve pagina onderstreept, zoals de huisstijl de navigatiebalk tekent. ' +
            'De logobalk en de rest van de pagina veranderen niet.',
          html: `<lintje-shell nav-tone="light">
            <lintje-page-header slot="header">
              <lintje-breadcrumbs slot="breadcrumbs"></lintje-breadcrumbs>
            </lintje-page-header>
            <p>Dezelfde schil, met de balk op het oppervlak.</p>
          </lintje-shell>`,
          setup(stage) {
            const shell = stage.querySelector('lintje-shell')
            shell.style.minHeight = '0'
            shell.data = {
              name: 'Transcriptie',
              emblem: emblem(),
              navigation: NAVIGATION,
              user: USER,
              userMenu: USER_MENU,
              search: true,
              notifications: NOTIFICATIONS,
            }
            stage.querySelector('lintje-page-header').data = { title: 'Teamoverleg 2 oktober' }
            stage.querySelector('lintje-breadcrumbs').items = [{ label: 'Opnames', href: '#opnames' }, { label: 'Teamoverleg 2 oktober' }]
          },
        },
        {
          label: 'Lichte rail',
          note:
            'Naast de pagina is het lichte menu de side navigation van de huisstijl: wit met een ' +
            'lijn ernaast, de pagina van de lezer vet in de waas met de accentlijn als rand, een ' +
            'rij onder de aanwijzer gevuld in de primaire kleur. De kop met het lint verandert niet.',
          html: `<lintje-shell nav-tone="light">
            <lintje-page-header slot="header"></lintje-page-header>
            <p>Wijs een rij in het menu aan.</p>
          </lintje-shell>`,
          setup(stage) {
            const shell = stage.querySelector('lintje-shell')
            shell.data = {
              name: 'Transcriptie',
              layout: 'side',
              emblem: emblem(),
              navigation: GROUPED.flatMap((entry) => (entry.links ? [entry] : [{ ...entry, icon: entry.label === 'Opnames' ? 'beeld-en-geluid-microfoon' : 'functioneel-klok' }])),
              user: USER,
              userMenu: USER_MENU,
              version: '2.4.1',
            }
            stage.querySelector('lintje-page-header').data = { title: 'Woordenlijst' }
          },
        },
        {
          label: 'Gebruiker in de voet',
          note:
            'Naast de pagina is de voet van het menu de knop van het gebruikersmenu. ' +
            'Het menu opent erboven: de naam met “Afmelden” ernaast, de rijen van de host en de versie.',
          html: `<lintje-shell>
            <lintje-page-header slot="header"></lintje-page-header>
            <p>Klik op de naam onderaan het menu.</p>
          </lintje-shell>`,
          setup(stage) {
            const shell = stage.querySelector('lintje-shell')
            shell.data = {
              name: 'Transcriptie',
              layout: 'side',
              emblem: emblem(),
              navigation: NAVIGATION,
              user: USER,
              userMenu: USER_MENU,
              version: '2.4.1',
            }
            stage.querySelector('lintje-page-header').data = { title: 'Opnames' }
          },
        },
        {
          label: 'Groep met submenu',
          note:
            'Klik op “Beheer” of wijs het aan. Buiten productie toont de balk de ' +
            'omgeving, hier Acceptatie.',
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
          label: 'Weergave en delen',
          note: '“Weergave” en “Delen” zijn de instellingen van de lezer; de host bewaart ze.',
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
          label: 'Met een hero',
          note: 'De hero in het slot `full` loopt van rand tot rand; de inhoud blijft in de kolom.',
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
          label: 'Zonder de onderdelen rechts',
          note: 'De balk heeft geen zoeken, meldingen of gebruiker. Een lange naam wordt afgekapt.',
          html: '<lintje-shell><p>Een app zonder de onderdelen rechts in de balk.</p></lintje-shell>',
          setup(stage) {
            const shell = stage.querySelector('lintje-shell')
            shell.style.minHeight = '0'
            shell.data = { name: 'Registratie en afhandeling van meldingen in de openbare ruimte', navigation: NAVIGATION }
          },
        },
        ...[
          { label: 'Voet van het vaste zijmenu', menu: 'pinned', user: USER },
          { label: 'Voet van het zijmenu met een foto', menu: 'pinned', user: USER_PHOTO },
          { label: 'Voet in de rail', menu: 'unpinned', user: USER },
          { label: 'Voet in de rail met een foto', menu: 'unpinned', user: USER_PHOTO },
        ].map(({ label, menu, user }) => ({
          label,
          note:
            menu === 'pinned'
              ? 'Vanaf 1440 px: het rondje zo hoog als naam en functie samen. Smaller is het de rail.'
              : 'Alleen het rondje, midden in de rail. Wijs de rail aan: hij klapt uit en naam en ' +
                'functie vervagen in.',
          html: `<lintje-shell>
            <lintje-page-header slot="header"></lintje-page-header>
            <p>De gebruiker staat onderaan het menu.</p>
          </lintje-shell>`,
          setup(stage) {
            const shell = stage.querySelector('lintje-shell')
            shell.data = {
              name: 'Transcriptie',
              layout: 'side',
              menu,
              emblem: emblem(),
              navigation: NAVIGATION,
              user,
              logout: { href: '#el-shell', token: 'demo-token' },
            }
            stage.querySelector('lintje-page-header').data = { title: 'Opnames' }
          },
        })),
      ],
    },
{
      tag: 'lintje-page-header',
      wide: true,
      title: 'Kop van een pagina: titel, toelichting, peilmoment en bron, kruimelpad en acties',
      specimens: [
        {
          label: 'Met toelichting en meer-link',
          html: '<lintje-page-header></lintje-page-header>',
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
          label: 'Met een potlood bij de titel',
          note:
            'Het attribuut `editable` toont het potlood bij aanwijzen of focus; ' +
            'daarmee wijzig je de naam.',
          html: '<lintje-page-header editable></lintje-page-header>',
          setup: (stage) => {
            stage.querySelector('lintje-page-header').data = { title: 'Teamoverleg 2 oktober', description: 'Vergadering · 4:12 · 3 sprekers' }
          },
        },
        {
          label: 'Met kruimelpad en acties',
          note: 'In de app-schil staat de kop zonder vlak.',
          html: `<lintje-page-header>
            <lintje-breadcrumbs slot="breadcrumbs"></lintje-breadcrumbs>
            <lintje-button slot="actions" variant="secondary">Exporteren</lintje-button>
            <lintje-button slot="actions" variant="primary">Opslaan</lintje-button>
          </lintje-page-header>`,
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
        {
          label: 'Met vier acties',
          note: 'Wat niet op één regel past, gaat in “Meer”; de laatste knop blijft staan.',
          html: `<lintje-page-header>
            <lintje-button slot="actions" variant="secondary">Exporteren</lintje-button>
            <lintje-button slot="actions" variant="secondary">Delen</lintje-button>
            <lintje-button slot="actions" variant="danger">Verwijderen</lintje-button>
            <lintje-button slot="actions" variant="primary">Opslaan</lintje-button>
          </lintje-page-header>`,
          setup: (stage) => {
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
          label: 'Rust',
          note: 'Wijs een link aan of geef hem focus.',
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
      title: 'Het submenu naast de inhoud, ook als inhoudsopgave van een pagina; onder 768 px één knop die de lijst openklapt',
      specimens: [
        {
          label: 'Groepen en een actie',
          note:
            'De groepen hebben een label, de huidige pagina is gemarkeerd en er ' +
            'staat een actie bij.',
          html: '<lintje-sub-nav></lintje-sub-nav>',
          setup: (stage) => subNav(stage, SUB_NAV, { label: 'Nieuw soort gesprek', value: 'nieuw' }),
        },
        {
          label: 'Soorten links',
          note:
            'Er staan links met een icoon, een teller en een lange tekst, een ' +
            'zonder toegang en een zonder pagina.',
          html: '<lintje-sub-nav></lintje-sub-nav>',
          setup: (stage) => subNav(stage, SUB_NAV_KINDS),
        },
        {
          label: 'Tweede laag',
          note: 'De laag op het pad van de huidige pagina staat open.',
          html: '<lintje-sub-nav></lintje-sub-nav>',
          setup: (stage) => subNav(stage, SUB_NAV_NESTED),
        },
        {
          label: 'Alle niveaus open',
          note:
            'Het attribuut `expanded` opent alle niveaus. Zo toont het de ' +
            'secties van een lange pagina, als ankers.',
          html: '<lintje-sub-nav expanded></lintje-sub-nav>',
          setup: (stage) => subNav(stage, SUB_NAV_PAGE, undefined, 'Op deze pagina'),
        },
      ],
    },
    {
      tag: 'lintje-hero',
      wide: true,
      title: 'De openingsband van een startpagina: grote titel, inleiding en één weg verder',
      specimens: [
        {
          label: 'Rust',
          note: 'De hero heeft een titel, een inleiding en een link verder.',
          html: `<lintje-hero heading="Wat wil je vertalen?" description="Typ of spreek een tekst in, upload een document, of voer een gesprek dat live wordt vertaald." action="Of start een live gesprek" href="#live"></lintje-hero>`,
          setup(stage) {
            stage.querySelector('lintje-hero').addEventListener('lintje-navigate', (event) => event.preventDefault())
          },
        },
        {
          label: 'Een opname die loopt',
          note:
            'Het slot `status` zet de status boven de titel, het slot `panel` ' +
            'wat er gezegd wordt ernaast.',
          html: `<lintje-hero heading="Weekendbezetting en sleutels" description="Op je telefoon · Vergadering · gestart om 14:02">
            <lintje-badge slot="status" tone="live">Neemt op</lintje-badge>
            <lintje-recording-status elapsed="724" level="0.6" connection="good" delay="1"></lintje-recording-status>
            <lintje-button variant="primary">Meelezen</lintje-button>
            <lintje-tile slot="panel" heading="Wat er nu gezegd wordt"><p>Die haal ik vrijdag op, dan liggen ze zaterdag klaar.</p></lintje-tile>
          </lintje-hero>`,
        },
        {
          label: 'Met een beeld ernaast',
          note: 'Het slot `aside` zet een beeld naast de tekst; onder 1024 px valt het weg.',
          html: `<lintje-hero heading="Wat zoek je?" description="Stel je vraag in gewone taal. De catalogus zoekt in alle producten, ook die waar je nog geen toegang toe hebt." action="Of blader door de hele catalogus" href="#catalogus">
            <lintje-icon slot="aside" name="communicatie-tekstballonnen-met-vraagteken" size="160"></lintje-icon>
          </lintje-hero>`,
          setup(stage) {
            stage.querySelector('lintje-hero').addEventListener('lintje-navigate', (event) => event.preventDefault())
          },
        },
        {
          label: 'Als paginakop',
          note:
            'Met `tone="primary"` is de hero de kop van een werkpagina: kruimelpad, titel en ' +
            'inleiding in wit op de primaire kleur. De hoek rechtsboven is die van de host ' +
            '(`--lintje-radius-corner`, hier 48 px); een pagina die geen hoek wil, laat hem weg.',
          html: `<div style="--lintje-radius-corner: 48px">
            <lintje-hero tone="primary" heading="Aanvragen en wachttijden" description="Alle cijfers over de loketten, per regio en per soort loket, bijgewerkt tot vanochtend.">
              <lintje-breadcrumbs slot="breadcrumbs"></lintje-breadcrumbs>
            </lintje-hero>
          </div>`,
          setup(stage) {
            crumbs(stage, [{ label: 'Home', href: '#home' }, { label: 'Cijfers', href: '#cijfers' }, { label: 'Aanvragen en wachttijden' }])
          },
        },
        {
          label: 'Met tabs over de onderrand',
          note: 'Het slot `overlap` legt grote tabs half over de onderrand.',
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
      wide: true,
      title: 'De voet van een site of applicatie: wat het is, kolommen met links en de vaste links',
      specimens: [
        {
          label: 'Met kolommen en vaste links',
          note: 'Bovenaan zegt een regel wat het is, daaronder staan kolommen met links.',
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
          label: 'Compact',
          note:
            'Met `variant="compact"` is de voet die van een formulier of een taakpagina: de ' +
            'regel en de vaste links op één rij, op het lichte vlak; kolommen tekent hij niet.',
          html: '<lintje-footer variant="compact"></lintje-footer>',
          setup(stage) {
            const footer = stage.querySelector('lintje-footer')
            footer.data = {
              tagline: 'Datacatalogus — het dataplatform van de organisatie',
              links: [{ label: 'Privacy', href: '#el-footer' }, { label: 'Toegankelijkheid', href: '#el-footer' }, { label: 'Cookies', href: '#el-footer' }],
              note: 'Versie 1.0.0',
            }
            footer.addEventListener('lintje-navigate', (event) => event.preventDefault())
          },
        },
        {
          label: 'Alleen de vaste links',
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
          label: 'Rust',
          note: 'Klik op de avatar om het menu te openen.',
          html: `<span style="${BAR}"><lintje-user-menu version="2.4.1"></lintje-user-menu></span>`,
          setup(stage) {
            const menu = stage.querySelector('lintje-user-menu')
            menu.user = USER
            menu.items = USER_MENU
          },
        },
        {
          label: 'Open',
          note: 'Open neemt de knop de hovervulling en draait de chevron.',
          html: `<span style="${BAR}"><lintje-user-menu version="2.4.1" open></lintje-user-menu></span>`,
          setup(stage) {
            const menu = stage.querySelector('lintje-user-menu')
            menu.user = USER
            menu.items = USER_MENU
          },
        },
        {
          label: 'Met een foto',
          note: 'De foto staat in hetzelfde rondje; zonder initialen heet de knop "Menu van …".',
          html: `<span style="${BAR}"><lintje-user-menu version="2.4.1"></lintje-user-menu></span>`,
          setup(stage) {
            const menu = stage.querySelector('lintje-user-menu')
            menu.user = { ...USER_PHOTO, initials: undefined }
            menu.items = USER_MENU
          },
        },
        {
          label: 'Een lange keuze',
          note: 'Onder de focus van het toetsenbord en op een telefoon loopt een lange keuze door.',
          html: `<span style="${BAR}"><lintje-user-menu version="2.4.1"></lintje-user-menu></span>`,
          setup(stage) {
            const menu = stage.querySelector('lintje-user-menu')
            menu.user = USER
            menu.items = [
              ...USER_MENU,
              {
                value: 'organisatie',
                label:
                  'Wisselen naar een andere organisatie waarvoor je gemachtigd bent, met haar eigen aanvragen en instellingen',
              },
            ]
          },
        },
        {
          label: 'Afmelden als formulier',
          note: 'Met `logout-action` en `csrf` meldt de knop af met een formulier.',
          html: `<span style="${BAR}"><lintje-user-menu version="2.4.1" logout-action="#el-user-menu" csrf="demo-token"></lintje-user-menu></span>`,
          setup(stage) {
            const menu = stage.querySelector('lintje-user-menu')
            menu.user = USER
            menu.items = USER_MENU
          },
        },
        {
          label: 'Op een telefoon',
          note: 'Met `inline` staat het menu onderaan de mobiele navigatie.',
          html: `<div style="background: var(--color-nav-bg); max-width: 360px"><lintje-user-menu inline version="2.4.1"></lintje-user-menu></div>`,
          setup(stage) {
            const menu = stage.querySelector('lintje-user-menu')
            menu.user = USER
            menu.items = USER_MENU
          },
        },
        {
          label: 'Op een telefoon met een foto',
          html: `<div style="background: var(--color-nav-bg); max-width: 360px"><lintje-user-menu inline version="2.4.1"></lintje-user-menu></div>`,
          setup(stage) {
            const menu = stage.querySelector('lintje-user-menu')
            menu.user = USER_PHOTO
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
          label: 'Rust',
          note: 'Kies een resultaat met de pijltjes. Dit specimen opent met zijn knop; / opent het zoekveld van de stijlgids.',
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
          label: 'Een lang resultaat',
          note:
            'Het gekozen resultaat en elk resultaat op een telefoon lopen door; met een aanwijzer ' +
            'staat de hele tekst in de tooltip.',
          html: '<lintje-button variant="secondary" data-open>Zoeken naar een lang resultaat</lintje-button><lintje-app-search label="Zoeken in Transcriptie"></lintje-app-search>',
          setup(stage) {
            const search = stage.querySelector('lintje-app-search')
            search.addEventListener('lintje-close', () => (search.open = false))
            stage.querySelector('[data-open]').addEventListener('click', () => {
              search.query = 'overleg'
              search.groups = [
                {
                  label: 'Opnames',
                  items: [
                    { id: 'kort', label: 'Teamoverleg 2 oktober', meta: '4:12' },
                    {
                      id: 'lang',
                      label:
                        'Overleg over de planning van de ochtenddienst, de bezetting van de balie en de afspraken met de gemeente',
                      meta: '47:12',
                    },
                  ],
                },
              ]
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
          label: 'Rust met ongelezen meldingen',
          note: 'Klik op de bel om het paneel te openen.',
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
          label: 'Een melding erbij',
          note: 'Klik op “Melding” om er een bij te zetten.',
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
          label: 'Eigen maximum',
          note: 'Met `max="99"` telt de teller door tot 99.',
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
  ],
}
