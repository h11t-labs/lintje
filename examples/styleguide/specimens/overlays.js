// The overlays category (Vensters en panelen): the specimens of its elements.
import { registerShortcut } from '../../../dist-elements/core.js'
import { shortcutOverview } from '../../_shared/shortcuts.js'


/**
 * A button that opens the dialog after it, and a host that answers it: `data-close` closes,
 * `data-answer` closes after `work` ms of `busy`.
 */
function dialogHost(stage, { work = 0 } = {}) {
  const dialog = stage.querySelector('lintje-dialog')
  stage.querySelector('[data-open]').addEventListener('click', () => (dialog.open = true))
  dialog.addEventListener('lintje-close', () => (dialog.open = false))
  for (const button of dialog.querySelectorAll('[data-close]')) {
    button.addEventListener('click', () => (dialog.open = false))
  }
  dialog.querySelector('[data-answer]')?.addEventListener('click', () => {
    if (!work) return (dialog.open = false)
    dialog.busy = true
    setTimeout(() => {
      dialog.busy = false
      dialog.open = false
    }, work)
  })
  return dialog
}

/** Two demo shortcuts, registered once for the page (the style guide draws every specimen twice). */
let demoKeys = false

/** The shortcut overview: a dialog the page fills from the register, opened by its button or `?`. */
function shortcutsHost(stage) {
  if (!demoKeys) {
    demoKeys = true
    registerShortcut({ keys: 'Ctrl+S', description: 'Opslaan', handler: () => {}, inFields: true })
    registerShortcut({ keys: 'ArrowLeft', description: '5 seconden terug', handler: () => {} })
  }
  const open = shortcutOverview(stage.querySelector('lintje-dialog'))
  stage.querySelector('[data-open]').addEventListener('click', open)
}

/** "Je sessie verloopt over 2 minuten": the recipe counts down itself; the page knows the end. */
function sessionHost(stage) {
  const dialog = dialogHost(stage, { work: 1200 })
  let end = 0
  let timer = 0
  const tick = () => {
    const minutes = Math.max(1, Math.ceil((end - Date.now()) / 60_000))
    dialog.heading = `Je sessie verloopt over ${minutes} ${minutes === 1 ? 'minuut' : 'minuten'}`
  }
  stage.querySelector('[data-open]').addEventListener('click', () => {
    end = Date.now() + 2 * 60_000
    tick()
    timer = setInterval(tick, 1000)
  })
  dialog.addEventListener('lintje-close', () => clearInterval(timer))
  for (const button of dialog.querySelectorAll('lintje-button')) {
    button.addEventListener('click', () => clearInterval(timer))
  }
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
      // Open, in a page of its own: on the guide's page it would cover the guide.
      frame: true,
      title: 'Het grote venster, voor inhoud',
      specimens: [
        {
          // `csv` and `png` are what a content tile sets; a modal has no buttons of its own.
          label: 'Tegel op groot formaat',
          note: 'De tegel zet `csv` en `png`; de modal heeft zelf geen knoppen.',
          html: `<lintje-button variant="secondary" icon="functioneel-foto-vergroten">Open modal</lintje-button>
            <lintje-modal heading="Aanvragen per uur" subtitle="Vandaag · landelijk" csv png>
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
          label: 'Tekst zonder voet',
          html: `<lintje-button variant="secondary">Open modal</lintje-button>
            <lintje-modal heading="Over deze cijfers" subtitle="Bronnen, peilmoment en wat ontbreekt">
              <lintje-prose></lintje-prose>
            </lintje-modal>`,
          setup(stage) {
            const modal = stage.querySelector('lintje-modal')
            stage.querySelector('lintje-prose').html =
              '<p>De getoonde cijfers zijn <strong>fictief</strong> en dienen alleen om het ontwerpsysteem te tonen.</p>' +
              '<p>Aan deze pagina kunnen geen rechten worden ontleend.</p>'
            stage.querySelector('lintje-button').addEventListener('click', () => (modal.open = true))
            modal.addEventListener('lintje-close', () => (modal.open = false))
          },
        },
      ],
    },
    {
      tag: 'lintje-dialog',
      // Open, in a page of its own: on the guide's page it would cover the guide.
      frame: true,
      title: 'Het kleine venster: een vraag die een antwoord nodig heeft, of een kort formulier',
      specimens: [
        {
          // The safe button comes first and has `autofocus`; on a phone the last stands on top.
          label: 'Iets onomkeerbaars bevestigen',
          note:
            'Met `alert` vraagt het venster om een antwoord. Na bevestigen is de knop even bezig.',
          html: `<lintje-button variant="danger" data-open>Melding verwijderen</lintje-button>
            <lintje-dialog alert heading="Melding verwijderen?">
              “Onbeheerde tas” en de 2 bijlagen worden verwijderd. Dit kun je niet terugdraaien.
              <lintje-button slot="actions" variant="secondary" autofocus data-close>Annuleren</lintje-button>
              <lintje-button slot="actions" variant="danger" data-answer>Verwijderen</lintje-button>
            </lintje-dialog>`,
          setup: (stage) => dialogHost(stage, { work: 1500 }),
        },
        {
          label: 'Wijzigingen niet opgeslagen',
          note: 'Een derde knop laat het concept bewaren.',
          html: `<lintje-button variant="secondary" data-open>Formulier verlaten</lintje-button>
            <lintje-dialog alert heading="Wijzigingen niet opgeslagen">
              Je verlaat dit formulier. Wil je het concept bewaren?
              <lintje-button slot="actions" variant="tertiary" data-close>Weggooien</lintje-button>
              <lintje-button slot="actions" variant="secondary" autofocus data-close>Hier blijven</lintje-button>
              <lintje-button slot="actions" variant="primary" data-answer>Concept opslaan</lintje-button>
            </lintje-dialog>`,
          setup: (stage) => dialogHost(stage),
        },
        {
          label: 'Kort formulier',
          note:
            'Met `wide` is het venster zo breed als een formulier. ' +
            'In de voet staat links een zin en rechts de knoppen.',
          html: `<lintje-button variant="secondary" data-open>Naam wijzigen</lintje-button>
            <lintje-dialog wide heading="Naam wijzigen">
              <lintje-text-input label="Naam van de opname" value="Teamoverleg 2 oktober"></lintje-text-input>
              <span slot="footer">Geldt overal in de app.</span>
              <lintje-button slot="actions" variant="secondary" data-close>Annuleren</lintje-button>
              <lintje-button slot="actions" variant="primary" data-answer>Opslaan</lintje-button>
            </lintje-dialog>`,
          setup: (stage) => dialogHost(stage, { work: 1000 }),
        },
        {
          // Recipe: the page knows when the session ends and counts down; at least 20 seconds ahead.
          label: 'De sessie verloopt',
          note: 'Een recept: `alert persistent`, zodat Escape en de achtergrond niets vragen.',
          html: `<lintje-button variant="secondary" data-open>Sessie verloopt over 2 minuten</lintje-button>
            <lintje-dialog alert persistent heading="Je sessie verloopt over 2 minuten">
              Je invoer wordt bewaard in deze browser. Blijf aangemeld om door te werken.
              <lintje-button slot="actions" variant="tertiary" data-close>Afmelden</lintje-button>
              <lintje-button slot="actions" variant="primary" autofocus data-answer>Aangemeld blijven</lintje-button>
            </lintje-dialog>`,
          setup: (stage) => sessionHost(stage),
        },
        {
          // Recipe: the register's list, filled fresh each time it opens.
          label: 'De sneltoetsen',
          note: 'Een recept: het overzicht vult zich uit de geregistreerde toetsen. Druk ook op ?.',
          html: `<lintje-button variant="secondary" data-open aria-keyshortcuts="?">Sneltoetsen</lintje-button>
            <lintje-dialog heading="Sneltoetsen"></lintje-dialog>`,
          setup: (stage) => shortcutsHost(stage),
        },
        {
          label: 'Afgemeld',
          note:
            'Een recept: na een mislukte verlenging meldt het venster dat de sessie voorbij is.',
          html: `<lintje-button variant="secondary" data-open>Verlengen mislukt</lintje-button>
            <lintje-dialog alert persistent heading="Je bent afgemeld">
              Je sessie is verlopen. Meld je opnieuw aan; je komt terug op deze pagina.
              <lintje-button slot="actions" variant="primary" autofocus data-close>Opnieuw aanmelden</lintje-button>
            </lintje-dialog>`,
          setup: (stage) => dialogHost(stage),
        },
      ],
    },
    {
      tag: 'lintje-drawer',
      // Open, in a page of its own: on the guide's page it would cover the guide.
      frame: true,
      title: 'Een zijpaneel over de pagina',
      specimens: [
        {
          label: 'Rust',
          note: 'Bij openen krijgt het eerste veld de focus.',
          html: `<lintje-button variant="secondary" data-open>Betrokkene bewerken</lintje-button>
            <lintje-drawer heading="Betrokkene">${DRAWER_BODY}${DRAWER_FOOTER}</lintje-drawer>`,
          setup: (stage) => drawer(stage),
        },
        {
          label: 'Bezig',
          note: 'Druk op Opslaan: zolang het paneel bezig is, gaat het niet dicht.',
          html: `<lintje-button variant="secondary" data-open>Opslaan proberen</lintje-button>
            <lintje-drawer heading="Betrokkene">${DRAWER_BODY}${DRAWER_FOOTER}</lintje-drawer>`,
          setup: (stage) => drawer(stage, true),
        },
        {
          label: 'Van links',
          note:
            'Met `side="left"` schuift het paneel van links in; in de nieuwe huisstijl staat de ' +
            'ene afgeronde hoek (`--radius-corner`) bovenaan aan de kant van de pagina.',
          html: `<div data-style-version="new" data-style-new-corner="round">
            <lintje-button variant="secondary" data-open>Filters tonen</lintje-button>
            <lintje-drawer heading="Filters" side="left"><p>De filters van de lijst, als lade naast de pagina.</p></lintje-drawer>
          </div>`,
          setup: (stage) => drawer(stage),
        },
        {
          label: 'Zonder veld',
          note: 'Zonder veld krijgt de sluitknop de focus.',
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
              <lintje-prose class="guide__popover-body"></lintje-prose>
            </lintje-popover>`,
          setup(stage) {
            // As `html`, not slotted: slotted paragraphs keep the browser's margins.
            stage.querySelector('lintje-prose').html =
              '<p><strong>Kolommen</strong></p><p>Hier staat de inhoud: een lijst, een formulier, een toelichting.</p>'
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
          label: 'Bij een icoonknop',
          note: 'Bij aanwijzen verschijnt hij na 300 ms, bij focus direct.',
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
          label: 'Naast een label',
          note: 'Open hem met een klik, Enter of spatie.',
          html: `<div class="guide__row">Gemiddelde wachttijd
            <lintje-toggletip label="Toelichting op gemiddelde wachttijd">De mediaan van de wachttijd per kwartier, over alle loketten van de dienst.</lintje-toggletip></div>`,
        },
        {
          label: 'Rechts uitgelijnd',
          note: 'Met `placement="bottom-end"` lijnt de toelichting rechts uit.',
          html: `<div class="guide__row">Afgehandeld binnen termijn
            <lintje-toggletip label="Toelichting op afgehandeld binnen termijn" placement="bottom-end">Het deel van de aanvragen dat binnen acht weken een besluit kreeg.</lintje-toggletip></div>`,
        },
        {
          label: 'In een zijpaneel',
          frame: 'lintje-drawer',
          note: 'Escape sluit eerst de toelichting en dan pas het zijpaneel.',
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
