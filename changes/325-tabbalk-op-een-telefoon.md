### Toegevoegd

- Tabs onderaan op een telefoon: met `mobile-tabs` op `lintje-shell` staan onder 768 px de losse pagina's als tabs onder de duim, ten hoogste vijf, met Menu als laatste en het paneel van Menu als blad erboven, met alle pagina's. Met `tab-parts` kiest de host welke delen van de shell (Zoeken, Meldingen, Jij, Menu) een tab zijn; elk deel staat op één plek. Een ingang met `action` opent iets van de host in plaats van een pagina en stuurt `lintje-action` met die naam, ook in de rail en de navigatiebalk. Wat onderaan plakt, leest de hoogte van de tabs uit `--lintje-shell-bottom`, zoals het vraagvak van het gesprek. Wat uit een tab komt (Menu, Meldingen, Jij), laat de tabs zichtbaar en stopt erop; een tik op een andere tab sluit het. Een toast staat boven de tabs en zakt naar de onderrand zolang een blad van elders ze bedekt (`--lintje-toast-bottom`). Op een tab is de teller 16 px. (#325)

### Gewijzigd

- De balk op een telefoon is in beide indelingen dezelfde: de logobalk scrolt weg en een balk van 56 px blijft plakken, met de naam (en zodra de paginakop uit beeld is de titel van de pagina), zoeken, de bel, de avatar en Menu. De header van 72 px in de indeling met het menu naast de pagina vervalt. Een pagina dieper draagt Terug voor de titel (`back` in de data van de shell). Jouw menu opent op een telefoon als blad van onderen; het paneel van Menu draagt geen gebruiker meer en loopt van kort naar lang: de omgeving, Weergave, Delen en het `end`-slot, de pagina's, dan feedback en de versie. (#325)
- Elk blad op een telefoon is hetzelfde blad: Menu, Meldingen, Jij, Weergave, Delen, Zoeken en Filters komen van onderen, zo hoog als hun inhoud en ten hoogste `--h-sheet` (88vh), met een sluier erboven, hun naam en een sluitknop bovenin, en ze zakken weer weg bij sluiten. Het paneel van Menu is ook zonder tabs zo'n blad; de knop Menu in de balk blijft Menu en de balk ligt onder de sluier. De bel in de balk opende schermvullend en opent nu ook als blad. (#325)

### Verwijderd

- **Brekend:** `mobile-bar` op `lintje-shell`, met `top` en `bottom`. De balk bovenaan is er op een telefoon altijd; wie Menu onder de duim wil, zet `mobile-tabs`. (#325)
