# Changelog

Wat er veranderde, per versie, de nieuwste bovenaan. Elke pull request zet hier een regel onder
`[Unreleased]`, ook een kleine, met zijn nummer erachter: `(#12)`. De opzet volgt
[Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) en de versies
[Semantic Versioning](https://semver.org/lang/nl/): de kopjes zijn de zes soorten van Keep a
Changelog in het Nederlands (Toegevoegd, Gewijzigd, Verouderd, Verwijderd, Opgelost, Beveiliging).
`src/types.ts` en de attributen, properties en events van de tags zijn het contract: er één
hernoemen of verwijderen is een brekende wijziging en begint hier met **Brekend:**.

## [Unreleased]

### Toegevoegd

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
- De telefoonvorm geldt alleen op een scherm: `MOBILE` is `screen and (max-width: 767px)`, en een
  host schrijft zijn eigen telefoonregels zo. (#22)

### Opgelost

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

[unreleased]: https://github.com/h11t-labs/lintje/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/h11t-labs/lintje/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/h11t-labs/lintje/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/h11t-labs/lintje/releases/tag/v0.1.0
