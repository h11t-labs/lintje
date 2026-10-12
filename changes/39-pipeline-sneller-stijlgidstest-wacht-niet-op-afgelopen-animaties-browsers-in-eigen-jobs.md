### Gewijzigd

- De pipeline draait de browsertests per browser in een eigen job, naast de andere checks, en
  binnen een browser meerdere testbestanden tegelijk; de stijlgidstest wacht niet meer op een
  animatie die al afgelopen is, en de release roept dezelfde checks aan. (#39)

### Opgelost

- `lintje-map` op papier: kreeg de kaart haar papiermaat vóór het bericht dat de pagina naar
  papier gaat, dan toonde ze alleen het midden van wat op het scherm stond; nu altijd het hele
  gebied. (#39)
