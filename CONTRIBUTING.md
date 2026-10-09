# Bijdragen

Hoe je bijdraagt, en het recept voor het schrijven of wijzigen van een component. Elk onderdeel
van Lintje is een standaard custom element, geschreven met [Lit 3](https://lit.dev); er is één
implementatie, en elke host laadt dezelfde bundel. De uitgangspunten van het ontwerp staan in
[`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md), het gebruik van de tags op een pagina in
[`docs/guides/`](docs/guides/start.md).

## Hoe je bijdraagt

Een bijdrage is welkom. Welke weg ze neemt, hangt af van wat ze verandert:

- **Een fout of een kleine verbetering** gaat direct als pull request.
- **Een nieuw component, een nieuwe variant of een wijziging in het ontwerp** begint als issue
  (het sjabloon *Voorstel*), vóór er code is. Het ontwerp verschuift niet in een pull request
  (regel 1), en een tweede component met dezelfde betekenis is een fout (regel 2): in het issue
  wordt afgesproken wat er komt.
- **Een kwetsbaarheid** meld je niet in een issue, maar zoals [`SECURITY.md`](SECURITY.md) zegt.

Een pull request slaagt voor `npm run typecheck`, `npm run lint`, `npm run format:check`,
`npm test` en `npm run build:elements` — de CI draait ze ook, in Chromium, WebKit en Firefox.
Het is bekeken in de styleguide, in licht **en** donker, op 1440 **en** 390 px; een nieuw element
of een nieuwe toestand heeft zijn specimen, en wat een host merkt staat in
[`CHANGELOG.md`](CHANGELOG.md).
Je hebt Node 20.19+ of 22.12+ nodig.

De projectregels staan in [`AGENTS.md`](AGENTS.md). De naam komt van de AI-assistenten die ze
ook lezen; ze gelden voor iedereen. Code en commentaar zijn Engels, de interface en de documentatie
Nederlands (regel 23).

Een bijdrage valt onder dezelfde licentie als Lintje, de [EUPL-1.2](LICENSE). Met een pull request
verklaar je dat je het recht hebt het werk zo in te brengen.

## Waar wat staat

```
src/
  core/        het basiselement, de gedeelde stylesheets, beweging, media, hostconfiguratie,
               de framestatus die shell, paginakop en filterbalk delen, sneltoetsen, links
  tokens/      tokens.css en base.css (elke root adopteert ze); themes.css en fonts.css
               (alleen op de pagina)
  icons/       renderIcon(), <lintje-icon>, het gegenereerde register, de iconenlader
  primitives/  button, icon-button, status-dot, skeleton, grid, grid-item, tile, badge,
               spinner, progress-bar, popover, tooltip; shared/place.ts (waar een zwevend vak staat)
  components/  één map per categorie (frame/, layout/, overlays/, actions/, content/,
               feedback/, inputs/, forms/, filters/, charts/, map/, tables/, chat/), met
               daarin één map per tag; components/shared/ voor wat categorieën delen, zoals
               charts/ (de renderfuncties van de grafieken; leaflet.ts: de basiskaart) en de
               focus-trap
  bundle/      index.ts — de losse bundel: importeert elke tag, exporteert de API;
               core.ts (de host-API zonder tag), één bestand per categorie (frame.ts,
               charts.ts, …) en dev.ts — de ingangen van de bestanden die een pagina laadt
               in plaats van het geheel
  categories.json  de categorieën: de ene indeling van de tags (regel 20)
  types.ts     het datacontract
```

Een component heeft een eigen map in zijn categorie (regel 20); `components/shared/charts/` heeft
één map per soort grafiek, en de `index.ts` van elke laag staat in de root ervan.

**Van elk bestaat er precies één.**

- `core/host-config.ts` — de hostconfiguratie (`setHostConfig`, `scrollRoot`, `lockScroll`).
- `core/media.ts` — `MediaController` met `MOBILE` en `WIDE`.
- `core/shortcuts.ts` — het ene register van sneltoetsen van de pagina. Een component roept
  `registerShortcut()` aan in `connectedCallback` en de teruggegeven functie in
  `disconnectedCallback`; het luistert nooit zelf op het document.
- `primitives/shared/place.ts` — waar een zwevend vak staat: dat van de popover, de tooltip en
  de toggletip.
- `core/focus.ts` — de focus door shadow roots heen, en van wie de Escape is;
  `components/shared/focus-trap.ts` is de ene trap-stack die elk modaal ding activeert.
- `components/shared/dialog-close.css` — de ene sluitknop van een dialoog.
- `components/inputs/shared/field-foot.ts` — de ene voet van elk veld: de hint, of de
  melding die die vervangt.
- `renderBadge()` (`primitives/badge/badge.ts`) — de ene tekening van een badge, ook voor een root
  die een badge tekent zonder het element.
- `types.ts` — het datacontract, met de vormen van de grafieken en de applicatie-elementen
  opnieuw geëxporteerd vanaf waar ze gedeclareerd zijn.

Hoe je een imperatieve bibliotheek inpakt, staat bij de kaart in
[`src/components/shared/charts/README.md`](src/components/shared/charts/README.md).

## Het recept: een component schrijven

Vijf stappen. `primitives/button/button.ts` en `components/charts/kpi/kpi.ts` zijn de uitgewerkte
voorbeelden; lees er een naast deze lijst.

### 1. Het stylesheet

Eén `.css`-bestand naast het element (`primitives/tile/tile.css` voor `LintjeTile`), gewone
BEM-CSS met de `:host`-regels boven de `/* --- */`-scheiding (regel 24).

`shadowCss()` (`core/styles.ts`) herschrijft de selectors die een shadow root niet kan
matchen, zodat de regels onder de scheiding blijven zoals het ontwerp ze schrijft:

| zoals het ontwerp het schrijft | in de shadow root |
|---|---|
| `:root` | `:host` |
| `:root:not(X)` | `:host(:not(X))` — `:host:not(X)` matcht in Chromium **niet** |
| `[data-mode='dark'] .x` | `:host([data-mode='dark']) .x` |
| `@font-face` | vervalt — de pagina declareert de lettertypen |

Twee dingen die de transformatie niet kan, en jij wel moet doen:

- **De host is het layoutvak.** Geef hem `display` en `min-width: 0`, en geef
  het BEM-block erin `height: 100%` als het een gridcel moet vullen. Een grid-item
  heeft standaard `min-width: auto` en loopt dan over.
- **Een regel die in een ander component reikt.** De actie van de tegel is een
  `<lintje-icon-button>` met een eigen shadow root, dus een vervagende `opacity` van buitenaf
  zou vermenigvuldigen met elke die de knop zelf zet. Zie het gemarkeerde blok
  in `primitives/tile/tile.css` voor de vorm van de oplossing: van buitenaf alleen
  verbergen (`opacity: 0`); laat het zichtbare uiterlijk aan het component dat er eigenaar van is.
  Bereik een kindcomponent via zijn tag en attributen
  (`lintje-icon-button[variant='tile']`), nooit via een klasse erin.

### 2. De klasse

```ts
export class LintjeThing extends LintjeElement {
  static override styles = shadowCss(thingCss)        // or [a, b] for several files

  static override properties: PropertyDeclarations = {
    tone: { type: String, reflect: true },
    items: { attribute: false },
    open: { state: true },
  }

  tone: Tone = 'neutral'          // a default: a plain field, assigned in the constructor
  declare items?: Item[]          // no default: `declare`, so TS emits nothing

  protected override render(): TemplateResult {
    return html`<div class="lintje-thing">…</div>`
  }
}

define('lintje-thing', LintjeThing)

declare global {
  interface HTMLElementTagNameMap { 'lintje-thing': LintjeThing }
}
```

- **Geen decorators.** Alleen `static properties`, en `tsconfig.json` zet
  `useDefineForClassFields: false` — met `define`-semantiek zou een klasseveld
  de accessor van Lit overschaduwen en zou de property ongemerkt niet meer reactief zijn.
  Vite (esbuild) leest hetzelfde bestand, dus de build en de typecheck komen overeen.
  Annoteer
  `static properties` als `PropertyDeclarations`, anders leidt TypeScript een letterlijk
  type af dat de subklasse niet kan verbreden.
- **`define()`, niet `@customElement`** — het laat een tag die een andere kopie van de
  bundel al definieerde met rust, zodat twee bundels op één pagina niet botsen.
- **Overschaduw nooit een globaal HTML-attribuut** met een reactieve property: `title`,
  `id`, `slot`, `lang`, `style`, `dir`, `hidden`. De titel van de tegel is `heading`
  en die van het icoon `label`, omdat `title` op de host het hele
  ding een native tooltip zou geven.
- **Rijke data als property, platte configuratie als attribuut.** `.items`,
  `.trend`, `.data` (markeer ze `attribute: false`); `variant`, `size`, `span`,
  `state` als attributen, `reflect: true` als CSS erop sleutelt. Een server-gerenderde pagina
  geeft een rijke property als JSON-script-kind (`readDataSources()` in `core/element.ts`); een
  component doet er niets voor.
- **Een Boolean met standaardwaarde `true` is niet met een attribuut te sturen.**
  `?dividers=${false}` *verwijdert* alleen een attribuut, en een attribuut dat nooit gezet is
  vuurt geen `attributeChangedCallback`, dus de standaardwaarde blijft staan en de `false` gaat
  verloren. Bind zo'n property als `.dividers=${…}`. `?disabled` en `?hidden` zijn
  in orde: hun standaardwaarde is `false`.
- **Een maat waartegen een percentage moet resolven, staat op de host.**
  `lintje-skeleton` schrijft `width`/`height` op zichzelf en de glans erin
  vult die; op de binnenste span zou een `height: 100%` resolven tegen een host met
  height auto — nul.
- **Een nieuwe tag volgt regel 20**: map in zijn categorie, `categories.json`,
  `bundle/<category>.ts`, barrel, voor een view ook `LINTJE_VIEWS` en `types.ts`, en een eigen
  bestand in de build uit zijn `define()`. `bundle/entries.test.ts` bewaakt wat een categorie
  bereikt.
- **De broncode is de referentie.** Het manifest leest ook de slots, en de styleguide toont het
  resultaat onder het element. Zeg in de JSDoc wat een host niet kan raden: het formaat van een
  waarde, welk antwoord een event verwacht, een beperking. Eén regel per punt.

### 3. Slots

Een `<slot>` is `display: contents`, dus een lege voegt geen vak en geen flex-gap toe —
slots zijn veilig in een `gap`-layout. Een **wrapper die je rond een slot rendert**
is dat niet: de voetnoot van de tegel heeft een lijn erboven, dus de `<p>` blijft in de template
en wordt in plaats daarvan verborgen met `?hidden=`. De `<slot>` uit de template halen
zou erger zijn: een slot dat niet gerenderd wordt kan nooit zijn inhoud melden, dus
`slotchange` zou nooit meer vuren. `LintjeButton.onSlotChange` is het patroon.

### 4. Modus

Die krijg je vanzelf. `LintjeElement` bepaalt hem in de volgorde van
[`docs/guides/theming.md`](docs/guides/theming.md) en reflecteert hem op de host als
`data-mode`, waarop de token-overrides sleutelen. `this.resolvedMode` is reactief als de
*markup* moet veranderen (niet alleen de CSS); een view maakt `data.mode` beschikbaar door
`get dataSettings()` te overschrijven.

**Zet geen `color` op `:host`.** Elk element heeft een `:host`, dus een kleur daar
breekt de overervingsketen bij elke elementgrens en komt een `lintje-icon` in de
navigatie bijna zwart op marineblauw uit. Kleur hoort bij het block dat eigenaar is van
de tekst; `currentColor` doet de rest. `tokens/base.css` zegt hetzelfde.

### 5. Beweging

`core/motion.ts`: `durationMs(this, '--dur-draw')` leest de eigen duur van het ontwerp
uit het token *waar het element staat*, zodat een lokale override wordt
opgepikt — en het parseert de eenheid, omdat een CSS-minifier `900ms` schrijft als
`.9s`. `prefersReducedMotion()` is de andere helft; met verminderde beweging verschijnt het
ding meteen, het verdwijnt niet. Een intro die moet spelen waar hij te zien is,
gebruikt een `IntersectionObserver` op de host bij 35 % (`LintjeKpi`).

## Iconen

**In een component is een icoon `renderIcon`, nooit `<lintje-icon>`.** Het element
is een eigen shadow root, met een eigen kopie van de tokens, de reset en de
icoonregels erin geadopteerd en een eigen plek in de modus-ronde van het basiselement —
voor een glyph van een dozijn padcommando's. Dus een component importeert de functie en het
ene stylesheet dat de glyph nodig heeft, en tekent de `<svg>` in de root die het al heeft:

```ts
import { iconStyles, renderIcon } from '../icons/render'

static override styles = [iconStyles, shadowCss(thingCss)]

render() {
  return html`<button class="lintje-thing__action">
    ${renderIcon('functioneel-delta-omlaag', { size: 16 })} Meer
  </button>`
}
```

`renderIcon(name, { size, label, src, className, rotate, flip })` geeft een `TemplateResult`
van lit-html terug, dus het gaat direct in een template — ook als de hele
tak van een conditie (`${open ? renderIcon('functioneel-kruis', { size: 16 }) : nothing}`), waar
anders een geneste `html\`…\`` had gestaan. `rotate` en `flip` draaien de glyph met een
CSS-transform: `renderIcon('functioneel-delta-omlaag', { rotate: 180 })` is de chevron omhoog en
`renderIcon('functioneel-delta-rechts', { flip: 'horizontal' })` de chevron links — één icoon
dat de andere kant op wijst is hetzelfde icoon, geen tweede bestand. `className` zet een
BEM-klasse op de glyph (`lintje-select__icon`); een renderfunctie die een eigen icoon
tekent (`filters/shared/sentence.ts`) laat `iconStyles` over aan de componenten die hem
renderen. `<lintje-icon>` is publiek, voor een gewone HTML-pagina die tags schrijft in plaats van
templates, en tekent zelf via `renderIcon`: één resolutievolgorde, één set
regels.

Een glyph die binnenkomt *nadat* de pagina getekend is, tekent zichzelf opnieuw: `renderIcon` onthoudt
de namen die niets vonden en vraagt, als er een opduikt, elk verbonden element om
één keer te renderen (`redrawAllElements()`).

De regels voor een icoon staan in regel 11, de set in [`assets/README.md`](assets/README.md) en
hoe een pagina de iconen serveert in [`docs/guides/loading.md`](docs/guides/loading.md).

## Stijlen: wat waar wordt geadopteerd

Elk element adopteert drie soorten stylesheet, in deze volgorde:

1. `tokens/tokens.css` — de design tokens op `:host`, licht, donker en compact;
2. `tokens/base.css` — de reset, de focusring, `.visually-hidden` en de
   `@keyframes` (een keyframe werkt alleen in de root die hem gebruikt);
3. het eigen bestand of de eigen bestanden van het component.

`LintjeElement.finalizeStyles()` zet 1 en 2 vooraan, dus een subklasse declareert alleen
de eigen. `shadowCss()` houdt één `CSSResult` per bronstring en Lit houdt één
`CSSStyleSheet` per `CSSResult`, dus een bestand dat twee elementen allebei gebruiken wordt één keer geparsed
en door beide roots geadopteerd. Een component roept `shadowCss(x)` aan, niet `unsafeCSS(x)`,
anders krijg je een tweede stylesheet voor dezelfde bytes; alleen CSS zonder `:root` of
`[data-mode]` mag één keer als constante op moduleniveau door `unsafeCSS`, zoals in
`components/shared/charts/shared/chart-styles.ts`.

**Bind nooit het `style`-attribuut.** De host stuurt `style-src 'self'`, wat
zowel het attribuut als een `<style>`-blok dekt: de browser zet het en
gooit de declaraties weg, dus een `style="top: ${y}px"` — en `styleMap()`,
waarvan de eerste commit datzelfde attribuut is — verdwijnt zonder foutmelding. Een waarde
die de data bepaalt (een plek, een kleur, een hoogte, een vertraging per item) gaat via
`styleProps()` (`core/style-props.ts`), dat hem met het CSSOM schrijft; een waarde
die altijd hetzelfde is, is een klasse in het eigen stylesheet van het component.
`core/style-props.test.ts` faalt op elke template die `style` weer bindt.

De tokens landen op elke `:host`, geneste elementen inbegrepen. Dat is bewust:
de waarden zijn gelijk, dus het kost niets, en het is wat
`<lintje-tile mode="dark">` één element op een lichte pagina van modus laat wisselen.

## Bouwen en controleren

De commando's staan in de [`README`](README.md), wat de build oplevert in
[`docs/guides/loading.md`](docs/guides/loading.md), de styleguide en de voorbeeldapplicaties in
[`examples/README.md`](examples/README.md).

`tokens.css` is de enige plek waar een tokenwaarde bestaat. Het eigen stylesheet van elk component is
`?inline` en reist mee in de module, dus daar is niets te scopen en niets te
minifyen.

De styleguide is de referentie: een wijziging aan een component wordt daar gecontroleerd, in licht
**en** donker, op 1440 **en** 390 px.

## Uitbrengen

Een release is een tag. Wat een host merkt, komt tijdens het werk in [`CHANGELOG.md`](CHANGELOG.md)
onder `[Unreleased]`, een brekende wijziging met **Brekend:** ervoor. Uitbrengen is dan:

```bash
npm run release 0.2.0            # [Unreleased] wordt [0.2.0] - datum, package.json neemt de versie, één commit
```

Die commit gaat als pull request naar `main`. Staat hij daar, dan is de tag de release:

```bash
git fetch origin && git tag v0.2.0 origin/main && git push origin v0.2.0
```

De workflow weigert een tag die niet gelijk is aan de versie in `package.json` of geen sectie in
de changelog heeft, draait dezelfde checks als `check.yml`, publiceert het pakket `lintje` op npm
en maakt de GitHub-release met de tarball en die sectie als tekst. Een versie is
[Semantic Versioning](https://semver.org/lang/nl/): vóór 1.0 verhoogt een brekende wijziging het
tweede getal.

## Tests

Wat getest wordt, volgt uit waar het gedrag woont, niet uit wat iemand toevallig opviel. Drie
lagen:

| Laag | Bestand | Wat | Voor wie |
|---|---|---|---|
| Unit | `*.test.ts`, in happy-dom | rekenwerk, toestand, events, markup | elk component |
| Styleguide | `bundle/styleguide.browser.test.ts` | elk specimen getekend, in licht en donker, op 1440 en 390 px, met axe | elk specimen, vanzelf |
| Browser | `*.browser.test.ts` | wat layout, echte focus of een aanwijzer nodig heeft | per mechanisme, zie hieronder |

**Een browsertest hoort bij een mechanisme, niet bij een component.** Gedrag dat componenten
delen, heeft één contract in `src/bundle/contracts/`, met een tabel van elk element dat het
mechanisme gebruikt; `bundle/` mag elke laag importeren, dus ook de schil staat in de tabel.

- `dialog.browser.test.ts` — elke gebruiker van `FocusTrap`: de focus gaat erin, Tab blijft
  erin, Escape sluit, de focus keert terug naar de trigger, en `aria-labelledby` en
  `aria-describedby` vinden hun doel in de eigen root.
- `popover.browser.test.ts` — elk zwevend paneel aan een anker: het staat aan zijn anker,
  binnen het venster, niet afgesneden door een scrollende voorouder; Escape geeft de focus terug
  aan het anker, Tab voorbij het laatste bedieningselement en een focus elders sluiten het, een
  klik erin niet.
- `focus-handoff.browser.test.ts` — wanneer het bedieningselement met de focus verdwijnt, landt
  de focus op een benoemde buur, nooit op `body`.
- `breakpoint.browser.test.ts` — wat onder 768 px van weergave wisselt (regel 9): per element de
  markering van de andere weergave, niet alleen een andere hoogte.
- `sticky.browser.test.ts` — wat plakt: het houdt zijn hoogte vrij als scroll-padding, en een
  bedieningselement dat de focus krijgt, staat er niet onder.

Een nieuw element dat een mechanisme gebruikt, krijgt een rij in diens tabel, geen eigen bestand.
Een component krijgt alleen een eigen `*.browser.test.ts` voor een mechanisme dat het zelf heeft:
de selectie van de teksteditor, slepen, media, de `field-sizing`-fallback.

Een contract toetst wat een host of gebruiker merkt: focus, events, wat zichtbaar is en waar het
staat ten opzichte van iets anders. Geen pixelwaarden die de CSS al vastlegt. Een rij die vandaag
faalt, staat in de `KNOWN`-lijst van haar bestand met een regel in
[`docs/OPEN_ISSUES.md`](docs/OPEN_ISSUES.md); een entry die nergens meer op past, laat de test
falen, zodat de fix hem weghaalt.

## Events

`this.emit()` (`core/element.ts`) stuurt één `CustomEvent`, bubbling en composed, zodat het het
element verlaat en de host bereikt; `emitLocal()` is alleen bubbling en stopt bij de shadow root die
het onderdeel bevat. Wat een host ervan ziet en hoe hij antwoordt, staat in
[`docs/guides/events.md`](docs/guides/events.md); welke tag wat stuurt, staat in de referentie van de
styleguide, gelezen uit de `emit()`-aanroepen.

```ts
@click=${() => this.emit('lintje-tile-expand')}
@click=${() => this.emit('lintje-values-change', values)}
```

- **De naam zegt welke soort het is**: een staat die de host bijhoudt is `lintje-<name>-change`
  (`lintje-values-change`), een verzoek is `lintje-<what>-<verb>` of een kaal werkwoord als het
  element zelf het onderwerp is (`lintje-row-click`, `lintje-navigate`, `lintje-close`). Een
  `click` op een echte `<button>` in de shadow root gaat de grens al over; stuur die niet opnieuw.
- **Verzin nooit een event waarvoor een datavorm geen veld heeft**: `KpiData` heeft geen klik, dus
  `lintje-kpi` stuurt niets.
- **Een onderdeel praat met zijn eigenaar via een niet-composed event** (`lintje-change`,
  `lintje-filters-reset`, `lintje-sheet-close`, …). Zo komt één gebruikersactie niet twee keer
  bij de host aan.
- **Een element dat een onderdeel opwerpt, stopt de composed events van dat onderdeel**: de grafiektegel, de
  kaarttegel en de datatabel roepen `stopPropagation()` aan op de events van hun tegel en hun modal,
  de shell op die van zijn toast. Eén actie is dan één regel in het log van een host.
- **Een invoer is form-associated** (`LintjeInputElement`): in een native `<form>` post hij wat
  `formEntries()` (`components/forms/form/controls.ts`) van zijn waarde maakt. Een bedieningselement waarvan de geposte
  vorm afwijkt van zijn waarde, overschrijft `postedValue`.
- **`name` is de poort van een invoer** (`announce()` in `components/inputs/shared/input.ts`). Een
  bedieningselement stuurt altijd de niet-composed `lintje-change`; met een `name` stuurt het ook de
  composed `lintje-values-change` `{ [name]: value }`. Daarom kan een component een
  bedieningselement in zijn eigen root tekenen zonder dat er een verdwaalde wijziging bij de host komt. `lintje-form` stopt
  elke `lintje-values-change` van binnenuit: de velden van een formulier zijn geen filters.
- **Een link is een echte `<a href>`** die de browser volgt. Roep bij een normale klik (`isPlainClick`,
  `core/links.ts`) `this.followLink(href, event)` aan: dat stuurt `lintje-navigate` `{ href }`
  en annuleert de klik alleen als de host het event annuleerde. Zonder klik om te volgen (een
  toets) gaat het zelf naar het adres.
