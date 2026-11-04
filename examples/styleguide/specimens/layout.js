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

const FAQ = `
  <lintje-expander heading="Wie kan de subsidie aanvragen?">
    <lintje-prose text="Organisaties die in Nederland gevestigd zijn en ingeschreven staan bij de Kamer van Koophandel."></lintje-prose>
  </lintje-expander>
  <lintje-expander heading="Welke documenten heb ik nodig?">
    <lintje-prose text="Een kopie van het identiteitsbewijs van de aanvrager, een recent uittreksel van de Kamer van Koophandel en een begroting van de kosten."></lintje-prose>
  </lintje-expander>
  <lintje-expander heading="Hoe lang duurt de beoordeling?">
    <lintje-prose text="Binnen acht weken na een volledige aanvraag. Ontbreekt er iets, dan staat de termijn stil tot het is aangevuld."></lintje-prose>
  </lintje-expander>
  <lintje-expander heading="Wat gebeurt er na de toekenning, en wanneer wordt het bedrag uitbetaald?">
    <lintje-prose text="Je krijgt een besluit met het bedrag. Het voorschot staat binnen vier weken op je rekening."></lintje-prose>
  </lintje-expander>`

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
      wide: true,
      title: 'Het raster van twaalf kolommen',
      specimens: [
        {
          label: 'Tegels en items',
          note: 'Tegels van 8 en 4 kolommen, daaronder twee items van 6.',
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
        {
          label: 'Op een telefoon',
          note:
            'In de nieuwe huisstijl heeft een telefoon vier kolommen. Een item neemt ze alle vier, ' +
            'tenzij `span-mobile` er minder noemt: hier staan de eerste twee op een telefoon naast ' +
            'elkaar en de derde eronder. In de oude huisstijl stapelen ze.',
          html: `<lintje-grid>
            <lintje-grid-item span="4" span-mobile="2"><div class="guide__placeholder">span 4 · span-mobile 2</div></lintje-grid-item>
            <lintje-grid-item span="4" span-mobile="2"><div class="guide__placeholder">span 4 · span-mobile 2</div></lintje-grid-item>
            <lintje-grid-item span="4"><div class="guide__placeholder">span 4</div></lintje-grid-item>
          </lintje-grid>`,
        },
        {
          label: 'Plaats en zichtbaarheid',
          note:
            'Op een telefoon schuift een item met `order-mobile="1"` achter de rest, valt een item ' +
            'met `hide-mobile` weg en verschijnt een item met `hide-desktop`. Verberg alleen wat de ' +
            'pagina ook op een andere manier zegt.',
          html: `<lintje-grid>
            <lintje-grid-item span="4" order-mobile="1"><div class="guide__placeholder">order-mobile 1 · op een telefoon als laatste</div></lintje-grid-item>
            <lintje-grid-item span="4"><div class="guide__placeholder">zonder attribuut</div></lintje-grid-item>
            <lintje-grid-item span="4" hide-mobile><div class="guide__placeholder">hide-mobile · niet op een telefoon</div></lintje-grid-item>
            <lintje-grid-item span="12" hide-desktop><div class="guide__placeholder">hide-desktop · alleen op een telefoon</div></lintje-grid-item>
          </lintje-grid>`,
        },
      ],
    },
    {
      tag: 'lintje-grid-item',
      wide: true,
      title: 'Een cel van het raster voor inhoud die zelf geen span draagt',
      specimens: [
        {
          label: 'Drie cellen van 4',
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
      wide: true,
      title: 'De tegel: kop, inhoud en bron, in vier toestanden',
      specimens: [
        {
          label: 'Klaar',
          html: `<lintje-tile heading="Afwijzingen naar grond" subtitle="Vandaag · 37 afwijzingen" footnote="${FOOTNOTE}" expandable download>
            <div class="guide__placeholder"><lintje-icon name="functioneel-info" size="18"></lintje-icon> Inhoud van een tegel</div>
          </lintje-tile>`,
        },
        {
          label: 'Ingeklapt op een telefoon',
          note:
            'Met `collapsed-mobile` toont een telefoon alleen de kop en een knop Tonen; de inhoud ' +
            'staat één tik verder. Op een breder scherm verandert er niets.',
          html: `<lintje-tile heading="Aanvragen per regio" subtitle="Vandaag" collapsed-mobile>
            <div class="guide__placeholder">De kaart, op een telefoon ingeklapt</div>
          </lintje-tile>`,
        },
        {
          label: 'Leeg',
          html: `<lintje-tile heading="Aanvragen per uur" subtitle="Aanvragen per uur · vandaag · gearceerd = nog niet compleet" footnote="${FOOTNOTE}" state="empty" message="Geen gegevens voor deze selectie. Kies een ruimer tijdvak of een ander loket." expandable download></lintje-tile>`,
        },
        {
          label: 'Laden',
          html: `<lintje-tile heading="Aanvragen per loket" subtitle="Vandaag" footnote="${FOOTNOTE}" state="loading"></lintje-tile>`,
        },
        {
          label: 'Fout',
          html: `<lintje-tile heading="Wachttijd per uur" subtitle="Vandaag" footnote="${FOOTNOTE}" state="error" message="De bron reageerde niet. De cijfers van vandaag ontbreken." last-known="Laatst bekend: 11 min, gemeten om 07:45."></lintje-tile>`,
        },
        {
          label: 'Met een kerncijfer ernaast',
          note: 'Het slot `aside` zet het kerncijfer naast de inhoud.',
          html: `<lintje-tile heading="Bezetting loketten" subtitle="Vandaag · 184 van 200 posities" footnote="Bron: Dossierregistratie · waarde van 08:15">
            <p slot="aside" style="font: var(--text-kpi); font-variant-numeric: tabular-nums">92%</p>
            <div class="guide__placeholder">lintje-tile slot="aside" (layout H)</div>
          </lintje-tile>`,
        },
        {
          label: 'Rijen tot de rand',
          note: 'Met `flush` loopt een werklijst tot de rand van de tegel.',
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
          label: 'Met een eigen scrollvak',
          note:
            'Met `content-scroll` en een eigen hoogte scrolt de inhoud binnen de tegel. Het ' +
            'scrollvak is een Tab-stop met de titel van de tegel als naam, en de pijltoetsen scrollen.',
          html: `<lintje-tile heading="Toelichting per loket" content-scroll style="height: calc(6 * var(--space-10))">
            <lintje-prose data-html></lintje-prose>
          </lintje-tile>`,
          setup(stage) {
            stage.querySelector('lintje-prose').html = [
              'Amsterdam Centrum: twee balies dicht wegens scholing van nieuwe medewerkers.',
              'Rotterdam: de wachttijd liep op door een storing in het afsprakensysteem.',
              'Den Haag: extra balie open op dinsdag en donderdag tot 20.00 uur.',
              'Utrecht: de bezetting is volledig; de wachttijd ligt binnen de norm.',
              'Amsterdam Zuidoost: het servicepunt is verhuisd naar de begane grond.',
            ]
              .map((line) => `<p>${line}</p>`)
              .join('')
          },
        },
        {
          label: 'Zonder kerncijfer',
          html: `<lintje-tile heading="Zonder kerncijfer" subtitle="Dezelfde tegel zonder aside">
            <div class="guide__placeholder">geen aside</div>
          </lintje-tile>`,
        },
      ],
    },
{
      tag: 'lintje-tabs',
      wide: true,
      title: 'Wisselen tussen panelen binnen één pagina',
      specimens: [
        {
          label: 'Toestanden',
          note: 'Eén tab is actief, één heeft een teller en één is uitgeschakeld.',
          html: `<lintje-tabs label="Weergave van de opname">${PANELS}</lintje-tabs>`,
          setup: (stage) => tabs(stage),
        },
        {
          label: 'Een andere tab actief',
          note: 'Bekijk hem ook op een telefoon, smaller dan 768 px.',
          html: `<lintje-tabs label="Weergave van de opname, tweede">${PANELS}</lintje-tabs>`,
          setup: (stage) => tabs(stage, 'opmerkingen'),
        },
        {
          label: 'Elke tab een pagina',
          note: 'De tabs zijn een nav met links; de huidige draagt `aria-current`.',
          html: `<lintje-tabs label="Onderdelen van de opname">${PANELS}</lintje-tabs>`,
          setup: (stage) => tabs(stage, 'samenvatting', TABS.slice(0, 3)),
        },
        {
          label: 'Groot boven een paneel',
          note:
            'Met `variant="panel"` heeft elke tab een icoon, een uitleg en een label. ' +
            'Op een telefoon staat het icoon boven de naam en de uitleg eronder.',
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
          note:
            'De accordeonrij van de huisstijl: een lijn erboven en eronder, de pijl vooraan en de ' +
            'kop in de primaire kleur.',
          html: `<lintje-expander heading="Toelichting op de meting">
            <lintje-prose text="De wachttijd is de mediaan per kwartier, gemeten vanaf het betreden van de rij."></lintje-prose>
          </lintje-expander>`,
        },
        {
          label: 'Open',
          html: `<lintje-expander heading="Staat open bij het laden" open>
            <lintje-prose text="open is gereflecteerd, de kop is een echte knop en aria-expanded zegt wat hij doet."></lintje-prose>
          </lintje-expander>`,
        },
        {
          label: 'Als kaart',
          note: 'Met `card` is een losse uitklapper een omlijnd vlak op het oppervlak.',
          html: `<lintje-expander heading="Toelichting op de meting" card>
            <lintje-prose text="De wachttijd is de mediaan per kwartier, gemeten vanaf het betreden van de rij."></lintje-prose>
          </lintje-expander>`,
        },
        {
          label: 'Zonder eigen vlak',
          note: 'Met `flat` is een uitklapper in een tegel geen tweede kaart en heeft hij geen lijnen.',
          html: `<lintje-expander heading="Zonder eigen vlak (flat)" flat>
            <lintje-prose text="In een tegel is een uitklapper geen tweede kaart."></lintje-prose>
          </lintje-expander>`,
        },
        {
          label: 'Met acties',
          note: 'Het slot `actions` zet knoppen naast de titel, buiten de knop van de kop.',
          html: `<lintje-expander heading="Samenvatting" subtitle="AI-bewerking · 09:31" open>
            <lintje-icon-button slot="actions" icon="functioneel-refresh" label="Samenvatting opnieuw maken" variant="flat"></lintje-icon-button>
            <lintje-icon-button slot="actions" icon="functioneel-kruis" label="Samenvatting verbergen" variant="flat"></lintje-icon-button>
            <lintje-prose text="De ochtenddienst begint maandag om zes uur; de roostermaker is nog niet ingelicht."></lintje-prose>
          </lintje-expander>`,
        },
      ],
    },
    {
      tag: 'lintje-accordion',
      title: 'Uitklappers gestapeld als één lijst, met de lijnen van de lijst',
      specimens: [
        {
          label: 'Dicht en open',
          note: 'Meer rijen mogen tegelijk open staan. Verberg hier niets wat elke lezer nodig heeft.',
          html: `<lintje-accordion>${FAQ.replace('<lintje-expander heading="Welke documenten heb ik nodig?"', '<lintje-expander heading="Welke documenten heb ik nodig?" open')}</lintje-accordion>`,
        },
        {
          label: 'Met ondertitel',
          note: 'De ondertitel staat onder de titeltekst; de pijl blijft op de eerste regel.',
          html: `<lintje-accordion>
            <lintje-expander heading="Stap 1: Gegevens" subtitle="Afgerond op 3 oktober">
              <lintje-prose text="Naam, adres en het nummer bij de Kamer van Koophandel."></lintje-prose>
            </lintje-expander>
            <lintje-expander heading="Stap 2: Bijlagen" subtitle="2 van 3 toegevoegd" open>
              <lintje-prose text="Voeg de begroting toe. Het uittreksel en de kopie van het identiteitsbewijs staan er al."></lintje-prose>
            </lintje-expander>
            <lintje-expander heading="Stap 3: Controle" subtitle="Nog niet begonnen">
              <lintje-prose text="Je ziet alles nog een keer voordat je verstuurt."></lintje-prose>
            </lintje-expander>
          </lintje-accordion>`,
        },
        {
          label: 'In een tegel',
          note:
            'In een `flush`-tegel reiken de rijen tot de rand en is de lijn van de laatste rij de onderrand. ' +
            'Met `level` volgt het kopniveau de tegel.',
          html: `<lintje-tile heading="Toelichting op de meting" subtitle="Peilmoment 1 oktober" flush>
            <lintje-accordion level="4">
              <lintje-expander heading="Hoe is de wachttijd gemeten?" open>
                <lintje-prose text="De wachttijd is de mediaan per kwartier, gemeten vanaf het betreden van de rij tot het bereiken van de balie."></lintje-prose>
              </lintje-expander>
              <lintje-expander heading="Welke locaties tellen mee?">
                <lintje-prose text="Alle loketten die in de meetperiode open waren."></lintje-prose>
              </lintje-expander>
              <lintje-expander heading="Waarom ontbreekt september?">
                <lintje-prose text="In september is er niet gemeten; de periode is gearceerd, niet nul."></lintje-prose>
              </lintje-expander>
            </lintje-accordion>
          </lintje-tile>`,
        },
        {
          label: 'Eén tegelijk open',
          note: 'Met `exclusive` sluit het openen van een rij de andere. De inhoud schuift dan onder de lezer vandaan.',
          html: `<lintje-accordion exclusive>${FAQ}</lintje-accordion>`,
        },
        {
          label: 'Alles openen',
          note: 'Met `toggle-all` staat er een tekstlink boven de rijen; die wordt “Alles sluiten” zodra alles open staat.',
          html: `<lintje-accordion toggle-all>${FAQ}</lintje-accordion>`,
        },
        {
          label: 'Alles open',
          note: 'Staat elke rij open, dan zegt de tekstlink “Alles sluiten”.',
          html: `<lintje-accordion toggle-all>${FAQ.replaceAll('<lintje-expander heading=', '<lintje-expander open heading=')}</lintje-accordion>`,
        },
        {
          label: 'Rij met acties',
          note: 'Het slot `actions` van een rij zet knoppen naast de titel, buiten de knop van de titel.',
          html: `<lintje-accordion>
            <lintje-expander heading="Samenvatting" subtitle="AI-bewerking · 09:31" open>
              <lintje-icon-button slot="actions" icon="functioneel-refresh" label="Samenvatting opnieuw maken" variant="flat"></lintje-icon-button>
              <lintje-icon-button slot="actions" icon="functioneel-kruis" label="Samenvatting verbergen" variant="flat"></lintje-icon-button>
              <lintje-prose text="De ochtenddienst begint maandag om zes uur; de roostermaker is nog niet ingelicht."></lintje-prose>
            </lintje-expander>
            <lintje-expander heading="Actiepunten">
              <lintje-icon-button slot="actions" icon="functioneel-refresh" label="Actiepunten opnieuw maken" variant="flat"></lintje-icon-button>
              <lintje-prose text="Drie acties zijn verdeeld; de planning van oktober staat bovenaan."></lintje-prose>
            </lintje-expander>
          </lintje-accordion>`,
        },
      ],
    },
    {
      tag: 'lintje-split-pane',
      wide: true,
      title: 'Twee panelen met een verschuifbare verdeling',
      specimens: [
        {
          label: 'Rust',
          note: 'Wijs de scheiding aan, geef hem focus of sleep hem.',
          html: `<lintje-split-pane start-label="Brontekst" end-label="Vertaling">${SPLIT}</lintje-split-pane>`,
        },
        {
          label: 'Onthouden onder een sleutel',
          note: 'Met `storage-key` onthoudt de verdeling haar grenzen onder een sleutel.',
          html: `<lintje-split-pane start-label="Brontekst" end-label="Vertaling" storage-key="lintje-demo-vertalen" value="35">${SPLIT}</lintje-split-pane>`,
        },
      ],
    },
  ],
}
