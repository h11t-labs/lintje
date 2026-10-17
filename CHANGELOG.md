# Changelog

Wat er veranderde, per versie, de nieuwste bovenaan. Elke pull request, ook een kleine, schrijft
zijn regel in een eigen bestand in [`changes/`](changes/), `<nummer>-<titel>.md`, met zijn nummer
erachter: `(#12)`; `npm run release` zet ze hier bij elkaar. De opzet volgt
[Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) en de versies
[Semantic Versioning](https://semver.org/lang/nl/): de kopjes zijn de zes soorten van Keep a
Changelog in het Nederlands (Toegevoegd, Gewijzigd, Verouderd, Verwijderd, Opgelost, Beveiliging).
`src/types.ts` en de attributen, properties en events van de tags zijn het contract: er één
hernoemen of verwijderen is een brekende wijziging en begint hier met **Brekend:**.

## [Unreleased]

## [0.6.0] - 2026-10-16

### Toegevoegd

- De kaart neemt `size`, op de kaart en per laag: `min`/`max` zetten het pixelbereik van een
  punt (standaard 3–18), `by: 'none'` tekent elke punt op `min` zonder groottesleutel in de
  legenda, en `zoom: true` laat de straal met de zoom meegaan, tussen 2 en 28 px. Nieuw specimen
  *Kaart · puntgrootte met de zoom*. (#225)
- Een kaartreeks krijgt met `seriesStyles` een eigen stijl — een datakleur of `neutral` (het
  vergelijkingsgrijs), en/of een van de zeventien vormen — los van haar naam; punten, legenda en
  selectiepaneel tekenen dezelfde stijl. Een reeks zonder stijl is wat ze was. Nieuw specimen
  *Kaart · reeksen in één kleur*. (#224)
- Een stap van `lintje-stepper` kan eigen inhoud dragen: een stap met een `value` heeft een slot
  met die naam. In de kolom staat de inhoud van elke stap onder zijn kop; in de rij en op een
  telefoon alleen die van de huidige stap, onder de rij of de balk. De referentie noemt een slot
  met een gebonden naam, zoals dat van `lintje-tabs`, als één slot per item. (#143)

### Gewijzigd

- De build minificeert de modules en de ingesloten CSS: `lintje.js` gaat van 1,9 naar 1,5 MB (gzip van 468 naar 389 kB), `tag/map.js` van 624 naar 438 kB. De CSS wordt niet omlaag vertaald: `color-mix()` en `oklch()` blijven zoals ze geschreven zijn. (#221)
- De unittests delen één happy-dom-venster per worker en `npm run test:unit` draait daardoor bijna drie keer zo snel; `src/bundle/unit-setup.ts` zet vóór elk bestand de pagina terug, en een test die een lege registry nodig heeft of een module mockt, draait in het project `unit-window`. (#221)
- Een klikbare rij van `lintje-data-table`, een teken in `lintje-chart` en een markering op
  `lintje-map` met een `href` gaan erheen na hun event, en een selectie ongedaan maken gaat naar
  `clearHref`. Een klik met een modifier of de middelste knop opent de `href` in een nieuw tabblad.
  Een host die zelf navigeert of `selectedId` zet, annuleert het event. (#149)
- Geen hover neemt nog `--color-bg-selected`; een herkende term met toelichting toont onder de
  muis een dikkere lijn. (#139)

### Opgelost

- Een brede tabel krijgt geen verticale scrollbalk meer naast zijn smalle horizontale: het vak
  scrolt alleen opzij. (#226)
- De legendatabel onder een taart houdt haar kolommen ook in Edge: de rijkop is weer een
  tabelcel, zodat aantal en % onder hun eigen kop staan; een lang etiket springt in onder zijn
  eerste regel, met het kleurblokje op die regel. (#222)
- Een schermlezer hoort de nieuwe waarde na − of + in `lintje-number-input`, de beschrijving van
  een gekozen optie in `lintje-segmented` en een wisselende verbinding in
  `lintje-recording-status`; een cel met een toon in `lintje-description-list` draagt het woord
  van haar teken verborgen vóór de waarde. (#196)
- De focusring van een optie van `lintje-segmented` naast de gekozen optie is aan alle kanten heel,
  en de knop van `lintje-file-upload` houdt zijn focus tijdens en na een sleep over de pagina.
  (#191)
- Een groep in de navigatiebalk die een tik opende, sluit niet meer meteen weer als er een muis
  op de pagina staat: het verlaten van de balk sluit alleen een groep die onder de muis openging.
  (#182)
- `lintje-expander`, `lintje-explainer` en `lintje-filter-zone` laten hun inhoud los zodra hun
  hoogte staat; ze wachten alleen op een overgang van de hoogte die echt loopt. (#179)
- Na wissen leest `lintje-find` geen melding meer voor die nog onderweg was. `lintje-notifications`,
  `lintje-log-viewer`, `lintje-find`, `lintje-card` en `lintje-card-list` spreken via de gedeelde
  live-regio, dus ook dezelfde melding twee keer na elkaar klinkt twee keer. (#158)
- Een element dat zijn vorm kiest naar zijn eigen breedte, meet een frame later, zodat de browser
  geen `ResizeObserver`-lus meer als fout van de pagina meldt; een lusfout laat de browsertest
  falen. Onder verminderde beweging loopt alleen opacity nog, en staan de focusring en een
  kleurwissel meteen. (#152)
- `lintje-segmented` blijft een rij als hij hoogstens één pixel te breed meet: bij zoom in Safari wisselde hij eindeloos tussen rij en kolom tot de pagina werd afgeschoten. In de transcriptie-app delen "Soort gesprek" en "Opnemen met" de breedte niet meer 50/50, zodat de soorten naast de recente opnames op één rij blijven. (#151)
- Na nieuwe data sluit de tooltip van het toetsenbord en wordt de statusregio leeg; de volgende
  pijltoets begint binnen de nieuwe data. Een taart neemt altijd de focus en loopt met de pijltjes
  door haar delen, en zonder legendatabel staat de gewone legenda boven de taart. (#150)
- Op een aanraakscherm sluit een tweede tik op een geopende groep in de navigatiebalk hem weer. Muis,
  toetsenbord en "Menu" werken zoals ze deden. (#148)
- Een bestand dat naast de dropzone van `lintje-file-upload` valt, opent niet meer in de browser:
  zolang de upload bestanden aanneemt, doet zo'n bestand niets en zegt de aanwijzer buiten de zone
  dat loslaten niet kan. De zone wijst zichzelf aan zolang je sleept en vult zich pas als het bestand erboven hangt. (#147)
- Een melding klinkt ook als ze er meteen staat, of voor de tweede keer. Het woord van het wachtvak
  van `lintje-streaming-text` wordt voorgelezen, en dezelfde melding twee keer na elkaar klinkt
  twee keer in `lintje-tag-input`, `lintje-file-upload`, `lintje-repeater` en
  `lintje-sortable-list`. (#146)
- De terugzetknop van een veld noemt het veld na zijn eigen woorden, en `reset-label` werkt nu
  ook op `lintje-text-input` en `lintje-textarea`. Een natief veld in `lintje-form` krijgt bij een
  fout de melding als `aria-description`. (#145)
- In donker halen de stip van een gekozen keuze in een menu, de balk van een gekozen rij, de lijn
  onder een term, een link in een getinte cel van `lintje-description-list`, de vulling en het
  spoor van `lintje-progress-bar`, een foutstap in `lintje-stepper` en de tijdcode op een getint
  fragment hun contrast. (#139)
- De stippellijn "lage zekerheid" van `lintje-highlight` haalt in licht 3:1 op haar tint. (#139)
- De focusring haalt in licht 3:1 op elke lichte ondergrond, ook op de waas van de hero: hij is
  daar een donkerder oranje; in donker blijft hij het oranje van de huisstijl. (#139)
- Het omgevingslabel haalt 4,5:1: de tekst is bijna-zwart op het oranje accent en blijft wit op
  het blauw van defensie. (#139)
- Een gestapelde staaf leest zijn percentages ook in donker: "Overig" is daar iets lichter, en een
  label op de rest neemt de tekstkleur. (#139)
- Escape sluit een toast alleen nog vanuit de toast zelf, en de Escape die een opgetilde verdeling
  van `lintje-split-pane` terugzet, sluit geen venster eromheen meer. (#139)
- `lintje-popover` vraagt ook om te sluiten als de focus hem verlaat (`lintje-close` met
  `reason: 'focus'`); de linkdialoog van `lintje-text-editor` en de panelen van
  `lintje-data-table` laten de focus dan waar hij heen ging. (#139)
- De trendlijn van een staafgrafiek breekt bij een ontbrekende waarde in plaats van die te
  overbruggen; een losse bekende waarde is een stip, zoals in de lijngrafiek. (#139)
- Een invoer met `required` houdt een native formulier tegen zolang hij leeg is, voor elke invoer
  en niet alleen tekst, getal en textarea, met de melding van de browser bij het
  bedieningselement. (#139)

## [0.5.1] - 2026-10-15

### Gewijzigd

- Donker houdt de volgorde van licht: menu onder pagina onder oppervlak. De pagina ligt halverwege
  het menu en het oppervlak, zodat een band, een tegel en de logobalk erop staan; de hero-waas
  ligt onder de pagina, zoals in licht. (#137)
- Een inhoudsfout in een tegel, een tabel of een kerncijfer is de toon fout, zoals de losse melding; de foutsamenvatting en een geweigerd bestand nemen het teken en de tint van die toon. Secundaire tekst is één token, `--text-small` (`--text-meta` en `--text-tile-sub` blijven als alias). De duren van de menurail hangen aan `--dur-rail`, de maten van hero en transcript staan op de tekstschaal, en de ruimte tussen een icoon en zijn woord is `--space-2`. (#136)
- Wat nog openstaat, staat als issue op GitHub; `docs/OPEN_ISSUES.md` is weg. Een issue met het label
  `agent` zegt wat er mis is, hoe het moet zijn, waar het zit en wanneer het klaar is. (#135)

## [0.5.0] - 2026-10-14

### Toegevoegd

- `<lintje-log-viewer>` toont logregels die live binnenkomen en volgt de nieuwste tot je omhoog
  scrolt; een balk eronder telt wat erbij kwam. Filteren op niveau, zoeken met `lintje-find`,
  kopiëren en downloaden, het venster leegmaken, acties van de host, en ook regels zonder tijd of
  niveau en ruwe uitvoer. (#49)

### Gewijzigd

- Elke grafieklegenda schakelt op dezelfde manier. Elke reeks en elke referentielijn (drempel,
  mediaan) gaat uit vanuit de legenda, ook in de gestapelde staaf, de grafiek met twee assen, het
  histogram en de radar; een reeks die alleen staat alleen als er een referentielijn naast staat.
  De heatmap gebruikt dezelfde legenda boven het rooster, en een uitgezette klasse dimt haar
  cellen. Wat je uitzet vervaagt, recht en heen en terug even lang, of krimpt in een stapel of
  groep, en tekent niet opnieuw in; de assen blijven staan. (#57)

### Opgelost

- De schetsen op de kaartjes van de stijlgids kloppen met hun element: de stepper is
  horizontaal, het filterblad schuift van onderen in, de lijst markeert alleen de gekozen rij, het
  label van een filter toont zijn stip en de voet heeft kolommen; geen rij wordt meer afgesneden
  en de lichtste vakjes en vlakken zijn ook in donker te zien. (#92)
- Het doel van een kerncijfer met een balk als schaal staat boven de balk naast zijn streep, zodat
  het label nooit meer over het eindgetal van de schaal loopt. (#64)
- Een klik op een stapknop of de wisknop van `lintje-find` geeft die knop ook in Safari de focus,
  zodat Enter of spatie verder stapt en de focus niet terugvalt op de pagina. (#50)

## [0.4.0] - 2026-10-13

### Toegevoegd

- `lintje-chart` tekent het spinnendiagram (`kind: 'radar'`): het profiel van een tot drie
  lagen over vijf tot acht assen op een schaal, met een grijze vergelijking en een norm. Van
  meer lagen vult alleen de laag die de lezer in de legenda aanwijst; een ontbrekende waarde
  breekt de lijn en arceert de spaak; onder 768 px wordt elke as een rij staven. (#46)
- De stijlgids heeft een groep Fundament met drie pagina's, Kleur, Typografie en Maat en
  beweging: elk token dat een component mag noemen, met zijn waarde in de gekozen modus en het
  thema en zijn commentaar uit `tokens.css`, en getekend: kleuren als vlak, de tintladders als
  tegels, hoeken, focus en schaduwen als vorm, bewegingen om af te spelen. De build schrijft de
  tokens in `tokens.json`.
  `lintje-token-value` is terug: het toont wat een token op zijn plek berekent, een kleur als
  staal en hex, een lengte in rem ook in px en een tekststijl als dikte, maat en regelhoogte;
  `no-swatch` laat het staal weg. (#45)
- `<lintje-find>` vindt een woord in wat al op het scherm staat en gaat langs de treffers: één
  vak met de teller, vorige, volgende en wissen erin, zodat typen niets laat verschuiven.
  Transcriptie gebruikt het in plaats van het eigen zoekveld. (#43)

### Gewijzigd

- Elke tag is een bouwsteen of samengesteld, met de basis (tokens, iconen, gedrag) eronder; de
  stijlgids toont bij elke tag zijn laag, waaruit hij bestaat en waarin hij gebruikt wordt.
  `src/primitives/` is opgeheven: elke tag staat in de map van zijn categorie. Voor een host
  verandert er niets. (#47)
- De pipeline draait de browsertests per browser in een eigen job, naast de andere checks, en
  binnen een browser meerdere testbestanden tegelijk; de stijlgidstest wacht niet meer op een
  animatie die al afgelopen is, en de release roept dezelfde checks aan. (#39)
- De changelogregel van een pull request staat in een eigen bestand,
  `changes/<nummer>-<titel>.md`, niet meer onder `[Unreleased]` in `CHANGELOG.md`; twee pull
  requests botsen zo niet meer. `npm run release` zet de bestanden per kop bij elkaar, de nieuwste
  bovenaan, en haalt ze weg. (#36)

### Opgelost

- De browsertests in Firefox draaien hun bestanden na elkaar. Firefox houdt de pointer capture van
  de muis over al zijn pagina's vast, zodat een klik in een ander testbestand op een gesleepte greep
  landde en de sleeptests van `lintje-split-pane`, `lintje-sortable-list` en de schil af en toe
  faalden. (#48)
- `lintje-map` op papier: kreeg de kaart haar papiermaat vóór het bericht dat de pagina naar
  papier gaat, dan toonde ze alleen het midden van wat op het scherm stond; nu altijd het hele
  gebied. (#39)

## [0.3.0] - 2026-10-12

### Toegevoegd

- `lintje-segmented` toont een aantal per optie: `count` op `FilterOption` wordt de tellerbadge
  achter het label, zoals in `lintje-tabs`. (#33)
- Welke grafiek welke vraag beantwoordt (`CHART_KINDS`, `CHART_QUESTIONS`): per soort haar
  Nederlandse naam, de vraag van de lezer, waarvoor je haar neemt en wanneer een andere beter
  past. Het principe staat in `DESIGN_SYSTEM.md`; de stijlgids kiest er een grafiek mee. (#25)
- `dist-elements/data-types.json`: de types uit de broncode veld voor veld, met hun
  toelichting, en per variant van een union op `kind` een eigen lijst (`scripts/manifest.mjs`).
  (#25)
- **`lintje-dialog`, het kleine venster** voor een vraag of een kort formulier, naast
  `lintje-modal`, het grote voor inhoud. `alert` maakt er een `alertdialog` van zonder
  sluitknop, `persistent` laat Escape en de achtergrond niets vragen, `wide` geeft de breedte van
  een formulier, en met `busy` wacht de knop van het antwoord terwijl de andere uit staan. De
  knoppen komen in `actions`; de focus gaat naar wat `autofocus` heeft. De bevestiging, de sessie
  die verloopt en de sneltoetsen zijn recepten ervan in de stijlgids. (#31)
- `lintje-data-table` als werkblad: een kolom met `format: 'label'` tekent een waarde als badge
  met woord, toon en icoon (`labels`); `totals` geeft de totaalrij van de host en `groupBy` zet
  de rijen per waarde onder een kop, met `groupTotals` als subtotalen en `groupsPerPage`; met
  `detailFields` of een verborgen kolom klapt elke rij open voor wat haar kolommen niet tonen,
  op desktop en telefoon dezelfde lijst. "Filters wissen" bij twee of meer filters,
  "Terugzetten naar standaard" in de kolomkiezer, en `lintje-pagination` zegt met
  `filtered-from` dat een filter de telling versmalde. `lintje-badge` krijgt `icon`. (#29)
- **Eén toonset.** `Tone` (neutraal, subtiel, bezig, gelukt, let op, fout, informatie, aandacht,
  live), `WorkState` (wachtrij, bezig, onderbroken, klaar, mislukt, geannuleerd) en
  `ContentStateKind` staan één keer, in `primitives/shared/tone.ts`, en `src/types.ts` exporteert
  ze. `lintje-status-dot` neemt elke toon naast zijn vier leveringswoorden; `lintje-card` en
  `lintje-description-list` elke toon met haar glyph; `lintje-announcement` kent de soort
  `error` (te sluiten, anders dan een storing); `lintje-toast` kent `info` en `warning`, en
  `shell.showToast(text, kind)` geeft de soort door; `lintje-kpi` heeft `message` en
  `last-known`, zoals elke tegel (`KpiData` erft `ContentState`). (#26)
- De paginakop klapt acties die niet op één regel passen in naar één menu "Meer", vóór de
  knoppen die blijven staan; de laatste knop, de primaire, blijft altijd in het zicht en een menu
  met één rij bestaat niet. Gemeten, niet per breekpunt (`components/shared/overflow.ts`). (#23)
- `lintje-checkbox-group`: meer keuzes onder één label, een vinkje per optie, met één hint en
  één foutregel voor de groep, zoals de radiogroep. De waarde is `selected`, de aangevinkte
  waarden in de volgorde van de opties; een `description` staat onder haar optie. (#19)
- `lintje-sub-nav` krijgt `expanded`: elk niveau staat er, niet alleen dat op het pad van de
  lezer. Daarmee is het submenu ook de inhoudsopgave van een lange pagina; hoe een host hem
  vult, de sectie in beeld volgt en naast de tekst laat plakken, staat in de nieuwe handleiding
  `docs/guides/page-contents.md`. (#24)
- Het gestapelde vlak als grafieksoort (`kind: 'stacked-area'`): de onderverdelingen van één
  variabele in haar tintladder, de donkerste onderaan; een ontbrekende waarde breekt haar laag en
  alles erboven af, de lagen eronder blijven staan. Een laag aan- of uitzetten laat de as staan en
  laat de laag groeien of krimpen over het nieuwe token `--dur-layer`. De tooltip sluit af met
  een totaal en de tabel krijgt een kolom Totaal. Daarvoor krijgt `TooltipRow` een `divider` en
  `core/motion.ts` een `easing`. (#11)
- Een lijngrafiek toont gebeurtenissen (`events`): een genummerd vierkantje boven de categorie,
  met de tekst in een lijst onder de grafiek, in de tooltip, de tabel en de CSV. (#12)
- Afdrukken geeft een nette pagina, staand en liggend: altijd licht en wit, met een eigen marge,
  zonder telefoonvorm, bediening of beweging, met het embleem en de naam van de applicatie
  bovenaan, elke tegel heel op een vel en een tabel die tussen zijn rijen breekt (`breakable` op
  `lintje-tile`). Een kerncijfer toont op papier zijn waarde, ook als het nog niet in beeld was,
  en een kaart het gebied dat de lezer zag. (#22)
- De foutpagina (`lintje-error-page`): de code met een teken voor geen toegang en een storing,
  een titel in woorden, de tekst, een slot voor een zoekveld of melding en een voor de knoppen,
  een referentie met kopieerknop en de lijst "Verder naar". De stijlgids toont niet gevonden,
  geen toegang, een storing en gepland onderhoud. (#18)

### Gewijzigd

- De stijlgids heeft een pagina per element: wat het is, de voorbeelden een per rij met hun naam
  ernaast en hun code in een expander (markup, script en JSON voor een pagina die een server
  rendert, gelezen uit wat het voorbeeld tekende), de referentie met de velden van `data`, waar het
  in de voorbeeldapplicaties staat en hoe je het laadt. De pagina van een categorie is een
  overzicht met een schets per element. `lintje-chart` toont één soort tegelijk, gekozen op de
  vraag van de lezer, met haar staten eronder. De delen van een elementpagina staan in tabs
  (`&tab=`). `#el-…` leidt naar de nieuwe pagina. (#25)
- **Brekend:** `lintje-confirm-dialog`, `lintje-session-expiry` en `lintje-shortcuts` zijn weg:
  een bevestiging is een `lintje-dialog alert` met de knoppen van de host, een sessie die
  verloopt een `lintje-dialog alert persistent` en het teruggezette concept een
  `lintje-announcement`. `lintje-modal` verliest `narrow` (een formulier is een
  `lintje-dialog wide`), heeft geen kop "Vergroot" meer en zet `csv` en `png` standaard uit. Het
  overzicht van de sneltoetsen is een `lintje-dialog` die de pagina vult uit `shortcuts()`.
  Modal, dialoog en drawer delen hun scrollvergrendeling, focusval en Escape
  (`components/shared/dialog.ts`). (#31)
- De voorbeeldapplicatie Meldingen gebruikt de tabel als werkblad: Ernst en Status staan als
  label, alleen een hoge ernst gevuld, en een rij klapt open voor haar locatie en notitie. (#32)
- Het kopcommentaar van elke tag, dat de stijlgids onder "Over deze tag" toont, heeft één vorm,
  vastgelegd in `CONTRIBUTING.md`. De eventregels zijn compleet: ook `lintje-reset` van elk
  invoerveld en `lintje-seek` van de videospeler. (#30)
- De kop van `lintje-data-table` zegt alleen wat nu geldt: sorteerpijlen alleen op de gesorteerde
  kolom en elders onder de aanwijzer of met focus, en een gefilterde kolom draagt alleen haar
  gevulde trechter, zonder vlak of stip. De kolomkiezer is een stil icoon met drie kolommen
  (`functioneel-kolommen`, nieuw eigen icoon) en een tooltip in de kop van de laatste kolom, in
  plaats van het tandwiel. De telling staat één keer. Een naam die opent is donker,
  onderstreept onder de aanwijzer, en een drempel dichtbij is een teken en vet in plaats van een
  gele vulling. Sorteren en bladeren laten de kolommen staan: een kolom neemt de breedte van
  haar breedste waarde over alle rijen, en de sorteerpijlen staan boven elkaar. De kop van een
  filterbare kolom draagt een trechter, een nieuw eigen icoon (`functioneel-trechter`). (#29)
- De tegel stelt leeg en fout samen uit dezelfde blokken als `lintje-empty-state` en
  `lintje-announcement` (`primitives/shared/announcement-block.ts`, `empty-state-block.ts`), en
  alle drie de toestanden zijn een live-regio van de tegel: ook een tegel die leeg wordt, wordt
  uitgesproken, en het skelet van een grafiek zwijgt erin. Grafiek, kaart en tabel geven `state`,
  `message` en `last-known` aan de tegel. `renderChartEmpty`, `renderChartError` en
  `liveAnnouncement` zijn weg; `announcement.css` en `empty-state.css` zijn de blokken in
  `primitives/shared/`. (#27)
- **Brekend:** `lintje-progress-bar` zegt zijn staat met `state` (`busy`, `done`, `error`,
  `paused`), de staat van werk, in plaats van `tone` (`run`, `done`, `error`, `paused`); het type
  `ProgressTone` heet `ProgressState`. `lintje-job-list` en `lintje-list` zijn mee. (#26)
- **Brekend:** `lintje-announcement` heeft geen `compact` meer: een melding kiest haar marge naar
  haar eigen breedte, krap onder 560 px en ruim daarboven, op dezelfde grens als haar actie. Een
  `compact` dat blijft staan, doet niets. (#35)
- De telefoonvorm geldt alleen op een scherm: `MOBILE` is `screen and (max-width: 767px)`, en een
  host schrijft zijn eigen telefoonregels zo. (#22)

### Opgelost

- `lintje-data-table`: een tabel die breder is dan zijn plek en zijwaarts scrolt, is met het
  toetsenbord te bereiken; het scrollvlak krijgt dan de focus, een rol en de caption als naam,
  zoals het blok van `lintje-code` (WCAG 2.1.1). (#25)
- `lintje-map` gooit geen fout meer als de kaart weggaat terwijl een zoom nog loopt: Leaflet
  rondt de zoom af op een timer die `remove()` laat staan, en die las de weggehaalde kaart. (#20)

## [0.2.0] - 2026-10-10

### Toegevoegd

- `lintje-slot-picker`: een tijd voor een afspraak kiezen, de dagen naast elkaar met hun tijden
  als opties; een volle tijd blijft staan met het woord "Vol", een dag zonder tijden zegt dat.
  (#8)
- `lintje-time-input` opent een lijst met tijden van `min` tot `max`, om de `step` minuten, zoals
  het datumveld zijn kalender: met de klokknop of Alt+pijl omlaag, en te typen blijft het. (#8)
- `lintje-kpi` zet één kerncijfer op zijn schaal met `gauge`: een halve boog met het getal in de
  mond (`shape: 'arc'`) of een balk eronder (`shape: 'linear'`), met het doel gestreept. Het type
  `KpiGauge` staat in `src/types.ts`; `lintje-kpi-row` geeft het door. (#13)
- Het histogram als grafieksoort (`kind: 'histogram'`): klassen die elkaar raken, labels op de
  grenzen, een open laatste klasse, een mediaan en een drempel. (#9)
- `lintje-kpi` toont het verloop van zijn variabele met `sparkline`: een lijn met haar vlak in de
  kleur van de variabele, zonder assen, geschaald van de laagste tot de hoogste waarde; een
  ontbrekende waarde breekt de lijn en de beschrijving is het tekstalternatief. Het type
  `KpiSparkline` staat in `src/types.ts`; `lintje-kpi-row` geeft het door. (#15)
- Het spreidingsdiagram als grafieksoort (`kind: 'scatter'`): een reeks is een kleur en de vorm
  die die kleur op de kaart heeft, met een norm, datalabels voor de punten die de host noemt en een
  tabel met een rij per punt. (#10)
- **De kaart kent `controls`.** Een host zet elk onderdeel van `lintje-map` aan of uit: `zoom`,
  `wheel`, `drag`, `reset`, `lasso`, `circle`, `rect`, `scale` en `legend`. Zonder waarde staat
  alles aan behalve de tekenvormen. Nieuw is de schaalbalk rechtsonder: een ronde afstand met een
  beugel zo lang als die op de kaart, die met zoomen meeloopt. (#16)
- **Een gebied kiezen op de kaart.** Met `controls.lasso`, `controls.circle` of `controls.rect`
  staat onder de zoomknoppen een tekenvorm; bij twee of meer opent één selectieknop met een
  hoekje het menu van de vormen, en toont hij de vorm die in de hand is. Een vorm blijft in de
  hand na het tekenen — een nieuw gebied vervangt het vorige — tot een klik op de knop, Escape of
  de reset haar neerlegt. Slepen tekent het gebied in één beweging; klikken zet de hoeken van een
  lasso, het midden en de rand van een cirkel of twee hoeken van een rechthoek, en onderaan staat
  hoe. De kaart stuurt `lintje-area-select` met het gebied en de ids van alle marks erin — een
  rechthoek als lasso van vier hoeken —; een host bewaart het gebied in zijn URL en geeft het
  terug als `selectedArea`. Alleen wat helemaal in het gebied ligt telt; tijdens het tekenen licht
  dat op. Het gebied blijft staan tot het wordt weggeklikt in het paneel linksonder (op een
  telefoon onder de kaart), met Escape of met de resetknop, die het huisje vervangt en zicht,
  mark en gebied terugzet. (#16)
- **De legenda van de kaart leest per laag.** Eén regel per laag, ook bij één laag: haar naam
  met een vakje dat de laag aan en uit zet, haar sleutel — de klassen van 0 tot het maximum, drie
  cirkels met het bereik of een wig met het bereik — en haar eigen reeksen, elk een schakelaar;
  een kleur in twee lagen schakelt per laag. Meer dan drie lagen vouwen onder "Nog n lagen"; de
  vergroting toont alles, met het bereik per klasse en de cirkels genest op ware maat. Een mark
  die uitgaat krimpt of vervaagt, en komt van west naar oost terug. Op een telefoon is de kaart
  280 px hoog, met alle knoppen op de aanraakmaat. (#16)

### Gewijzigd

- **Brekend:** `lintje-chart-tile` heet `lintje-chart` en `lintje-map-tile` heet `lintje-map`,
  in de build `tag/chart.js` en `tag/map.js`. De typen volgen: `ChartTileData` wordt `ChartData`,
  `MapTileViewData` wordt `MapData` en `MapTileData` wordt `MapSpec`; een `ChatBlock` noemt
  `kind: 'chart'`. (#14)
- **De kaart is één kaart, op Leaflet.** Met of zonder `basemap` draagt Leaflet de kaart en tekent
  Lintje de data zelf in zijn svg, dus slepen, dubbelklik, knijpen en het wiel met Ctrl of ⌘
  werken overal gelijk; zonder die toets scrolt het wiel de pagina en zegt de kaart kort hoe het
  wel kan. Nederland staat in Web Mercator, zoals de wereld en elke ondergrond; de
  voorgeprojecteerde `assets/geo/world.json` en `netherlands.json` zijn weg. De knoppen op de
  kaart zijn compact (40 px) met een klikgebied tot het aanwijsdoel, en de legenda linksonder en
  de knop "Legenda" op een telefoon zijn weg: er is één legenda, boven de kaart. De
  bronvermelding van een ondergrond staat in de eigen tekstkleuren, ook in donker. (#16)
- **Het menu zet je vast met een punaise** (`functioneel-punaise`, open als
  `functioneel-punaise-outline`) in plaats van met een bladwijzer. (#16)
- De actieknoppen van een tegel (vergroten, downloaden) steken boven en onder de titelregel uit,
  zodat de kop van een tegel zonder ondertitel niet hoger is dan haar titel. In de stijlgids
  staat om een brede specimen — een tegel of tabel, die zichzelf omlijst — geen tweede lijn. (#16)

## [0.1.1] - 2026-10-09

### Gewijzigd

- De README en `docs/guides/loading.md` noemen het npm-pakket (`npm install lintje`); de README
  heeft badges voor de versie, de release, Pages en de licentie. (#6)
- Elke pull request zet een regel in deze changelog, met zijn nummer. (#6)
- Commitberichten, pull requests en issues zijn Nederlands. (#5)
- Check draait één keer per pull request, niet meer ook bij elke push en op `main` na een merge.
  (#4)

### Opgelost

- Drie verdwaalde screenshots (`undefined/dashboard*.png`) zijn uit de repository. (#3)

## [0.1.0] - 2026-10-09

### Toegevoegd

- Eerste uitgave: de Rijkshuisstijl als custom elements, in dertien categorieën
  (`src/categories.json`), met zes thema's in licht en donker, de styleguide, de handleidingen in
  `docs/guides/` en de voorbeeldapplicaties met fictieve data.

[unreleased]: https://github.com/h11t-labs/lintje/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/h11t-labs/lintje/compare/v0.5.1...v0.6.0
[0.5.1]: https://github.com/h11t-labs/lintje/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/h11t-labs/lintje/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/h11t-labs/lintje/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/h11t-labs/lintje/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/h11t-labs/lintje/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/h11t-labs/lintje/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/h11t-labs/lintje/releases/tag/v0.1.0
