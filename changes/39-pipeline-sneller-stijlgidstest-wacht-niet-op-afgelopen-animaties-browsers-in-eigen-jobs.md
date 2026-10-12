### Gewijzigd

- De pipeline draait de browsertests per browser in een eigen job, naast de andere checks, en
  binnen een browser meerdere testbestanden tegelijk; de stijlgidstest wacht niet meer op een
  animatie die al afgelopen is, en de release roept dezelfde checks aan. (#39)
