### Toegevoegd

- `lintje-date-input` en `lintje-time-input` kennen `readonly`, zoals het tekstveld: te lezen en te focussen, niet te wijzigen, en de kalender of de lijst gaat niet open (#401)
- `lintje-find` tekent een hint, een foutregel, de stip van `modified` en de knop terug naar de standaard, zoals elk veld; met `.hideLabel=${false}` staat zijn label erboven (#401)
- `lintje-date-range` kent `bold`, zoals de keuzelijst (#401)

### Gewijzigd

- `lintje-date-range` staat niet meer vanzelf vet zodra er een periode is gekozen, alleen met `bold`; de filterbalk zet `bold` als de periode van de standaard afwijkt en geeft de datumreeks een verborgen `label` in plaats van `accessible-name` (#401)

### Opgelost

- `lintje-number-input` weigert een getypt getal buiten `min` of `max` met een foutregel op de plek van de hint, en stuurt het niet door (#401)
- `lintje-checkbox` verbergt met `hide-label` zijn label, zoals de schakelaar; de naam blijft voor een schermlezer (#401)
- Een uitgeschakelde `lintje-repeater` schakelt ook de velden in zijn rijen uit, zoals `lintje-form-section`, en geeft ze terug zoals ze waren (#401)
- `lintje-date-range` is een veld als de andere: de foutbalk van de nieuwe huisstijl en `layout="row"` werken (#401)
- Enter in een datum- of tijdveld verstuurt een gewoon `<form>`, zoals in een tekstveld; een veld dat weigert wat er getypt is, verstuurt niets (#401)
