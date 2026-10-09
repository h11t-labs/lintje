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
          label: 'De vier varianten: primair, secundair, tertiair en link',
          wide: true,
          html: `<div class="guide__row">
            <lintje-button variant="primary">Toepassen</lintje-button>
            <lintje-button variant="secondary">Annuleren</lintje-button>
            <lintje-button variant="tertiary">Meer</lintje-button>
            <lintje-button variant="link">Uitleg</lintje-button>
          </div>`,
        },
        {
          label: 'Voor wat niet terug te draaien is: gevuld en omlijnd',
          html: `<div class="guide__row">
            <lintje-button variant="danger">Verwijderen</lintje-button>
            <lintje-button variant="danger-secondary">Verwijderen</lintje-button>
          </div>`,
        },
        {
          label: 'Uitgeschakeld met een reden: die staat ernaast en wordt bij de knop voorgelezen',
          html: `<div class="guide__row">
            <span>Starten kan zodra Transcriptie je microfoon mag gebruiken.</span>
            <lintje-button variant="primary" icon="beeld-en-geluid-microfoon" disabled reason="Starten kan zodra Transcriptie je microfoon mag gebruiken.">Opname starten</lintje-button>
          </div>`,
        },
        {
          label: 'Met een icoon, links of rechts',
          html: `<div class="guide__row">
            <lintje-button variant="secondary" icon="functioneel-filters">Filters</lintje-button>
            <lintje-button variant="tertiary" icon-right="functioneel-delta-omlaag">Meer</lintje-button>
          </div>`,
        },
        {
          label: 'Drie maten: gewoon (48), compact (40) en chrome (40)',
          html: `<div class="guide__row">
            <lintje-button variant="secondary">Gewoon</lintje-button>
            <lintje-button variant="secondary" size="compact">Compact</lintje-button>
            <lintje-button variant="secondary" size="chrome" icon="functioneel-delen">Delen</lintje-button>
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
          label: 'Bezig: de breedte blijft, het label wijkt voor de ring',
          wide: true,
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
          label: 'Live: luistert of spreekt nu',
          html: '<lintje-icon-button icon="beeld-en-geluid-microfoon" label="Stoppen met inspreken" variant="flat" live pressed></lintje-icon-button>',
        },
        {
          label: 'Uitgeschakeld',
          html: '<lintje-icon-button icon="functioneel-kruis" label="Sluiten" disabled></lintje-icon-button>',
        },
        {
          label: 'Zonder icoonbestand: het label als tekst',
          html: '<lintje-icon-button icon="bestaat-niet" label="Sluiten"></lintje-icon-button>',
        },
      ],
    },
    {
      tag: 'lintje-menu-button',
      title: 'Een knop met een keuzemenu van acties',
      specimens: [
        {
          label: 'Rust, uitgeschakeld, onomkeerbaar',
          html: '<lintje-menu-button label="Acties"></lintje-menu-button>',
          setup: (stage) => menu(stage, ACTIONS),
        },
        {
          label: 'Tertiair, met hint',
          html: '<lintje-menu-button label="Exporteren" variant="tertiary"></lintje-menu-button>',
          setup: (stage) => menu(stage, EXPORTS),
        },
        {
          label: 'Vlak, tussen icoonknoppen: de keuze is het label, het icoon zegt waarvan',
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
          label: 'Gesplitst: de gewone actie op de knop, de andere wegen onder het pijltje',
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
          label: 'Gesplitst en bezig: alleen het icoon draait, er verspringt niets',
          html: '<lintje-menu-button split variant="primary" label="Downloaden" action="docx" leading-icon="functioneel-downloaden" busy-label="Het Word-document wordt gemaakt"></lintje-menu-button>',
          setup: (stage) => menu(stage, [{ value: 'pdf', label: 'PDF', hint: '.pdf' }]),
        },
        {
          label: 'Uitgeschakelde knop',
          html: '<lintje-menu-button label="Acties" disabled></lintje-menu-button>',
          setup: (stage) => menu(stage, ACTIONS),
        },
        {
          label: 'Bezig na een keuze, met de zin ernaast',
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
          label: 'Rust — druk om te kopiëren',
          html: '<lintje-copy-button text="https://intranet.example/opnames/4821"></lintje-copy-button>',
        },
        {
          label: 'Primair en compact, waar kopiëren het doel is',
          html: '<lintje-copy-button variant="primary" size="compact" text="De aanvrager schrijft dat zij in maart is verhuisd."></lintje-copy-button>',
        },
        {
          label: 'Alleen een icoon, stil naast ander gereedschap',
          html: '<lintje-copy-button icon-only variant="flat" text="Uw aanvraag is ontvangen."></lintje-copy-button>',
        },
        {
          label: 'Uitgeschakeld',
          html: '<lintje-copy-button></lintje-copy-button>',
        },
        {
          label: 'Gekopieerd, uit een element',
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
          label: 'Rust — de code van een link',
          html: '<lintje-qr-code label="QR-code naar deze weergave" value="https://dashboard.example.nl/overzicht?jaar=2025"></lintje-qr-code>',
        },
        {
          label: 'De code die de host maakte',
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
          label: 'Zonder code: de knop uitgeschakeld',
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
          label: 'Een naam zonder bestand tekent niets',
          html: '<lintje-icon name="bestaat-niet" size="20"></lintje-icon>',
        },
      ],
    },
    {
      id: 'icons',
      title: 'Het register: de iconen die de bundel zelf draagt',
      short: 'register',
      specimens: [
        {
          wide: true,
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
          label: 'Met de naam als tekst, open',
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
