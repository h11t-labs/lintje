// The forms category (Formulier): the specimens of its elements.
import { log } from '../shared.js'

const SAVED = { titel: 'Onbeheerde tas', omschrijving: 'Tas zonder eigenaar bij de balie.' }

const FIELDS = `
  <lintje-text-input name="titel" label="Titel"></lintje-text-input>
  <lintje-textarea name="omschrijving" label="Omschrijving"></lintje-textarea>`

const ACTIONS = `
  <lintje-form-actions>
    <lintje-button variant="tertiary">Annuleren</lintje-button>
    <lintje-button variant="primary" type="submit">Opslaan</lintje-button>
  </lintje-form-actions>`

const FORM = `<lintje-form>${FIELDS}${ACTIONS}</lintje-form>`

/** A host for the demo: 1,2 s busy, then an error for an empty title, else saved. */
function answer(form) {
  form.addEventListener('lintje-submit', ({ detail }) => {
    form.busy = true
    setTimeout(() => {
      form.busy = false
      if (String(detail.values.titel ?? '').trim() === '') {
        form.errors = { fields: { titel: 'Titel is verplicht' } }
      } else form.saved()
    }, 1200)
  })
}

const at = (hours, minutes) => {
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return date
}

const SECTION_FIELDS = `
  <lintje-grid>
    <lintje-text-input span="8" name="titel" label="Titel" value="Onbeheerde tas"></lintje-text-input>
    <lintje-text-input span="4" name="categorie" label="Categorie" optional value="Veiligheid"></lintje-text-input>
  </lintje-grid>`

const STEPS = [
  { label: 'Melding', href: '#stap-1', state: 'done' },
  { label: 'Opvolging', state: 'current' },
  { label: 'Controleren en versturen', state: 'next' },
]

const PHASES = [
  { label: 'Verkennen', state: 'done', meta: 'juli 2026' },
  {
    label: 'Ontwerpen',
    state: 'current',
    meta: 'aug – sept 2026',
    description: 'We schetsen de plannen en leggen ze voor, zodat we samen tot een besluit komen.',
  },
  { label: 'Uitvoeren', state: 'next', meta: 'okt – nov 2026' },
  { label: 'Afronden', state: 'next', meta: 'dec 2026' },
]

function steps(stage, list) {
  const element = stage.querySelector('lintje-stepper')
  element.steps = list
  element.addEventListener('lintje-navigate', (event) => {
    event.preventDefault()
    event.stopPropagation()
  })
}

const ROLES = [
  { value: 'melder', label: 'Melder' },
  { value: 'getuige', label: 'Getuige' },
  { value: 'eigenaar', label: 'Eigenaar' },
]

/** One row of the repeater, as a host writes it: the fields name the row they stand in. */
function personRow(index, person = { naam: '', rol: 'getuige' }) {
  const row = document.createElement('lintje-repeater-row')
  const name = document.createElement('lintje-text-input')
  name.label = `Naam van betrokkene ${index + 1}`
  name.hideLabel = true
  name.placeholder = 'Voorletters en achternaam'
  name.value = person.naam
  const role = document.createElement('lintje-select')
  role.label = `Rol van betrokkene ${index + 1}`
  role.hideLabel = true
  role.options = ROLES
  role.value = person.rol
  row.append(name, role)
  return row
}

/** A host for the repeater: it owns the list and answers the two requests. */
function repeaterHost(stage, people) {
  const repeater = stage.querySelector('lintje-repeater')
  const renumber = () =>
    [...repeater.children].forEach((row, index) => {
      const [name, role] = row.children
      name.label = `Naam van betrokkene ${index + 1}`
      role.label = `Rol van betrokkene ${index + 1}`
    })
  people.forEach((person, index) => repeater.append(personRow(index, person)))
  repeater.addEventListener('lintje-row-add', ({ detail }) => repeater.append(personRow(detail)))
  repeater.addEventListener('lintje-row-remove', ({ detail }) => {
    repeater.children[detail]?.remove()
    renumber()
  })
}

const PEOPLE = [
  { naam: 'J. de Vries', rol: 'melder' },
  { naam: '', rol: 'getuige' },
]

export default {
  elements: [
{
      tag: 'lintje-form',
      title: 'De houder van een formulier: concept, versturen, fouten van de server',
      specimens: [
        {
          label: 'Concept (typ iets; leeg de titel en sla op voor een fout)',
          wide: true,
          html: FORM,
          setup(stage) {
            const form = stage.querySelector('lintje-form')
            form.values = SAVED
            answer(form)
          },
        },
        {
          label: 'Bezig',
          html: FORM,
          setup(stage) {
            const form = stage.querySelector('lintje-form')
            form.values = SAVED
            form.busy = true
          },
        },
        {
          label: 'Fout van de server',
          html: FORM,
          setup(stage) {
            const form = stage.querySelector('lintje-form')
            form.values = SAVED
            answer(form)
            form.errors = {
              fields: { titel: 'Er is vandaag al een melding met deze titel' },
            }
          },
        },
        {
          label: 'Opgeslagen',
          html: FORM,
          setup(stage) {
            const form = stage.querySelector('lintje-form')
            form.values = { ...SAVED, titel: 'Onbeheerde tas, ontvangsthal' }
            answer(form)
            form.saved(at(10, 42))
          },
        },
      ],
    },
    {
      tag: 'lintje-form-section',
      title: 'Een groep velden met een kop en een toelichting',
      specimens: [
        {
          label: 'Rust',
          wide: true,
          html: `<lintje-form-section heading="Wat en waar" description="Beschrijf wat je zag. Namen van betrokkenen vul je in de volgende sectie in.">${SECTION_FIELDS}</lintje-form-section>`,
        },
        {
          label: 'Uitgeschakeld',
          html: `<lintje-form-section heading="Wat en waar" disabled>${SECTION_FIELDS}</lintje-form-section>`,
        },
        {
          label: 'Als tegel: de titel is de legend',
          html: `<lintje-form-section variant="tile" heading="Betrokkenen" description="Alleen wie je zelf hebt gesproken.">
            <lintje-text-input name="naam" label="Naam"></lintje-text-input>
          </lintje-form-section>`,
        },
      ],
    },
    {
      tag: 'lintje-stepper',
      title: 'De stappen van een formulier of de fasen van een proces',
      specimens: [
        {
          label: 'Komend, actief, gedaan',
          wide: true,
          html: '<lintje-stepper></lintje-stepper>',
          setup: (stage) => steps(stage, STEPS),
        },
        {
          label: 'Fout',
          html: '<lintje-stepper></lintje-stepper>',
          setup: (stage) =>
            steps(stage, [{ ...STEPS[0], errors: 2 }, STEPS[1], STEPS[2]]),
        },
        {
          label: 'Fasen met een periode',
          wide: true,
          html: '<lintje-stepper label="Fasen"></lintje-stepper>',
          setup: (stage) => steps(stage, PHASES),
        },
        {
          label: 'Verticaal, met omschrijving (ook op een telefoon)',
          wide: true,
          html: '<lintje-stepper label="Fasen" orientation="vertical"></lintje-stepper>',
          setup: (stage) => steps(stage, PHASES),
        },
      ],
    },
    {
      tag: 'lintje-repeater',
      title: 'Een herhaalbare veldgroep: rijen toevoegen en verwijderen',
      specimens: [
        {
          label: 'In gebruik',
          wide: true,
          html: '<lintje-repeater legend="Betrokkenen" item-label="Betrokkene" min="1" max="10"></lintje-repeater>',
          setup: (stage) => repeaterHost(stage, PEOPLE),
        },
        {
          label: 'Uitgeschakeld: één rij bij min, de knop bij max',
          html: `<lintje-repeater legend="Contactpersoon" item-label="Contactpersoon" min="1" max="1"></lintje-repeater>`,
          setup: (stage) => repeaterHost(stage, [{ naam: 'A. Jansen', rol: 'eigenaar' }]),
        },
      ],
    },
    {
      tag: 'lintje-repeater-row',
      title: 'Eén rij van een herhaalbare veldgroep, met een verwijderknop',
      specimens: [
        {
          label: 'Verwijderbaar, binnen een herhaler',
          wide: true,
          html: '<lintje-repeater legend="Betrokkenen" item-label="Betrokkene" min="0" max="10"></lintje-repeater>',
          setup(stage) {
            const repeater = stage.querySelector('lintje-repeater')
            repeater.append(personRow(0, { naam: 'J. de Vries', rol: 'melder' }))
            const say = log(stage)
            repeater.addEventListener('lintje-row-add', ({ detail }) => repeater.append(personRow(detail)))
            repeater.addEventListener('lintje-row-remove', ({ detail, target }) => {
              say(`lintje-row-remove ${JSON.stringify(detail)} van ${target.localName}`)
              target.remove()
            })
          },
        },
        {
          label: 'Eén rij bij min: verwijderen kan niet',
          wide: true,
          html: '<lintje-repeater legend="Contactpersoon" item-label="Contactpersoon" min="1" max="1"></lintje-repeater>',
          setup: (stage) =>
            stage.querySelector('lintje-repeater').append(personRow(0, { naam: 'A. Jansen', rol: 'eigenaar' })),
        },
      ],
    },
    {
      tag: 'lintje-error-summary',
      title: 'Het foutenoverzicht boven een formulier',
      specimens: [
        {
          label: 'Rust, hover, focus op een link',
          wide: true,
          html: '<lintje-error-summary></lintje-error-summary>',
          setup(stage) {
            stage.querySelector('lintje-error-summary').items = [
              {
                field: 'demo-titel',
                label: 'Titel',
                message: 'er is vandaag al een melding met deze titel',
              },
              { field: 'demo-omschrijving', message: 'Omschrijving is verplicht' },
            ]
          },
        },
        {
          label: 'Zonder veld',
          wide: true,
          html: '<lintje-error-summary message="De server gaf geen antwoord. Je invoer staat er nog." retry="Opnieuw proberen"></lintje-error-summary>',
        },
      ],
    },
    {
      tag: 'lintje-form-actions',
      title: 'De actiebalk: status links, knoppen rechts',
      specimens: [
        {
          label: 'Gewijzigd, met een tweede actie',
          wide: true,
          html: `<lintje-form-actions state="dirty">
            <lintje-button variant="tertiary">Annuleren</lintje-button>
            <lintje-button variant="secondary">Concept opslaan</lintje-button>
            <lintje-button variant="primary">Versturen</lintje-button>
          </lintje-form-actions>`,
        },
        {
          label: 'Bezig',
          html: `<lintje-form-actions state="busy">
            <lintje-button variant="tertiary">Annuleren</lintje-button>
            <lintje-button variant="primary">Versturen</lintje-button>
          </lintje-form-actions>`,
        },
        {
          label: 'Opgeslagen',
          html: `<lintje-form-actions state="draft" saved-at="10:42">
            <lintje-button variant="tertiary">Annuleren</lintje-button>
            <lintje-button variant="primary">Versturen</lintje-button>
          </lintje-form-actions>`,
        },
      ],
    },
  ],
}
