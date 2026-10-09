/**
 * Datacatalogus — the page's half of the application. It sets `data` on the tags and answers
 * their events. Four views on one page, chosen by the URL: the start page, the catalogue with
 * its filters, one product and the page about the platform. The products, owners and figures are
 * fictional. The reader's favourites stand in localStorage, where a real application would ask
 * its server.
 */
import { THEMES, answerLogout, carry, emblem, modeOf, searchWith, shellSettingsOf, themeOf } from '../_shared/settings.js'

const params = new URLSearchParams(location.search)
const root = document.documentElement
root.dataset.mode = modeOf(location.search)
// The application's own theme unless the reader picked one of Lintje's.
const chosen = params.has('theme')
root.dataset.theme = chosen ? themeOf(location.search) : 'catalogus'
const organisation = chosen ? themeOf(location.search) : 'rijksoverheid'

const lintje = await import('../../dist-elements/lintje.js')
lintje.setIconSource({ base: '../../dist-icons/' })

const $ = (id) => document.getElementById(id)

/** A link on this page: the reader's settings travel along. */
const here = (query) => carry(`${location.pathname}${query ? `?${query}` : ''}`)

/* The products --------------------------------------------------------------------------- */

const KINDS = {
  data: { label: 'Dataproduct', plural: 'Dataproducten', text: 'Gegevens om zelf mee te analyseren, met afspraken over het gebruik.' },
  ai: { label: 'AI-dienst', plural: 'AI-diensten', text: 'Diensten die tekst, spraak en documenten voor je verwerken.' },
  dashboard: { label: 'Dashboard', plural: 'Dashboards', text: 'Stuurinformatie per organisatieonderdeel, zoals voor vergunningverlening en toezicht.' },
}

// `access`: whether this reader may use it. Requests go by mail or the owner's own system.
const PRODUCTS = [
  { id: 'vertalen', kind: 'ai', title: 'Vertalen', owner: 'Team AI-diensten', contact: 'M. Bakker', access: true, updated: '1 okt 2026', popular: 3,
    words: 'vertalen vertaling vertaal taal talen engels document documenten',
    screens: [{ src: 'media/vertalen.jpg', alt: 'Het scherm Tekst vertalen', caption: 'Brontekst en vertaling naast elkaar, met wat je eerder vertaalde ernaast.' }],
    description: 'Vertaalt teksten en documenten tussen het Nederlands en andere talen, met behoud van opmaak.' },
  { id: 'transcriptie', kind: 'ai', title: 'Transcriptie', owner: 'Team AI-diensten', contact: 'M. Bakker', access: true, updated: '28 sep 2026', popular: 1,
    words: 'audio spraak opname opnames omzetten uitschrijven transcriberen geluid gesprek overleg',
    screens: [{ src: 'media/transcriptie.jpg', alt: 'Het scherm van een opname met transcript', caption: 'Een opname met de sprekers, de speler en het transcript.' }],
    description: 'Zet opnames van overleggen en interviews om in tekst, met sprekers en tijdcodes.' },
  { id: 'samenvatten', kind: 'ai', title: 'Samenvatten', owner: 'Team AI-diensten', contact: 'M. Bakker', access: false, updated: '22 sep 2026',
    words: 'samenvatten samenvatting kort korter lang document documenten',
    description: 'Maakt een samenvatting van lange documenten, met verwijzingen naar de bron.' },
  { id: 'documentherkenning', kind: 'ai', title: 'Documentherkenning', owner: 'Team AI-diensten', contact: 'S. Yilmaz', access: false, updated: '15 sep 2026',
    words: 'scan scannen ocr formulier formulieren uitlezen',
    description: 'Leest gescande documenten en formulieren uit naar doorzoekbare tekst.' },
  { id: 'vergunningen', kind: 'dashboard', title: 'Dashboard Vergunningen', owner: 'Dienst Vergunningen', contact: 'R. Visser', access: true, updated: '5 okt 2026', popular: 2,
    screens: [
      { src: 'media/dashboard.jpg', alt: 'Het overzicht van het dashboard', caption: 'Het overzicht: kerncijfers en meldingen bovenaan.' },
      { src: 'media/dashboard-2.jpg', alt: 'Grafieken en de tabel per loket', caption: 'Het verloop per uur, de afwijzingen en de tabel per loket.' },
      { src: 'media/dashboard-3.jpg', alt: 'De kaart en de duiding van de analist', caption: 'De aanvragen uit het buitenland op de kaart en de duiding van de analist.' },
    ],
    description: 'Aanvragen, wachttijden en afwijzingen bij de loketten, per regio en loket.' },
  { id: 'toezicht', kind: 'dashboard', title: 'Dashboard Toezicht', owner: 'Directie Toezicht', contact: 'A. de Groot', access: false, updated: '4 okt 2026', popular: 4,
    description: 'Stuurinformatie voor toezicht: inspecties, doorlooptijden en werkvoorraad.' },
  { id: 'bezetting', kind: 'dashboard', title: 'Personeelsbezetting', owner: 'Team HR-informatie', contact: 'L. Jansen', access: false, updated: '2 okt 2026',
    description: 'Bezetting en openstaande vacatures per organisatieonderdeel, per maand.' },
  { id: 'organisatie', kind: 'data', title: 'Organisatiestructuur', owner: 'Team Dataplatform', contact: 'K. Smit', access: true, updated: '6 okt 2026',
    refresh: 'Dagelijks', rows: '1.240', description: 'Actuele hiërarchie van organisatieonderdelen, met codes en geldigheid.' },
  { id: 'locaties', kind: 'data', title: 'Locaties en gebouwen', owner: 'Team Vastgoed', contact: 'P. Mulder', access: true, updated: '30 sep 2026',
    refresh: 'Wekelijks', rows: '3.815', description: 'Adressen, functies en gebruik van locaties en gebouwen.' },
  { id: 'inkoop', kind: 'data', title: 'Inkooptransacties', owner: 'Team Financiën', contact: 'E. de Boer', access: false, updated: '3 okt 2026',
    refresh: 'Dagelijks', rows: null, description: 'Inkooporders en facturen, per leverancier en kostenplaats.' },
  { id: 'personeel', kind: 'data', title: 'Personeelsbestand (gepseudonimiseerd)', owner: 'Team HR-informatie', contact: 'L. Jansen', access: false, updated: '1 okt 2026',
    refresh: 'Maandelijks', rows: null, description: 'Medewerkers zonder direct herleidbare gegevens, voor analyse en onderzoek.' },
  { id: 'verzuim', kind: 'data', title: 'Verzuim', owner: 'Team HR-informatie', contact: 'L. Jansen', access: true, updated: '29 sep 2026',
    refresh: 'Maandelijks', rows: '9.600', description: 'Verzuim per organisatieonderdeel en periode, geaggregeerd.' },
]

const productHref = (product) => here(`product=${product.id}`)

/* Favourites: the reader's own, kept in this browser ------------------------------------- */

const FAVOURITES_KEY = 'lintje-catalogus-favorieten'

/** Storage can be refused (a private window, blocked site data); then there are none yet. */
function readFavourites() {
  try {
    const stored = JSON.parse(localStorage.getItem(FAVOURITES_KEY) ?? '[]')
    return new Set(Array.isArray(stored) ? stored.filter((id) => PRODUCTS.some((item) => item.id === id)) : [])
  } catch {
    return new Set()
  }
}

let favourites = readFavourites()
const isFavourite = (item) => favourites.has(item.id)

function setFavourite(id, on) {
  const next = new Set(favourites)
  if (on) next.add(id)
  else next.delete(id)
  favourites = next
  try {
    localStorage.setItem(FAVOURITES_KEY, JSON.stringify([...favourites]))
  } catch {
    // Kept for this page only; the reader still sees the change.
  }
  redraw()
}

// Every card's heart asks here; the cards keep nothing.
document.addEventListener('lintje-card-action', (event) => {
  if (event.detail.value === 'favoriet') setFavourite(event.detail.id, event.detail.pressed)
})
// Another tab of the catalogue changed them.
addEventListener('storage', (event) => {
  if (event.key !== FAVOURITES_KEY) return
  favourites = readFavourites()
  redraw()
})

/** A product as a card: the way in when the reader has access, the way to ask when not. */
function card(product) {
  const details = { label: 'Details', href: productHref(product), variant: 'link' }
  return {
    id: product.id,
    title: product.title,
    href: productHref(product),
    iconActions: [
      {
        value: 'favoriet',
        label: 'Favoriet',
        icon: 'functioneel-favoriet-outline',
        iconPressed: 'functioneel-favoriet',
        pressed: isFavourite(product),
      },
    ],
    meta: [KINDS[product.kind].label, product.owner],
    description: product.description,
    facts: product.refresh ? [{ label: 'Verversing', value: product.refresh }, { label: 'Rijen', value: product.rows }] : undefined,
    status: product.access
      ? { label: 'Je hebt toegang', tone: 'success' }
      : { label: 'Geen toegang', icon: 'gebruiksvoorwerpen-hangslot-dicht' },
    actions: product.access
      ? [{ label: 'Openen', href: `https://example.org/catalogus/${product.id}`, variant: 'primary', external: true }, details]
      : [{ label: 'Toegang aanvragen', href: `${productHref(product)}#toegang` }, details],
  }
}

/* The shell ------------------------------------------------------------------------------- */

const shell = $('shell')
const productId = params.get('product')
const product = PRODUCTS.find((item) => item.id === productId)
const PAGES = { catalogus: 'catalogue', over: 'about' }
const view = product ? 'product' : (PAGES[params.get('pagina')] ?? 'start')

// "Weergave" offers the application's own purple beside Lintje's themes.
const settings = shellSettingsOf(location.search)
const THEME_LABELS = { catalogus: 'Catalogus' }

shell.data = {
  name: 'Datacatalogus',
  emblem: emblem(organisation),
  navigation: [
    { label: 'Start', href: here(''), active: view === 'start' },
    { label: 'Catalogus', href: here('pagina=catalogus'), active: view === 'catalogue' || view === 'product' },
    { label: 'Over het platform', href: here('pagina=over'), active: view === 'about' },
  ],
  view: {
    ...settings.view,
    themes: [{ value: 'catalogus', label: THEME_LABELS.catalogus }, ...settings.view.themes],
    theme: root.dataset.theme,
  },
  search: true,
  user: { name: 'J. de Vries', role: 'Analist', initials: 'JV' },
}
answerLogout(shell)

// The reader's settings stand in the URL; the application's own theme is the default here, so it is never written.
shell.addEventListener('lintje-view-change', (event) => {
  const { theme, ...rest } = event.detail
  const next = new URLSearchParams(searchWith(location.search, rest))
  if (theme === 'catalogus') next.delete('theme')
  else if (theme && THEMES.includes(theme)) next.set('theme', theme)
  const query = next.toString()
  location.href = `${location.pathname}${query ? `?${query}` : ''}`
})

// Every link on the page comes here and is followed: there is no router to hand it to.
document.addEventListener('lintje-navigate', (event) => {
  event.preventDefault()
  location.href = event.detail.href
})

/* Search: one field over every product, behind the shell's button and "/" ----------------- */

const search = $('search')
const result = (item) => ({ id: item.id, label: item.title, meta: `${KINDS[item.kind].label} · ${item.owner}`, href: productHref(item) })
const RECENT = () => [{ label: 'Veel gebruikt', items: PRODUCTS.filter((item) => item.popular).map(result) }]

search.groups = RECENT()
shell.addEventListener('lintje-search-open', () => (search.open = true))
search.addEventListener('lintje-open', () => (search.open = true))
search.addEventListener('lintje-close', () => (search.open = false))
search.addEventListener('lintje-search', (event) => {
  const term = event.detail.trim()
  if (!term) {
    search.groups = RECENT()
    return
  }
  const scored = PRODUCTS.map((item) => [item, score(item, term)]).filter(([, points]) => points > 0)
  scored.sort((a, b) => b[1] - a[1])
  search.groups = scored.length ? [{ label: 'Producten', items: scored.slice(0, 6).map(([item]) => result(item)) }] : []
})
search.addEventListener('lintje-action', (event) => {
  const item = PRODUCTS.find((entry) => entry.id === event.detail)
  if (item) location.href = productHref(item)
})

/* The question: the same words in the hero and in the shell's search ----------------------- */

// Words a question in plain language is made of, but that say nothing about a product.
const STOPWORDS = new Set(['welke', 'zijn', 'voor', 'naar', 'kan', 'ik', 'een', 'het', 'de', 'er', 'met', 'van', 'mijn', 'wat', 'hoe', 'mag', 'tekst', 'laten'])

/** How well a product answers the question: the number of its words the question names. */
function score(item, question) {
  const words = question.toLowerCase().match(/[a-zà-ÿ0-9-]+/g)?.filter((word) => word.length > 1 && !STOPWORDS.has(word)) ?? []
  const haystack = `${item.title} ${item.description} ${item.owner} ${KINDS[item.kind].plural} ${item.words ?? ''}`.toLowerCase()
  return words.filter((word) => haystack.includes(word)).length
}

/** The products that answer a question best; a question nothing answers has none. */
function answering(question, items = PRODUCTS) {
  const scored = items.map((item) => [item, score(item, question)])
  const best = Math.max(0, ...scored.map(([, points]) => points))
  return best ? scored.filter(([, points]) => points === best).map(([item]) => item) : []
}

/** A question is answered on the start page; the URL keeps it, so the answer can be shared. */
const ask = (text) => {
  if (text.trim()) location.href = here(`q=${encodeURIComponent(text.trim())}`)
}

/** The answer in words, made from the products found: what answers it, and whether you may use it. */
function answerText(found) {
  if (!found.length) {
    return 'Ik vond geen product dat bij je vraag past. Probeer het met andere woorden, of blader door de catalogus.'
  }
  if (found.length === 1) {
    const [item] = found
    const access = item.access
      ? 'Je hebt er toegang toe.'
      : `Je hebt er nog geen toegang toe; die vraag je aan bij de eigenaar, ${item.owner}.`
    return `Daarvoor is ${item.title}. ${item.description} ${access}`
  }
  const names = found.map((item) => item.title)
  const list = `${names.slice(0, -1).join(', ')} en ${names.at(-1)}`
  const open = found.filter((item) => item.access).length
  const access = open === found.length ? 'Je hebt overal toegang toe.' : open === 0 ? 'Je hebt er nog geen toegang toe.' : `Bij ${open} van de ${found.length} heb je toegang.`
  return `Er zijn ${found.length} producten die bij je vraag passen: ${list}. ${access}`
}

/** A product as a row of the answer: its kind and owner under it, its access beside it, and what
    the reader can do in the row's menu. */
function row(item) {
  const actions = item.access
    ? [{ value: 'openen', label: 'Openen', icon: 'functioneel-externe-link' }]
    : [{ value: 'aanvragen', label: 'Toegang aanvragen', icon: 'gebruiksvoorwerpen-hangslot-dicht' }]
  return {
    id: item.id,
    title: item.title,
    href: productHref(item),
    sub: `${KINDS[item.kind].label} · ${item.owner}`,
    meta: item.access ? 'Je hebt toegang' : 'Geen toegang',
    actions: [...actions, { value: 'details', label: 'Details', icon: 'functioneel-info' }],
  }
}

function renderAnswer(question) {
  const found = answering(question)
  const answer = $('answer')
  answer.hidden = false
  answer.heading = question
  $('answer-clear').href = here('')
  $('answer-text').text = answerText(found)
  $('answer-products').hidden = !found.length
  $('answer-products').items = found.slice(0, 5).map(row)
  const more = $('answer-more')
  more.href = found.length ? here(`pagina=catalogus&q=${encodeURIComponent(question)}`) : here('pagina=catalogus')
  more.label = found.length ? 'Alle producten bij je vraag in de catalogus' : 'Blader door de catalogus'
}

/* The start page ---------------------------------------------------------------------------- */

const EXAMPLES = [
  'Welke dashboards zijn er voor toezicht?',
  'Kan ik audio naar tekst omzetten?',
  'Kan ik een document vertalen?',
  'Kan ik een lang document laten samenvatten?',
  'Welke dashboards zijn er voor vergunningen?',
]

function renderStart() {
  $('hero').href = here('pagina=catalogus')
  const question = (params.get('q') ?? '').trim()
  if (question) renderAnswer(question)
  // A row opens its product's page; the list leaves the following to the host.
  $('answer-products').addEventListener('lintje-row-click', (event) => {
    event.preventDefault()
    if (event.detail.href) location.href = event.detail.href
  })
  $('answer-products').addEventListener('lintje-row-action', (event) => {
    const item = PRODUCTS.find((entry) => entry.id === event.detail.id)
    if (!item) return
    if (event.detail.value === 'openen') window.open(`https://example.org/catalogus/${item.id}`, '_blank', 'noopener')
    else if (event.detail.value === 'aanvragen') location.href = `${productHref(item)}#toegang`
    else location.href = productHref(item)
  })
  $('question').addEventListener('lintje-message-send', (event) => ask(event.detail.text ?? ''))
  $('examples').items = EXAMPLES.map((label) => ({ label }))
  $('examples').addEventListener('lintje-suggestion-select', (event) => ask(event.detail.value))
  $('kinds').items = Object.entries(KINDS).map(([kind, info]) => {
    const count = PRODUCTS.filter((item) => item.kind === kind).length
    return { id: kind, title: info.plural, href: here(`pagina=catalogus&soort=${kind}`), meta: [`${count} producten`], description: info.text }
  })
  drawStartCards()
}

/** The cards of the start page, again after a heart changed. */
function drawStartCards() {
  const mine = PRODUCTS.filter(isFavourite).sort((a, b) => a.title.localeCompare(b.title, 'nl'))
  $('favourites-section').hidden = !mine.length
  $('favourites').items = mine.map(card)
  $('popular').items = PRODUCTS.filter((item) => item.popular)
    .sort((a, b) => a.popular - b.popular)
    .slice(0, 3)
    .map(card)
}

/* The catalogue ------------------------------------------------------------------------------ */

const OWNERS = [...new Set(PRODUCTS.map((item) => item.owner))].sort((a, b) => a.localeCompare(b, 'nl'))

// The question is not a filter: it comes from the hero or the shell's search and stands above
// the results, with the way to clear it.
const FILTERS = [
  {
    key: 'soort', label: 'Soort', kind: 'segmented', default: 'alle',
    options: [{ value: 'alle', label: 'Alle' }, ...Object.entries(KINDS).map(([value, info]) => ({ value, label: info.plural }))],
  },
  {
    key: 'toegang', label: 'Toegang', kind: 'segmented', default: 'alle',
    options: [{ value: 'alle', label: 'Alle' }, { value: 'ja', label: 'Met toegang' }, { value: 'nee', label: 'Zonder toegang' }],
  },
  {
    key: 'favoriet', label: 'Favorieten', kind: 'segmented', default: 'alle',
    options: [{ value: 'alle', label: 'Alle' }, { value: 'ja', label: 'Mijn favorieten' }],
  },
  {
    key: 'eigenaar', label: 'Eigenaar', kind: 'select', default: 'alle',
    options: [{ value: 'alle', label: 'Alle eigenaren' }, ...OWNERS.map((owner) => ({ value: owner, label: owner }))],
  },
]

/** A filter's value as the URL holds it; an unknown option is the default. */
function valueOf(filter) {
  const text = params.get(filter.key)
  return filter.options.some((option) => option.value === text) ? text : filter.default
}

function matches(item, values) {
  return (
    (values.soort === 'alle' || item.kind === values.soort) &&
    (values.toegang === 'alle' || item.access === (values.toegang === 'ja')) &&
    (values.favoriet === 'alle' || isFavourite(item)) &&
    (values.eigenaar === 'alle' || item.owner === values.eigenaar)
  )
}

function withoutQuestion() {
  const next = new URLSearchParams(params)
  next.delete('q')
  return `${location.pathname}?${next}`
}

function renderCatalogue() {
  const values = Object.fromEntries(FILTERS.map((filter) => [filter.key, valueOf(filter)]))
  const question = (params.get('q') ?? '').trim()
  let found = PRODUCTS.filter((item) => matches(item, values)).sort((a, b) => a.title.localeCompare(b.title, 'nl'))
  if (question) found = answering(question, found)
  const count = found.length === 1 ? '1 product' : `${found.length} producten`
  $('filters').data = { filters: FILTERS.map((filter) => ({ ...filter, value: values[filter.key] })) }
  $('page-header').data = {
    title: 'Productcatalogus',
    description: question
      ? `${count} bij je vraag “${question}”.`
      : `${count}. Toegang vraag je aan bij de eigenaar van een product.`,
  }
  $('clear-question').hidden = !question
  $('clear-question').href = withoutQuestion()
  $('catalogue').items = found.map(card)
}

// The filters live in the URL (rule 14): write it, then draw again from it.
$('filters').addEventListener('lintje-values-change', (event) => {
  for (const filter of FILTERS) {
    if (!(filter.key in event.detail)) continue
    const value = event.detail[filter.key] ?? filter.default
    if (value === filter.default) params.delete(filter.key)
    else params.set(filter.key, value)
  }
  history.replaceState(null, '', `${location.pathname}?${params}`)
  renderCatalogue()
})
$('reset').addEventListener('click', () => {
  for (const key of ['q', ...FILTERS.map((filter) => filter.key)]) params.delete(key)
  history.replaceState(null, '', `${location.pathname}?${params}`)
  renderCatalogue()
})

/* A product's page ---------------------------------------------------------------------------- */

/** The heart in the product's page header, as a card's: filled while it is a favourite. */
function drawProductFavourite(item) {
  const favourite = isFavourite(item)
  Object.assign($('favourite'), {
    hidden: false,
    icon: favourite ? 'functioneel-favoriet' : 'functioneel-favoriet-outline',
    label: `Favoriet: ${item.title}`,
    pressed: favourite,
    active: favourite,
  })
}

function renderProduct(item) {
  const kind = KINDS[item.kind]
  $('page-header').data = { title: item.title, description: item.description }
  drawProductFavourite(item)
  $('favourite').addEventListener('click', () => setFavourite(item.id, !isFavourite(item)))
  $('crumbs').items = [
    { label: 'Catalogus', href: here('pagina=catalogus') },
    { label: kind.plural, href: here(`pagina=catalogus&soort=${item.kind}`) },
    { label: item.title },
  ]
  $('crumbs').hidden = false
  $('facts').items = [
    { label: 'Soort', value: kind.label },
    { label: 'Eigenaar', value: item.owner },
    { label: 'Contactpersoon', value: item.contact },
    { label: 'Laatst bijgewerkt', value: item.updated },
    ...(item.refresh ? [{ label: 'Verversing', value: item.refresh }, { label: 'Rijen', value: item.rows }] : []),
  ]

  if (item.screens?.length) {
    $('screens').hidden = false
    Object.assign($('gallery'), { items: item.screens, label: `Schermafbeeldingen van ${item.title}` })
  }

  const badge = $('access-badge')
  badge.tone = item.access ? 'success' : 'neutral'
  badge.textContent = item.access ? 'Je hebt toegang' : 'Geen toegang'
  $('access-text').text = item.access
    ? 'Je opent het product in een nieuw tabblad.'
    : `Toegang geeft de eigenaar, ${item.owner}. Je vraagt het aan buiten de catalogus: in het aanvraagsysteem of per mail. Vermeld waarvoor je het nodig hebt en voor hoe lang.`
  const ways = item.access
    ? [{ label: 'Openen', href: `https://example.org/catalogus/${item.id}`, variant: 'primary', icon: 'functioneel-externe-link', target: '_blank' }]
    : [
        { label: 'Aanvragen in het aanvraagsysteem', href: `https://example.org/aanvragen/${item.id}`, variant: 'primary', icon: 'functioneel-externe-link', target: '_blank' },
        { label: `Mail ${item.contact}`, href: `mailto:eigenaar@example.org?subject=${encodeURIComponent(`Toegang tot ${item.title}`)}`, variant: 'secondary', icon: 'functioneel-mail' },
      ]
  for (const way of ways) {
    const button = document.createElement('lintje-button')
    Object.assign(button, { variant: way.variant, href: way.href, label: way.label, iconRight: way.icon })
    if (way.target) button.target = way.target
    $('access-ways').append(button)
  }
}

/* About the platform -------------------------------------------------------------------- */

function renderAbout() {
  $('page-header').data = {
    title: 'Over het dataplatform',
    description: 'Het dataplatform achter de catalogus: wat het is, wat erop staat en wie je kunt vragen.',
  }
  $('about-facts').items = [
    { label: 'Team', value: 'Team Dataplatform' },
    { label: 'Product aanmelden', value: 'dataplatform@example.org', href: 'mailto:dataplatform@example.org?subject=Product%20aanmelden' },
    { label: 'Vragen over toegang', value: 'Bij de eigenaar van het product' },
    { label: 'Storingen', value: 'De servicedesk, via het intranet' },
    { label: 'Producten in de catalogus', value: String(PRODUCTS.length) },
  ]
}

/* The footer, on every page ------------------------------------------------------------------- */

$('footer').data = {
  tagline: 'Datacatalogus — alle producten van het dataplatform op één plek',
  columns: [
    {
      heading: 'Catalogus',
      links: Object.entries(KINDS).map(([kind, info]) => ({ label: info.plural, href: here(`pagina=catalogus&soort=${kind}`) })),
    },
    { heading: 'Over het platform', links: [{ label: 'Wat is het dataplatform?', href: here('pagina=over') }, { label: 'Een product aanmelden', href: 'mailto:dataplatform@example.org?subject=Product%20aanmelden' }] },
    { heading: 'Hulp', links: [{ label: 'Contact', href: here('pagina=over') }, { label: 'Toegang aanvragen', href: here('pagina=over') }] },
  ],
  links: [
    { label: 'Privacy', href: '#privacy' },
    { label: 'Toegankelijkheid', href: '#toegankelijkheid' },
  ],
  note: 'Versie 1.0.0 · een voorbeeld met fictieve gegevens',
}

/* The view the URL asks for ----------------------------------------------------------------------- */

$('hero').hidden = view !== 'start'
if (view === 'catalogue') $('filters').hidden = false
// Elsewhere the bar is gone, not hidden: the shell offers Filters on a phone wherever one stands.
else $('filters').remove()
$('page-header').hidden = view === 'start'
$('start-view').hidden = view !== 'start'
$('catalogue-view').hidden = view !== 'catalogue'
$('product-view').hidden = view !== 'product'
$('about-view').hidden = view !== 'about'

if (view === 'start') renderStart()
else if (view === 'catalogue') renderCatalogue()
else if (view === 'about') renderAbout()
else renderProduct(product)

/** The view again after the favourites changed: the hearts, and what shows because of them. */
function redraw() {
  if (view === 'start') drawStartCards()
  else if (view === 'catalogue') renderCatalogue()
  else if (view === 'product') drawProductFavourite(product)
}
