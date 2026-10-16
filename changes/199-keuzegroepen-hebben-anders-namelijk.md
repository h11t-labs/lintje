### Toegevoegd

- `lintje-radio-group` en `lintje-checkbox-group` hebben `other`: de laatste optie "Anders,
  namelijk" met een tekstveld eronder zolang ze gekozen is. De tekst is `otherText`, gemeld als
  `lintje-other-change` en meegestuurd als `<name>-other` in de post, in `lintje-values-change` en
  in het concept en de submit van `lintje-form`; een fout van de host onder `<name>-other` staat
  onder het veld (`other-error`), met een ingang in de foutsamenvatting. `OTHER_MISSING_TEXT` is
  de standaardtekst. (#199)
- Een omschrijving van een optie staat in `lintje-radio-group` ook in de gewone rijen, onder het
  label en gekoppeld aan haar radio. (#199)
