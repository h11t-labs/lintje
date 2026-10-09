/**
 * Vertalen — the page's half of the application. It sets `data` and properties on the tags
 * and answers their events; it plays the server with timers: the translation that streams
 * in, the queue of documents, the uploads. The open tab and the languages live in the URL. Everything is fictional, and the example server
 * knows one sample text only.
 */
import { dropRemovedFiles, toast } from '../_shared/page.js'
import { answerLogout, carry, emblem, modeOf, searchWith, shellSettingsOf, themeOf } from '../_shared/settings.js'

/* The URL: languages, the open document, mode, theme and the demo state ------------------- */

const params = new URLSearchParams(location.search)
const DEMO = params.get('demo') === '1'
// A text opened again from the history page: read once, then left out of every link.
const again = params.get('tekst')
params.delete('tekst')

/** Writes one parameter into the address, without a reload. */
function setParam(key, value) {
  if (value == null) params.delete(key)
  else params.set(key, value)
  const query = params.toString()
  history.replaceState(null, '', `${location.pathname}${query ? `?${query}` : ''}`)
}

/** The address with parameters changed: what a link on this page points at. A page of its own
 * (a document, the history) leaves the other behind. */
function hrefWith(key, value, more = {}) {
  const next = new URLSearchParams(params)
  next.delete('demo')
  if (key === 'document' || key === 'view') {
    next.delete('document')
    next.delete('view')
  }
  for (const [name, change] of Object.entries({ [key]: value, ...more })) {
    if (change == null) next.delete(name)
    else next.set(name, change)
  }
  const query = next.toString()
  return query ? `?${query}` : location.pathname
}

const theme = themeOf(location.search)

// Mode and theme stand on <html> before the elements load, so they draw in them from the start.
const root = document.documentElement
root.dataset.mode = modeOf(location.search)
root.dataset.theme = theme

const lintje = await import('../../dist-elements/lintje.js')

// Icons named in data (the job list, the upload, the menus) are read one file at a time.
lintje.setIconSource({ base: '../../dist-icons/' })

/* Small helpers ------------------------------------------------------------------------------ */

const $ = (id) => document.getElementById(id)

/* The shell ----------------------------------------------------------------------------- */

const USER = { name: 'J. de Vries', role: 'Medewerker · Afdeling Vertalingen', initials: 'JV' }
const documentId = params.get('document')
/** Which page: the start, the history, or a document beside its translation. */
let view = params.get('view') === 'geschiedenis' ? 'history' : documentId ? 'document' : 'start'
const historyHref = hrefWith('view', 'geschiedenis', { tab: null })
const shell = $('shell')
let notifications = [
  {
    id: 'n2',
    title: 'Vertaling klaar',
    text: 'Brief aanvrager.docx',
    when: 'vandaag om 10:12',
    href: hrefWith('document', 'd1'),
    unread: true,
  },
  { id: 'n1', title: 'Vertaling mislukt', text: 'Scan formulier.pdf · het bestand is beveiligd', when: 'gisteren om 15:40' },
]

// "Weergave" holds the mode and the theme, the search button opens the search; the profile menu
// is only the reader's own. The logo leads back to Lintje's start page.
const settings = shellSettingsOf(location.search)

function renderShell() {
  shell.data = {
    name: 'Vertalen',
    emblem: emblem(theme),
    home: carry('../'),
    navigation: [
      { label: 'Vertalen', href: hrefWith('view', null), active: view !== 'history' },
      { label: 'Geschiedenis', href: historyHref, active: view === 'history' },
    ],
    view: settings.view,
    search: true,
    user: USER,
    version: '1.0.0',
    notifications,
  }
}

function notify(title, text, href) {
  notifications = [{ id: `n${Date.now()}`, title, text, href, when: 'zojuist', unread: true }, ...notifications]
  renderShell()
}

shell.addEventListener('lintje-navigate', (event) => {
  // Only the shell's own links; the hero's and the crumbs' are links the browser follows.
  if (event.target !== shell) return
  event.preventDefault()
  location.href = event.detail.href
})
// The mode and the theme stand in the URL; the page loads again with them.
shell.addEventListener('lintje-view-change', (event) => {
  location.href = `${location.pathname}${searchWith(location.search, event.detail)}`
})
answerLogout(shell)
shell.addEventListener('lintje-notification-open', (event) => {
  event.preventDefault()
  notifications = notifications.map((item) => (item.id === event.detail.id ? { ...item, unread: false } : item))
  renderShell()
  if (event.detail.href) location.href = event.detail.href
})
shell.addEventListener('lintje-notifications-read', () => {
  notifications = notifications.map((item) => ({ ...item, unread: false }))
  renderShell()
})
renderShell()

/* The languages ------------------------------------------------------------------------------ */

/** Each language with a flag in the choice; the en space keeps the flag apart from the name. */
const LANGUAGES = [
  ['en', '🇬🇧', 'Engels'],
  ['nl', '🇳🇱', 'Nederlands'],
  ['de', '🇩🇪', 'Duits'],
  ['fr', '🇫🇷', 'Frans'],
  ['es', '🇪🇸', 'Spaans'],
  ['pl', '🇵🇱', 'Pools'],
  ['tr', '🇹🇷', 'Turks'],
  ['uk', '🇺🇦', 'Oekraïens'],
  ['ar', '🇸🇦', 'Arabisch'],
].map(([value, flag, name]) => ({ value, name, label: `${flag}\u2002${name}` }))
const languageName = (code) => LANGUAGES.find((item) => item.value === code)?.name ?? code
const known = (code, fallback) => (LANGUAGES.some((item) => item.value === code) ? code : fallback)

const from = $('from')
const to = $('to')
const docFrom = $('doc-from')
const docTo = $('doc-to')
// Set here, not in the markup: a tag in the page renders before `setIconSource()` can run, and
// an icon it asked for at the default address stays missing.
$('hero-icon').name = 'communicatie-tekstballonnen-met-internationaal-gesprek'
$('live').icon = 'beeld-en-geluid-microfoon'
$('speak').icon = 'functioneel-geluid-aan'
$('dictate').icon = 'beeld-en-geluid-microfoon'
for (const field of [from, to, docFrom, docTo]) field.options = LANGUAGES
from.value = docFrom.value = known(params.get('van'), 'en')
to.value = docTo.value = known(params.get('naar'), 'nl')

/* The example server: one sample text, from English to Dutch and back. */
const SAMPLE =
  'The applicant writes that she moved to the Netherlands in March and wants to start a small bakery. She asks how long the permit application will take.'
const DUTCH =
  'De aanvrager schrijft dat zij in maart naar Nederland is verhuisd en een kleine bakkerij wil beginnen. Zij vraagt hoe lang de aanvraag van de vergunning duurt.'

/** What the server answers: the translation, or `null` for a text it does not know. */
function translate(text, source, target) {
  const clean = text.trim()
  if (source === 'en' && target === 'nl' && clean === SAMPLE) return DUTCH
  if (source === 'nl' && target === 'en' && clean === DUTCH) return SAMPLE
  return null
}

/* The source and its translation ------------------------------------------------------------- */

const translator = $('translator')
const translation = $('translation')
const copy = $('copy')
const label = $('label')
const nothing = $('nothing')
translator.value = SAMPLE

let timer = 0
let wanted = ''
/** Whether the reader changed the text or its languages: only what they did is remembered. */
let touched = false

/** The finished translation, and what the copy button copies with it. */
function finish(text, target) {
  translation.text = text
  translation.state = 'done'
  copy.setAttribute('text', `${text}\n\n${NOTICE[target] ?? NOTICE.nl}`)
}

/** What goes along with a copied translation, in the language it is in. */
const NOTICE = {
  nl: 'Deze tekst is automatisch vertaald. Controleer hem voordat je hem gebruikt.',
  en: 'This text was translated automatically. Check it before you use it.',
}

/** Asks the "server" for a translation of what is in the field now, and streams the answer. */
function request() {
  clearInterval(timer)
  translation.replaceChildren()
  copy.removeAttribute('text')
  const text = translator.value ?? ''
  const empty = !text.trim()
  nothing.hidden = !empty
  translation.hidden = empty
  label.hidden = empty
  if (empty) return

  translation.text = ''
  translation.state = 'waiting'
  translation.message = ''
  const answer = translate(text, from.value, to.value)
  wanted = answer ?? ''
  timer = setTimeout(() => {
    if (answer == null) {
      translation.state = 'error'
      translation.message =
        'Deze voorbeeldserver vertaalt alleen de voorbeeldtekst, van Engels naar Nederlands en terug.'
      return
    }
    stream(answer, 0)
  }, 600)
}

/** The words arrive two at a time; the reader can stop the stream. */
function stream(answer, start) {
  const words = answer.split(' ')
  let count = start
  clearInterval(timer)
  timer = setInterval(() => {
    count += 2
    translation.text = words.slice(0, count).join(' ')
    translation.state = 'streaming'
    if (count < words.length) return
    clearInterval(timer)
    finish(answer, to.value)
    if (touched) remember(translator.value, answer)
  }, 180)
}

translation.addEventListener('lintje-stop', () => {
  clearInterval(timer)
  translation.state = 'stopped'
})
translation.addEventListener('lintje-retry', request)

translator.addEventListener('lintje-text-change', () => {
  touched = true
  request()
})
$('sample').addEventListener('click', () => {
  touched = true
  setLanguages('en', 'nl')
  translator.value = SAMPLE
  request()
})

/** The languages of the text and of the documents are one choice, kept in the URL. */
function setLanguages(source, target) {
  from.value = docFrom.value = source
  to.value = docTo.value = target
  setParam('van', source === 'en' ? null : source)
  setParam('naar', target === 'nl' ? null : target)
}
for (const field of [from, docFrom]) {
  field.addEventListener('lintje-change', (event) => {
    touched = true
    setLanguages(event.detail ?? from.value, to.value)
    request()
  })
}
for (const field of [to, docTo]) {
  field.addEventListener('lintje-change', (event) => {
    touched = true
    setLanguages(from.value, event.detail ?? to.value)
    request()
  })
}

/* Reading aloud: the browser's own voice, in the translation's language. */
/* Reading aloud: the button is live while the voice speaks; a second click stops it. */
const speak = $('speak')
function stopSpeaking() {
  speechSynthesis.cancel()
  speak.live = false
  speak.pressed = false
  speak.label = 'Vertaling voorlezen'
}
speak.addEventListener('click', () => {
  if (!('speechSynthesis' in window) || !translation.text) return
  if (speak.live) return stopSpeaking()
  speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(translation.text)
  utterance.lang = to.value
  utterance.addEventListener('end', stopSpeaking)
  utterance.addEventListener('error', stopSpeaking)
  speechSynthesis.speak(utterance)
  speak.live = true
  speak.pressed = true
  speak.label = 'Stoppen met voorlezen'
})

/* Dictation: the browser's speech recognition writes into the source, in the source language.
   What is said is added after what was typed; the translation follows as it does on typing. */
const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition
const dictate = $('dictate')
let recognition = null

function stopDictation() {
  recognition?.stop()
  recognition = null
  dictate.live = false
  dictate.pressed = false
  dictate.label = 'Inspreken'
}

dictate.addEventListener('click', () => {
  if (recognition) return stopDictation()
  if (!Recognition) {
    toast('Inspreken werkt niet in deze browser. Probeer Chrome, Edge of Safari.', 'error')
    return
  }
  const typed = translator.value ? `${translator.value.trimEnd()} ` : ''
  recognition = new Recognition()
  recognition.lang = from.value
  recognition.continuous = true
  recognition.interimResults = true
  recognition.addEventListener('result', (event) => {
    const said = [...event.results].map((result) => result[0].transcript).join('')
    translator.value = `${typed}${said.trim()}`
    request()
  })
  recognition.addEventListener('error', (event) => {
    if (event.error === 'not-allowed') toast('Geef de browser toegang tot je microfoon om in te spreken.', 'error')
    stopDictation()
  })
  recognition.addEventListener('end', () => recognition && stopDictation())
  recognition.start()
  dictate.live = true
  dictate.pressed = true
  dictate.label = 'Stoppen met inspreken'
})

/* The documents' swap: their languages change places, as the text's do. */
$('documenten').addEventListener('lintje-languages-swap', () => {
  setLanguages(to.value, from.value)
  request()
})

/* Swap: the languages change places, and a finished translation becomes the source. */
translator.addEventListener('lintje-languages-swap', () => {
  touched = true
  setLanguages(to.value, from.value)
  if (translation.state === 'done' && wanted) translator.value = wanted
  request()
})

/* The tabs: text, documents, a conversation. The open one is in the URL. */
const tabs = $('tabs')
tabs.tabs = [
  { value: 'tekst', label: 'Tekst', icon: 'communicatie-tekstballon-met-potlood', hint: 'Typ of plak een tekst' },
  { value: 'document', label: 'Document', icon: 'op-kantoor-document-blanco', hint: 'PDF, Word of tekst' },
  { value: 'live', label: 'Live gesprek', icon: 'beeld-en-geluid-microfoon', hint: 'Praat met elkaar', badge: 'Binnenkort' },
]
const TABS = ['tekst', 'document', 'live']
tabs.value = TABS.includes(params.get('tab')) ? params.get('tab') : location.hash === '#documenten' ? 'document' : 'tekst'
// The start has one list of what was translated before, under every tab; the history page has
// the texts and the documents, whole.
function showBlocks() {
  $('history').hidden = view === 'document'
  $('done-docs').hidden = view !== 'history'
}
function openTab(value) {
  tabs.value = value
  setParam('tab', value === 'tekst' ? null : value)
  showBlocks()
}
showBlocks()
tabs.addEventListener('lintje-tab-change', (event) => openTab(event.detail))

/* Translated before: texts with their translation, kept on this device. The start mixes them
   with the finished documents, newest first; the history page shows each kind whole. A text opens
   again with the translation it got, without translating it once more. `ago` (minutes) orders the
   mix. */
const DEMO_HISTORY = [
  { id: 'h1', source: 'en', target: 'nl', text: SAMPLE, translation: DUTCH, when: '10:12', group: 'Vandaag', ago: 60 },
  {
    id: 'h2',
    source: 'nl',
    target: 'uk',
    text: 'De gemeente haalt het grofvuil op dinsdag op. Zet het voor 7.30 uur buiten.',
    translation: 'Громада вивозить великогабаритне сміття у вівторок. Виставте його до 7:30.',
    when: '09:15',
    group: 'Vandaag',
    ago: 117,
  },
  { id: 'h3', source: 'nl', target: 'en', text: DUTCH, translation: SAMPLE, when: '16:05', group: 'Gisteren', ago: 1200 },
  {
    id: 'h4',
    source: 'pl',
    target: 'nl',
    text: 'Dzień dobry, chciałbym umówić wizytę w sprawie meldunku.',
    translation: 'Goedendag, ik wil graag een afspraak maken voor mijn inschrijving.',
    when: '11:40',
    group: 'Gisteren',
    ago: 1460,
  },
  {
    id: 'h5',
    source: 'nl',
    target: 'en',
    text: 'Uw aanvraag is ontvangen. Binnen acht weken krijgt u een besluit.',
    translation: 'Your application has been received. You will receive a decision within eight weeks.',
    when: '3 oktober',
    group: 'Eerder',
    ago: 5800,
  },
]
const STORE = 'lintje-vertalen-teksten'
function loadHistory() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORE) ?? 'null')
    if (Array.isArray(stored)) return stored
  } catch {
    // No storage (a private window): the example's own texts.
  }
  return DEMO_HISTORY
}
function saveHistory() {
  try {
    localStorage.setItem(STORE, JSON.stringify(HISTORY))
  } catch {
    // Not kept, but the page goes on.
  }
}
let HISTORY = loadHistory()
/** The entry the reader is writing now: typing on updates it, a new text starts another. */
let draftId = null

/** A finished translation into the history; the same text again moves to the top. */
function remember(text, translated) {
  // Now orders before every moment in minutes, the newest first.
  const now = { when: 'zojuist', group: 'Vandaag', ago: -Date.now() }
  const source = from.value
  const target = to.value
  const same = HISTORY.find((entry) => entry.text === text && entry.source === source && entry.target === target)
  const draft = HISTORY.find((entry) => entry.id === draftId)
  if (same) Object.assign(same, now, { translation: translated })
  else if (draft) Object.assign(draft, now, { text, source, target, translation: translated })
  else {
    draftId = `t${Date.now()}`
    HISTORY.unshift({ id: draftId, source, target, text, translation: translated, ...now })
  }
  HISTORY.sort((a, b) => a.ago - b.ago)
  saveHistory()
  renderHistory()
}

const LATEST = 5
const historyList = $('history-list')
const textRow = (item) => ({
  id: item.id,
  icon: 'communicatie-tekstballon-met-potlood',
  title: item.text,
  sub: `${languageName(item.source)} → ${languageName(item.target)} · ${item.text.length} tekens`,
  meta: item.when,
  group: item.group,
  ago: item.ago,
  actions: [{ value: 'verwijderen', label: 'Verwijderen uit geschiedenis' }],
})
const docRow = (doc) => ({
  id: doc.id,
  icon: 'op-kantoor-document-blanco',
  title: doc.name,
  href: doc.href,
  sub: `${doc.pair} · ${pageWord(doc.pages)}`,
  meta: doc.when,
  group: doc.group,
  ago: doc.ago,
  actions: [{ value: 'verwijderen', label: 'Verwijderen uit geschiedenis' }],
})

function renderHistory() {
  if (view === 'history') {
    // This page is everything already: nothing further to see.
    historyList.items = HISTORY.map(textRow)
    $('history-all').hidden = true
    return
  }
  const done = docs.filter((doc) => doc.state === 'done')
  const mixed = [...HISTORY.map(textRow), ...done.map(docRow)].sort((a, b) => a.ago - b.ago)
  historyList.items = mixed.slice(0, LATEST)
  $('history-all').hidden = mixed.length <= LATEST
}
historyList.label = view === 'history' ? 'Eerder vertaalde teksten' : 'Eerder vertaald'
$('history').footnote =
  view === 'history' ? 'Je teksten blijven op dit apparaat.' : 'Teksten blijven op dit apparaat, documenten bij je afdeling.'
historyList.addEventListener('lintje-row-action', (event) => {
  if (event.detail.value !== 'verwijderen') return
  const id = event.detail.id
  if (HISTORY.some((item) => item.id === id)) {
    HISTORY = HISTORY.filter((item) => item.id !== id)
    saveHistory()
  } else docs = docs.filter((doc) => doc.id !== id)
  renderDocs()
  toast('Verwijderd uit je geschiedenis.')
})
$('hero').href = historyHref
$('history-all').href = historyHref
$('docs-all').href = historyHref

/** A text translated before, back in the field with its translation; from the history page via
 * the start (?tekst=…). */
function reopen(id) {
  const item = HISTORY.find((entry) => entry.id === id)
  if (!item) return
  if (view === 'history') {
    location.href = hrefWith('view', null, { tab: null, tekst: id })
    return
  }
  clearInterval(timer)
  touched = false
  draftId = null
  setLanguages(item.source, item.target)
  translator.value = item.text
  nothing.hidden = true
  translation.hidden = false
  label.hidden = false
  wanted = item.translation
  finish(item.translation, item.target)
  openTab('tekst')
  tabs.scrollIntoView({ block: 'start' })
}
historyList.addEventListener('lintje-row-click', (event) => {
  // A document opens beside its original; a text in the field.
  if (event.detail.href) {
    event.preventDefault()
    location.href = event.detail.href
    return
  }
  reopen(event.detail.id)
})

/* Search: one field over what was translated before, behind the shell's button and "/". A text
   opens in the field with its translation, a document beside its original. */
const search = $('search')
const textResult = (item) => ({
  id: item.id,
  label: item.text,
  meta: `Tekst · ${languageName(item.source)} → ${languageName(item.target)} · ${item.when}`,
  href: hrefWith('view', null, { tab: null, tekst: item.id }),
})
const docResult = (doc) => ({ id: doc.id, label: doc.name, meta: `Document · ${doc.pair} · ${doc.when}`, href: doc.href })
const finished = () => docs.filter((doc) => doc.state === 'done')
const recentResults = () => [
  {
    label: 'Recent',
    items: [...HISTORY.map((item) => [item.ago, textResult(item)]), ...finished().map((doc) => [doc.ago, docResult(doc)])]
      .sort((a, b) => a[0] - b[0])
      .slice(0, LATEST)
      .map(([, result]) => result),
  },
]
shell.addEventListener('lintje-search-open', () => {
  search.groups = recentResults()
  search.open = true
})
search.addEventListener('lintje-open', () => (search.open = true))
search.addEventListener('lintje-close', () => (search.open = false))
search.addEventListener('lintje-search', (event) => {
  const term = event.detail.trim().toLowerCase()
  if (!term) {
    search.groups = recentResults()
    return
  }
  const texts = HISTORY.filter((item) => `${item.text} ${item.translation}`.toLowerCase().includes(term))
  const found = finished().filter((doc) => doc.name.toLowerCase().includes(term))
  search.groups = [
    ...(texts.length ? [{ label: 'Teksten', items: texts.slice(0, 6).map(textResult) }] : []),
    ...(found.length ? [{ label: 'Documenten', items: found.slice(0, 6).map(docResult) }] : []),
  ]
})
search.addEventListener('lintje-navigate', (event) => {
  event.preventDefault()
  location.href = event.detail.href
})

/* The documents ----------------------------------------------------------------------------- */

const jobsList = $('jobs')
const queue = $('queue')
const pager = $('pager')
const upload = $('upload')

/** The pages of each document, and how far the busy one is. */
const PAGES = new Map()
/** When each finished document was done, newest first. */
const MOMENTS = [
  ['09:40', 'Vandaag', 92],
  ['08:55', 'Vandaag', 137],
  ['16:20', 'Gisteren', 1185],
  ['14:05', 'Gisteren', 1320],
  ['11:30', 'Gisteren', 1475],
  ...['3 oktober', '2 oktober', '1 oktober', '30 september', '29 september', '26 september', '25 september'].map(
    (day, index) => [day, 'Eerder', 5900 + index * 1440],
  ),
].map(([when, group, ago]) => ({ when, group, ago }))

let docs = [
  {
    id: 'd1',
    name: 'Brief aanvrager.docx',
    state: 'done',
    pair: 'Engels → Nederlands',
    pages: 3,
    href: hrefWith('document', 'd1'),
    when: '10:12',
    group: 'Vandaag',
    ago: 61,
  },
  { id: 'd2', name: 'Brief gemeente.pdf', state: 'busy', pair: 'Duits → Nederlands', pages: 5, at: 2 },
  ...[
    ['Bezwaarschrift 118.docx', 'Engels → Nederlands', 2],
    ['Uittreksel handelsregister.pdf', 'Frans → Nederlands', 1],
    ['Planning.txt', 'Spaans → Nederlands', 1],
    ['Huurcontract.pdf', 'Pools → Nederlands', 6],
    ['Offerte aannemer.docx', 'Engels → Nederlands', 2],
    ['Factuur.pdf', 'Turks → Nederlands', 1],
    ['Brief werkgever.docx', 'Duits → Nederlands', 2],
    ['Inschrijving.pdf', 'Engels → Nederlands', 3],
    ['Uitnodiging.txt', 'Frans → Nederlands', 1],
    ['Bankverklaring.pdf', 'Engels → Nederlands', 2],
    ['Medische verklaring.pdf', 'Spaans → Nederlands', 2],
    ['Verzoekschrift.docx', 'Oekraïens → Nederlands', 4],
  ].map(([name, pair, pages], index) => ({
    id: `d${index + 3}`,
    name,
    state: 'done',
    pair,
    pages,
    href: hrefWith('document', `d${index + 3}`),
    ...MOMENTS[index],
  })),
]
// The example's server remembers its documents for the session, so one finished here still opens
// when its page loads.
const DOCS_STORE = 'lintje-vertalen-documenten'
try {
  const kept = JSON.parse(sessionStorage.getItem(DOCS_STORE) ?? 'null')
  if (Array.isArray(kept)) docs = kept
} catch {
  // No storage: the server starts over.
}
// A link carries the page's settings of now, not those of when the document was done.
for (const doc of docs) if (doc.state === 'done') doc.href = hrefWith('document', doc.id)
for (const doc of docs) PAGES.set(doc.id, doc.pages)

const pageWord = (count) => `${count} ${count === 1 ? 'pagina' : 'pagina’s'}`

/** A document as a row of the job list, with its kind. */
const asJob = (doc) => ({ icon: 'op-kantoor-document-blanco', ...jobFields(doc) })

function jobFields(doc) {
  if (doc.state === 'busy') {
    return {
      id: doc.id,
      name: doc.name,
      state: 'busy',
      progress: Math.round((doc.at / doc.pages) * 100),
      detail: `${doc.pair} · pagina ${doc.at} van ${doc.pages}`,
    }
  }
  if (doc.state === 'queued') return { id: doc.id, name: doc.name, state: 'queued', detail: `${doc.pair} · in de wachtrij` }
  if (doc.state === 'cancelled') return { id: doc.id, name: doc.name, state: 'cancelled', detail: `${doc.pair} · geannuleerd` }
  if (doc.state === 'error') return { id: doc.id, name: doc.name, state: 'error', detail: doc.reason }
  return {
    id: doc.id,
    name: doc.name,
    state: 'done',
    href: doc.href,
    detail: `${doc.pair} · ${pageWord(doc.pages)}`,
    meta: doc.when,
    group: doc.group,
  }
}

let page = 1
let pageSize = 5
/** The work in progress under the upload; the finished documents, paged, in their own block. */
function renderDocs() {
  try {
    sessionStorage.setItem(DOCS_STORE, JSON.stringify(docs))
  } catch {
    // Not kept, but the page goes on.
  }
  const active = docs.filter((doc) => doc.state !== 'done')
  const done = docs.filter((doc) => doc.state === 'done')
  queue.jobs = active.map(asJob)
  queue.hidden = active.length === 0
  const count = Math.max(1, Math.ceil(done.length / pageSize))
  page = Math.min(page, count)
  jobsList.jobs = done.slice((page - 1) * pageSize, page * pageSize).map(asJob)
  // The start shows the latest page and points onward; the history page turns the pages.
  pager.hidden = view !== 'history'
  $('docs-all').hidden = view === 'history' || done.length <= pageSize
  pager.pageCount = count
  pager.total = done.length
  pager.pageSize = pageSize
  pager.page = page
  renderHistory()
}
const moveDoc = (id, change) => {
  docs = docs.map((doc) => (doc.id === id ? { ...doc, ...change } : doc))
  renderDocs()
}

pager.addEventListener('lintje-page-change', (event) => {
  page = event.detail.page
  renderDocs()
})
pager.addEventListener('lintje-page-size-change', (event) => {
  pageSize = event.detail.pageSize
  page = event.detail.page
  renderDocs()
})
for (const list of [queue, jobsList]) {
  list.addEventListener('lintje-job-cancel', (event) => moveDoc(event.detail, { state: 'cancelled' }))
  list.addEventListener('lintje-job-retry', (event) => moveDoc(event.detail, { state: 'queued' }))
  list.addEventListener('lintje-job-remove', (event) => {
    docs = docs.filter((doc) => doc.id !== event.detail)
    renderDocs()
  })
}

/** One step of the server: the busy document moves a page on; when none runs, the next starts. */
function tick() {
  const busy = docs.find((doc) => doc.state === 'busy')
  if (!busy) {
    const next = [...docs].reverse().find((doc) => doc.state === 'queued')
    if (next) moveDoc(next.id, { state: 'busy', at: 0 })
    return
  }
  if (busy.at + 1 < busy.pages) {
    moveDoc(busy.id, { at: busy.at + 1 })
    return
  }
  const href = hrefWith('document', busy.id)
  // Newest first: a finished document goes to the top of what was done today.
  docs = [{ ...busy, state: 'done', href, when: 'zojuist', group: 'Vandaag', ago: -Date.now() }, ...docs.filter((doc) => doc.id !== busy.id)]
  renderDocs()
  notify('Vertaling klaar', busy.name, href)
  // Ready, it is not opened by itself: the reader may be typing or uploading the next one.
  toast(`${busy.name} is vertaald.`, 'ok', { label: 'Openen', run: () => (location.href = href) })
}

/* A new document: the upload, then a place in the queue. */
let uploads = 0
upload.addEventListener('lintje-files-add', (event) => {
  for (const file of event.detail) {
    const id = `u${(uploads += 1)}`
    upload.files = [...(upload.files ?? []), { id, name: file.name, size: file.size, state: 'busy', progress: 0 }]
    const step = setInterval(() => {
      const row = upload.files.find((item) => item.id === id)
      if (!row) return clearInterval(step)
      const progress = Math.min(100, row.progress + 25)
      upload.files = upload.files.map((item) =>
        item.id === id ? { ...item, progress, state: progress >= 100 ? 'done' : 'busy' } : item,
      )
      if (progress < 100) return
      clearInterval(step)
      const pages = 1 + (file.size % 4)
      const doc = { id: `d-${id}`, name: file.name, state: 'queued', pair: `${languageName(from.value)} → ${languageName(to.value)}`, pages }
      PAGES.set(doc.id, pages)
      docs = [doc, ...docs]
      page = 1
      // Uploaded, the file is the queue's: one row for one document, never two.
      upload.files = upload.files.filter((item) => item.id !== id)
      renderDocs()
    }, 400)
  }
})
dropRemovedFiles(upload)

/* A document beside its translation (?document=…) ------------------------------------------- */

/** The original's pages as images, drawn on a canvas: what a host renders a PDF to. */
function originalPages(name, count) {
  const titles = ['Letter from the applicant', 'The business', 'Documents enclosed', 'Signature', 'Annex']
  return Array.from({ length: count }, (_, index) => {
    const canvas = document.createElement('canvas')
    canvas.width = 595
    canvas.height = 842
    const context = canvas.getContext('2d')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, 595, 842)
    context.fillStyle = '#1a1a1a'
    context.font = 'bold 20px sans-serif'
    context.fillText(titles[index % titles.length], 64, 96)
    context.font = '14px sans-serif'
    context.fillText(name, 64, 124)
    context.fillStyle = '#b4b4b4'
    for (let row = 0; row < 24; row++) {
      const width = row % 6 === 5 ? 260 : 467 - ((row * 37 + index * 11) % 90)
      context.fillRect(64, 176 + row * 22, width, 8)
    }
    context.fillStyle = '#696969'
    context.font = '12px sans-serif'
    context.fillText(`Page ${index + 1} of ${count}`, 64, 800)
    return canvas.toDataURL('image/png')
  })
}

/** The translation of each page, as the server returns it. */
const PAGE_TEXT = [
  ['Brief van de aanvrager', 'De aanvrager schrijft dat zij in maart naar Nederland is verhuisd en een kleine bakkerij wil beginnen.'],
  ['Het bedrijf', 'De bakkerij komt in een winkelpand aan de Dorpsstraat en heeft twee medewerkers.'],
  ['Bijgevoegde documenten', 'De aanvrager voegt een huurcontract voor het pand en een uittreksel uit het handelsregister bij.'],
  ['Ondertekening', 'Deze brief is op 1 oktober 2026 ondertekend door de aanvrager.'],
  ['Bijlage', 'Een kopie van het huurcontract is bij deze brief gevoegd.'],
]

/** The history: the title row instead of the hero, and both blocks whole, on the page itself. */
function openHistory() {
  shell.append($('history'), $('done-docs'))
  $('hero').hidden = true
  $('page-header').hidden = false
  $('page-header').data = {
    title: 'Geschiedenis',
    description: 'Alles wat je eerder hebt vertaald: teksten op dit apparaat, documenten van je afdeling.',
  }
  $('doc-copy').hidden = true
  $('doc-download').hidden = true
  $('history').heading = 'Teksten'
  $('done-docs').heading = 'Documenten'
  $('crumbs').items = [{ label: 'Vertalen', href: hrefWith('view', null) }, { label: 'Geschiedenis' }]
  document.title = 'Geschiedenis — Vertalen'
}

function openDocument(doc) {
  const count = PAGES.get(doc.id) ?? 1
  $('hero').hidden = true
  $('page-header').hidden = false
  $('doc-view').hidden = false
  $('page-header').data = {
    title: doc.name,
    description: `${doc.pair} · ${pageWord(count)} · vertaald vandaag om 10:12`,
  }
  document.title = `${doc.name} — Vertalen`

  const crumbs = $('crumbs')
  crumbs.items = [
    { label: 'Vertalen', href: hrefWith('document', null) },
    { label: 'Geschiedenis', href: historyHref },
    { label: doc.name },
  ]

  const viewer = $('viewer')
  viewer.name = doc.name
  viewer.pages = originalPages(doc.name, count)
  viewer.addEventListener('lintje-download', () => toast('Downloaden kan niet in dit voorbeeld.'))

  const text = $('doc-translation')
  text.innerHTML = Array.from({ length: count }, (_, index) => {
    const [heading, body] = PAGE_TEXT[index % PAGE_TEXT.length]
    return `<h3>Pagina ${index + 1} · ${heading}</h3><p>${body}</p>`
  }).join('')
  $('doc-download').addEventListener('click', () => toast('Downloaden kan niet in dit voorbeeld.'))
}

/* Start --------------------------------------------------------------------------------- */

const openDoc = documentId && docs.find((doc) => doc.id === documentId && doc.state === 'done')
if (documentId && !openDoc) {
  // Removed, or not done yet: the start, and a word on why.
  view = 'start'
  setParam('document', null)
  showBlocks()
  toast('Dit document is er niet (meer). Kies het opnieuw onder Eerder vertaald.', 'error')
}
if (openDoc) {
  openDocument(openDoc)
} else {
  if (view === 'history') openHistory()
  renderDocs()
  if (DEMO) {
    // A telling state: a translation half streamed, a document half way.
    translation.text = DUTCH.split(' ').slice(0, 18).join(' ')
    translation.state = 'streaming'
  } else {
    if (again) reopen(again)
    else request()
    setInterval(tick, 1500)
  }
}

