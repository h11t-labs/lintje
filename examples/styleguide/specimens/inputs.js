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

const INSTRUCTION = [
  'Een aanvraag komt binnen via het portaal of per post. Een aanvraag per post scant de postkamer dezelfde dag.',
  'Controleer eerst of de aanvraag compleet is. Ontbreekt er een stuk, vraag het dan op met de standaardbrief.',
  'Lukt het opvragen bij het bronregister niet, dan komt de aanvraag in de wachtrij voor handmatige controle.',
  'Een besluit op de aanvraag neem je binnen acht weken. Een ingetrokken aanvraag telt niet mee.',
]

/** The host's half of finding: count the hits, mark them, follow `lintje-find-step`. */
function findInText(stage) {
  const find = stage.querySelector('lintje-find')
  const text = stage.querySelector('.sg-find-text')
  const escape = (value) => value.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)
  const literal = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // A new term draws the text again; a step only moves `current`, so the page keeps its place.
  const draw = () => {
    const term = find.value.trim().toLowerCase()
    text.innerHTML = INSTRUCTION.map((line) => {
      if (!term) return `<p>${escape(line)}</p>`
      const parts = line.split(new RegExp(`(${literal(term)})`, 'i'))
      return `<p>${parts
        .map((part, i) =>
          i % 2 ? `<lintje-highlight kind="match">${escape(part)}</lintje-highlight>` : escape(part),
        )
        .join('')}</p>`
    }).join('')
    find.total = term ? text.querySelectorAll('lintje-highlight').length : null
    find.current = find.total ? 1 : 0
    mark()
  }
  const mark = () => {
    const hits = text.querySelectorAll('lintje-highlight')
    hits.forEach((hit, i) => hit.toggleAttribute('current', i + 1 === find.current))
    // The text scrolls in its own box: moving the page would move the field from under the pointer.
    const hit = hits[find.current - 1]
    if (!hit) return
    const box = text.getBoundingClientRect()
    const at = hit.getBoundingClientRect()
    if (at.top < box.top || at.bottom > box.bottom) text.scrollTop += at.top - box.top - box.height / 3
  }
  find.addEventListener('lintje-change', draw)
  find.addEventListener('lintje-find-step', (event) => {
    const total = find.total ?? 0
    find.current = ((find.current - 1 + event.detail + total) % total) + 1
    mark()
  })
  draw()
}

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

const BIJLAGEN = [
  { value: 'id', label: 'Kopie van een identiteitsbewijs', description: 'Paspoort of identiteitskaart' },
  { value: 'loon', label: 'Loonstrook', description: 'Van de laatste maand' },
  { value: 'huur', label: 'Huurcontract' },
]

/** Gives the stage's checkbox group the attachment options and a first selection. */
function bijlagen(stage, selected) {
  const group = stage.querySelector('lintje-checkbox-group')
  group.options = BIJLAGEN
  group.selected = selected
}

const CHANNELS = [
  { value: 'gemeente', label: 'Via de gemeente' },
  { value: 'website', label: 'Op rijksoverheid.nl' },
  { value: 'brief', label: 'Per brief' },
  { value: 'bekende', label: 'Van een bekende' },
]

/** Gives the stage's choice group the channels with "Anders", a choice and a text of its own. */
function channels(stage, chosen, text = '') {
  const group = stage.querySelector('lintje-radio-group, lintje-checkbox-group')
  group.options = CHANNELS
  group.otherText = text
  if (group.localName === 'lintje-radio-group') group.value = chosen
  else group.selected = chosen ? [chosen] : []
}

/** Writes the stage's choice and its "Anders" text into a log line under it. */
function logOther(stage) {
  const say = log(stage, 'Nog niets verstuurd.')
  const group = stage.querySelector('lintje-radio-group, lintje-checkbox-group')
  for (const name of ['lintje-change', 'lintje-other-change']) {
    group.addEventListener(name, ({ detail }) => say(`${name}: ${JSON.stringify(detail)}`))
  }
}

const OTHER_FORM = `<lintje-form>
  <lintje-radio-group name="kanaal" label="Hoe hoorde u van de regeling?" other other-placeholder="Bijvoorbeeld: op een informatieavond"></lintje-radio-group>
  <lintje-form-actions>
    <lintje-button variant="primary" type="submit">Versturen</lintje-button>
  </lintje-form-actions>
</lintje-form>`

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
          label: 'Gestapeld',
          note: 'Zo staat een filter in het filterblad: over de volle breedte, op aanraakhoogte.',
          html: '<lintje-field label="Regio" stacked><lintje-select label="Regio" hide-label stacked></lintje-select></lintje-field>',
          setup: setOptions('lintje-select', REGIONS, 'alle'),
        },
      ],
    },
{
      tag: 'lintje-text-input',
      title: 'Zoeken, wachtwoord, e-mail, een vaste toevoeging en vastleggen per toetsaanslag',
      specimens: [
        {
          label: 'Zoeken terwijl je typt',
          note: 'Met `commit="input"` hoort de host elke toets. De hint telt de resultaten.',
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
          label: 'Onvolledig e-mailadres',
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
          label: 'Afwijkend met terugzetten',
          note: 'Met `reset-label` staat er een link onder het veld die `lintje-reset` stuurt. Een schermlezer hoort het label van het veld erachter.',
          html: '<lintje-text-input label="Naam" value="Overleg team" hint="Mag leeg blijven" modified reset-label="Leegmaken"></lintje-text-input>',
          setup(stage) {
            const field = stage.querySelector('lintje-text-input')
            field.addEventListener('lintje-reset', () => Object.assign(field, { value: '', modified: false }))
          },
        },
        {
          label: 'Ongeldige tekens',
          html: '<lintje-text-input name="p.zoek-fout" label="Met foutmelding" value="!!" error="Gebruik alleen letters en cijfers."></lintje-text-input>',
        },
        {
          label: 'Uitgeschakeld met waarde',
          note: 'Het veld heeft een `name` en een waarde die niet te wijzigen is.',
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
        {
          label: 'Met prefix',
          note: 'Een vaste tekst die de lezer nooit typt staat in een eigen vak; hij hoort niet bij de waarde.',
          html: '<lintje-text-input name="p.bedrag" label="Bedrag" prefix="€" value="1250"></lintje-text-input>',
        },
        {
          label: 'Met suffix',
          html: '<lintje-text-input name="p.adres" label="E-mailadres" suffix="@rijksoverheid.nl" value="j.devries"></lintje-text-input>',
        },
        {
          label: 'Met prefix en suffix',
          html: '<lintje-text-input name="p.website" label="Website" prefix="www." suffix=".nl" value="rijksoverheid" clearable></lintje-text-input>',
        },
        {
          label: 'Met knop',
          note: 'De knop legt eerst vast wat getypt is, zoals Enter, en stuurt dan `lintje-action`.',
          html: '<lintje-text-input name="p.kenteken" label="Kenteken" action="Zoek" value="AB-12-CD"></lintje-text-input>',
          setup(stage) {
            const say = log(stage)
            stage.querySelector('lintje-text-input').addEventListener('lintje-action', (event) => {
              say(`lintje-action ${JSON.stringify(event.detail)}`)
            })
          },
        },
        {
          label: 'Zoekveld met knop',
          html: '<lintje-text-input type="search" label="Zoek in de regelingen" action="Zoek" value="subsidie"></lintje-text-input>',
        },
        {
          label: 'Toevoeging met fout',
          html: '<lintje-text-input name="p.dossiernummer" label="Dossiernummer" prefix="DOS-" value="12a" error="Gebruik alleen cijfers." action="Controleer"></lintje-text-input>',
        },
        {
          label: 'Toevoeging alleen-lezen',
          html: '<lintje-text-input name="p.dossier-vast" label="Dossiernummer" prefix="DOS-" value="2026-0412" readonly action="Controleer"></lintje-text-input>',
        },
        {
          label: 'Toevoeging uitgeschakeld',
          html: '<lintje-text-input name="p.bedrag-uit" label="Bedrag" prefix="€" suffix="per maand" value="85" disabled action="Controleer"></lintje-text-input>',
        },
        {
          label: 'Toevoeging afwijkend van standaard',
          html: '<lintje-text-input name="p.domein" label="Domein" prefix="www." suffix=".nl" value="overheid" modified></lintje-text-input>',
        },
      ],
    },
    {
      tag: 'lintje-find',
      title: 'Een woord vinden in wat al op het scherm staat',
      specimens: [
        {
          label: 'Leeg',
          html: '<lintje-find label="Zoeken in de werkinstructie"></lintje-find>',
        },
        {
          label: 'Met treffers',
          note: 'De host telt en zegt welke de huidige is. De teller en de knoppen staan in het vak.',
          html: '<lintje-find value="aanvraag" total="7" current="2"></lintje-find>',
        },
        {
          label: 'Geen treffers',
          html: '<lintje-find value="certificaat" total="0"></lintje-find>',
        },
        {
          label: 'Zoekt nog',
          note: 'Telt de host in een grote inhoud, dan zet hij `busy` tot hij het aantal weet.',
          html: '<lintje-find value="aanvraag" busy></lintje-find>',
        },
        {
          label: 'Veel treffers',
          note: 'Het veld wordt korter, het vak niet breder.',
          html: '<lintje-find value="aanvraag" total="1248" current="128"></lintje-find>',
        },
        {
          label: 'Uitgeschakeld',
          html: '<lintje-find value="aanvraag" total="7" current="2" disabled></lintje-find>',
        },
        {
          label: 'Zoeken in een tekst',
          note: 'Enter is volgende, Shift+Enter vorige, Escape wist. Na de laatste treffer volgt de eerste.',
          html:
            '<lintje-find label="Zoeken in de werkinstructie" value="aanvraag"></lintje-find>' +
            '<div class="sg-find-text" tabindex="0" role="region" aria-label="Werkinstructie" style="margin-top: var(--space-4); max-width: 70ch; max-height: calc(4 * var(--space-10)); overflow: auto"></div>',
          setup: findInText,
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
          label: 'Afwijkend van standaard',
          html: '<lintje-textarea label="Omschrijving" modified value="Tas zonder eigenaar, omgeving afgezet."></lintje-textarea>',
        },
        {
          label: 'Toelichting en teller',
          note: 'De toelichting links, de teller rechts op dezelfde regel; past dat niet, dan valt de teller eronder.',
          html: '<lintje-textarea label="Omschrijving" hint="Wat er is gebeurd, in een paar zinnen." maxlength="2000" value="Tas zonder eigenaar bij de balie."></lintje-textarea>',
        },
        {
          label: 'Afwijkend met terugzetten',
          note: 'De link staat na de teller.',
          html: '<lintje-textarea label="Omschrijving" maxlength="2000" modified reset-label="Terugzetten naar leeg" value="Tas zonder eigenaar, omgeving afgezet."></lintje-textarea>',
          setup(stage) {
            const field = stage.querySelector('lintje-textarea')
            field.addEventListener('lintje-reset', () => Object.assign(field, { value: '', modified: false }))
          },
        },
        {
          label: 'Over de limiet',
          note: 'De teller zegt hoeveel tekens de tekst korter moet.',
          html: '<lintje-textarea label="Omschrijving" maxlength="40" value="Een tekst die langer is dan de limiet toelaat."></lintje-textarea>',
        },
        {
          label: 'Zonder kader',
          note: 'Voor een vlak dat de tekst al omlijst: `variant="plain"`, met acht regels.',
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
          label: 'Rust',
          note: 'Eronder staat wat de host hoort.',
          html: '<lintje-number-input name="p.drempel" label="Drempel" value="5" min="0" max="20" hint="Stapjes van 1, tussen 0 en 20."></lintje-number-input>',
          setup: (stage) => hearValues(stage, 'lintje-number-input'),
        },
        {
          label: 'Afwijkend op de ondergrens',
          html: '<lintje-number-input name="p.drempel-min" label="Op de ondergrens" value="0" min="0" max="20" modified></lintje-number-input>',
        },
        {
          label: 'Eenheid zonder stapknoppen',
          note: 'De stapknoppen gaan alleen uit als property: `stepper = false`.',
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
        {
          label: 'Prefix zonder stapknoppen',
          html: '<lintje-number-input name="p.tarief" label="Tarief" value="85" prefix="€"></lintje-number-input>',
          setup: (stage) => (stage.querySelector('lintje-number-input').stepper = false),
        },
        {
          label: 'Prefix en eenheid',
          html: '<lintje-number-input name="p.uurtarief" label="Uurtarief" value="85" prefix="€" unit="per uur"></lintje-number-input>',
          setup: (stage) => (stage.querySelector('lintje-number-input').stepper = false),
        },
      ],
    },
    {
      tag: 'lintje-select',
      title: 'Eén waarde kiezen uit een lijst',
      specimens: [
        {
          label: 'Rust',
          note: 'Eronder staat wat de host hoort.',
          html: '<lintje-select name="p.regio" label="Regio"></lintje-select>',
          setup(stage) {
            setOptions('lintje-select', REGIONS, 'alle')(stage)
            hearValues(stage, 'lintje-select')
          },
        },
        {
          label: 'Afwijkend en vet',
          note: 'Met `bold` staat een waarde die van de standaard afwijkt vet.',
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
          label: 'Bezig met zoeken',
          note: 'Met `remote` zoekt de host zelf, hier na 600 ms. Typ om de laadregel te zien.',
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
          label: 'Afwijkend van standaard',
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
          label: 'Keuzes als chips',
          html: '<lintje-multiselect label="Bron van de aanvraag" hint="Een bron met een omschrijving krijgt een tweede regel."></lintje-multiselect>',
          setup: setSelected(SOURCES, ['balie', 'online']),
        },
        {
          label: 'Keuzes als samenvatting',
          note:
            'Met `summary` staat er één regel in plaats van de chips, voor waar ze niet passen.',
          html: '<lintje-multiselect label="Bron van de aanvraag" summary="Bronnen: 2 van 4"></lintje-multiselect>',
          setup: setSelected(SOURCES, ['balie', 'online']),
        },
        {
          label: 'Een lange keuze',
          note:
            'Met een aanwijzer staat de hele keuze in de tooltip van het veld. Onder de focus van ' +
            'het toetsenbord, zonder hover en op een telefoon loopt de chip door.',
          html: '<div style="max-width: 320px"><lintje-multiselect label="Loket"></lintje-multiselect></div>',
          setup: setSelected(
            [
              { value: 'oost', label: 'Servicepunt in het gemeentehuis van de oostelijke wijken' },
              { value: 'west', label: 'Servicepunt west' },
            ],
            ['oost'],
          ),
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
      tag: 'lintje-checkbox-group',
      title: 'Meer keuzes onder één label, met één hint en één foutregel',
      specimens: [
        {
          label: 'Rust',
          note: 'Een toelichting staat onder haar optie, ingesprongen tot de labeltekst. Eronder staat wat de host hoort.',
          html: '<lintje-checkbox-group name="bijlagen" label="Welke bijlagen stuurt u mee?" hint="Kies alles wat van toepassing is."></lintje-checkbox-group>',
          setup(stage) {
            bijlagen(stage, ['loon'])
            logChanges(stage, 'lintje-checkbox-group')
          },
        },
        {
          label: 'Fout',
          html: '<lintje-checkbox-group name="bijlagen-fout" label="Welke bijlagen stuurt u mee?" required error="Kies minstens één bijlage."></lintje-checkbox-group>',
          setup: (stage) => bijlagen(stage, []),
        },
        {
          label: 'Afwijkend van standaard',
          html: '<lintje-checkbox-group name="bijlagen-afwijkend" label="Afwijkend van standaard" modified></lintje-checkbox-group>',
          setup: (stage) => bijlagen(stage, ['id', 'huur']),
        },
        {
          label: 'Uitgeschakeld',
          html: '<lintje-checkbox-group name="bijlagen-uit" label="Uitgeschakeld" disabled></lintje-checkbox-group>',
          setup: (stage) => bijlagen(stage, ['id']),
        },
        {
          label: 'Anders niet gekozen',
          note: 'Met `other` is de laatste optie "Anders, namelijk". Vink haar aan: het veld verschijnt eronder, met de focus erin.',
          html: '<lintje-checkbox-group name="kanalen" label="Hoe hoorde u van de regeling?" hint="Kies alles wat van toepassing is." other other-placeholder="Bijvoorbeeld: op een informatieavond"></lintje-checkbox-group>',
          setup(stage) {
            channels(stage, 'website')
            logOther(stage)
          },
        },
        {
          label: 'Anders gekozen en leeg',
          html: '<lintje-checkbox-group name="kanalen-leeg" label="Hoe hoorde u van de regeling?" other other-placeholder="Bijvoorbeeld: op een informatieavond"></lintje-checkbox-group>',
          setup: (stage) => channels(stage, 'other'),
        },
        {
          label: 'Anders ingevuld',
          html: '<lintje-checkbox-group name="kanalen-ingevuld" label="Hoe hoorde u van de regeling?" other></lintje-checkbox-group>',
          setup: (stage) => channels(stage, 'other', 'Op een informatieavond'),
        },
        {
          label: 'Fout bij Anders',
          note: 'De host zet `other-error` als "Anders" gekozen is en het veld leeg, met `OTHER_MISSING_TEXT`.',
          html: '<lintje-checkbox-group name="kanalen-fout" label="Hoe hoorde u van de regeling?" other other-error="Vul in wat je bedoelt."></lintje-checkbox-group>',
          setup: (stage) => channels(stage, 'other'),
        },
        {
          label: 'Anders uitgeschakeld',
          html: '<lintje-checkbox-group name="kanalen-uit" label="Hoe hoorde u van de regeling?" other disabled></lintje-checkbox-group>',
          setup: (stage) => channels(stage, 'other', 'Op een informatieavond'),
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
          label: 'Met omschrijvingen',
          note: 'Een omschrijving staat onder het label van haar optie en hoort bij haar eigen radio.',
          html: '<lintje-radio-group name="levering" label="Hoe wilt u het besluit ontvangen?"></lintje-radio-group>',
          setup(stage) {
            const group = stage.querySelector('lintje-radio-group')
            group.options = [
              { value: 'post', label: 'Per post', description: 'Binnen vijf werkdagen in de brievenbus' },
              { value: 'online', label: 'In de berichtenbox', description: 'Op de dag van het besluit' },
              { value: 'beide', label: 'Allebei' },
            ]
            group.value = 'online'
          },
        },
        {
          label: 'Anders niet gekozen',
          note: 'Met `other` is de laatste optie "Anders, namelijk". Kies haar met een klik of spatie en de focus gaat in het veld; met een pijltoets blijft ze in de groep.',
          html: '<lintje-radio-group name="kanaal" label="Hoe hoorde u van de regeling?" other other-placeholder="Bijvoorbeeld: op een informatieavond"></lintje-radio-group>',
          setup(stage) {
            channels(stage, 'gemeente')
            logOther(stage)
          },
        },
        {
          label: 'Anders gekozen en leeg',
          html: '<lintje-radio-group name="kanaal-leeg" label="Hoe hoorde u van de regeling?" other other-placeholder="Bijvoorbeeld: op een informatieavond"></lintje-radio-group>',
          setup: (stage) => channels(stage, 'other'),
        },
        {
          label: 'Anders ingevuld',
          html: '<lintje-radio-group name="kanaal-ingevuld" label="Hoe hoorde u van de regeling?" other></lintje-radio-group>',
          setup: (stage) => channels(stage, 'other', 'Op een informatieavond'),
        },
        {
          label: 'Fout bij Anders',
          html: '<lintje-radio-group name="kanaal-fout" label="Hoe hoorde u van de regeling?" other other-error="Vul in wat je bedoelt."></lintje-radio-group>',
          setup: (stage) => channels(stage, 'other'),
        },
        {
          label: 'Anders uitgeschakeld',
          html: '<lintje-radio-group name="kanaal-uit" label="Hoe hoorde u van de regeling?" other disabled></lintje-radio-group>',
          setup: (stage) => channels(stage, 'other', 'Op een informatieavond'),
        },
        {
          label: 'In een formulier',
          note: "De host gaf `errors.fields['kanaal-other']` terug. De foutsamenvatting brengt de focus naar het veld van \"Anders\"; typen haalt de fout weg.",
          html: OTHER_FORM,
          setup(stage) {
            const form = stage.querySelector('lintje-form')
            stage.querySelector('lintje-radio-group').options = CHANNELS
            form.values = { kanaal: 'other', 'kanaal-other': '' }
            form.errors = { fields: { 'kanaal-other': 'Vul in wat je bedoelt.' } }
            form.addEventListener('lintje-submit', ({ detail }) => {
              const { kanaal, 'kanaal-other': text } = detail.values
              const fields = {}
              if (!kanaal) fields.kanaal = 'Kies een antwoord.'
              else if (kanaal === 'other' && !String(text ?? '').trim())
                fields['kanaal-other'] = 'Vul in wat je bedoelt.'
              if (Object.keys(fields).length) form.errors = { fields }
              else form.saved()
            })
          },
        },
        {
          label: 'Als kaarten',
          wide: true,
          note:
            'Met `variant="cards"` staat elke optie in een kaart, met een regel uitleg eronder.',
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
          note: 'Met `layout="row"` staan naam en hint links en de schakelaar rechts.',
          html: '<lintje-toggle layout="row" label="Zachte spraak versterken" hint="Voor iemand die zacht of ver van de microfoon praat." checked></lintje-toggle>',
        },
        {
          label: 'Afwijkend van standaard',
          html: '<lintje-toggle name="p.toggle-afwijkend" label="Afwijkend van standaard" checked modified></lintje-toggle>',
        },
        {
          label: 'Afwijkend met terugzetten',
          note: 'Met `reset-label` staat er een link onder het veld die `lintje-reset` stuurt.',
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
          label: 'Rust',
          note: 'Eronder staat wat de host hoort.',
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
          label: 'Met een aantal',
          note: 'Een optie met `count` toont dat getal als tellerbadge achter het label.',
          html: '<lintje-segmented label="Toon" hide-label></lintje-segmented>',
          setup(stage) {
            const element = stage.querySelector('lintje-segmented')
            element.options = [
              { value: '', label: 'Alles', count: 12 },
              { value: 'open', label: 'Open', count: 9 },
              { value: 'gesloten', label: 'Gesloten', count: 3 },
            ]
            element.value = ''
          },
        },
        {
          label: 'Te smal voor een rij',
          note: 'Past de rij niet, dan staan de opties onder elkaar.',
          html: '<div style="max-width: 240px"><lintje-segmented label="Soort gesprek"></lintje-segmented></div>',
          setup(stage) {
            const element = stage.querySelector('lintje-segmented')
            element.options = ['Vergadering', 'Hoorzitting', 'Briefing', 'Interview', 'Dictaat'].map((label) => ({ value: label.toLowerCase(), label }))
            element.value = 'hoorzitting'
          },
        },
        {
          label: 'Afwijkend en vet',
          note: 'Met `bold` staat een waarde die van de standaard afwijkt vet.',
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
          label: 'Twee handvatten',
          note: 'Eronder staat wat de host hoort.',
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
          note: 'In het veld staat 31-02-2026, een dag die niet bestaat.',
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
          label: 'Kiezen in de kalender',
          note:
            'Klik op de kalenderknop om de kalender te openen. Eronder staat wat de host hoort.',
          html: '<lintje-date-input label="Datum van de melding" value="2026-10-03" today="2026-10-04"></lintje-date-input>',
          setup: (stage) => logChanges(stage, 'lintje-date-input'),
        },
        {
          label: 'Typen in oktober',
          note: 'Het veld leest ook 3-10-26 en 3.10.2026. Met `min` en `max` mag alleen oktober.',
          html: '<lintje-date-input label="Datum" min="2026-10-01" max="2026-10-31" hint="dd-mm-jjjj, in oktober 2026"></lintje-date-input>',
          setup: (stage) => logChanges(stage, 'lintje-date-input'),
        },
        {
          label: 'Op een telefoon',
          note: 'Met `stacked` krijgt het veld de volle breedte en de aanraakhoogte.',
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
          label: 'Afwijkend van standaard',
          html: '<lintje-time-input label="Tijdstip" value="14:35" modified></lintje-time-input>',
        },
        {
          label: 'Typen en pijltjes',
          note: 'Het veld leest ook 1435, 14.35 en 9. Pijl omhoog en omlaag verzetten de tijd.',
          html: '<lintje-time-input label="Aanvang" min="08:00" max="18:00"></lintje-time-input>',
          setup: (stage) => logChanges(stage, 'lintje-time-input'),
        },
        {
          label: 'Kiezen uit de lijst',
          note: 'De lijst loopt van `min` tot `max`, per `step` minuten: hier per half uur.',
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
          label: 'Rust',
          note: 'Eronder staat wat de host hoort.',
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
          label: 'Rust',
          note:
            'Eén tijd is gekozen, een andere is vol en woensdag heeft geen tijden. ' +
            'Eronder staat wat de host hoort.',
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
          label: 'Afwijkend met terugzetten',
          note: 'Met `reset-label` staat er een link onder het veld die `lintje-reset` stuurt.',
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
          note: 'Kies of sleep een bestand: de upload wordt nagespeeld en er gaat niets weg.',
          html: '<lintje-file-upload accept=".pdf,.jpg,.png" max-size="10485760"></lintje-file-upload>',
          setup(stage) {
            fakeUploads(stage.querySelector('lintje-file-upload'))
          },
        },
        {
          label: 'Vult de hoogte',
          note: 'Met `fill` neemt het vak de hoogte van een hoger blok ernaast.',
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
          label: 'Drie bestanden',
          note: 'Eén bestand is bezig, één is klaar en één is mislukt en kan opnieuw.',
          html: '<lintje-file-upload label="Bijlagen" accept=".pdf,.jpg,.png" max-size="10485760"></lintje-file-upload>',
          setup(stage) {
            const upload = stage.querySelector('lintje-file-upload')
            upload.files = [
              { id: 'v', name: 'verklaring.pdf', size: 482113, state: 'busy', progress: 45 },
              { id: 'f', name: 'foto.jpg', size: 2.4 * MB, state: 'done' },
              {
                id: 'b',
                name: 'verslag.pdf',
                size: 3.8 * MB,
                state: 'error',
                message: 'Uploaden mislukt',
                retry: true,
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
          label: 'Rust',
          note: 'De waarde is markdown. Eronder staat wat de host hoort.',
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
