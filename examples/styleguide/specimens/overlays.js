// The overlays category (Vensters en panelen): the specimens of its elements.


/** A button that opens the dialog after it, and a host that answers it. */
function dialogHost(stage, { work = 0 } = {}) {
  const button = stage.querySelector('[data-open]')
  const dialog = stage.querySelector('lintje-confirm-dialog')
  button.addEventListener('click', () => (dialog.open = true))
  dialog.addEventListener('lintje-close', () => (dialog.open = false))
  dialog.addEventListener('lintje-action', () => (dialog.open = false))
  dialog.addEventListener('lintje-confirm', () => {
    if (!work) return (dialog.open = false)
    dialog.busy = true
    setTimeout(() => {
      dialog.busy = false
      dialog.open = false
    }, work)
  })
}

const DRAWER_BODY = `
  <lintje-text-input label="Naam" value="J. de Vries"></lintje-text-input>
  <lintje-text-input label="Rol" value="Melder"></lintje-text-input>`

/** A button that opens the drawer; the host holds `open` and answers `lintje-close`. */
function drawer(stage, busy = false) {
  const element = stage.querySelector('lintje-drawer')
  const opener = stage.querySelector('[data-open]')
  opener.addEventListener('click', () => (element.open = true))
  element.addEventListener('lintje-close', (event) => {
    event.stopPropagation()
    element.open = false
  })
  for (const button of element.querySelectorAll('[data-close]')) {
    button.addEventListener('click', () => (element.open = false))
  }
  if (busy) {
    const save = element.querySelector('[data-save]')
    const cancel = element.querySelector('[data-close]')
    save.addEventListener('click', () => {
      element.busy = save.busy = cancel.disabled = true
      setTimeout(() => {
        element.busy = save.busy = cancel.disabled = false
        element.open = false
      }, 1500)
    })
  } else {
    element.querySelector('[data-save]')?.addEventListener('click', () => (element.open = false))
  }
}

const DRAWER_FOOTER = `
  <lintje-button slot="footer" variant="tertiary" data-close>Annuleren</lintje-button>
  <lintje-button slot="footer" variant="primary" data-save>Opslaan</lintje-button>`

export default {
  elements: [
    {
      tag: 'lintje-modal',
      title: 'Een venster boven de pagina, met een kop, inhoud en exportknoppen',
      specimens: [
        {
          label: 'Tegel op groot formaat',
          html: `<lintje-button variant="secondary" icon="functioneel-foto-vergroten">Open modal</lintje-button>
            <lintje-modal heading="Aanvragen per uur" subtitle="Vandaag · landelijk">
              <div class="guide__placeholder" style="height: var(--chart-h-main)">Inhoud van de tegel, op --chart-h-expanded</div>
              <span slot="footer">Bron: Zaaksysteem · waarde van 08:15</span>
            </lintje-modal>`,
          setup(stage) {
            const modal = stage.querySelector('lintje-modal')
            stage.querySelector('lintje-button').addEventListener('click', () => (modal.open = true))
            modal.addEventListener('lintje-close', () => (modal.open = false))
          },
        },
        {
          // `csv` and `png` default to true, so they go in as properties, not attributes.
          label: 'Dialog: een kop, inhoud en sluiten, zonder exportknoppen',
          html: `<lintje-button variant="secondary">Open dialog</lintje-button>
            <lintje-modal heading="Disclaimer" subtitle="Over deze cijfers">
              <lintje-prose></lintje-prose>
            </lintje-modal>`,
          setup(stage) {
            const modal = stage.querySelector('lintje-modal')
            modal.csv = false
            modal.png = false
            stage.querySelector('lintje-prose').html =
              '<p>De getoonde cijfers zijn <strong>fictief</strong> en dienen alleen om het ontwerpsysteem te tonen.</p>' +
              '<p>Aan deze pagina kunnen geen rechten worden ontleend.</p>'
            stage.querySelector('lintje-button').addEventListener('click', () => (modal.open = true))
            modal.addEventListener('lintje-close', () => (modal.open = false))
          },
        },
        {
          label: 'Smal, met een formulier: een zin links in de voet, de knoppen rechts (narrow)',
          html: `<lintje-button variant="secondary">Open formulier</lintje-button>
            <lintje-modal heading="Naam wijzigen" narrow>
              <lintje-text-input label="Naam van de opname" value="Teamoverleg 2 oktober"></lintje-text-input>
              <span slot="footer">Geldt overal in de app.</span>
              <lintje-button slot="actions" variant="tertiary">Annuleren</lintje-button>
              <lintje-button slot="actions" variant="primary">Opslaan</lintje-button>
            </lintje-modal>`,
          setup(stage) {
            const modal = stage.querySelector('lintje-modal')
            modal.csv = false
            modal.png = false
            stage.querySelector('lintje-button').addEventListener('click', () => (modal.open = true))
            modal.addEventListener('lintje-close', () => (modal.open = false))
          },
        },
      ],
    },
    {
      tag: 'lintje-confirm-dialog',
      title: 'Een vraag die een antwoord nodig heeft',
      specimens: [
        {
          label: 'Rust: iets onomkeerbaars (bevestigen toont bezig)',
          html: `<lintje-button variant="danger" data-open>Melding verwijderen</lintje-button>
            <lintje-confirm-dialog heading="Melding verwijderen?" confirm-label="Verwijderen">
              “Onbeheerde tas” en de 2 bijlagen worden verwijderd. Dit kun je niet terugdraaien.
            </lintje-confirm-dialog>`,
          setup: (stage) => dialogHost(stage, { work: 1500 }),
        },
        {
          label: 'Wijzigingen niet opgeslagen',
          html: `<lintje-button variant="secondary" data-open>Formulier verlaten</lintje-button>
            <lintje-confirm-dialog tone="primary" heading="Wijzigingen niet opgeslagen"
              action-label="Weggooien" cancel-label="Hier blijven" confirm-label="Concept opslaan">
              Je verlaat dit formulier. Wil je het concept bewaren?
            </lintje-confirm-dialog>`,
          setup: (stage) => dialogHost(stage),
        },
      ],
    },
    {
      tag: 'lintje-drawer',
      title: 'Een zijpaneel over de pagina',
      specimens: [
        {
          label: 'Rust, focus op het eerste veld',
          html: `<lintje-button variant="secondary" data-open>Betrokkene bewerken</lintje-button>
            <lintje-drawer heading="Betrokkene">${DRAWER_BODY}${DRAWER_FOOTER}</lintje-drawer>`,
          setup: (stage) => drawer(stage),
        },
        {
          label: 'Bezig: sluiten is geblokkeerd',
          html: `<lintje-button variant="secondary" data-open>Opslaan proberen</lintje-button>
            <lintje-drawer heading="Betrokkene">${DRAWER_BODY}${DRAWER_FOOTER}</lintje-drawer>`,
          setup: (stage) => drawer(stage, true),
        },
        {
          label: 'Zonder veld: focus op de sluitknop',
          html: `<lintje-button variant="secondary" data-open>Details tonen</lintje-button>
            <lintje-drawer heading="Opname 2 oktober"><p>Opgenomen om 09:30, 42 minuten, drie sprekers.</p></lintje-drawer>`,
          setup: (stage) => drawer(stage),
        },
        {
          label: 'Met een regel onder de titel',
          html: `<lintje-button variant="secondary" data-open>Melding openen</lintje-button>
            <lintje-drawer heading="Onbeheerde tas" subtitle="Melding 2026-0412 · Rijkskantoor"><p>Gemeld om 08:12 bij balie 4.</p></lintje-drawer>`,
          setup: (stage) => drawer(stage),
        },
      ],
    },
    {
      tag: 'lintje-popover',
      title: 'Het zwevende paneel',
      specimens: [
        {
          label: 'Open onder zijn anker',
          html: `<lintje-button variant="secondary" data-anchor>Kolommen</lintje-button>
            <lintje-popover label="Kolommen kiezen" panel-role="dialog">
              <lintje-prose class="guide__popover-body">
                <p><strong>Kolommen</strong></p>
                <p>Hier staat de inhoud: een lijst, een formulier, een toelichting.</p>
              </lintje-prose>
            </lintje-popover>`,
          setup(stage) {
            const button = stage.querySelector('[data-anchor]')
            const popover = stage.querySelector('lintje-popover')
            button.addEventListener('click', () => (popover.open = !popover.open))
            popover.addEventListener('lintje-close', () => (popover.open = false))
          },
        },
      ],
    },
    {
      tag: 'lintje-tooltip',
      title: 'Een korte toelichting bij een element',
      specimens: [
        {
          label: 'Hover na 300 ms, focus direct',
          html: '<lintje-tooltip text="Talen omwisselen" no-describe><lintje-icon-button icon="functioneel-refresh" label="Talen omwisselen"></lintje-icon-button></lintje-tooltip>',
        },
        {
          label: 'Bij een woord',
          html: 'een geldige <lintje-tooltip text="Woordenlijst: residence permit wordt verblijfsvergunning"><lintje-button variant="link">verblijfsvergunning</lintje-button></lintje-tooltip>',
        },
      ],
    },
    {
      tag: 'lintje-toggletip',
      title: 'Een toelichting die opent op een klik',
      specimens: [
        {
          label: 'Naast een label: klik, Enter of spatie',
          html: `<div class="guide__row">Gemiddelde wachttijd
            <lintje-toggletip label="Toelichting op gemiddelde wachttijd">De mediaan van de wachttijd per kwartier, over alle loketten van de dienst.</lintje-toggletip></div>`,
        },
        {
          label: 'Rechts uitgelijnd (bottom-end)',
          html: `<div class="guide__row">Afgehandeld binnen termijn
            <lintje-toggletip label="Toelichting op afgehandeld binnen termijn" placement="bottom-end">Het deel van de aanvragen dat binnen acht weken een besluit kreeg.</lintje-toggletip></div>`,
        },
        {
          label: 'In een zijpaneel: Escape sluit eerst de toelichting',
          html: `<lintje-button variant="secondary" data-open>Aanvraag tonen</lintje-button>
            <lintje-drawer heading="Aanvraag 2026-0815">
              <div class="guide__row">Behandeltermijn
                <lintje-toggletip label="Toelichting op behandeltermijn">Acht weken vanaf de dag dat de aanvraag compleet is.</lintje-toggletip></div>
            </lintje-drawer>`,
          setup(stage) {
            const drawer = stage.querySelector('lintje-drawer')
            stage.querySelector('[data-open]').addEventListener('click', () => (drawer.open = true))
            drawer.addEventListener('lintje-close', (event) => {
              event.stopPropagation()
              drawer.open = false
            })
          },
        },
      ],
    },
  ],
}
