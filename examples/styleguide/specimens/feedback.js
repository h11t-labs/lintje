// The feedback category (Meldingen en status): the specimens of its elements.
import { meta } from '../../_data/load.js'

const TRANSCRIPT = 'De aanvrager schrijft dat zij in maart naar Nederland is verhuisd. Zij wil een kleine bakkerij beginnen. Haar aanvraag is compleet.'

/** A stream the host would read: grows a few words at a time, then is done. */
function simulateStream(element) {
  const words = TRANSCRIPT.split(' ')
  let count = 0
  clearInterval(element._demoTimer)
  element.text = ''
  element.state = 'waiting'
  element._demoTimer = setInterval(() => {
    count += 2
    element.text = words.slice(0, count).join(' ')
    element.state = 'streaming'
    if (count >= words.length) {
      clearInterval(element._demoTimer)
      element.state = 'done'
    }
  }, 350)
}

const PARTIAL = 'De aanvrager schrijft dat zij in maart naar Nederland is verhuisd en een kleine bakkerij'

const JOBS = [
  { id: 'j1', name: 'Overdracht nachtdienst.m4a', state: 'queued', detail: 'Plaats 2 in de wachtrij' },
  {
    id: 'j2',
    name: 'Briefing ochtenddienst.m4a',
    state: 'busy',
    progress: 62,
    detail: 'Transcriberen · 62% · nog ongeveer 3 min',
  },
  { id: 'j3', name: 'Hoorzitting zaal 4.wav', state: 'paused', progress: 40, detail: 'Upload afgebroken bij 40%' },
  {
    id: 'j4',
    name: 'Teamoverleg 2 oktober.m4a',
    state: 'done',
    href: '#el-job-list',
    detail: '47:12 · 3 sprekers · klaar om 09:31',
  },
  {
    id: 'j5',
    name: 'Interview 3.wav',
    state: 'error',
    detail: 'Het bestand is beschadigd en kan niet worden gelezen',
  },
  { id: 'j6', name: 'Proefopname.mp3', state: 'cancelled', detail: 'Geannuleerd om 09:02' },
]

/** The host's half of the queue: the four requests move a job, and the list is set again. */
const DONE_JOBS = [
  {
    id: 'd1',
    name: 'Brief aanvrager.docx',
    state: 'done',
    href: '#el-job-list',
    icon: 'op-kantoor-document-blanco',
    detail: 'Engels → Nederlands · 3 pagina’s',
    meta: 'vandaag 10:12',
  },
  {
    id: 'd2',
    name: 'Huurcontract.pdf',
    state: 'done',
    href: '#el-job-list',
    icon: 'op-kantoor-document-blanco',
    detail: 'Pools → Nederlands · 5 pagina’s',
    meta: 'gisteren',
  },
]

function wireJobs(list, jobs) {
  list.jobs = jobs.map((job) => ({ ...job }))
  const move = (id, change) => {
    list.jobs = list.jobs.flatMap((job) => {
      if (job.id !== id) return [job]
      const next = change(job)
      return next ? [{ ...job, ...next }] : []
    })
  }
  list.addEventListener('lintje-job-cancel', (event) =>
    move(event.detail, () => ({ state: 'cancelled', progress: null, detail: 'Zojuist geannuleerd' })),
  )
  list.addEventListener('lintje-job-resume', (event) =>
    move(event.detail, (job) => ({ state: 'busy', detail: `Uploaden · ${job.progress}%` })),
  )
  list.addEventListener('lintje-job-retry', (event) =>
    move(event.detail, () => ({ state: 'queued', detail: 'Plaats 1 in de wachtrij' })),
  )
  list.addEventListener('lintje-job-remove', (event) => move(event.detail, () => null))
}

const announcement = (kind, title, text, extra = '') =>
  `<lintje-announcement compact data-kind="${kind}" data-title="${title}" data-text="${text}">${extra}</lintje-announcement>`

/** The announcement takes its content as `data`; the specimens carry it in data attributes. */
function setupAnnouncements(stage, more = {}) {
  for (const element of stage.querySelectorAll('lintje-announcement')) {
    const { kind, title, text } = element.dataset
    element.data = { kind, title, text, ...more }
  }
}

// `warning`, never `caution`: the four kinds are the contract (`AnnouncementKind`).
const KINDS = [
  [
    'Waarschuwing, met sluitknop, meta en link',
    {
      kind: 'warning',
      title: 'Let op',
      dismissible: true,
      text: 'Twee loketten leveren vertraagd aan.',
      meta: 'Geplaatst 07:52 · Bronbewaking',
      link: { label: 'Bekijk de aanlevering', href: '#' },
    },
  ],
  [
    'Storing',
    {
      kind: 'outage',
      title: 'Storing',
      dismissible: true,
      text: 'De dossierregistratie levert sinds 07:41 niet aan. Een storing is nooit weg te klikken.',
    },
  ],
  ['Informatie', { kind: 'info', title: 'Nieuw', text: 'De bezettingspagina is toegevoegd.' }],
  ['Gelukt', { kind: 'ok', text: 'Alle loketten leveren compleet aan.' }],
  [
    'Gelukt, met een titel',
    {
      kind: 'ok',
      title: 'Aanlevering hersteld',
      text: 'De dossierregistratie levert sinds 09:12 weer aan. De cijfers van vanochtend zijn bijgewerkt.',
      meta: 'Geplaatst 09:15 · Bronbewaking',
    },
  ],
  [
    'In een tegel',
    {
      kind: 'warning',
      title: 'Let op',
      text: 'In een tegel, zoals het zijpaneel op het overzicht.',
      meta: `Gemeld om ${meta.as_of.time}`,
      tile: { title: 'Let op', subtitle: 'Aandachtspunten van vandaag' },
    },
  ],
]

/** A column's own toast container: one toast at a time, closed by its own event. */
function showToast(place, kind) {
  const toast = document.createElement('lintje-toast')
  toast.kind = kind
  toast.action = 'Ongedaan maken'
  toast.textContent = kind === 'ok' ? 'Selectie gekopieerd' : 'Downloaden is niet gelukt'
  toast.addEventListener('lintje-close', () => toast.remove())
  place.replaceChildren(toast)
}

export default {
  elements: [
{
      tag: 'lintje-announcement',
      title: 'Een melding op de plek waar ze over gaat',
      specimens: [
        ...KINDS.map(([label, data]) => ({
          label,
          wide: true,
          html: '<lintje-announcement></lintje-announcement>',
          setup(stage) {
            stage.querySelector('lintje-announcement').data = data
          },
        })),
        {
          label: 'Compact, in de inhoud',
          html: announcement('info', 'Deze opname wordt na 30 dagen verwijderd.', 'Exporteer het transcript als je het wilt bewaren.'),
          setup: (stage) => setupAnnouncements(stage),
        },
        {
          label: 'Met een linkknop',
          html: announcement(
            'warning',
            '2 fragmenten met lage zekerheid.',
            'Controleer de gemarkeerde woorden.',
            '<lintje-button slot="action" variant="link" size="compact">Naar het eerste fragment</lintje-button>',
          ),
          setup: (stage) => setupAnnouncements(stage),
        },
        {
          label: 'Met beeld ernaast',
          html: announcement(
            'info',
            'Start de opname op je telefoon.',
            'Scan de code; de opname verschijnt hier vanzelf.',
            '<img slot="media" src="../transcriptie/qr-telefoon.svg" width="112" height="112" alt="QR-code die Transcriptie op je telefoon opent">',
          ),
          setup: (stage) => setupAnnouncements(stage),
        },
        {
          label: 'Met een actie — rechts als de melding breed is',
          wide: true,
          html: `<lintje-announcement>
            <lintje-button slot="action" variant="secondary" size="compact">Verder met het concept</lintje-button>
          </lintje-announcement>`,
          setup(stage) {
            stage.querySelector('lintje-announcement').data = {
              kind: 'info',
              title: 'Concept',
              text: '“Losliggende stoeptegel bij perron 3” is nog niet verstuurd.',
              meta: 'bewaard om 14:05',
            }
          },
        },
        {
          label: 'Met een link',
          html: announcement('info', 'Er is een nieuwe versie van het transcript.', ''),
          setup: (stage) => setupAnnouncements(stage, { link: { label: 'Bekijk de wijzigingen', href: '#el-announcement' } }),
        },
        {
          label: 'Fout',
          html: announcement('outage', 'Het transcriberen is mislukt.', 'Upload de opname opnieuw.'),
          setup: (stage) => setupAnnouncements(stage),
        },
        {
          label: 'Met sluitknop',
          html: announcement('ok', 'De vertaling is klaar.', "3 pagina's, Engels naar Nederlands."),
          setup: (stage) => setupAnnouncements(stage, { dismissible: true }),
        },
        {
          // `live`: it appears in answer to something that just happened, so it is spoken.
          label: 'Live, na een mislukte actie',
          html: announcement('warning', 'Het opslaan is niet gelukt.', 'Probeer het over een minuut opnieuw.'),
          setup: (stage) => setupAnnouncements(stage, { live: true }),
        },
      ],
    },
    {
      tag: 'lintje-toast',
      title: 'Een korte bevestiging of foutmelding die vanzelf een plek krijgt',
      specimens: [
        {
          label: 'Gelukt, met een actie',
          html: '<lintje-button variant="secondary">Toon toast</lintje-button><div data-place></div>',
          setup(stage) {
            const place = stage.querySelector('[data-place]')
            stage.querySelector('lintje-button').addEventListener('click', () => showToast(place, 'ok'))
          },
        },
        {
          label: 'Fout, met een actie',
          html: '<lintje-button variant="secondary">Toon fout-toast</lintje-button><div data-place></div>',
          setup(stage) {
            const place = stage.querySelector('[data-place]')
            stage.querySelector('lintje-button').addEventListener('click', () => showToast(place, 'error'))
          },
        },
      ],
    },
    {
      tag: 'lintje-conflict-alert',
      title: 'Iemand anders heeft het item intussen gewijzigd',
      specimens: [
        {
          // Behind a button: the alert takes the focus when it appears, which on load would
          // pull the page down to it.
          label: 'Rust, bezig na een keuze, verschillen',
          wide: true,
          html: `<lintje-button variant="secondary" size="compact">Opslaan, terwijl M. Jansen het al wijzigde</lintje-button>
            <div data-place></div>`,
          setup(stage) {
            const place = stage.querySelector('[data-place]')
            stage.querySelector('lintje-button').addEventListener('click', () => {
              place.replaceChildren()
              const alert = document.createElement('lintje-conflict-alert')
              alert.setAttribute('who', 'M. Jansen')
              alert.setAttribute('when', '10:40')
              alert.setAttribute('item', 'deze melding')
              alert.changes = [
                { label: 'Omschrijving', mine: 'Tas zonder eigenaar in vergaderzaal 1', theirs: 'Tas zonder eigenaar in vergaderzaal 2' },
                { label: 'Prioriteit', mine: 'Normaal', theirs: 'Hoog' },
              ]
              const save = (choice) => {
                alert.busy = choice
                setTimeout(() => alert.remove(), 1500)
              }
              alert.addEventListener('lintje-conflict-keep-mine', () => save('mine'))
              alert.addEventListener('lintje-conflict-take-theirs', () => save('theirs'))
              place.append(alert)
            })
          },
        },
      ],
    },
    {
      tag: 'lintje-empty-state',
      title: 'De lege toestand, los van een tegel',
      specimens: [
        {
          label: 'Nog niets',
          html: `<lintje-empty-state icon="functioneel-upload" heading="Nog geen opnames"
              text="Upload een opname om er een transcript van te maken.">
              <lintje-button variant="primary" block>Opname uploaden</lintje-button>
            </lintje-empty-state>`,
        },
        {
          label: 'Niets gevonden',
          html: `<lintje-empty-state icon="functioneel-zoek" heading="Geen resultaten voor “roostermaaker”"
              text="Controleer de spelling of zoek met minder woorden." status>
              <lintje-button variant="secondary" block>Zoekopdracht wissen</lintje-button>
            </lintje-empty-state>`,
        },
        {
          label: 'Geen toegang',
          html: `<lintje-empty-state heading="Je hebt geen toegang tot dit dossier"
              text="Vraag je leidinggevende om toegang."></lintje-empty-state>`,
        },
        {
          label: 'Klein',
          html: `<lintje-empty-state compact text="Geen resultaten voor “roostermaaker”.">
              <lintje-button variant="link">Zoekopdracht wissen</lintje-button>
            </lintje-empty-state>`,
        },
      ],
    },
    {
      tag: 'lintje-badge',
      title: 'Een status als woord',
      specimens: [
        {
          label: 'Neutraal en subtiel',
          html: '<div class="guide__row"><lintje-badge>Concept</lintje-badge><lintje-badge tone="subtle">Geannuleerd</lintje-badge></div>',
        },
        { label: 'Bezig', html: '<lintje-badge tone="busy">Bezig</lintje-badge>' },
        { label: 'Fout', html: '<lintje-badge tone="error">Mislukt</lintje-badge>' },
        { label: 'Gelukt', html: '<lintje-badge tone="success">Klaar</lintje-badge>' },
        { label: 'Let op', html: '<lintje-badge tone="warning">Onderbroken</lintje-badge>' },
        { label: 'Informatie', html: '<lintje-badge tone="info">Nieuw</lintje-badge>' },
        { label: 'Aandacht', html: '<lintje-badge tone="attention">Controleren</lintje-badge>' },
        { label: 'Live: een opname die nu loopt', html: '<lintje-badge tone="live">Neemt op</lintje-badge>' },
        {
          label: 'Teller',
          html: '<div class="guide__row"><span>Opmerkingen <lintje-badge variant="count" label="2 opmerkingen">2</lintje-badge></span><span>Ongelezen <lintje-badge variant="unread" label="12 ongelezen">12</lintje-badge></span></div>',
        },
      ],
    },
    {
      tag: 'lintje-status-dot',
      title: 'Een bronstatus: stip en woord',
      specimens: [
        {
          label: 'De vier toestanden',
          html: '<div class="guide__row"><lintje-status-dot tone="complete"></lintje-status-dot><lintje-status-dot tone="delayed"></lintje-status-dot><lintje-status-dot tone="outage"></lintje-status-dot><lintje-status-dot tone="no-data"></lintje-status-dot></div>',
        },
        {
          label: 'Eigen woord',
          html: '<lintje-status-dot tone="delayed" label="Levert vertraagd aan"></lintje-status-dot>',
        },
      ],
    },
    {
      tag: 'lintje-spinner',
      title: 'Laadindicator voor inhoud zonder bekende vorm',
      specimens: [
        {
          label: 'Drie maten',
          html: '<div class="guide__row"><lintje-spinner></lintje-spinner><lintje-spinner size="24"></lintje-spinner><lintje-spinner size="40"></lintje-spinner></div>',
        },
        {
          label: 'Met tekst ernaast',
          html: '<lintje-spinner label="Locaties ophalen"></lintje-spinner>',
        },
        {
          label: 'Met tekst eronder',
          html: '<lintje-spinner size="40" stacked label="Het document wordt geopend"></lintje-spinner>',
        },
      ],
    },
    {
      tag: 'lintje-skeleton',
      title: 'Een plaatsvervanger voor inhoud die nog komt',
      specimens: [
        {
          label: 'Twee regels',
          wide: true,
          html: '<div class="guide__stack"><lintje-skeleton width="60%" height="13"></lintje-skeleton><lintje-skeleton width="40%" height="13"></lintje-skeleton></div>',
        },
        {
          label: 'Een blok',
          html: '<lintje-skeleton width="160" height="48"></lintje-skeleton>',
        },
      ],
    },
    {
      tag: 'lintje-progress-bar',
      title: 'Voortgang van een taak, met of zonder percentage',
      specimens: [
        {
          label: 'Bepaald',
          html: '<lintje-progress-bar label="Transcriberen" detail="62% · nog ongeveer 3 min" value="62"></lintje-progress-bar>',
        },
        {
          label: 'Onbepaald',
          html: '<lintje-progress-bar label="Wachten op de server" detail="duur onbekend"></lintje-progress-bar>',
        },
        {
          label: 'Klaar',
          html: '<lintje-progress-bar label="Klaar" detail="100%" value="100"></lintje-progress-bar>',
        },
        {
          label: 'Fout',
          html: '<lintje-progress-bar label="Afgebroken bij 40%" value="40" tone="error"><lintje-button variant="link">Hervatten</lintje-button></lintje-progress-bar>',
        },
        {
          label: 'Gepauzeerd',
          html: '<lintje-progress-bar label="Uploaden" detail="62% · gepauzeerd" value="62" tone="paused"></lintje-progress-bar>',
        },
      ],
    },
    {
      tag: 'lintje-job-list',
      title: 'De wachtrij van lange taken',
      specimens: [
        {
          label: 'Bezig, fout, wachtrij, onderbroken, klaar, geannuleerd',
          wide: true,
          html: '<lintje-job-list></lintje-job-list>',
          setup: (stage) => wireJobs(stage.querySelector('lintje-job-list'), JOBS),
        },
        {
          label: 'Alleen klaar, met soort en moment: "Klaar" valt weg',
          wide: true,
          html: '<lintje-job-list></lintje-job-list>',
          setup(stage) {
            stage.querySelector('lintje-job-list').jobs = DONE_JOBS
          },
        },
      ],
    },
    {
      tag: 'lintje-streaming-text',
      title: 'Tekst die binnenstroomt terwijl de server hem maakt',
      specimens: [
        {
          label: 'Wacht op het eerste woord',
          html: '<lintje-streaming-text label="Bezig met vertalen"></lintje-streaming-text>',
        },
        {
          label: 'Stroomt binnen',
          html: '<lintje-streaming-text state="streaming"></lintje-streaming-text>',
          setup(stage) {
            stage.querySelector('lintje-streaming-text').text = PARTIAL
          },
        },
        {
          label: 'Klaar',
          html: '<lintje-streaming-text state="done"></lintje-streaming-text>',
          setup(stage) {
            stage.querySelector('lintje-streaming-text').text = TRANSCRIPT
          },
        },
        {
          label: 'Zonder kader (variant plain): in een vlak dat de tekst zelf omlijst',
          html: '<lintje-streaming-text state="done" variant="plain"></lintje-streaming-text>',
          setup(stage) {
            stage.querySelector('lintje-streaming-text').text = TRANSCRIPT
          },
        },
        {
          label: 'Gestopt',
          html: '<lintje-streaming-text state="stopped"></lintje-streaming-text>',
          setup(stage) {
            stage.querySelector('lintje-streaming-text').text = PARTIAL
          },
        },
        {
          label: 'Fout',
          html: '<lintje-streaming-text state="error"></lintje-streaming-text>',
          setup(stage) {
            stage.querySelector('lintje-streaming-text').text = PARTIAL
          },
        },
        {
          label: 'Levend — Stoppen en Opnieuw werken',
          wide: true,
          html: '<lintje-streaming-text label="Bezig met transcriberen"></lintje-streaming-text>',
          setup(stage) {
            const element = stage.querySelector('lintje-streaming-text')
            element.addEventListener('lintje-stop', () => {
              clearInterval(element._demoTimer)
              element.state = 'stopped'
            })
            element.addEventListener('lintje-retry', () => simulateStream(element))
            simulateStream(element)
          },
        },
      ],
    },
    {
      tag: 'lintje-ai-label',
      title: 'Zichtbaar maken dat een model de inhoud heeft gemaakt',
      specimens: [
        {
          label: 'Rust',
          html: '<lintje-ai-label></lintje-ai-label>',
        },
        {
          label: 'Gecontroleerd',
          html: '<lintje-ai-label checked-by="J. de Vries"></lintje-ai-label>',
        },
        {
          label: 'Plaats: boven het blok',
          wide: true,
          html: `<lintje-ai-label></lintje-ai-label>
            <p>De aanvrager schrijft dat zij in maart naar Nederland is verhuisd.</p>`,
        },
      ],
    },
    {
      tag: 'lintje-level-meter',
      title: 'Hoe hard het geluid binnenkomt, met het woord erbij',
      specimens: [
        {
          label: 'Goed, beweegt mee met het niveau',
          html: '<lintje-level-meter level="0.6"></lintje-level-meter>',
          setup(stage) {
            const meter = stage.querySelector('lintje-level-meter')
            const timer = setInterval(() => {
              if (!meter.isConnected) return clearInterval(timer)
              meter.level = 0.3 + Math.random() * 0.6
            }, 180)
          },
        },
        { label: 'Zacht', html: '<lintje-level-meter level="0.12"></lintje-level-meter>' },
        { label: 'Stil: plat', html: '<lintje-level-meter level="0"></lintje-level-meter>' },
        { label: 'Nog niet gemeten', html: '<lintje-level-meter></lintje-level-meter>' },
      ],
    },
    {
      tag: 'lintje-recording-status',
      title: 'Hoe een opname die loopt ervoor staat',
      specimens: [
        {
          label: 'Op je telefoon: looptijd, geluid en verbinding',
          wide: true,
          html: '<lintje-recording-status elapsed="724" level="0.6" connection="good" delay="1"></lintje-recording-status>',
        },
        {
          label: 'Zwakke verbinding, zacht geluid',
          wide: true,
          html: '<lintje-recording-status elapsed="3729" level="0.12" connection="weak" delay="4"></lintje-recording-status>',
        },
        {
          label: 'Op deze computer: zonder verbinding; wat ontbreekt is een streep',
          html: '<lintje-recording-status elapsed="48"></lintje-recording-status>',
        },
      ],
    },
  ],
}
