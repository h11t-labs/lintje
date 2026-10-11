// The layout category (Indeling): the specimens of its elements.

const FOOTNOTE = 'Bron: Zaaksysteem · waarde van 08:15'

const TABS = [
  { value: 'transcript', label: 'Transcript', href: '#tab-transcript' },
  { value: 'samenvatting', label: 'Samenvatting', href: '#tab-samenvatting' },
  { value: 'opmerkingen', label: 'Opmerkingen', href: '#tab-opmerkingen', count: 2 },
  { value: 'geschiedenis', label: 'Geschiedenis', disabled: true },
]

const PANELS = `
  <p slot="transcript">Spreker 1: Goedemorgen, we beginnen met de stand van zaken.</p>
  <p slot="samenvatting">Het team bespreekt de planning voor oktober en verdeelt drie acties.</p>
  <p slot="opmerkingen">Twee opmerkingen bij de tweede alinea.</p>`

const LARGE = [
  { value: 'tekst', label: 'Tekst', icon: 'communicatie-tekstballon-met-potlood', hint: 'Typ, plak of spreek in' },
  { value: 'document', label: 'Document', icon: 'op-kantoor-document-blanco', hint: 'PDF, Word of tekst' },
  { value: 'live', label: 'Live gesprek', icon: 'beeld-en-geluid-microfoon', hint: 'Praat met elkaar, de vertaling loopt mee', badge: 'Nieuw' },
]

const LARGE_PANELS = `
  <p slot="tekst">Het tekstvak en de vertaling staan hier, in het paneel onder de tabs.</p>
  <p slot="document">Sleep een document hierheen of kies er een.</p>
  <p slot="live">Druk op de knop van je taal en begin te praten.</p>`

/** The host's half: it holds `value` and sets it when a tab is chosen. */
function tabs(stage, value, items = TABS) {
  const element = stage.querySelector('lintje-tabs')
  element.tabs = items
  if (value) element.value = value
  element.addEventListener('lintje-tab-change', (event) => (element.value = event.detail))
  element.addEventListener('lintje-navigate', (event) => {
    event.preventDefault()
    event.stopPropagation()
  })
}

const SPLIT = `
  <div slot="start"><strong>Brontekst</strong><p>The applicant writes that she moved to the Netherlands in March.</p></div>
  <div slot="end"><strong>Vertaling</strong><p>De aanvrager schrijft dat zij in maart naar Nederland is verhuisd.</p></div>`

export default {
  elements: [
{
      tag: 'lintje-grid',
      title: 'Het raster van twaalf kolommen',
      specimens: [
        {
          label: 'Tegels van 8 en 4, items van 6 en 6',
          wide: true,
          html: `<lintje-grid>
            <lintje-tile span="8" heading="span 8" subtitle="8 van 12 · 768-1023 wordt dit 12">
              <div class="guide__placeholder">span 8</div>
            </lintje-tile>
            <lintje-tile span="4" heading="span 4" subtitle="4 van 12 · 768-1023 wordt dit 6">
              <div class="guide__placeholder">span 4</div>
            </lintje-tile>
            <lintje-grid-item span="6"><div class="guide__placeholder">lintje-grid-item span 6</div></lintje-grid-item>
            <lintje-grid-item span="6"><div class="guide__placeholder">lintje-grid-item span 6</div></lintje-grid-item>
          </lintje-grid>`,
        },
      ],
    },
    {
      tag: 'lintje-grid-item',
      title: 'Een cel van het raster voor inhoud die zelf geen span draagt',
      specimens: [
        {
          label: 'Drie cellen: 4, 4 en 4',
          wide: true,
          html: `<lintje-grid>
            <lintje-grid-item span="4"><div class="guide__placeholder">span 4</div></lintje-grid-item>
            <lintje-grid-item span="4"><div class="guide__placeholder">span 4</div></lintje-grid-item>
            <lintje-grid-item span="4"><div class="guide__placeholder">span 4</div></lintje-grid-item>
          </lintje-grid>`,
        },
      ],
    },
    {
      tag: 'lintje-tile',
      title: 'De tegel: kop, inhoud en bron, in vier toestanden',
      specimens: [
        {
          label: 'Klaar',
          wide: true,
          html: `<lintje-tile heading="Afwijzingen naar grond" subtitle="Vandaag · 37 afwijzingen" footnote="${FOOTNOTE}" expandable download>
            <div class="guide__placeholder"><lintje-icon name="functioneel-info" size="18"></lintje-icon> Inhoud van een tegel</div>
          </lintje-tile>`,
        },
        {
          label: 'Leeg',
          wide: true,
          html: `<lintje-tile heading="Aanvragen per uur" subtitle="Aanvragen per uur · vandaag · gearceerd = nog niet compleet" footnote="${FOOTNOTE}" state="empty" message="Geen gegevens voor deze selectie. Kies een ruimer tijdvak of een ander loket." expandable download></lintje-tile>`,
        },
        {
          label: 'Laden',
          wide: true,
          html: `<lintje-tile heading="Aanvragen per loket" subtitle="Vandaag" footnote="${FOOTNOTE}" state="loading"></lintje-tile>`,
        },
        {
          label: 'Fout',
          wide: true,
          html: `<lintje-tile heading="Wachttijd per uur" subtitle="Vandaag" footnote="${FOOTNOTE}" state="error" message="De bron reageerde niet. De cijfers van vandaag ontbreken." last-known="Laatst bekend: 11 min, gemeten om 07:45."></lintje-tile>`,
        },
        {
          label: 'Met een kerncijfer ernaast (aside)',
          wide: true,
          html: `<lintje-tile heading="Bezetting loketten" subtitle="Vandaag · 184 van 200 posities" footnote="Bron: Dossierregistratie · waarde van 08:15">
            <p slot="aside" style="font: var(--text-kpi); font-variant-numeric: tabular-nums">92%</p>
            <div class="guide__placeholder">lintje-tile slot="aside" (layout H)</div>
          </lintje-tile>`,
        },
        {
          label: 'Rijen tot de rand (flush): een werklijst in een tegel',
          wide: true,
          html: `<lintje-tile heading="Eerder vertaald" flush footnote="Je geschiedenis blijft op dit apparaat.">
            <lintje-button slot="actions" variant="link" size="compact" href="#el-tile">Alles bekijken</lintje-button>
            <lintje-list heading-level="4" label="Eerder vertaalde teksten"></lintje-list>
          </lintje-tile>`,
          setup(stage) {
            stage.querySelector('lintje-list').items = [
              { id: 't1', icon: 'communicatie-tekstballon-met-potlood', title: 'Uw aanvraag is ontvangen. Binnen acht weken krijgt u een besluit.', sub: 'Nederlands → Engels · 65 tekens', meta: '10:12', group: 'Vandaag', actions: [{ value: 'verwijderen', label: 'Verwijderen uit geschiedenis' }] },
              { id: 't2', icon: 'communicatie-tekstballon-met-potlood', title: 'Where can I collect my residence permit?', sub: 'Engels → Nederlands · 41 tekens', meta: '16:05', group: 'Gisteren', actions: [{ value: 'verwijderen', label: 'Verwijderen uit geschiedenis' }] },
            ]
          },
        },
        {
          label: 'Zonder kerncijfer',
          wide: true,
          html: `<lintje-tile heading="Zonder kerncijfer" subtitle="Dezelfde tegel zonder aside">
            <div class="guide__placeholder">geen aside</div>
          </lintje-tile>`,
        },
      ],
    },
{
      tag: 'lintje-tabs',
      title: 'Wisselen tussen panelen binnen één pagina',
      specimens: [
        {
          label: 'Rust, actief, met teller, uitgeschakeld',
          wide: true,
          html: `<lintje-tabs label="Weergave van de opname">${PANELS}</lintje-tabs>`,
          setup: (stage) => tabs(stage),
        },
        {
          label: 'Actief: een andere tab gekozen (op een telefoon: smaller dan 768 px)',
          html: `<lintje-tabs label="Weergave van de opname, tweede">${PANELS}</lintje-tabs>`,
          setup: (stage) => tabs(stage, 'opmerkingen'),
        },
        {
          label: 'Elke tab een pagina: een nav met links, de huidige aria-current',
          html: `<lintje-tabs label="Onderdelen van de opname">${PANELS}</lintje-tabs>`,
          setup: (stage) => tabs(stage, 'samenvatting', TABS.slice(0, 3)),
        },
        {
          label: 'Groot, boven een paneel: icoon, uitleg en label (op een telefoon het icoon boven de naam)',
          wide: true,
          html: `<lintje-tabs variant="panel" label="Wat wil je vertalen?">${LARGE_PANELS}</lintje-tabs>`,
          setup: (stage) => tabs(stage, undefined, LARGE),
        },
      ],
    },
    {
      tag: 'lintje-expander',
      title: 'Een uitklapper: de kop is een knop, de inhoud blijft in het document',
      specimens: [
        {
          label: 'Dicht',
          wide: true,
          html: `<lintje-expander heading="Toelichting op de meting">
            <lintje-prose text="De wachttijd is de mediaan per kwartier, gemeten vanaf het betreden van de rij."></lintje-prose>
          </lintje-expander>`,
        },
        {
          label: 'Open',
          wide: true,
          html: `<lintje-expander heading="Staat open bij het laden" open>
            <lintje-prose text="open is gereflecteerd, de kop is een echte knop en aria-expanded zegt wat hij doet."></lintje-prose>
          </lintje-expander>`,
        },
        {
          label: 'Zonder eigen vlak (flat)',
          wide: true,
          html: `<lintje-expander heading="Zonder eigen vlak (flat)" flat>
            <lintje-prose text="In een tegel is een uitklapper geen tweede kaart."></lintje-prose>
          </lintje-expander>`,
        },
        {
          label: 'Pijl vooraan, inhoud in lijn met de titel (leading), met acties naast de titel',
          wide: true,
          html: `<lintje-expander heading="Samenvatting" subtitle="AI-bewerking · 09:31" leading open>
            <lintje-icon-button slot="actions" icon="functioneel-refresh" label="Samenvatting opnieuw maken" variant="flat"></lintje-icon-button>
            <lintje-icon-button slot="actions" icon="functioneel-kruis" label="Samenvatting verbergen" variant="flat"></lintje-icon-button>
            <lintje-prose text="De ochtenddienst begint maandag om zes uur; de roostermaker is nog niet ingelicht."></lintje-prose>
          </lintje-expander>`,
        },
      ],
    },
    {
      tag: 'lintje-split-pane',
      title: 'Twee panelen met een verschuifbare verdeling',
      specimens: [
        {
          label: 'Rust, hover, focus, slepen',
          wide: true,
          html: `<lintje-split-pane start-label="Brontekst" end-label="Vertaling">${SPLIT}</lintje-split-pane>`,
        },
        {
          label: 'Grenzen: onthouden onder een sleutel',
          wide: true,
          html: `<lintje-split-pane start-label="Brontekst" end-label="Vertaling" storage-key="lintje-demo-vertalen" value="35">${SPLIT}</lintje-split-pane>`,
        },
      ],
    },
  ],
}
