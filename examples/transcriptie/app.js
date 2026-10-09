/**
 * Transcriptie — the page's half of the application. It sets `data` and properties on the
 * tags and answers their events; it plays the server with timers: the upload, the queue of
 * transcriptions, the live session (here or on the phone), the suggested name, the AI work.
 * Everything is fictional.
 */
import { dropRemovedFiles, plural, toast } from '../_shared/page.js'
import { carry, emblem, modeOf, themeOf } from '../_shared/settings.js'

/* The URL: the opened recording, the kind of conversation, the tab ------------------------ */

let params = new URLSearchParams(location.search)
const DEMO = params.get('demo') === '1'

/** Writes one parameter into the address; `push` makes it a step the back button undoes. */
function setParam(key, value, push = false) {
  if (value == null) params.delete(key)
  else params.set(key, value)
  const query = params.toString()
  history[push ? 'pushState' : 'replaceState'](null, '', `${location.pathname}${query ? `?${query}` : ''}`)
}

/** The address with one parameter changed: what a link on this page points at. */
function hrefWith(key, value) {
  const next = new URLSearchParams(params)
  if (value == null) next.delete(key)
  else next.set(key, value)
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
const clock = () => new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
const today = () => new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }).replace('.', '')
const mmss = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

// Named here, after the source is set, so the first draw already reads the right folder.
// Prose draws its own `html` on the type scale; a heading in its slot would keep the browser's size.
for (const prose of document.querySelectorAll('lintje-prose[data-heading]')) prose.html = `<h3>${prose.dataset.heading}</h3>`
// The dialogs here hold forms, not a chart: no CSV or PNG in their footer.
for (const modal of document.querySelectorAll('lintje-modal')) Object.assign(modal, { csv: false, png: false })
$('search-prev').icon = 'functioneel-delta-omhoog'
$('search-next').icon = 'functioneel-delta-omlaag'
$('record').icon = 'beeld-en-geluid-microfoon'
$('phone-follow').iconRight = 'functioneel-pijl-naar-rechts'

/* The audio: a silent WAV made in the browser, and a waveform that looks like speech -------- */

function silentRecording(seconds) {
  const rate = 4000
  const samples = rate * seconds
  const buffer = new ArrayBuffer(44 + samples)
  const view = new DataView(buffer)
  const text = (offset, value) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)))
  text(0, 'RIFF')
  view.setUint32(4, 36 + samples, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, rate, true)
  view.setUint32(28, rate, true)
  view.setUint16(32, 1, true)
  view.setUint16(34, 8, true) // 8 bit
  text(36, 'data')
  view.setUint32(40, samples, true)
  new Uint8Array(buffer, 44).fill(128) // the 8-bit middle line: silence
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }))
}

const peaks = (seed) =>
  Array.from({ length: 240 }, (_, index) => {
    const breath = Math.abs(Math.sin((index + seed) / 7)) * 0.6 + Math.abs(Math.sin((index + seed) / 2.3)) * 0.4
    return (index + seed) % 37 > 33 ? 0.05 : Math.min(1, 0.12 + breath * 0.8)
  })

/* The kinds of conversation: what a new recording takes over ----------------------------- */

const KINDS = {
  vergadering: {
    label: 'Vergadering',
    text: 'Samenvatting en actiepunten na afloop.',
  },
  hoorzitting: {
    label: 'Hoorzitting',
    text: 'Voorzitter en bezwaarmaker · letterlijk, geen samenvatting.',
  },
  briefing: {
    label: 'Briefing',
    text: 'Samenvatting als lijst.',
  },
  interview: {
    label: 'Interview',
    text: 'Samenvatting per vraag.',
  },
  dictaat: {
    label: 'Dictaat',
    text: 'Leestekens uitspreken (“punt”, “nieuwe alinea”) · geen samenvatting.',
  },
}
const kindOf = (value) => (KINDS[value] ? value : 'vergadering')

/* The recordings as the server keeps them ---------------------------------------------------- */

/** A segment whose `unsure` words the recogniser was unsure of. */
function segment(id, start, speaker, text, unsure = []) {
  const uncertain = unsure.map((word) => {
    const at = text.indexOf(word)
    return [at, at + word.length]
  })
  return { id, start, speaker, text, uncertain }
}

const TEAM_MEETING = [
  segment('s1', 0, 'Ploegleider', 'Goedemorgen allemaal. Dan het rooster voor volgende week.'),
  segment('s2', 14, 'Ploegleider', 'De ochtenddienst begint maandag een half uur eerder, om zes uur.'),
  segment('s3', 31, 'Spreker 2', 'Is dat afgestemd met de roostermaker? Vorige keer liep dat mis bij de avondploeg.', [
    'roostermaker',
    'avondploeg',
  ]),
  segment('s4', 52, 'Ploegleider', 'Nog niet. Ik stuur vandaag een bericht en vraag of het rooster vóór vrijdag rond kan zijn.'),
  segment('s5', 75, 'Spreker 3', 'Ik neem contact op en koppel het donderdag terug in het overleg.'),
  segment('s6', 96, 'Spreker 2', 'Dan het tweede punt: de nieuwe scanners bij de balie.'),
  segment('s7', 118, 'Spreker 3', 'Die worden in week 42 geplaatst. De training volgt een week later.', ['week 42']),
  segment('s8', 147, 'Ploegleider', 'Wie neemt de training op zich?'),
  segment('s9', 160, 'Spreker 2', 'Ik doe de eerste groep. De tweede groep plannen we na de evaluatie.'),
  segment('s10', 189, 'Ploegleider', 'Goed. Rooster, scanners en training staan op de lijst voor vrijdag.'),
  segment('s11', 221, 'Spreker 3', 'Prima. Tot vrijdag.'),
]

/** What a recording without a transcript of its own reads, once done. */
const GENERIC = [
  segment('g1', 0, 'Spreker 1', 'Goedemiddag. Ik loop kort de punten van vandaag langs.'),
  segment('g2', 18, 'Spreker 2', 'Begin maar met de overdracht, daar zijn de meeste vragen over.'),
  segment('g3', 41, 'Spreker 1', 'De overdracht gaat vanaf maandag via het nieuwe formulier.', ['formulier']),
  segment('g4', 66, 'Spreker 2', 'Helder. Dan zet ik dat vandaag nog in het teambericht.'),
  segment('g5', 92, 'Spreker 1', 'Dank je. Dan sluiten we hier af.'),
]

/** What a live session hears, one sentence every few seconds; the fifth holds an action point. */
const LIVE_LINES = [
  ['Spreker 1', 'Goed, we beginnen. Iedereen is er, op twee mensen na.'],
  ['Spreker 2', 'Die sluiten om half tien aan, ze staan nog bij de balie.'],
  ['Spreker 1', 'Eerste punt is de bezetting in het weekend.'],
  ['Spreker 3', 'Zaterdag is rond. Voor zondag missen we nog één persoon in de middag.'],
  ['Spreker 1', 'Dan vraag ik het vanmiddag rond in de groep; melden vóór vier uur.'],
  ['Spreker 2', 'Tweede punt: de sleutels van de nieuwe ruimte zijn binnen.'],
]
const LIVE_NAME = 'Weekendbezetting en sleutels'

/** The AI work of a done recording; what is not made yet has no `items`. */
function aiWork(id) {
  const meeting = id === 'j2'
  return {
    samenvatting: {
      kort: meeting
        ? 'De ochtenddienst begint maandag om zes uur; de roostermaker is nog niet ingelicht. De scanners bij de balie komen in week 42, de training een week later.'
        : 'De overdracht verloopt vanaf maandag via een nieuw formulier.',
      uitgebreid: meeting
        ? 'De ploegleider opent met het rooster: de ochtenddienst begint vanaf maandag een half uur eerder. Spreker 2 vraagt of dat is afgestemd met de roostermaker, omdat het eerder misging bij de avondploeg; de ploegleider stuurt vandaag een bericht. Spreker 3 meldt dat de scanners in week 42 komen en de training een week later volgt. Spreker 2 geeft de eerste groep.'
        : 'Spreker 1 loopt de punten langs. De overdracht gaat vanaf maandag via het nieuwe formulier; spreker 2 zet dat vandaag in het teambericht.',
      sprekers: meeting
        ? 'Ploegleider: brengt de nieuwe begintijd in en regelt de afstemming. Spreker 2: vraagt naar de afstemming en geeft de eerste training. Spreker 3: meldt de planning van de scanners.'
        : 'Spreker 1: licht de overdracht toe. Spreker 2: zet het in het teambericht.',
    },
    acties: meeting
      ? [
          { id: 'a1', title: 'Bericht sturen aan de roostermaker over de nieuwe begintijd', sub: 'Ploegleider · vandaag', at: 52 },
          { id: 'a2', title: 'Terugkoppelen in het overleg', sub: 'Spreker 3 · donderdag', at: 75 },
          { id: 'a3', title: 'Eerste trainingsgroep geven', sub: 'Spreker 2 · week 43', at: 160 },
        ]
      : [{ id: 'a1', title: 'Wijziging in het teambericht zetten', sub: 'Spreker 2 · vandaag', at: 66 }],
    entiteiten: meeting
      ? [
          { id: 'e1', title: 'de roostermaker', sub: 'Persoon · 2×', at: 31 },
          { id: 'e2', title: 'de avondploeg', sub: 'Groep · 1×', at: 31 },
          { id: 'e3', title: 'de balie', sub: 'Plaats · 1×', at: 96 },
          { id: 'e4', title: 'de nieuwe scanners', sub: 'Voorwerp · 2×', at: 96 },
        ]
      : [{ id: 'e1', title: 'het nieuwe formulier', sub: 'Document · 1×', at: 41 }],
    notulen: null,
    besluiten: null,
  }
}

const USER = { name: 'J. de Vries', role: 'Teamleider · Afdeling Planning', initials: 'JV' }

let recordings = [
  { id: 'j3', name: 'Interview 3', file: 'Interview 3.wav', state: 'error', reason: 'Het bestand is beschadigd', duration: 1865, kind: 'interview', uploaded: 'vandaag om 09:20' },
  { id: 'j1', name: 'Briefing ochtenddienst', file: 'Briefing ochtenddienst.m4a', state: 'busy', progress: 62, duration: 1120, kind: 'briefing', uploaded: 'vandaag om 09:40', segments: GENERIC },
  {
    id: 'j2',
    name: 'Teamoverleg 2 oktober',
    file: 'Teamoverleg 2 oktober.m4a',
    state: 'done',
    duration: 252,
    doneAt: '09:31',
    kind: 'vergadering',
    uploaded: 'vandaag om 09:14',
    segments: TEAM_MEETING,
    ai: aiWork('j2'),
  },
].map((item) => ({ language: 'Nederlands (herkend)', ...item }))

const find = (id) => recordings.find((item) => item.id === id)
let openId = params.get('opname') ?? (DEMO ? 'j2' : null)
if (DEMO && !params.has('q')) params.set('q', 'rooster')

/** A queued recording's place: the list is newest first, the queue oldest first. */
const placeOf = (id) =>
  recordings
    .filter((item) => item.state === 'queued')
    .reverse()
    .findIndex((item) => item.id === id) + 1

function changeRecording(id, change) {
  recordings = recordings.map((item) => (item.id === id ? { ...item, ...change } : item))
  render()
}

/* The shell -------------------------------------------------------------------------------- */

const shell = $('shell')
const NAVIGATION = [
  { label: 'Start', href: './', page: null },
  { label: 'Opnames', href: '?pagina=opnames', page: 'opnames' },
  { label: 'Woordenlijsten', href: '?pagina=woordenlijsten', page: 'woordenlijsten' },
  { label: 'Instellingen', href: '?pagina=instellingen', page: 'instellingen' },
]
const PAGES = ['opnames', 'woordenlijsten', 'instellingen']
const pageOf = () => (PAGES.includes(params.get('pagina')) ? params.get('pagina') : null)
let notifications = [
  { id: 'n2', title: 'Transcriptie klaar', text: 'Teamoverleg 2 oktober', when: 'vandaag om 09:31', unread: DEMO, recording: 'j2' },
  { id: 'n1', title: 'Download klaar', text: 'Overdracht nachtdienst.docx', when: 'gisteren om 16:05' },
]

function renderShell() {
  const dark = root.dataset.mode === 'dark'
  shell.data = {
    name: 'Transcriptie',
    emblem: emblem(theme),
    navigation: NAVIGATION.map(({ page, ...link }) => ({ ...link, active: page === pageOf() })),
    user: USER,
    userMenu: [
      { value: 'modus', label: dark ? 'Lichte modus' : 'Donkere modus', icon: dark ? 'natuur-en-milieu-zon' : 'functioneel-darkmode' },
      { value: 'start', label: 'Lintje-startpagina', icon: 'functioneel-home' },
    ],
    version: '1.0.0',
    notifications,
  }
}

function notify(title, text, recording) {
  notifications = [{ id: `n${Date.now()}`, title, text, when: 'zojuist', unread: true, recording }, ...notifications]
  renderShell()
}

shell.addEventListener('lintje-navigate', (event) => {
  event.preventDefault()
  if (event.target !== shell) return
  const link = NAVIGATION.find((entry) => entry.href === event.detail.href)
  openPage(link?.page ?? null)
})
shell.addEventListener('lintje-action', (event) => {
  const value = event.detail?.value ?? event.detail
  if (value === 'start') location.href = carry('../')
  if (value !== 'modus') return
  // The mode is in the URL; the page loads again in the other one.
  setParam('mode', root.dataset.mode === 'dark' ? 'light' : 'dark')
  location.reload()
})
shell.addEventListener('lintje-logout', () => toast('Afmelden kan niet in dit voorbeeld.'))
shell.addEventListener('lintje-notification-open', (event) => {
  event.preventDefault()
  const opened = notifications.find((item) => item.id === event.detail.id)
  notifications = notifications.map((item) => (item.id === event.detail.id ? { ...item, unread: false } : item))
  renderShell()
  if (opened?.recording) openRecording(opened.recording)
})
shell.addEventListener('lintje-notifications-read', () => {
  notifications = notifications.map((item) => ({ ...item, unread: false }))
  renderShell()
})

/* A new recording: the kind, the source and what differs this once ------------------------ */

const soort = $('soort')
soort.options = Object.entries(KINDS).map(([value, kind]) => ({ value, label: kind.label, description: kind.text }))
soort.value = kindOf(params.get('soort'))
soort.addEventListener('lintje-change', (event) => {
  setParam('soort', event.detail === 'vergadering' ? null : event.detail)
  fillFromKind()
  renderStart()
})

/** The way in: live or a file, `?nieuw` in the URL. */
const way = $('way')
way.value = params.get('nieuw') === 'bestand' ? 'bestand' : 'live'
function chooseWay(value) {
  way.value = value
  setParam('nieuw', value === 'bestand' ? 'bestand' : null)
  renderStart()
}
way.addEventListener('lintje-tab-change', (event) => chooseWay(event.detail))

/** Where a live recording records: this computer or the phone, `?bron` in the URL. */
const bron = $('bron')
bron.options = [
  { value: 'computer', label: 'Deze computer' },
  { value: 'telefoon', label: 'Mijn telefoon' },
]
bron.value = params.get('bron') === 'telefoon' ? 'telefoon' : 'computer'
function chooseSource(value) {
  bron.value = value
  setParam('bron', value === 'telefoon' ? 'telefoon' : null)
  renderStart()
}
bron.addEventListener('lintje-change', (event) => chooseSource(event.detail))

const LANGUAGES = [
  { value: 'auto', label: 'Automatisch (één taal)' },
  { value: 'meertalig', label: 'Automatisch (meerdere talen)' },
  { value: 'nl', label: 'Nederlands' },
  { value: 'en', label: 'Engels' },
  { value: 'fr', label: 'Frans' },
  { value: 'de', label: 'Duits' },
  { value: 'ar', label: 'Arabisch' },
]
for (const id of ['language', 're-language']) {
  $(id).options = LANGUAGES
  $(id).value = 'auto'
}
$('mic').options = [
  { value: 'usb', label: 'Vergaderset (USB)' },
  { value: 'intern', label: 'Ingebouwde microfoon' },
]
$('mic').value = 'usb'
$('spk-mode').options = [
  { value: 'auto', label: 'Automatisch' },
  { value: 'vast', label: 'Vast aantal' },
]
$('spk-mode').value = 'auto'
$('lists').options = [
  { value: 'afkortingen', label: 'Afkortingen Rijksoverheid', description: '312 woorden' },
  { value: 'team', label: 'Namen team Planning', description: '24 woorden' },
  { value: 'locaties', label: 'Locaties rijkskantoor', description: '58 woorden' },
]
$('lists').selected = ['afkortingen', 'team']
/** The number of speakers, 1 to 12: a range while it is recognised, one value when it is fixed. */
const SPEAKER_STEPS = Array.from({ length: 12 }, (_, index) => index + 1)
for (const id of ['spk-range', 'spk-one', 'st-spk-range', 'st-spk-one']) $(id).steps = SPEAKER_STEPS
// The range only asks; the page holds the handles.
$('spk-range').addEventListener('lintje-change', (event) => ([$('spk-range').from, $('spk-range').to] = event.detail))
$('spk-one').addEventListener('lintje-change', (event) => ($('spk-one').value = event.detail))
for (const id of ['spk-mode', 'language', 'mic', 'spk-range', 'spk-one', 'lists', 'soft', 'own-name']) {
  $(id).addEventListener('lintje-change', renderStart)
}
/* This recording: filled with the kind's defaults, changed in the drawer for this one only. */
const adjust = $('adjust')
const MIC_STATES = ['eerste-keer', 'stil', 'geen-toegang']
/** The microphone as the browser reports it; in this example `?microfoon=` plays the other states. */
let micState = MIC_STATES.includes(params.get('microfoon')) ? params.get('microfoon') : 'ok'

/** The kind's defaults, as the fields of a new recording take them. */
function defaultsOf(kindKey) {
  const kind = kindSettings[kindKey]
  return {
    language: kind.language,
    mode: kind.mode === 'auto' ? 'auto' : 'vast',
    min: kind.min,
    max: kind.max,
    count: kind.count,
    lists: kind.lists,
    soft: kind.soft,
    mic: 'usb',
  }
}

function setSpeakers({ min, max, count }) {
  $('spk-range').from = min - 1
  $('spk-range').to = max - 1
  $('spk-one').value = count
}
/** The speakers as the drawer holds them, in people. */
const speakersNow = () => ({ min: $('spk-range').from + 1, max: $('spk-range').to + 1, count: Number($('spk-one').value) })

function fillFromKind() {
  const defaults = defaultsOf(soort.value)
  $('language').value = defaults.language
  $('spk-mode').value = defaults.mode
  setSpeakers(defaults)
  $('lists').selected = [...defaults.lists]
  $('soft').checked = defaults.soft
}

/** Per field, whether this recording differs from its kind's defaults. */
function changes() {
  const defaults = defaultsOf(soort.value)
  const fixed = $('spk-mode').value === 'vast'
  const sorted = (values) => [...values].sort().join()
  return {
    name: Boolean($('own-name').value?.trim()),
    language: $('language').value !== defaults.language,
    speakers:
      $('spk-mode').value !== defaults.mode ||
      (fixed
        ? speakersNow().count !== defaults.count
        : speakersNow().min !== defaults.min || speakersNow().max !== defaults.max),
    mic: $('mic').value !== defaults.mic,
    lists: sorted($('lists').selected ?? []) !== sorted(defaults.lists),
    soft: Boolean($('soft').checked) !== defaults.soft,
  }
}

function resetField(field) {
  const defaults = defaultsOf(soort.value)
  if (field === 'name') $('own-name').value = ''
  if (field === 'language') $('language').value = defaults.language
  if (field === 'speakers') {
    $('spk-mode').value = defaults.mode
    setSpeakers(defaults)
  }
  if (field === 'mic') $('mic').value = defaults.mic
  if (field === 'lists') $('lists').selected = [...defaults.lists]
  if (field === 'soft') $('soft').checked = defaults.soft
  renderStart()
}

$('adjust-open').addEventListener('click', () => (adjust.open = true))
adjust.addEventListener('lintje-close', () => (adjust.open = false))
$('adjust-done').addEventListener('click', () => (adjust.open = false))
$('adjust-reset').addEventListener('click', () => {
  for (const field of ['name', 'language', 'speakers', 'mic', 'lists', 'soft']) resetField(field)
})
for (const [id, field] of [['own-name', 'name'], ['language', 'language'], ['spk-mode', 'speakers'], ['mic', 'mic'], ['lists', 'lists'], ['soft', 'soft']]) {
  $(id).addEventListener('lintje-reset', () => resetField(field))
}
$('this-summary').addEventListener('lintje-navigate', (event) => {
  event.preventDefault()
  resetField(event.detail.href.replace('#terug-', ''))
})
$('mic').addEventListener('lintje-change', () => {
  if (micState === 'stil') micState = 'ok'
  renderStart()
})
// "Andere microfoon" opens the drawer at the choice; testing again ends the other two states.
$('mic-action').addEventListener('click', () => {
  if (micState === 'stil') adjust.open = true
  else {
    micState = 'ok'
    renderStart()
  }
})

/** The new recording's language, as it is kept. */
function languageOfNew() {
  const value = $('language').value
  if (value === 'auto') return 'Nederlands (herkend)'
  if (value === 'meertalig') return 'Nederlands en Engels (herkend)'
  return LANGUAGES.find((item) => item.value === value).label
}

/** A name until the conversation suggests a better one. */
const autoName = () => $('own-name').value?.trim() || `${KINDS[soort.value].label} ${today()} ${clock()}`

/** What the QR code opens; fictional, as the code is. */
const PHONE_URL = 'https://transcriptie.voorbeeld.nl/telefoon'

/* The preview beside the hero stands in it only while a recording runs: a slotted element is a column. */
const preview = $('running-preview')
preview.remove()

/** "Deze opname": each field with its value, what was changed and a way back; the microphone's state. */
function renderThisRecording(kind) {
  const defaults = defaultsOf(soort.value)
  const changed = changes()
  const fixed = $('spk-mode').value === 'vast'
  $('spk-one').hidden = !fixed
  $('spk-range').hidden = fixed
  const speakersOf = (mode, min, max, count) => (mode === 'vast' ? `${count}, vast` : `${min} tot ${max}`)
  const labelOf = (field, value) => $(field).options.find((item) => item.value === value)?.label ?? ''
  const tone = (field) => (changed[field] ? 'changed' : undefined)
  const back = (field, word) => (changed[field] ? { href: `#terug-${field}`, label: `Terugzetten naar ${word}` } : undefined)
  const now = speakersNow()
  const word = {
    language: labelOf('language', defaults.language).toLowerCase(),
    speakers: speakersOf(defaults.mode, defaults.min, defaults.max, defaults.count),
    mic: labelOf('mic', defaults.mic),
    lists: 'de standaard',
    soft: defaults.soft ? 'aan' : 'uit',
  }
  const micName = labelOf('mic', $('mic').value)
  const micTone = { stil: 'warning', 'geen-toegang': 'error' }[micState] ?? tone('mic')
  $('this-summary').items = [
    {
      label: 'Naam',
      icon: 'functioneel-bewerken',
      span: 2,
      value: $('own-name').value?.trim() || 'Wordt voorgesteld uit het gesprek',
      tone: tone('name'),
      action: changed.name ? { href: '#terug-name', label: 'Leegmaken' } : undefined,
    },
    { label: 'Taal', icon: 'internationaal-tekstballon-met-wereldbol', value: labelOf('language', $('language').value), tone: tone('language'), action: back('language', word.language) },
    { label: 'Sprekers', icon: 'activiteiten-personen-in-gesprek', value: speakersOf($('spk-mode').value, now.min, now.max, now.count), tone: tone('speakers'), action: back('speakers', word.speakers) },
    {
      label: 'Microfoon',
      icon: 'beeld-en-geluid-microfoon',
      span: 2,
      value: { stil: `${micName}: we horen niets`, 'geen-toegang': 'Geen toegang tot je microfoon' }[micState] ?? micName,
      tone: micTone,
      slot: 'mic',
      action: micState === 'ok' ? back('mic', word.mic) : undefined,
    },
    {
      label: 'Woordenlijsten',
      icon: 'op-kantoor-document-met-lijnen',
      span: 2,
      tags: ($('lists').selected ?? []).map((value) => labelOf('lists', value)),
      tone: tone('lists'),
      action: back('lists', word.lists),
    },
    ...(changed.soft || $('soft').checked
      ? [{ label: 'Zachte spraak', span: 2, value: $('soft').checked ? 'Versterkt' : 'Niet versterkt', tone: tone('soft'), action: back('soft', word.soft) }]
      : []),
  ]
  const anyChange = Object.values(changed).some(Boolean)
  const standard = anyChange ? `De standaard van ${kind.label}, met wat je aanpaste` : `De standaard van ${kind.label}`
  $('summary-head').html = `<h3>Deze opname</h3><p>${standard}</p>`
  adjust.subtitle = `Ingevuld met de standaard van ${kind.label}. Wat je hier wijzigt, geldt alleen voor deze opname.`

  // In the drawer each changed field is marked and offers its way back.
  for (const [field, id] of [['name', 'own-name'], ['language', 'language'], ['speakers', 'spk-mode'], ['mic', 'mic'], ['lists', 'lists'], ['soft', 'soft']]) {
    $(id).modified = changed[field]
    $(id).resetLabel = field === 'name' ? 'Leegmaken' : `Terugzetten naar ${word[field]}`
  }
  $('mic').hint = micState === 'stil' ? 'We horen niets van deze microfoon. Kies een andere, of zeg iets om te testen.' : ''

  const help = {
    'eerste-keer': ['Je browser vraagt één keer of Transcriptie de microfoon mag gebruiken.', 'Microfoon testen'],
    stil: ['Staat hij aan, of is hij gedempt? Zeg iets om te testen.', 'Andere microfoon'],
    'geen-toegang': ['Klik op het slotje links van het adres, zet Microfoon op Toestaan en probeer het opnieuw.', 'Opnieuw proberen'],
  }[micState]
  $('mic-help').hidden = $('mic-action').hidden = !help
  if (help) {
    $('mic-help').text = help[0]
    $('mic-action').textContent = help[1]
  }
  $('mic-level').hidden = $('drawer-level').hidden = micState === 'eerste-keer' || micState === 'geen-toegang'

  const note = {
    ok: 'Naam en sprekers kun je na afloop nog wijzigen.',
    'eerste-keer': 'Bij het starten vraagt je browser om de microfoon.',
    stil: 'Starten kan, maar zonder geluid blijft het transcript leeg.',
    'geen-toegang': 'Starten kan zodra Transcriptie je microfoon mag gebruiken.',
  }[micState]
  $('start-note').text = note
  $('record').reason = micState === 'geen-toegang' ? note : ''
}

/* The sound as the microphone hears it; in this example a voice that comes and goes. */
setInterval(
  () => {
    const level = micState === 'ok' ? (DEMO ? 0.6 : 0.3 + Math.random() * 0.6) : micState === 'stil' ? 0 : null
    $('mic-level').level = $('drawer-level').level = level
    const live = recordings.find((item) => item.state === 'live')
    if (live) $('live-status').level = live.paused ? 0 : DEMO ? 0.6 : 0.3 + Math.random() * 0.6
  },
  DEMO ? 1000 : 180,
)

function renderStart() {
  const kind = KINDS[soort.value]
  const phone = bron.value === 'telefoon'
  renderThisRecording(kind)
  $('start-foot').hidden = phone
  $('phone-steps').html =
    '<h3>Neem op met je telefoon</h3><ol><li>Scan de code met de camera van je telefoon.</li><li>Kies daar Opname starten. Je bent met hetzelfde account ingelogd.</li><li>De opname verschijnt hier vanzelf en je leest mee.</li></ol>'
  $('phone-wait').data = {
    kind: 'info',
    title: 'Wacht op je telefoon…',
    text: 'Zodra je daar op Opname starten drukt, staat de opname hier.',
  }
  $('phone-address').text = `Lukt scannen niet? Ga op je telefoon naar ${PHONE_URL.replace('https://', '')}`

  // A recording on the phone takes the hero: whoever opens this page then mostly comes to read along.
  const running = recordings.find((item) => item.state === 'live' && item.phone)
  $('phone-info').hidden = $('phone-simulate').hidden = !phone || Boolean(running)
  $('source-status').text = running
    ? `${running.name} loopt op je telefoon; met Meelezen volg je hem hier.`
    : ''
  $('source-status').hidden = !$('source-status').text
  $('upload-note').text = `Het transcriberen begint zodra een bestand binnen is; meerdere tegelijk kan. Soort gesprek: ${kind.label} · taal wordt herkend.`
  // A recording on the phone takes the hero: its name, how it is doing and what is said now.
  const hero = $('hero')
  hero.heading = running ? running.name : 'Wat wil je transcriberen?'
  hero.description = running
    ? `Op je telefoon · ${KINDS[running.kind].label} · gestart ${running.uploaded}`
    : 'Neem een gesprek live op, hier of met je telefoon, of upload een opname. Je leest mee terwijl er gesproken wordt en werkt het transcript achteraf bij.'
  hero.action = running ? undefined : 'Of bekijk al je opnames'
  $('running-badge').hidden = $('running').hidden = !running
  if (running) {
    $('running-status').elapsed = running.duration
    $('running-status').level = running.paused ? 0 : 0.35 + ((running.duration * 7) % 10) / 20
    preview.querySelector('lintje-transcript').segments = running.segments.slice(-3)
    if (!preview.isConnected) hero.append(preview)
  } else preview.remove()
  $('live-busy').hidden = !running
  $('live-busy').data = {
    kind: 'info',
    title: 'Er loopt al een opname.',
    text: 'Een tweede live opname start je zodra deze gestopt is; een bestand uploaden kan intussen gewoon.',
  }
  $('record').disabled = Boolean(running) || micState === 'geen-toegang'
  $('this-recording').hidden = phone || Boolean(running)
  $('start-note').hidden = Boolean(running)
  $('choices').hidden = Boolean(running)
  way.tabs = [
    { value: 'live', label: 'Live opnemen', icon: 'beeld-en-geluid-microfoon', hint: 'Nu, op deze computer of met je telefoon', badge: running ? 'Loopt' : undefined },
    { value: 'bestand', label: 'Bestand transcriberen', icon: 'functioneel-upload', hint: 'Een opname die al gemaakt is' },
  ]
}
$('phone-stop').addEventListener('click', () => endLive(true))
$('phone-follow').addEventListener('click', () => {
  const running = recordings.find((item) => item.state === 'live' && item.phone)
  if (running) openRecording(running.id)
})

/* There is no phone here: the reader starts its recording by hand, and nothing jumps on its own. */
$('phone-simulate').addEventListener('click', () => {
  if (!recordings.some((item) => item.state === 'live')) startLive({ phone: true })
})

/* Files: the upload, then a place in the queue; the first one opens when nothing is open. */
const upload = $('upload')
let uploads = 0
upload.addEventListener('lintje-files-add', (event) => {
  for (const file of event.detail) {
    const id = `u${(uploads += 1)}`
    upload.files = [...(upload.files ?? []), { id, name: file.name, size: file.size, state: 'busy', progress: 0 }]
    const timer = setInterval(() => {
      const row = upload.files.find((item) => item.id === id)
      if (!row) return clearInterval(timer)
      const progress = Math.min(100, row.progress + 25)
      if (progress < 100) {
        upload.files = upload.files.map((item) => (item.id === id ? { ...item, progress } : item))
        return
      }
      clearInterval(timer)
      // In the list it is a recording; the upload row has done its job.
      upload.files = upload.files.filter((item) => item.id !== id)
      recordings = [
        {
          id: `j-${id}`,
          name: file.name.replace(/\.[a-z0-9]+$/i, ''),
          file: file.name,
          state: 'queued',
          duration: 98,
          kind: soort.value,
          language: languageOfNew(),
          uploaded: `vandaag om ${clock()}`,
        },
        ...recordings,
      ]
      if (!find(openId)) openRecording(`j-${id}`)
      else render()
    }, 300)
  }
})
dropRemovedFiles(upload)

/* Live: the session is a recording that grows; stopping keeps it and it opens as done. ---- */

let liveTimer = 0

function startLive({ phone = false } = {}) {
  const id = `live-${Date.now()}`
  let line = 0
  recordings = [
    {
      id,
      name: autoName(),
      named: Boolean($('own-name').value?.trim()),
      state: 'live',
      live: true,
      phone,
      paused: false,
      duration: 0,
      segments: [],
      kind: soort.value,
      language: languageOfNew(),
      uploaded: `vandaag om ${clock()}`,
    },
    ...recordings,
  ]
  if (!phone) openRecording(id)
  else {
    render()
    notify('Opname gestart op je telefoon', find(id).name, id)
  }
  liveTimer = setInterval(() => {
    const item = find(id)
    if (!item || item.state !== 'live' || item.paused) return
    const seconds = item.duration + 1
    const change = { duration: seconds }
    if (seconds % 3 === 0 && line < LIVE_LINES.length) {
      change.segments = [...item.segments, segment(`l${line}`, seconds - 2, ...LIVE_LINES[line])]
      line += 1
    }
    // After a few sentences the conversation names itself; a name of one's own stays.
    if (seconds === 10 && !item.named) {
      change.name = LIVE_NAME
      change.wasName = item.name
      toast(`Naam voorgesteld uit het gesprek: ${LIVE_NAME}. Wijzigen kan altijd.`)
    }
    changeRecording(id, change)
    if (id === openId && change.segments) {
      renderTranscript()
      if (following) transcript.currentTime = change.segments.at(-1).start
    }
  }, 1000)
}
$('record').addEventListener('click', () => startLive())

function endLive(keep) {
  const item = recordings.find((other) => other.state === 'live')
  clearInterval(liveTimer)
  if (!item) return
  if (!keep) return changeRecording(item.id, { state: 'cancelled', cancelledAt: clock() })
  changeRecording(item.id, { state: 'done', doneAt: clock(), ai: aiWork(item.id) })
  toast(`${item.name} is bewaard.`)
}

const pause = $('pause')
pause.addEventListener('click', () => {
  const item = find(openId)
  if (item) changeRecording(item.id, { paused: !item.paused })
})
$('stop').addEventListener('click', () => endLive(true))

/* The list of recordings --------------------------------------------------------------------- */

const queue = $('queue')

function jobOf(item) {
  // The icon says how it was made, live or from a file; the moment stands on the right, and
  // what still runs stands apart from what is done.
  const running = ['live', 'queued', 'busy'].includes(item.state)
  const base = {
    id: item.id,
    name: item.name,
    icon: item.live ? 'beeld-en-geluid-microfoon' : 'functioneel-upload',
    meta: item.uploaded.replace(' om ', ' '),
    group: running ? 'Nu bezig' : item.uploaded.startsWith('vandaag') ? 'Vandaag' : 'Eerder',
  }
  switch (item.state) {
    case 'live':
      return { ...base, state: 'busy', progress: null, detail: `Live${item.phone ? ' · telefoon' : ''} · ${mmss(item.duration)}`, href: hrefWith('opname', item.id) }
    case 'queued':
      return { ...base, state: 'queued', detail: `Plaats ${placeOf(item.id)} in de wachtrij` }
    case 'busy':
      return { ...base, state: 'busy', progress: item.progress, detail: `Transcriberen · ${item.progress}%`, href: hrefWith('opname', item.id) }
    case 'done': {
      const speakers = new Set(item.segments.map((part) => part.speaker)).size
      return {
        ...base,
        state: 'done',
        href: hrefWith('opname', item.id),
        detail: `${KINDS[item.kind].label} · ${mmss(item.duration)} · ${plural(speakers, 'spreker', 'sprekers')}`,
      }
    }
    case 'error':
      return { ...base, state: 'error', detail: item.reason }
    default:
      return { ...base, state: 'cancelled', detail: `Geannuleerd om ${item.cancelledAt}` }
  }
}

function renderJobs() {
  // A heading stands over consecutive rows, so the groups go in their order: running first.
  const order = ['Nu bezig', 'Vandaag', 'Eerder']
  const jobs = recordings.map(jobOf).sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group))
  // The start page shows the latest; the recordings page all of them.
  queue.jobs = jobs.slice(0, 4)
  allJobs.jobs = jobs
}

const allJobs = $('all-jobs')

/** Both lists of recordings answer alike: a done row opens it on this page, without a reload. */
function wireJobs(list) {
  list.addEventListener('lintje-navigate', (event) => {
    event.preventDefault()
    openRecording(new URL(event.detail.href, location.href).searchParams.get('opname'))
  })
  list.addEventListener('lintje-job-cancel', (event) => {
    if (find(event.detail)?.state === 'live') return endLive(false)
    changeRecording(event.detail, { state: 'cancelled', progress: null, cancelledAt: clock() })
  })
  list.addEventListener('lintje-job-retry', (event) => changeRecording(event.detail, { state: 'queued', progress: null }))
  list.addEventListener('lintje-job-remove', (event) => {
    recordings = recordings.filter((item) => item.id !== event.detail)
    if (event.detail === openId) openRecording(null)
    else render()
  })
}
wireJobs(queue)
wireJobs(allJobs)

/** One step of the server: the busy job moves on; when none runs, the next one starts. */
function tick() {
  const busy = recordings.find((item) => item.state === 'busy')
  if (!busy) {
    const next = recordings.findLast((item) => item.state === 'queued')
    // What it transcribes appears as it goes: the fragments are there, shown up to the progress.
    if (next) changeRecording(next.id, { state: 'busy', progress: 0, segments: next.segments ?? GENERIC })
    return
  }
  const progress = Math.min(100, busy.progress + 4)
  if (progress < 100) return changeRecording(busy.id, { progress })
  changeRecording(busy.id, { state: 'done', progress: null, doneAt: clock(), segments: busy.segments ?? GENERIC, ai: aiWork(busy.id) })
  notify('Transcriptie klaar', busy.name, busy.id)
  if (busy.id !== openId) toast(`${busy.name} is getranscribeerd.`)
}

/* Downloads and copies: the usual format on the button, the other ways under its arrow. ---- */
const FORMATS = [
  { value: 'docx', label: 'Word-document', hint: '.docx' },
  { value: 'pdf', label: 'PDF', hint: '.pdf' },
  { value: 'txt', label: 'Platte tekst', hint: '.txt' },
  { value: 'srt', label: 'Ondertiteling', hint: '.srt' },
  { value: 'json', label: 'Gegevens voor andere systemen', hint: '.json' },
]
const exportMenu = $('export')
const aiMenu = $('ai-menu')

function renderExport(item) {
  const busy = item?.state === 'busy'
  const format = FORMATS.find((entry) => entry.value === general.format) ?? FORMATS[0]
  exportMenu.action = format.value
  exportMenu.items = busy
    ? [{ heading: 'Downloaden' }, { value: 'audio', label: 'Audio', hint: '.m4a' }]
    : [
        { heading: 'Kopiëren' },
        { value: 'copy:transcript', label: 'Transcript' },
        { value: 'copy:alles', label: 'Transcript en AI-bewerkingen' },
        'separator',
        { heading: 'Downloaden' },
        ...FORMATS.filter((entry) => entry.value !== format.value && entry.value !== 'json' && entry.value !== 'txt'),
        { value: 'audio', label: 'Audio', hint: '.m4a' },
        'separator',
        { value: 'zelf', label: 'Zelf samenstellen…' },
      ]
}

/** The text a copy or a download holds: the note first, then the AI work shown, then the fragments. */
function textOf(item, { ai = true, times = true, names = true } = {}) {
  const lines = [NOTE, '']
  if (ai) {
    for (const kind of AI_KINDS) {
      const content = aiContent(item, kind.id)
      if (!content || hiddenAi(item).has(kind.id)) continue
      lines.push(kind.label, ...(Array.isArray(content) ? content.map((row) => `- ${row.title}`) : [content]), '')
    }
  }
  for (const part of item.segments) {
    lines.push([times ? mmss(part.start) : '', names ? `${part.speaker}:` : '', part.text].filter(Boolean).join(' '))
  }
  return lines.join('\n')
}

function download(item, format, what = 'het transcript') {
  exportMenu.busyLabel = `${format.label} wordt gemaakt`
  setTimeout(() => {
    exportMenu.busyLabel = ''
    toast(`${item.name}${format.hint} is gedownload, met ${what}.`)
  }, 1200)
}

exportMenu.addEventListener('lintje-action', async (event) => {
  // The shell listens for its own menu's actions; this one ends here.
  event.stopPropagation()
  const item = find(openId)
  if (!item) return
  const value = String(event.detail)
  if (item.state === 'busy' && value !== 'audio') {
    return toast('Het transcript is nog niet klaar; de audio staat al onder het pijltje.', 'info')
  }
  if (value.startsWith('copy:')) {
    try {
      await navigator.clipboard.writeText(textOf(item, { ai: value === 'copy:alles' }))
      toast(value === 'copy:alles' ? 'Transcript en AI-bewerkingen gekopieerd.' : 'Transcript gekopieerd.')
    } catch {
      toast('Kopiëren is niet gelukt. Selecteer de tekst en kopieer hem zelf.', 'error')
    }
    return
  }
  if (value === 'zelf') return openDownload()
  if (value === 'audio') return download(item, { label: 'Audio', hint: '.m4a' }, 'de opname')
  download(item, FORMATS.find((entry) => entry.value === value) ?? FORMATS[0], 'het transcript en de AI-bewerkingen')
})

/* Zelf samenstellen: what goes in, the format, and one zip for more than one file. */
const downloadModal = $('download-modal')
const FORMAT_USES = { docx: 'Om verder te bewerken', pdf: 'Om te delen of te bewaren', txt: 'Zonder opmaak', srt: 'Alleen het transcript, met tijden' }
$('dl-format').options = FORMATS.filter((entry) => FORMAT_USES[entry.value]).map((entry) => ({ value: entry.value, label: `${entry.label} (${entry.hint})`, description: FORMAT_USES[entry.value] }))
function renderDownload() {
  const item = find(openId)
  if (!item) return
  const text = $('dl-transcript').checked || $('dl-ai').checked
  const shown = AI_KINDS.filter((kind) => aiContent(item, kind.id) && !hiddenAi(item).has(kind.id)).map((kind) => kind.label.toLowerCase())
  $('dl-ai').hint = shown.length ? `Wat boven het transcript staat: ${shown.join(', ')}` : 'Er staat geen AI-bewerking boven het transcript'
  $('dl-ai').disabled = !shown.length
  for (const id of ['dl-format', 'dl-in-text', 'dl-note']) $(id).hidden = !text
  const format = FORMATS.find((entry) => entry.value === $('dl-format').value) ?? FORMATS[0]
  const files = [...(text ? [`${item.name}${format.hint}`] : []), ...($('dl-audio').checked ? [`${item.name}.m4a`] : [])]
  $('dl-result').textContent = files.length === 0 ? 'Kies wat je wilt downloaden.' : files.length === 1 ? `Je krijgt ${files[0]}.` : `Je krijgt één zip met ${files.length} bestanden.`
  $('dl-save').disabled = files.length === 0
}
function openDownload() {
  $('dl-format').value = general.format === 'json' ? 'docx' : general.format
  renderDownload()
  downloadModal.open = true
}
for (const id of ['dl-transcript', 'dl-ai', 'dl-audio', 'dl-format', 'dl-times', 'dl-names']) $(id).addEventListener('lintje-change', renderDownload)
downloadModal.addEventListener('lintje-close', () => (downloadModal.open = false))
$('dl-cancel').addEventListener('click', () => (downloadModal.open = false))
$('dl-save').addEventListener('click', () => {
  downloadModal.open = false
  const item = find(openId)
  const text = $('dl-transcript').checked || $('dl-ai').checked
  const format = FORMATS.find((entry) => entry.value === $('dl-format').value) ?? FORMATS[0]
  if (text && $('dl-audio').checked) download(item, { label: 'Zip', hint: '.zip' }, 'de tekst en de opname')
  else if (text) download(item, format, $('dl-ai').checked ? 'het transcript en de AI-bewerkingen' : 'het transcript')
  else download(item, { label: 'Audio', hint: '.m4a' }, 'de opname')
})

/* The opened recording ----------------------------------------------------------------------- */

const pageHeader = $('page-header')
const crumbs = $('crumbs')
const player = $('player')
const transcript = $('transcript')
const NOTE = transcript.querySelector('[slot="note"]').textContent.trim()
let loadedId = null

/** One of the app's own pages, or the recordings (null). */
function openPage(page) {
  openId = null
  for (const key of ['opname', 'q', 'lijst', 'soort-instelling']) params.delete(key)
  setParam('pagina', page, true)
  renderShell()
  render()
}

function openRecording(id) {
  if (id === openId && !pageOf()) return
  params.delete('pagina')
  openId = id
  // A search belongs to the recording it was made in.
  params.delete('q')
  setParam('opname', id, true)
  render()
}

window.addEventListener('popstate', () => {
  params = new URLSearchParams(location.search)
  openId = params.get('opname')
  renderShell()
  render()
})
crumbs.addEventListener('lintje-navigate', (event) => {
  event.preventDefault()
  event.stopPropagation()
  openPage('opnames')
})
// To every recording, from the hero and from the latest ones; the page stays, and so does its state.
$('hero').addEventListener('lintje-navigate', (event) => {
  event.preventDefault()
  openPage('opnames')
})
$('all-recordings').addEventListener('click', (event) => {
  if (event.metaKey || event.ctrlKey || event.shiftKey) return
  event.preventDefault()
  openPage('opnames')
})

function describe(item) {
  const kind = KINDS[item.kind].label
  switch (item.state) {
    case 'live':
      return `${kind} · ${item.language}`
    case 'done': {
      const speakers = new Set(item.segments.map((part) => part.speaker)).size
      return `${kind} · ${mmss(item.duration)} · ${plural(speakers, 'spreker', 'sprekers')} · ${item.language} · ${item.live ? 'opgenomen' : 'geüpload'} ${item.uploaded}`
    }
    case 'busy':
      return `${kind} · ${mmss(item.duration)} · ${item.language} · geüpload ${item.uploaded} · bezig met transcriberen`
    default:
      return `${kind} · ${item.language} · geüpload ${item.uploaded}`
  }
}

/** The fragments there are so far: while it transcribes, the part that is done. */
function segmentsOf(item) {
  if (item.state !== 'busy') return item.segments ?? []
  const all = item.segments ?? GENERIC
  return all.slice(0, Math.max(1, Math.floor((all.length * item.progress) / 100)))
}

/** Everything that follows from which recording is open and how far it is. */
function renderOpen() {
  const page = pageOf()
  const item = page ? null : find(openId)
  const live = item?.state === 'live'
  const done = item?.state === 'done'
  const busy = item?.state === 'busy'
  $('hero').hidden = Boolean(item) || Boolean(page)
  // On the recordings page the hero is the heading.
  pageHeader.hidden = !item && !page
  $('rec-view').hidden = !item
  $('recordings-view').hidden = page !== 'opnames'
  $('words-view').hidden = page !== 'woordenlijsten'
  $('settings-view').hidden = page !== 'instellingen'

  const heading = page
    ? PAGE_HEADINGS[page]
    : item
      ? { title: item.name, description: describe(item) }
      : { title: 'Opnames' }
  if (JSON.stringify(heading) !== JSON.stringify(pageHeader.data)) {
    pageHeader.data = heading
    crumbs.hidden = !item
    if (item) crumbs.items = [{ label: 'Opnames', href: '?pagina=opnames' }, { label: item.name }]
  }
  pause.hidden = $('stop').hidden = !live
  $('reprocess').hidden = !done
  exportMenu.hidden = !(done || busy)
  aiMenu.hidden = !(done || busy)
  pageHeader.editable = Boolean(live || done || busy)
  $('live-head').hidden = $('follow').hidden = !live
  if (!item) return

  if (live) {
    pause.textContent = item.paused ? 'Hervatten' : 'Pauzeren'
    $('live-badge').tone = item.paused ? 'subtle' : 'live'
    $('live-badge').textContent = item.paused ? 'Gepauzeerd' : 'Neemt op'
    $('live-where').text = item.phone
      ? 'Op je telefoon. Je leest hier mee; pauzeren en stoppen kan op beide.'
      : 'Op deze computer'
    const status = $('live-status')
    status.elapsed = item.duration
    status.connection = item.phone ? 'good' : null
    status.delay = item.phone ? 2 : null
    $('live-named').hidden = !item.wasName
    $('live-name-note').text = `Naam voorgesteld uit het gesprek (was “${item.wasName}”).`
  }

  $('progress-tile').hidden = item.state !== 'queued'
  if (item.state === 'queued') {
    $('progress-tile').heading = 'In de wachtrij'
    $('progress').value = null
    $('progress').label = `Plaats ${placeOf(item.id)} in de wachtrij`
  }
  $('failed').hidden = !(item.state === 'error' || item.state === 'cancelled')
  $('failed').data = {
    kind: item.state === 'error' ? 'error' : 'info',
    title: item.state === 'error' ? 'Het transcriberen is mislukt.' : 'Opname geannuleerd.',
    text: item.state === 'error' ? `${item.reason}. Upload het bestand opnieuw of probeer het nog eens.` : '',
  }
  $('rec-panel').hidden = !(live || done || busy)
  $('dock').hidden = !(done || busy)
  $('processing').hidden = !busy
  $('pending').hidden = !busy
  if (busy) {
    $('processing-bar').value = item.progress
    $('processing-bar').label = `Bezig met transcriberen · nog ongeveer ${Math.max(1, Math.round(((100 - item.progress) * item.duration) / 6000))} minuten`
  }
  if ((live || done || busy) && loadedId !== `${item.id}:${item.state}`) loadRecording(item)
  else if (busy) renderTranscript()
  renderExport(item)
  renderAiMenu(item)
}

/** Loads a readable recording into the player and the transcript. */
function loadRecording(item) {
  loadedId = `${item.id}:${item.state}`
  if (item.state === 'done' || item.state === 'busy') {
    player.name = item.name
    player.peaks = peaks(item.id.length * 11)
    player.duration = item.duration
    if (player.src) URL.revokeObjectURL(player.src)
    player.src = silentRecording(item.duration)
  }
  transcript.editingId = null
  transcript.errors = {}
  transcript.currentTime = 0
  query = params.get('q') ?? ''
  search.value = query
  matchIndex = 0
  renderTranscript()
}

player.addEventListener('lintje-time-change', (event) => (transcript.currentTime = event.detail))
// Moved by the reader: the text goes there too, also when they scrolled away from it.
player.addEventListener('lintje-seek', (event) => {
  transcript.currentTime = event.detail
  transcript.reveal()
})
transcript.addEventListener('lintje-seek', (event) => {
  player.currentTime = event.detail
  transcript.currentTime = event.detail
})

/* Search: the transcript marks the hits, the field says how far; the term is kept in the URL. */
const search = $('search')
const noMatch = $('no-match')
let query = ''
let matchIndex = 0
let hits = []

/* How the fragments read: rows or messages, the speaker's colour under them, one name per turn. */
const viewMenu = $('view-menu')
const view = { layout: 'rows', size: 'regular', tinted: false, grouped: false }
viewMenu.addEventListener('lintje-action', (event) => {
  event.stopPropagation()
  const value = String(event.detail)
  if (value.startsWith('layout:')) view.layout = value.slice('layout:'.length)
  else if (value.startsWith('size:')) view.size = value.slice('size:'.length)
  else view[value] = !view[value]
  renderTranscript()
})
function renderViewMenu() {
  viewMenu.items = [
    { heading: 'Fragmenten tonen als' },
    { value: 'layout:rows', label: 'Rijen, met de spreker ernaast', checked: view.layout === 'rows', radio: true },
    { value: 'layout:chat', label: 'Chatberichten', checked: view.layout === 'chat', radio: true },
    'separator',
    { heading: 'Tekstgrootte' },
    { value: 'size:regular', label: 'Normaal', checked: view.size === 'regular', radio: true },
    { value: 'size:large', label: 'Groot, voor op een scherm', checked: view.size === 'large', radio: true },
    'separator',
    { heading: 'Sprekers' },
    { value: 'tinted', label: 'Achtergrond in de kleur van de spreker', checked: view.tinted },
    { value: 'grouped', label: 'Fragmenten van één spreker samenvoegen', checked: view.grouped },
  ]
  transcript.layout = view.layout
  transcript.size = view.size
  transcript.tinted = view.tinted
  transcript.grouped = view.grouped
}


function renderTranscript() {
  const item = find(openId)
  if (!item) return
  const all = segmentsOf(item)
  const live = item.state === 'live'
  renderViewMenu()

  const shown = all.map((part) => ({ ...part }))
  // Live, the last words may still change: they read as provisional.
  const last = shown.at(-1)
  if (live && last) {
    const words = last.text.split(' ')
    if (words.length > 6) shown[shown.length - 1] = { ...last, text: words.slice(0, -4).join(' '), pending: words.slice(-4).join(' ') }
  }
  transcript.segments = shown
  transcript.speakers = speakerNames(item)
  transcript.speakingId = live ? (last?.id ?? null) : null
  player.segments = all.map((part) => ({ start: part.start, speaker: part.speaker }))
  $('catch-up').hidden = !(live && !following)
  $('catch-up').data = { kind: 'info', text: 'Je leest terug; de live tekst loopt door.' }

  const wanted = query.trim().toLowerCase()
  const matches = {}
  hits = []
  if (wanted) {
    for (const part of shown) {
      const lower = part.text.toLowerCase()
      let at = lower.indexOf(wanted)
      while (at >= 0) {
        matches[part.id] = [...(matches[part.id] ?? []), [at, at + wanted.length]]
        hits.push({ id: part.id, index: matches[part.id].length - 1, start: part.start })
        at = lower.indexOf(wanted, at + wanted.length)
      }
    }
  }
  matchIndex = Math.min(matchIndex, Math.max(hits.length - 1, 0))
  transcript.searchMatches = matches
  transcript.currentMatch = hits[matchIndex] ? { id: hits[matchIndex].id, index: hits[matchIndex].index } : null
  search.hint = wanted ? (hits.length ? `${matchIndex + 1} van ${hits.length}` : 'Geen treffers') : ''
  $('search-prev').hidden = $('search-next').hidden = !wanted
  $('replace-toggle').hidden = !wanted || item.state !== 'done'
  if ($('replace-toggle').hidden) $('replace-row').hidden = true
  $('replace-all').textContent = hits.length ? `Alle ${hits.length}` : 'Alle'
  $('replace-one').disabled = $('replace-all').disabled = !hits.length
  noMatch.hidden = !wanted || hits.length > 0
  noMatch.text = `Geen treffers voor “${query.trim()}”.`
  noMatch.toggleAttribute('status', Boolean(wanted) && hits.length === 0)

  renderSpeakers(item, all)
  renderAiRows(item)
}

search.addEventListener('lintje-change', (event) => {
  query = String(event.detail ?? '')
  matchIndex = 0
  setParam('q', query.trim() ? query : null)
  renderTranscript()
})
function step(by) {
  if (!hits.length) return
  matchIndex = (matchIndex + by + hits.length) % hits.length
  renderTranscript()
  if (find(openId)?.state !== 'live') {
    player.currentTime = hits[matchIndex].start
    transcript.currentTime = hits[matchIndex].start
  }
}
$('search-prev').addEventListener('click', () => step(-1))
$('search-next').addEventListener('click', () => step(1))

/* Live, the transcript follows what is said; the reader can stop that and come back to now. */
let following = true
function follow(on) {
  following = on
  $('follow').checked = on
  const last = find(openId)?.segments.at(-1)
  if (on && last) transcript.currentTime = last.start
  renderTranscript()
}
$('follow').addEventListener('lintje-change', (event) => follow(Boolean(event.detail)))
$('catch-up-now').addEventListener('click', () => follow(true))

/* The recording's own name, live or afterwards. */
const renameModal = $('rename-modal')
function openRename() {
  $('rename-input').value = find(openId)?.name ?? ''
  renameModal.open = true
}
pageHeader.addEventListener('lintje-title-edit', openRename)
$('live-rename').addEventListener('click', openRename)
renameModal.addEventListener('lintje-close', () => (renameModal.open = false))
$('rename-cancel').addEventListener('click', () => (renameModal.open = false))
$('rename-save').addEventListener('click', () => {
  const name = $('rename-input').value?.trim()
  if (!name) {
    $('rename-input').error = 'Een opname heeft een naam.'
    return
  }
  $('rename-input').error = ''
  changeRecording(openId, { name, named: true, wasName: null })
  renameModal.open = false
})

/* Replacing: one hit or all of them, with a way back. */
let undoReplace = null
$('replace-toggle').addEventListener('click', () => {
  $('replace-row').hidden = !$('replace-row').hidden
  $('replace-toggle').expanded = !$('replace-row').hidden
})
function replaceHits(onlyCurrent) {
  const item = find(openId)
  const wanted = query.trim()
  if (!item || !wanted || !hits.length) return
  const by = $('replace').value ?? ''
  const pattern = new RegExp(wanted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
  const target = hits[matchIndex]
  let count = 0
  const segments = item.segments.map((part) => {
    if (onlyCurrent && part.id !== target.id) return part
    let seen = -1
    const text = part.text.replace(pattern, (found) => {
      seen += 1
      if (onlyCurrent && seen !== target.index) return found
      count += 1
      return by
    })
    // The recogniser's doubt was about the old words.
    return text === part.text ? part : { ...part, text, uncertain: [] }
  })
  undoReplace = { id: item.id, segments: item.segments }
  changeRecording(item.id, { segments })
  $('replaced').hidden = false
  $('replaced').data = { kind: 'ok', title: `${count} keer vervangen:`, text: `${wanted} → ${by || '(leeg)'}` }
  renderTranscript()
}
$('replace-one').addEventListener('click', () => replaceHits(true))
$('replace-all').addEventListener('click', () => replaceHits(false))
$('replace-undo').addEventListener('click', () => {
  if (undoReplace) changeRecording(undoReplace.id, { segments: undoReplace.segments })
  undoReplace = null
  $('replaced').hidden = true
  renderTranscript()
})

$('clear-search').addEventListener('click', () => {
  query = ''
  search.value = ''
  setParam('q', null)
  renderTranscript()
})

/* Editing: the transcript asks, the page decides and saves after a short delay. */
transcript.addEventListener('lintje-segment-edit', (event) => {
  transcript.errors = {}
  transcript.editingId = event.detail
})
transcript.addEventListener('lintje-segment-cancel', () => {
  transcript.errors = {}
  transcript.editingId = null
})
transcript.addEventListener('lintje-segment-save', (event) => {
  const { id, text } = event.detail
  const recording = openId
  transcript.busyId = id
  setTimeout(() => {
    transcript.busyId = null
    if (!text.trim()) {
      transcript.errors = { [id]: 'Een fragment kan niet leeg zijn.' }
      return
    }
    const item = find(recording)
    changeRecording(recording, { segments: item.segments.map((part) => (part.id === id ? { ...part, text, uncertain: [] } : part)) })
    transcript.editingId = null
    renderTranscript()
  }, 700)
})

/* The speakers: one fragment to another, a name everywhere, two as one. ---------------------- */

/** Every speaker in the recording, and those added that have no fragment yet, in order of speaking. */
function speakerNames(item) {
  return [...new Set([...segmentsOf(item).map((part) => part.speaker), ...(item.extraSpeakers ?? [])])]
}
const nextSpeaker = (item) => {
  const names = new Set(speakerNames(item))
  let number = names.size + 1
  while (names.has(`Spreker ${number}`)) number += 1
  return `Spreker ${number}`
}
function moveSegment(id, speaker) {
  const item = find(openId)
  changeRecording(item.id, { segments: item.segments.map((part) => (part.id === id ? { ...part, speaker } : part)) })
  renderTranscript()
}
transcript.addEventListener('lintje-segment-speaker', (event) => moveSegment(event.detail.id, event.detail.speaker))
transcript.addEventListener('lintje-speaker-new', (event) => {
  const name = nextSpeaker(find(openId))
  moveSegment(event.detail, name)
  toast(`Het fragment is van ${name}. Geef een naam bij Sprekers.`)
})
transcript.addEventListener('lintje-speaker-rename', (event) => renameSpeaker(event.detail))

const speakers = $('speakers')
function renderSpeakers(item, segments) {
  const live = item.state === 'live'
  const colours = lintje.speakerColours(segments)
  const names = speakerNames(item)
  const talk = new Map()
  segments.forEach((part, index) => {
    const end = segments[index + 1]?.start ?? item.duration
    talk.set(part.speaker, (talk.get(part.speaker) ?? 0) + Math.max(0, end - part.start))
  })
  $('speakers-heading').html = `<h2>Sprekers</h2><p>${
    live
      ? 'Geef een spreker nu al een naam; wat daarna gezegd wordt, krijgt die naam ook.'
      : item.state === 'busy'
        ? 'Tot nu toe herkend. Namen geven en samenvoegen kan al; wat er nog bij komt, volgt dezelfde namen.'
        : 'Wat je hier wijzigt, geldt overal in deze opname. Eén fragment geef je een andere spreker via de naam bij dat fragment.'
  }</p>`
  speakers.items = names.map((name) => {
    const count = segments.filter((part) => part.speaker === name).length
    return {
      id: name,
      title: name,
      swatch: colours.get(name) ?? 'other',
      sub: live ? `${plural(count, 'fragment', 'fragmenten')} tot nu toe` : `${plural(count, 'fragment', 'fragmenten')} · ${mmss(talk.get(name) ?? 0)} spreektijd`,
      clickable: false,
      actions: [
        { value: 'naam', label: 'Naam wijzigen' },
        { value: 'samenvoegen', label: 'Samenvoegen met…', disabled: names.length < 2, reason: 'Er is maar één spreker' },
      ],
      ...(renaming === name ? { rename: { save: 'Overal wijzigen', error: renameError } } : {}),
    }
  })
}
speakers.addEventListener('lintje-row-action', (event) => {
  const { id, value } = event.detail
  if (value === 'naam') renameSpeaker(id)
  else if (value === 'samenvoegen') openMerge(id)
})
$('speaker-add').icon = 'functioneel-plus'
$('speaker-add').addEventListener('click', () => {
  const item = find(openId)
  const name = nextSpeaker(item)
  changeRecording(item.id, { extraSpeakers: [...(item.extraSpeakers ?? []), name] })
  renderTranscript()
  toast(`${name} staat erbij; geef een fragment die spreker via de naam bij het fragment.`)
})

/* A speaker's name changes in place, in the speakers list; the menu in the text leads there. */
let renaming = null
let renameError = ''
function renameSpeaker(name) {
  renaming = name
  renameError = ''
  renderTranscript()
  speakers.scrollIntoView?.({ block: 'nearest' })
}
speakers.addEventListener('lintje-row-rename-cancel', () => {
  renaming = null
  renderTranscript()
})
speakers.addEventListener('lintje-row-rename', (event) => {
  const item = find(openId)
  const name = event.detail.value
  const from = renaming
  if (!name) renameError = 'Een spreker heeft een naam.'
  else if (name !== from && speakerNames(item).includes(name)) renameError = `${name} is al een spreker. Voeg ze samen via het menu.`
  else renameError = ''
  if (renameError) return renderTranscript()
  renaming = null
  const swap = (speaker) => (speaker === from ? name : speaker)
  changeRecording(item.id, {
    segments: item.segments.map((part) => ({ ...part, speaker: swap(part.speaker) })),
    extraSpeakers: (item.extraSpeakers ?? []).map(swap),
  })
  renderTranscript()
  if (name !== from) toast(`“${from}” heet voortaan “${name}”, in het hele transcript.`)
})

const mergeModal = $('merge-modal')
let merging = null
function openMerge(name) {
  merging = name
  const item = find(openId)
  const others = speakerNames(item).filter((other) => other !== name)
  mergeModal.heading = `${name} samenvoegen`
  $('merge-into').options = others.map((other) => ({ value: other, label: other }))
  $('merge-into').value = others[0]
  const count = item.segments.filter((part) => part.speaker === name).length
  // What happens stands under the choice, as its hint.
  $('merge-into').hint = `De ${plural(count, 'fragment', 'fragmenten')} van ${name} krijgen de naam en de kleur van de spreker die je kiest.`
  mergeModal.open = true
}
mergeModal.addEventListener('lintje-close', () => (mergeModal.open = false))
$('merge-cancel').addEventListener('click', () => (mergeModal.open = false))
$('merge-save').addEventListener('click', () => {
  const item = find(openId)
  const into = $('merge-into').value
  changeRecording(item.id, {
    segments: item.segments.map((part) => (part.speaker === merging ? { ...part, speaker: into } : part)),
    extraSpeakers: (item.extraSpeakers ?? []).filter((name) => name !== merging),
  })
  mergeModal.open = false
  renderTranscript()
  toast(`${merging} is samengevoegd met ${into}.`)
})

/* The AI work: above the text, each in an expander that folds away or hides. ----------------- */

const AI_KINDS = [
  { id: 'samenvatting', label: 'Samenvatting' },
  { id: 'notulen', label: 'Notulen in punten' },
  { id: 'acties', label: 'Actiepunten' },
  { id: 'entiteiten', label: 'Personen en plaatsen' },
  { id: 'besluiten', label: 'Besluiten' },
]
/** The text of a summary, the rows of the rest; nothing when it is not made yet. */
function aiContent(item, id) {
  const work = item?.ai?.[id]
  if (!work) return null
  return id === 'samenvatting' ? work.kort : work
}
const hiddenAi = (item) => new Set(item?.aiHidden ?? [])

function renderAiMenu(item) {
  if (!item?.ai) {
    aiMenu.items = []
    aiMenu.disabled = true
    return
  }
  const hidden = hiddenAi(item)
  // What is not above the transcript yet, each with a plus: choosing puts it there, made first
  // when it was not. With everything there, there is nothing to choose.
  const missing = AI_KINDS.filter((kind) => !making.has(kind.id) && (!aiContent(item, kind.id) || hidden.has(kind.id)))
  aiMenu.items = missing.map((kind) => ({
    value: aiContent(item, kind.id) ? `toon:${kind.id}` : `maak:${kind.id}`,
    label: kind.label,
    icon: 'functioneel-plus',
  }))
  aiMenu.disabled = item.state !== 'done' || missing.length === 0
}
aiMenu.addEventListener('lintje-action', (event) => {
  event.stopPropagation()
  const item = find(openId)
  const [verb, id] = String(event.detail).split(':')
  if (verb === 'toon') {
    aiOpen.add(id)
    changeRecording(item.id, { aiHidden: [...hiddenAi(item)].filter((other) => other !== id) })
    return renderTranscript()
  }
  const kind = AI_KINDS.find((entry) => entry.id === id)
  if (making.has(id)) return
  // It stands above the transcript at once, as a row that is being made.
  making.add(id)
  aiOpen.add(id)
  renderTranscript()
  setTimeout(() => {
    making.delete(id)
    const rows =
      id === 'notulen'
        ? [
            { id: 'n1', title: 'Rooster: de ochtenddienst begint maandag om zes uur; afstemming met de roostermaker volgt vandaag.' },
            { id: 'n2', title: 'Scanners: geplaatst in week 42 bij de balie, de training een week later.' },
            { id: 'n3', title: 'Training: Spreker 2 geeft de eerste groep, de tweede volgt na de evaluatie.' },
          ]
        : [{ id: 'b1', title: 'De nieuwe scanners worden in week 42 geplaatst.' }]
    const current = find(item.id)
    changeRecording(item.id, { ai: { ...current.ai, [id]: rows } })
    renderTranscript()
    toast(`${kind.label} is gemaakt.`)
  }, 1500)
})

/** One expander per kind, kept between draws: its open state is the reader's. */
const aiRows = new Map()
const aiOpen = new Set(['samenvatting'])
const making = new Set()
function aiRow(kind) {
  if (aiRows.has(kind.id)) return aiRows.get(kind.id)
  const row = Object.assign(document.createElement('lintje-expander'), { slot: 'lead', flat: true, columns: true, heading: kind.label })
  const redo = Object.assign(document.createElement('lintje-icon-button'), { slot: 'actions', icon: 'functioneel-refresh', label: `${kind.label} opnieuw maken`, variant: 'flat' })
  const hide = Object.assign(document.createElement('lintje-icon-button'), { slot: 'actions', icon: 'functioneel-kruis', label: `${kind.label} verbergen`, variant: 'flat' })
  redo.addEventListener('click', () => {
    row.subtitle = 'Wordt opnieuw gemaakt uit het transcript zoals het nu is…'
    setTimeout(() => {
      find(openId).aiAt = clock()
      renderAiRows(find(openId))
      toast(`${kind.label} is opnieuw gemaakt.`)
    }, 1200)
  })
  hide.addEventListener('click', () => {
    const item = find(openId)
    changeRecording(item.id, { aiHidden: [...hiddenAi(item), kind.id] })
    renderTranscript()
    toast(`${kind.label} is verborgen; terug te halen via AI-bewerkingen.`)
  })
  // The reader's choice to fold it, kept for the next draw; its tools show only while it is open.
  row.addEventListener('lintje-toggle', (event) => {
    if (event.detail) aiOpen.add(kind.id)
    else aiOpen.delete(kind.id)
    redo.hidden = hide.hidden = !event.detail
  })
  const wait = document.createElement('div')
  wait.className = 'pending'
  wait.dataset.part = 'making'
  wait.append(...[100, 80, 60].map((width) => Object.assign(document.createElement('lintje-skeleton'), { width: `${width}%`, height: 14 })))
  row.append(redo, hide, document.createElement('lintje-prose'), wait)
  aiRows.set(kind.id, row)
  return row
}
const escapeHtml = (text) => text.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char])

function renderAiRows(item) {
  renderAiMenu(item)
  const hidden = hiddenAi(item)
  const showing = item.state === 'done'
  for (const kind of AI_KINDS) {
    const content = aiContent(item, kind.id)
    const busy = making.has(kind.id)
    if (!showing || (!content && !busy) || hidden.has(kind.id)) {
      aiRows.get(kind.id)?.remove()
      continue
    }
    const row = aiRow(kind)
    row.subtitle = busy ? 'Wordt gemaakt uit het transcript…' : `AI-bewerking · ${item.aiAt ?? item.doneAt}`
    row.open = aiOpen.has(kind.id)
    for (const button of row.querySelectorAll('[slot="actions"]')) button.hidden = !row.open
    const prose = row.querySelector('lintje-prose')
    prose.hidden = busy
    row.querySelector('[data-part="making"]').hidden = !busy
    for (const button of row.querySelectorAll('lintje-icon-button')) button.disabled = busy
    if (busy) prose.text = ''
    else if (Array.isArray(content)) prose.html = `<ul>${content.map((entry) => `<li>${escapeHtml(entry.title)}${entry.sub ? ` — ${escapeHtml(entry.sub)}` : ''}</li>`).join('')}</ul>`
    else prose.text = content
    transcript.append(row)
  }
}

/* Opnieuw verwerken: other settings for this one recording, in a drawer. */
const drawer = $('reprocess-drawer')
$('reprocess').addEventListener('click', () => (drawer.open = true))
drawer.addEventListener('lintje-close', () => (drawer.open = false))
$('re-cancel').addEventListener('click', () => (drawer.open = false))
$('re-start').addEventListener('click', () => {
  drawer.open = false
  changeRecording(openId, { state: 'queued', progress: null })
  toast('De opname wordt opnieuw verwerkt.')
})
$('retry').addEventListener('click', () => changeRecording(openId, { state: 'queued', progress: null }))

/* Woordenlijsten: what recognition listens for, and the words to find ------------------- */

const PAGE_HEADINGS = {
  opnames: {
    title: 'Opnames',
    description: 'Wat nu loopt, en alles wat je hebt opgenomen of geüpload.',
  },
  woordenlijsten: {
    title: 'Woordenlijsten',
    description: 'Woorden die de herkenning goed moet verstaan, en woorden die je wilt terugvinden.',
  },
  instellingen: { title: 'Instellingen', description: 'Wijzigingen worden meteen bewaard.' },
}

/** Room the recognition gives every list that takes part, together. */
const ROOM = { luisteren: 2000, zoeken: 10000 }
let wordLists = {
  luisteren: [
    { id: 'team', name: 'Namen team Planning', owner: 'Jij', used: 'Vergadering, Briefing', share: 'team', words: ['J. de Vries', 'Bakker', 'Öztürk', 'Van den Heuvel', 'roostermaker', 'avondploeg', 'ochtenddienst', 'Wouters'] },
    { id: 'afkortingen', name: 'Afkortingen Rijksoverheid', owner: 'Organisatie', used: 'Vergadering, Hoorzitting, Briefing', share: 'organisatie', readonly: true, words: ['BZK', 'Awb', 'Woo', 'AVG', 'BSN', 'BRP', 'DigiD', 'MT'] },
    { id: 'locaties', name: 'Locaties rijkskantoor', owner: 'Mijn team', used: 'nog nergens', share: 'team', words: ['Ontvangsthal', 'Vergadercentrum', 'Atrium', 'Verdieping 7', 'Restaurant', 'Fietsenstalling'] },
  ],
  zoeken: [
    { id: 'signaal', name: 'Signaalwoorden hoorzitting', owner: 'Mijn team', used: 'Hoorzitting', share: 'team', fuzzy: true, words: ['termijn', 'bezwaar', 'beroep', 'schadevergoeding', 'dwangsom', 'tolk'] },
    { id: 'scanners', name: 'Project scanners', owner: 'Jij', used: 'Vergadering, Briefing', share: 'mij', fuzzy: false, words: ['scanner', 'balie', 'week 42', 'training', 'leverancier', 'storing'] },
  ],
}
const wordsKind = $('words-kind')
wordsKind.options = [
  { value: 'luisteren', label: `Luisteren naar (${wordLists.luisteren.length})`, description: 'Namen, afkortingen en plaatsen die de herkenning anders verkeerd verstaat. Bij elk soort gesprek kies je welke lijsten meedoen.' },
  { value: 'zoeken', label: `Zoekwoorden (${wordLists.zoeken.length})`, description: 'Woorden die je wilt terugvinden: ze worden in elk transcript gemarkeerd, ook tijdens live, en je ziet hoe vaak ze voorkomen.' },
]
$('words-share').options = [
  { value: 'mij', label: 'Alleen ik' },
  { value: 'team', label: 'Mijn team (Afdeling Planning)' },
  { value: 'organisatie', label: 'Iedereen in de organisatie' },
]

function renderWords() {
  const kind = params.get('soort-lijst') === 'zoeken' ? 'zoeken' : 'luisteren'
  wordsKind.value = kind
  const lists = wordLists[kind]
  const current = lists.find((list) => list.id === params.get('lijst')) ?? lists[0]
  $('words-lists').items = lists.map((list) => ({ id: list.id, title: list.name, sub: `${list.words.length} woorden · ${list.used}`, meta: list.owner }))
  $('words-lists').selectedId = current.id
  $('words-tile').heading = current.name
  $('words-tile').subtitle = `Doet mee bij ${current.used}`
  $('words-readonly').hidden = !current.readonly
  $('words-readonly').data = { kind: 'info', title: 'Deze lijst houdt de organisatie bij.', text: 'Je kunt hem gebruiken, niet wijzigen.' }
  $('words').value = current.words
  $('words').disabled = Boolean(current.readonly)
  const used = lists.reduce((sum, list) => sum + list.words.join(' ').length, 0) + (kind === 'luisteren' ? 1700 : 3000)
  $('words-room').label = kind === 'luisteren' ? 'Ruimte voor de herkenning, alle lijsten samen' : 'Ruimte voor zoekwoorden, alle lijsten samen'
  $('words-room').value = Math.round((used / ROOM[kind]) * 100)
  $('words-room').detail = `${used.toLocaleString('nl-NL')} van ${ROOM[kind].toLocaleString('nl-NL')} tekens${used / ROOM[kind] > 0.9 ? '. Bijna vol: zet een lijst die je niet nodig hebt uit bij het soort gesprek.' : ''}`
  $('words-fuzzy').hidden = kind !== 'zoeken'
  $('words-fuzzy').checked = Boolean(current.fuzzy)
  $('words-share').value = current.share
  $('words-share').disabled = Boolean(current.readonly)
  $('words-facts').items = [
    { label: 'Van', value: current.owner },
    { label: 'Doet mee bij', value: current.used },
  ]
}
wordsKind.addEventListener('lintje-change', (event) => {
  params.delete('lijst')
  setParam('soort-lijst', event.detail === 'zoeken' ? 'zoeken' : null)
  renderWords()
})
$('words-lists').addEventListener('lintje-row-click', (event) => {
  setParam('lijst', event.detail.id)
  renderWords()
})
/** A change to the open list, kept at once. */
function changeList(change) {
  const kind = wordsKind.value
  const id = $('words-lists').selectedId
  wordLists = { ...wordLists, [kind]: wordLists[kind].map((list) => (list.id === id ? { ...list, ...change } : list)) }
  renderWords()
}
$('words').addEventListener('lintje-change', (event) => changeList({ words: event.detail ?? [] }))
$('words-fuzzy').addEventListener('lintje-change', (event) => changeList({ fuzzy: event.detail }))
$('words-share').addEventListener('lintje-change', (event) => changeList({ share: event.detail }))
$('words-new').addEventListener('click', () => {
  const kind = wordsKind.value
  const id = `nieuw-${Date.now()}`
  wordLists = { ...wordLists, [kind]: [...wordLists[kind], { id, name: 'Nieuwe lijst', owner: 'Jij', used: 'nog nergens', share: 'mij', words: [] }] }
  setParam('lijst', id)
  renderWords()
})

/* Instellingen: what holds for every recording, and each kind's defaults ---------------------- */

const KIND_DEFAULTS = {
  vergadering: { language: 'auto', soft: false, lists: ['afkortingen', 'team'], mode: 'auto', min: 2, max: 12, count: 3, roles: true, unknown: true, summary: 'kort', english: false },
  hoorzitting: { language: 'nl', soft: true, lists: ['afkortingen'], mode: 'vast', min: 2, max: 2, count: 2, roles: true, unknown: true, summary: 'geen', english: false },
  briefing: { language: 'auto', soft: false, lists: ['afkortingen', 'team'], mode: 'auto', min: 1, max: 6, count: 1, roles: true, unknown: false, summary: 'kort', english: false },
  interview: { language: 'auto', soft: true, lists: [], mode: 'vast', min: 2, max: 2, count: 2, roles: true, unknown: true, summary: 'sprekers', english: false },
  dictaat: { language: 'nl', soft: false, lists: [], mode: 'uit', min: 1, max: 1, count: 1, roles: false, unknown: false, summary: 'geen', english: false },
}
const GENERAL_DEFAULTS = { think: false, format: 'docx', layout: 'standaard', top: true, merge: false }
let kindSettings = structuredClone(KIND_DEFAULTS)
let general = { ...GENERAL_DEFAULTS }
let savedAt = ''

$('st-language').options = LANGUAGES
$('st-lists').options = $('lists').options
$('st-spk-mode').options = [
  { value: 'uit', label: 'Niet' },
  { value: 'auto', label: 'Automatisch' },
  { value: 'vast', label: 'Vast aantal' },
]
$('st-summary').options = [
  { value: 'geen', label: 'Geen' },
  { value: 'kort', label: 'Kort' },
  { value: 'uitgebreid', label: 'Uitgebreid' },
  { value: 'sprekers', label: 'Per spreker' },
]
$('st-format').options = FORMATS.map((format) => ({ value: format.value, label: `${format.label} (${format.hint})` }))
$('st-layout').options = [
  { value: 'standaard', label: 'Standaard' },
  { value: 'letterlijk', label: 'Letterlijk met tijdcodes' },
  { value: 'ovc', label: 'OVC-indeling' },
]

function renderSettings() {
  const which = params.get('soort-instelling') ?? 'algemeen'
  const isGeneral = !KINDS[which]
  $('settings-nav').groups = [
    { label: 'Voor al je opnames', items: [{ label: 'Algemeen', href: hrefWith('soort-instelling', null), active: isGeneral }] },
    {
      label: 'Soorten gesprek',
      items: Object.entries(KINDS).map(([id, kind]) => ({ label: kind.label, href: hrefWith('soort-instelling', id), active: id === which })),
    },
  ]
  $('settings-nav').action = { label: 'Nieuw soort gesprek', value: 'nieuw' }
  $('settings-heading').html = isGeneral
    ? '<h2>Algemeen</h2><p>Geldt voor al je opnames, welk soort gesprek het ook is.</p>'
    : `<h2>${KINDS[which].label}</h2><p>Zo wordt een opname verwerkt als je bij het starten ${KINDS[which].label} kiest. Wat “ook per opname” heet, zet je bij het starten nog anders.</p>`
  $('settings-kind').hidden = isGeneral
  $('settings-all').hidden = !isGeneral
  $('settings-reset').textContent = `${isGeneral ? 'Algemeen' : KINDS[which].label} terugzetten naar de standaard`
  if (isGeneral) {
    $('st-think').checked = general.think
    $('st-format').value = general.format
    $('st-layout').value = general.layout
    $('st-top').checked = general.top
    $('st-merge').checked = general.merge
  } else {
    const kind = kindSettings[which]
    $('st-language').value = kind.language
    $('st-soft').checked = kind.soft
    $('st-lists').selected = kind.lists
    $('st-spk-mode').value = kind.mode
    $('st-spk-range').from = kind.min - 1
    $('st-spk-range').to = kind.max - 1
    $('st-spk-one').value = kind.count
    $('st-spk-range').hidden = kind.mode !== 'auto'
    $('st-spk-one').hidden = kind.mode !== 'vast'
    $('st-roles').checked = kind.roles
    $('st-roles').hidden = kind.mode === 'uit'
    $('st-unknown').checked = kind.unknown
    $('st-summary').value = kind.summary
    $('st-english').checked = kind.english
  }
}
$('settings-nav').addEventListener('lintje-navigate', (event) => {
  // The page stays: the section is a parameter of its address.
  event.preventDefault()
  event.stopPropagation()
  const which = new URLSearchParams(event.detail.href.split('?')[1] ?? '').get('soort-instelling')
  setParam('soort-instelling', which)
  renderSettings()
})

/** Every change is kept at once; the header says when. */
function saved() {
  savedAt = clock()
  PAGE_HEADINGS.instellingen = { title: 'Instellingen', description: `Wijzigingen worden meteen bewaard · bewaard om ${savedAt}` }
  renderOpen()
}
const KIND_FIELDS = {
  'st-language': 'language', 'st-soft': 'soft', 'st-lists': 'lists', 'st-spk-mode': 'mode',
  'st-spk-one': 'count', 'st-roles': 'roles', 'st-unknown': 'unknown',
  'st-summary': 'summary', 'st-english': 'english',
}
for (const [id, key] of Object.entries(KIND_FIELDS)) {
  $(id).addEventListener('lintje-change', (event) => {
    const which = params.get('soort-instelling')
    kindSettings = { ...kindSettings, [which]: { ...kindSettings[which], [key]: event.detail } }
    renderSettings()
    saved()
  })
}
$('st-spk-range').addEventListener('lintje-change', (event) => {
  const which = params.get('soort-instelling')
  const [from, to] = event.detail
  kindSettings = { ...kindSettings, [which]: { ...kindSettings[which], min: from + 1, max: to + 1 } }
  renderSettings()
  saved()
})
for (const [id, key] of Object.entries({ 'st-think': 'think', 'st-format': 'format', 'st-layout': 'layout', 'st-top': 'top', 'st-merge': 'merge' })) {
  $(id).addEventListener('lintje-change', (event) => {
    general = { ...general, [key]: event.detail }
    saved()
  })
}
$('settings-reset').addEventListener('click', () => {
  const which = params.get('soort-instelling')
  if (KINDS[which]) kindSettings = { ...kindSettings, [which]: structuredClone(KIND_DEFAULTS[which]) }
  else general = { ...GENERAL_DEFAULTS }
  renderSettings()
  saved()
  toast('Teruggezet naar de standaard.')
})
$('settings-nav').addEventListener('lintje-action', (event) => {
  event.stopPropagation()
  toast('Een nieuw soort gesprek maken staat niet in dit voorbeeld.')
})

/* Start --------------------------------------------------------------------------------- */

function render() {
  renderJobs()
  renderStart()
  renderOpen()
  // A page's fields are drawn when it opens, not on every step of the queue: that would undo typing.
  if (pageOf() !== drawnPage) {
    drawnPage = pageOf()
    if (drawnPage === 'woordenlijsten') renderWords()
    if (drawnPage === 'instellingen') renderSettings()
  }
}
let drawnPage = null

renderShell()
fillFromKind()
render()
if (!DEMO) setInterval(tick, 500)
