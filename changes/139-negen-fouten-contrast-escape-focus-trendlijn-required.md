### Opgelost

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

### Gewijzigd

- Geen hover neemt nog `--color-bg-selected`; een herkende term met toelichting toont onder de
  muis een dikkere lijn. (#139)
