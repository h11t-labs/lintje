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
- **De kaart kent `controls`.** Een host zet elk onderdeel van `lintje-map` aan of uit: `zoom`,
  `wheel`, `drag`, `reset`, `lasso`, `circle`, `rect`, `scale` en `legend`. Zonder waarde staat
  alles aan behalve de tekenvormen. Nieuw is de schaalbalk rechtsonder: een ronde afstand met een
  beugel zo lang als die op de kaart, die met zoomen meeloopt.
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
  mark en gebied terugzet.
- **De legenda van de kaart leest per laag.** Eén regel per laag, ook bij één laag: haar naam
  met een vakje dat de laag aan en uit zet, haar sleutel — de klassen van 0 tot het maximum, drie
  cirkels met het bereik of een wig met het bereik — en haar eigen reeksen, elk een schakelaar;
  een kleur in twee lagen schakelt per laag. Meer dan drie lagen vouwen onder "Nog n lagen"; de
  vergroting toont alles, met het bereik per klasse en de cirkels genest op ware maat. Een mark
  die uitgaat krimpt of vervaagt, en komt van west naar oost terug. Op een telefoon is de kaart
  280 px hoog, met alle knoppen op de aanraakmaat.

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
  bronvermelding van een ondergrond staat in de eigen tekstkleuren, ook in donker.
- **Het menu zet je vast met een punaise** (`functioneel-punaise`, open als
  `functioneel-punaise-outline`) in plaats van met een bladwijzer.

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

[unreleased]: https://github.com/h11t-labs/lintje/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/h11t-labs/lintje/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/h11t-labs/lintje/releases/tag/v0.1.0
