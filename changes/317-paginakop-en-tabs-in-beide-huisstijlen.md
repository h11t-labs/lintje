### Gewijzigd

- In beide huisstijlen heeft `lintje-page-header` geen eigen zijpadding meer: de titel staat in lijn met de inhoudskolom eronder. Een host die die padding compenseerde, bijvoorbeeld met een negatieve marge op de paginakop, haalt dat weg. (#317)
- In beide huisstijlen tekent `lintje-tabs` onder een rij links geen leeg paneel meer: alleen wat de host eronder zet, krijgt er een. De tabrij eindigt daardoor ±17 px lager dan een host die het lege paneel compenseerde verwacht; zo'n host haalt de negatieve marge onder de rij weg, anders zakt de rij uit zijn band. (#317)
