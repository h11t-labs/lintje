// The actions category (Knoppen en iconen): the specimens of its elements.
import * as lintje from '../../../dist-elements/lintje.js'

const ACTIONS = [
  { value: 'dupliceren', label: 'Dupliceren', icon: 'functioneel-kopieren' },
  { value: 'exporteren', label: 'Exporteren', icon: 'functioneel-downloaden' },
  {
    value: 'overdragen',
    label: 'Overdragen',
    icon: 'functioneel-refresh',
    disabled: true,
    reason: 'Alleen de eigenaar kan dit dossier overdragen',
  },
  'separator',
  { value: 'verwijderen', label: 'Verwijderen', icon: 'functioneel-verwijderen', danger: true },
]

const EXPORTS = [
  { value: 'csv', label: 'Tabel als CSV', icon: 'functioneel-downloaden', hint: '.csv' },
  { value: 'pdf', label: 'Verslag als PDF', icon: 'op-kantoor-document-blanco', hint: '.pdf' },
]

const FORMATS = [
  { value: 'docx', label: 'Word-document', hint: '.docx' },
  { value: 'pdf', label: 'PDF', hint: '.pdf' },
  { value: 'txt', label: 'Platte tekst', hint: '.txt' },
  {
    value: 'srt',
    label: 'Ondertiteling',
    hint: '.srt',
    disabled: true,
    reason: 'Dit transcript heeft geen tijdcodes',
  },
]

const BUSY = {
  docx: 'Het Word-document wordt gemaakt',
  pdf: 'De pdf wordt gemaakt',
  txt: 'Het tekstbestand wordt gemaakt',
}

function menu(stage, items, open = false) {
  const element = stage.querySelector('lintje-menu-button')
  element.items = items
  element.open = open
  element.addEventListener('lintje-action', (event) => event.stopPropagation())
}

const OPTIONS = [
  { value: 'ondertiteling', label: 'Ondertiteling', checked: true, hint: 'C' },
  'separator',
  { heading: 'Afspeelsnelheid' },
  { value: '1', label: '1×', checked: false, radio: true },
  { value: '1.5', label: '1,5×', checked: true, radio: true },
  { value: '2', label: '2×', checked: false, radio: true },
]

export default {
  elements: [
{
      tag: 'lintje-button',
      title: 'De knop, in zes varianten, drie maten en elke toestand',
      specimens: [
        {
          label: 'Vier varianten',
          note: 'Het attribuut `variant` kiest primair, secundair, tertiair of link.',
          html: `<div class="guide__row">
            <lintje-button variant="primary">Toepassen</lintje-button>
            <lintje-button variant="secondary">Annuleren</lintje-button>
            <lintje-button variant="tertiary">Meer</lintje-button>
            <lintje-button variant="link">Uitleg</lintje-button>
          </div>`,
        },
        {
          label: 'Onomkeerbare actie',
          note:
            'Wat niet terug te draaien is, krijgt `danger` (gevuld) of ' +
            '`danger-secondary` (omlijnd).',
          html: `<div class="guide__row">
            <lintje-button variant="danger">Verwijderen</lintje-button>
            <lintje-button variant="danger-secondary">Verwijderen</lintje-button>
          </div>`,
        },
        {
          label: 'Uitgeschakeld met een reden',
          note: 'De reden staat ernaast, en `reason` laat hem bij de knop voorlezen.',
          html: `<div class="guide__row">
            <span>Starten kan zodra Transcriptie je microfoon mag gebruiken.</span>
            <lintje-button variant="primary" icon="beeld-en-geluid-microfoon" disabled reason="Starten kan zodra Transcriptie je microfoon mag gebruiken.">Opname starten</lintje-button>
          </div>`,
        },
        {
          label: 'Met een icoon',
          note: 'Het icoon staat links met `icon` of rechts met `icon-right`.',
          html: `<div class="guide__row">
            <lintje-button variant="secondary" icon="functioneel-filters">Filters</lintje-button>
            <lintje-button variant="tertiary" icon-right="functioneel-delta-omlaag">Meer</lintje-button>
          </div>`,
        },
        {
          label: 'Drie maten',
          note: 'Gewoon is 48 px hoog, `compact` en `chrome` zijn 40 px.',
          html: `<div class="guide__row">
            <lintje-button variant="secondary">Gewoon</lintje-button>
            <lintje-button variant="secondary" size="compact">Compact</lintje-button>
            <lintje-button variant="secondary" size="chrome" icon="functioneel-delen">Delen</lintje-button>
          </div>`,
        },
        {
          label: 'Een lang label in een smalle ruimte',
          note:
            'Met een aanwijzer staat het label op één regel, met het hele label in de tooltip. ' +
            'Onder de focus van het toetsenbord, zonder hover en op een telefoon loopt het door.',
          html: `<div style="max-width: 240px">
            <lintje-button variant="secondary" icon="functioneel-downloaden">Alle aanvragen van deze week downloaden</lintje-button>
          </div>`,
        },
        {
          label: 'Uitgeschakeld',
          html: `<div class="guide__row">
            <lintje-button variant="primary" disabled>Niet beschikbaar</lintje-button>
            <lintje-button variant="secondary" disabled>Niet beschikbaar</lintje-button>
            <lintje-button variant="danger" disabled>Verwijderen</lintje-button>
          </div>`,
        },
        {
          label: 'Bezig',
          note:
            'De breedte blijft gelijk en het label wijkt voor de ring. “Wissel ' +
            'bezig” zet het aan en uit.',
          html: `<div class="guide__row">
            <lintje-button variant="primary" busy>Opslaan</lintje-button>
            <lintje-button variant="secondary" icon="functioneel-downloaden" busy>Downloaden</lintje-button>
            <lintje-button variant="danger" busy>Verwijderen</lintje-button>
            <lintje-button variant="link" data-toggle>Wissel bezig</lintje-button>
          </div>`,
          setup(stage) {
            const busy = [...stage.querySelectorAll('[busy]')]
            stage.querySelector('[data-toggle]').addEventListener('click', () => {
              for (const button of busy) button.busy = !button.busy
            })
          },
        },
      ],
    },
    {
      tag: 'lintje-icon-button',
      title: 'Een knop met alleen een icoon; het label is de naam en de tooltip',
      specimens: [
        {
          label: 'Omlijnd',
          html: '<lintje-icon-button icon="functioneel-kruis" label="Sluiten"></lintje-icon-button>',
        },
        {
          label: 'Vlak',
          html: '<lintje-icon-button icon="functioneel-menu" label="Menu" variant="flat"></lintje-icon-button>',
        },
        {
          label: 'Actief',
          html: '<lintje-icon-button icon="functioneel-filters" label="Filters" active></lintje-icon-button>',
        },
        {
          label: 'Tegel',
          html: '<lintje-icon-button icon="functioneel-downloaden" label="Downloaden" variant="tile"></lintje-icon-button>',
        },
        {
          label: 'Ingedrukt',
          html: '<lintje-icon-button icon="functioneel-filters" label="Filters" pressed></lintje-icon-button>',
        },
        {
          label: 'Live',
          note: 'Het attribuut `live` laat zien dat de knop nu luistert of spreekt.',
          html: '<lintje-icon-button icon="beeld-en-geluid-microfoon" label="Stoppen met inspreken" variant="flat" live pressed></lintje-icon-button>',
        },
        {
          label: 'Uitgeschakeld',
          html: '<lintje-icon-button icon="functioneel-kruis" label="Sluiten" disabled></lintje-icon-button>',
        },
        {
          label: 'Zonder icoonbestand',
          note: 'Een naam zonder bestand toont het label als tekst.',
          html: '<lintje-icon-button icon="bestaat-niet" label="Sluiten"></lintje-icon-button>',
        },
      ],
    },
    {
      tag: 'lintje-menu-button',
      title: 'Een knop met een keuzemenu van acties',
      specimens: [
        {
          label: 'Rust',
          note: 'In het menu staan een uitgeschakelde keuze met een reden en een onomkeerbare.',
          html: '<lintje-menu-button label="Acties"></lintje-menu-button>',
          setup: (stage) => menu(stage, ACTIONS),
        },
        {
          label: 'Tertiair met hints',
          note: 'Rechts bij elke keuze staat een hint, hier de extensie van het bestand.',
          html: '<lintje-menu-button label="Exporteren" variant="tertiary"></lintje-menu-button>',
          setup: (stage) => menu(stage, EXPORTS),
        },
        {
          label: 'Vlak tussen icoonknoppen',
          note:
            'De gekozen waarde is het label en het icoon zegt waarvan. ' +
            '`accessible-label` geeft de hele naam.',
          html: '<lintje-menu-button label="1×" accessible-label="Afspeelsnelheid 1×" leading-icon="multimedia-player-vooruitspoelen" variant="flat"></lintje-menu-button>',
          setup: (stage) =>
            menu(stage, [
              { value: '1', label: '1×', icon: 'functioneel-vinkje' },
              { value: '1.5', label: '1,5×' },
              { value: '2', label: '2×' },
            ]),
        },
        {
          label: 'Als icoonknop',
          html: '<lintje-menu-button icon label="Meer acties" placement="bottom-end"></lintje-menu-button>',
          setup: (stage) => menu(stage, ACTIONS),
        },
        {
          label: 'Schakelaars en een keuze onder een kop',
          html: '<lintje-menu-button icon variant="tertiary" label="Meer opties" placement="bottom-end"></lintje-menu-button>',
          setup: (stage) => menu(stage, OPTIONS),
        },
        {
          label: 'Gesplitst',
          note: 'De gewone actie staat op de knop, de andere wegen onder het pijltje.',
          html: '<lintje-menu-button split variant="primary" label="Downloaden" action="docx" leading-icon="functioneel-downloaden" accessible-label="Andere manieren om te downloaden of te kopiëren" placement="bottom-end"></lintje-menu-button>',
          setup: (stage) =>
            menu(stage, [
              { heading: 'Kopiëren' },
              { value: 'kopie-transcript', label: 'Transcript' },
              'separator',
              { heading: 'Downloaden' },
              { value: 'pdf', label: 'PDF', hint: '.pdf' },
              { value: 'audio', label: 'Audio', hint: '.m4a' },
            ]),
        },
        {
          label: 'Gesplitst en bezig',
          note: 'Alleen het icoon draait; er verspringt niets.',
          html: '<lintje-menu-button split variant="primary" label="Downloaden" action="docx" leading-icon="functioneel-downloaden" busy-label="Het Word-document wordt gemaakt"></lintje-menu-button>',
          setup: (stage) => menu(stage, [{ value: 'pdf', label: 'PDF', hint: '.pdf' }]),
        },
        {
          label: 'Uitgeschakelde knop',
          html: '<lintje-menu-button label="Acties" disabled></lintje-menu-button>',
          setup: (stage) => menu(stage, ACTIONS),
        },
        {
          label: 'Bezig na een keuze',
          note: 'Kies een formaat: de knop is even bezig, met de zin ernaast.',
          html: '<lintje-menu-button label="Exporteren"></lintje-menu-button>',
          setup(stage) {
            menu(stage, FORMATS)
            const element = stage.querySelector('lintje-menu-button')
            element.addEventListener('lintje-action', (event) => {
              element.busyLabel = BUSY[event.detail] ?? 'Het bestand wordt gemaakt'
              setTimeout(() => (element.busyLabel = ''), 2500)
            })
          },
        },
        {
          label: 'Bezig',
          html: '<lintje-menu-button label="Exporteren" busy-label="Het Word-document wordt gemaakt"></lintje-menu-button>',
          setup: (stage) => menu(stage, FORMATS),
        },
      ],
    },
    {
      tag: 'lintje-copy-button',
      title: 'Tekst naar het klembord, met een bevestiging',
      specimens: [
        {
          label: 'Rust',
          note: 'Druk op de knop om de link te kopiëren.',
          html: '<lintje-copy-button text="https://intranet.example/opnames/4821"></lintje-copy-button>',
        },
        {
          label: 'Primair en compact',
          note: 'Waar kopiëren het doel is, is de knop primair en compact.',
          html: '<lintje-copy-button variant="primary" size="compact" text="De aanvrager schrijft dat zij in maart is verhuisd."></lintje-copy-button>',
        },
        {
          label: 'Vlak icoon naast gereedschap',
          note: 'Met `icon-only` en `variant="flat"` staat hij stil naast ander gereedschap.',
          html: '<lintje-copy-button icon-only variant="flat" text="Uw aanvraag is ontvangen."></lintje-copy-button>',
        },
        {
          label: 'Uitgeschakeld',
          note: 'Zonder `text` of `for` valt er niets te kopiëren.',
          html: '<lintje-copy-button></lintje-copy-button>',
        },
        {
          label: 'Uit een element',
          note: 'Met `for` kopieert de knop de tekst van het element met dat id.',
          html: '<p>Zaaknummer 2026-04-118</p><lintje-copy-button></lintje-copy-button>',
          setup(stage) {
            // Each column has its own source: give it an id unique on the page.
            const source = stage.querySelector('p')
            source.id = `kopie-bron-${Math.random().toString(36).slice(2, 8)}`
            stage.querySelector('lintje-copy-button').setAttribute('for', source.id)
          },
        },
        {
          label: 'Alleen icoon',
          html: '<lintje-copy-button icon-only text="2026-04-118"></lintje-copy-button>',
        },
      ],
    },
    {
      tag: 'lintje-qr-code',
      title: 'Een QR-code voor de camera van een telefoon, te kopiëren als afbeelding',
      specimens: [
        {
          label: 'Rust',
          note: 'De code komt uit de link in `value`.',
          html: '<lintje-qr-code label="QR-code naar deze weergave" value="https://dashboard.example.nl/overzicht?jaar=2025"></lintje-qr-code>',
        },
        {
          label: 'Gemaakt door de host',
          note: 'De host maakt de afbeelding zelf en zet haar in `src`.',
          html: '<lintje-qr-code label="QR-code naar deze weergave"></lintje-qr-code>',
          setup(stage) {
            // Beside this file, so the guide and its test both find it.
            stage.querySelector('lintje-qr-code').src = new URL('../../_data/qr-overzicht.svg', import.meta.url).href
          },
        },
        {
          label: 'Een link te lang voor een code',
          html: `<lintje-qr-code value="https://dashboard.example.nl/?q=${'x'.repeat(3000)}"></lintje-qr-code>`,
        },
        {
          label: 'Zonder code',
          note: 'Zonder `value` of `src` is de knop uitgeschakeld.',
          html: '<lintje-qr-code></lintje-qr-code>',
        },
      ],
    },
{
      tag: 'lintje-icon',
      title: 'Een icoon uit de huisset, op naam',
      specimens: [
        {
          label: 'Vier maten',
          html: '<div class="guide__row"><lintje-icon name="functioneel-info" size="14"></lintje-icon><lintje-icon name="functioneel-info"></lintje-icon><lintje-icon name="functioneel-info" size="18"></lintje-icon><lintje-icon name="functioneel-info" size="20"></lintje-icon></div>',
        },
        {
          label: 'Met naam voor schermlezers',
          html: '<lintje-icon name="functioneel-info" size="20" label="Informatie"></lintje-icon>',
        },
        {
          label: 'Naam zonder bestand',
          note: 'Een naam zonder bestand tekent niets.',
          html: '<lintje-icon name="bestaat-niet" size="20"></lintje-icon>',
        },
      ],
    },
    {
      id: 'icons',
      wide: true,
      title: 'Het register: de iconen die de bundel zelf draagt',
      short: 'register',
      specimens: [
        {
          html: '<div class="guide__stack"><lintje-prose tone="muted"></lintje-prose><div class="guide__icons"></div></div>',
          setup(stage) {
            const names = [...lintje.ICON_NAMES]
            stage.querySelector('lintje-prose').text =
              `${names.length} iconen zitten in de bundel; elke andere naam uit dist-icons/ wordt per bestand opgehaald. De bundel definieert ${lintje.LINTJE_TAGS.length} tags, waarvan ${lintje.LINTJE_VIEWS.length} weergaven.`
            stage.querySelector('.guide__icons').replaceChildren(
              ...names.map((name) => {
                const row = document.createElement('div')
                row.className = 'guide__icon'
                const icon = document.createElement('lintje-icon')
                icon.name = name
                icon.size = 18
                const label = document.createElement('span')
                label.textContent = name
                row.append(icon, label)
                return row
              }),
            )
          },
        },
      ],
    },
    {
      tag: 'lintje-logo',
      title: 'Het beeldmerk van de organisatie, op naam; zonder bestand een lege plek',
      specimens: [
        {
          label: 'Op naam',
          html: '<div class="guide__row"><lintje-logo name="embleem-rijksoverheid" alt="Rijksoverheid"></lintje-logo><lintje-logo name="embleem-defensie" alt="Ministerie van Defensie"></lintje-logo></div>',
        },
        {
          label: 'Open met de naam',
          note: 'Het attribuut `open` zet de naam als tekst naast het embleem.',
          html: '<lintje-logo name="embleem-defensie" open alt="Ministerie van Defensie"></lintje-logo>',
        },
        {
          label: 'Met een tweede regel',
          html: '<lintje-logo name="embleem-rijksoverheid" open alt="Dienst Vergunningen" byline="Ministerie van Voorbeelden"></lintje-logo>',
        },
      ],
    },
  ],
}
