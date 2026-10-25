// The content category (Tekst en media): the specimens of its elements.
import { meta } from '../../_data/load.js'
import { log } from '../shared.js'

const FOOTNOTE = 'Bron: Zaaksysteem · waarde van 08:15'

const KB = 1024
const MB = 1024 * KB

/** A row of attachments, one per file, each with the same attributes; `width` narrows the row. */
const attachments = (files, attributes = '', width) => ({
  html: `<div class="guide__row"${width ? ` style="max-width: ${width}px"` : ''}>${files.map(() => `<lintje-attachment ${attributes}></lintje-attachment>`).join('')}</div>`,
  setup(stage) {
    stage.querySelectorAll('lintje-attachment').forEach((chip, index) => (chip.data = files[index]))
  },
})

const PROSE = `
  <h2>Hoe deze cijfers tot stand komen</h2>
  <p>De <strong>wachttijd</strong> is de mediaan per kwartier, gemeten vanaf het
  betreden van de rij. Zie <a href="#">de toelichting</a> voor de volledige definitie.</p>
  <h3>Wat er wel en niet in zit</h3>
  <ul>
    <li>Alle loketten met een actieve meting.</li>
    <li>Aanvragen die <em>binnen</em> de openingstijden zijn afgehandeld.</li>
  </ul>
  <ol><li>Meten per kwartier.</li><li>Mediaan per uur.</li><li>Afronden op minuten.</li></ol>
  <blockquote><p>Ontbrekende gegevens tellen nooit als nul.</p><cite>Uitgangspunten van het dashboard</cite></blockquote>
  <p><small>${FOOTNOTE}</small></p>`

/**
 * The demo has no recordings: a silent WAV of 90 seconds, made once in the browser, stands in
 * for one, so the players load, play, seek and report like they would on a real file.
 */
let silence = null

function silentRecording(seconds = 90) {
  if (silence) return silence
  const rate = 8000
  const samples = rate * seconds
  const buffer = new ArrayBuffer(44 + samples)
  const view = new DataView(buffer)
  const text = (offset, value) =>
    [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)))
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
  silence = URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }))
  return silence
}

/** A waveform that looks like speech: fictional, the same on every load. */
const PEAKS = Array.from({ length: 240 }, (_, index) => {
  const breath = Math.abs(Math.sin(index / 7)) * 0.6 + Math.abs(Math.sin(index / 2.3)) * 0.4
  return index % 37 > 33 ? 0.05 : Math.min(1, 0.12 + breath * 0.8)
})

const SEGMENTS = [
  { id: 's1', start: 0, speaker: 'Spreker 1', text: 'Goedemorgen allemaal. Dan de planning voor volgende week.' },
  {
    id: 's2',
    start: 9,
    speaker: 'Spreker 1',
    text: 'De ochtenddienst begint maandag een half uur eerder.',
  },
  {
    id: 's3',
    start: 18,
    speaker: 'Spreker 2',
    text: 'Is dat afgestemd met de roostermaker? Vorige keer liep dat mis.',
    uncertain: [[24, 36]],
  },
  { id: 's4', start: 31, speaker: 'Spreker 1', text: 'Nog niet. Ik stuur vandaag een bericht.' },
  { id: 's5', start: 40, speaker: 'M. Jansen', text: 'Ik neem contact op en koppel het donderdag terug.' },
  { id: 's6', start: 52, speaker: 'Spreker 2', text: 'Prima. Dan zetten we het op de agenda van vrijdag.' },
]

/** The host's half of the transcript: it keeps the segments and the editing state. */
/* The log viewer's host: all lines here, the filter in its own hands, only matching lines out. */
const LOG = [
  ['14:03:21.004', 'info', 'import', 'Start import van batch 2026-10-12-03 (412 aanvragen)'],
  ['14:03:21.118', 'debug', 'koppeling', 'Verbinding met bronregister geopend (pool 4 van 8)'],
  ['14:03:21.560', 'info', 'import', 'Batch 1 van 9 gelezen: 50 aanvragen'],
  ['14:03:22.031', 'debug', 'validatie', 'Schema 3.2 toegepast op 50 records'],
  ['14:03:22.447', 'warning', 'validatie', 'Aanvraag A-20931: postcode ontbreekt, adres overgeslagen'],
  ['14:03:22.902', 'info', 'import', 'Batch 1 van 9 opgeslagen in 0,84 s'],
  ['14:03:23.310', 'info', 'import', 'Batch 2 van 9 gelezen: 50 aanvragen'],
  ['14:03:24.016', 'error', 'koppeling', 'Timeout na 3000 ms bij opvragen dossier D-55120 (poging 1 van 3)', '{\n  "dossier": "D-55120",\n  "timeoutMs": 3000,\n  "poging": 1\n}'],
  ['14:03:24.019', 'debug', 'koppeling', 'Nieuwe poging na timeout over 2 s'],
  ['14:03:26.044', 'info', 'koppeling', 'Dossier D-55120 alsnog opgehaald (poging 2 van 3)'],
  ['14:03:26.511', 'info', 'import', 'Batch 2 van 9 opgeslagen in 1,12 s'],
  ['14:03:27.118', 'warning', 'import', 'Aanvraag A-21007 staat dubbel in de batch; de tweede regel is genegeerd'],
  ['14:03:27.640', 'info', 'import', 'Batch 3 van 9 gelezen: 50 aanvragen'],
  ['14:03:28.233', 'error', 'koppeling', 'Timeout na 3000 ms bij opvragen dossier D-55187 (poging 3 van 3); aanvraag naar de wachtrij voor handmatige controle'],
  ['14:03:28.415', 'info', 'import', 'Batch 3 van 9 opgeslagen in 0,77 s'],
].map(([time, level, source, message, details], i) => ({
  id: `e${i + 1}`,
  at: `2026-10-12T${time}`,
  time,
  level,
  source,
  message,
  ...(details ? { details } : {}),
}))

const MIXED_LOG = [
  { id: 'm1', at: '2026-10-12T14:03:21.004', time: '14:03:21.004', level: 'info', source: 'import', message: 'Start import van batch 2026-10-12-03' },
  { id: 'm2', at: '2026-10-12T14:03:21.090', time: '14:03:21.090', message: 'Configuratie: {"batchgrootte":50,"parallel":4,"bron":"register-acc","velden":["aanvraag","dossier","postcode"]}' },
  { id: 'm3', at: '2026-10-12T14:03:22.811', time: '14:03:22.811', level: 'error', source: 'verwerking', message: "Onverwachte fout bij verwerken van aanvraag A-20977\nTypeError: Cannot read properties of undefined (reading 'postcode')\n    at adresVan (verwerking/adres.js:42:19)\n    at verwerk (verwerking/index.js:118:11)\n    at Batch.volgende (import/batch.js:77:5)\n    at async Import.start (import/index.js:31:7)\n    at async main (bin/import.js:12:3)" },
  { id: 'm4', message: '    at Object.<anonymous> (bin/import.js:4:1)' },
  { id: 'm5', at: '2026-10-12T14:03:23.002', time: '14:03:23.002', level: 'warning', source: 'validatie', message: 'Onbekend veld, ongewijzigd doorgegeven: kenmerk=eyJhbGciOiJIUzI1NiJ9eyJhYW52cmFhZyI6IkEtMjA5ODAifQc2lnbmF0dXVy' },
  { id: 'm6', at: '2026-10-12T14:03:23.140', time: '14:03:23.140', source: 'stdout', message: '\u001b[32mGebruik:\u001b[0m 412 MB geheugen, 3 van 4 werkers bezig' },
]

const RAW_LOG = [
  '$ export-rapportage --periode 2026-09 --formaat csv',
  'Rapportage-export 2.4.1',
  'Verbinden met database rapportage-ro … ok',
  '[==========>         ]  55%  aanvragen  22.010 / 40.000',
  "WARN  kolom 'gemeentecode' leeg in 312 rijen, leeg geëxporteerd",
  '[====================] 100%  aanvragen  40.000 / 40.000',
  'Traceback (most recent call last):',
  '  File "/opt/export/schrijf.py", line 88, in schrijf_csv',
  "OSError: [Errno 28] No space left on device: '/var/export/2026-09/besluiten.csv'",
  'Export afgebroken na 00:04:12',
].map((message, i) => ({ id: `r${i + 1}`, line: 1241 + i, message }))

const MORE = [
  ['info', 'import', 'Batch {b} van 9 gelezen: 50 aanvragen'],
  ['debug', 'validatie', 'Schema 3.2 toegepast op 50 records'],
  ['warning', 'validatie', 'Aanvraag A-2{n}4: huisnummer ontbreekt, adres overgeslagen'],
  ['info', 'import', 'Batch {b} van 9 opgeslagen in 0,{n} s'],
]

function wireLog(stage, { lines = LOG, filter = {}, title = 'Importlog', ...rest } = {}) {
  const viewer = stage.querySelector('lintje-log-viewer')
  let all = [...lines]
  let state = { level: 'all', search: '', onlyHits: false, ...filter }
  let selected = rest.selected ?? null
  const counts = () => ({
    all: all.length,
    ...Object.fromEntries(['error', 'warning', 'info', 'debug'].map((l) => [l, all.filter((e) => e.level === l).length])),
  })
  const draw = () => {
    const term = state.search.trim().toLowerCase()
    viewer.data = {
      title,
      subtitle: lines === RAW_LOG ? 'Rapportage september, gestart 02:00' : 'Verwerking aanvragen, batch 2026-10-12-03',
      ...rest,
      entries: all.filter(
        (e) =>
          (state.level === 'all' || e.level === state.level) &&
          (!state.onlyHits || !term || e.message.toLowerCase().includes(term)),
      ),
      counts: lines.length ? counts() : undefined,
      filter: state,
      selected,
    }
  }
  viewer.addEventListener('lintje-log-filter-change', (event) => {
    state = event.detail
    draw()
  })
  viewer.addEventListener('lintje-log-select', (event) => {
    selected = event.detail
    draw()
  })
  draw()
  let made = 0
  return {
    viewer,
    stream(count) {
      let left = count
      const next = () => {
        const [level, source, text] = MORE[made % MORE.length]
        const ms = (3 * 60 + 28) * 1000 + 920 + (made + 1) * 613
        const pad = (n, w = 2) => String(n).padStart(w, '0')
        const time = `14:${pad(Math.floor(ms / 60000))}:${pad(Math.floor(ms / 1000) % 60)}.${pad(ms % 1000, 3)}`
        const message = text.replace('{b}', String(4 + Math.floor(made / MORE.length))).replace('{n}', String(1 + ((made * 7) % 8)))
        all = [...all, { id: `n${made}`, at: `2026-10-12T${time}`, time, level, source, message }]
        made += 1
        draw()
        left -= 1
        if (left > 0) setTimeout(next, 400)
      }
      next()
    },
  }
}

function wireTranscript(transcript, segments = SEGMENTS) {
  transcript.segments = segments.map((segment) => ({ ...segment }))
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
    transcript.busyId = id
    setTimeout(() => {
      transcript.busyId = null
      if (!text.trim()) {
        transcript.errors = { [id]: 'Een fragment kan niet leeg zijn.' }
        return
      }
      transcript.segments = transcript.segments.map((segment) =>
        segment.id === id ? { ...segment, text, uncertain: [] } : segment,
      )
      transcript.editingId = null
    }, 900)
  })
  transcript.addEventListener('lintje-segment-speaker', (event) => {
    const { id, speaker } = event.detail
    transcript.segments = transcript.segments.map((segment) => (segment.id === id ? { ...segment, speaker } : segment))
  })
  transcript.addEventListener('lintje-speaker-new', (event) => {
    const count = new Set(transcript.segments.map((segment) => segment.speaker)).size
    transcript.segments = transcript.segments.map((segment) =>
      segment.id === event.detail ? { ...segment, speaker: `Spreker ${count + 1}` } : segment,
    )
  })
}

/** A player and a transcript that follow each other, the way a host wires them. */
function wirePair(player, transcript) {
  player.addEventListener('lintje-time-change', (event) => (transcript.currentTime = event.detail))
  transcript.addEventListener('lintje-seek', (event) => {
    player.currentTime = event.detail
  })
}

/** A fictional letter as page images, drawn on a canvas: what a host renders a PDF to. */
let letter = null

function letterPages() {
  if (letter) return letter
  const lines = [
    ['Gemeente Voorbeeldstad', 'Afdeling Burgerzaken'],
    ['Onderwerp: uw aanvraag van 12 mei', 'Kenmerk: VB-2024-00412'],
    ['Bijlage: overzicht van de stukken', 'Contact: het klantcontactcentrum'],
    ['Termijnen en bezwaar', 'Met vriendelijke groet'],
    ['Bijlage 2', 'Toelichting op de berekening'],
  ]
  letter = lines.map(([title, sub], index) => {
    const canvas = document.createElement('canvas')
    canvas.width = 595
    canvas.height = 842
    const context = canvas.getContext('2d')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, 595, 842)
    context.fillStyle = '#1a1a1a'
    context.font = 'bold 20px sans-serif'
    context.fillText(title, 64, 96)
    context.font = '14px sans-serif'
    context.fillText(sub, 64, 124)
    context.fillStyle = '#b4b4b4'
    for (let row = 0; row < 26; row++) {
      const width = row % 6 === 5 ? 260 : 467 - ((row * 37) % 90)
      context.fillRect(64, 176 + row * 22, width, 8)
    }
    context.fillStyle = '#696969'
    context.font = '12px sans-serif'
    context.fillText(`Pagina ${index + 1} van ${lines.length}`, 64, 800)
    return canvas.toDataURL('image/png')
  })
  return letter
}

const audio = (attributes = '') =>
  `<lintje-audio-player name="Teamoverleg 2 oktober" ${attributes}></lintje-audio-player>`

const TRANSLATOR = `<lintje-translator maxlength="5000" target-label="Vertaling in het Engels">
  <lintje-combobox slot="source-language" label="Brontaal" hide-label></lintje-combobox>
  <lintje-combobox slot="target-language" label="Doeltaal" hide-label></lintje-combobox>
  <lintje-icon-button slot="source-actions" icon="beeld-en-geluid-microfoon" label="Inspreken" variant="flat"></lintje-icon-button>
  <lintje-streaming-text slot="target" variant="plain" label="Bezig met vertalen"></lintje-streaming-text>
  <lintje-ai-label slot="target-note" hint="Controleer belangrijke teksten"></lintje-ai-label>
  <lintje-icon-button slot="target-actions" icon="functioneel-geluid-aan" label="Vertaling voorlezen" variant="flat"></lintje-icon-button>
  <lintje-copy-button slot="target-actions" variant="primary" size="compact"></lintje-copy-button>
</lintje-translator>`

const LANGUAGES = [
  { value: 'nl', label: 'Nederlands' },
  { value: 'en', label: 'Engels' },
  { value: 'uk', label: 'Oekraïens' },
]

const TRANSLATIONS = {
  'Uw aanvraag is ontvangen. Binnen acht weken krijgt u een besluit.':
    'Your application has been received. You will receive a decision within eight weeks.',
}

/** The host's half: languages, the translation of a known text, the swap. */
function translator(stage, text) {
  const element = stage.querySelector('lintje-translator')
  const [from, to] = stage.querySelectorAll('lintje-combobox')
  const out = stage.querySelector('lintje-streaming-text')
  const copy = stage.querySelector('lintje-copy-button')
  const label = stage.querySelector('lintje-ai-label')
  from.options = LANGUAGES
  to.options = LANGUAGES
  from.value = 'nl'
  to.value = 'en'
  const show = (value) => {
    const translation = TRANSLATIONS[value.trim()] ?? ''
    out.text = translation
    out.state = translation || !value.trim() ? 'done' : 'waiting'
    copy.text = translation
    label.hidden = !translation
  }
  element.value = text
  show(text)
  element.addEventListener('lintje-text-change', (event) => show(event.detail))
  element.addEventListener('lintje-languages-swap', () => {
    ;[from.value, to.value] = [to.value, from.value]
  })
}

export default {
  elements: [
    {
      tag: 'lintje-prose',
      title: 'De typeschaal op tekst die de pagina niet zelf schreef',
      specimens: [
        {
          label: 'HTML van de host',
          html: '<lintje-prose data-html></lintje-prose>',
          setup(stage) {
            stage.querySelector('[data-html]').html = PROSE
          },
        },
        {
          label: 'Gedempt',
          note: 'Met `tone="muted"` staat één alinea in het grijs.',
          html: '<lintje-prose tone="muted" text="Bron: Zaaksysteem · waarde van 08:15. Dit is de tone=&quot;muted&quot;-variant: één alinea, 13 grijs."></lintje-prose>',
        },
        {
          label: 'Uit de slot',
          note: 'Zonder `html` of `text` toont het element gewone tekst uit de slot. Een kop, lijst of alinea krijgt daar geen opmaak; opgemaakte inhoud gaat via `html`.',
          html: '<lintje-prose>Het rooster van volgende week staat vanaf vrijdag in het overzicht.</lintje-prose>',
        },
      ],
    },
    {
      tag: 'lintje-code',
      title: 'Een blok monospace, ook voor JSON',
      specimens: [
        {
          label: 'JSON met regelnummers',
          note: 'Het attribuut `numbered` zet de nummers ervoor.',
          html: '<lintje-code language="json" numbered></lintje-code>',
          setup(stage) {
            stage.querySelector('lintje-code').text = JSON.stringify(
              {
                page: 'overzicht',
                build: 'a1b2c3d4',
                tiles: 7,
                asOf: meta.as_of.date,
                source: { endpoint: 'aanvragen-per-uur', filters: ['region', 'period'] },
              },
              null,
              2,
            )
          },
        },
        {
          label: 'SQL met regelafbreking',
          note: 'Het attribuut `wrap` breekt lange regels af.',
          html: '<lintje-code language="sql" wrap></lintje-code>',
          setup(stage) {
            stage.querySelector('lintje-code').text =
              'select loket, percentile_cont(0.5) within group (order by wachttijd_seconden) ' +
              'as mediaan from metingen where gemeten_op >= current_date group by loket order by mediaan desc'
          },
        },
        {
          label: 'Zonder taal',
          html: '<lintje-code></lintje-code>',
          setup(stage) {
            stage.querySelector('lintje-code').text = 'npm ci\nnpm run build:elements'
          },
        },
      ],
    },
    {
      tag: 'lintje-key',
      title: 'Een toets op het toetsenbord',
      specimens: [
        {
          label: 'Losse toets',
          html: 'Druk op <lintje-key>/</lintje-key> om te zoeken.',
        },
        {
          label: 'Combinatie',
          note: 'Twee toetsen naast elkaar, met een spatie ertussen.',
          html: 'Bewaar met <lintje-key>Ctrl</lintje-key> <lintje-key>S</lintje-key>.',
        },
        {
          label: 'Pijltoets',
          note: 'De tekst kan ook uit het attribuut `key` komen.',
          html: 'Kies met <lintje-key key="↑"></lintje-key> <lintje-key key="↓"></lintje-key> en open met <lintje-key>Enter</lintje-key>.',
        },
      ],
    },
    {
      tag: 'lintje-highlight',
      title: 'Markering in lopende tekst',
      specimens: [
        {
          label: 'Term met toelichting',
          note: 'De toelichting verschijnt bij hover en focus.',
          html: 'een geldige <lintje-highlight kind="term" explanation="Woordenlijst: residence permit wordt verblijfsvergunning">verblijfsvergunning</lintje-highlight>',
        },
        {
          label: 'Lage zekerheid',
          html: 'afgestemd met de <lintje-highlight kind="uncertain">roostermaker</lintje-highlight>',
        },
        {
          label: 'Term uit de woordenlijst',
          html: 'een geldige <lintje-highlight kind="term">verblijfsvergunning</lintje-highlight>',
        },
        {
          label: 'Zoekresultaat',
          html: 'begint <lintje-highlight kind="match">maandag</lintje-highlight> een half uur eerder, en <lintje-highlight kind="match" current>maandag</lintje-highlight> ook later',
        },
        {
          label: 'Verschil tussen twee versies',
          html: 'een <lintje-highlight kind="removed">half uur</lintje-highlight> <lintje-highlight kind="added">kwartier</lintje-highlight> eerder',
        },
      ],
    },
    {
      tag: 'lintje-token-value',
      title: 'Wat een token op deze plek berekent',
      specimens: [
        {
          label: 'In een zin',
          note: 'Een kleur staat er als staal en als hex: het staal is nooit de enige drager.',
          html: '<p>Een link is <code>--color-link</code>: <lintje-token-value name="--color-link"></lintje-token-value>, en onder de muis <lintje-token-value name="--color-link-hover"></lintje-token-value>.</p>',
        },
        {
          label: 'Elke soort waarde',
          note: 'Een kleur wordt hex, ook een die de browser als oklch() berekent; een lengte in rem krijgt zijn px erbij; een tekststijl leest als dikte, maat en regelhoogte.',
          html: `<div class="guide__stack">
            <span><code>--color-accent-text</code>: <lintje-token-value name="--color-accent-text"></lintje-token-value></span>
            <span><code>--color-overlay-page</code>: <lintje-token-value name="--color-overlay-page"></lintje-token-value></span>
            <span><code>--h-button</code>: <lintje-token-value name="--h-button"></lintje-token-value></span>
            <span><code>--text-h1</code>: <lintje-token-value name="--text-h1"></lintje-token-value></span>
            <span><code>--shadow-popover</code>: <lintje-token-value name="--shadow-popover"></lintje-token-value></span>
          </div>`,
        },
        {
          label: 'Loopt mee met de weergave',
          note: 'Kies in Weergave donker of een ander thema en de waarde wordt opnieuw gelezen.',
          html: '<span><code>--color-action-primary</code>: <lintje-token-value name="--color-action-primary"></lintje-token-value></span>',
        },
        {
          label: 'Zonder staal',
          note: 'Waar de kleur er al groot naast staat, zoals op de pagina Kleur, laat no-swatch het kleine staal weg.',
          html: '<span><code>--color-link</code>: <lintje-token-value name="--color-link" no-swatch></lintje-token-value></span>',
        },
        {
          label: 'Een token dat niet bestaat',
          note: 'Een streep, geen gok en geen nul.',
          html: '<span><code>--color-bestaat-niet</code>: <lintje-token-value name="--color-bestaat-niet"></lintje-token-value></span>',
        },
      ],
    },
    {
      tag: 'lintje-translator',
      wide: true,
      title: 'Een tekst en zijn vertaling in één vlak van twee helften',
      specimens: [
        {
          label: 'Tekst en vertaling',
          note:
            'De wisselknop staat op de scheidslijn. Op een telefoon staan de helften onder elkaar.',
          html: TRANSLATOR,
          setup: (stage) => translator(stage, 'Uw aanvraag is ontvangen. Binnen acht weken krijgt u een besluit.'),
        },
        {
          label: 'Documenten',
          note: 'De variant `documents` zet de talen boven het sleepvak.',
          html: `<lintje-translator variant="documents">
            <lintje-combobox slot="source-language" label="Brontaal" hide-label></lintje-combobox>
            <lintje-combobox slot="target-language" label="Doeltaal" hide-label></lintje-combobox>
            <lintje-file-upload label="Documenten" hide-label accept=".docx,.pdf,.txt"></lintje-file-upload>
          </lintje-translator>`,
          setup(stage) {
            const [from, to] = stage.querySelectorAll('lintje-combobox')
            from.options = LANGUAGES
            to.options = LANGUAGES
            from.value = 'nl'
            to.value = 'en'
          },
        },
        {
          label: 'Leeg',
          note: 'De vertaling verschijnt terwijl je typt.',
          html: TRANSLATOR,
          setup: (stage) => translator(stage, ''),
        },
      ],
    },
{
      tag: 'lintje-audio-player',
      title: 'Een opname afspelen: de golfvorm of een balk, sprekers in kleur',
      specimens: [
        {
          label: 'Golfvorm',
          note: 'De opname speelt na een druk op “Afspelen”.',
          html: audio(),
          setup(stage) {
            const player = stage.querySelector('lintje-audio-player')
            player.peaks = PEAKS
            player.src = silentRecording()
          },
        },
        {
          label: 'Sprekers in kleur',
          note: 'De legenda van de sprekers staat erboven. Halverwege afgespeeld: wat nog komt, heeft een lichtere kleur van dezelfde spreker.',
          html: audio(),
          setup(stage) {
            const player = stage.querySelector('lintje-audio-player')
            player.peaks = PEAKS
            player.segments = SEGMENTS
            player.src = silentRecording()
            player.currentTime = 45
          },
        },
        {
          label: 'Zonder eigen kader',
          note: 'Met `flush` is de balk van de pagina het kader.',
          html: `<div style="background: var(--color-bg-surface); border-top: 1px solid var(--color-border-default); padding: 0 var(--space-4)">${audio().replace('<lintje-audio-player', '<lintje-audio-player flush no-legend')}</div>`,
          setup(stage) {
            const player = stage.querySelector('lintje-audio-player')
            player.peaks = PEAKS
            player.segments = SEGMENTS
            player.src = silentRecording()
          },
        },
        {
          label: 'Zonder golfvorm',
          note: 'Zonder golfvorm toont de speler een balk.',
          html: audio(),
          setup(stage) {
            stage.querySelector('lintje-audio-player').src = silentRecording()
          },
        },
        {
          label: 'Balk met sprekers',
          html: audio(),
          setup(stage) {
            const player = stage.querySelector('lintje-audio-player')
            player.segments = SEGMENTS
            player.src = silentRecording()
            player.currentTime = 45
          },
        },
        {
          label: 'Uitgeschakeld',
          note: 'De opname laadt nog.',
          html: audio('duration="2832"'),
          setup(stage) {
            stage.querySelector('lintje-audio-player').peaks = PEAKS
          },
        },
        {
          label: 'Fout',
          html: audio('src="opnames/bestaat-niet.wav"'),
          setup(stage) {
            stage.querySelector('lintje-audio-player').peaks = PEAKS
          },
        },
        {
          label: 'Compact',
          note: 'Met `compact` staat de speler op één regel, voor in een rij of tegel.',
          html: audio('compact'),
          setup(stage) {
            const player = stage.querySelector('lintje-audio-player')
            player.peaks = PEAKS
            player.src = silentRecording()
          },
        },
      ],
    },
    {
      tag: 'lintje-video-player',
      wide: true,
      title: 'Beeld bij een opname, met dezelfde bediening',
      specimens: [
        {
          label: 'Rust',
          html: '<lintje-video-player name="Hoorzitting zaal 4"></lintje-video-player>',
          setup(stage) {
            const player = stage.querySelector('lintje-video-player')
            player.segments = SEGMENTS
            player.src = silentRecording()
          },
        },
        {
          label: 'Ondertiteling aan',
          note: 'De opname speelt op 1,25×.',
          html: '<lintje-video-player name="Hoorzitting zaal 4" captions></lintje-video-player>',
          async setup(stage) {
            const player = stage.querySelector('lintje-video-player')
            player.segments = SEGMENTS
            player.src = silentRecording()
            player.currentTime = 20
            await player.updateComplete
            player.shadowRoot
              .querySelector('lintje-menu-button')
              .dispatchEvent(new CustomEvent('lintje-action', { detail: '1.25' }))
          },
        },
        {
          label: 'Menu met meer opties',
          note: 'Het menu zet audiodescriptie en snelheid; op een smalle balk ook de ondertiteling.',
          html: '<lintje-video-player name="Hoorzitting zaal 4" captions></lintje-video-player>',
          async setup(stage) {
            const player = stage.querySelector('lintje-video-player')
            player.segments = SEGMENTS
            player.src = silentRecording()
            player.describedSrc = silentRecording()
            await player.updateComplete
            const menu = player.shadowRoot.querySelector('lintje-menu-button')
            // The menu waits for the video, as the reader does.
            player.addEventListener(
              'lintje-time-change',
              async () => {
                await player.updateComplete
                menu.open = true
              },
              { once: true },
            )
            player.currentTime = 20
          },
        },
        {
          label: 'Fout',
          note: 'De melding staat in beeld.',
          html: '<lintje-video-player name="Hoorzitting zaal 4" src="opnames/bestaat-niet.mp4"></lintje-video-player>',
        },
      ],
    },
    {
      tag: 'lintje-transcript',
      wide: true,
      title: 'De tekst van een opname, per segment te bewerken',
      specimens: [
        {
          label: 'Rust',
          note: 'Wijs een fragment aan, bewerk het of wissel van spreker.',
          html: '<lintje-transcript></lintje-transcript>',
          setup(stage) {
            wireTranscript(stage.querySelector('lintje-transcript'))
          },
        },
        {
          label: 'Met melding en AI-bewerking',
          note: 'Beide staan erboven, in de kolommen van de fragmenten.',
          html: `<lintje-transcript>
            <lintje-ai-label slot="note-label" hint=""></lintje-ai-label>
            <span slot="note">Het transcript en de AI-bewerkingen zijn automatisch gemaakt en kunnen fouten bevatten. Controleer ze voordat je ze gebruikt.</span>
            <lintje-expander slot="lead" flat columns heading="Samenvatting" subtitle="AI-bewerking · 09:31" open>
              <lintje-icon-button slot="actions" icon="functioneel-kruis" label="Samenvatting verbergen" variant="flat"></lintje-icon-button>
              <lintje-prose text="De ochtenddienst begint maandag om zes uur; of dat is afgestemd, wordt vandaag nagevraagd."></lintje-prose>
            </lintje-expander>
          </lintje-transcript>`,
          setup(stage) {
            wireTranscript(stage.querySelector('lintje-transcript'), SEGMENTS.slice(0, 3))
          },
        },
        {
          label: 'Getint en samengevoegd',
          note: 'De kleur van de spreker ligt onder het hele fragment, met één naam per beurt.',
          html: '<lintje-transcript tinted grouped></lintje-transcript>',
          setup(stage) {
            wireTranscript(stage.querySelector('lintje-transcript'), SEGMENTS.slice(0, 4))
          },
        },
        {
          label: 'Als chatberichten',
          note: 'Het attribuut `layout="chat"` zet de fragmenten als berichten.',
          html: '<lintje-transcript layout="chat" grouped current-time="10"></lintje-transcript>',
          setup(stage) {
            wireTranscript(stage.querySelector('lintje-transcript'), SEGMENTS.slice(0, 4))
          },
        },
        {
          label: 'Live',
          note:
            'Je ziet wie nu spreekt, en de laatste woorden zijn nog voorlopig. ' +
            'Met `size="large"` staat de tekst groot.',
          html: '<lintje-transcript size="large"></lintje-transcript>',
          setup(stage) {
            const transcript = stage.querySelector('lintje-transcript')
            const segments = SEGMENTS.slice(0, 2).map((segment) => ({ ...segment }))
            segments[1].pending = 'en je tekent ervoor'
            transcript.segments = segments
            transcript.speakingId = segments[1].id
          },
        },
        {
          label: 'Alleen lezen',
          note: 'Met `readonly` is het transcript een voorbeeld naast een opname die loopt.',
          html: '<lintje-transcript readonly></lintje-transcript>',
          setup(stage) {
            stage.querySelector('lintje-transcript').segments = SEGMENTS.slice(0, 3).map((segment) => ({ ...segment }))
          },
        },
        {
          label: 'Alleen lezen met een lange naam',
          note: 'Zonder iets wat de focus neemt, loopt een lange sprekersnaam door.',
          html: '<lintje-transcript readonly></lintje-transcript>',
          setup(stage) {
            stage.querySelector('lintje-transcript').segments = SEGMENTS.slice(0, 2).map((segment, index) => ({
              ...segment,
              speaker: index === 0 ? 'Voorzitter van de commissie bezwaarschriften' : segment.speaker,
            }))
          },
        },
        {
          label: 'Met de speler verbonden',
          note: 'Speler en transcript volgen elkaar en tonen wat nu speelt.',
          html: `${audio()}<lintje-transcript></lintje-transcript>`,
          setup(stage) {
            const player = stage.querySelector('lintje-audio-player')
            const transcript = stage.querySelector('lintje-transcript')
            player.peaks = PEAKS
            player.src = silentRecording()
            wireTranscript(transcript)
            transcript.currentTime = 20
            wirePair(player, transcript)
          },
        },
        {
          label: 'Bezig',
          html: '<lintje-transcript editing-id="s4" busy-id="s4"></lintje-transcript>',
          setup(stage) {
            stage.querySelector('lintje-transcript').segments = SEGMENTS.slice(3, 4)
          },
        },
        {
          label: 'Fout',
          html: '<lintje-transcript editing-id="s4"></lintje-transcript>',
          setup(stage) {
            const transcript = stage.querySelector('lintje-transcript')
            wireTranscript(transcript, SEGMENTS.slice(3, 4))
            transcript.errors = { s4: 'Opslaan is niet gelukt. Probeer het opnieuw.' }
          },
        },
      ],
    },
    {
      tag: 'lintje-log-viewer',
      wide: true,
      title: 'Logregels die live binnenkomen, te filteren en te doorzoeken',
      specimens: [
        {
          label: 'Live',
          note: 'Laat regels binnenkomen en scrol omhoog: de balk telt wat er onder bijkomt, "Naar nieuwste" volgt weer.',
          html:
            '<lintje-button variant="secondary" size="compact">Regels laten binnenkomen</lintje-button>' +
            '<lintje-log-viewer style="margin-top: var(--space-4)"></lintje-log-viewer>',
          setup(stage) {
            const host = wireLog(stage, { live: true })
            stage.querySelector('lintje-button').addEventListener('click', () => host.stream(12))
          },
        },
        {
          label: 'Zoeken',
          note: 'Vinden markeert en filtert niet. Vorige en volgende verplaatsen alleen de huidige treffer; "Alleen regels met een treffer" staat onder Weergave.',
          html: '<lintje-log-viewer></lintje-log-viewer>',
          setup(stage) {
            wireLog(stage, { live: true, filter: { search: 'timeout' } })
          },
        },
        {
          label: 'Alleen fouten',
          html: '<lintje-log-viewer></lintje-log-viewer>',
          setup(stage) {
            wireLog(stage, { live: true, filter: { level: 'error' } })
          },
        },
        {
          label: 'Regel gekozen',
          note: 'Klik op een tijd, of ga met de pijltjes naar een regel en druk op Enter.',
          html: '<lintje-log-viewer></lintje-log-viewer>',
          setup(stage) {
            wireLog(stage, { live: false, selected: 'e12' })
          },
        },
        {
          label: 'Half gestructureerd',
          note: 'Een regel zonder niveau krijgt geen badge; een stacktrace klapt in tot vier regels.',
          html: '<lintje-log-viewer></lintje-log-viewer>',
          setup(stage) {
            wireLog(stage, { live: true, lines: MIXED_LOG })
          },
        },
        {
          label: 'Niets voor dit filter',
          note: '"Filter wissen" vraagt de host om alle regels terug.',
          html: '<lintje-log-viewer></lintje-log-viewer>',
          setup(stage) {
            wireLog(stage, { live: true, filter: { search: 'certificaat', onlyHits: true } })
          },
        },
        {
          label: 'Ruwe uitvoer',
          note: 'Geen regel heeft een tijd, niveau of bron: alleen de tekst, met het regelnummer.',
          html: '<lintje-log-viewer></lintje-log-viewer>',
          setup(stage) {
            wireLog(stage, { live: false, lines: RAW_LOG, truncated: 1240, title: 'Uitvoer export' })
          },
        },
        {
          label: 'Met acties van de host',
          note: 'De acties staan onder ⋯, na die van het venster zelf. Een gevaarlijke bevestigt de host.',
          html: '<lintje-log-viewer></lintje-log-viewer>',
          setup(stage) {
            const say = log(stage)
            const viewer = wireLog(stage, {
              live: true,
              actions: [
                { heading: 'Import' },
                { value: 'herstart', label: 'Import opnieuw starten' },
                { value: 'verwijder', label: 'Logs van deze batch verwijderen…', danger: true },
              ],
            }).viewer
            viewer.addEventListener('lintje-log-action', (event) => say(`lintje-log-action: ${event.detail}`))
          },
        },
        {
          label: 'Fout',
          note: 'De regels die er al waren, blijven staan.',
          html: '<lintje-log-viewer></lintje-log-viewer>',
          setup(stage) {
            wireLog(stage, {
              live: false,
              state: 'error',
              message: 'De verbinding met de logbron is verbroken. Nieuwe regels komen niet binnen.',
            })
          },
        },
        {
          label: 'Wachten op de eerste regel',
          html: '<lintje-log-viewer></lintje-log-viewer>',
          setup(stage) {
            wireLog(stage, { live: true, lines: [] })
          },
        },
        {
          label: 'Geen logregels',
          html: '<lintje-log-viewer></lintje-log-viewer>',
          setup(stage) {
            wireLog(stage, { live: false, lines: [] })
          },
        },
        {
          label: 'Laden',
          html: '<lintje-log-viewer></lintje-log-viewer>',
          setup(stage) {
            wireLog(stage, { state: 'loading' })
          },
        },
      ],
    },
    {
      tag: 'lintje-document-viewer',
      wide: true,
      title: 'Een document bekijken: bladeren, zoomen en downloaden',
      specimens: [
        {
          label: 'Rust',
          note: 'De host levert vijf pagina’s als afbeelding.',
          html: '<lintje-document-viewer name="Brief gemeente.pdf" page="2"></lintje-document-viewer>',
          setup(stage) {
            const viewer = stage.querySelector('lintje-document-viewer')
            viewer.pages = letterPages()
            // The text of each page, which a screen reader reads after its image.
            viewer.texts = letterPages().map((_, index) => `Brief gemeente, pagina ${index + 1}.`)
          },
        },
        {
          label: 'Op een vaste zoom',
          note: '"Passend" is uit; aan staat hij gevuld, zoals in de rust hierboven.',
          html: '<lintje-document-viewer name="Brief gemeente.pdf" zoom="150"></lintje-document-viewer>',
          setup(stage) {
            stage.querySelector('lintje-document-viewer').pages = letterPages()
          },
        },
        {
          label: 'Bezig',
          html: '<lintje-document-viewer name="Brief gemeente.pdf"></lintje-document-viewer>',
        },
        {
          label: 'Een lange naam',
          note: 'De naam neemt geen focus, dus hij loopt door in plaats van af te kappen.',
          html: '<lintje-document-viewer name="Besluit op de aanvraag omgevingsvergunning voor het verbouwen van het pand aan de Lange Voorhout.pdf"></lintje-document-viewer>',
          setup(stage) {
            stage.querySelector('lintje-document-viewer').pages = letterPages().slice(0, 1)
          },
        },
        {
          label: 'Fout',
          html: '<lintje-document-viewer name="Scan formulier.jpg" src="documenten/bestaat-niet.jpg"></lintje-document-viewer>',
        },
      ],
    },
    {
      tag: 'lintje-gallery',
      wide: true,
      title: 'Afbeeldingen van één ding: één groot met bijschrift, de rest als miniatuur',
      specimens: [
        {
          label: 'Drie schermen',
          note: 'Het tweede scherm is gekozen.',
          html: '<lintje-gallery label="Schermafbeeldingen van Vertalen" selected="1"></lintje-gallery>',
          setup(stage) {
            stage.querySelector('lintje-gallery').items = [
              { src: 'media/afbeelding.svg', alt: 'Het scherm Tekst vertalen', caption: 'Tekst vertalen, met de vertaling ernaast.' },
              { src: 'media/afbeelding.svg', alt: 'Het scherm Documenten', caption: 'Documenten in de wachtrij.' },
              { src: 'media/afbeelding.svg', alt: 'Het scherm Woordenlijst', caption: 'De woordenlijst van de afdeling.' },
            ]
          },
        },
        {
          label: 'Eén afbeelding',
          note: 'Bij één afbeelding vallen de miniaturen weg.',
          html: '<lintje-gallery></lintje-gallery>',
          setup(stage) {
            stage.querySelector('lintje-gallery').items = [
              { src: 'media/afbeelding.svg', alt: 'Het overzicht van het dashboard', caption: 'Het overzicht.' },
            ]
          },
        },
      ],
    },
    {
      tag: 'lintje-attachment',
      title: 'Een bestand als stille chip: meegestuurd bij een vraag of terug in een antwoord',
      specimens: [
        {
          label: 'Klaar',
          note: 'Het icoon volgt uit het type of de extensie; een foto toont de miniatuur van de host.',
          ...attachments([
            { id: 'p', name: 'beleidsregel-2026.pdf', size: 1.2 * MB, state: 'done' },
            { id: 'x', name: 'aanvragen-q3.xlsx', size: 48 * KB, state: 'done' },
            { id: 'c', name: 'bezwaren-per-maand.csv', size: 4 * KB, type: 'text/csv', state: 'done' },
            { id: 'f', name: 'formulier.jpg', size: 2.4 * MB, state: 'done', thumbnail: 'media/afbeelding.svg' },
          ]),
        },
        {
          label: 'Met download',
          note: 'De chip is een link die het bestand oplevert; het teken zegt het.',
          ...attachments([
            { id: 'd', name: 'bezwaren-per-maand.csv', size: 4 * KB, state: 'done', href: '#', download: true },
          ]),
        },
        {
          label: 'Als bron',
          note: 'Bij een bron staat de bladzijde op de plek van de maat.',
          ...attachments([{ id: 'b', name: 'beleidsregel-2026.pdf', detail: 'blz. 4', state: 'done' }]),
        },
        {
          label: 'Bezig',
          note: 'Met een getal en zonder: dan loopt de lijn onbepaald.',
          ...attachments(
            [
              { id: 'v', name: 'verklaring.pdf', size: 482 * KB, state: 'busy', progress: 64 },
              { id: 'o', name: 'overzicht-2025.xlsx', size: 3.1 * MB, state: 'busy' },
            ],
            'removable',
          ),
        },
        {
          label: 'Geweigerd',
          note: 'Het type of de maat: het element weigerde het bestand zelf.',
          ...attachments(
            [
              { id: 't', name: 'scan.heic', size: 1.8 * MB, state: 'error', message: 'Dit bestandstype kan niet' },
              { id: 'g', name: 'scan-dossier.pdf', size: 24 * MB, state: 'error', message: 'Groter dan 20 MB' },
            ],
            'removable refused',
          ),
        },
        {
          label: 'Geweigerd op 320 px',
          note: 'Zo breed als het vraagvak zijn bijlagen laat op een scherm van 320 px.',
          ...attachments(
            [{ id: 't', name: 'scan.heic', size: 1.8 * MB, state: 'error', message: 'Dit bestandstype kan niet' }],
            'removable refused',
            262,
          ),
        },
        {
          label: 'Mislukt',
          note: 'Een fout van de host, met Opnieuw omdat hij `retry` zet.',
          ...attachments(
            [{ id: 'm', name: 'verklaring.pdf', size: 482 * KB, state: 'error', message: 'Uploaden mislukt', retry: true }],
            'removable',
          ),
        },
        {
          label: 'Mislukt zonder kruisje',
          note: 'In een bericht of een antwoord: alleen Opnieuw.',
          ...attachments([
            { id: 'n', name: 'verklaring.pdf', size: 482 * KB, state: 'error', message: 'Uploaden mislukt', retry: true },
          ]),
        },
        {
          label: 'Lange naam',
          note: 'De naam kapt in het midden af; de extensie en de laatste letters blijven staan.',
          ...attachments([
            { id: 'l', name: 'beleidsregel-subsidie-duurzame-energie-definitief.pdf', size: 860 * KB, state: 'done' },
          ]),
        },
        {
          label: 'Lange namen te verwijderen',
          note: 'Twee namen die alleen in het midden verschillen, in een vraagvak.',
          ...attachments(
            [
              { id: 'b1', name: 'begroting-2026-versie-1-concept.pdf', size: 860 * KB, state: 'done' },
              { id: 'b2', name: 'begroting-2026-versie-2-concept.pdf', size: 864 * KB, state: 'done' },
            ],
            'removable',
          ),
        },
        {
          label: 'Te verwijderen',
          note: 'In een vraagvak of een uploadveld: alleen het kruis, de chip opent niets.',
          ...attachments([{ id: 'r', name: 'beleidsregel-2026.pdf', size: 1.2 * MB, state: 'done' }], 'removable'),
        },
        {
          label: 'Uitgeschakeld',
          ...attachments([{ id: 'u', name: 'beleidsregel-2026.pdf', size: 1.2 * MB, state: 'done' }], 'disabled'),
        },
      ],
    },
  ],
}
