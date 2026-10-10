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
- `lintje-kpi` toont het verloop van zijn variabele met `sparkline`: een lijn met haar vlak in de
  kleur van de variabele, zonder assen, geschaald van de laagste tot de hoogste waarde; een
  ontbrekende waarde breekt de lijn en de beschrijving is het tekstalternatief. Het type
  `KpiSparkline` staat in `src/types.ts`; `lintje-kpi-row` geeft het door. (#15)
- Het spreidingsdiagram als grafieksoort (`kind: 'scatter'`): een reeks is een kleur en de vorm
  die die kleur op de kaart heeft, met een norm, datalabels voor de punten die de host noemt en een
  tabel met een rij per punt. (#10)
- Het gestapelde vlak als grafieksoort (`kind: 'stacked-area'`): de onderverdelingen van één
  variabele in haar tintladder, de donkerste onderaan; een ontbrekende waarde breekt de hele
  stapel af, de tooltip sluit af met een totaal en de tabel krijgt een kolom Totaal. Daarvoor
  krijgt `TooltipRow` een `divider`. (#11)

### Gewijzigd

- **Brekend:** `lintje-chart-tile` heet `lintje-chart` en `lintje-map-tile` heet `lintje-map`,
  in de build `tag/chart.js` en `tag/map.js`. De typen volgen: `ChartTileData` wordt `ChartData`,
  `MapTileViewData` wordt `MapData` en `MapTileData` wordt `MapSpec`; een `ChatBlock` noemt
  `kind: 'chart'`. (#14)

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
