// The inputs category (Invoervelden): the specimens of its elements.
import { regions } from '../../_data/load.js'
import { log } from '../shared.js'

const ALL = { value: 'alle', label: 'Alle regio’s' }

const REGIONS = [ALL, ...regions.map((region) => ({ value: region.id, label: region.name }))]

const KINDS = [
  { value: 'alle', label: 'Alle' },
  { value: 'counter', label: 'Balie' },
  { value: 'service', label: 'Servicepunt' },
  { value: 'mobile', label: 'Mobiel' },
]

const SOURCES = [
  { value: 'balie', label: 'Balie', description: 'Aanvragen aan het loket' },
  { value: 'online', label: 'Online', description: 'Aanvragen via het portaal' },
  { value: 'telefoon', label: 'Telefoon', description: 'Aanvragen via het contactcentrum' },
  { value: 'post', label: 'Post' },
]

/** Opening hours, two hours apart: the two handles pick indexes into this list. */
const HOURS = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00']

/** Waiting-time norms in minutes: one handle, and its value is the chosen step itself. */
const NORMS = [5, 10, 15, 20, 30]

const PERIOD = { from: '01-09-2026', to: '08-09-2026' }

const LAST_DAY = new Date(2026, 8, 8)

/** Writes the `{ [name]: value }` the control sends the host into a line under it. */
function hearValues(stage, tag) {
  const say = log(stage)
  stage.querySelector(tag).addEventListener('lintje-values-change', (event) => {
    say(`lintje-values-change ${JSON.stringify(event.detail)}`)
  })
}

const setOptions = (tag, options, value) => (stage) => {
  const control = stage.querySelector(tag)
  control.options = options
  if (value !== undefined) control.value = value
}

// A control shows what its owner gives it. Here the specimen is the owner: it writes the
// reader's choice back, as a filter bar does with the next `data`.
const setSteps = (tag, steps) => (stage) => {
  const control = stage.querySelector(tag)
  control.steps = steps
  control.addEventListener('lintje-change', ({ detail }) => {
    if (Array.isArray(detail)) [control.from, control.to] = detail
    else control.value = detail
  })
}

const setSelected = (options, selected) => (stage) => {
  const control = stage.querySelector('lintje-multiselect')
  control.options = options
  control.selected = selected
  control.addEventListener('lintje-change', ({ detail }) => (control.selected = detail))
}

const setRange = (stage) => {
  const control = stage.querySelector('lintje-date-range')
  control.range = PERIOD
  control.today = LAST_DAY
  control.maxDate = LAST_DAY
  control.addEventListener('lintje-change', ({ detail }) => (control.range = detail))
}

/** Three days of half-hour slots: one taken on each day with times, and Wednesday has none. */
const SLOT_DAYS = ['2026-10-12', '2026-10-13', '2026-10-14'].map((date, index) => ({
  date,
  slots:
    index === 2
      ? []
      : ['09:00', '09:30', '10:00', '10:30'].map((time, slot) => ({
          value: `${date}T${time}`,
          label: time,
          full: slot === index + 1,
        })),
}))

// The specimen is the owner: it writes the reader's choice back, as a form would.
const setDays = (stage, value = '') => {
  const picker = stage.querySelector('lintje-slot-picker')
  picker.days = SLOT_DAYS
  picker.value = value
  picker.addEventListener('lintje-change', ({ detail }) => (picker.value = detail))
}

const LOCATIES = [
  { value: 'ingang', label: 'Hoofdingang' },
  { value: 'ontvangst', label: 'Ontvangsthal' },
  { value: 'balie', label: 'Bezoekersbalie' },
  { value: 'vergader', label: 'Vergadercentrum' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'v3', label: 'Verdieping 3' },
  { value: 'v7', label: 'Verdieping 7' },
  { value: 'stalling', label: 'Fietsenstalling' },
]

const MB = 1024 * 1024

const VIEW = [
  { value: 'dag', label: 'Per dag' },
  { value: 'week', label: 'Per week' },
  { value: 'maand', label: 'Per maand' },
]

/** Gives every radio group in the stage the view options and a first value. */
function view(stage, value) {
  const group = stage.querySelector('lintje-radio-group')
  group.options = VIEW
  group.value = value
}

/** A fictional search over the locations, answered after 600 ms. */
function remoteSearch(combobox) {
  combobox.options = []
  combobox.addEventListener('lintje-search', (event) => {
    const query = event.detail.query.trim().toLowerCase()
    setTimeout(() => {
      combobox.options = LOCATIES.filter((item) => item.label.toLowerCase().includes(query))
    }, 600)
  })
}

/** Plays an upload for every added file: busy, then done. Nothing leaves the page. */
function fakeUploads(upload) {
  let next = 0
  const set = (rows) => (upload.files = rows)
  upload.addEventListener('lintje-files-add', (event) => {
    for (const file of event.detail) {
      const id = `demo-${(next += 1)}`
      set([...(upload.files ?? []), { id, name: file.name, size: file.size, state: 'busy', progress: 0 }])
      const timer = setInterval(() => {
        const rows = upload.files.map((row) => {
          if (row.id !== id) return row
          const progress = Math.min(100, (row.progress ?? 0) + 20)
          return progress >= 100 ? { ...row, state: 'done', progress: 100 } : { ...row, progress }
        })
        set(rows)
        if (rows.find((row) => row.id === id)?.state !== 'busy') clearInterval(timer)
      }, 400)
    }
  })
  const drop = (event) => set(upload.files.filter((row) => row.id !== event.detail.id))
  upload.addEventListener('lintje-file-remove', drop)
  upload.addEventListener('lintje-file-cancel', drop)
}

/** Writes every `lintje-change` of the stage's element into a log line under it. */
function logChanges(stage, tag) {
  const say = log(stage, 'Nog niets verstuurd.')
  stage.querySelector(tag).addEventListener('lintje-change', ({ detail }) => {
    say(`lintje-change: ${JSON.stringify(detail)}`)
  })
}

const NOTE =
  'De omgeving is **afgezet tot 15:00**. Voor de overdracht:\n\n' +
  '- eigenaar is omgeroepen, zonder reactie\n- beelden zijn opgevraagd'

export default {
  elements: [
    {
      tag: 'lintje-field',
      title: 'Het label boven een filter, met de oranje stip als het afwijkt',
      specimens: [
        {
          label: 'Rust',
          html: '<lintje-field label="Regio"><lintje-select label="Regio" hide-label></lintje-select></lintje-field>',
          setup: setOptions('lintje-select', REGIONS, 'alle'),
        },
        {
          label: 'Afwijkend van standaard',
          html: '<lintje-field label="Regio" modified><lintje-select label="Regio" hide-label bold></lintje-select></lintje-field>',
          setup: setOptions('lintje-select', REGIONS, 'reg-zuid'),
        },
        {
          label: 'Gestapeld (het filterblad)',
          html: '<lintje-field label="Regio" stacked><lintje-select label="Regio" hide-label stacked></lintje-select></lintje-field>',
          setup: setOptions('lintje-select', REGIONS, 'alle'),
        },
      ],
    },
{
      tag: 'lintje-text-input',
      title: 'Zoeken, wachtwoord, e-mail en vastleggen per toetsaanslag',
      specimens: [
        {
          label: 'Rust, zoeken',
          html: '<lintje-text-input type="search" commit="input" label="Zoeken" value="roostermaker" hint="3 resultaten"></lintje-text-input>',
          setup(stage) {
            const field = stage.querySelector('lintje-text-input')
            const woorden = ['roostermaker', 'roosterwijziging', 'rooster vergaderzaal']
            field.addEventListener('lintje-change', (event) => {
              const query = String(event.detail).toLowerCase()
              const count = query ? woorden.filter((woord) => woord.includes(query)).length : 0
              field.hint = query ? `${count} ${count === 1 ? 'resultaat' : 'resultaten'}` : ''
            })
          },
        },
        {
          label: 'Hover op het kruis',
          html: '<lintje-text-input type="search" label="Zoeken" value="roostermaker" hint="Het kruis kleurt donkerder"></lintje-text-input>',
        },
        {
          label: 'Focus',
          html: '<lintje-text-input type="search" label="Zoeken" value="rooster"></lintje-text-input>',
        },
        {
          label: 'Uitgeschakeld',
          html: '<lintje-text-input type="search" label="Zoeken" placeholder="Woord of naam" disabled></lintje-text-input>',
        },
        {
          label: 'Fout',
          html: '<lintje-text-input type="email" label="E-mailadres" value="j.devries@" error="Vul een volledig e-mailadres in"></lintje-text-input>',
        },
        {
          label: 'Wachtwoord',
          html: '<lintje-text-input type="password" label="Wachtwoord van het archief" value="voorbeeld" autocomplete="current-password"></lintje-text-input>',
        },
        {
          label: 'Met naam en hint',
          html: '<lintje-text-input name="p.zoek" label="Zoek op naam" placeholder="Naam of nummer" clearable value="Utrecht" hint="Enter of uit het veld klikken bevestigt."></lintje-text-input>',
        },
        {
          label: 'Afwijkend van standaard',
          html: '<lintje-text-input name="p.zoek-afwijkend" label="Afwijkend van standaard" value="Eindhoven" modified clearable></lintje-text-input>',
        },
        {
          label: 'Met foutmelding',
          html: '<lintje-text-input name="p.zoek-fout" label="Met foutmelding" value="!!" error="Gebruik alleen letters en cijfers."></lintje-text-input>',
        },
        {
          label: 'Uitgeschakeld, met naam',
          html: '<lintje-text-input name="p.zoek-uit" label="Uitgeschakeld" value="Niet te wijzigen" disabled></lintje-text-input>',
        },
        {
          label: 'Niet verplicht',
          html: '<lintje-text-input name="tussenvoegsel" label="Tussenvoegsel" optional></lintje-text-input>',
        },
        {
          label: 'Verplicht',
          html: '<lintje-text-input name="achternaam" label="Achternaam" required autocomplete="family-name"></lintje-text-input>',
        },
        {
          label: 'Alleen-lezen',
          html: '<lintje-text-input name="dossier" label="Dossiernummer" value="2026-0412" readonly clearable></lintje-text-input>',
        },
      ],
    },
    {
      tag: 'lintje-textarea',
      title: 'Meerregelig tekstveld met teller',
      specimens: [
        {
          label: 'Rust',
          html: '<lintje-textarea label="Omschrijving" maxlength="2000" value="Tas zonder eigenaar bij de balie."></lintje-textarea>',
        },
        {
          label: 'Uitgeschakeld',
          html: '<lintje-textarea label="Omschrijving" maxlength="2000" disabled value="Tas zonder eigenaar bij de balie."></lintje-textarea>',
        },
        {
          label: 'Fout',
          html: '<lintje-textarea label="Omschrijving" placeholder="Wat heb je gezien of gehoord?" error="Omschrijving is verplicht"></lintje-textarea>',
        },
        {
          label: 'Gewijzigd',
          html: '<lintje-textarea label="Omschrijving" modified value="Tas zonder eigenaar, omgeving afgezet."></lintje-textarea>',
        },
        {
          label: 'Over de limiet',
          html: '<lintje-textarea label="Omschrijving" maxlength="40" value="Een tekst die langer is dan de limiet toelaat."></lintje-textarea>',
        },
        {
          label: 'Zonder kader (variant plain), acht regels: voor een vlak dat de tekst zelf omlijst',
          html: '<lintje-textarea label="Tekst om te vertalen" hide-label variant="plain" rows="8" maxlength="5000" value="Uw aanvraag is ontvangen. Binnen acht weken krijgt u een besluit."></lintje-textarea>',
        },
        {
          label: 'Niet verplicht',
          html: '<lintje-textarea name="toelichting" label="Toelichting" optional></lintje-textarea>',
        },
        {
          label: 'Verplicht',
          html: '<lintje-textarea name="omschrijving" label="Omschrijving" required></lintje-textarea>',
        },
        {
          label: 'Alleen-lezen',
          html: '<lintje-textarea name="verslag" label="Verslag" readonly value="Tas om 10:42 overgedragen aan de beveiliging."></lintje-textarea>',
        },
      ],
    },
    {
      tag: 'lintje-number-input',
      title: 'Een getal met stapknoppen, ondergrens en bovengrens',
      specimens: [
        {
          label: 'Rust, met wat de host hoort',
          html: '<lintje-number-input name="p.drempel" label="Drempel" value="5" min="0" max="20" hint="Stapjes van 1, tussen 0 en 20."></lintje-number-input>',
          setup: (stage) => hearValues(stage, 'lintje-number-input'),
        },
        {
          label: 'Op de ondergrens, afwijkend',
          html: '<lintje-number-input name="p.drempel-min" label="Op de ondergrens" value="0" min="0" max="20" modified></lintje-number-input>',
        },
        {
          label: 'Eenheid zonder stapknoppen',
          html: '<lintje-number-input name="p.norm" label="Norm zonder stepper" value="15" unit="min"></lintje-number-input>',
          // A Boolean whose default is `true` can only be turned off as a property.
          setup: (stage) => (stage.querySelector('lintje-number-input').stepper = false),
        },
        {
          label: 'Uitgeschakeld',
          html: '<lintje-number-input name="p.drempel-uit" label="Uitgeschakeld" value="5" disabled></lintje-number-input>',
        },
        {
          label: 'Fout',
          html: '<lintje-number-input name="p.drempel-fout" label="Drempel" value="25" min="0" max="20" error="Kies een getal van 0 tot en met 20."></lintje-number-input>',
        },
        {
          label: 'Niet verplicht',
          html: '<lintje-number-input name="bezoekers" label="Aantal bezoekers" min="0" optional></lintje-number-input>',
        },
        {
          label: 'Verplicht',
          html: '<lintje-number-input name="personen" label="Aantal personen" value="1" min="1" required></lintje-number-input>',
        },
        {
          label: 'Alleen-lezen',
          html: '<lintje-number-input name="p.drempel-vast" label="Drempel" value="5" min="0" max="20" readonly></lintje-number-input>',
        },
      ],
    },
    {
      tag: 'lintje-select',
      title: 'Eén waarde kiezen uit een lijst',
      specimens: [
        {
          label: 'Rust, met wat de host hoort',
          html: '<lintje-select name="p.regio" label="Regio"></lintje-select>',
          setup(stage) {
            setOptions('lintje-select', REGIONS, 'alle')(stage)
            hearValues(stage, 'lintje-select')
          },
        },
        {
          label: 'Afwijkend van standaard, vet',
          html: '<lintje-select label="Regio" modified bold></lintje-select>',
          setup: setOptions('lintje-select', REGIONS, 'reg-zuid'),
        },
        {
          label: 'Fout',
          html: '<lintje-select label="Regio" error="Kies een regio."></lintje-select>',
          setup: setOptions('lintje-select', REGIONS),
        },
        {
          label: 'Uitgeschakeld',
          html: '<lintje-select label="Regio" disabled></lintje-select>',
          setup: setOptions('lintje-select', REGIONS, 'alle'),
        },
      ],
    },
    {
      tag: 'lintje-combobox',
      title: 'Zoeken terwijl je typt en één waarde kiezen',
      specimens: [
        {
          label: 'Rust',
          html: '<lintje-combobox label="Locatie" value="vh2" empty-label="Geen locatie gevonden voor"></lintje-combobox>',
          setup(stage) {
            stage.querySelector('lintje-combobox').options = LOCATIES
          },
        },
        {
          label: 'Uitgeschakeld',
          html: '<lintje-combobox label="Locatie" value="vh2" disabled></lintje-combobox>',
          setup(stage) {
            stage.querySelector('lintje-combobox').options = LOCATIES
          },
        },
        {
          label: 'Bezig (van de server)',
          html: '<lintje-combobox label="Locatie" remote loading-label="Locaties ophalen" empty-label="Geen locatie gevonden voor" placeholder="Typ om te zoeken"></lintje-combobox>',
          setup(stage) {
            remoteSearch(stage.querySelector('lintje-combobox'))
          },
        },
        {
          label: 'Fout',
          html: '<lintje-combobox label="Locatie" error="Kies een locatie"></lintje-combobox>',
          setup(stage) {
            stage.querySelector('lintje-combobox').options = LOCATIES
          },
        },
        {
          label: 'Open',
          html: '<lintje-combobox label="Locatie" value="vh3" open></lintje-combobox>',
          setup(stage) {
            stage.querySelector('lintje-combobox').options = LOCATIES
          },
        },
        {
          label: 'Gewijzigd',
          html: '<lintje-combobox label="Locatie" value="tr" modified></lintje-combobox>',
          setup(stage) {
            stage.querySelector('lintje-combobox').options = LOCATIES
          },
        },
      ],
    },
    {
      tag: 'lintje-multiselect',
      title: 'Meer waarden kiezen in een venster met zoekveld',
      specimens: [
        {
          label: 'Rust, met chips',
          html: '<lintje-multiselect label="Bron van de aanvraag" hint="Een bron met een omschrijving krijgt een tweede regel."></lintje-multiselect>',
          setup: setSelected(SOURCES, ['balie', 'online']),
        },
        {
          label: 'Met samenvatting',
          html: '<lintje-multiselect label="Bron van de aanvraag" summary="Bronnen: 2 van 4"></lintje-multiselect>',
          setup: setSelected(SOURCES, ['balie', 'online']),
        },
        {
          label: 'Afwijkend van standaard',
          html: '<lintje-multiselect label="Bron van de aanvraag" modified></lintje-multiselect>',
          setup: setSelected(SOURCES, ['telefoon']),
        },
        {
          label: 'Fout',
          html: '<lintje-multiselect label="Bron van de aanvraag" error="Kies minstens één bron."></lintje-multiselect>',
          setup: setSelected(SOURCES, []),
        },
        {
          label: 'Uitgeschakeld',
          html: '<lintje-multiselect label="Bron van de aanvraag" disabled></lintje-multiselect>',
          setup: setSelected(SOURCES, ['balie']),
        },
      ],
    },
    {
      tag: 'lintje-tag-input',
      title: 'Vrije trefwoorden als chips in één veld',
      specimens: [
        {
          label: 'Rust',
          html: '<lintje-tag-input label="Trefwoorden" hint="Enter of een komma maakt een trefwoord"></lintje-tag-input>',
          setup(stage) {
            stage.querySelector('lintje-tag-input').value = ['toegang', 'vergaderzaal']
          },
        },
        {
          label: 'Uitgeschakeld',
          html: '<lintje-tag-input label="Trefwoorden" disabled></lintje-tag-input>',
          setup(stage) {
            stage.querySelector('lintje-tag-input').value = ['toegang', 'vergaderzaal']
          },
        },
        {
          label: 'Fout',
          html: '<lintje-tag-input label="Trefwoorden" error="Hoogstens 10 trefwoorden"></lintje-tag-input>',
          setup(stage) {
            stage.querySelector('lintje-tag-input').value = ['toegang', 'vergaderzaal']
          },
        },
        {
          label: 'Met suggesties',
          html: '<lintje-tag-input label="Locaties" hint="Kies een locatie of typ een nieuwe"></lintje-tag-input>',
          setup(stage) {
            const field = stage.querySelector('lintje-tag-input')
            field.options = LOCATIES
            field.value = ['vh1']
          },
        },
      ],
    },
    {
      tag: 'lintje-checkbox',
      title: 'Een keuze aan of uit; de waarde is checked, niet value',
      specimens: [
        {
          label: 'Aangevinkt',
          html: '<lintje-checkbox name="p.alleen-open" label="Alleen open loketten" checked></lintje-checkbox>',
        },
        {
          label: 'Deels geselecteerd',
          html: '<lintje-checkbox name="p.deels" label="Deels geselecteerd" indeterminate hint="indeterminate toont een streepje in plaats van een vinkje."></lintje-checkbox>',
        },
        {
          label: 'Afwijkend van standaard',
          html: '<lintje-checkbox name="p.afwijkend" label="Afwijkend van standaard" modified></lintje-checkbox>',
        },
        {
          label: 'Uitgeschakeld',
          html: '<lintje-checkbox name="p.uit" label="Uitgeschakeld" checked disabled></lintje-checkbox>',
        },
      ],
    },
    {
      tag: 'lintje-radio-group',
      title: 'Eén keuze uit een rij opties onder elkaar',
      specimens: [
        {
          label: 'Rust',
          html: '<lintje-radio-group name="p.weergave" label="Weergave"></lintje-radio-group>',
          setup: (stage) => view(stage, 'dag'),
        },
        {
          label: 'Afwijkend van standaard',
          html: '<lintje-radio-group name="p.weergave-afwijkend" label="Afwijkend van standaard" modified></lintje-radio-group>',
          setup: (stage) => view(stage, 'week'),
        },
        {
          label: 'Uitgeschakeld',
          html: '<lintje-radio-group name="p.weergave-uit" label="Uitgeschakeld" disabled></lintje-radio-group>',
          setup: (stage) => view(stage, 'dag'),
        },
        {
          label: 'Als kaarten, met een regel onder elke optie (variant="cards")',
          wide: true,
          html: '<lintje-radio-group name="p.formaat" label="Formaat" variant="cards"></lintje-radio-group>',
          setup(stage) {
            const group = stage.querySelector('lintje-radio-group')
            group.options = [
              { value: 'docx', label: 'Word-document (.docx)', description: 'Om verder te bewerken' },
              { value: 'pdf', label: 'PDF (.pdf)', description: 'Om te delen of te bewaren' },
              { value: 'txt', label: 'Platte tekst (.txt)', description: 'Zonder opmaak' },
            ]
            group.value = 'docx'
            group.addEventListener('lintje-change', (event) => (group.value = event.detail))
          },
        },
      ],
    },
    {
      tag: 'lintje-toggle',
      title: 'Een schakelaar voor een keuze die meteen werkt, nooit in een formulier',
      specimens: [
        {
          label: 'Aan',
          html: '<lintje-toggle name="p.live" label="Live bijwerken" checked></lintje-toggle>',
        },
        {
          label: 'Uit',
          html: '<lintje-toggle name="p.hatching" label="Onvolledige periodes arceren"></lintje-toggle>',
        },
        {
          label: 'Als instellingsrij',
          html: '<lintje-toggle layout="row" label="Zachte spraak versterken" hint="Voor iemand die zacht of ver van de microfoon praat." checked></lintje-toggle>',
        },
        {
          label: 'Afwijkend van standaard',
          html: '<lintje-toggle name="p.toggle-afwijkend" label="Afwijkend van standaard" checked modified></lintje-toggle>',
        },
        {
          label: 'Afwijkend, met terugzetten (reset-label)',
          html: '<lintje-toggle label="Zachte spraak versterken" checked modified reset-label="Terugzetten naar uit"></lintje-toggle>',
          setup(stage) {
            const toggle = stage.querySelector('lintje-toggle')
            toggle.addEventListener('lintje-reset', () => Object.assign(toggle, { checked: false, modified: false }))
          },
        },
        {
          label: 'Uitgeschakeld',
          html: '<lintje-toggle name="p.toggle-uit" label="Uitgeschakeld" disabled></lintje-toggle>',
        },
      ],
    },
    {
      tag: 'lintje-segmented',
      title: 'Eén keuze uit een paar korte opties op een rij',
      specimens: [
        {
          label: 'Rust, met wat de host hoort',
          html: '<lintje-segmented name="p.soort" label="Soort loket"></lintje-segmented>',
          setup(stage) {
            setOptions('lintje-segmented', KINDS, 'alle')(stage)
            hearValues(stage, 'lintje-segmented')
          },
        },
        {
          label: 'Met uitleg bij de keuze',
          html: '<lintje-segmented label="Soort gesprek"></lintje-segmented>',
          setup(stage) {
            const element = stage.querySelector('lintje-segmented')
            element.options = [
              { value: 'vergadering', label: 'Vergadering', description: 'Sprekers herkennen · momenten Actiepunt en Besluit · samenvatting met actiepunten.' },
              { value: 'hoorzitting', label: 'Hoorzitting', description: 'Twee sprekers · letterlijk transcript, geen samenvatting.' },
              { value: 'dictaat', label: 'Dictaat', description: 'Eén spreker · leestekens uitspreken.' },
            ]
            element.value = 'vergadering'
          },
        },
        {
          label: 'Te smal voor de rij: de opties onder elkaar',
          html: '<div style="max-width: 240px"><lintje-segmented label="Soort gesprek"></lintje-segmented></div>',
          setup(stage) {
            const element = stage.querySelector('lintje-segmented')
            element.options = ['Vergadering', 'Hoorzitting', 'Briefing', 'Interview', 'Dictaat'].map((label) => ({ value: label.toLowerCase(), label }))
            element.value = 'hoorzitting'
          },
        },
        {
          label: 'Afwijkend van standaard, vet',
          html: '<lintje-segmented label="Soort loket" modified bold></lintje-segmented>',
          setup: setOptions('lintje-segmented', KINDS, 'service'),
        },
        {
          label: 'Fout',
          html: '<lintje-segmented label="Soort loket" error="Kies een soort loket."></lintje-segmented>',
          setup: setOptions('lintje-segmented', KINDS),
        },
        {
          label: 'Uitgeschakeld',
          html: '<lintje-segmented label="Soort loket" disabled></lintje-segmented>',
          setup: setOptions('lintje-segmented', KINDS, 'alle'),
        },
      ],
    },
    {
      tag: 'lintje-range',
      title: 'Een bereik met twee handvatten, of één handvat met single',
      specimens: [
        {
          label: 'Twee handvatten, met wat de host hoort',
          html: '<lintje-range name="p.openingstijd" label="Openingstijd" from="1" to="4"></lintje-range>',
          setup(stage) {
            setSteps('lintje-range', HOURS)(stage)
            hearValues(stage, 'lintje-range')
          },
        },
        {
          label: 'Eén handvat met eenheid',
          html: '<lintje-range label="Norm wachttijd" single value="15" unit="min"></lintje-range>',
          setup: setSteps('lintje-range', NORMS),
        },
        {
          label: 'Afwijkend van standaard',
          html: '<lintje-range label="Openingstijd" from="2" to="3" modified></lintje-range>',
          setup: setSteps('lintje-range', HOURS),
        },
        {
          label: 'Fout',
          html: '<lintje-range label="Openingstijd" from="1" to="4" error="Kies een korter bereik."></lintje-range>',
          setup: setSteps('lintje-range', HOURS),
        },
        {
          label: 'Uitgeschakeld',
          html: '<lintje-range label="Openingstijd" from="1" to="4" disabled></lintje-range>',
          setup: setSteps('lintje-range', HOURS),
        },
      ],
    },
{
      tag: 'lintje-date-input',
      title: 'Eén datum, getypt of gekozen in de kalender',
      specimens: [
        {
          label: 'Rust',
          html: '<lintje-date-input label="Datum" value="2026-10-03"></lintje-date-input>',
        },
        {
          label: 'Uitgeschakeld',
          html: '<lintje-date-input label="Datum" value="2026-10-03" disabled></lintje-date-input>',
        },
        {
          label: 'Fout',
          html: '<lintje-date-input label="Datum" value="2026-10-03"></lintje-date-input>',
          async setup(stage) {
            const element = stage.querySelector('lintje-date-input')
            await element.updateComplete
            const field = element.shadowRoot.querySelector('input')
            field.value = '31-02-2026'
            field.dispatchEvent(new Event('change'))
          },
        },
        {
          label: 'Kalender open (klik op de kalenderknop)',
          html: '<lintje-date-input label="Datum van de melding" value="2026-10-03" today="2026-10-04"></lintje-date-input>',
          setup: (stage) => logChanges(stage, 'lintje-date-input'),
        },
        {
          label: 'Typen (3-10-26, 3.10.2026), alleen in oktober',
          html: '<lintje-date-input label="Datum" min="2026-10-01" max="2026-10-31" hint="dd-mm-jjjj, in oktober 2026"></lintje-date-input>',
          setup: (stage) => logChanges(stage, 'lintje-date-input'),
        },
        {
          label: 'Telefoon (stacked)',
          html: '<lintje-date-input label="Datum" value="2026-10-03" stacked></lintje-date-input>',
        },
      ],
    },
    {
      tag: 'lintje-time-input',
      title: 'Een tijdstip, getypt of gekozen uit de lijst, los of naast een datum',
      specimens: [
        {
          label: 'Rust',
          html: '<lintje-time-input label="Tijdstip" value="14:35"></lintje-time-input>',
        },
        {
          label: 'Uitgeschakeld',
          html: '<lintje-time-input label="Tijdstip" placeholder="uu:mm" disabled></lintje-time-input>',
        },
        {
          label: 'Fout',
          html: '<lintje-time-input label="Tijdstip" value="23:50" error="Dit tijdstip ligt in de toekomst"></lintje-time-input>',
        },
        {
          label: 'Gewijzigd',
          html: '<lintje-time-input label="Tijdstip" value="14:35" modified></lintje-time-input>',
        },
        {
          label: 'Typen (1435, 14.35, 9) en pijltjes',
          html: '<lintje-time-input label="Aanvang" min="08:00" max="18:00"></lintje-time-input>',
          setup: (stage) => logChanges(stage, 'lintje-time-input'),
        },
        {
          label: 'Kiezen uit de lijst: van min tot max, per step minuten',
          html: '<lintje-time-input label="Aanvang" min="08:00" max="18:00" step="30" value="09:30"></lintje-time-input>',
          setup: (stage) => logChanges(stage, 'lintje-time-input'),
        },
        {
          label: 'Naast een datum',
          html: `<lintje-grid>
              <lintje-date-input span="7" label="Datum" value="2026-10-03"></lintje-date-input>
              <lintje-time-input span="5" label="Tijdstip" value="14:35"></lintje-time-input>
            </lintje-grid>`,
        },
      ],
    },
    {
      tag: 'lintje-date-range',
      title: 'Een periode kiezen met de kalender en zes vaste keuzes',
      specimens: [
        {
          label: 'Rust, met wat de host hoort',
          html: '<lintje-date-range name="p.periode" label="Periode"></lintje-date-range>',
          setup(stage) {
            setRange(stage)
            hearValues(stage, 'lintje-date-range')
          },
        },
        {
          label: 'Afwijkend van standaard',
          html: '<lintje-date-range label="Periode" modified></lintje-date-range>',
          setup: setRange,
        },
        {
          label: 'Fout',
          html: '<lintje-date-range label="Periode" error="Kies een periode die in het verleden ligt."></lintje-date-range>',
          setup: setRange,
        },
        {
          label: 'Uitgeschakeld',
          html: '<lintje-date-range label="Periode" disabled></lintje-date-range>',
          setup: setRange,
        },
      ],
    },
    {
      tag: 'lintje-slot-picker',
      title: 'Een tijd voor een afspraak: de dagen naast elkaar, elke tijd een optie',
      specimens: [
        {
          label: 'Rust: een tijd gekozen, een volle tijd, een dag zonder tijden',
          html: '<lintje-slot-picker name="afspraak" label="Kies een tijd" hint="Een gesprek duurt een half uur."></lintje-slot-picker>',
          setup(stage) {
            setDays(stage, '2026-10-12T09:30')
            hearValues(stage, 'lintje-slot-picker')
          },
        },
        {
          label: 'Fout',
          html: '<lintje-slot-picker label="Kies een tijd" required error="Kies een tijd."></lintje-slot-picker>',
          setup: (stage) => setDays(stage),
        },
        {
          label: 'Uitgeschakeld',
          html: '<lintje-slot-picker label="Kies een tijd" disabled></lintje-slot-picker>',
          setup: (stage) => setDays(stage, '2026-10-12T09:00'),
        },
        {
          label: 'Afwijkend van standaard, met terugzetten',
          html: '<lintje-slot-picker label="Kies een tijd" modified reset-label="Terugzetten naar maandag 09:00"></lintje-slot-picker>',
          setup(stage) {
            setDays(stage, '2026-10-13T10:00')
            const picker = stage.querySelector('lintje-slot-picker')
            picker.addEventListener('lintje-reset', () => {
              picker.value = '2026-10-12T09:00'
              picker.modified = false
            })
          },
        },
        {
          label: 'Zonder dagen',
          html: '<lintje-slot-picker label="Kies een tijd" hint="Er zijn deze week geen tijden meer."></lintje-slot-picker>',
          setup: (stage) => (stage.querySelector('lintje-slot-picker').days = []),
        },
      ],
    },
    {
      tag: 'lintje-file-upload',
      title: 'Bestanden kiezen of slepen, met de voortgang per bestand',
      specimens: [
        {
          label: 'Rust',
          html: '<lintje-file-upload accept=".pdf,.jpg,.png" max-size="10485760"></lintje-file-upload>',
          setup(stage) {
            fakeUploads(stage.querySelector('lintje-file-upload'))
          },
        },
        {
          label: 'Vult de hoogte, naast een hoger blok',
          html: '<lintje-file-upload accept=".mp3,.m4a,.wav" max-size="524288000" fill></lintje-file-upload>',
        },
        {
          label: 'Uitgeschakeld',
          html: '<lintje-file-upload accept=".pdf,.jpg,.png" max-size="10485760" disabled></lintje-file-upload>',
        },
        {
          label: 'Fout',
          html: '<lintje-file-upload accept=".pdf,.jpg,.png" max-size="10485760" error="Voeg minstens één bestand toe"></lintje-file-upload>',
        },
        {
          label: 'Bezig, klaar, geweigerd',
          wide: true,
          html: '<lintje-file-upload label="Bijlagen" accept=".pdf,.jpg,.png" max-size="10485760"></lintje-file-upload>',
          setup(stage) {
            const upload = stage.querySelector('lintje-file-upload')
            upload.files = [
              { id: 'v', name: 'verklaring.pdf', size: 482113, state: 'busy', progress: 45 },
              { id: 'f', name: 'foto.jpg', size: 2.4 * MB, state: 'done' },
              {
                id: 'b',
                name: 'beeld.mov',
                size: 38 * MB,
                state: 'error',
                message: 'Dit bestandstype kan niet',
              },
            ]
            const drop = (event) =>
              (upload.files = upload.files.filter((row) => row.id !== event.detail.id))
            upload.addEventListener('lintje-file-remove', drop)
            upload.addEventListener('lintje-file-cancel', drop)
          },
        },
      ],
    },
    {
      tag: 'lintje-text-editor',
      title: 'Opgemaakte tekst: vet, cursief, kop, opsomming en link',
      specimens: [
        {
          label: 'Rust, de waarde is markdown',
          wide: true,
          html: '<lintje-text-editor label="Toelichting"></lintje-text-editor>',
          setup(stage) {
            stage.querySelector('lintje-text-editor').value = NOTE
            logChanges(stage, 'lintje-text-editor')
          },
        },
        {
          label: 'Uitgeschakeld',
          html: '<lintje-text-editor label="Toelichting" disabled></lintje-text-editor>',
          setup: (stage) => (stage.querySelector('lintje-text-editor').value = NOTE),
        },
        {
          label: 'Fout',
          html: '<lintje-text-editor label="Toelichting" error="Vul een toelichting in"></lintje-text-editor>',
        },
      ],
    },
  ],
}
