// The content category (Tekst en media): the specimens of its elements.
import { meta } from '../../_data/load.js'

const FOOTNOTE = 'Bron: Zaaksysteem · waarde van 08:15'

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
  <blockquote>Ontbrekende gegevens tellen nooit als nul.</blockquote>
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
          wide: true,
          html: '<lintje-prose data-html></lintje-prose>',
          setup(stage) {
            stage.querySelector('[data-html]').html = PROSE
          },
        },
        {
          label: 'Gedempt, één alinea',
          wide: true,
          html: '<lintje-prose tone="muted" text="Bron: Zaaksysteem · waarde van 08:15. Dit is de tone=&quot;muted&quot;-variant: één alinea, 13 grijs."></lintje-prose>',
        },
        {
          label: 'Uit de slot',
          wide: true,
          html: '<lintje-prose><p>Zonder <code>html</code> of <code>text</code> toont het element wat er in de slot staat — zo schrijft een pagina haar eigen opmaak zonder eigen CSS.</p></lintje-prose>',
        },
      ],
    },
    {
      tag: 'lintje-code',
      title: 'Een blok monospace, ook voor JSON',
      specimens: [
        {
          label: 'JSON, genummerd',
          wide: true,
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
          label: 'SQL, met regelafbreking',
          wide: true,
          html: '<lintje-code language="sql" wrap></lintje-code>',
          setup(stage) {
            stage.querySelector('lintje-code').text =
              'select loket, percentile_cont(0.5) within group (order by wachttijd_seconden) ' +
              'as mediaan from metingen where gemeten_op >= current_date group by loket order by mediaan desc'
          },
        },
        {
          label: 'Zonder taal',
          wide: true,
          html: '<lintje-code></lintje-code>',
          setup(stage) {
            stage.querySelector('lintje-code').text = 'npm ci\nnpm run build:elements'
          },
        },
      ],
    },
    {
      tag: 'lintje-highlight',
      title: 'Markering in lopende tekst',
      specimens: [
        {
          label: 'Term met toelichting, bij hover en focus',
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
      tag: 'lintje-translator',
      title: 'Een tekst en zijn vertaling in één vlak van twee helften',
      specimens: [
        {
          label: 'Tekst en vertaling; de wisselknop staat op de scheidslijn (op een telefoon onder elkaar)',
          wide: true,
          html: TRANSLATOR,
          setup: (stage) => translator(stage, 'Uw aanvraag is ontvangen. Binnen acht weken krijgt u een besluit.'),
        },
        {
          label: 'Documenten (variant documents): de talen boven het sleepvak',
          wide: true,
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
          label: 'Leeg: de vertaling verschijnt terwijl je typt',
          wide: true,
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
          label: 'Golfvorm, speelt na “Afspelen”',
          wide: true,
          html: audio(),
          setup(stage) {
            const player = stage.querySelector('lintje-audio-player')
            player.peaks = PEAKS
            player.src = silentRecording()
          },
        },
        {
          label: 'Sprekers in kleur, met de legenda erboven',
          wide: true,
          html: audio(),
          setup(stage) {
            const player = stage.querySelector('lintje-audio-player')
            player.peaks = PEAKS
            player.segments = SEGMENTS
            player.src = silentRecording()
            player.currentTime = 20
          },
        },
        {
          label: 'Zonder eigen kader (flush): de balk van de pagina is het kader',
          wide: true,
          html: `<div style="background: var(--color-bg-surface); border-top: 1px solid var(--color-border-default); padding: 0 var(--space-4)">${audio().replace('<lintje-audio-player', '<lintje-audio-player flush no-legend')}</div>`,
          setup(stage) {
            const player = stage.querySelector('lintje-audio-player')
            player.peaks = PEAKS
            player.segments = SEGMENTS
            player.src = silentRecording()
          },
        },
        {
          label: 'Zonder golfvorm: een balk',
          wide: true,
          html: audio(),
          setup(stage) {
            stage.querySelector('lintje-audio-player').src = silentRecording()
          },
        },
        {
          label: 'Balk met sprekers',
          wide: true,
          html: audio(),
          setup(stage) {
            const player = stage.querySelector('lintje-audio-player')
            player.segments = SEGMENTS
            player.src = silentRecording()
            player.currentTime = 20
          },
        },
        {
          label: 'Uitgeschakeld: de opname laadt nog',
          wide: true,
          html: audio('duration="2832"'),
          setup(stage) {
            stage.querySelector('lintje-audio-player').peaks = PEAKS
          },
        },
        {
          label: 'Fout',
          wide: true,
          html: audio('src="opnames/bestaat-niet.wav"'),
          setup(stage) {
            stage.querySelector('lintje-audio-player').peaks = PEAKS
          },
        },
        {
          label: 'Compact, op één regel in een rij of tegel',
          wide: true,
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
          label: 'Ondertiteling aan, op 1,25×',
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
          label: 'Meer opties: ondertiteling, audiodescriptie en snelheid',
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
          label: 'Fout: de melding staat in beeld',
          html: '<lintje-video-player name="Hoorzitting zaal 4" src="opnames/bestaat-niet.mp4"></lintje-video-player>',
        },
      ],
    },
    {
      tag: 'lintje-transcript',
      title: 'De tekst van een opname, per segment te bewerken',
      specimens: [
        {
          label: 'Rust, hover, bewerken, spreker wisselen',
          wide: true,
          html: '<lintje-transcript></lintje-transcript>',
          setup(stage) {
            wireTranscript(stage.querySelector('lintje-transcript'))
          },
        },
        {
          label: 'Met de melding en een AI-bewerking erboven, in de kolommen van de fragmenten',
          wide: true,
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
          label: 'Getint en samengevoegd: de kleur onder het hele fragment, één naam per beurt',
          wide: true,
          html: '<lintje-transcript tinted grouped></lintje-transcript>',
          setup(stage) {
            wireTranscript(stage.querySelector('lintje-transcript'), SEGMENTS.slice(0, 4))
          },
        },
        {
          label: 'Als chatberichten (layout="chat")',
          wide: true,
          html: '<lintje-transcript layout="chat" grouped current-time="10"></lintje-transcript>',
          setup(stage) {
            wireTranscript(stage.querySelector('lintje-transcript'), SEGMENTS.slice(0, 4))
          },
        },
        {
          label: 'Live: wie nu spreekt, en de laatste woorden nog voorlopig (groot)',
          wide: true,
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
          label: 'Alleen lezen: een voorbeeld naast een opname die loopt (readonly)',
          html: '<lintje-transcript readonly></lintje-transcript>',
          setup(stage) {
            stage.querySelector('lintje-transcript').segments = SEGMENTS.slice(0, 3).map((segment) => ({ ...segment }))
          },
        },
        {
          label: 'Speelt nu: met de speler verbonden',
          wide: true,
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
      tag: 'lintje-document-viewer',
      title: 'Een document bekijken: bladeren, zoomen en downloaden',
      specimens: [
        {
          label: 'Rust: vijf pagina’s die de host als afbeelding levert',
          wide: true,
          html: '<lintje-document-viewer name="Brief gemeente.pdf" page="2"></lintje-document-viewer>',
          setup(stage) {
            const viewer = stage.querySelector('lintje-document-viewer')
            viewer.pages = letterPages()
            // The text of each page, which a screen reader reads after its image.
            viewer.texts = letterPages().map((_, index) => `Brief gemeente, pagina ${index + 1}.`)
          },
        },
        {
          label: 'Bezig',
          html: '<lintje-document-viewer name="Brief gemeente.pdf"></lintje-document-viewer>',
        },
        {
          label: 'Fout',
          html: '<lintje-document-viewer name="Scan formulier.jpg" src="documenten/bestaat-niet.jpg"></lintje-document-viewer>',
        },
      ],
    },
    {
      tag: 'lintje-gallery',
      title: 'Afbeeldingen van één ding: één groot met bijschrift, de rest als miniatuur',
      specimens: [
        {
          label: 'Drie schermen, het tweede gekozen',
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
          label: 'Eén afbeelding: zonder miniaturen',
          html: '<lintje-gallery></lintje-gallery>',
          setup(stage) {
            stage.querySelector('lintje-gallery').items = [
              { src: 'media/afbeelding.svg', alt: 'Het overzicht van het dashboard', caption: 'Het overzicht.' },
            ]
          },
        },
      ],
    },
  ],
}
